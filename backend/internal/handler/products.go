package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	dbpkg "go-backend-projem/internal/db"

	"github.com/google/uuid"
)

// ProductHandler — Ürün CRUD + Arama işlemleri
type ProductHandler struct {
	store *dbpkg.Store
}

func NewProductHandler(store *dbpkg.Store) *ProductHandler {
	return &ProductHandler{store: store}
}

// ─── Request / Response DTO'ları ────────────────────────────────────────────

type CreateProductRequest struct {
	Title         string          `json:"title"`
	Description   string          `json:"description"`
	ShortDesc     string          `json:"short_desc"`
	Price         int64           `json:"price"`          // kuruş cinsinden
	ComparePrice  *int64          `json:"compare_price"`
	Currency      string          `json:"currency"`
	SKU           string          `json:"sku"`
	StockQuantity int             `json:"stock_quantity"`
	WeightGrams   *int            `json:"weight_grams"`
	CategoryID    *string         `json:"category_id"`
	Images        json.RawMessage `json:"images"`
	ThumbnailURL  string          `json:"thumbnail_url"`
	Variants      json.RawMessage `json:"variants"`
	Tags          []string        `json:"tags"`
	Status        string          `json:"status"` // draft | active
}

type UpdateProductRequest struct {
	Title         string          `json:"title"`
	Description   string          `json:"description"`
	ShortDesc     string          `json:"short_desc"`
	Price         int64           `json:"price"`
	ComparePrice  *int64          `json:"compare_price"`
	StockQuantity int             `json:"stock_quantity"`
	Images        json.RawMessage `json:"images"`
	ThumbnailURL  string          `json:"thumbnail_url"`
	Variants      json.RawMessage `json:"variants"`
	Tags          []string        `json:"tags"`
	Status        string          `json:"status"`
}

type ProductResponse struct {
	ID            string          `json:"id"`
	SellerID      string          `json:"seller_id"`
	SellerName    string          `json:"seller_name,omitempty"`
	CategoryID    *string         `json:"category_id,omitempty"`
	Title         string          `json:"title"`
	Slug          string          `json:"slug"`
	Description   string          `json:"description"`
	ShortDesc     string          `json:"short_desc"`
	Price         int64           `json:"price"`
	ComparePrice  *int64          `json:"compare_price,omitempty"`
	Currency      string          `json:"currency"`
	SKU           string          `json:"sku"`
	StockQuantity int             `json:"stock_quantity"`
	Images        json.RawMessage `json:"images"`
	ThumbnailURL  string          `json:"thumbnail_url"`
	Variants      json.RawMessage `json:"variants"`
	Tags          []string        `json:"tags"`
	Status        string          `json:"status"`
	IsFeatured    bool            `json:"is_featured"`
	ViewCount     int64           `json:"view_count"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

// ─── Handlers ───────────────────────────────────────────────────────────────

// List — GET /api/products
// Query params: ?seller_id=, ?category_id=, ?q= (arama), ?page=, ?limit=
func (h *ProductHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	limit, _ := strconv.Atoi(q.Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	// Arama
	searchQuery := q.Get("q")
	_ = searchQuery
	_ = offset

	// TODO: sqlc generated fonksiyonlar ile veritabanı sorgusu
	// Şimdilik placeholder yanıt
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"products": []interface{}{},
		"page":     page,
		"limit":    limit,
		"total":    0,
	})
}

// Get — GET /api/products/{id}
func (h *ProductHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	if _, err := uuid.Parse(idStr); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz ürün ID"})
		return
	}

	// TODO: sqlc GetProduct + IncrementViewCount
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "Ürün bulunamadı"})
}

// Create — POST /api/products (auth gerekli — satıcı)
func (h *ProductHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Yetkisiz"})
		return
	}

	var req CreateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek"})
		return
	}

	// Validasyon
	if strings.TrimSpace(req.Title) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Ürün başlığı zorunlu"})
		return
	}
	if req.Price < 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Fiyat negatif olamaz"})
		return
	}

	// Slug oluştur
	slug := generateSlug(req.Title)

	log.Printf("Ürün oluşturuluyor: user=%s title=%s slug=%s price=%d", userID, req.Title, slug, req.Price)

	// TODO: sqlc CreateProduct + seller_profiles kontrolü
	// TODO: Eğer pgvector aktifse → Claude Embeddings API → embedding kaydet

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Ürün oluşturuldu",
		"slug":    slug,
	})
}

// Update — PUT /api/products/{id} (auth gerekli — ürün sahibi)
func (h *ProductHandler) Update(w http.ResponseWriter, r *http.Request) {
	_, ok := getUserIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Yetkisiz"})
		return
	}

	idStr := r.PathValue("id")
	if _, err := uuid.Parse(idStr); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz ürün ID"})
		return
	}

	var req UpdateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek"})
		return
	}

	// TODO: sqlc UpdateProduct + yetki kontrolü (ürün sahibi mi?)

	writeJSON(w, http.StatusOK, map[string]string{"message": "Ürün güncellendi"})
}

// Delete — DELETE /api/products/{id} (soft delete → status='archived')
func (h *ProductHandler) Delete(w http.ResponseWriter, r *http.Request) {
	_, ok := getUserIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Yetkisiz"})
		return
	}

	idStr := r.PathValue("id")
	if _, err := uuid.Parse(idStr); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz ürün ID"})
		return
	}

	// TODO: sqlc DeleteProduct (soft) + yetki kontrolü

	writeJSON(w, http.StatusOK, map[string]string{"message": "Ürün arşivlendi"})
}

// ─── Yardımcı Fonksiyonlar ──────────────────────────────────────────────────

// generateSlug — Türkçe karakterleri de destekleyen basit slug üretimi
func generateSlug(title string) string {
	slug := strings.ToLower(strings.TrimSpace(title))

	replacer := strings.NewReplacer(
		"ş", "s", "ç", "c", "ğ", "g", "ü", "u", "ö", "o", "ı", "i",
		"Ş", "s", "Ç", "c", "Ğ", "g", "Ü", "u", "Ö", "o", "İ", "i",
	)
	slug = replacer.Replace(slug)

	// Alfanumerik olmayan karakterleri tire ile değiştir
	var result strings.Builder
	prevDash := false
	for _, c := range slug {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') {
			result.WriteRune(c)
			prevDash = false
		} else if !prevDash {
			result.WriteRune('-')
			prevDash = true
		}
	}

	s := strings.Trim(result.String(), "-")
	// Benzersizlik için kısa UUID suffix ekle
	suffix := uuid.New().String()[:8]
	return fmt.Sprintf("%s-%s", s, suffix)
}

// getUserIDFromContext — JWT middleware'den context'e konmuş user ID'yi alır
func getUserIDFromContext(r *http.Request) (string, bool) {
	uid := r.Context().Value("user_id")
	if uid == nil {
		return "", false
	}
	s, ok := uid.(string)
	return s, ok
}
