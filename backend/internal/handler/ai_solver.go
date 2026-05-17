package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"go-backend-projem/internal/ai"
	"go-backend-projem/internal/db"
	"go-backend-projem/internal/middleware"
)

// AISolverHandler — Marketplace AI Çözüm Asistanı.
//
// Kullanıcı doğal dilde bir sorun anlatır; handler şu adımları yürütür:
//   1. Analiz       — sorunu çelişkiye (iyileşen ↔ kısıt) çevirir + arama ifadeleri üretir.
//   2. Vektörel arama — her arama ifadesini embedler, pgvector ile aday ürünleri çeker.
//   3. Dinamik paketleme — adaylardan çok ürünlü bir çözüm paketi kurar.
//   4. Operasyonel kanıt — seçilen ürünleri DB'den canlı stok/fiyat ile doğrular,
//      gerekirse aynı kategoride daha uygun ürünle değiştirir.
// Akış SSE ile adım adım yayınlanır (ai_site_builder.go deseni).
type AISolverHandler struct {
	store  *db.Store
	gemini *ai.GeminiClient
}

// NewAISolverHandler — GEMINI_API_KEY yoksa hata döner; main.go route'ları kaydetmez.
func NewAISolverHandler(store *db.Store) (*AISolverHandler, error) {
	client, err := ai.NewGeminiClient()
	if err != nil {
		return nil, err
	}
	return &AISolverHandler{store: store, gemini: client}, nil
}

// ─── DTO'lar ──────────────────────────────────────────────────────────────────

type solverAnalysis struct {
	Improving      string   `json:"improving"`
	Constraint     string   `json:"constraint"`
	Summary        string   `json:"summary"`
	SearchConcepts []string `json:"search_concepts"`
}

type solverPackageItemRaw struct {
	ProductID string `json:"product_id"`
	Role      string `json:"role"`
	Reason    string `json:"reason"`
	Quantity  int    `json:"quantity"`
}

type solverPackageRaw struct {
	PackageTitle string                 `json:"package_title"`
	Intro        string                 `json:"intro"`
	Items        []solverPackageItemRaw `json:"items"`
}

type solverFinalItem struct {
	ProductID    string `json:"product_id"`
	Title        string `json:"title"`
	Image        string `json:"image"`
	Seller       string `json:"seller"`
	SiteID       string `json:"site_id"`
	Category     string `json:"category"`
	Currency     string `json:"currency"`
	Role         string `json:"role"`
	Reason       string `json:"reason"`
	Quantity     int    `json:"quantity"`
	Price        int64  `json:"price"`       // kuruş — canlı fiyat
	LineTotal    int64  `json:"line_total"`  // kuruş
	Stock        int    `json:"stock_quantity"`
	Replaced     bool   `json:"replaced"`
	ReplacedNote string `json:"replaced_note,omitempty"`
}

type solverPackage struct {
	PackageTitle string            `json:"package_title"`
	Intro        string            `json:"intro"`
	Items        []solverFinalItem `json:"items"`
	TotalPrice   int64             `json:"total_price"`
	ItemCount    int               `json:"item_count"`
}

// ─── POST /api/marketplace/ai-solver/solve (SSE) ──────────────────────────────

