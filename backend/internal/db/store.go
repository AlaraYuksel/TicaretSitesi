package db

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store tüm veritabanı işlemlerini kapsar.
// sqlc generate komutu çalıştırıldığında bu dosyanın yerini
// db/sqlc/ altındaki otomatik üretilen kod alabilir.
type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// ─── Tipler ───────────────────────────────────────────────────────────────────

type Site struct {
	ID             string          `json:"id"`
	UserID         string          `json:"user_id"`
	Title          string          `json:"title"`
	Description    *string         `json:"description,omitempty"`
	ThumbnailURL   *string         `json:"thumbnail_url,omitempty"`
	Subdomain      *string         `json:"subdomain,omitempty"`
	CustomDomain   *string         `json:"custom_domain,omitempty"`
	SiteData       json.RawMessage `json:"site_data"`
	IsPublished    bool            `json:"is_published"`
	PublishedAt    *time.Time      `json:"published_at,omitempty"`
	PublishedURL   *string         `json:"published_url,omitempty"`
	CanvasHeights  json.RawMessage `json:"canvas_heights,omitempty"`
	FaviconURL     *string         `json:"favicon_url,omitempty"`
	MetaTitle      *string         `json:"meta_title,omitempty"`
	MetaDescription *string        `json:"meta_description,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

type Page struct {
	ID         string          `json:"id"`
	SiteID     string          `json:"site_id"`
	Name       string          `json:"name"`
	Slug       string          `json:"slug"`
	Elements   json.RawMessage `json:"elements"`
	SortOrder  int             `json:"sort_order"`
	IsHomepage bool            `json:"is_homepage"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

type User struct {
	ID           string     `json:"id"`
	Email        string     `json:"email"`
	FullName     *string    `json:"full_name,omitempty"`
	AvatarURL    *string    `json:"avatar_url,omitempty"`
	Plan         string     `json:"plan"`
	StorageUsed  int64      `json:"storage_used"`
	StorageLimit int64      `json:"storage_limit"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`

	// 🔄 COGNITO_SWITCH: Lokal auth için. Cognito'da bu alan yok.
	PasswordHash *string    `json:"-"`
}

// ─── Site Sorguları ───────────────────────────────────────────────────────────

// GetSiteByDomain — domain routing'in kalbi.
// GET https://merhaba.websitedomaini.com geldiğinde çağrılır.
// subdomain = "merhaba" veya customDomain = "www.kullanici.com"
func (s *Store) GetSiteByDomain(ctx context.Context, subdomain, customDomain string) (*Site, error) {
	const q = `
		SELECT id, user_id, title, description, thumbnail_url,
		       subdomain, custom_domain, site_data, is_published,
		       published_at, published_url, canvas_heights,
		       favicon_url, meta_title, meta_description,
		       created_at, updated_at
		FROM sites
		WHERE (subdomain = $1 OR custom_domain = $2)
		  AND is_published = TRUE
		LIMIT 1`

	row := s.pool.QueryRow(ctx, q, subdomain, customDomain)
	return scanSite(row)
}

func (s *Store) GetSitesByUserID(ctx context.Context, userID string) ([]Site, error) {
	const q = `
		SELECT id, user_id, title, description, thumbnail_url,
		       subdomain, custom_domain, site_data, is_published,
		       published_at, published_url, canvas_heights,
		       favicon_url, meta_title, meta_description,
		       created_at, updated_at
		FROM sites
		WHERE user_id = $1
		ORDER BY created_at DESC`

	rows, err := s.pool.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("GetSitesByUserID: %w", err)
	}
	defer rows.Close()

	var sites []Site
	for rows.Next() {
		site, err := scanSite(rows)
		if err != nil {
			return nil, err
		}
		sites = append(sites, *site)
	}
	return sites, rows.Err()
}

func (s *Store) GetSiteByID(ctx context.Context, id, userID string) (*Site, error) {
	const q = `
		SELECT id, user_id, title, description, thumbnail_url,
		       subdomain, custom_domain, site_data, is_published,
		       published_at, published_url, canvas_heights,
		       favicon_url, meta_title, meta_description,
		       created_at, updated_at
		FROM sites
		WHERE id = $1 AND user_id = $2`

	row := s.pool.QueryRow(ctx, q, id, userID)
	return scanSite(row)
}

