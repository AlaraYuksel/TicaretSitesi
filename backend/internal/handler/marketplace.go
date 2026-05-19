package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go-backend-projem/internal/ai"
	dbpkg "go-backend-projem/internal/db"
	"go-backend-projem/internal/middleware"
	"go-backend-projem/internal/payments"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// MarketplaceHandler — Publish edilmiş tüm sitelerin ürünlerini içeren marketplace.
type MarketplaceHandler struct {
	store     *dbpkg.Store
	stripe    *payments.Client
	jwtSecret string
}

func NewMarketplaceHandler(store *dbpkg.Store, stripe *payments.Client, jwtSecret string) *MarketplaceHandler {
	return &MarketplaceHandler{store: store, stripe: stripe, jwtSecret: jwtSecret}
}

// ─── DTO ────────────────────────────────────────────────────────────────────

type MarketplaceProductDTO struct {
	ID           string  `json:"id"`
	SiteID       string  `json:"site_id"`
	Title        string  `json:"title"`
	Slug         string  `json:"slug"`
	Description  string  `json:"description,omitempty"`
	Price        int64   `json:"price"`         // kuruş cinsinden
	ComparePrice *int64  `json:"compare_price,omitempty"`
	Currency     string  `json:"currency"`
	Image        string  `json:"image"`
	Category     string  `json:"category"`
	Badge        string  `json:"badge"`
	Rating       float64 `json:"rating"`
	ReviewCount  int     `json:"review_count"`
	Stock        int     `json:"stock_quantity"`
	Seller       string  `json:"seller"`
	SourceType   string  `json:"source_type"`
}

func toDTO(pp dbpkg.PublishedProduct) MarketplaceProductDTO {
	d := MarketplaceProductDTO{
		ID:           pp.ID,
		SiteID:       pp.SiteID,
		Title:        pp.Title,
		Slug:         pp.Slug,
		Price:        pp.Price,
		ComparePrice: pp.ComparePrice,
		Currency:     pp.Currency,
		Rating:       pp.Rating,
		ReviewCount:  pp.ReviewCount,
		Stock:        pp.StockQuantity,
		SourceType:   pp.SourceType,
	}
	if pp.Description != nil {
		d.Description = *pp.Description
	}
	if pp.ImageURL != nil {
		d.Image = *pp.ImageURL
	}
	if pp.Category != nil {
		d.Category = *pp.Category
	}
	if pp.Badge != nil {
		d.Badge = *pp.Badge
	}
	if pp.StoreName != nil {
		d.Seller = *pp.StoreName
	}
	return d
}

// ─── Public Handlers ────────────────────────────────────────────────────────

// ListProducts — GET /api/marketplace/products?q=&category=&sort=&page=&limit=
func (h *MarketplaceHandler) ListProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	limit, _ := strconv.Atoi(q.Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 24
	}

	params := dbpkg.ListPublishedProductsParams{
		Search:   strings.TrimSpace(q.Get("q")),
		Category: strings.TrimSpace(q.Get("category")),
		Sort:     strings.TrimSpace(q.Get("sort")),
		Limit:    limit,
		Offset:   (page - 1) * limit,
	}

	products, total, err := h.store.ListPublishedProducts(r.Context(), params)
	if err != nil {
		log.Printf("Marketplace ListProducts: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Ürünler getirilemedi"})
		return
	}

	out := make([]MarketplaceProductDTO, 0, len(products))
	for _, p := range products {
		out = append(out, toDTO(p))
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"products": out,
		"page":     page,
		"limit":    limit,
		"total":    total,
	})
}

// GetProduct — GET /api/marketplace/products/{id}
// Yanıta cevaplanmış sorular (Q&A) eklenir; en güncel 10 tanesi.
func (h *MarketplaceHandler) GetProduct(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, err := uuid.Parse(id); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz ürün ID")
		return
	}
	pp, err := h.store.GetPublishedProductByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Ürün bulunamadı")
		return
	}
	dto := toDTO(*pp)
	answered, qerr := h.store.ListAnsweredQuestionsByProduct(r.Context(), id, 10)
	if qerr != nil {
		log.Printf("ListAnsweredQuestionsByProduct: %v", qerr)
		answered = nil
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"product":            dto,
		"answered_questions": answered,
	})
}

