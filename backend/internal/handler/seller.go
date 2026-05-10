package handler

import (
	"encoding/json"
	"log"
	"net/http"

	dbpkg "go-backend-projem/internal/db"
)

// SellerHandler — Satıcı yönetimi (Stripe Connect, dashboard, kargo)
type SellerHandler struct {
	store *dbpkg.Store
}

func NewSellerHandler(store *dbpkg.Store) *SellerHandler {
	return &SellerHandler{store: store}
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
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Yetkisiz"})
		return
	}

	log.Printf("Satıcı dashboard: user=%s", userID)

	// TODO: sqlc GetSellerByUserID + satış istatistikleri
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"store_name":    "",
		"total_sales":   0,
		"total_revenue": 0,
		"pending_orders": 0,
		"stripe_onboarded": false,
	})
}

// Register — POST /api/seller/register (yeni satıcı kaydı)
func (h *SellerHandler) Register(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Yetkisiz"})
		return
	}

	var req CreateSellerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek"})
		return
	}

	if req.StoreName == "" || req.StoreSlug == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Mağaza adı ve slug zorunlu"})
		return
	}

	log.Printf("Satıcı kaydı: user=%s store=%s", userID, req.StoreName)

	// TODO: sqlc CreateSeller + slug benzersizlik kontrolü

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Satıcı hesabı oluşturuldu",
	})
}

// StripeConnect — POST /api/seller/connect
// Stripe Connect onboarding başlatır → OAuth URL döner
func (h *SellerHandler) StripeConnect(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Yetkisiz"})
		return
	}

	log.Printf("Stripe Connect onboarding: user=%s", userID)

	// TODO: Stripe Connect Account oluştur
	// 1. stripe.AccountCreate() → acct_xxx
	// 2. stripe.AccountLinkCreate() → onboarding URL
	// 3. sqlc UpdateSellerStripeAccount()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":      "Stripe Connect onboarding URL oluşturuldu",
		"redirect_url": "https://connect.stripe.com/setup/...",
	})
}

// CreateShipment — POST /api/seller/shipments
// EasyPost üzerinden kargo etiketi oluşturur
func (h *SellerHandler) CreateShipment(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Yetkisiz"})
		return
	}

	var req CreateShipmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek"})
		return
	}

	log.Printf("Kargo oluşturuluyor: user=%s order=%s", userID, req.OrderID)

	// TODO: EasyPost API ile kargo etiketi oluştur
	// 1. EasyPost.Shipment.Create() → shipment_id
	// 2. EasyPost.Shipment.Buy() → tracking_number
	// 3. sqlc UpdateOrderShipping()
	// 4. SQS Notifications → alıcıya bildirim

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message":         "Kargo etiketi oluşturuldu",
		"tracking_number": "PLACEHOLDER",
	})
}
