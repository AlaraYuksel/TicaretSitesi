package db

import (
	"context"
	"encoding/json"
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
	ID              string          `json:"id"`
	OrderNumber     string          `json:"order_number"`
	CustomerEmail   string          `json:"customer_email"`
	CustomerPhone   string          `json:"customer_phone"`
	CustomerName    string          `json:"customer_name"`
	Items           json.RawMessage `json:"items"`
	Subtotal        int64           `json:"subtotal"`
	ShippingCost    int64           `json:"shipping_cost"`
	TotalAmount     int64           `json:"total_amount"`
	ShippingAddress json.RawMessage `json:"shipping_address"`
	PaymentStatus   string          `json:"payment_status"`
	Status          string          `json:"status"`
	Notes           *string         `json:"notes,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

type CreateMarketplaceOrderParams struct {
	OrderNumber     string
	CustomerEmail   string
	CustomerPhone   string
	CustomerName    string
	Items           json.RawMessage
	Subtotal        int64
	ShippingCost    int64
	TotalAmount     int64
	ShippingAddress json.RawMessage
	Notes           string
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

func (s *Store) CreateMarketplaceOrder(ctx context.Context, p CreateMarketplaceOrderParams) (*MarketplaceOrder, error) {
	const q = `
		INSERT INTO marketplace_orders (
			order_number, customer_email, customer_phone, customer_name,
			items, subtotal, shipping_cost, total_amount, shipping_address, notes,
			payment_status, status
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'paid', 'confirmed')
		RETURNING id, order_number, customer_email, customer_phone, customer_name,
		          items, subtotal, shipping_cost, total_amount, shipping_address,
		          payment_status, status, notes, created_at, updated_at`

	var notes any = p.Notes
	if p.Notes == "" {
		notes = nil
	}

	row := s.pool.QueryRow(ctx, q,
		p.OrderNumber, p.CustomerEmail, p.CustomerPhone, p.CustomerName,
		p.Items, p.Subtotal, p.ShippingCost, p.TotalAmount, p.ShippingAddress, notes,
	)

	var o MarketplaceOrder
	err := row.Scan(
		&o.ID, &o.OrderNumber, &o.CustomerEmail, &o.CustomerPhone, &o.CustomerName,
		&o.Items, &o.Subtotal, &o.ShippingCost, &o.TotalAmount, &o.ShippingAddress,
		&o.PaymentStatus, &o.Status, &o.Notes, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("CreateMarketplaceOrder: %w", err)
	}
	return &o, nil
}

func (s *Store) GetMarketplaceOrderByNumber(ctx context.Context, orderNumber string) (*MarketplaceOrder, error) {
	const q = `
		SELECT id, order_number, customer_email, customer_phone, customer_name,
		       items, subtotal, shipping_cost, total_amount, shipping_address,
		       payment_status, status, notes, created_at, updated_at
		FROM marketplace_orders
		WHERE order_number = $1`

	row := s.pool.QueryRow(ctx, q, orderNumber)
	var o MarketplaceOrder
	err := row.Scan(
		&o.ID, &o.OrderNumber, &o.CustomerEmail, &o.CustomerPhone, &o.CustomerName,
		&o.Items, &o.Subtotal, &o.ShippingCost, &o.TotalAmount, &o.ShippingAddress,
		&o.PaymentStatus, &o.Status, &o.Notes, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("GetMarketplaceOrderByNumber: %w", err)
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