// ListCategories — GET /api/marketplace/categories
func (h *MarketplaceHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	cats, err := h.store.ListPublishedCategories(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Kategoriler getirilemedi"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"categories": cats})
}

// ─── Sipariş + Stripe (test mode) ──────────────────────────────────────────

type marketplaceOrderItemReq struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
}

type marketplaceOrderReq struct {
	// Auth yoksa customer/address zorunlu (guest checkout).
	// Auth varsa frontend yine de gönderebilir; gönderilmezse profile'dan doldurulur.
	Customer GuestCustomerInfo         `json:"customer"`
	Items    []marketplaceOrderItemReq `json:"items"`
	Address  GuestShippingAddress      `json:"shipping_address"`
	Notes    string                    `json:"notes,omitempty"`

	// Stripe entegrasyonu
	PaymentMethodID string `json:"payment_method_id,omitempty"` // pm_xxx (kayıtlı veya yeni)
	SavedAddressID  string `json:"saved_address_id,omitempty"`  // auth varsa
	SavedPMID       string `json:"saved_payment_method_id,omitempty"` // bizim DB id
}

type marketplaceOrderResult struct {
	OrderNumber  string `json:"order_number"`
	OrderID      string `json:"order_id"`
	SiteID       string `json:"site_id"`
	Subtotal     int64  `json:"subtotal"`
	ShippingCost int64  `json:"shipping_cost"`
	Total        int64  `json:"total"`
	ClientSecret string `json:"client_secret,omitempty"` // boş ise simüle (Stripe yok)
	Simulated    bool   `json:"simulated"`
}

