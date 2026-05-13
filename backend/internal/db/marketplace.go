package db

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// ─── Tipler ───────────────────────────────────────────────────────────────────

type PublishedProduct struct {
	ID              string          `json:"id"`
	SiteID          string          `json:"site_id"`
	UserID          string          `json:"user_id"`
	SourceElementID string          `json:"source_element_id"`
	SourceType      string          `json:"source_type"`
	Title           string          `json:"title"`
	Slug            string          `json:"slug"`
	Description     *string         `json:"description,omitempty"`
	Price           int64           `json:"price"`
	ComparePrice    *int64          `json:"compare_price,omitempty"`
	Currency        string          `json:"currency"`
	ImageURL        *string         `json:"image_url,omitempty"`
	Images          json.RawMessage `json:"images"`
	Category        *string         `json:"category,omitempty"`
	Badge           *string         `json:"badge,omitempty"`
	Rating          float64         `json:"rating"`
	ReviewCount     int             `json:"review_count"`
	StockQuantity   int             `json:"stock_quantity"`
	StoreName       *string         `json:"store_name,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

type UpsertPublishedProductParams struct {
	SiteID          string
	UserID          string
	SourceElementID string
	SourceType      string
	Title           string
	Slug            string
	Description     string
	Price           int64
	ComparePrice    *int64
	Currency        string
	ImageURL        string
	Images          json.RawMessage
	Category        string
	Badge           string
	Rating          float64
	ReviewCount     int
	StoreName       string
}

type MarketplaceOrder struct {
	ID                    string          `json:"id"`
	OrderNumber           string          `json:"order_number"`
	BuyerID               *string         `json:"buyer_id,omitempty"`
	SiteID                *string         `json:"site_id,omitempty"`
	CustomerEmail         string          `json:"customer_email"`
	CustomerPhone         string          `json:"customer_phone"`
	CustomerName          string          `json:"customer_name"`
	Items                 json.RawMessage `json:"items"`
	Subtotal              int64           `json:"subtotal"`
	ShippingCost          int64           `json:"shipping_cost"`
	TotalAmount           int64           `json:"total_amount"`
	ShippingAddress       json.RawMessage `json:"shipping_address"`

	// Ödeme & Stripe
	PaymentStatus            string  `json:"payment_status"`
	StripePaymentIntentID    *string `json:"stripe_payment_intent_id,omitempty"`
	StripeTransferID         *string `json:"stripe_transfer_id,omitempty"`

	// Akış durumu
	Status          string  `json:"status"`            // confirmed | shipped | delivered | cancelled
	ApprovalStatus  string  `json:"approval_status"`   // pending_approval | approved | rejected
	EscrowStatus    string  `json:"escrow_status"`     // held | released | refunded
	RejectedReason  *string `json:"rejected_reason,omitempty"`

	// Kargo
	TrackingNumber *string    `json:"tracking_number,omitempty"`
	TrackingURL    *string    `json:"tracking_url,omitempty"`
	Carrier        *string    `json:"carrier,omitempty"`
	ShippedAt      *time.Time `json:"shipped_at,omitempty"`
	DeliveredAt    *time.Time `json:"delivered_at,omitempty"`
	EscrowReleasedAt *time.Time `json:"escrow_released_at,omitempty"`

	Notes     *string   `json:"notes,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateMarketplaceOrderParams struct {
	OrderNumber           string
	BuyerID               string // boş → guest order
	SiteID                string // sub-cart sahibi satıcının site_id'si (multi-seller split sonrası)
	CustomerEmail         string
	CustomerPhone         string
	CustomerName          string
	Items                 json.RawMessage
	Subtotal              int64
	ShippingCost          int64
	TotalAmount           int64
	ShippingAddress       json.RawMessage
	Notes                 string
	StripePaymentIntentID string // boş → simüle (Stripe yok)
}

// ─── Published Products Sorguları ──────────────────────────────────────────

