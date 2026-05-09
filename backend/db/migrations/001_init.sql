-- ═══════════════════════════════════════════════════════════════════════════════
-- Platform DB Schema — v1
-- Driver: pgx/v5 | Docker: postgres:16-alpine
-- Bu dosya docker-compose.yml'de /docker-entrypoint-initdb.d/'a mount edilir.
-- İlk container başladığında otomatik çalışır.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. KULLANICILAR ─────────────────────────────────────────────────────────
-- id: Cognito sub claim ile aynı UUID — harici ID, sıralı değil.
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY,                    -- Cognito sub claim
    email         VARCHAR(255) UNIQUE NOT NULL,
    full_name     VARCHAR(255),
    avatar_url    TEXT,
    plan          VARCHAR(50)  DEFAULT 'free',         -- free | pro | business
    storage_used  BIGINT       DEFAULT 0,              -- bytes
    storage_limit BIGINT       DEFAULT 10737418240,    -- 10 GB
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── 2. SİTELER ──────────────────────────────────────────────────────────────
-- site_data: Frontend'in { pages: [...] } JSON export'uyla birebir uyumlu JSONB
CREATE TABLE IF NOT EXISTS sites (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Temel bilgiler
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    thumbnail_url    TEXT,

    -- Domain sistemi
    -- subdomain = "merhaba" → merhaba.websitedomaini.com
    subdomain        VARCHAR(63)  UNIQUE,
    custom_domain    VARCHAR(255) UNIQUE,              -- www.kullanicinin-domaini.com

    -- İçerik (frontend JSON export formatı)
    site_data        JSONB NOT NULL DEFAULT '{"pages":[]}',

    -- Yayınlama
    is_published     BOOLEAN      DEFAULT FALSE,
    published_at     TIMESTAMPTZ,
    published_url    TEXT,

    -- Editor ayarları
    canvas_heights   JSONB        DEFAULT '{"desktop":900,"tablet":900,"mobile":900}',

    -- SEO
    favicon_url      TEXT,
    meta_title       VARCHAR(255),
    meta_description TEXT,

    created_at       TIMESTAMPTZ  DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── 3. SAYFALAR ─────────────────────────────────────────────────────────────
-- Sayfalar hem site_data JSONB içinde hem de bu tabloda tutulabilir.
-- Bu tablo granüler sayfa erişimi ve sıralama için kullanılır.
CREATE TABLE IF NOT EXISTS pages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(255) NOT NULL DEFAULT '/',     -- /, /hakkinda, /iletisim
    elements    JSONB        NOT NULL DEFAULT '[]',    -- Element dizisi
    sort_order  INT          DEFAULT 0,
    is_homepage BOOLEAN      DEFAULT FALSE,
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE(site_id, slug)
);

-- ─── 4. MEDYA ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    site_id     UUID          REFERENCES sites(id)  ON DELETE SET NULL,
    filename    VARCHAR(255) NOT NULL,
    mime_type   VARCHAR(100) NOT NULL,
    file_size   BIGINT       NOT NULL,               -- bytes
    url         TEXT         NOT NULL,               -- S3 / CDN URL
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── 5. İNDEKSLER ────────────────────────────────────────────────────────────
-- Partial index: subdomain/custom_domain araması sadece dolu kayıtlarda yapılır.
CREATE INDEX IF NOT EXISTS idx_sites_subdomain     ON sites(subdomain)    WHERE subdomain    IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sites_custom_domain ON sites(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sites_user_id       ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_sites_published     ON sites(is_published) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_pages_site_id       ON pages(site_id);
CREATE INDEX IF NOT EXISTS idx_pages_sort          ON pages(site_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_media_user_id       ON media(user_id);
CREATE INDEX IF NOT EXISTS idx_media_site_id       ON media(site_id);
