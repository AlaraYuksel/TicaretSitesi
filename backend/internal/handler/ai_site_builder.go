package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"go-backend-projem/internal/ai"
	"go-backend-projem/internal/db"
	"go-backend-projem/internal/middleware"
)

// AISiteBuilderHandler — Gemini destekli site builder agent endpoint'leri.
// İki adımlı akış:
//  1. POST /api/ai/build-site/plan  → plan üret, planId döndür
//  2. POST /api/ai/build-site/execute → planı uygula, SSE ile progress yayınla
type AISiteBuilderHandler struct {
	store     *db.Store
	gemini    *ai.GeminiClient
	planCache *planCache
}

func NewAISiteBuilderHandler(store *db.Store) (*AISiteBuilderHandler, error) {
	client, err := ai.NewGeminiClient()
	if err != nil {
		return nil, err
	}
	return &AISiteBuilderHandler{
		store:     store,
		gemini:    client,
		planCache: newPlanCache(10 * time.Minute),
	}, nil
}

// ─── Plan Cache (in-memory, TTL'li) ──────────────────────────────────────────

type cachedPlan struct {
	plan      json.RawMessage
	prompt    string
	siteID    string
	userID    string
	createdAt time.Time
}

type planCache struct {
	mu  sync.Mutex
	ttl time.Duration
	m   map[string]cachedPlan
}

func newPlanCache(ttl time.Duration) *planCache {
	return &planCache{ttl: ttl, m: map[string]cachedPlan{}}
}

func (c *planCache) put(id string, p cachedPlan) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.m[id] = p
	// Lazy GC
	for k, v := range c.m {
		if time.Since(v.createdAt) > c.ttl {
			delete(c.m, k)
		}
	}
}

func (c *planCache) get(id string) (cachedPlan, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	p, ok := c.m[id]
	if !ok || time.Since(p.createdAt) > c.ttl {
		return cachedPlan{}, false
	}
	return p, true
}

// ─── POST /api/ai/build-site/plan ────────────────────────────────────────────

type planRequest struct {
	SiteID string `json:"site_id"`
	Prompt string `json:"prompt"`
	Style  string `json:"style"`
}

type planResponse struct {
	PlanID string          `json:"plan_id"`
	Plan   json.RawMessage `json:"plan"`
}

func (h *AISiteBuilderHandler) PlanSite(w http.ResponseWriter, r *http.Request) {
	var req planRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}
	if strings.TrimSpace(req.Prompt) == "" {
		writeError(w, http.StatusBadRequest, "Prompt boş olamaz")
		return
	}
	if req.SiteID == "" {
		writeError(w, http.StatusBadRequest, "site_id zorunlu")
		return
	}

	userID := middleware.UserIDFromCtx(r.Context())
	if _, err := h.store.GetSiteByID(r.Context(), req.SiteID, userID); err != nil {
		writeError(w, http.StatusNotFound, "Site bulunamadı")
		return
	}

	systemPrompt := planSystemPrompt()
	userMsg := fmt.Sprintf("Stil tercihi: %s\n\nKullanıcının isteği:\n%s",
		valueOr(req.Style, "modern"), req.Prompt)

	planJSON, err := h.gemini.GenerateStructured(
		r.Context(),
		ai.DefaultModel,
		systemPrompt,
		userMsg,
		planSchema(),
	)
	if err != nil {
		log.Printf("AI plan hatası: %v", err)
		writeError(w, http.StatusBadGateway, "Plan üretilemedi: "+err.Error())
		return
	}

	planID := newPlanID()
	h.planCache.put(planID, cachedPlan{
		plan:      planJSON,
		prompt:    req.Prompt,
		siteID:    req.SiteID,
		userID:    userID,
		createdAt: time.Now(),
	})

	writeJSON(w, http.StatusOK, planResponse{PlanID: planID, Plan: planJSON})
}

// ─── POST /api/ai/build-site/execute (SSE) ───────────────────────────────────

type executeRequest struct {
	PlanID string `json:"plan_id"`
	SiteID string `json:"site_id"`
}

