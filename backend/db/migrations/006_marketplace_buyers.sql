-- ═══════════════════════════════════════════════════════════════════════════════
-- MARKETPLACE BUYER ACCOUNTS, Q&A, ORDER APPROVAL & STRIPE
-- Platform DB Schema — v6 (Buyer profiles + PCI-compliant payment tokens)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Mimari notu:
--   • Mevcut `users` tablosu hem alıcı hem satıcıyı temsil eder. Rol ayrımı
--     `seller_profiles` varlığı ile yapılır (yeni tablo açılmaz).
--   • Kart bilgileri (PAN/CVV) bu DB'de ASLA tutulmaz. payment_methods tablosu
--     sadece Stripe tokenı + display verisi (brand/last4/exp) saklar.
--     PCI DSS SAQ A kapsamı (en hafif uyumluluk seviyesi).
--   • marketplace_orders multi-seller bölme stratejisi: checkout sırasında cart
--     site_id bazında bölünür ve her satıcı için ayrı kayıt oluşturulur.

-- ─── 1. USERS — Telefon + Stripe Customer ─────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone              VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
-- stripe_customer_id lazy-create: ilk kart eklenirken doldurulur.

-- ─── 2. ADRES DEFTERİ ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addresses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    label           VARCHAR(50),                       -- "Ev", "İş"
    recipient_name  VARCHAR(255) NOT NULL,
    phone           VARCHAR(20)  NOT NULL,

    line1           TEXT         NOT NULL,
    line2           TEXT,
    city            VARCHAR(100) NOT NULL,
    state           VARCHAR(100),
    zip             VARCHAR(20),
    country         VARCHAR(3)   DEFAULT 'TR',

    is_default      BOOLEAN      DEFAULT FALSE,

    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
-- Her user için yalnızca tek bir default adres olabilir
CREATE UNIQUE INDEX IF NOT EXISTS idx_addresses_user_default
    ON addresses(user_id) WHERE is_default = TRUE;

-- ─── 3. ÖDEME YÖNTEMLERİ (PCI: yalnızca Stripe tokenı + display) ──────────
CREATE TABLE IF NOT EXISTS payment_methods (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    stripe_payment_method_id    VARCHAR(255) NOT NULL UNIQUE,    -- pm_xxx
    brand                       VARCHAR(20)  NOT NULL,           -- visa, mastercard, amex, ...
    last4                       CHAR(4)      NOT NULL,
    exp_month                   SMALLINT     NOT NULL CHECK (exp_month BETWEEN 1 AND 12),
    exp_year                    SMALLINT     NOT NULL,

    is_default                  BOOLEAN      DEFAULT FALSE,
    created_at                  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_user_default
    ON payment_methods(user_id) WHERE is_default = TRUE;

-- ─── 4. ÜRÜN SORULARI (Public Q&A — Trendyol/Hepsiburada tarzı) ───────────
CREATE TABLE IF NOT EXISTS product_questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES published_products(id) ON DELETE CASCADE,
    buyer_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    -- site_id cache: satıcının sorularını listelerken JOIN'i azaltır

    question        TEXT NOT NULL,
    answer          TEXT,
    is_answered     BOOLEAN     DEFAULT FALSE,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    answered_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_product_questions_product
    ON product_questions(product_id, is_answered);
CREATE INDEX IF NOT EXISTS idx_product_questions_site
    ON product_questions(site_id, is_answered, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_questions_buyer
    ON product_questions(buyer_id, created_at DESC);

-- ─── 5. MARKETPLACE_ORDERS — Auth, Stripe, kargo, escrow alanları ─────────
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS buyer_id                 UUID;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS site_id                  UUID;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS stripe_transfer_id       VARCHAR(255);

-- pending_approval → approved → (red: rejected) | (kargolanma: status='shipped')
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) DEFAULT 'pending_approval';
-- held → released | refunded
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS escrow_status   VARCHAR(20) DEFAULT 'held';

ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS tracking_number    VARCHAR(255);
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS tracking_url       TEXT;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS carrier            VARCHAR(50);

ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS shipped_at          TIMESTAMPTZ;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivered_at        TIMESTAMPTZ;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS escrow_released_at  TIMESTAMPTZ;

ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- payment_status default'unu 'pending' yap (eski 'paid' simüle değildi)
ALTER TABLE marketplace_orders ALTER COLUMN payment_status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_mp_orders_site_status
    ON marketplace_orders(site_id, status);
CREATE INDEX IF NOT EXISTS idx_mp_orders_buyer
    ON marketplace_orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_orders_stripe_pi
    ON marketplace_orders(stripe_payment_intent_id);