type CreateSiteParams struct {
	UserID      string
	Title       string
	Subdomain   *string
	SiteData    json.RawMessage
}

func (s *Store) CreateSite(ctx context.Context, p CreateSiteParams) (*Site, error) {
	const q = `
		INSERT INTO sites (user_id, title, subdomain, site_data)
		VALUES ($1, $2, $3, $4)
		RETURNING id, user_id, title, description, thumbnail_url,
		          subdomain, custom_domain, site_data, is_published,
		          published_at, published_url, canvas_heights,
		          favicon_url, meta_title, meta_description,
		          created_at, updated_at`

	siteData := p.SiteData
	if siteData == nil {
		siteData = json.RawMessage(`{"pages":[]}`)
	}

	row := s.pool.QueryRow(ctx, q, p.UserID, p.Title, p.Subdomain, siteData)
	return scanSite(row)
}

type UpdateSiteDataParams struct {
	ID       string
	UserID   string
	SiteData json.RawMessage
}

func (s *Store) UpdateSiteData(ctx context.Context, p UpdateSiteDataParams) (*Site, error) {
	const q = `
		UPDATE sites
		SET site_data = $3, updated_at = NOW()
		WHERE id = $1 AND user_id = $2
		RETURNING id, user_id, title, description, thumbnail_url,
		          subdomain, custom_domain, site_data, is_published,
		          published_at, published_url, canvas_heights,
		          favicon_url, meta_title, meta_description,
		          created_at, updated_at`

	row := s.pool.QueryRow(ctx, q, p.ID, p.UserID, p.SiteData)
	return scanSite(row)
}

func (s *Store) PublishSite(ctx context.Context, id, userID string) (*Site, error) {
	// "Bir kullanıcı yalnızca tek bir site yayınlayabilir" kuralı:
	// Önce bu kullanıcının diğer yayınlanmış sitelerini unpublish et ve
	// ürünlerini marketplace'ten temizle. Sonra bu siteyi yayınla.
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("PublishSite begin: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1) Diğer publish edilmiş sitelerin id'sini al
	rows, err := tx.Query(ctx,
		`SELECT id FROM sites WHERE user_id = $1 AND is_published = TRUE AND id <> $2`,
		userID, id)
	if err != nil {
		return nil, fmt.Errorf("PublishSite list other: %w", err)
	}
	var otherIDs []string
	for rows.Next() {
		var sid string
		if err := rows.Scan(&sid); err != nil {
			rows.Close()
			return nil, err
		}
		otherIDs = append(otherIDs, sid)
	}
	rows.Close()

	// 2) Diğer siteleri unpublish + ürünlerini temizle
	for _, sid := range otherIDs {
		if _, err := tx.Exec(ctx,
			`UPDATE sites SET is_published = FALSE, published_at = NULL, updated_at = NOW()
			 WHERE id = $1 AND user_id = $2`, sid, userID); err != nil {
			return nil, fmt.Errorf("PublishSite unpublish other: %w", err)
		}
		if _, err := tx.Exec(ctx,
			`DELETE FROM published_products WHERE site_id = $1`, sid); err != nil {
			return nil, fmt.Errorf("PublishSite clean other products: %w", err)
		}
	}

	// 3) Bu siteyi yayınla
	const q = `
		UPDATE sites
		SET is_published = TRUE, published_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND user_id = $2
		RETURNING id, user_id, title, description, thumbnail_url,
		          subdomain, custom_domain, site_data, is_published,
		          published_at, published_url, canvas_heights,
		          favicon_url, meta_title, meta_description,
		          created_at, updated_at`

	row := tx.QueryRow(ctx, q, id, userID)
	site, err := scanSite(row)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("PublishSite commit: %w", err)
	}
	return site, nil
}