func (h *AISiteBuilderHandler) ExecutePlan(w http.ResponseWriter, r *http.Request) {
	// SSE yanıt başlıkları
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	// Sunucu http.Server.WriteTimeout=30s ile yapılandırılmış; Gemini'nin uzun
	// üretim süresi (~60-120s) bunu aşıyor ve bağlantı yarıda kesiliyor
	// (ERR_INCOMPLETE_CHUNKED_ENCODING). Bu SSE handler'ı için yazma deadline'ını
	// kaldırıyoruz.
	rc := http.NewResponseController(w)
	_ = rc.SetWriteDeadline(time.Time{})

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "Streaming desteklenmiyor")
		return
	}

	emit := func(event map[string]interface{}) {
		body, _ := json.Marshal(event)
		fmt.Fprintf(w, "data: %s\n\n", body)
		flusher.Flush()
	}

	var req executeRequest
	if err := decodeJSON(r, &req); err != nil {
		emit(map[string]interface{}{"type": "error", "message": "Geçersiz JSON"})
		return
	}

	userID := middleware.UserIDFromCtx(r.Context())
	cached, ok := h.planCache.get(req.PlanID)
	if !ok || cached.userID != userID || cached.siteID != req.SiteID {
		emit(map[string]interface{}{"type": "error", "message": "Plan bulunamadı veya süresi doldu"})
		return
	}

	site, err := h.store.GetSiteByID(r.Context(), req.SiteID, userID)
	if err != nil {
		emit(map[string]interface{}{"type": "error", "message": "Site bulunamadı"})
		return
	}

	// Mevcut site_data — agent buna ekleme yapacak (genelde boş başlar).
	var siteData ai.SiteData
	if len(site.SiteData) > 0 {
		_ = json.Unmarshal(site.SiteData, &siteData)
	}
	if siteData.Pages == nil {
		siteData.Pages = []*ai.Page{}
	}

	emit(map[string]interface{}{"type": "started", "message": "Site oluşturuluyor..."})

	// ── Tek-atış inşa: Gemini'yi 'build_site_at_once' çağırmaya zorla. ─────
	systemPrompt := executeSystemPrompt()
	initial := fmt.Sprintf(`Kullanıcının isteği: %s

Onaylanan plan (BU PLANA TAM OLARAK UY — sayfa adları, element tipleri, sıralama, TEMA):
%s

GÖREV: Tek bir 'build_site_at_once' tool çağrısıyla bu planı eksiksiz inşa et.

ZORUNLU:
- Yukarıdaki plan.theme nesnesindeki RENKLERİ ve fontFamily'yi TÜM elementlere uygula:
  * Sayfa backgroundColor = theme.backgroundColor.
  * Her elementin bg/cardBg/surfaceBg = theme.surfaceColor veya theme.backgroundColor.
  * Tüm başlık renkleri (color/titleColor) = theme.textColor.
  * Tüm soluk/alt metin renkleri (descColor/excerptColor/subtitleColor/mutedColor) = theme.mutedTextColor.
  * Tüm buton bg / CTA bg / vurgu rengi = theme.primaryColor. Buton text rengi bg ile zıt.
  * Tüm fiyat / accent renkleri = theme.primaryColor veya theme.accentColor.
  * Tüm fontFamily prop'ları = theme.fontFamily.
  * Açık temada (background açık renk) yazılar KOYU; koyu temada yazılar AÇIK.
- Sabit default renk (#4b8eff, #0e0e0e, #1a1a1a, #e5e2e1 vs.) KULLANMA — her renk
  temadan türemiş olmalı.
- Plandaki her sayfa için sayfa nesnesi üret; her element için pages[i].elements[j] içine eleman üret.
- Element tipini plandakiyle birebir eşle; sırayı koru.
- y koordinatları: navbar y=0; sonraki = önceki_y + önceki_height + 24.
- İçerik (title, subtitle, text, label, ürün isimleri) kullanıcının sektör/teması ile uyumlu Türkçe.
- BU SAFHADA SADECE bu tool'u çağır, metin yanıtı verme.`, cached.prompt, string(cached.plan))

	history := []ai.Content{
		{Role: "user", Parts: []ai.Part{{Text: initial}}},
	}
	tools := ai.SiteBuilderTools()
	toolConfig := &ai.ToolConfig{
		FunctionCallingConfig: &ai.FunctionCallingConfig{
			Mode:                 "ANY",
			AllowedFunctionNames: []string{"build_site_at_once"},
		},
	}

	cand, err := h.gemini.GenerateWithTools(r.Context(), ai.DefaultModel, systemPrompt, history, tools, toolConfig)
	if err != nil {
		log.Printf("AI execute Gemini hatası: %v", err)
		emit(map[string]interface{}{"type": "error", "message": "Gemini hatası: " + err.Error()})
		return
	}

	// İçeriği işle — text ve function call'lar karışık gelebilir.
	var calledBuild bool
	for _, part := range cand.Content.Parts {
		if part.Text != "" {
			emit(map[string]interface{}{"type": "thinking", "message": part.Text})
		}
		if part.FunctionCall == nil {
			continue
		}
		if part.FunctionCall.Name != "build_site_at_once" {
			log.Printf("AI beklenmeyen tool çağrısı: %s", part.FunctionCall.Name)
			continue
		}
		calledBuild = true
		result, _, execErr := ai.ExecuteTool(&siteData, part.FunctionCall)
		if execErr != nil {
			log.Printf("AI build_site_at_once hatası: %v", execErr)
			emit(map[string]interface{}{
				"type":    "tool_error",
				"name":    part.FunctionCall.Name,
				"message": execErr.Error(),
			})
			emit(map[string]interface{}{"type": "error", "message": "Site inşa edilemedi: " + execErr.Error()})
			return
		}
		emit(map[string]interface{}{
			"type":   "tool_call",
			"name":   part.FunctionCall.Name,
			"args":   summarizeBuildArgs(part.FunctionCall.Args),
			"result": result,
		})
	}

	if !calledBuild {
		log.Printf("AI: model 'build_site_at_once' çağırmadı. Yanıt: %+v", cand.Content)
		emit(map[string]interface{}{"type": "error", "message": "AI yanıtında geçerli tool çağrısı bulunamadı. Lütfen tekrar dene."})
		return
	}

	// Sıhhat kontrolü: en az bir sayfa ve toplamda en az bir element olmalı.
	totalElements := 0
	for _, p := range siteData.Pages {
		totalElements += len(p.Elements)
	}
	if len(siteData.Pages) == 0 || totalElements == 0 {
		log.Printf("AI: boş site_data üretildi (sayfa=%d, eleman=%d)", len(siteData.Pages), totalElements)
		emit(map[string]interface{}{"type": "error", "message": "AI boş site üretti, lütfen tekrar dene."})
		return
	}

	// Tema'yı plan'dan çıkar ve siteData'ya emniyet kemeri olarak uygula:
	// AI bazı color/bg/font alanlarını eksik bırakırsa, eski sabit defaultlar
	// görünür. Bu pass eksik temalı propsları plan.theme'den doldurur.
	if theme := extractTheme(cached.plan); theme != nil {
		siteData.Theme = theme
		applyThemeDefaults(&siteData, theme)
	}

	if err := h.persistSiteData(context.Background(), req.SiteID, userID, &siteData); err != nil {
		log.Printf("AI persist hatası: %v", err)
		emit(map[string]interface{}{"type": "error", "message": "Site kaydedilemedi: " + err.Error()})
		return
	}
	log.Printf("AI site builder: %s için %d sayfa, %d eleman üretildi", req.SiteID, len(siteData.Pages), totalElements)
	sd, _ := json.Marshal(&siteData)
	emit(map[string]interface{}{"type": "done", "siteData": json.RawMessage(sd)})
}

