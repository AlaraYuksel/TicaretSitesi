// Satıcı (seller_profiles) yönetimi.
//
//   • Dashboard — özet (varsa store_name, satış sayısı, stripe durumu)
//   • Register — seller_profile oluştur (mağaza adı + slug)
//   • StripeConnect — Stripe Connect Express onboarding URL'i üret
//   • CreateShipment — EasyPost (TODO; mevcut stub)
package handler

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"go-backend-projem/internal/config"
	dbpkg "go-backend-projem/internal/db"
	"go-backend-projem/internal/payments"

	"github.com/jackc/pgx/v5"
)

// SellerHandler — Satıcı yönetimi (Stripe Connect, dashboard, kargo)
type SellerHandler struct {
	store  *dbpkg.Store
	stripe *payments.Client
	cfg    *config.Config
}

func NewSellerHandler(store *dbpkg.Store, stripeClient *payments.Client, cfg *config.Config) *SellerHandler {
	return &SellerHandler{store: store, stripe: stripeClient, cfg: cfg}
}

// ─── Request DTO'ları ───────────────────────────────────────────────────────

type CreateSellerRequest struct {
	StoreName   string `json:"store_name"`
	StoreSlug   string `json:"store_slug"`
	Description string `json:"description"`
}

type CreateShipmentRequest struct {
	OrderID string  `json:"order_id"`
	Address Address `json:"address"`
}

// ─── Handlers ───────────────────────────────────────────────────────────────

// Dashboard — GET /api/seller/dashboard
func (h *SellerHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Yetkisiz")
		return
	}

	sp, err := h.store.GetSellerProfileByUserID(r.Context(), userID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		log.Printf("Dashboard GetSellerProfile: %v", err)
		writeError(w, http.StatusInternalServerError, "Dashboard yüklenemedi")
		return
	}

	out := map[string]any{
		"has_profile":      false,
		"store_name":       "",
		"stripe_onboarded": false,
		"payout_enabled":   false,
	}
	if sp != nil {
		out["has_profile"] = true
		out["store_name"] = sp.StoreName
		out["stripe_onboarded"] = sp.StripeOnboarded
		out["payout_enabled"] = sp.PayoutEnabled
	}
	writeJSON(w, http.StatusOK, out)
}

// Register — POST /api/seller/register (yeni satıcı kaydı)
func (h *SellerHandler) Register(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Yetkisiz")
		return
	}

	var req CreateSellerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz istek")
		return
	}

	req.StoreName = strings.TrimSpace(req.StoreName)
	req.StoreSlug = strings.TrimSpace(req.StoreSlug)
	if req.StoreName == "" {
		writeError(w, http.StatusBadRequest, "Mağaza adı zorunlu")
		return
	}

	sp, err := h.store.EnsureSellerProfile(r.Context(), userID, req.StoreName, req.StoreSlug)
	if err != nil {
		log.Printf("EnsureSellerProfile: %v", err)
		writeError(w, http.StatusInternalServerError, "Satıcı oluşturulamadı")
		return
	}
	writeJSON(w, http.StatusCreated, sp)
}

// StripeConnect — POST /api/seller/connect
// Stripe Connect Express onboarding URL'i üretir ve döndürür.
// Aynı user için ikinci çağrıda mevcut acct_xxx için yeni AccountLink üretir.
func (h *SellerHandler) StripeConnect(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Yetkisiz")
		return
	}
	if !h.stripe.Configured() {
		writeError(w, http.StatusServiceUnavailable, "Stripe yapılandırılmamış")
		return
	}

	user, err := h.store.GetUserByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Kullanıcı yüklenemedi")
		return
	}

	// seller_profile yoksa minimal kayıt yarat (store_name = email prefix)
	storeName := strings.Split(user.Email, "@")[0]
	sp, err := h.store.EnsureSellerProfile(r.Context(), userID, storeName, "")
	if err != nil {
		log.Printf("EnsureSellerProfile (connect): %v", err)
		writeError(w, http.StatusInternalServerError, "Satıcı profili hazırlanamadı")
		return
	}

	// Connect Account yoksa oluştur
	if sp.StripeAccountID == nil || *sp.StripeAccountID == "" {
		acctID, err := h.stripe.CreateExpressAccount(r.Context(), user.Email, "TR")
		if err != nil {
			log.Printf("CreateExpressAccount: %v", err)
			writeError(w, http.StatusBadGateway, "Stripe hesabı oluşturulamadı")
			return
		}
		if err := h.store.SetSellerStripeAccount(r.Context(), sp.ID, acctID); err != nil {
			log.Printf("SetSellerStripeAccount: %v", err)
			writeError(w, http.StatusInternalServerError, "Stripe hesabı kaydedilemedi")
			return
		}
		sp.StripeAccountID = &acctID
	}

	returnURL := h.cfg.FrontendBaseURL + "/dashboard/balance?stripe=return"
	refreshURL := h.cfg.FrontendBaseURL + "/dashboard/balance?stripe=refresh"
	linkURL, err := h.stripe.CreateAccountLink(r.Context(), *sp.StripeAccountID, returnURL, refreshURL)
	if err != nil {
		log.Printf("CreateAccountLink: %v", err)
		writeError(w, http.StatusBadGateway, "Onboarding linki oluşturulamadı")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"redirect_url":      linkURL,
		"stripe_account_id": *sp.StripeAccountID,
	})
}

// CreateShipment — POST /api/seller/shipments
// EasyPost üzerinden kargo etiketi oluşturur (TODO — mevcut stub korunur).
func (h *SellerHandler) CreateShipment(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Yetkisiz")
		return
	}

	var req CreateShipmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz istek")
		return
	}

	log.Printf("Kargo oluşturuluyor: user=%s order=%s", userID, req.OrderID)

	// TODO: EasyPost API ile kargo etiketi oluştur
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message":         "Kargo etiketi oluşturuldu",
		"tracking_number": "PLACEHOLDER",
	})
}
