-- ═══════════════════════════════════════════════════════════════════════════════
-- MARKETPLACE MODÜLÜ — Publish edilmiş sitelerden çıkarılan ürünler
-- Platform DB Schema — v5 (Marketplace Extension)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Mimari notu:
--   Kullanıcılar editor'de ürün elementleri (productCard, productGrid,
--   productListing, productDetailHero) yerleştirir. Site publish edildiğinde
--   bu elementler "published_products" tablosuna sync edilir.
--   Marketplace yalnızca bu tablodaki ürünleri gösterir.

-- ─── 1. PUBLISH EDİLMİŞ ÜRÜNLER ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS published_products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Editor'deki kaynak element izi (sync için)
    source_element_id VARCHAR(200) NOT NULL,
    source_type       VARCHAR(50)  NOT NULL,  -- productCard | productGrid | productListing | productDetailHero

    -- Ürün bilgileri (editor element'ten çıkarılır)
    title           VARCHAR(500) NOT NULL,
    slug            VARCHAR(500) NOT NULL,
    description     TEXT,

    price           BIGINT NOT NULL CHECK (price >= 0),         -- kuruş
    compare_price   BIGINT,
    currency        VARCHAR(3) DEFAULT 'TRY',

    image_url       TEXT,
    images          JSONB DEFAULT '[]',

    category        VARCHAR(100),
    badge           VARCHAR(50),
    rating          NUMERIC(3,2) DEFAULT 0.00,
    review_count    INT DEFAULT 0,

    stock_quantity  INT DEFAULT 100,

    -- Mağaza ipucu (marketplace'te satıcı bilgisi gösterimi için)
    store_name      VARCHAR(255),

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(site_id, source_element_id)
);

CREATE INDEX IF NOT EXISTS idx_pub_products_site      ON published_products(site_id);
CREATE INDEX IF NOT EXISTS idx_pub_products_user      ON published_products(user_id);
CREATE INDEX IF NOT EXISTS idx_pub_products_category  ON published_products(category);
CREATE INDEX IF NOT EXISTS idx_pub_products_price     ON published_products(price);
CREATE INDEX IF NOT EXISTS idx_pub_products_created   ON published_products(created_at DESC);

-- ─── 2. MARKETPLACE SİPARİŞLERİ (Simülasyon ödeme) ─────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number    VARCHAR(50) NOT NULL UNIQUE,

    -- Alıcı bilgileri (guest checkout)
    customer_email  VARCHAR(255) NOT NULL,
    customer_phone  VARCHAR(20)  NOT NULL,
    customer_name   VARCHAR(255) NOT NULL,

    -- Sepet snapshot
    items           JSONB NOT NULL,
    -- [{"product_id":"...", "site_id":"...", "title":"...", "price":1500, "quantity":2, "image":"..."}]

    -- Fiyat
    subtotal        BIGINT NOT NULL,
    shipping_cost   BIGINT DEFAULT 0,
    total_amount    BIGINT NOT NULL,

    -- Adres
    shipping_address JSONB,

    -- Simüle ödeme durumu
    payment_status  VARCHAR(30) DEFAULT 'paid',     -- simüle: hep paid
    status          VARCHAR(30) DEFAULT 'confirmed',-- confirmed → processing → shipped → delivered

    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_orders_email   ON marketplace_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_mp_orders_number  ON marketplace_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_mp_orders_created ON marketplace_orders(created_at DESC);