// summarizeBuildArgs UI'a göndermek için büyük args yapısını özetler
// (tüm JSON'u stream'e koymamak için).
func summarizeBuildArgs(args map[string]interface{}) map[string]interface{} {
	pagesInf, _ := args["pages"].([]interface{})
	summary := []map[string]interface{}{}
	for _, pInf := range pagesInf {
		p, _ := pInf.(map[string]interface{})
		els, _ := p["elements"].([]interface{})
		summary = append(summary, map[string]interface{}{
			"name":     p["name"],
			"elements": len(els),
		})
	}
	return map[string]interface{}{"pages": summary}
}

func (h *AISiteBuilderHandler) persistSiteData(ctx context.Context, siteID, userID string, sd *ai.SiteData) error {
	data, err := json.Marshal(sd)
	if err != nil {
		return err
	}
	_, err = h.store.UpdateSiteData(ctx, db.UpdateSiteDataParams{
		ID:       siteID,
		UserID:   userID,
		SiteData: data,
	})
	return err
}

// ─── Prompt'lar ──────────────────────────────────────────────────────────────

func planSystemPrompt() string {
	return `Sen profesyonel bir web sitesi tasarımcısısın. Türkçe konuşuyorsun.
Kullanıcının isteğine göre bir web sitesi planı çıkarıyorsun.

Yanıtın JSON olmalı ve şu şemaya uymalı:
- summary: 1-2 cümle Türkçe site özeti
- theme: { primaryColor, accentColor, backgroundColor, surfaceColor, textColor, mutedTextColor, fontFamily }
- pages: her sayfa için { name, elements: [ { type, purpose } ] }

TEMA SEÇİMİ (en kritik kısım — kullanıcının isteğine göre özenle seç):
- Kullanıcının dilinde geçen ipuçlarına dikkat et:
  * "koyu / karanlık / dark / modern / siber / lüks / minimal koyu" → koyu tema (backgroundColor: #0a0a0a–#161616)
  * "açık / light / minimal / pastel / sade / temiz / kurumsal" → açık tema (backgroundColor: #ffffff, #f7f9fc, #faf7f2)
  * "renkli / canlı / eğlenceli / çocuk / yemek / fashion" → doygun primary (örn. #ff6b6b, #ffb627, #22c55e)
  * "lüks / butik / şarap / mücevher" → koyu zemin + altın/bakır accent (#c8a96a, #d4a574)
  * "tıp / klinik / sağlık" → açık zemin + medikal yeşil/mavi (#0ea5e9, #14b8a6)
  * "kahve / restoran" → krem zemin + koyu kahve accent (#f5e6d3 + #6b4226)
  * Sektör veya marka mahiyetinden ipucu çıkar.
- Renkler İÇİNDE birbirleriyle uyumlu olmalı:
  * background ile textColor arasında YÜKSEK kontrast (en az 7:1).
  * background koyuysa text açık (#e5e2e1, #f5f5f5); background açıksa text koyu (#191c1e, #1a1a1a).
  * primaryColor zemin üstünde okunaklı olmalı, accentColor primary'den farklı tonda olmalı.
  * surfaceColor backgroundColor'a YAKIN ama hafifçe farklı bir kart/yüzey rengi olmalı
    (koyuda: bg=#0a0a0a → surface=#161616; açıkta: bg=#f7f9fc → surface=#ffffff veya #eceef1).
  * mutedTextColor textColor'ın 40-60% daha soluk hali (paragraf, alt metin için).
- fontFamily seçimi: "modern/teknoloji" → Inter; "minimal/butik" → Playfair Display veya serif;
  "neşeli/genç" → Poppins; "kurumsal" → Inter veya system-ui.

Element tipleri (sadece bunları kullan):
- Genel: heading, paragraph, button, image, hero, card, testimonial, form, divider, badge, icon, box, section, accordion, tabs
- Navigasyon: navbar, minimalistNavbar
- E-ticaret: productGrid, productCard, productListing, productDetailHero, categoryGrid, storeHeader, checkoutForm, cartWidget

İçerik & Yapı Kuralları:
- Anasayfa zorunlu, ilk sayfa olmalı.
- 2-5 sayfa üret (Anasayfa + ihtiyaca göre Hakkımızda, Ürünler, İletişim, vs.)
- Her sayfada 3-8 element olsun.
- Her elementin purpose'u Türkçe, 4-8 kelime; içeriğin temaya uyduğunu belirt (örn: "Kahve dükkanı için sıcak karşılama mesajı").
- E-ticaret istenirse productGrid mutlaka olsun.
- Anasayfa genelde: navbar → hero → (productGrid veya featured content) → testimonial veya cta → footer benzeri kapanış.
- Sadece JSON dön, başka açıklama yapma.`
}

