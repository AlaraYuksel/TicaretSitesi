package handler

import (
	"context"
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

// MarketplaceHandler — Publish edilmiş tüm sitelerin ürünlerini içeren marketplace.
type MarketplaceHandler struct {
	store *dbpkg.Store
}

func NewMarketplaceHandler(store *dbpkg.Store) *MarketplaceHandler {
	return &MarketplaceHandler{store: store}
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
func (h *MarketplaceHandler) GetProduct(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, err := uuid.Parse(id); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz ürün ID"})
		return
	}
	pp, err := h.store.GetPublishedProductByID(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Ürün bulunamadı"})
		return
	}
	writeJSON(w, http.StatusOK, toDTO(*pp))
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

// ─── Simüle Ödeme / Sipariş ────────────────────────────────────────────────

type marketplaceOrderItemReq struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
}

type marketplaceOrderReq struct {
	Customer GuestCustomerInfo       `json:"customer"`
	Items    []marketplaceOrderItemReq `json:"items"`
	Address  GuestShippingAddress    `json:"shipping_address"`
	Notes    string                  `json:"notes,omitempty"`
	// Simüle ödeme bilgileri (frontend'den gelir ama kullanılmaz — sadece doğrulama)
	PaymentMethod string `json:"payment_method"`
}

// CreateOrder — POST /api/marketplace/orders
// Simüle ödeme: kart bilgisi alınmaz, gerçek ödeme yapılmaz; sipariş "paid" olarak yaratılır.
func (h *MarketplaceHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var req marketplaceOrderReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek"})
		return
	}

	if !validateEmail(req.Customer.Email) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçerli bir e-posta adresi giriniz"})
		return
	}
	if !validatePhone(req.Customer.Phone) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçerli bir telefon numarası giriniz"})
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

	// Ürünleri DB'den çek → fiyat doğrulaması (client'a güvenme)
	type snapshotItem struct {
		ProductID string `json:"product_id"`
		SiteID    string `json:"site_id"`
		Title     string `json:"title"`
		Price     int64  `json:"price"`
		Quantity  int    `json:"quantity"`
		Image     string `json:"image"`
		Seller    string `json:"seller,omitempty"`
	}

	var snapshot []snapshotItem
	var subtotal int64
	for _, it := range req.Items {
		if it.Quantity <= 0 || it.Quantity > 100 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz miktar"})
			return
		}
		if _, err := uuid.Parse(it.ProductID); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz ürün ID"})
			return
		}
		pp, err := h.store.GetPublishedProductByID(r.Context(), it.ProductID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Ürün artık mevcut değil: " + it.ProductID})
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
		snapshot = append(snapshot, snapshotItem{
			ProductID: pp.ID, SiteID: pp.SiteID, Title: pp.Title,
			Price: pp.Price, Quantity: it.Quantity, Image: image, Seller: seller,
		})
		subtotal += pp.Price * int64(it.Quantity)
	}

	// Kargo: 5 TL, 200 TL üstü ücretsiz
	var shippingCost int64 = 500
	if subtotal >= 20000 {
		shippingCost = 0
	}
	total := subtotal + shippingCost

	itemsJSON, _ := json.Marshal(snapshot)
	addressJSON, _ := json.Marshal(req.Address)

	orderNumber := fmt.Sprintf("MP-%s-%s",
		time.Now().Format("20060102"),
		strings.ToUpper(uuid.New().String()[:6]),
	)

	order, err := h.store.CreateMarketplaceOrder(r.Context(), dbpkg.CreateMarketplaceOrderParams{
		OrderNumber:     orderNumber,
		CustomerEmail:   strings.ToLower(strings.TrimSpace(req.Customer.Email)),
		CustomerPhone:   cleanPhone(req.Customer.Phone),
		CustomerName:    strings.TrimSpace(req.Customer.Name),
		Items:           itemsJSON,
		Subtotal:        subtotal,
		ShippingCost:    shippingCost,
		TotalAmount:     total,
		ShippingAddress: addressJSON,
		Notes:           req.Notes,
	})
	if err != nil {
		log.Printf("CreateMarketplaceOrder: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Sipariş oluşturulamadı"})
		return
	}

	log.Printf("✅ Marketplace siparişi (simüle ödeme): %s total=%d kuruş",
		orderNumber, total)

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message":       "Siparişiniz oluşturuldu (simüle ödeme).",
		"order_number":  order.OrderNumber,
		"order_id":      order.ID,
		"subtotal":      subtotal,
		"shipping_cost": shippingCost,
		"total_amount":  total,
		"currency":      "TRY",
	})
}

// GetOrder — GET /api/marketplace/orders/{orderNumber}
func (h *MarketplaceHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
	orderNumber := r.PathValue("orderNumber")
	if orderNumber == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Sipariş numarası gerekli"})
		return
	}
	order, err := h.store.GetMarketplaceOrderByNumber(r.Context(), orderNumber)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Sipariş bulunamadı"})
		return
	}
	writeJSON(w, http.StatusOK, order)
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
func SyncPublishedProductsForSite(
	ctx context.Context,
	store *dbpkg.Store,
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

	// Sonra: upsert
	for _, p := range products {
		slug := generateSlug(p.Title)
		_, err := store.UpsertPublishedProduct(ctx, dbpkg.UpsertPublishedProductParams{
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
