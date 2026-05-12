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
//   1) POST /api/ai/build-site/plan  → plan üret, planId döndür
//   2) POST /api/ai/build-site/execute → planı uygula, SSE ile progress yayınla
type AISiteBuilderHandler struct {
	store    *db.Store
	gemini   *ai.GeminiClient
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

	// ── Agent loop ─────────────────────────────────────────────────────────
	systemPrompt := executeSystemPrompt()
	initial := fmt.Sprintf("Kullanıcının isteği: %s\n\nOnaylanan plan (bu plana sadık kal):\n%s\n\nGörev: API kota sınırlarını aşmamak için KESİNLİKLE 'build_site_at_once' aracını çağırarak bu planı TEK SEFERDE site_data'ya dönüştür.",
		cached.prompt, string(cached.plan))

	history := []ai.Content{
		{Role: "user", Parts: []ai.Part{{Text: initial}}},
	}
	tools := ai.SiteBuilderTools()

	const maxIters = 40
	for iter := 0; iter < maxIters; iter++ {
		// İstek iptal edildi mi?
		select {
		case <-r.Context().Done():
			emit(map[string]interface{}{"type": "error", "message": "İstek iptal edildi"})
			return
		default:
		}

		cand, err := h.gemini.GenerateWithTools(r.Context(), ai.DefaultModel, systemPrompt, history, tools)
		if err != nil {
			emit(map[string]interface{}{"type": "error", "message": "Gemini hatası: " + err.Error()})
			return
		}

		// Model yanıtını history'ye ekle (function call ve metni birlikte).
		history = append(history, cand.Content)

		// İçeriği işle — text ve function call'lar karışık gelebilir.
		var anyFunctionCall bool
		var responses []ai.Part
		for _, part := range cand.Content.Parts {
			if part.Text != "" {
				emit(map[string]interface{}{"type": "thinking", "message": part.Text})
			}
			if part.FunctionCall != nil {
				anyFunctionCall = true
				result, done, execErr := ai.ExecuteTool(&siteData, part.FunctionCall)
				if execErr != nil {
					responses = append(responses, ai.Part{
						FunctionResponse: &ai.FunctionResponse{
							Name:     part.FunctionCall.Name,
							Response: map[string]interface{}{"error": execErr.Error()},
						},
					})
					emit(map[string]interface{}{
						"type":    "tool_error",
						"name":    part.FunctionCall.Name,
						"message": execErr.Error(),
					})
					continue
				}
				emit(map[string]interface{}{
					"type":   "tool_call",
					"name":   part.FunctionCall.Name,
					"args":   part.FunctionCall.Args,
					"result": result,
				})
				if done {
					if err := h.persistSiteData(context.Background(), req.SiteID, userID, &siteData); err != nil {
						emit(map[string]interface{}{"type": "error", "message": "Site kaydedilemedi: " + err.Error()})
						return
					}
					sd, _ := json.Marshal(&siteData)
					emit(map[string]interface{}{"type": "done", "siteData": json.RawMessage(sd)})
					return
				}
				responses = append(responses, ai.Part{
					FunctionResponse: &ai.FunctionResponse{
						Name:     part.FunctionCall.Name,
						Response: result,
					},
				})
			}
		}

		if !anyFunctionCall {
			// Model fonksiyon çağırmadan durdu — manuel olarak done sayalım.
			if err := h.persistSiteData(context.Background(), req.SiteID, userID, &siteData); err != nil {
				emit(map[string]interface{}{"type": "error", "message": "Site kaydedilemedi: " + err.Error()})
				return
			}
			sd, _ := json.Marshal(&siteData)
			emit(map[string]interface{}{"type": "done", "siteData": json.RawMessage(sd)})
			return
		}

		// Tool sonuçlarını user rolüyle history'ye ekle.
		history = append(history, ai.Content{Role: "user", Parts: responses})
	}

	emit(map[string]interface{}{"type": "error", "message": "Max iterasyon aşıldı, kısmi sonuç kaydediliyor"})
	_ = h.persistSiteData(context.Background(), req.SiteID, userID, &siteData)
	sd, _ := json.Marshal(&siteData)
	emit(map[string]interface{}{"type": "done", "siteData": json.RawMessage(sd)})
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
- theme: { primaryColor, accentColor, backgroundColor (koyu modern siteler için #0e0e0e tercih edilir), textColor, fontFamily }
- pages: her sayfa için { name, elements: [ { type, purpose } ] }

Element tipleri (sadece bunları kullan):
- Genel: heading, paragraph, button, image, hero, card, testimonial, form, divider, badge, icon, box, section, accordion, tabs
- Navigasyon: navbar, minimalistNavbar
- E-ticaret: productGrid, productCard, productListing, productDetailHero, categoryGrid, storeHeader, checkoutForm, cartWidget

Kurallar:
- Anasayfa zorunlu, ilk sayfa olmalı.
- 2-5 sayfa üret (Anasayfa + ihtiyaca göre Hakkımızda, Ürünler, İletişim, vs.)
- Her sayfada 3-8 element olsun.
- Her elementin purpose'u Türkçe, 4-8 kelime.
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
					"primaryColor":    map[string]interface{}{"type": "string"},
					"accentColor":     map[string]interface{}{"type": "string"},
					"backgroundColor": map[string]interface{}{"type": "string"},
					"textColor":       map[string]interface{}{"type": "string"},
					"fontFamily":      map[string]interface{}{"type": "string"},
				},
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
Verilen onaylanmış plana göre tool çağrıları yaparak site_data JSON'unu inşa ediyorsun.

Çalışma sırası:
1. KESİNLİKLE 'build_site_at_once' aracını kullanarak TÜM siteyi TEK BİR ÇAĞRIDA inşa et.
2. API limitlerine (dakikada 5 istek) takılmamak için add_page veya add_element kullanma.
3. Elementlerin y koordinatlarını sıralı artır:
   - İlk navbar/minimalistNavbar: y=0
   - Hero: y=80 (navbar altı)
   - Sonraki her element: önceki y + height + 24 px boşluk
4. x koordinatı genelde 0 (full-width) veya 120 (içerikler için).
5. Önemli element propslarını dolu doldur. Türkçe içerik yaz.
   Örnek: hero için { tag: 'YENİ KOLEKSİYON', title: '...', subtitle: '...', ctaText: 'Keşfet' }
   Örnek: heading için { text: 'Başlık', fontSize: 36, color: '#e5e2e1' }
6. productGrid eklerken products dizisini doldur (4-8 mantıklı Türkçe ürün, fiyat TL).
7. Tema renklerini kullan (plandaki theme.primaryColor, accentColor, vs.).

Element prop ipuçları:
- heading: text, fontSize (24-64), fontWeight, color, align
- paragraph: text, fontSize (14-20), color, lineHeight
- button: text, bg, color, borderRadius, paddingX, paddingY, href
- hero: tag, title, subtitle, ctaText, bg
- navbar: brand, items (label/href array), bg, color
- card: title, description, image, buttonText
- productGrid: columns (3-4), gap, sectionTitle, products (id/title/price/image/rating/badge)
- testimonial: quote, author, role
- form: fields (id/type/label/placeholder), submitText, submitBg
- image: src (placeholder URL: https://placehold.co/WxH/121212/4b8eff?text=...), alt
- categoryGrid: sectionTitle, categories (id/label/image)

Kurallar:
- Asla 40'tan fazla tool çağrısı yapma.
- Her sayfada en az 3 element olsun.
- Görseller için https://placehold.co/... placeholder URL'leri kullan.
- Türkçe içerik üret, asla İngilizce ipsum yazma.`
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