func planSchema() map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"summary": map[string]interface{}{"type": "string"},
			"theme": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"primaryColor":    map[string]interface{}{"type": "string", "description": "Marka rengi (buton/CTA/accent). Hex."},
					"accentColor":     map[string]interface{}{"type": "string", "description": "İkincil vurgu rengi (badge, link). Hex."},
					"backgroundColor": map[string]interface{}{"type": "string", "description": "Sayfa zemin rengi. Hex."},
					"surfaceColor":    map[string]interface{}{"type": "string", "description": "Kart/yüzey rengi, background'a yakın ama farklı. Hex."},
					"textColor":       map[string]interface{}{"type": "string", "description": "Ana metin rengi (background ile yüksek kontrast). Hex."},
					"mutedTextColor":  map[string]interface{}{"type": "string", "description": "Soluk metin rengi (paragraf, alt yazı). Hex."},
					"fontFamily":      map[string]interface{}{"type": "string", "description": "CSS font ailesi, örn: 'Inter, sans-serif'"},
				},
				"required": []string{"primaryColor", "backgroundColor", "textColor"},
			},
			"pages": map[string]interface{}{
				"type": "array",
				"items": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"name": map[string]interface{}{"type": "string"},
						"elements": map[string]interface{}{
							"type": "array",
							"items": map[string]interface{}{
								"type": "object",
								"properties": map[string]interface{}{
									"type":    map[string]interface{}{"type": "string"},
									"purpose": map[string]interface{}{"type": "string"},
								},
								"required": []string{"type", "purpose"},
							},
						},
					},
					"required": []string{"name", "elements"},
				},
			},
		},
		"required": []string{"summary", "theme", "pages"},
	}
}