// CreateOrder — POST /api/marketplace/orders
//
// Akış:
//
//   1. Optional auth: Bearer token varsa userID + email + saved address/payment method desteklenir.
//   2. Validasyon: customer/address (guest için zorunlu), items.
//   3. Items'ı satıcı (site_id) bazında grupla.
//   4. Her grup için:
//        - Subtotal + kargo (5 TL, 200 TL üstü ücretsiz)
//        - Satıcının stripe_account_id'sini bul; varsa destination charge yap.
//        - Stripe PaymentIntent (test mode) oluştur; client_secret döner.
//        - Stripe yapılandırılmamışsa simüle mod: ödeme direkt 'paid' işaretlenir.
//        - marketplace_order kaydı yaratılır (status='confirmed', approval='pending_approval').
//   5. orders: [{order_number, client_secret}, ...] döner; frontend her birini ayrı confirm eder.
func (h *MarketplaceHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var req marketplaceOrderReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz istek")
		return
	}

	// ── Optional auth ──────────────────────────────────────────────────────
	buyerUserID, buyerEmail := h.tryParseBearer(r)
	var buyer *dbpkg.User
	if buyerUserID != "" {
		var err error
		buyer, err = h.store.GetUserByID(r.Context(), buyerUserID)
		if err != nil {
			log.Printf("CreateOrder: GetUserByID: %v", err)
			buyer = nil
			buyerUserID = ""
		}
	}

	// Saved address: auth varsa override edebilir
	if buyerUserID != "" && req.SavedAddressID != "" {
		a, err := h.store.GetAddress(r.Context(), req.SavedAddressID, buyerUserID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeError(w, http.StatusBadRequest, "Seçili adres bulunamadı")
				return
			}
			writeError(w, http.StatusInternalServerError, "Adres yüklenemedi")
			return
		}
		req.Address.Line1 = a.Line1
		req.Address.City = a.City
		if a.Line2 != nil {
			req.Address.Line2 = *a.Line2
		}
		if a.State != nil {
			req.Address.State = *a.State
		}
		if a.Zip != nil {
			req.Address.ZipCode = *a.Zip
		}
		req.Address.Country = a.Country
		if req.Customer.Name == "" {
			req.Customer.Name = a.RecipientName
		}
		if req.Customer.Phone == "" {
			req.Customer.Phone = a.Phone
		}
	}

	// Saved payment method ID → Stripe pm_xxx çöz
	if buyerUserID != "" && req.SavedPMID != "" && req.PaymentMethodID == "" {
		pm, err := h.store.GetPaymentMethod(r.Context(), req.SavedPMID, buyerUserID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeError(w, http.StatusBadRequest, "Seçili kart bulunamadı")
				return
			}
			writeError(w, http.StatusInternalServerError, "Kart yüklenemedi")
			return
		}
		req.PaymentMethodID = pm.StripePaymentMethodID
	}

	// Email/phone otomatik doldur
	if buyer != nil {
		if req.Customer.Email == "" {
			req.Customer.Email = buyer.Email
		}
		if req.Customer.Phone == "" && buyer.Phone != nil {
			req.Customer.Phone = *buyer.Phone
		}
		if req.Customer.Name == "" && buyer.FullName != nil {
			req.Customer.Name = *buyer.FullName
		}
	}
	_ = buyerEmail // şu an kullanılmıyor

	// ── Validasyon ─────────────────────────────────────────────────────────
	if !validateEmail(req.Customer.Email) {
		writeError(w, http.StatusBadRequest, "Geçerli bir e-posta adresi giriniz")
		return
	}
	if !validatePhone(req.Customer.Phone) {
		writeError(w, http.StatusBadRequest, "Geçerli bir telefon numarası giriniz")
		return
	}
	if strings.TrimSpace(req.Customer.Name) == "" {
		writeError(w, http.StatusBadRequest, "Ad soyad zorunludur")
		return
	}
	if len(req.Items) == 0 {
		writeError(w, http.StatusBadRequest, "Sepet boş olamaz")
		return
	}
	if strings.TrimSpace(req.Address.Line1) == "" || strings.TrimSpace(req.Address.City) == "" {
		writeError(w, http.StatusBadRequest, "Adres bilgileri eksik")
		return
	}

	// ── Snapshot + site_id'ye göre grupla ─────────────────────────────────
	type snapshotItem struct {
		ProductID string `json:"product_id"`
		SiteID    string `json:"site_id"`
		Title     string `json:"title"`
		Price     int64  `json:"price"`
		Quantity  int    `json:"quantity"`
		Image     string `json:"image"`
		Seller    string `json:"seller,omitempty"`
	}

	bySite := map[string][]snapshotItem{}
	sellerNameBySite := map[string]string{}
	for _, it := range req.Items {
		if it.Quantity <= 0 || it.Quantity > 100 {
			writeError(w, http.StatusBadRequest, "Geçersiz miktar")
			return
		}
		if _, err := uuid.Parse(it.ProductID); err != nil {
			writeError(w, http.StatusBadRequest, "Geçersiz ürün ID")
			return
		}
		pp, err := h.store.GetPublishedProductByID(r.Context(), it.ProductID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Ürün artık mevcut değil: "+it.ProductID)
			return
		}
		if buyerUserID != "" && pp.UserID == buyerUserID {
			writeError(w, http.StatusForbidden, "Kendi sitenizden alışveriş yapamazsınız")
			return
		}
		image := ""
		if pp.ImageURL != nil {
			image = *pp.ImageURL
		}
		seller := ""
		if pp.StoreName != nil {
			seller = *pp.StoreName
		}
		bySite[pp.SiteID] = append(bySite[pp.SiteID], snapshotItem{
			ProductID: pp.ID, SiteID: pp.SiteID, Title: pp.Title,
			Price: pp.Price, Quantity: it.Quantity, Image: image, Seller: seller,
		})
		if seller != "" {
			sellerNameBySite[pp.SiteID] = seller
		}
	}

	addressJSON, _ := json.Marshal(req.Address)

	// Customer (Stripe) — auth varsa lazy-create
	var customerID string
	if buyer != nil && h.stripe.Configured() {
		if buyer.StripeCustomerID != nil && *buyer.StripeCustomerID != "" {
			customerID = *buyer.StripeCustomerID
		} else {
			cid, err := h.stripe.CreateCustomer(r.Context(), buyer.Email, derefOr(buyer.FullName, ""), derefOr(buyer.Phone, ""))
			if err != nil {
				log.Printf("CreateCustomer: %v", err)
			} else {
				_ = h.store.SetUserStripeCustomerID(r.Context(), buyer.ID, cid)
				customerID = cid
			}
		}
	}

	// ── Her satıcı için ayrı sipariş + PaymentIntent ─────────────────────
	results := make([]marketplaceOrderResult, 0, len(bySite))
	for siteID, items := range bySite {
		var subtotal int64
		for _, it := range items {
			subtotal += it.Price * int64(it.Quantity)
		}
		var shippingCost int64 = 500
		if subtotal >= 20000 {
			shippingCost = 0
		}
		total := subtotal + shippingCost

		itemsJSON, _ := json.Marshal(items)
		orderNumber := fmt.Sprintf("MP-%s-%s",
			time.Now().Format("20060102"),
			strings.ToUpper(uuid.New().String()[:6]),
		)

		// Stripe PaymentIntent (varsa)
		var (
			piID         string
			clientSecret string
			simulated    bool
		)
		if h.stripe.Configured() {
			// Connected account lookup — yoksa düz ödeme (test/dev için pragmatik).
			connectedAcct, onboarded, _ := h.store.GetSellerStripeAccountForSite(r.Context(), siteID)
			if !onboarded {
				connectedAcct = ""
			}
			var fee int64
			if connectedAcct != "" {
				fee = h.stripe.PlatformFeeFor(total)
			}
			pi, err := h.stripe.CreatePaymentIntent(r.Context(), payments.PaymentIntentParams{
				Amount:             total,
				Currency:           "try",
				CustomerID:         customerID,
				PaymentMethodID:    req.PaymentMethodID, // pm_xxx; frontend confirm eder
				ConnectedAccountID: connectedAcct,
				ApplicationFee:     fee,
				Description:        "Marketplace order " + orderNumber,
				Metadata: map[string]string{
					"order_number": orderNumber,
					"site_id":      siteID,
				},
			})
			if err != nil {
				log.Printf("PaymentIntent (%s): %v", orderNumber, err)
				writeError(w, http.StatusBadGateway, "Ödeme başlatılamadı")
				return
			}
			piID = pi.ID
			clientSecret = pi.ClientSecret
		} else {
			simulated = true
		}

		params := dbpkg.CreateMarketplaceOrderParams{
			OrderNumber:           orderNumber,
			BuyerID:               buyerUserID,
			SiteID:                siteID,
			CustomerEmail:         strings.ToLower(strings.TrimSpace(req.Customer.Email)),
			CustomerPhone:         cleanPhone(req.Customer.Phone),
			CustomerName:          strings.TrimSpace(req.Customer.Name),
			Items:                 itemsJSON,
			Subtotal:              subtotal,
			ShippingCost:          shippingCost,
			TotalAmount:           total,
			ShippingAddress:       addressJSON,
			Notes:                 req.Notes,
			StripePaymentIntentID: piID,
		}
		order, err := h.store.CreateMarketplaceOrder(r.Context(), params)
		if err != nil {
			log.Printf("CreateMarketplaceOrder: %v", err)
			writeError(w, http.StatusInternalServerError, "Sipariş oluşturulamadı")
			return
		}

		// Simüle mod: Stripe yapılandırılmamış → payment_status'u direkt 'paid' yap.
		if simulated {
			_ = h.store.MarkMarketplaceOrderPaidByID(r.Context(), order.ID)
		}

		results = append(results, marketplaceOrderResult{
			OrderNumber:  order.OrderNumber,
			OrderID:      order.ID,
			SiteID:       siteID,
			Subtotal:     subtotal,
			ShippingCost: shippingCost,
			Total:        total,
			ClientSecret: clientSecret,
			Simulated:    simulated,
		})

		log.Printf("📦 Marketplace siparişi: %s site=%s total=%d pi=%s", orderNumber, siteID, total, piID)
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"orders": results,
	})
}