func (h *AISolverHandler) Solve(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	// Gemini çağrıları uzun sürebilir — yazma deadline'ını kaldır.
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

	var req struct {
		Problem string `json:"problem"`
	}
	if err := decodeJSON(r, &req); err != nil {
		emit(map[string]interface{}{"type": "error", "message": "Geçersiz JSON"})
		return
	}
	problem := strings.TrimSpace(req.Problem)
	if len([]rune(problem)) < 10 {
		emit(map[string]interface{}{"type": "error", "message": "Lütfen sorununuzu biraz daha ayrıntılı anlatın."})
		return
	}
	if len([]rune(problem)) > 2000 {
		problem = string([]rune(problem)[:2000])
	}

	ctx := r.Context()
	emit(map[string]interface{}{"type": "started", "message": "Çözüm üretiliyor..."})

	// ── 1. Analiz ──────────────────────────────────────────────────────────
	emit(map[string]interface{}{"type": "step", "step": "analyzing", "message": "Sorun çelişkiye dönüştürülüyor..."})
	analysisJSON, err := h.gemini.GenerateStructured(ctx, ai.DefaultModel, solverAnalysisSystemPrompt(), problem, solverAnalysisSchema())
	if err != nil {
		log.Printf("AI solver analiz hatası: %v", err)
		emit(map[string]interface{}{"type": "error", "message": "Sorun analiz edilemedi: " + err.Error()})
		return
	}
	var analysis solverAnalysis
	if err := json.Unmarshal(analysisJSON, &analysis); err != nil {
		log.Printf("AI solver analiz parse: %v", err)
		emit(map[string]interface{}{"type": "error", "message": "Analiz yanıtı okunamadı."})
		return
	}
	emit(map[string]interface{}{"type": "analyzed", "analysis": analysis})

	// ── 2. Vektörel arama ──────────────────────────────────────────────────
	emit(map[string]interface{}{"type": "step", "step": "searching", "message": "Katalogda anlamsal arama yapılıyor..."})
	queries := append([]string{problem}, analysis.SearchConcepts...)
	if len(queries) > 7 {
		queries = queries[:7]
	}
	candidates := map[string]db.PublishedProduct{}
	for _, q := range queries {
		q = strings.TrimSpace(q)
		if q == "" {
			continue
		}
		emb, err := h.gemini.GenerateEmbedding(ctx, q)
		if err != nil {
			log.Printf("AI solver embedding hatası (%q): %v", q, err)
			continue
		}
		prods, err := h.store.SearchPublishedProductsByVector(ctx, emb, 8)
		if err != nil {
			log.Printf("AI solver vektör arama hatası: %v", err)
			continue
		}
		for _, p := range prods {
			candidates[p.ID] = p
		}
	}
	if len(candidates) == 0 {
		emit(map[string]interface{}{"type": "error", "message": "Kataloğunuzda bu soruna uygun, vektörlenmiş ürün bulunamadı."})
		return
	}
	emit(map[string]interface{}{"type": "searched", "count": len(candidates)})

	// ── 3. Dinamik paketleme ───────────────────────────────────────────────
	emit(map[string]interface{}{"type": "step", "step": "packaging", "message": "Çözüm paketi oluşturuluyor..."})
	pkgJSON, err := h.gemini.GenerateStructured(ctx, ai.DefaultModel,
		solverPackageSystemPrompt(), buildPackagePrompt(problem, analysis, candidates), solverPackageSchema())
	if err != nil {
		log.Printf("AI solver paketleme hatası: %v", err)
		emit(map[string]interface{}{"type": "error", "message": "Çözüm paketi oluşturulamadı: " + err.Error()})
		return
	}
	var pkgRaw solverPackageRaw
	if err := json.Unmarshal(pkgJSON, &pkgRaw); err != nil || len(pkgRaw.Items) == 0 {
		log.Printf("AI solver paket parse: %v", err)
		emit(map[string]interface{}{"type": "error", "message": "Çözüm paketi yanıtı okunamadı."})
		return
	}

	// ── 4. Operasyonel kanıt ───────────────────────────────────────────────
	emit(map[string]interface{}{"type": "step", "step": "verifying", "message": "Canlı stok ve fiyat doğrulanıyor..."})
	final := h.verifyPackage(ctx, pkgRaw, candidates)
	if len(final.Items) == 0 {
		emit(map[string]interface{}{"type": "error", "message": "Seçilen ürünlerin hiçbiri şu an stokta değil."})
		return
	}

	emit(map[string]interface{}{"type": "done", "analysis": analysis, "package": final})
}