// UnpublishSite — siteyi yayından kaldırır ve marketplace'teki ürünlerini temizler.
func (s *Store) UnpublishSite(ctx context.Context, id, userID string) (*Site, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("UnpublishSite begin: %w", err)
	}
	defer tx.Rollback(ctx)

	const q = `
		UPDATE sites
		SET is_published = FALSE, published_at = NULL, updated_at = NOW()
		WHERE id = $1 AND user_id = $2
		RETURNING id, user_id, title, description, thumbnail_url,
		          subdomain, custom_domain, site_data, is_published,
		          published_at, published_url, canvas_heights,
		          favicon_url, meta_title, meta_description,
		          created_at, updated_at`

	row := tx.QueryRow(ctx, q, id, userID)
	site, err := scanSite(row)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx,
		`DELETE FROM published_products WHERE site_id = $1`, id); err != nil {
		return nil, fmt.Errorf("UnpublishSite clean products: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return site, nil
}

func (s *Store) DeleteSite(ctx context.Context, id, userID string) error {
	const q = `DELETE FROM sites WHERE id = $1 AND user_id = $2`
	tag, err := s.pool.Exec(ctx, q, id, userID)
	if err != nil {
		return fmt.Errorf("DeleteSite: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("site bulunamadı veya yetki yok")
	}
	return nil
}

// ─── Page Sorguları ───────────────────────────────────────────────────────────

func (s *Store) GetPagesBySiteID(ctx context.Context, siteID, userID string) ([]Page, error) {
	const q = `
		SELECT p.id, p.site_id, p.name, p.slug, p.elements,
		       p.sort_order, p.is_homepage, p.created_at, p.updated_at
		FROM pages p
		JOIN sites s ON s.id = p.site_id
		WHERE p.site_id = $1 AND s.user_id = $2
		ORDER BY p.sort_order ASC`

	rows, err := s.pool.Query(ctx, q, siteID, userID)
	if err != nil {
		return nil, fmt.Errorf("GetPagesBySiteID: %w", err)
	}
	defer rows.Close()

	var pages []Page
	for rows.Next() {
		var p Page
		if err := rows.Scan(
			&p.ID, &p.SiteID, &p.Name, &p.Slug, &p.Elements,
			&p.SortOrder, &p.IsHomepage, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		pages = append(pages, p)
	}
	return pages, rows.Err()
}

type UpsertPageParams struct {
	SiteID     string
	Name       string
	Slug       string
	Elements   json.RawMessage
	SortOrder  int
	IsHomepage bool
}

func (s *Store) UpsertPage(ctx context.Context, p UpsertPageParams) (*Page, error) {
	const q = `
		INSERT INTO pages (site_id, name, slug, elements, sort_order, is_homepage)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (site_id, slug) DO UPDATE
		SET name = EXCLUDED.name,
		    elements = EXCLUDED.elements,
		    sort_order = EXCLUDED.sort_order,
		    is_homepage = EXCLUDED.is_homepage,
		    updated_at = NOW()
		RETURNING id, site_id, name, slug, elements, sort_order, is_homepage, created_at, updated_at`

	row := s.pool.QueryRow(ctx, q,
		p.SiteID, p.Name, p.Slug, p.Elements, p.SortOrder, p.IsHomepage,
	)

	var page Page
	err := row.Scan(
		&page.ID, &page.SiteID, &page.Name, &page.Slug, &page.Elements,
		&page.SortOrder, &page.IsHomepage, &page.CreatedAt, &page.UpdatedAt,
	)
	return &page, err
}

// ─── User Sorguları ───────────────────────────────────────────────────────────

// UpsertUser — Cognito ile giriş yapan kullanıcıyı DB'de oluşturur veya günceller.
// Cognito sub claim'i user ID olarak kullanılır.
func (s *Store) UpsertUser(ctx context.Context, cognitoSub, email string) (*User, error) {
	const q = `
		INSERT INTO users (id, email)
		VALUES ($1, $2)
		ON CONFLICT (id) DO UPDATE
		SET email = EXCLUDED.email, updated_at = NOW()
		RETURNING id, email, full_name, avatar_url, plan,
		          storage_used, storage_limit, created_at, updated_at`

	row := s.pool.QueryRow(ctx, q, cognitoSub, email)
	var u User
	err := row.Scan(
		&u.ID, &u.Email, &u.FullName, &u.AvatarURL, &u.Plan,
		&u.StorageUsed, &u.StorageLimit, &u.CreatedAt, &u.UpdatedAt,
	)
	return &u, err
}

// ─── 🔄 COGNITO_SWITCH: Lokal Auth Sorguları ─────────────────────────────────
// Cognito'ya geçildiğinde aşağıdaki iki fonksiyon kaldırılabilir.

// CreateUserLocal — Lokal kayıt (register). Bcrypt hash'lenmiş parola ile kullanıcı oluşturur.
func (s *Store) CreateUserLocal(ctx context.Context, email, passwordHash string) (*User, error) {
	const q = `
		INSERT INTO users (email, password_hash)
		VALUES ($1, $2)
		RETURNING id, email, full_name, avatar_url, plan,
		          storage_used, storage_limit, created_at, updated_at`

	row := s.pool.QueryRow(ctx, q, email, passwordHash)
	var u User
	err := row.Scan(
		&u.ID, &u.Email, &u.FullName, &u.AvatarURL, &u.Plan,
		&u.StorageUsed, &u.StorageLimit, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("CreateUserLocal: %w", err)
	}
	return &u, nil
}

// GetUserByEmail — Lokal login. Email ile kullanıcı arar, password_hash döner.
func (s *Store) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	const q = `
		SELECT id, email, full_name, avatar_url, plan,
		       storage_used, storage_limit, created_at, updated_at,
		       password_hash
		FROM users
		WHERE email = $1`

	row := s.pool.QueryRow(ctx, q, email)
	var u User
	err := row.Scan(
		&u.ID, &u.Email, &u.FullName, &u.AvatarURL, &u.Plan,
		&u.StorageUsed, &u.StorageLimit, &u.CreatedAt, &u.UpdatedAt,
		&u.PasswordHash,
	)
	if err != nil {
		return nil, fmt.Errorf("GetUserByEmail: %w", err)
	}
	return &u, nil
}

// GetUserByID — Token'dan gelen user ID ile kullanıcıyı getirir.
func (s *Store) GetUserByID(ctx context.Context, id string) (*User, error) {
	const q = `
		SELECT id, email, full_name, avatar_url, plan,
		       storage_used, storage_limit, created_at, updated_at
		FROM users
		WHERE id = $1`

	row := s.pool.QueryRow(ctx, q, id)
	var u User
	err := row.Scan(
		&u.ID, &u.Email, &u.FullName, &u.AvatarURL, &u.Plan,
		&u.StorageUsed, &u.StorageLimit, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("GetUserByID: %w", err)
	}
	return &u, nil
}

// ─── Storefront Tipleri ──────────────────────────────────────────────────────

type GuestOrder struct {
	ID              string          `json:"id"`
	SiteID          string          `json:"site_id"`
	OrderNumber     string          `json:"order_number"`
	CustomerEmail   string          `json:"customer_email"`
	CustomerPhone   string          `json:"customer_phone"`
	CustomerName    string          `json:"customer_name"`
	Items           json.RawMessage `json:"items"`
	Subtotal        int64           `json:"subtotal"`
	ShippingCost    int64           `json:"shipping_cost"`
	TaxAmount       int64           `json:"tax_amount"`
	TotalAmount     int64           `json:"total_amount"`
	ShippingAddress json.RawMessage `json:"shipping_address"`
	Status          string          `json:"status"`
	PaymentStatus   string          `json:"payment_status"`
	TrackingNumber  string          `json:"tracking_number"`
	TrackingURL     string          `json:"tracking_url"`
	Carrier         string          `json:"carrier"`
	PaidAt          *time.Time      `json:"paid_at"`
	ShippedAt       *time.Time      `json:"shipped_at"`
	DeliveredAt     *time.Time      `json:"delivered_at"`
	CancelledAt     *time.Time      `json:"cancelled_at"`
	Notes           *string         `json:"notes"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

type CreateGuestOrderParams struct {
	SiteID        string
	OrderNumber   string
	CustomerEmail string
	CustomerPhone string
	CustomerName  string
	Items         json.RawMessage
	Subtotal      int64
	ShippingCost  int64
	TaxAmount     int64
	TotalAmount   int64
	Address       json.RawMessage
}

type OTPCode struct {
	ID          string    `json:"id"`
	Identifier  string    `json:"identifier"`
	Code        string    `json:"code"`
	Purpose     string    `json:"purpose"`
	Attempts    int       `json:"attempts"`
	MaxAttempts int       `json:"max_attempts"`
	Verified    bool      `json:"verified"`
	ExpiresAt   time.Time `json:"expires_at"`
	CreatedAt   time.Time `json:"created_at"`
}

type CreateOTPParams struct {
	Identifier string
	Code       string
	Purpose    string
	ExpiresAt  time.Time
}

// ─── Storefront Sorguları ────────────────────────────────────────────────────

func (s *Store) CreateGuestOrder(ctx context.Context, p CreateGuestOrderParams) (*GuestOrder, error) {
	const q = `
		INSERT INTO guest_orders (
			site_id, order_number, customer_email, customer_phone, customer_name,
			items, subtotal, shipping_cost, tax_amount, total_amount,
			shipping_address, status, payment_status
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', 'pending')
		RETURNING id, site_id, order_number, customer_email, customer_phone, customer_name,
			items, subtotal, shipping_cost, tax_amount, total_amount,
			shipping_address, status, payment_status,
			COALESCE(tracking_number, ''), COALESCE(tracking_url, ''), COALESCE(carrier, ''),
			paid_at, shipped_at, delivered_at, cancelled_at, notes,
			created_at, updated_at`

	row := s.pool.QueryRow(ctx, q,
		p.SiteID, p.OrderNumber, p.CustomerEmail, p.CustomerPhone, p.CustomerName,
		p.Items, p.Subtotal, p.ShippingCost, p.TaxAmount, p.TotalAmount, p.Address,
	)
	return scanGuestOrder(row)
}

func (s *Store) GetGuestOrderByNumber(ctx context.Context, orderNumber string) (*GuestOrder, error) {
	const q = `
		SELECT id, site_id, order_number, customer_email, customer_phone, customer_name,
			items, subtotal, shipping_cost, tax_amount, total_amount,
			shipping_address, status, payment_status,
			COALESCE(tracking_number, ''), COALESCE(tracking_url, ''), COALESCE(carrier, ''),
			paid_at, shipped_at, delivered_at, cancelled_at, notes,
			created_at, updated_at
		FROM guest_orders WHERE order_number = $1`

	row := s.pool.QueryRow(ctx, q, orderNumber)
	return scanGuestOrder(row)
}

func (s *Store) ListGuestOrdersByEmailAndPhone(ctx context.Context, email, phone string) ([]GuestOrder, error) {
	const q = `
		SELECT id, site_id, order_number, customer_email, customer_phone, customer_name,
			items, subtotal, shipping_cost, tax_amount, total_amount,
			shipping_address, status, payment_status,
			COALESCE(tracking_number, ''), COALESCE(tracking_url, ''), COALESCE(carrier, ''),
			paid_at, shipped_at, delivered_at, cancelled_at, notes,
			created_at, updated_at
		FROM guest_orders
		WHERE customer_email = $1 AND customer_phone = $2
		ORDER BY created_at DESC`

	rows, err := s.pool.Query(ctx, q, email, phone)
	if err != nil {
		return nil, fmt.Errorf("ListGuestOrdersByEmailAndPhone: %w", err)
	}
	defer rows.Close()

	var orders []GuestOrder
	for rows.Next() {
		o, err := scanGuestOrder(rows)
		if err != nil {
			return nil, err
		}
		orders = append(orders, *o)
	}
	return orders, rows.Err()
}

func (s *Store) ListGuestOrdersBySite(ctx context.Context, siteID string, limit, offset int) ([]GuestOrder, error) {
	const q = `
		SELECT id, site_id, order_number, customer_email, customer_phone, customer_name,
			items, subtotal, shipping_cost, tax_amount, total_amount,
			shipping_address, status, payment_status,
			COALESCE(tracking_number, ''), COALESCE(tracking_url, ''), COALESCE(carrier, ''),
			paid_at, shipped_at, delivered_at, cancelled_at, notes,
			created_at, updated_at
		FROM guest_orders
		WHERE site_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := s.pool.Query(ctx, q, siteID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("ListGuestOrdersBySite: %w", err)
	}
	defer rows.Close()

	var orders []GuestOrder
	for rows.Next() {
		o, err := scanGuestOrder(rows)
		if err != nil {
			return nil, err
		}
		orders = append(orders, *o)
	}
	return orders, rows.Err()
}

// ─── OTP Sorguları ───────────────────────────────────────────────────────────

func (s *Store) CreateOTP(ctx context.Context, p CreateOTPParams) (*OTPCode, error) {
	const q = `
		INSERT INTO otp_codes (identifier, code, purpose, expires_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id, identifier, code, purpose, attempts, max_attempts, verified, expires_at, created_at`

	row := s.pool.QueryRow(ctx, q, p.Identifier, p.Code, p.Purpose, p.ExpiresAt)
	var otp OTPCode
	err := row.Scan(
		&otp.ID, &otp.Identifier, &otp.Code, &otp.Purpose,
		&otp.Attempts, &otp.MaxAttempts, &otp.Verified,
		&otp.ExpiresAt, &otp.CreatedAt,
	)
	return &otp, err
}

func (s *Store) GetActiveOTP(ctx context.Context, identifier, purpose string) (*OTPCode, error) {
	const q = `
		SELECT id, identifier, code, purpose, attempts, max_attempts, verified, expires_at, created_at
		FROM otp_codes
		WHERE identifier = $1 AND purpose = $2
		  AND verified = FALSE AND attempts < max_attempts
		  AND expires_at > NOW()
		ORDER BY created_at DESC
		LIMIT 1`

	row := s.pool.QueryRow(ctx, q, identifier, purpose)
	var otp OTPCode
	err := row.Scan(
		&otp.ID, &otp.Identifier, &otp.Code, &otp.Purpose,
		&otp.Attempts, &otp.MaxAttempts, &otp.Verified,
		&otp.ExpiresAt, &otp.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("GetActiveOTP: %w", err)
	}
	return &otp, nil
}

func (s *Store) IncrementOTPAttempts(ctx context.Context, id string) {
	s.pool.Exec(ctx, `UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, id)
}

func (s *Store) VerifyOTP(ctx context.Context, id string) {
	s.pool.Exec(ctx, `UPDATE otp_codes SET verified = TRUE WHERE id = $1`, id)
}

// ─── Yardımcı Fonksiyonlar ───────────────────────────────────────────────────

// scanSite hem pgx.Row hem pgx.Rows'u okuyabilmek için pgx.Row interface'i kullanır.
func scanSite(row pgx.Row) (*Site, error) {
	var site Site
	err := row.Scan(
		&site.ID, &site.UserID, &site.Title, &site.Description, &site.ThumbnailURL,
		&site.Subdomain, &site.CustomDomain, &site.SiteData, &site.IsPublished,
		&site.PublishedAt, &site.PublishedURL, &site.CanvasHeights,
		&site.FaviconURL, &site.MetaTitle, &site.MetaDescription,
		&site.CreatedAt, &site.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scanSite: %w", err)
	}
	return &site, nil
}

func scanGuestOrder(row pgx.Row) (*GuestOrder, error) {
	var o GuestOrder
	err := row.Scan(
		&o.ID, &o.SiteID, &o.OrderNumber, &o.CustomerEmail, &o.CustomerPhone, &o.CustomerName,
		&o.Items, &o.Subtotal, &o.ShippingCost, &o.TaxAmount, &o.TotalAmount,
		&o.ShippingAddress, &o.Status, &o.PaymentStatus,
		&o.TrackingNumber, &o.TrackingURL, &o.Carrier,
		&o.PaidAt, &o.ShippedAt, &o.DeliveredAt, &o.CancelledAt, &o.Notes,
		&o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scanGuestOrder: %w", err)
	}
	return &o, nil
}