// ConfirmPayment — POST /api/marketplace/orders/{id}/confirm-payment
//
// Frontend stripe.confirmCardPayment başarılı olduktan sonra çağırır.
// Backend PaymentIntent durumunu Stripe'tan doğrular ve order'ı paid işaretler.
// Webhook'a güvenilemeyen dev/local ortamlar için kritik; webhook gelirse idempotent.
func (h *MarketplaceHandler) ConfirmPayment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, err := uuid.Parse(id); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz sipariş ID")
		return
	}
	order, err := h.store.GetMarketplaceOrderByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Sipariş bulunamadı")
		return
	}
	if order.PaymentStatus == "paid" {
		writeJSON(w, http.StatusOK, map[string]string{"payment_status": "paid"})
		return
	}
	if order.StripePaymentIntentID == nil || *order.StripePaymentIntentID == "" {
		writeError(w, http.StatusBadRequest, "Bu sipariş için PaymentIntent yok")
		return
	}
	if !h.stripe.Configured() {
		writeError(w, http.StatusServiceUnavailable, "Stripe yapılandırılmamış")
		return
	}
	pi, err := h.stripe.RetrievePaymentIntent(r.Context(), *order.StripePaymentIntentID)
	if err != nil {
		log.Printf("ConfirmPayment RetrievePaymentIntent: %v", err)
		writeError(w, http.StatusBadGateway, "Ödeme durumu alınamadı")
		return
	}
	if pi.Status != "succeeded" {
		writeJSON(w, http.StatusOK, map[string]string{"payment_status": order.PaymentStatus, "stripe_status": pi.Status})
		return
	}
	if err := h.store.MarkMarketplaceOrderPaid(r.Context(), *order.StripePaymentIntentID); err != nil {
		log.Printf("ConfirmPayment MarkMarketplaceOrderPaid: %v", err)
		writeError(w, http.StatusInternalServerError, "Sipariş güncellenemedi")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"payment_status": "paid"})
}

