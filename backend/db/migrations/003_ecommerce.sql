-- ═══════════════════════════════════════════════════════════════════════════════
-- E-TİCARET MODÜLÜ — Ürünler, Siparişler, Satıcılar, İşlemler
-- Platform DB Schema — v3 (E-Commerce Extension)
-- ═══════════════════════════════════════════════════════════════════════════════

-- pgvector eklentisi (RDS'te otomatik mevcut, lokal Docker'da yüklenmeli)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 1. SATICI PROFİLLERİ ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_profiles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Mağaza bilgileri
    store_name        VARCHAR(255) NOT NULL,
    store_slug        VARCHAR(63) UNIQUE NOT NULL,       -- url-friendly isim
    store_description TEXT,
    logo_url          TEXT,
    banner_url        TEXT,

    -- Stripe Connect
    stripe_account_id VARCHAR(255),                       -- acct_xxx
    stripe_onboarded  BOOLEAN DEFAULT FALSE,
    payout_enabled    BOOLEAN DEFAULT FALSE,

    -- EasyPost
    easypost_api_key  TEXT,                               -- satıcıya özel key (opsiyonel)

    -- İstatistikler (cache — periyodik güncelleme)
    total_sales       BIGINT  DEFAULT 0,
    total_revenue     BIGINT  DEFAULT 0,                  -- kuruş cinsinden
    rating_avg        NUMERIC(3,2) DEFAULT 0.00,
    rating_count      INT     DEFAULT 0,

    is_active         BOOLEAN DEFAULT TRUE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. KATEGORİLER ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    slug       VARCHAR(255) UNIQUE NOT NULL,
    parent_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
    icon       VARCHAR(50),                               -- emoji veya icon adı
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. ÜRÜNLER ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id       UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,

    -- Temel bilgiler
    title           VARCHAR(500) NOT NULL,
    slug            VARCHAR(500) NOT NULL,
    description     TEXT,
    short_desc      VARCHAR(500),

    -- Fiyatlandırma (kuruş cinsinden — tam sayı aritmetiği)
    price           BIGINT NOT NULL CHECK (price >= 0),
    compare_price   BIGINT,                               -- "indirimli" gösterim için
    currency        VARCHAR(3) DEFAULT 'TRY',

    -- Stok
    sku             VARCHAR(100),
    stock_quantity  INT DEFAULT 0,
    track_inventory BOOLEAN DEFAULT TRUE,
    allow_backorder BOOLEAN DEFAULT FALSE,

    -- Fiziksel ürün bilgileri (kargo hesaplama)
    weight_grams    INT,
    length_cm       NUMERIC(8,2),
    width_cm        NUMERIC(8,2),
    height_cm       NUMERIC(8,2),

    -- Görseller (JSON array of URL strings)
    images          JSONB DEFAULT '[]',
    thumbnail_url   TEXT,

    -- Varyantlar (ör: beden, renk)
    variants        JSONB DEFAULT '[]',
    -- Örnek: [{"name":"Beden","options":["S","M","L"]},{"name":"Renk","options":["Kırmızı","Mavi"]}]

    -- SEO & Ek bilgiler
    meta_title       VARCHAR(255),
    meta_description TEXT,
    tags             TEXT[],                               -- PostgreSQL native array

    -- pgvector embedding (AI arama için)
    -- embedding      vector(1536),                       -- pgvector eklentisi gerekli

    -- Durum
    status          VARCHAR(20) DEFAULT 'draft',          -- draft | active | archived
    is_featured     BOOLEAN DEFAULT FALSE,
    view_count      BIGINT DEFAULT 0,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(seller_id, slug)
);

-- ─── 4. SİPARİŞLER ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id                UUID DEFAULT gen_random_uuid(),
    order_number      VARCHAR(50) NOT NULL,          -- ORD-20260510-XXXX

    buyer_id          UUID NOT NULL REFERENCES users(id),
    seller_id         UUID NOT NULL REFERENCES seller_profiles(id),

    -- Fiyat (kuruş)
    subtotal          BIGINT NOT NULL,
    shipping_cost     BIGINT DEFAULT 0,
    tax_amount        BIGINT DEFAULT 0,
    total_amount      BIGINT NOT NULL,
    platform_fee      BIGINT DEFAULT 0,                    -- platform komisyonu

    -- Ödeme
    stripe_payment_intent_id VARCHAR(255),
    stripe_transfer_id       VARCHAR(255),                 -- escrow release sonrası
    payment_status    VARCHAR(30) DEFAULT 'pending',       -- pending | paid | refunded | failed
    escrow_status     VARCHAR(30) DEFAULT 'held',          -- held | released | refunded

    -- Sipariş durumu
    status            VARCHAR(30) DEFAULT 'pending',
    -- pending → confirmed → processing → shipped → delivered → completed
    -- pending → cancelled / refunded

    -- Kargo
    shipping_address  JSONB,
    -- {"name":"...", "line1":"...", "city":"...", "state":"...", "zip":"...", "country":"TR", "phone":"..."}
    easypost_shipment_id VARCHAR(255),
    easypost_tracker_id  VARCHAR(255),
    tracking_number      VARCHAR(255),
    tracking_url         TEXT,
    carrier              VARCHAR(50),

    -- Zaman damgaları
    paid_at          TIMESTAMPTZ,
    shipped_at       TIMESTAMPTZ,
    delivered_at     TIMESTAMPTZ,
    cancelled_at     TIMESTAMPTZ,
    escrow_released_at TIMESTAMPTZ,

    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (id, created_at),
    UNIQUE (order_number, created_at)
) PARTITION BY RANGE (created_at);

