// Satıcının marketplace üzerinden gelen siparişlerini yönettiği endpoint'ler.
//
//   GET    /api/seller/marketplace-orders
//   GET    /api/seller/marketplace-orders/{id}
//   POST   /api/seller/marketplace-orders/{id}/approve
//   POST   /api/seller/marketplace-orders/{id}/reject
//   POST   /api/seller/marketplace-orders/{id}/ship
//   POST   /api/seller/marketplace-orders/{id}/mark-delivered
//   POST   /api/seller/marketplace-orders/{id}/release-escrow
//   GET    /api/seller/balance
//
// Ownership: tüm seller endpoint'leri marketplace_orders.site_id IN (sites WHERE user_id = me)
// kontrolünü DB seviyesinde uygular.
package handler

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"go-backend-projem/internal/config"
	"go-backend-projem/internal/db"
	"go-backend-projem/internal/middleware"
	"go-backend-projem/internal/payments"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type SellerOrdersHandler struct {
	store  *db.Store
	stripe *payments.Client
	cfg    *config.Config
}

func NewSellerOrdersHandler(store *db.Store, stripe *payments.Client, cfg *config.Config) *SellerOrdersHandler {
	return &SellerOrdersHandler{store: store, stripe: stripe, cfg: cfg}
}

// ─── GET /api/seller/marketplace-orders ─────────────────────────────────

func (h *SellerOrdersHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	status := r.URL.Query().Get("status")

	// Lazy-sync: webhook'a güvenmeden, Stripe'ta succeeded olmuş ama DB'de hâlâ
	// 'pending' kalmış siparişleri eşitle. Hatalar UI'yi bloklamamalı, log + devam.
	h.syncPendingPayments(r.Context(), userID)

	if r.URL.Query().Get("count_only") == "1" {
		n, err := h.store.CountMarketplaceOrdersPendingApprovalForSeller(r.Context(), userID)
		if err != nil {
			log.Printf("Count pending orders: %v", err)
			writeError(w, http.StatusInternalServerError, "Sayım başarısız")
			return
		}
		writeJSON(w, http.StatusOK, map[string]int{"count": n})
		return
	}

	orders, err := h.store.ListMarketplaceOrdersForSeller(r.Context(), userID, status)
	if err != nil {
		log.Printf("ListMarketplaceOrdersForSeller: %v", err)
		writeError(w, http.StatusInternalServerError, "Siparişler yüklenemedi")
		return
	}
	writeJSON(w, http.StatusOK, orders)
}

// ─── GET /api/seller/marketplace-orders/{id} ────────────────────────────

func (h *SellerOrdersHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	id := pathValue(r, "id")
	if _, err := uuid.Parse(id); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz sipariş ID")
		return
	}
	order, err := h.store.GetMarketplaceOrderForSeller(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Sipariş bulunamadı")
			return
		}
		log.Printf("GetMarketplaceOrderForSeller: %v", err)
		writeError(w, http.StatusInternalServerError, "Sipariş yüklenemedi")
		return
	}
	writeJSON(w, http.StatusOK, order)
}

// ─── POST /api/seller/marketplace-orders/{id}/approve ────────────────────

