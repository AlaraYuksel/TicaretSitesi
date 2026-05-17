package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-playground/validator/v10"
	"go-backend-projem/internal/ai"
	"go-backend-projem/internal/db"
	"go-backend-projem/internal/middleware"
)

// SiteHandler site CRUD işlemlerini yönetir.
type SiteHandler struct {
	store    *db.Store
	validate *validator.Validate
	gemini   *ai.GeminiClient // nil olabilir — varsa publish'te ürün embedding'i üretilir
}

func NewSiteHandler(store *db.Store, gemini *ai.GeminiClient) *SiteHandler {
	return &SiteHandler{
		store:    store,
		validate: validator.New(),
		gemini:   gemini,
	}
}

// ─── GET /api/sites ───────────────────────────────────────────────────────────

// List kullanıcının tüm sitelerini döner.
func (h *SiteHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())

	sites, err := h.store.GetSitesByUserID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Siteler alınamadı")
		return
	}
	if sites == nil {
		sites = []db.Site{}
	}
	writeJSON(w, http.StatusOK, sites)
}

// ─── POST /api/sites ──────────────────────────────────────────────────────────

type createSiteRequest struct {
	Title     string  `json:"title"     validate:"required,min=1,max=255"`
	Subdomain *string `json:"subdomain" validate:"omitempty,min=1,max=63,alphanum"`
}

func (h *SiteHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createSiteRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}
	if err := h.validate.Struct(req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	userID := middleware.UserIDFromCtx(r.Context())

	site, err := h.store.CreateSite(r.Context(), db.CreateSiteParams{
		UserID:    userID,
		Title:     req.Title,
		Subdomain: req.Subdomain,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Site oluşturulamadı")
		return
	}
	writeJSON(w, http.StatusCreated, site)
}

// ─── GET /api/sites/{id} ──────────────────────────────────────────────────────

func (h *SiteHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := pathValue(r, "id")
	userID := middleware.UserIDFromCtx(r.Context())

	site, err := h.store.GetSiteByID(r.Context(), id, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Site bulunamadı")
		return
	}
	writeJSON(w, http.StatusOK, site)
}

// ─── PUT /api/sites/{id}/data ─────────────────────────────────────────────────
// Editör içeriğini kaydeder — frontend'in JSON export formatını doğrudan alır.

type saveSiteDataRequest struct {
	SiteData json.RawMessage `json:"site_data" validate:"required"`
}

func (h *SiteHandler) SaveData(w http.ResponseWriter, r *http.Request) {
	id := pathValue(r, "id")
	userID := middleware.UserIDFromCtx(r.Context())

	var req saveSiteDataRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}

	site, err := h.store.UpdateSiteData(r.Context(), db.UpdateSiteDataParams{
		ID:       id,
		UserID:   userID,
		SiteData: req.SiteData,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Site verisi kaydedilemedi")
		return
	}
	writeJSON(w, http.StatusOK, site)
}

// ─── POST /api/sites/{id}/publish ────────────────────────────────────────────

func (h *SiteHandler) Publish(w http.ResponseWriter, r *http.Request) {
	id := pathValue(r, "id")
	userID := middleware.UserIDFromCtx(r.Context())

	site, err := h.store.PublishSite(r.Context(), id, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Site yayınlanamadı")
		return
	}

	// Marketplace sync — site_data'dan ürünleri çıkar ve published_products'a yansıt.
	// Burada bir hata olursa siteyi unpublish etmiyoruz; sadece log düşüyoruz.
	storeName := site.Title
	count, syncErr := SyncPublishedProductsForSite(
		r.Context(), h.store, h.gemini, site.ID, site.UserID, site.SiteData, storeName,
	)
	if syncErr != nil {
		log.Printf("Marketplace sync hatası (site=%s): %v", site.ID, syncErr)
	} else {
		log.Printf("Marketplace sync: site=%s ürün=%d", site.ID, count)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"site":            site,
		"products_synced": count,
	})
}

// ─── POST /api/sites/{id}/unpublish ──────────────────────────────────────────

func (h *SiteHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	id := pathValue(r, "id")
	userID := middleware.UserIDFromCtx(r.Context())

	site, err := h.store.UnpublishSite(r.Context(), id, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Site yayından kaldırılamadı")
		return
	}
	writeJSON(w, http.StatusOK, site)
}

// ─── DELETE /api/sites/{id} ───────────────────────────────────────────────────

func (h *SiteHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := pathValue(r, "id")
	userID := middleware.UserIDFromCtx(r.Context())

	if err := h.store.DeleteSite(r.Context(), id, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "Site silinemedi")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