// verifyPackage — AI'ın seçtiği ürünleri DB'den canlı okur. Stokta olmayan veya
// bulunamayan ürünleri aynı kategoride stoğu olan en uygun fiyatlı adayla değiştirir.
func (h *AISolverHandler) verifyPackage(ctx context.Context, raw solverPackageRaw, candidates map[string]db.PublishedProduct) solverPackage {
	used := map[string]bool{}
	out := solverPackage{PackageTitle: raw.PackageTitle, Intro: raw.Intro}

	for _, it := range raw.Items {
		qty := it.Quantity
		if qty < 1 {
			qty = 1
		}
		if qty > 10 {
			qty = 10
		}

		// Canlı oku — published_products yayınlı siteden gelir.
		prod, err := h.store.GetPublishedProductByID(ctx, it.ProductID)
		replaced := false
		note := ""

		if err != nil || prod.StockQuantity <= 0 {
			// Değiştir: aynı kategoride, stokta, kullanılmamış, en ucuz aday.
			var orig string
			if err == nil {
				orig = prod.Title
			}
			repl := cheapestReplacement(candidates, categoryOf(err, prod), used)
			if repl == nil {
				continue // uygun ikame yok — paketten çıkar
			}
			prod = repl
			replaced = true
			if orig != "" {
				note = fmt.Sprintf("\"%s\" stokta yok; daha uygun bir alternatifle değiştirildi.", orig)
			} else {
				note = "Önerilen ürün artık mevcut değil; benzer bir ürünle değiştirildi."
			}
		}
		if used[prod.ID] {
			continue // aynı ürün iki kez gelmesin
		}
		used[prod.ID] = true

		item := solverFinalItem{
			ProductID:    prod.ID,
			Title:        prod.Title,
			SiteID:       prod.SiteID,
			Currency:     prod.Currency,
			Role:         strings.TrimSpace(it.Role),
			Reason:       strings.TrimSpace(it.Reason),
			Quantity:     qty,
			Price:        prod.Price,
			LineTotal:    prod.Price * int64(qty),
			Stock:        prod.StockQuantity,
			Replaced:     replaced,
			ReplacedNote: note,
		}
		if prod.ImageURL != nil {
			item.Image = *prod.ImageURL
		}
		if prod.StoreName != nil {
			item.Seller = *prod.StoreName
		}
		if prod.Category != nil {
			item.Category = *prod.Category
		}
		out.Items = append(out.Items, item)
		out.TotalPrice += item.LineTotal
	}
	out.ItemCount = len(out.Items)
	return out
}

// categoryOf — bulunabilen ürünün kategorisini döner; ürün yoksa "".
func categoryOf(err error, prod *db.PublishedProduct) string {
	if err != nil || prod == nil || prod.Category == nil {
		return ""
	}
	return *prod.Category
}

// cheapestReplacement — adaylar arasından, stoğu olan ve kullanılmamış en ucuz
// ürünü seçer. category boş değilse önce o kategoriyle eşleşeni dener.
func cheapestReplacement(candidates map[string]db.PublishedProduct, category string, used map[string]bool) *db.PublishedProduct {
	var best *db.PublishedProduct
	pick := func(matchCategory bool) {
		for id, c := range candidates {
			if used[id] || c.StockQuantity <= 0 {
				continue
			}
			if matchCategory {
				if c.Category == nil || *c.Category != category || category == "" {
					continue
				}
			}
			cc := c
			if best == nil || cc.Price < best.Price {
				best = &cc
			}
		}
	}
	if category != "" {
		pick(true)
	}
	if best == nil {
		pick(false)
	}
	return best
}

// buildPackagePrompt — paketleme adımı için aday ürün listesini hazırlar.
func buildPackagePrompt(problem string, a solverAnalysis, candidates map[string]db.PublishedProduct) string {
	var b strings.Builder
	fmt.Fprintf(&b, "KULLANICININ SORUNU:\n%s\n\n", problem)
	fmt.Fprintf(&b, "ÇELİŞKİ ANALİZİ:\n- İyileşen: %s\n- Kısıt: %s\n- Özet: %s\n\n",
		a.Improving, a.Constraint, a.Summary)
	b.WriteString("ADAY ÜRÜNLER (yalnızca bu product_id'leri kullanabilirsin):\n")
	for _, c := range candidates {
		cat := ""
		if c.Category != nil {
			cat = *c.Category
		}
		desc := ""
		if c.Description != nil {
			desc = strings.TrimSpace(*c.Description)
		}
		if len([]rune(desc)) > 160 {
			desc = string([]rune(desc)[:160])
		}
		fmt.Fprintf(&b, "- [%s] %s | Kategori: %s | Fiyat: ₺%.2f | Stok: %d | %s\n",
			c.ID, c.Title, cat, float64(c.Price)/100, c.StockQuantity, desc)
	}
	return b.String()
}

// ─── POST /api/marketplace/ai-solver/solutions (auth) ─────────────────────────

