-- ═══════════════════════════════════════════════════════════════════════════════
-- STOREFRONT MODÜLÜ — Ziyaretçi Siparişleri, OTP, Sepet
-- Platform DB Schema — v4 (Storefront Extension)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. ZİYARETÇİ SİPARİŞLERİ ─────────────────────────────────────────────
-- Auth gerektirmeyen, e-posta + telefon ile takip edilebilen siparişler
CREATE TABLE IF NOT EXISTS guest_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    order_number    VARCHAR(50) NOT NULL UNIQUE,

    -- Müşteri bilgileri (zorunlu)
    customer_email  VARCHAR(255) NOT NULL,
    customer_phone  VARCHAR(20) NOT NULL,
    customer_name   VARCHAR(255) NOT NULL,

    -- Sepet detayları (JSON snapshot)
    items           JSONB NOT NULL,
    -- [{"product_id":"...","title":"...","price":1500,"quantity":2,"image":"...","variant":{}}]

    -- Fiyatlar (kuruş cinsinden)
    subtotal        BIGINT NOT NULL,
    shipping_cost   BIGINT DEFAULT 0,
    tax_amount      BIGINT DEFAULT 0,
    total_amount    BIGINT NOT NULL,

    -- Kargo adresi
    shipping_address JSONB,
    -- {"line1":"...","line2":"...","city":"...","state":"...","zip":"...","country":"TR"}

    -- Durum
    status          VARCHAR(30) DEFAULT 'pending',
    -- pending → confirmed → processing → shipped → delivered → completed
    -- pending → cancelled

    payment_status  VARCHAR(30) DEFAULT 'pending',
    -- pending → paid → refunded → failed

    -- Kargo bilgileri
    tracking_number VARCHAR(255),
    tracking_url    TEXT,
    carrier         VARCHAR(50),

    -- Zaman damgaları
    paid_at         TIMESTAMPTZ,
    shipped_at      TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,

    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. OTP DOĞRULAMA KODLARI ──────────────────────────────────────────────
-- Sipariş takibi için tek kullanımlık doğrulama kodları
CREATE TABLE IF NOT EXISTS otp_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier  VARCHAR(255) NOT NULL,    -- e-posta veya telefon
    code        VARCHAR(6) NOT NULL,      -- 6 haneli kod
    purpose     VARCHAR(30) NOT NULL DEFAULT 'order_tracking',
    attempts    INT DEFAULT 0,            -- yanlış deneme sayısı
    max_attempts INT DEFAULT 5,           -- max yanlış deneme
    verified    BOOLEAN DEFAULT FALSE,
    expires_at  TIMESTAMPTZ NOT NULL,     -- 5 dakika geçerli
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. SEPET SNAPSHOTları (Ziyaretçi) ────────────────────────────────────
-- Checkout sırasında oluşturulan geçici sepet snapshot'ı
CREATE TABLE IF NOT EXISTS guest_cart_snapshots (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    session_id  VARCHAR(255) NOT NULL,    -- Çerezden gelen session ID
    items       JSONB NOT NULL,
    total       BIGINT NOT NULL,
    expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- İNDEKSLER
-- ═══════════════════════════════════════════════════════════════════════════════

-- Guest Orders
CREATE INDEX IF NOT EXISTS idx_guest_orders_site       ON guest_orders(site_id);
CREATE INDEX IF NOT EXISTS idx_guest_orders_email      ON guest_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_guest_orders_phone      ON guest_orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_guest_orders_number     ON guest_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_guest_orders_status     ON guest_orders(status);
CREATE INDEX IF NOT EXISTS idx_guest_orders_email_phone ON guest_orders(customer_email, customer_phone);

-- OTP
CREATE INDEX IF NOT EXISTS idx_otp_identifier          ON otp_codes(identifier);
CREATE INDEX IF NOT EXISTS idx_otp_expires             ON otp_codes(expires_at);

-- Guest Cart
CREATE INDEX IF NOT EXISTS idx_guest_cart_session      ON guest_cart_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_guest_cart_expires       ON guest_cart_snapshots(expires_at);
