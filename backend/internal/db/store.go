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
	const q = `
		UPDATE sites
		SET is_published = TRUE, published_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND user_id = $2
		RETURNING id, user_id, title, description, thumbnail_url,
		          subdomain, custom_domain, site_data, is_published,
		          published_at, published_url, canvas_heights,
		          favicon_url, meta_title, meta_description,
		          created_at, updated_at`

	row := s.pool.QueryRow(ctx, q, id, userID)
	return scanSite(row)
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
