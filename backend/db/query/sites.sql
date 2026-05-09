-- sqlc için sorgu dosyası — sites tablosu
-- `sqlc generate` komutu bu dosyayı okuyarak Go kodu üretir.
-- Şu an store.go içinde pgx ile manuel yazılmış versiyonlar var,
-- ilerleyen aşamada bu dosyalar kullanılabilir.

-- name: GetSiteByDomain :one
SELECT id, user_id, title, description, thumbnail_url,
       subdomain, custom_domain, site_data, is_published,
       published_at, published_url, canvas_heights,
       favicon_url, meta_title, meta_description,
       created_at, updated_at
FROM sites
WHERE (subdomain = $1 OR custom_domain = $2)
  AND is_published = TRUE
LIMIT 1;

-- name: GetSitesByUserID :many
SELECT id, user_id, title, description, thumbnail_url,
       subdomain, custom_domain, site_data, is_published,
       published_at, published_url, canvas_heights,
       favicon_url, meta_title, meta_description,
       created_at, updated_at
FROM sites
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: GetSiteByID :one
SELECT id, user_id, title, description, thumbnail_url,
       subdomain, custom_domain, site_data, is_published,
       published_at, published_url, canvas_heights,
       favicon_url, meta_title, meta_description,
       created_at, updated_at
FROM sites
WHERE id = $1 AND user_id = $2;

-- name: CreateSite :one
INSERT INTO sites (user_id, title, subdomain, site_data)
VALUES ($1, $2, $3, $4)
RETURNING id, user_id, title, description, thumbnail_url,
          subdomain, custom_domain, site_data, is_published,
          published_at, published_url, canvas_heights,
          favicon_url, meta_title, meta_description,
          created_at, updated_at;

-- name: UpdateSiteData :one
UPDATE sites
SET site_data = $3, updated_at = NOW()
WHERE id = $1 AND user_id = $2
RETURNING id, user_id, title, description, thumbnail_url,
          subdomain, custom_domain, site_data, is_published,
          published_at, published_url, canvas_heights,
          favicon_url, meta_title, meta_description,
          created_at, updated_at;

-- name: PublishSite :one
UPDATE sites
SET is_published = TRUE, published_at = NOW(), updated_at = NOW()
WHERE id = $1 AND user_id = $2
RETURNING id, user_id, title, description, thumbnail_url,
          subdomain, custom_domain, site_data, is_published,
          published_at, published_url, canvas_heights,
          favicon_url, meta_title, meta_description,
          created_at, updated_at;

-- name: DeleteSite :exec
DELETE FROM sites WHERE id = $1 AND user_id = $2;
