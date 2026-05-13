// Marketplace alıcısı: adres defteri, ödeme yöntemleri ve profil.
//
// Ödeme yöntemleri PCI uyumlu şekilde tutulur: PAN/CVV asla bu DB'ye ulaşmaz,
// sadece Stripe pm_xxx token + display verisi (brand/last4/exp) saklanır.
// Frontend Stripe Elements ile kartı doğrudan Stripe'a gönderir,
// sonra pm_xxx token'ını backend'e POST eder.
package handler

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"go-backend-projem/internal/db"
	"go-backend-projem/internal/middleware"
	"go-backend-projem/internal/payments"

	"github.com/jackc/pgx/v5"
)

type BuyerHandler struct {
	store  *db.Store
	stripe *payments.Client
}

func NewBuyerHandler(store *db.Store, stripe *payments.Client) *BuyerHandler {
	return &BuyerHandler{store: store, stripe: stripe}
}

// ─── PUT /api/buyer/profile ──────────────────────────────────────────────

type updateProfileRequest struct {
	FullName string `json:"full_name"`
	Phone    string `json:"phone"`
}

func (h *BuyerHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "Yetkisiz")
		return
	}
	var req updateProfileRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}
	req.FullName = strings.TrimSpace(req.FullName)
	req.Phone = strings.TrimSpace(req.Phone)
	if req.Phone != "" && !looksLikePhone(req.Phone) {
		writeError(w, http.StatusBadRequest, "Geçersiz telefon")
		return
	}
	if err := h.store.UpdateUserProfile(r.Context(), userID, req.FullName, req.Phone); err != nil {
		log.Printf("UpdateUserProfile: %v", err)
		writeError(w, http.StatusInternalServerError, "Profil güncellenemedi")
		return
	}
	user, err := h.store.GetUserByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Kullanıcı yüklenemedi")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

// ─── Adresler ────────────────────────────────────────────────────────────

type addressRequest struct {
	Label         string `json:"label"`
	RecipientName string `json:"recipient_name"`
	Phone         string `json:"phone"`
	Line1         string `json:"line1"`
	Line2         string `json:"line2"`
	City          string `json:"city"`
	State         string `json:"state"`
	Zip           string `json:"zip"`
	Country       string `json:"country"`
	IsDefault     bool   `json:"is_default"`
}

func (req *addressRequest) toModel(userID, id string) *db.Address {
	a := &db.Address{
		ID:            id,
		UserID:        userID,
		RecipientName: strings.TrimSpace(req.RecipientName),
		Phone:         strings.TrimSpace(req.Phone),
		Line1:         strings.TrimSpace(req.Line1),
		City:          strings.TrimSpace(req.City),
		Country:       strings.TrimSpace(req.Country),
		IsDefault:     req.IsDefault,
	}
	if v := strings.TrimSpace(req.Label); v != "" {
		a.Label = &v
	}
	if v := strings.TrimSpace(req.Line2); v != "" {
		a.Line2 = &v
	}
	if v := strings.TrimSpace(req.State); v != "" {
		a.State = &v
	}
	if v := strings.TrimSpace(req.Zip); v != "" {
		a.Zip = &v
	}
	if a.Country == "" {
		a.Country = "TR"
	}
	return a
}

func (req *addressRequest) validate() string {
	if req.RecipientName == "" {
		return "Alıcı adı zorunlu"
	}
	if req.Phone == "" {
		return "Telefon zorunlu"
	}
	if req.Line1 == "" {
		return "Adres satırı zorunlu"
	}
	if req.City == "" {
		return "Şehir zorunlu"
	}
	return ""
}