// CancelByBuyer — POST /api/buyer/orders/{id}/cancel
//
// Alıcı kargoya verilmemiş siparişini iptal eder. Ödeme yapılmışsa Stripe refund tetiklenir.
func (h *MarketplaceHandler) CancelByBuyer(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	id := r.PathValue("id")
	if _, err := uuid.Parse(id); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz sipariş ID")
		return
	}
	order, err := h.store.GetMarketplaceOrderForBuyer(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Sipariş bulunamadı")
			return
		}
		log.Printf("GetMarketplaceOrderForBuyer: %v", err)
		writeError(w, http.StatusInternalServerError, "Sipariş yüklenemedi")
		return
	}
	if order.Status == "shipped" || order.Status == "delivered" {
		writeError(w, http.StatusConflict, "Kargoya verilmiş veya teslim edilmiş sipariş iptal edilemez")
		return
	}
	if order.Status == "cancelled" {
		writeError(w, http.StatusConflict, "Sipariş zaten iptal edilmiş")
		return
	}

	var reqBody struct {
		Reason string `json:"reason"`
	}
	_ = json.NewDecoder(r.Body).Decode(&reqBody)
	reason := strings.TrimSpace(reqBody.Reason)
	if reason == "" {
		reason = "Alıcı tarafından iptal edildi"
	}

	if order.PaymentStatus == "paid" && order.StripePaymentIntentID != nil && *order.StripePaymentIntentID != "" && h.stripe.Configured() {
		if _, err := h.stripe.CreateRefund(r.Context(), *order.StripePaymentIntentID, 0); err != nil {
			log.Printf("CancelByBuyer CreateRefund: %v", err)
			writeError(w, http.StatusBadGateway, "İade başlatılamadı")
			return
		}
	}

	if err := h.store.CancelMarketplaceOrder(r.Context(), id, reason); err != nil {
		log.Printf("CancelMarketplaceOrder (buyer): %v", err)
		writeError(w, http.StatusInternalServerError, "İptal başarısız")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GetOrder — GET /api/marketplace/orders/{orderNumber}
func (h *MarketplaceHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
	orderNumber := r.PathValue("orderNumber")
	if orderNumber == "" {
		writeError(w, http.StatusBadRequest, "Sipariş numarası gerekli")
		return
	}
	order, err := h.store.GetMarketplaceOrderByNumber(r.Context(), orderNumber)
	if err != nil {
		writeError(w, http.StatusNotFound, "Sipariş bulunamadı")
		return
	}
	writeJSON(w, http.StatusOK, order)
}

// ListMyOrders — GET /api/buyer/orders — auth'lu alıcının sipariş geçmişi.
func (h *MarketplaceHandler) ListMyOrders(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	orders, err := h.store.ListMarketplaceOrdersBuyer(r.Context(), userID)
	if err != nil {
		log.Printf("ListMarketplaceOrdersBuyer: %v", err)
		writeError(w, http.StatusInternalServerError, "Siparişler yüklenemedi")
		return
	}
	writeJSON(w, http.StatusOK, orders)
}

// ─── Yardımcılar ───────────────────────────────────────────────────────────

// tryParseBearer — Bearer header varsa user_id + email döndürür; yoksa boş.
// JWT auth middleware'in aksine eksik/geçersiz token'da hata fırlatmaz.
func (h *MarketplaceHandler) tryParseBearer(r *http.Request) (userID, email string) {
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return "", ""
	}
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(h.jwtSecret), nil
	})
	if err != nil || !token.Valid {
		return "", ""
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", ""
	}
	userID, _ = claims["sub"].(string)
	email, _ = claims["email"].(string)
	return userID, email
}