func (h *AISolverHandler) SaveSolution(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())

	var req struct {
		ProblemText string          `json:"problem_text"`
		Analysis    json.RawMessage `json:"analysis"`
		Package     json.RawMessage `json:"package"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}
	if strings.TrimSpace(req.ProblemText) == "" || len(req.Analysis) == 0 || len(req.Package) == 0 {
		writeError(w, http.StatusBadRequest, "Eksik çözüm verisi")
		return
	}

	sol, err := h.store.CreateAISolution(r.Context(), userID, strings.TrimSpace(req.ProblemText), req.Analysis, req.Package)
	if err != nil {
		log.Printf("SaveSolution: %v", err)
		writeError(w, http.StatusInternalServerError, "Çözüm kaydedilemedi")
		return
	}
	writeJSON(w, http.StatusCreated, sol)
}

// ─── GET /api/marketplace/ai-solver/solutions (auth) ──────────────────────────

func (h *AISolverHandler) ListSolutions(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	sols, err := h.store.ListAISolutionsByUser(r.Context(), userID)
	if err != nil {
		log.Printf("ListSolutions: %v", err)
		writeError(w, http.StatusInternalServerError, "Çözümler yüklenemedi")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"solutions": sols})
}

// ─── GET /api/marketplace/ai-solver/solutions/{id} (auth) ─────────────────────

func (h *AISolverHandler) GetSolution(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	id := pathValue(r, "id")
	sol, err := h.store.GetAISolution(r.Context(), id, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Çözüm bulunamadı")
		return
	}
	writeJSON(w, http.StatusOK, sol)
}

// ─── Prompt'lar & Şemalar ─────────────────────────────────────────────────────

func solverAnalysisSystemPrompt() string {
	return `Sen TRIZ yöntemini kullanan bir problem analistisin. Türkçe konuşuyorsun.
Kullanıcı günlük bir sorununu anlatır; sen bunu bir "çelişki"ye dönüştürürsün.

Yanıtın JSON olmalı:
- improving: Kullanıcının iyileştirmek istediği şey (kısa, Türkçe). Örn: "Kitap düzeni ve depolama".
- constraint: İhlal edilemeyecek kısıt / kötüleşmesi istenmeyen şey. Örn: "Duvara kalıcı zarar verememe".
- summary: 1-2 cümle Türkçe özet — çelişkiyi sade dille açıkla.
- search_concepts: 5-8 adet SOMUT ürün/çözüm arama ifadesi (Türkçe, 2-4 kelime).
  Sadece bariz olanı değil, yaratıcı alternatifleri de yaz.
  Örn: ["gergi çubuğu raf", "yapışkanlı ağır hizmet askısı", "ayaksız modüler raf",
  "kapı arkası organizatör", "istiflenebilir kitap kutusu"].

Sadece JSON dön, başka açıklama yapma.`
}

func solverAnalysisSchema() map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"improving":  map[string]interface{}{"type": "string"},
			"constraint": map[string]interface{}{"type": "string"},
			"summary":    map[string]interface{}{"type": "string"},
			"search_concepts": map[string]interface{}{
				"type":  "array",
				"items": map[string]interface{}{"type": "string"},
			},
		},
		"required": []string{"improving", "constraint", "summary", "search_concepts"},
	}
}

func solverPackageSystemPrompt() string {
	return `Sen bir alışveriş çözüm danışmanısın. Türkçe konuşuyorsun.
Sana kullanıcının sorunu, çelişki analizi ve katalogdan gelen ADAY ÜRÜNLER verilir.
Görevin: tek bir ürün değil, sorunu birlikte çözen ÇOK ÜRÜNLÜ bir çözüm paketi kurmak.

KURALLAR:
- Yalnızca verilen aday ürünlerin product_id'lerini kullan. ID UYDURMA.
- Pakette 2-5 ürün olsun; sorunu gerçekten çözmeye yeter sayıda.
- Her ürün için:
  * role: Ürünün paketteki rolü (kısa). Örn: "Ana raf ünitesi", "Montaj desteği".
  * reason: Bu ürünün sorunu nasıl çözdüğü (1 cümle, kullanıcının kısıtına saygılı).
  * quantity: Gerçekçi adet (1-10).
- package_title: Pakete çekici bir isim ver. Örn: "Kiralık Ev Kitaplık Çözümü".
- intro: 1-2 cümle — paketin sorunu nasıl çözdüğünü özetle.
- Kullanıcının kısıtını (örn. duvar delememe) İHLAL EDEN ürün seçme.

Sadece JSON dön.`
}

func solverPackageSchema() map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"package_title": map[string]interface{}{"type": "string"},
			"intro":         map[string]interface{}{"type": "string"},
			"items": map[string]interface{}{
				"type": "array",
				"items": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"product_id": map[string]interface{}{"type": "string"},
						"role":       map[string]interface{}{"type": "string"},
						"reason":     map[string]interface{}{"type": "string"},
						"quantity":   map[string]interface{}{"type": "integer"},
					},
					"required": []string{"product_id", "role", "reason", "quantity"},
				},
			},
		},
		"required": []string{"package_title", "items"},
	}
}