// UpsertPublishedProduct — Site publish edildiğinde her ürün için çağrılır.
// (site_id, source_element_id) benzersizdir; ikinci kez geldiğinde günceller.
func (s *Store) UpsertPublishedProduct(ctx context.Context, p UpsertPublishedProductParams) (*PublishedProduct, error) {
	const q = `
		INSERT INTO published_products (
			site_id, user_id, source_element_id, source_type,
			title, slug, description, price, compare_price, currency,
			image_url, images, category, badge, rating, review_count, store_name
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		ON CONFLICT (site_id, source_element_id) DO UPDATE
		SET title = EXCLUDED.title,
		    slug = EXCLUDED.slug,
		    description = EXCLUDED.description,
		    price = EXCLUDED.price,
		    compare_price = EXCLUDED.compare_price,
		    currency = EXCLUDED.currency,
		    image_url = EXCLUDED.image_url,
		    images = EXCLUDED.images,
		    category = EXCLUDED.category,
		    badge = EXCLUDED.badge,
		    rating = EXCLUDED.rating,
		    review_count = EXCLUDED.review_count,
		    store_name = EXCLUDED.store_name,
		    updated_at = NOW()
		RETURNING id, site_id, user_id, source_element_id, source_type,
		          title, slug, description, price, compare_price, currency,
		          image_url, images, category, badge, rating, review_count,
		          stock_quantity, store_name, created_at, updated_at`

	images := p.Images
	if images == nil {
		images = json.RawMessage(`[]`)
	}

	var (
		description  any = p.Description
		imageURL     any = p.ImageURL
		category     any = p.Category
		badge        any = p.Badge
		storeName    any = p.StoreName
		comparePrice any = p.ComparePrice
	)
	if p.Description == "" {
		description = nil
	}
	if p.ImageURL == "" {
		imageURL = nil
	}
	if p.Category == "" {
		category = nil
	}
	if p.Badge == "" {
		badge = nil
	}
	if p.StoreName == "" {
		storeName = nil
	}

	row := s.pool.QueryRow(ctx, q,
		p.SiteID, p.UserID, p.SourceElementID, p.SourceType,
		p.Title, p.Slug, description, p.Price, comparePrice, p.Currency,
		imageURL, images, category, badge, p.Rating, p.ReviewCount, storeName,
	)
	return scanPublishedProduct(row)
}