func derefOr(p *string, def string) string {
	if p == nil {
		return def
	}
	return *p
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT EXTRACTOR — site_data JSON'undan ürünleri çıkarır
// ═══════════════════════════════════════════════════════════════════════════

// extractedProduct — ham JSON'dan çıkarılan ürün
type extractedProduct struct {
	SourceElementID string
	SourceType      string
	Title           string
	Description     string
	Price           int64 // kuruş
	ComparePrice    *int64
	Currency        string
	ImageURL        string
	Category        string
	Badge           string
	Rating          float64
	ReviewCount     int
}

// SyncPublishedProductsForSite — Site publish edildiğinde site_data'dan ürünleri çıkarır
// ve published_products tablosuna yansıtır. Silinmiş ürünleri tabloyla senkronize eder.
//
// gemini nil değilse her ürün için anlamsal arama embedding'i üretilir (AI Çözüm
// Asistanı için). Embedding hatası yayınlamayı bloklamaz; sessiz loglanır ve
// backfill-embeddings komutu sonradan eksikleri tamamlayabilir.
func SyncPublishedProductsForSite(
	ctx context.Context,
	store *dbpkg.Store,
	gemini *ai.GeminiClient,
	siteID, userID string,
	siteData json.RawMessage,
	storeName string,
) (int, error) {
	products := extractProductsFromSiteData(siteData)

	// İlk: silinmiş ürünleri temizle (mevcut element_id listesi dışındakileri sil)
	keepIDs := make([]string, 0, len(products))
	for _, p := range products {
		keepIDs = append(keepIDs, p.SourceElementID)
	}
	if err := store.DeletePublishedProductsBySiteExcept(ctx, siteID, keepIDs); err != nil {
		return 0, fmt.Errorf("cleanup: %w", err)
	}

	// Sonra: upsert (+ varsa embedding)
	for _, p := range products {
		slug := generateSlug(p.Title)
		pp, err := store.UpsertPublishedProduct(ctx, dbpkg.UpsertPublishedProductParams{
			SiteID:          siteID,
			UserID:          userID,
			SourceElementID: p.SourceElementID,
			SourceType:      p.SourceType,
			Title:           p.Title,
			Slug:            slug,
			Description:     p.Description,
			Price:           p.Price,
			ComparePrice:    p.ComparePrice,
			Currency:        p.Currency,
			ImageURL:        p.ImageURL,
			Category:        p.Category,
			Badge:           p.Badge,
			Rating:          p.Rating,
			ReviewCount:     p.ReviewCount,
			StoreName:       storeName,
		})
		if err != nil {
			log.Printf("UpsertPublishedProduct error (elem=%s): %v", p.SourceElementID, err)
			continue
		}
		if gemini != nil {
			// Her embedding çağrısı 10sn ile sınırlı: Gemini yavaş/erişilemez
			// olsa bile publish isteği takılıp Lambda timeout'una düşmesin.
			// Hata olursa loglanır ve ürün embedding'siz devam eder.
			embCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			emb, embErr := gemini.GenerateEmbedding(embCtx, pp.EmbedText())
			cancel()
			if embErr != nil {
				log.Printf("Embedding hatası (elem=%s): %v", p.SourceElementID, embErr)
			} else if err := store.UpdatePublishedProductEmbedding(ctx, pp.ID, emb); err != nil {
				log.Printf("Embedding kaydı hatası (elem=%s): %v", p.SourceElementID, err)
			}
		}
	}
	return len(products), nil
}

// extractProductsFromSiteData — site_data JSON'unu dolaşır, ürün elementlerini çıkarır.
//
// Editor'deki ürün element tipleri:
//   - productCard:        tekil ürün (props.title, .price, .description, .imageSrc, ...)
//   - productGrid:        çoklu ürün dizisi (props.products[])
//   - productListing:     çoklu ürün dizisi (props.products[] — minimalist tema)
//   - productDetailHero:  tekil ürün (props.productName, .price, .productDesc, .imageSrc)
//
// site_data formatı: { pages: [ { id, name, elements: [...] } ] }
// Her element top-level olabilir veya container'ın children'ı içinde olabilir.
func extractProductsFromSiteData(raw json.RawMessage) []extractedProduct {
	if len(raw) == 0 {
		return nil
	}
	var sd struct {
		Pages []struct {
			ID       string            `json:"id"`
			Elements []json.RawMessage `json:"elements"`
		} `json:"pages"`
	}
	if err := json.Unmarshal(raw, &sd); err != nil {
		log.Printf("extractProductsFromSiteData unmarshal: %v", err)
		return nil
	}

	var out []extractedProduct
	for _, page := range sd.Pages {
		for _, elRaw := range page.Elements {
			walkElement(elRaw, &out)
		}
	}
	return out
}

// walkElement — tek bir element ve (varsa) child'larını dolaşır.
func walkElement(raw json.RawMessage, out *[]extractedProduct) {
	var el struct {
		ID       string            `json:"id"`
		Type     string            `json:"type"`
		Props    json.RawMessage   `json:"props"`
		Children []json.RawMessage `json:"children"`
	}
	if err := json.Unmarshal(raw, &el); err != nil {
		return
	}

	switch el.Type {
	case "productCard":
		if p, ok := extractFromProductCard(el.ID, el.Props); ok {
			*out = append(*out, p)
		}
	case "productGrid":
		*out = append(*out, extractFromProductGrid(el.ID, el.Props)...)
	case "productListing":
		*out = append(*out, extractFromProductListing(el.ID, el.Props)...)
	case "productDetailHero":
		if p, ok := extractFromProductDetailHero(el.ID, el.Props); ok {
			*out = append(*out, p)
		}
	}

	// Container ise children'a in
	for _, child := range el.Children {
		walkElement(child, out)
	}
}

// ── Extractors (her element tipi için) ─────────────────────────────────────

// priceToCents — frontend ondalıklı sayı verir (ör. 299.99); kuruşa çevir
func priceToCents(v any) int64 {
	switch x := v.(type) {
	case float64:
		return int64(x*100 + 0.5)
	case int:
		return int64(x) * 100
	case int64:
		return x * 100
	case string:
		s := strings.TrimSpace(x)
		// "$590.00", "₺1.299,99", "590" gibi formatları destekle
		var cleaned strings.Builder
		hasDecimal := false
		for _, ch := range s {
			if ch >= '0' && ch <= '9' {
				cleaned.WriteRune(ch)
			} else if (ch == '.' || ch == ',') && !hasDecimal {
				// İlk gördüğümüz . veya , ondalık ayırıcı say
				cleaned.WriteRune('.')
				hasDecimal = true
			}
		}
		if cleaned.Len() == 0 {
			return 0
		}
		f, err := strconv.ParseFloat(cleaned.String(), 64)
		if err != nil {
			return 0
		}
		return int64(f*100 + 0.5)
	}
	return 0
}

func asString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func asFloat(v any) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case int:
		return float64(x)
	}
	return 0
}

