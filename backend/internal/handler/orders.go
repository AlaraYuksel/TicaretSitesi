package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	dbpkg "go-backend-projem/internal/db"

	"github.com/google/uuid"
)

// OrderHandler — Sipariş yönetimi (Stripe PaymentIntent, sepet, escrow)
type OrderHandler struct {
	store *dbpkg.Store
}

func NewOrderHandler(store *dbpkg.Store) *OrderHandler {
	return &OrderHandler{store: store}
}

// ─── Request / Response DTO'ları ────────────────────────────────────────────

type CreateOrderRequest struct {
	SellerID string      `json:"seller_id"`
	Items    []OrderItem `json:"items"`
	Address  Address     `json:"shipping_address"`
}

type OrderItem struct {
	ProductID   string          `json:"product_id"`
	Quantity    int             `json:"quantity"`
	VariantInfo json.RawMessage `json:"variant_info,omitempty"`
}

type Address struct {
	Name    string `json:"name"`
	Line1   string `json:"line1"`
	Line2   string `json:"line2,omitempty"`
	City    string `json:"city"`
	State   string `json:"state"`
	ZipCode string `json:"zip"`
	Country string `json:"country"`
	Phone   string `json:"phone"`
}

type OrderResponse struct {
	ID            string          `json:"id"`
	OrderNumber   string          `json:"order_number"`
	BuyerID       string          `json:"buyer_id"`
	SellerID      string          `json:"seller_id"`
	SellerName    string          `json:"seller_name,omitempty"`
	Subtotal      int64           `json:"subtotal"`
	ShippingCost  int64           `json:"shipping_cost"`
	TaxAmount     int64           `json:"tax_amount"`
	TotalAmount   int64           `json:"total_amount"`
	PaymentStatus string          `json:"payment_status"`
	EscrowStatus  string          `json:"escrow_status"`
	Status        string          `json:"status"`
	Address       json.RawMessage `json:"shipping_address,omitempty"`
	TrackingNum   string          `json:"tracking_number,omitempty"`
	TrackingURL   string          `json:"tracking_url,omitempty"`
	Carrier       string          `json:"carrier,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
}

// ─── Handlers ───────────────────────────────────────────────────────────────

// List — GET /api/orders
// Alıcı: kendi siparişleri / Satıcı: mağazasına gelen siparişler
func (h *OrderHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Yetkisiz"})
		return
	}

	q := r.URL.Query()
	role := q.Get("role") // "buyer" veya "seller"
	page, _ := strconv.Atoi(q.Get("page"))
	limit, _ := strconv.Atoi(q.Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}

	log.Printf("Siparişler listeleniyor: user=%s role=%s page=%d", userID, role, page)

	// TODO: sqlc ListOrdersByBuyer veya ListOrdersBySeller
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"orders": []interface{}{},
		"page":   page,
		"limit":  limit,
		"total":  0,
	})
}

// Get — GET /api/orders/{id}
func (h *OrderHandler) Get(w http.ResponseWriter, r *http.Request) {
	_, ok := getUserIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Yetkisiz"})
		return
	}

	idStr := r.PathValue("id")
	if _, err := uuid.Parse(idStr); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz sipariş ID"})
		return
	}

	// TODO: sqlc GetOrder + yetki kontrolü (buyer veya seller)
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "Sipariş bulunamadı"})
}

// Create — POST /api/orders (auth gerekli — alıcı)
func (h *OrderHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Yetkisiz"})
		return
	}

	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek"})
		return
	}

	if len(req.Items) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Sepet boş"})
		return
	}

	// Sipariş numarası üret: ORD-20260510-XXXX
	orderNumber := generateOrderNumber()

	log.Printf("Sipariş oluşturuluyor: user=%s order=%s items=%d",
		userID, orderNumber, len(req.Items))

	// TODO: Adımlar:
	// 1. Ürünleri DB'den çek, fiyatları doğrula
	// 2. Stok kontrolü (DecrementStock)
	// 3. Stripe PaymentIntent oluştur (escrow modunda)
	// 4. Siparişi DB'ye kaydet (CreateOrder + CreateOrderItem)
	// 5. SQS Notifications'a bildirim at (satıcıya yeni sipariş)
	// 6. EventBridge'e OrderPlaced eventi gönder (öneri sistemi)

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message":      "Sipariş oluşturuldu",
		"order_number": orderNumber,
		// "client_secret": stripePI.ClientSecret, // Frontend Stripe.js için
	})
}

// generateOrderNumber — Benzersiz sipariş numarası
func generateOrderNumber() string {
	now := time.Now()
	suffix := uuid.New().String()[:4]
	return now.Format("ORD-20060102-") + suffix
}
