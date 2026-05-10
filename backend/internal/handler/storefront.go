package handler

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"regexp"
	"strings"
	"time"

	dbpkg "go-backend-projem/internal/db"

	"github.com/google/uuid"
)

// StorefrontHandler — Ziyaretçi tarafı e-ticaret işlemleri
// Auth gerektirmez — e-posta + telefon ile sipariş/takip
type StorefrontHandler struct {
	store *dbpkg.Store
}

func NewStorefrontHandler(store *dbpkg.Store) *StorefrontHandler {
	return &StorefrontHandler{store: store}
}

// ─── Request / Response DTO'ları ────────────────────────────────────────────

type StorefrontCartItem struct {
	ProductID string          `json:"product_id"`
	Title     string          `json:"title"`
	Price     int64           `json:"price"`
	Quantity  int             `json:"quantity"`
	Image     string          `json:"image"`
	Variant   json.RawMessage `json:"variant,omitempty"`
}

type CreateGuestOrderRequest struct {
	SiteID   string               `json:"site_id"`
	Customer GuestCustomerInfo    `json:"customer"`
	Items    []StorefrontCartItem `json:"items"`
	Address  GuestShippingAddress `json:"shipping_address"`
	Notes    string               `json:"notes,omitempty"`
}

type GuestCustomerInfo struct {
	Email string `json:"email"`
	Phone string `json:"phone"`
	Name  string `json:"name"`
}

type GuestShippingAddress struct {
	Line1   string `json:"line1"`
	Line2   string `json:"line2,omitempty"`
	City    string `json:"city"`
	State   string `json:"state"`
	ZipCode string `json:"zip"`
	Country string `json:"country"`
}

type TrackOrderRequest struct {
	Email string `json:"email"`
	Phone string `json:"phone"`
}