func (h *BuyerHandler) ListAddresses(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	out, err := h.store.ListAddresses(r.Context(), userID)
	if err != nil {
		log.Printf("ListAddresses: %v", err)
		writeError(w, http.StatusInternalServerError, "Adresler yüklenemedi")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *BuyerHandler) CreateAddress(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	var req addressRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}
	if msg := req.validate(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	a, err := h.store.CreateAddress(r.Context(), req.toModel(userID, ""))
	if err != nil {
		log.Printf("CreateAddress: %v", err)
		writeError(w, http.StatusInternalServerError, "Adres oluşturulamadı")
		return
	}
	writeJSON(w, http.StatusCreated, a)
}

func (h *BuyerHandler) UpdateAddress(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	id := pathValue(r, "id")
	var req addressRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}
	if msg := req.validate(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	a, err := h.store.UpdateAddress(r.Context(), req.toModel(userID, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Adres bulunamadı")
			return
		}
		log.Printf("UpdateAddress: %v", err)
		writeError(w, http.StatusInternalServerError, "Adres güncellenemedi")
		return
	}
	writeJSON(w, http.StatusOK, a)
}

func (h *BuyerHandler) DeleteAddress(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	id := pathValue(r, "id")
	if err := h.store.DeleteAddress(r.Context(), id, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Adres bulunamadı")
			return
		}
		log.Printf("DeleteAddress: %v", err)
		writeError(w, http.StatusInternalServerError, "Adres silinemedi")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *BuyerHandler) SetDefaultAddress(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	id := pathValue(r, "id")
	if err := h.store.SetDefaultAddress(r.Context(), id, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Adres bulunamadı")
			return
		}
		log.Printf("SetDefaultAddress: %v", err)
		writeError(w, http.StatusInternalServerError, "Varsayılan ayarlanamadı")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── Ödeme Yöntemleri ────────────────────────────────────────────────────

// POST /api/buyer/payment-methods/setup-intent
// Stripe Customer'ı lazy-create eder, SetupIntent oluşturur, client_secret döndürür.
// Frontend stripe.confirmCardSetup(clientSecret) ile kartı doğrudan Stripe'a gönderir.
func (h *BuyerHandler) CreateSetupIntent(w http.ResponseWriter, r *http.Request) {
	if !h.stripe.Configured() {
		writeError(w, http.StatusServiceUnavailable, "Ödeme servisi yapılandırılmamış")
		return
	}
	userID := middleware.UserIDFromCtx(r.Context())
	user, err := h.store.GetUserByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Kullanıcı yüklenemedi")
		return
	}
	customerID, err := h.ensureStripeCustomer(r, user)
	if err != nil {
		log.Printf("ensureStripeCustomer: %v", err)
		writeError(w, http.StatusBadGateway, "Stripe müşterisi oluşturulamadı")
		return
	}
	clientSecret, intentID, err := h.stripe.CreateSetupIntent(r.Context(), customerID)
	if err != nil {
		log.Printf("CreateSetupIntent: %v", err)
		writeError(w, http.StatusBadGateway, "SetupIntent oluşturulamadı")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"client_secret":   clientSecret,
		"setup_intent_id": intentID,
		"customer_id":     customerID,
	})
}

type attachPaymentMethodRequest struct {
	StripePaymentMethodID string `json:"stripe_payment_method_id"`
	SetAsDefault          bool   `json:"set_as_default"`
}