// DeleteProductsBySite — Bir sitenin tüm publish edilmiş ürünlerini siler.
// Site unpublish edildiğinde / silindiğinde / yeniden publish öncesi çağrılır.
func (s *Store) DeletePublishedProductsBySite(ctx context.Context, siteID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM published_products WHERE site_id = $1`, siteID)
	return err
}

// DeletePublishedProductsBySiteExcept — Sync sırasında: sitedeki source_element_id'leri
// listesinde olmayanları temizle (silinmiş ürünler).
func (s *Store) DeletePublishedProductsBySiteExcept(ctx context.Context, siteID string, keepIDs []string) error {
	if len(keepIDs) == 0 {
		return s.DeletePublishedProductsBySite(ctx, siteID)
	}
	_, err := s.pool.Exec(ctx,
		`DELETE FROM published_products WHERE site_id = $1 AND source_element_id <> ALL($2)`,
		siteID, keepIDs)
	return err
}

// ListPublishedProducts — Marketplace ana listesi (filter + arama + sıralama).
type ListPublishedProductsParams struct {
	Search   string
	Category string
	Sort     string // popular | newest | price_asc | price_desc | rating
	Limit    int
	Offset   int
}

func (s *Store) ListPublishedProducts(ctx context.Context, p ListPublishedProductsParams) ([]PublishedProduct, int, error) {
	// Sıralama whitelist
	orderBy := "pp.created_at DESC"
	switch p.Sort {
	case "newest":
		orderBy = "pp.created_at DESC"
	case "price_asc":
		orderBy = "pp.price ASC"
	case "price_desc":
		orderBy = "pp.price DESC"
	case "rating":
		orderBy = "pp.rating DESC, pp.review_count DESC"
	case "popular":
		orderBy = "pp.review_count DESC, pp.rating DESC"
	}

	if p.Limit <= 0 || p.Limit > 100 {
		p.Limit = 24
	}

	// Sadece publish edilmiş sitelerden gelenler
	baseSQL := `
		FROM published_products pp
		JOIN sites s ON s.id = pp.site_id AND s.is_published = TRUE
		WHERE 1=1`
	args := []any{}
	idx := 1

	if p.Search != "" {
		baseSQL += fmt.Sprintf(" AND (pp.title ILIKE $%d OR pp.description ILIKE $%d)", idx, idx)
		args = append(args, "%"+p.Search+"%")
		idx++
	}
	if p.Category != "" && p.Category != "Tümü" {
		baseSQL += fmt.Sprintf(" AND pp.category = $%d", idx)
		args = append(args, p.Category)
		idx++
	}

	// Toplam say
	var total int
	if err := s.pool.QueryRow(ctx, "SELECT COUNT(*) "+baseSQL, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count: %w", err)
	}

	// Listele
	selectSQL := `
		SELECT pp.id, pp.site_id, pp.user_id, pp.source_element_id, pp.source_type,
		       pp.title, pp.slug, pp.description, pp.price, pp.compare_price, pp.currency,
		       pp.image_url, pp.images, pp.category, pp.badge, pp.rating, pp.review_count,
		       pp.stock_quantity, pp.store_name, pp.created_at, pp.updated_at
		` + baseSQL + ` ORDER BY ` + orderBy +
		fmt.Sprintf(" LIMIT $%d OFFSET $%d", idx, idx+1)
	args = append(args, p.Limit, p.Offset)

	rows, err := s.pool.Query(ctx, selectSQL, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()

	var out []PublishedProduct
	for rows.Next() {
		pp, err := scanPublishedProduct(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *pp)
	}
	return out, total, rows.Err()
}

// GetPublishedProductByID — Ürün detayı için
func (s *Store) GetPublishedProductByID(ctx context.Context, id string) (*PublishedProduct, error) {
	const q = `
		SELECT pp.id, pp.site_id, pp.user_id, pp.source_element_id, pp.source_type,
		       pp.title, pp.slug, pp.description, pp.price, pp.compare_price, pp.currency,
		       pp.image_url, pp.images, pp.category, pp.badge, pp.rating, pp.review_count,
		       pp.stock_quantity, pp.store_name, pp.created_at, pp.updated_at
		FROM published_products pp
		JOIN sites s ON s.id = pp.site_id AND s.is_published = TRUE
		WHERE pp.id = $1`

	row := s.pool.QueryRow(ctx, q, id)
	return scanPublishedProduct(row)
}

// ListPublishedCategories — Marketplace filtreleri için
func (s *Store) ListPublishedCategories(ctx context.Context) ([]string, error) {
	const q = `
		SELECT DISTINCT pp.category
		FROM published_products pp
		JOIN sites s ON s.id = pp.site_id AND s.is_published = TRUE
		WHERE pp.category IS NOT NULL AND pp.category <> ''
		ORDER BY pp.category`

	rows, err := s.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cats []string
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	return cats, rows.Err()
}

// ─── Marketplace Order Sorguları ───────────────────────────────────────────

// CreateMarketplaceOrder — auth'lu veya guest sipariş. Ödeme statüsü 'pending';
// gerçek ödeme webhook ile 'paid' yapılır. Stripe yapılandırılmamışsa SimulatePaid
// flag'i ile çağıran tarafta payment_status doğrudan 'paid' yazılabilir (caller'ın
// sorumluluğu, helper UpdateMarketplaceOrderPayment ile).
func (s *Store) CreateMarketplaceOrder(ctx context.Context, p CreateMarketplaceOrderParams) (*MarketplaceOrder, error) {
	const q = `
		INSERT INTO marketplace_orders (
			order_number, buyer_id, site_id,
			customer_email, customer_phone, customer_name,
			items, subtotal, shipping_cost, total_amount, shipping_address, notes,
			stripe_payment_intent_id,
			payment_status, status, approval_status, escrow_status
		) VALUES (
			$1, NULLIF($2,'')::UUID, NULLIF($3,'')::UUID,
			$4, $5, $6,
			$7, $8, $9, $10, $11, NULLIF($12,''),
			NULLIF($13,''),
			'pending', 'confirmed', 'pending_approval', 'held'
		)
		RETURNING id, order_number, buyer_id, site_id,
		          customer_email, customer_phone, customer_name,
		          items, subtotal, shipping_cost, total_amount, shipping_address,
		          payment_status, stripe_payment_intent_id, stripe_transfer_id,
		          status, approval_status, escrow_status, rejected_reason,
		          tracking_number, tracking_url, carrier,
		          shipped_at, delivered_at, escrow_released_at,
		          notes, created_at, updated_at`

	row := s.pool.QueryRow(ctx, q,
		p.OrderNumber, p.BuyerID, p.SiteID,
		p.CustomerEmail, p.CustomerPhone, p.CustomerName,
		p.Items, p.Subtotal, p.ShippingCost, p.TotalAmount, p.ShippingAddress, p.Notes,
		p.StripePaymentIntentID,
	)
	return scanMarketplaceOrder(row)
}

func (s *Store) GetMarketplaceOrderByNumber(ctx context.Context, orderNumber string) (*MarketplaceOrder, error) {
	row := s.pool.QueryRow(ctx, marketplaceOrderSelect+` WHERE order_number = $1`, orderNumber)
	return scanMarketplaceOrder(row)
}

// GetMarketplaceOrderByPaymentIntent — Stripe webhook'unda PI'dan order'a ulaşmak için.
func (s *Store) GetMarketplaceOrderByPaymentIntent(ctx context.Context, piID string) (*MarketplaceOrder, error) {
	row := s.pool.QueryRow(ctx, marketplaceOrderSelect+` WHERE stripe_payment_intent_id = $1`, piID)
	return scanMarketplaceOrder(row)
}

// ListMarketplaceOrdersBuyer — Buyer'ın sipariş geçmişi.
func (s *Store) ListMarketplaceOrdersBuyer(ctx context.Context, buyerID string) ([]MarketplaceOrder, error) {
	rows, err := s.pool.Query(ctx, marketplaceOrderSelect+` WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT 100`, buyerID)
	if err != nil {
		return nil, fmt.Errorf("ListMarketplaceOrdersBuyer: %w", err)
	}
	defer rows.Close()
	out := []MarketplaceOrder{}
	for rows.Next() {
		o, err := scanMarketplaceOrder(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *o)
	}
	return out, rows.Err()
}

// ListMarketplaceOrdersForSeller — Satıcının tüm site'larına gelen siparişler.
// status filtresi: "", "pending_approval", "confirmed", "shipped", "delivered", "cancelled"
func (s *Store) ListMarketplaceOrdersForSeller(ctx context.Context, sellerUserID, statusFilter string) ([]MarketplaceOrder, error) {
	args := []any{sellerUserID}
	query := marketplaceOrderSelect + `
		WHERE site_id IN (SELECT id FROM sites WHERE user_id = $1)`
	switch statusFilter {
	case "pending_approval":
		query += ` AND approval_status = 'pending_approval'`
	case "confirmed":
		query += ` AND approval_status = 'approved' AND status = 'confirmed'`
	case "shipped":
		query += ` AND status = 'shipped'`
	case "delivered":
		query += ` AND status = 'delivered'`
	case "cancelled":
		query += ` AND (approval_status = 'rejected' OR status = 'cancelled')`
	}
	query += ` ORDER BY created_at DESC LIMIT 200`

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("ListMarketplaceOrdersForSeller: %w", err)
	}
	defer rows.Close()
	out := []MarketplaceOrder{}
	for rows.Next() {
		o, err := scanMarketplaceOrder(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *o)
	}
	return out, rows.Err()
}

// CountMarketplaceOrdersPendingApprovalForSeller — sidebar badge.
func (s *Store) CountMarketplaceOrdersPendingApprovalForSeller(ctx context.Context, sellerUserID string) (int, error) {
	const q = `
		SELECT COUNT(*) FROM marketplace_orders
		WHERE site_id IN (SELECT id FROM sites WHERE user_id = $1)
		  AND approval_status = 'pending_approval'`
	var n int
	err := s.pool.QueryRow(ctx, q, sellerUserID).Scan(&n)
	return n, err
}

// GetMarketplaceOrderForSeller — ownership check + detay (site → user_id = me).
func (s *Store) GetMarketplaceOrderForSeller(ctx context.Context, orderID, sellerUserID string) (*MarketplaceOrder, error) {
	query := marketplaceOrderSelect + `
		WHERE id = $1 AND site_id IN (SELECT id FROM sites WHERE user_id = $2)`
	row := s.pool.QueryRow(ctx, query, orderID, sellerUserID)
	return scanMarketplaceOrder(row)
}

// UpdateMarketplaceOrderApproval — onay (approval='approved' + status korunur)
// veya red (approval='rejected', status='cancelled', escrow='refunded').
func (s *Store) UpdateMarketplaceOrderApproval(ctx context.Context, orderID, approval, status, escrowStatus, rejectedReason string) error {
	const q = `
		UPDATE marketplace_orders SET
			approval_status = $2,
			status          = COALESCE(NULLIF($3,''), status),
			escrow_status   = COALESCE(NULLIF($4,''), escrow_status),
			rejected_reason = NULLIF($5,''),
			updated_at      = NOW()
		WHERE id = $1`
	tag, err := s.pool.Exec(ctx, q, orderID, approval, status, escrowStatus, rejectedReason)
	if err != nil {
		return fmt.Errorf("UpdateMarketplaceOrderApproval: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// UpdateMarketplaceOrderShipping — Satıcı kargoya verdiğinde.
func (s *Store) UpdateMarketplaceOrderShipping(ctx context.Context, orderID, trackingNumber, trackingURL, carrier string) error {
	const q = `
		UPDATE marketplace_orders SET
			status          = 'shipped',
			tracking_number = NULLIF($2,''),
			tracking_url    = NULLIF($3,''),
			carrier         = NULLIF($4,''),
			shipped_at      = NOW(),
			updated_at      = NOW()
		WHERE id = $1`
	tag, err := s.pool.Exec(ctx, q, orderID, trackingNumber, trackingURL, carrier)
	if err != nil {
		return fmt.Errorf("UpdateMarketplaceOrderShipping: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// MarkMarketplaceOrderDelivered — Manuel teslim onayı (gelecekte EasyPost webhook ile otomatik).
func (s *Store) MarkMarketplaceOrderDelivered(ctx context.Context, orderID string) error {
	const q = `
		UPDATE marketplace_orders SET
			status = 'delivered',
			delivered_at = NOW(),
			updated_at = NOW()
		WHERE id = $1 AND status = 'shipped'`
	tag, err := s.pool.Exec(ctx, q, orderID)
	if err != nil {
		return fmt.Errorf("MarkMarketplaceOrderDelivered: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// MarkMarketplaceOrderEscrowReleased — Stripe Transfer başarılı olduktan sonra.
func (s *Store) MarkMarketplaceOrderEscrowReleased(ctx context.Context, orderID, transferID string) error {
	const q = `
		UPDATE marketplace_orders SET
			escrow_status      = 'released',
			escrow_released_at = NOW(),
			stripe_transfer_id = NULLIF($2,''),
			updated_at         = NOW()
		WHERE id = $1`
	tag, err := s.pool.Exec(ctx, q, orderID, transferID)
	if err != nil {
		return fmt.Errorf("MarkMarketplaceOrderEscrowReleased: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// MarkMarketplaceOrderPaidByID — Stripe yapılandırılmamışsa (test/dev) order'ı
// doğrudan paid işaretler. Caller bunu paymentIntent olmadan kullanır.
func (s *Store) MarkMarketplaceOrderPaidByID(ctx context.Context, orderID string) error {
	const q = `UPDATE marketplace_orders SET payment_status = 'paid', updated_at = NOW() WHERE id = $1`
	_, err := s.pool.Exec(ctx, q, orderID)
	return err
}

// MarkMarketplaceOrderPaid — Stripe webhook payment_intent.succeeded işler.
func (s *Store) MarkMarketplaceOrderPaid(ctx context.Context, paymentIntentID string) error {
	const q = `
		UPDATE marketplace_orders SET
			payment_status = 'paid',
			updated_at     = NOW()
		WHERE stripe_payment_intent_id = $1`
	tag, err := s.pool.Exec(ctx, q, paymentIntentID)
	if err != nil {
		return fmt.Errorf("MarkMarketplaceOrderPaid: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// MarkMarketplaceOrderRefunded — Stripe charge.refunded işler.
func (s *Store) MarkMarketplaceOrderRefunded(ctx context.Context, paymentIntentID string) error {
	const q = `
		UPDATE marketplace_orders SET
			payment_status = 'refunded',
			escrow_status  = 'refunded',
			status         = 'cancelled',
			updated_at     = NOW()
		WHERE stripe_payment_intent_id = $1`
	_, err := s.pool.Exec(ctx, q, paymentIntentID)
	if err != nil {
		return fmt.Errorf("MarkMarketplaceOrderRefunded: %w", err)
	}
	return nil
}

// SellerBalanceSummary — Bakiye sayfası için özet.
type SellerBalanceSummary struct {
	AvailableAmount    int64 `json:"available_amount"`     // escrow released — çekilebilir
	PendingAmount      int64 `json:"pending_amount"`       // escrow held — teslim sonrası bekliyor
	PlatformFeeTotal   int64 `json:"platform_fee_total"`   // alınan komisyon toplamı
	GrossRevenue       int64 `json:"gross_revenue"`        // satıcının paid siparişlerinin toplam tutarı
	OrderCount         int   `json:"order_count"`          // toplam paid sipariş sayısı
	StripeOnboarded    bool  `json:"stripe_onboarded"`
	StripeAccountID    string `json:"stripe_account_id,omitempty"`
	PlatformFeePercent int   `json:"platform_fee_percent"`
}

// GetSellerBalance — Satıcının marketplace üzerinden kazandığı bakiye.
// Şu an payouts tablosu yok; çekilebilir tutar = released - 0.
// platformFeePct çağıran tarafından geçilir (config'den).
func (s *Store) GetSellerBalance(ctx context.Context, sellerUserID string, platformFeePct int) (*SellerBalanceSummary, error) {
	if platformFeePct < 0 {
		platformFeePct = 0
	}
	const q = `
		WITH base AS (
			SELECT mo.total_amount, mo.escrow_status, mo.payment_status
			FROM marketplace_orders mo
			WHERE mo.site_id IN (SELECT id FROM sites WHERE user_id = $1)
			  AND mo.payment_status = 'paid'
			  AND (mo.approval_status = 'approved' OR mo.escrow_status = 'released')
		)
		SELECT
			COALESCE(SUM(CASE WHEN escrow_status = 'released' THEN total_amount * (100 - $2::int) / 100 END), 0)::BIGINT AS available,
			COALESCE(SUM(CASE WHEN escrow_status = 'held'     THEN total_amount * (100 - $2::int) / 100 END), 0)::BIGINT AS pending,
			COALESCE(SUM(total_amount * $2::int / 100), 0)::BIGINT AS platform_fee_total,
			COALESCE(SUM(total_amount), 0)::BIGINT AS gross,
			COUNT(*)::INT AS order_count
		FROM base`
	var sum SellerBalanceSummary
	err := s.pool.QueryRow(ctx, q, sellerUserID, platformFeePct).Scan(
		&sum.AvailableAmount, &sum.PendingAmount,
		&sum.PlatformFeeTotal, &sum.GrossRevenue, &sum.OrderCount,
	)
	if err != nil {
		return nil, fmt.Errorf("GetSellerBalance: %w", err)
	}
	sum.PlatformFeePercent = platformFeePct

	// Stripe Connect durumu — varsa
	const q2 = `
		SELECT sp.stripe_account_id, COALESCE(sp.stripe_onboarded, FALSE)
		FROM seller_profiles sp
		WHERE sp.user_id = $1`
	var (
		acc       *string
		onboarded bool
	)
	if err := s.pool.QueryRow(ctx, q2, sellerUserID).Scan(&acc, &onboarded); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("GetSellerBalance(profile): %w", err)
	}
	sum.StripeOnboarded = onboarded
	if acc != nil {
		sum.StripeAccountID = *acc
	}
	return &sum, nil
}

// GetSellerStripeAccountForSite — site_id'den satıcının seller_profiles.stripe_account_id'sini bulur.
// Yoksa nil döner; bu durumda destination charge yapmadan (platform tutar) PaymentIntent açılır.
func (s *Store) GetSellerStripeAccountForSite(ctx context.Context, siteID string) (string, bool, error) {
	const q = `
		SELECT sp.stripe_account_id, COALESCE(sp.stripe_onboarded, FALSE)
		FROM sites s
		LEFT JOIN seller_profiles sp ON sp.user_id = s.user_id
		WHERE s.id = $1`
	var (
		acc        *string
		onboarded  bool
	)
	err := s.pool.QueryRow(ctx, q, siteID).Scan(&acc, &onboarded)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", false, pgx.ErrNoRows
		}
		return "", false, fmt.Errorf("GetSellerStripeAccountForSite: %w", err)
	}
	if acc == nil || !onboarded {
		return "", false, nil
	}
	return *acc, true, nil
}

// ─── Select / Scan helpers ─────────────────────────────────────────────────

const marketplaceOrderSelect = `
	SELECT id, order_number, buyer_id, site_id,
	       customer_email, customer_phone, customer_name,
	       items, subtotal, shipping_cost, total_amount, shipping_address,
	       payment_status, stripe_payment_intent_id, stripe_transfer_id,
	       status, approval_status, escrow_status, rejected_reason,
	       tracking_number, tracking_url, carrier,
	       shipped_at, delivered_at, escrow_released_at,
	       notes, created_at, updated_at
	FROM marketplace_orders`

func scanMarketplaceOrder(row pgx.Row) (*MarketplaceOrder, error) {
	var o MarketplaceOrder
	err := row.Scan(
		&o.ID, &o.OrderNumber, &o.BuyerID, &o.SiteID,
		&o.CustomerEmail, &o.CustomerPhone, &o.CustomerName,
		&o.Items, &o.Subtotal, &o.ShippingCost, &o.TotalAmount, &o.ShippingAddress,
		&o.PaymentStatus, &o.StripePaymentIntentID, &o.StripeTransferID,
		&o.Status, &o.ApprovalStatus, &o.EscrowStatus, &o.RejectedReason,
		&o.TrackingNumber, &o.TrackingURL, &o.Carrier,
		&o.ShippedAt, &o.DeliveredAt, &o.EscrowReleasedAt,
		&o.Notes, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// ─── Yardımcı ─────────────────────────────────────────────────────────────

func scanPublishedProduct(row pgx.Row) (*PublishedProduct, error) {
	var pp PublishedProduct
	err := row.Scan(
		&pp.ID, &pp.SiteID, &pp.UserID, &pp.SourceElementID, &pp.SourceType,
		&pp.Title, &pp.Slug, &pp.Description, &pp.Price, &pp.ComparePrice, &pp.Currency,
		&pp.ImageURL, &pp.Images, &pp.Category, &pp.Badge, &pp.Rating, &pp.ReviewCount,
		&pp.StockQuantity, &pp.StoreName, &pp.CreatedAt, &pp.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scanPublishedProduct: %w", err)
	}
	return &pp, nil
}