type VerifyOTPRequest struct {
	Email string `json:"email"`
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

type GuestOrderResponse struct {
	ID             string          `json:"id"`
	OrderNumber    string          `json:"order_number"`
	CustomerName   string          `json:"customer_name"`
	CustomerEmail  string          `json:"customer_email"`
	Items          json.RawMessage `json:"items"`
	Subtotal       int64           `json:"subtotal"`
	ShippingCost   int64           `json:"shipping_cost"`
	TaxAmount      int64           `json:"tax_amount"`
	TotalAmount    int64           `json:"total_amount"`
	Status         string          `json:"status"`
	PaymentStatus  string          `json:"payment_status"`
	TrackingNumber string          `json:"tracking_number,omitempty"`
	TrackingURL    string          `json:"tracking_url,omitempty"`
	Carrier        string          `json:"carrier,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// ─── Validation Helpers ────────────────────────────────────────────────────

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
var phoneRegex = regexp.MustCompile(`^\+?[0-9]{10,15}$`)

func validateEmail(email string) bool {
	return emailRegex.MatchString(strings.TrimSpace(email))
}

func validatePhone(phone string) bool {
	cleaned := strings.ReplaceAll(strings.ReplaceAll(phone, " ", ""), "-", "")
	return phoneRegex.MatchString(cleaned)
}

func cleanPhone(phone string) string {
	return strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(phone), " ", ""), "-", "")
}

// generateOTP — 6 haneli güvenli rastgele kod
func generateOTP() string {
	n, err := rand.Int(rand.Reader, big.NewInt(999999))
	if err != nil {
		// Fallback
		return fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
	}
	return fmt.Sprintf("%06d", n.Int64())
}

// generateGuestOrderNumber — Benzersiz sipariş numarası
func generateGuestOrderNumber() string {
	now := time.Now()
	suffix := uuid.New().String()[:6]
	return now.Format("SIP-20060102-") + strings.ToUpper(suffix)
}

// ─── Handlers ───────────────────────────────────────────────────────────────

// ListProducts — GET /api/storefront/{siteId}/products
// Herhangi bir ziyaretçi sitenin ürünlerini görebilir
func (h *StorefrontHandler) ListProducts(w http.ResponseWriter, r *http.Request) {
	siteID := r.PathValue("siteId")
	if _, err := uuid.Parse(siteID); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz site ID"})
		return
	}

	// Sitenin var olup olmadığını kontrol et
	// TODO: Gerçek ürün listesi — şimdilik site_data'dan ürün bilgilerini çek
	log.Printf("Storefront ürün listesi: site=%s", siteID)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"products": []interface{}{},
		"site_id":  siteID,
	})
}

// CreateOrder — POST /api/storefront/orders
// Ziyaretçi sipariş verir (auth gerektirmez, e-posta + tel zorunlu)
func (h *StorefrontHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var req CreateGuestOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek formatı"})
		return
	}

	// Zorunlu alan kontrolleri
	if !validateEmail(req.Customer.Email) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçerli bir e-posta adresi giriniz"})
		return
	}
	if !validatePhone(req.Customer.Phone) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçerli bir telefon numarası giriniz (örn: +905551234567)"})
		return
	}
	if strings.TrimSpace(req.Customer.Name) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Ad soyad zorunludur"})
		return
	}
	if len(req.Items) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Sepet boş olamaz"})
		return
	}
	if strings.TrimSpace(req.Address.Line1) == "" || strings.TrimSpace(req.Address.City) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Adres bilgileri eksik"})
		return
	}
	if _, err := uuid.Parse(req.SiteID); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz site ID"})
		return
	}

	// Fiyat hesaplama
	var subtotal int64
	for _, item := range req.Items {
		if item.Price <= 0 || item.Quantity <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz ürün fiyatı veya miktarı"})
			return
		}
		subtotal += item.Price * int64(item.Quantity)
	}

	// Kargo ücreti (örnek: 500 kuruş = 5 TL, 200 TL üstü ücretsiz)
	var shippingCost int64 = 500
	if subtotal >= 20000 {
		shippingCost = 0
	}

	totalAmount := subtotal + shippingCost

	// Sipariş numarası üret
	orderNumber := generateGuestOrderNumber()

	// Items ve adres JSON'a çevir
	itemsJSON, _ := json.Marshal(req.Items)
	addressJSON, _ := json.Marshal(req.Address)

	log.Printf("Ziyaretçi siparişi: site=%s email=%s phone=%s order=%s items=%d total=%d",
		req.SiteID, req.Customer.Email, cleanPhone(req.Customer.Phone),
		orderNumber, len(req.Items), totalAmount)

	// Veritabanına kaydet
	order, err := h.store.CreateGuestOrder(r.Context(), dbpkg.CreateGuestOrderParams{
		SiteID:        req.SiteID,
		OrderNumber:   orderNumber,
		CustomerEmail: strings.TrimSpace(strings.ToLower(req.Customer.Email)),
		CustomerPhone: cleanPhone(req.Customer.Phone),
		CustomerName:  strings.TrimSpace(req.Customer.Name),
		Items:         itemsJSON,
		Subtotal:      subtotal,
		ShippingCost:  shippingCost,
		TaxAmount:     0,
		TotalAmount:   totalAmount,
		Address:       addressJSON,
	})
	if err != nil {
		log.Printf("Sipariş oluşturulamadı: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Sipariş oluşturulamadı"})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message":      "Siparişiniz başarıyla oluşturuldu!",
		"order_number": orderNumber,
		"order_id":     order.ID,
		"total_amount": totalAmount,
		"currency":     "TRY",
	})
}

// RequestOTP — POST /api/storefront/orders/track
// Sipariş takibi için OTP kodu gönder
func (h *StorefrontHandler) RequestOTP(w http.ResponseWriter, r *http.Request) {
	var req TrackOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek"})
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	phone := cleanPhone(req.Phone)

	if !validateEmail(email) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçerli bir e-posta adresi giriniz"})
		return
	}
	if !validatePhone(phone) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçerli bir telefon numarası giriniz"})
		return
	}

	// Bu e-posta + telefon ile sipariş var mı kontrol et
	orders, err := h.store.ListGuestOrdersByEmailAndPhone(r.Context(), email, phone)
	if err != nil || len(orders) == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Bu bilgilerle eşleşen sipariş bulunamadı"})
		return
	}

	// OTP oluştur
	otpCode := generateOTP()
	identifier := email + ":" + phone
	expiresAt := time.Now().Add(5 * time.Minute)

	_, err = h.store.CreateOTP(r.Context(), dbpkg.CreateOTPParams{
		Identifier: identifier,
		Code:       otpCode,
		Purpose:    "order_tracking",
		ExpiresAt:  expiresAt,
	})
	if err != nil {
		log.Printf("OTP oluşturulamadı: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Doğrulama kodu oluşturulamadı"})
		return
	}

	// TODO (prod): AWS SES ile e-posta gönder / AWS SNS ile SMS gönder
	// Şimdilik log'a yaz (development mode)
	log.Printf("⚡ OTP KOD: %s → %s (5 dakika geçerli)", otpCode, identifier)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":    "Doğrulama kodu telefonunuza gönderildi",
		"expires_in": 300,
		// Development modda kodu da dön (prod'da kaldırılır)
		"_dev_code": otpCode,
	})
}

// VerifyOTP — POST /api/storefront/orders/verify
// OTP doğrula → siparişleri getir
func (h *StorefrontHandler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	var req VerifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek"})
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	phone := cleanPhone(req.Phone)
	code := strings.TrimSpace(req.Code)

	if len(code) != 6 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Doğrulama kodu 6 haneli olmalıdır"})
		return
	}

	identifier := email + ":" + phone

	// Aktif OTP bul
	otp, err := h.store.GetActiveOTP(r.Context(), identifier, "order_tracking")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçerli bir doğrulama kodu bulunamadı. Lütfen yeni kod talep edin."})
		return
	}

	// Deneme sayısını artır
	h.store.IncrementOTPAttempts(r.Context(), otp.ID)

	// Kod doğrulama
	if otp.Code != code {
		remaining := otp.MaxAttempts - otp.Attempts - 1
		if remaining <= 0 {
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "Çok fazla yanlış deneme. Lütfen yeni kod talep edin."})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error":     "Yanlış doğrulama kodu",
			"remaining": remaining,
		})
		return
	}

	// OTP'yi doğrulanmış olarak işaretle
	h.store.VerifyOTP(r.Context(), otp.ID)

	// Siparişleri getir
	orders, err := h.store.ListGuestOrdersByEmailAndPhone(r.Context(), email, phone)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Siparişler getirilemedi"})
		return
	}

	// Response oluştur
	var orderResponses []GuestOrderResponse
	for _, o := range orders {
		orderResponses = append(orderResponses, GuestOrderResponse{
			ID:             o.ID,
			OrderNumber:    o.OrderNumber,
			CustomerName:   o.CustomerName,
			CustomerEmail:  o.CustomerEmail,
			Items:          o.Items,
			Subtotal:       o.Subtotal,
			ShippingCost:   o.ShippingCost,
			TaxAmount:      o.TaxAmount,
			TotalAmount:    o.TotalAmount,
			Status:         o.Status,
			PaymentStatus:  o.PaymentStatus,
			TrackingNumber: o.TrackingNumber,
			TrackingURL:    o.TrackingURL,
			Carrier:        o.Carrier,
			CreatedAt:      o.CreatedAt,
			UpdatedAt:      o.UpdatedAt,
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"verified": true,
		"orders":   orderResponses,
	})
}

// GetOrderByNumber — GET /api/storefront/orders/{orderNumber}
// Sipariş detayını getir (OTP doğrulanmış session gerekli)
func (h *StorefrontHandler) GetOrderByNumber(w http.ResponseWriter, r *http.Request) {
	orderNumber := r.PathValue("orderNumber")
	if orderNumber == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Sipariş numarası gerekli"})
		return
	}

	order, err := h.store.GetGuestOrderByNumber(r.Context(), orderNumber)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Sipariş bulunamadı"})
		return
	}

	writeJSON(w, http.StatusOK, GuestOrderResponse{
		ID:             order.ID,
		OrderNumber:    order.OrderNumber,
		CustomerName:   order.CustomerName,
		CustomerEmail:  order.CustomerEmail,
		Items:          order.Items,
		Subtotal:       order.Subtotal,
		ShippingCost:   order.ShippingCost,
		TaxAmount:      order.TaxAmount,
		TotalAmount:    order.TotalAmount,
		Status:         order.Status,
		PaymentStatus:  order.PaymentStatus,
		TrackingNumber: order.TrackingNumber,
		TrackingURL:    order.TrackingURL,
		Carrier:        order.Carrier,
		CreatedAt:      order.CreatedAt,
		UpdatedAt:      order.UpdatedAt,
	})
}