-- Aylık partition'lar (ilk 6 ay)
CREATE TABLE IF NOT EXISTS orders_2026_05 PARTITION OF orders
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS orders_2026_06 PARTITION OF orders
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS orders_2026_07 PARTITION OF orders
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS orders_2026_08 PARTITION OF orders
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS orders_2026_09 PARTITION OF orders
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS orders_2026_10 PARTITION OF orders
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

-- ─── 5. SİPARİŞ KALEMLERİ ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id       UUID NOT NULL,  -- partition tabloya FK atanamaz
    product_id     UUID NOT NULL REFERENCES products(id),

    title          VARCHAR(500) NOT NULL,                   -- sipariş anındaki isim (ürün sonra değişebilir)
    variant_info   JSONB,                                   -- {"Beden":"M","Renk":"Kırmızı"}
    quantity       INT NOT NULL CHECK (quantity > 0),
    unit_price     BIGINT NOT NULL,                         -- sipariş anındaki fiyat
    total_price    BIGINT NOT NULL,

    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 6. FİNANSAL İŞLEMLER ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id                UUID DEFAULT gen_random_uuid(),
    order_id          UUID,
    seller_id         UUID NOT NULL REFERENCES seller_profiles(id),

    type              VARCHAR(30) NOT NULL,
    -- payment | escrow_hold | escrow_release | refund | platform_fee | payout

    amount            BIGINT NOT NULL,                      -- kuruş
    currency          VARCHAR(3) DEFAULT 'TRY',

    stripe_id         VARCHAR(255),                         -- pi_xxx veya tr_xxx
    status            VARCHAR(20) DEFAULT 'pending',        -- pending | completed | failed
    description       TEXT,

    -- İdempotency (aynı işlem 2 kez yapılmaz)
    idempotency_key   VARCHAR(255),

    created_at        TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (id, created_at),
    UNIQUE (idempotency_key, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS transactions_2026_05 PARTITION OF transactions
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS transactions_2026_06 PARTITION OF transactions
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS transactions_2026_07 PARTITION OF transactions
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS transactions_2026_08 PARTITION OF transactions
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS transactions_2026_09 PARTITION OF transactions
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS transactions_2026_10 PARTITION OF transactions
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

-- ─── 7. ÜRÜN DEĞERLENDİRMELERİ ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    buyer_id    UUID NOT NULL REFERENCES users(id),
    order_id    UUID,

    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title       VARCHAR(255),
    body        TEXT,
    is_verified BOOLEAN DEFAULT FALSE,                      -- gerçek satın alma

    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(product_id, buyer_id)                            -- bir alıcı bir ürüne bir kez
);

-- ─── 8. SEPETler ────────────────────────────────────────────────────────────
-- NOT: Ana sepet DynamoDB'de tutulur (hız + TTL), bu tablo checkout sırasında snapshot
CREATE TABLE IF NOT EXISTS cart_snapshots (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    items      JSONB NOT NULL,
    -- [{"product_id":"...","quantity":2,"unit_price":1500,"variant":{"Beden":"M"}}]
    total      BIGINT NOT NULL,
    expires_at TIMESTAMPTZ,                                 -- ödeme yapılmazsa silinir
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- İNDEKSLER
-- ═══════════════════════════════════════════════════════════════════════════════

-- Seller
CREATE INDEX IF NOT EXISTS idx_seller_user_id     ON seller_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_slug        ON seller_profiles(store_slug);
CREATE INDEX IF NOT EXISTS idx_seller_stripe      ON seller_profiles(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- Products
CREATE INDEX IF NOT EXISTS idx_products_seller    ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status    ON products(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_slug      ON products(seller_id, slug);
CREATE INDEX IF NOT EXISTS idx_products_price     ON products(price) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_featured  ON products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_tags      ON products USING GIN(tags);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_buyer       ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller      ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment     ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_number      ON orders(order_number);

-- Order Items
CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Transactions
CREATE INDEX IF NOT EXISTS idx_tx_order           ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_tx_seller          ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_tx_idempotency     ON transactions(idempotency_key);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_product    ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_buyer      ON reviews(buyer_id);