func executeSystemPrompt() string {
	return `Sen bir website builder agent'ısın. Türkçe konuşuyorsun.
Verilen onaylanmış plana göre 'build_site_at_once' tool'u ile siteyi tek seferde inşa ediyorsun.

═══════════════════════════════════════════════════════════════
TEMAYA SADIK KAL — EN ÖNEMLİ KURAL
═══════════════════════════════════════════════════════════════
Plan içinde verilen 'theme' nesnesi (backgroundColor, surfaceColor, primaryColor,
accentColor, textColor, mutedTextColor, fontFamily) TÜM SİTEYE TUTARLI ŞEKİLDE
uygulanmalı. Her elemana plandaki temaya UYGUN renkler ver.

— SAYFA ZEMİNİ —
Her sayfanın backgroundColor'ı plandaki theme.backgroundColor olmalı.

— ELEMENT BACKGROUND'LARI (bg, cardBg, sectionBg) —
Şu öncelik sırasıyla seç:
1. Tam ekran/section blokları (hero, productGrid, storeHeader, navbar): theme.backgroundColor
   VEYA hafifçe farklı bir ton (örn. bg arka planın 1-2 ton koyusu/açığı).
2. Kart yüzeyleri (card, productCard, testimonial, accordion item, form input): theme.surfaceColor.
3. Buton bg: theme.primaryColor. Hover/secondary buton: theme.accentColor.
4. Rozet (badge) bg: theme.accentColor veya theme.primaryColor.
5. ASLA varsayılan #4b8eff, #0e0e0e, #1a1a1a gibi sabit renkler bırakma — hepsi
   plandaki temadan türetilmeli.

— TEXT RENKLERİ (color, titleColor, descColor, vb.) —
- Açık zeminde KOYU yazı, koyu zeminde AÇIK yazı (kontrast 7:1+).
- Ana başlıklar (heading.color, hero.titleColor, card.titleColor): theme.textColor.
- Alt yazılar/paragraf (paragraph.color, hero.subtitleColor, card.excerptColor,
  card.descColor, testimonial.quoteColor, productCard.descColor): theme.mutedTextColor.
- Fiyat (priceColor) ve vurgu metinler: theme.primaryColor veya theme.accentColor.
- Buton text (color): bg ile zıt — primaryColor koyuysa #fff, açıksa #111.
- Tag/rozet text: theme.backgroundColor (zemin) veya #fff.

— FONT —
Tüm heading ve paragraph elementlerine theme.fontFamily uygula (fontFamily prop'u).

— KENARLIK / DIVIDER —
borderColor ve divider.color theme.textColor'ın 8-15% opaklığı olmalı
(koyu temada 'rgba(255,255,255,0.08)', açık temada 'rgba(0,0,0,0.1)' gibi).

═══════════════════════════════════════════════════════════════
DİĞER KURALLAR
═══════════════════════════════════════════════════════════════
LAYOUT:
- Element y koordinatları artan sırada, üst üste binmesin:
  * navbar/minimalistNavbar: y=0
  * Sonraki element: önceki_y + önceki_height + 24
- Full-width elementler (navbar, hero, productGrid, storeHeader): x=0, width=1440.
- İçerik elementleri (heading, paragraph, button, image): x=120 civarı.

İÇERİK:
- Tüm metin (title, subtitle, text, ctaText, label, placeholder, vb.) TÜRKÇE.
- İçerik kullanıcının sektör/marka mahiyetine uygun olmalı (kahve dükkanı için
  kahve içerikli metinler, mücevherci için zarif/lüks metinler).
- productGrid.products dizisi 4-8 mantıklı ürün içermeli (Türkçe başlık, ₺ fiyat).
- Görseller için: https://placehold.co/{W}x{H}/{surfaceColorHexNoHash}/{primaryColorHexNoHash}?text=...
  (placeholder rengini de temadan türet, sabit kullanma).

ELEMENT PROP REHBERİ (her props nesnesinde theme'den uygun renkleri uygula):
- heading: { text, fontSize (24-64), fontWeight, color: theme.textColor, fontFamily, align }
- paragraph: { text, fontSize (14-20), color: theme.mutedTextColor, fontFamily, lineHeight }
- button: { text, bg: theme.primaryColor, color: (kontrast), borderRadius, paddingX, paddingY, href }
- hero: { tag, title, subtitle, ctaText, bg: theme.backgroundColor, titleColor: theme.textColor,
         subtitleColor: theme.mutedTextColor, ctaBg: theme.primaryColor, ctaColor: (kontrast),
         tagColor: theme.primaryColor, tagBg: (primary'nin 10% opaklığı) }
- navbar / minimalistNavbar: { brand, items, bg: theme.surfaceColor veya theme.backgroundColor,
         color/linkColor: theme.textColor, ctaBg: theme.primaryColor }
- card: { title, description, image, buttonText, bg: theme.surfaceColor,
         titleColor: theme.textColor, excerptColor/descColor: theme.mutedTextColor,
         ctaColor: theme.primaryColor, borderColor: (textColor'ın 8% opaklığı) }
- productGrid: { columns (3-4), gap, sectionTitle, sectionTitleColor: theme.textColor,
         bg: theme.backgroundColor, cardBg: theme.surfaceColor,
         priceColor: theme.primaryColor, titleColor: theme.textColor,
         badgeBg: theme.accentColor, badgeColor: theme.backgroundColor,
         products: [{id, title (TR), price (TL), image, rating, badge}] }
- productCard: { title, description, price, currency: '₺', imageSrc, rating, badge,
         bg: theme.surfaceColor, titleColor: theme.textColor,
         descColor: theme.mutedTextColor, priceColor: theme.primaryColor,
         ctaBg: theme.primaryColor, ctaColor: (kontrast) }
- testimonial: { quote, author/name, role, bg: theme.surfaceColor,
         quoteColor: theme.textColor, nameColor: theme.textColor,
         metaColor: theme.mutedTextColor, starColor: theme.accentColor }
- form: { fields, submitText, submitBg: theme.primaryColor, submitColor: (kontrast),
         bg: theme.surfaceColor, inputBg: theme.backgroundColor,
         labelColor: theme.mutedTextColor, inputColor: theme.textColor }
- image: { src (placeholder), alt, objectFit: 'cover' }
- categoryGrid: { sectionTitle, sectionTitleColor: theme.textColor,
         bg: theme.backgroundColor, cardBg: theme.surfaceColor,
         primaryColor: theme.primaryColor, textColor: theme.textColor,
         categories: [{id, label, count, imageSrc}] }
- divider: { color: theme.textColor'ın 10% opaklığı, thickness: 1 }
- badge: { text, bg: theme.accentColor, color: theme.backgroundColor }

ÇIKTI:
- 'build_site_at_once' tool'unu tam doldur ve çağır. Metin yanıtı verme.
- Plandaki sayfa sırasına ve element sırasına KESİNLİKLE uy.`
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

func newPlanID() string {
	return fmt.Sprintf("plan_%d", time.Now().UnixNano())
}

func valueOr(s, fallback string) string {
	if strings.TrimSpace(s) == "" {
		return fallback
	}
	return s
}

// extractTheme planJSON'dan theme nesnesini çıkarır.
func extractTheme(planJSON json.RawMessage) map[string]interface{} {
	var parsed struct {
		Theme map[string]interface{} `json:"theme"`
	}
	if err := json.Unmarshal(planJSON, &parsed); err != nil {
		return nil
	}
	if parsed.Theme == nil {
		return nil
	}
	// String tipinde değerleri normalize et (boş olanları sil).
	out := map[string]interface{}{}
	for k, v := range parsed.Theme {
		if s, ok := v.(string); ok && strings.TrimSpace(s) == "" {
			continue
		}
		out[k] = v
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// applyThemeDefaults — emniyet kemeri:
// AI'ın doldurmadığı color/bg prop'larına plan.theme'den uygun rengi koyar.
// AI'ın açıkça set ettiği değerleri ASLA değiştirmez.
func applyThemeDefaults(site *ai.SiteData, theme map[string]interface{}) {
	bg, _ := theme["backgroundColor"].(string)
	surface, _ := theme["surfaceColor"].(string)
	primary, _ := theme["primaryColor"].(string)
	accent, _ := theme["accentColor"].(string)
	text, _ := theme["textColor"].(string)
	muted, _ := theme["mutedTextColor"].(string)
	font, _ := theme["fontFamily"].(string)

	if surface == "" {
		surface = bg // surface yoksa background'a düş
	}
	if accent == "" {
		accent = primary // accent yoksa primary'ye düş
	}
	if muted == "" {
		muted = text // muted yoksa text'e düş
	}
	contrastOnPrimary := contrastTextFor(primary)
	contrastOnBg := contrastTextFor(bg)

	for _, page := range site.Pages {
		if page.BackgroundColor == "" || page.BackgroundColor == "#0e0e0e" {
			if bg != "" {
				page.BackgroundColor = bg
			}
		}
		for _, el := range page.Elements {
			if el.Props == nil {
				el.Props = map[string]interface{}{}
			}
			fillThemeForElement(el, themePalette{
				Bg: bg, Surface: surface, Primary: primary, Accent: accent,
				Text: text, Muted: muted, Font: font,
				CtaText: contrastOnPrimary, BgText: contrastOnBg,
			})
		}
	}
}

type themePalette struct {
	Bg, Surface, Primary, Accent, Text, Muted, Font string
	CtaText, BgText                                  string
}

// fillThemeForElement bir elementin props'unda eksik color/bg alanlarını doldurur.
// Yalnızca prop YOKSA (key set değilse) tema renkleri uygulanır.
func fillThemeForElement(el *ai.Element, t themePalette) {
	p := el.Props
	// Tema-bağımsız fontFamily her elemana uygulanabilir (text içerikli).
	setIfMissing(p, "fontFamily", t.Font)

	switch el.Type {
	case "heading":
		setIfMissing(p, "color", t.Text)
	case "paragraph":
		setIfMissing(p, "color", t.Muted)
	case "button":
		setIfMissing(p, "bg", t.Primary)
		setIfMissing(p, "color", t.CtaText)
	case "hero":
		setIfMissing(p, "bg", t.Bg)
		setIfMissing(p, "titleColor", t.Text)
		setIfMissing(p, "subtitleColor", t.Muted)
		setIfMissing(p, "ctaBg", t.Primary)
		setIfMissing(p, "ctaColor", t.CtaText)
		setIfMissing(p, "tagColor", t.Primary)
	case "navbar":
		setIfMissing(p, "bg", t.Surface)
		setIfMissing(p, "linkColor", t.Text)
		setIfMissing(p, "logoColor", t.Text)
		setIfMissing(p, "ctaBg", t.Primary)
		setIfMissing(p, "ctaColor", t.CtaText)
	case "minimalistNavbar":
		setIfMissing(p, "bg", t.Surface)
		setIfMissing(p, "brandColor", t.Text)
		setIfMissing(p, "linkColor", t.Text)
		setIfMissing(p, "activeLinkColor", t.Primary)
	case "card":
		setIfMissing(p, "bg", t.Surface)
		setIfMissing(p, "titleColor", t.Text)
		setIfMissing(p, "excerptColor", t.Muted)
		setIfMissing(p, "descColor", t.Muted)
		setIfMissing(p, "ctaColor", t.Primary)
	case "form":
		setIfMissing(p, "bg", t.Surface)
		setIfMissing(p, "submitBg", t.Primary)
		setIfMissing(p, "submitColor", t.CtaText)
		setIfMissing(p, "labelColor", t.Muted)
		setIfMissing(p, "inputColor", t.Text)
		setIfMissing(p, "inputBg", t.Bg)
	case "testimonial":
		setIfMissing(p, "bg", t.Surface)
		setIfMissing(p, "quoteColor", t.Muted)
		setIfMissing(p, "nameColor", t.Text)
		setIfMissing(p, "textColor", t.Text)
		setIfMissing(p, "metaColor", t.Muted)
		setIfMissing(p, "starColor", t.Accent)
	case "badge":
		setIfMissing(p, "bg", t.Accent)
		setIfMissing(p, "color", t.BgText)
	case "section":
		setIfMissing(p, "bg", t.Surface)
	case "box":
		setIfMissing(p, "bg", t.Surface)
	case "icon":
		setIfMissing(p, "color", t.Primary)
	case "divider":
		setIfMissing(p, "color", mutedBorderFor(t.Bg, t.Text))
	case "productGrid":
		setIfMissing(p, "bg", t.Bg)
		setIfMissing(p, "sectionTitleColor", t.Text)
		setIfMissing(p, "cardBg", t.Surface)
		setIfMissing(p, "titleColor", t.Text)
		setIfMissing(p, "priceColor", t.Primary)
		setIfMissing(p, "badgeBg", t.Accent)
		setIfMissing(p, "badgeColor", t.BgText)
	case "productCard":
		setIfMissing(p, "bg", t.Surface)
		setIfMissing(p, "titleColor", t.Text)
		setIfMissing(p, "descColor", t.Muted)
		setIfMissing(p, "priceColor", t.Primary)
		setIfMissing(p, "ctaBg", t.Primary)
		setIfMissing(p, "ctaColor", t.CtaText)
	case "productListing":
		setIfMissing(p, "bg", t.Bg)
		setIfMissing(p, "primaryColor", t.Primary)
		setIfMissing(p, "surfaceColor", t.Surface)
		setIfMissing(p, "textColor", t.Text)
		setIfMissing(p, "textMutedColor", t.Muted)
		setIfMissing(p, "accentColor", t.Accent)
	case "productDetailHero":
		setIfMissing(p, "bg", t.Bg)
		setIfMissing(p, "primaryColor", t.Primary)
		setIfMissing(p, "textColor", t.Text)
		setIfMissing(p, "textMutedColor", t.Muted)
		setIfMissing(p, "accentColor", t.Accent)
	case "categoryGrid":
		setIfMissing(p, "bg", t.Bg)
		setIfMissing(p, "cardBg", t.Surface)
		setIfMissing(p, "sectionTitleColor", t.Text)
		setIfMissing(p, "primaryColor", t.Primary)
		setIfMissing(p, "textColor", t.Text)
		setIfMissing(p, "textMutedColor", t.Muted)
		setIfMissing(p, "accentColor", t.Accent)
	case "storeHeader":
		setIfMissing(p, "bg", t.Surface)
		setIfMissing(p, "nameColor", t.Text)
		setIfMissing(p, "descColor", t.Muted)
		setIfMissing(p, "activeCategoryColor", t.Primary)
	case "checkoutForm":
		setIfMissing(p, "bg", t.Bg)
		setIfMissing(p, "cardBg", t.Surface)
		setIfMissing(p, "buttonBg", t.Primary)
		setIfMissing(p, "buttonColor", t.CtaText)
		setIfMissing(p, "titleColor", t.Text)
		setIfMissing(p, "subtitleColor", t.Muted)
		setIfMissing(p, "labelColor", t.Muted)
		setIfMissing(p, "inputColor", t.Text)
		setIfMissing(p, "accentColor", t.Primary)
	case "cartWidget":
		setIfMissing(p, "bg", t.Primary)
		setIfMissing(p, "color", t.CtaText)
	}
}

func setIfMissing(m map[string]interface{}, key string, val string) {
	if val == "" {
		return
	}
	if existing, ok := m[key]; ok {
		if s, isStr := existing.(string); isStr && strings.TrimSpace(s) != "" {
			return // AI değer set etmiş, dokunma
		}
	}
	m[key] = val
}

// contrastTextFor — verilen hex rengin üstünde okunaklı yazı rengi döner (#fff veya #111).
func contrastTextFor(hex string) string {
	if isLightHex(hex) {
		return "#111111"
	}
	return "#ffffff"
}

// mutedBorderFor — zemine göre uygun divider/border rengi (text'in 10% opaklığı yerine yarı saydam).
func mutedBorderFor(bg, text string) string {
	if isLightHex(bg) {
		return "rgba(0,0,0,0.1)"
	}
	return "rgba(255,255,255,0.1)"
}

// isLightHex — hex rengin parlaklığı 0.5'ten büyükse light kabul edilir.
func isLightHex(hex string) bool {
	hex = strings.TrimPrefix(strings.TrimSpace(hex), "#")
	if len(hex) == 3 {
		hex = string([]byte{hex[0], hex[0], hex[1], hex[1], hex[2], hex[2]})
	}
	if len(hex) < 6 {
		return false
	}
	r := hexByte(hex[0:2])
	g := hexByte(hex[2:4])
	b := hexByte(hex[4:6])
	// Relatif parlaklık (basitleştirilmiş YIQ formülü).
	y := (299*r + 587*g + 114*b) / 1000
	return y > 140
}

func hexByte(s string) int {
	v := 0
	for _, c := range s {
		v *= 16
		switch {
		case c >= '0' && c <= '9':
			v += int(c - '0')
		case c >= 'a' && c <= 'f':
			v += int(c-'a') + 10
		case c >= 'A' && c <= 'F':
			v += int(c-'A') + 10
		}
	}
	return v
}