func asInt(v any) int {
	switch x := v.(type) {
	case float64:
		return int(x)
	case int:
		return x
	}
	return 0
}

func extractFromProductCard(elemID string, props json.RawMessage) (extractedProduct, bool) {
	var p map[string]any
	if err := json.Unmarshal(props, &p); err != nil {
		return extractedProduct{}, false
	}
	title := strings.TrimSpace(asString(p["title"]))
	if title == "" {
		return extractedProduct{}, false
	}
	price := priceToCents(p["price"])
	if price <= 0 {
		return extractedProduct{}, false
	}
	out := extractedProduct{
		SourceElementID: "card:" + elemID,
		SourceType:      "productCard",
		Title:           title,
		Description:     asString(p["description"]),
		Price:           price,
		Currency:        defaultCurrencyFromSymbol(asString(p["currency"])),
		ImageURL:        asString(p["imageSrc"]),
		Badge:           asString(p["badge"]),
		Rating:          asFloat(p["rating"]),
		ReviewCount:     asInt(p["reviewCount"]),
	}
	if cp := priceToCents(p["comparePrice"]); cp > 0 && cp != price {
		out.ComparePrice = &cp
	}
	return out, true
}

func extractFromProductGrid(elemID string, props json.RawMessage) []extractedProduct {
	var p struct {
		Products []map[string]any `json:"products"`
	}
	if err := json.Unmarshal(props, &p); err != nil {
		return nil
	}
	out := make([]extractedProduct, 0, len(p.Products))
	for i, item := range p.Products {
		title := strings.TrimSpace(asString(item["title"]))
		if title == "" {
			continue
		}
		price := priceToCents(item["price"])
		if price <= 0 {
			continue
		}
		itemID := asString(item["id"])
		if itemID == "" {
			itemID = strconv.Itoa(i)
		}
		out = append(out, extractedProduct{
			SourceElementID: "grid:" + elemID + ":" + itemID,
			SourceType:      "productGrid",
			Title:           title,
			Price:           price,
			Currency:        "TRY",
			ImageURL:        asString(item["image"]),
			Badge:           asString(item["badge"]),
			Rating:          asFloat(item["rating"]),
		})
	}
	return out
}