// POST /api/buyer/payment-methods
// Frontend confirmCardSetup başarılı olduktan sonra elindeki pm_xxx ID'yi
// bu endpoint'e yollar. Backend kartı Stripe'ta Customer'a attach eder
// ve sadece display verisi (brand/last4/exp) DB'ye yazılır.
func (h *BuyerHandler) AttachPaymentMethod(w http.ResponseWriter, r *http.Request) {
	if !h.stripe.Configured() {
		writeError(w, http.StatusServiceUnavailable, "Ödeme servisi yapılandırılmamış")
		return
	}
	userID := middleware.UserIDFromCtx(r.Context())
	var req attachPaymentMethodRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}
	pmID := strings.TrimSpace(req.StripePaymentMethodID)
	if !strings.HasPrefix(pmID, "pm_") {
		writeError(w, http.StatusBadRequest, "Geçersiz payment method ID")
		return
	}
	user, err := h.store.GetUserByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Kullanıcı yüklenemedi")
		return
	}
	customerID, err := h.ensureStripeCustomer(r, user)
	if err != nil {
		writeError(w, http.StatusBadGateway, "Stripe müşterisi oluşturulamadı")
		return
	}

	// SetupIntent akışında genellikle attach zaten yapılmıştır; idempotent çağrı.
	if err := h.stripe.AttachPaymentMethod(r.Context(), pmID, customerID); err != nil {
		// "already attached" hatasına devam et — display verisi yine de çekilebilir.
		log.Printf("AttachPaymentMethod (devam): %v", err)
	}

	disp, err := h.stripe.RetrievePaymentMethod(r.Context(), pmID)
	if err != nil {
		log.Printf("RetrievePaymentMethod: %v", err)
		writeError(w, http.StatusBadGateway, "Kart bilgisi alınamadı")
		return
	}

	pm, err := h.store.CreatePaymentMethod(r.Context(), &db.PaymentMethod{
		UserID:                userID,
		StripePaymentMethodID: pmID,
		Brand:                 disp.Brand,
		Last4:                 disp.Last4,
		ExpMonth:              int16(disp.ExpMonth),
		ExpYear:               int16(disp.ExpYear),
		IsDefault:             req.SetAsDefault,
	})
	if err != nil {
		log.Printf("CreatePaymentMethod: %v", err)
		writeError(w, http.StatusInternalServerError, "Kart kaydedilemedi")
		return
	}
	writeJSON(w, http.StatusCreated, pm)
}

func (h *BuyerHandler) ListPaymentMethods(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	out, err := h.store.ListPaymentMethods(r.Context(), userID)
	if err != nil {
		log.Printf("ListPaymentMethods: %v", err)
		writeError(w, http.StatusInternalServerError, "Kartlar yüklenemedi")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *BuyerHandler) DeletePaymentMethod(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	id := pathValue(r, "id")
	pm, err := h.store.DeletePaymentMethod(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Kart bulunamadı")
			return
		}
		log.Printf("DeletePaymentMethod: %v", err)
		writeError(w, http.StatusInternalServerError, "Kart silinemedi")
		return
	}
	if h.stripe.Configured() {
		if err := h.stripe.DetachPaymentMethod(r.Context(), pm.StripePaymentMethodID); err != nil {
			// Stripe detach hatası kritik değil — DB'den silindi, yine de log'la.
			log.Printf("Stripe detach (devam): %v", err)
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *BuyerHandler) SetDefaultPaymentMethod(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	id := pathValue(r, "id")
	if err := h.store.SetDefaultPaymentMethod(r.Context(), id, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Kart bulunamadı")
			return
		}
		log.Printf("SetDefaultPaymentMethod: %v", err)
		writeError(w, http.StatusInternalServerError, "Varsayılan ayarlanamadı")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────

// ensureStripeCustomer kullanıcı için bir Stripe Customer hazır eder ve cus_xxx döner.
func (h *BuyerHandler) ensureStripeCustomer(r *http.Request, user *db.User) (string, error) {
	if user.StripeCustomerID != nil && *user.StripeCustomerID != "" {
		return *user.StripeCustomerID, nil
	}
	name := ""
	if user.FullName != nil {
		name = *user.FullName
	}
	phone := ""
	if user.Phone != nil {
		phone = *user.Phone
	}
	customerID, err := h.stripe.CreateCustomer(r.Context(), user.Email, name, phone)
	if err != nil {
		return "", err
	}
	if err := h.store.SetUserStripeCustomerID(r.Context(), user.ID, customerID); err != nil {
		return "", err
	}
	return customerID, nil
}

// looksLikePhone +90 5xx xxx xx xx benzeri basit format kontrolü.
func looksLikePhone(s string) bool {
	digits := 0
	for _, ch := range s {
		if ch >= '0' && ch <= '9' {
			digits++
		}
	}
	return digits >= 7
}