func (h *SellerOrdersHandler) Approve(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	id := pathValue(r, "id")
	order, err := h.requireOwnedOrder(r, userID, id)
	if err != nil {
		h.respondLookupErr(w, err)
		return
	}
	if order.ApprovalStatus != "pending_approval" {
		writeError(w, http.StatusConflict, "Sipariş zaten işlenmiş")
		return
	}
	if order.PaymentStatus != "paid" {
		writeError(w, http.StatusBadRequest, "Ödeme henüz tamamlanmadı")
		return
	}
	if err := h.store.UpdateMarketplaceOrderApproval(r.Context(), id, "approved", "confirmed", "", ""); err != nil {
		log.Printf("Approve: %v", err)
		writeError(w, http.StatusInternalServerError, "Onay başarısız")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── POST /api/seller/marketplace-orders/{id}/reject ─────────────────────

type rejectRequest struct {
	Reason string `json:"reason"`
}

func (h *SellerOrdersHandler) Reject(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	id := pathValue(r, "id")
	order, err := h.requireOwnedOrder(r, userID, id)
	if err != nil {
		h.respondLookupErr(w, err)
		return
	}
	if order.ApprovalStatus != "pending_approval" {
		writeError(w, http.StatusConflict, "Sipariş zaten işlenmiş")
		return
	}
	var req rejectRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		reason = "Sipariş satıcı tarafından reddedildi"
	}

	// Stripe ile ödenmişse refund tetikle
	if order.StripePaymentIntentID != nil && *order.StripePaymentIntentID != "" && h.stripe.Configured() {
		if _, err := h.stripe.CreateRefund(r.Context(), *order.StripePaymentIntentID, 0); err != nil {
			log.Printf("Refund: %v", err)
			writeError(w, http.StatusBadGateway, "İade başlatılamadı")
			return
		}
	}

	if err := h.store.UpdateMarketplaceOrderApproval(r.Context(), id, "rejected", "cancelled", "refunded", reason); err != nil {
		log.Printf("Reject: %v", err)
		writeError(w, http.StatusInternalServerError, "Red işlenemedi")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── POST /api/seller/marketplace-orders/{id}/cancel ─────────────────────
//
// Sipariş kargoya verilmeden önce satıcının iptal etme yolu.
// Onaylanmış (approved) veya henüz onaylanmamış (pending_approval) siparişleri kapsar.
// Ödeme yapılmışsa Stripe refund tetiklenir.

func (h *SellerOrdersHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	id := pathValue(r, "id")
	order, err := h.requireOwnedOrder(r, userID, id)
	if err != nil {
		h.respondLookupErr(w, err)
		return
	}
	if order.Status == "shipped" || order.Status == "delivered" {
		writeError(w, http.StatusConflict, "Kargoya verilmiş sipariş iptal edilemez")
		return
	}
	if order.Status == "cancelled" {
		writeError(w, http.StatusConflict, "Sipariş zaten iptal edilmiş")
		return
	}

	var req rejectRequest
	_ = decodeJSON(r, &req)
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		reason = "Sipariş satıcı tarafından iptal edildi"
	}

	if order.PaymentStatus == "paid" && order.StripePaymentIntentID != nil && *order.StripePaymentIntentID != "" && h.stripe.Configured() {
		if _, err := h.stripe.CreateRefund(r.Context(), *order.StripePaymentIntentID, 0); err != nil {
			log.Printf("Seller Cancel refund: %v", err)
			writeError(w, http.StatusBadGateway, "İade başlatılamadı")
			return
		}
	}

	if err := h.store.CancelMarketplaceOrder(r.Context(), id, reason); err != nil {
		log.Printf("Seller Cancel: %v", err)
		writeError(w, http.StatusInternalServerError, "İptal başarısız")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── POST /api/seller/marketplace-orders/{id}/ship ───────────────────────

type shipRequest struct {
	TrackingNumber string `json:"tracking_number"`
	Carrier        string `json:"carrier"`
	TrackingURL    string `json:"tracking_url"`
}

func (h *SellerOrdersHandler) Ship(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	id := pathValue(r, "id")
	order, err := h.requireOwnedOrder(r, userID, id)
	if err != nil {
		h.respondLookupErr(w, err)
		return
	}
	if order.ApprovalStatus != "approved" || order.Status != "confirmed" {
		writeError(w, http.StatusConflict, "Sipariş kargoya verilmek için onaylanmamış")
		return
	}
	var req shipRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}
	if strings.TrimSpace(req.TrackingNumber) == "" {
		writeError(w, http.StatusBadRequest, "Kargo takip numarası zorunlu")
		return
	}
	if err := h.store.UpdateMarketplaceOrderShipping(r.Context(), id,
		strings.TrimSpace(req.TrackingNumber),
		strings.TrimSpace(req.TrackingURL),
		strings.TrimSpace(req.Carrier),
	); err != nil {
		log.Printf("Ship: %v", err)
		writeError(w, http.StatusInternalServerError, "Kargo durumu güncellenemedi")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── POST /api/seller/marketplace-orders/{id}/mark-delivered ─────────────

func (h *SellerOrdersHandler) MarkDelivered(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	id := pathValue(r, "id")
	order, err := h.requireOwnedOrder(r, userID, id)
	if err != nil {
		h.respondLookupErr(w, err)
		return
	}
	if order.Status != "shipped" {
		writeError(w, http.StatusConflict, "Sipariş kargoya verilmemiş")
		return
	}
	if err := h.store.MarkMarketplaceOrderDelivered(r.Context(), id); err != nil {
		log.Printf("MarkDelivered: %v", err)
		writeError(w, http.StatusInternalServerError, "Teslim onayı başarısız")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── POST /api/seller/marketplace-orders/{id}/release-escrow ─────────────

func (h *SellerOrdersHandler) ReleaseEscrow(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	id := pathValue(r, "id")
	order, err := h.requireOwnedOrder(r, userID, id)
	if err != nil {
		h.respondLookupErr(w, err)
		return
	}
	if order.Status != "delivered" {
		writeError(w, http.StatusConflict, "Sipariş henüz teslim edilmedi")
		return
	}
	if order.EscrowStatus != "held" {
		writeError(w, http.StatusConflict, "Escrow zaten release edilmiş")
		return
	}
	if order.DeliveredAt == nil {
		writeError(w, http.StatusConflict, "Teslim tarihi yok")
		return
	}
	// Bekleme süresi kontrolü
	if h.cfg.EscrowReleaseDays > 0 {
		earliest := order.DeliveredAt.Add(time.Duration(h.cfg.EscrowReleaseDays) * 24 * time.Hour)
		if time.Now().Before(earliest) {
			writeError(w, http.StatusForbidden, "Escrow release süresi henüz dolmadı")
			return
		}
	}

	transferID := ""
	// Eğer destination charge yapılmadıysa (no connected acct), Stripe Transfer ile
	// connected account'a aktar. Connected acct yoksa platform tarafında kalır.
	if h.stripe.Configured() && order.SiteID != nil {
		acct, onboarded, _ := h.store.GetSellerStripeAccountForSite(r.Context(), *order.SiteID)
		// destination charge zaten yapıldıysa stripe_transfer otomatik üretilmiştir,
		// ama burada açık bir Transfer manuel akışta gerekir.
		if onboarded && acct != "" && (order.StripePaymentIntentID == nil || *order.StripePaymentIntentID == "") {
			payout := order.TotalAmount - h.stripe.PlatformFeeFor(order.TotalAmount)
			tid, err := h.stripe.CreateTransfer(r.Context(), payout, "try", acct, "")
			if err != nil {
				log.Printf("CreateTransfer: %v", err)
				writeError(w, http.StatusBadGateway, "Transfer başarısız")
				return
			}
			transferID = tid
		}
	}

	if err := h.store.MarkMarketplaceOrderEscrowReleased(r.Context(), id, transferID); err != nil {
		log.Printf("MarkMarketplaceOrderEscrowReleased: %v", err)
		writeError(w, http.StatusInternalServerError, "Escrow release başarısız")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"transfer_id":    transferID,
		"escrow_status":  "released",
	})
}

// ─── GET /api/seller/balance ─────────────────────────────────────────────

func (h *SellerOrdersHandler) Balance(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	balance, err := h.store.GetSellerBalance(r.Context(), userID, h.cfg.PlatformFeePercent)
	if err != nil {
		log.Printf("GetSellerBalance: %v", err)
		writeError(w, http.StatusInternalServerError, "Bakiye yüklenemedi")
		return
	}
	writeJSON(w, http.StatusOK, balance)
}

// syncPendingPayments — pending kayıtların Stripe PI durumunu kontrol eder ve
// succeeded olanları paid yapar. Webhook'a güvenilemeyen ortamlar için self-healing.
func (h *SellerOrdersHandler) syncPendingPayments(ctx context.Context, sellerUserID string) {
	if !h.stripe.Configured() {
		return
	}
	piIDs, err := h.store.ListUnsyncedPaymentIntentsForSeller(ctx, sellerUserID)
	if err != nil {
		log.Printf("syncPendingPayments list: %v", err)
		return
	}
	for _, pi := range piIDs {
		result, err := h.stripe.RetrievePaymentIntent(ctx, pi)
		if err != nil {
			log.Printf("syncPendingPayments retrieve %s: %v", pi, err)
			continue
		}
		if result.Status != "succeeded" {
			continue
		}
		if err := h.store.MarkMarketplaceOrderPaid(ctx, pi); err != nil {
			log.Printf("syncPendingPayments mark paid %s: %v", pi, err)
		}
	}
}

// ─── Yardımcı ─────────────────────────────────────────────────────────────

// requireOwnedOrder — ownership doğrulamalı detay getirir.
func (h *SellerOrdersHandler) requireOwnedOrder(r *http.Request, userID, id string) (*db.MarketplaceOrder, error) {
	if _, err := uuid.Parse(id); err != nil {
		return nil, errInvalidOrderID
	}
	return h.store.GetMarketplaceOrderForSeller(r.Context(), id, userID)
}

var errInvalidOrderID = errors.New("invalid order id")

func (h *SellerOrdersHandler) respondLookupErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errInvalidOrderID):
		writeError(w, http.StatusBadRequest, "Geçersiz sipariş ID")
	case errors.Is(err, pgx.ErrNoRows):
		writeError(w, http.StatusNotFound, "Sipariş bulunamadı")
	default:
		log.Printf("seller order lookup: %v", err)
		writeError(w, http.StatusInternalServerError, "Sipariş yüklenemedi")
	}
}