func extractFromProductListing(elemID string, props json.RawMessage) []extractedProduct {
	var p struct {
		Products []map[string]any `json:"products"`
	}
	if err := json.Unmarshal(props, &p); err != nil {
		return nil
	}
	out := make([]extractedProduct, 0, len(p.Products))
	for i, item := range p.Products {
		title := strings.TrimSpace(asString(item["title"]))
		if title == "" {
			continue
		}
		price := priceToCents(item["price"])
		if price <= 0 {
			continue
		}
		itemID := asString(item["id"])
		if itemID == "" {
			itemID = strconv.Itoa(i)
		}
		out = append(out, extractedProduct{
			SourceElementID: "listing:" + elemID + ":" + itemID,
			SourceType:      "productListing",
			Title:           title,
			Description:     asString(item["color"]),
			Price:           price,
			Currency:        "TRY",
			ImageURL:        asString(item["imageSrc"]),
			Badge:           asString(item["badge"]),
		})
	}
	return out
}

func extractFromProductDetailHero(elemID string, props json.RawMessage) (extractedProduct, bool) {
	var p map[string]any
	if err := json.Unmarshal(props, &p); err != nil {
		return extractedProduct{}, false
	}
	title := strings.TrimSpace(asString(p["productName"]))
	if title == "" {
		return extractedProduct{}, false
	}
	price := priceToCents(p["price"])
	if price <= 0 {
		return extractedProduct{}, false
	}
	return extractedProduct{
		SourceElementID: "hero:" + elemID,
		SourceType:      "productDetailHero",
		Title:           title,
		Description:     asString(p["productDesc"]),
		Price:           price,
		Currency:        "TRY",
		ImageURL:        asString(p["imageSrc"]),
	}, true
}

func defaultCurrencyFromSymbol(sym string) string {
	switch sym {
	case "₺", "TRY", "":
		return "TRY"
	case "$", "USD":
		return "USD"
	case "€", "EUR":
		return "EUR"
	default:
		return "TRY"
	}
}
