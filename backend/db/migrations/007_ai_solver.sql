-- ═══════════════════════════════════════════════════════════════════════════════
-- AI ÇÖZÜM ASİSTANI — Anlamsal arama (pgvector) + kaydedilmiş çözüm paketleri
-- Platform DB Schema — v7 (AI Solver Extension)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Mimari notu:
--   Kullanıcı marketplace'te bir sorununu doğal dilde anlatır. AI:
--     1. Sorunu çelişkiye (iyileşen ↔ kısıt) çevirir,
--     2. anlamsal arama ifadeleri üretir,
--     3. published_products.embedding üzerinde pgvector kosinüs benzerliği ile
--        ilgili ürünleri çeker,
--     4. çok ürünlü bir çözüm paketi kurar.
--   Embedding'ler Gemini embedding API'si ile üretilir (768 boyut).

CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 1. PUBLISHED_PRODUCTS — anlamsal arama için embedding ────────────────────
ALTER TABLE published_products
  ADD COLUMN IF NOT EXISTS embedding   vector(768),
  ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

-- HNSW indeksi — kosinüs mesafesi (<=>) ile yaklaşık en yakın komşu araması.
CREATE INDEX IF NOT EXISTS idx_pub_products_embedding
  ON published_products USING hnsw (embedding vector_cosine_ops);

-- ─── 2. AI_SOLUTIONS — kullanıcıya özel kaydedilmiş çözümler ──────────────────
-- Çözümler yalnızca oluşturan kullanıcının hesabından erişilir (gizli, paylaşımsız).
CREATE TABLE IF NOT EXISTS ai_solutions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    problem_text  TEXT  NOT NULL,
    analysis      JSONB NOT NULL,   -- {improving, constraint, summary, search_concepts}
    package       JSONB NOT NULL,   -- {package_title, intro, items:[...], total_price, item_count}

    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_solutions_user
  ON ai_solutions(user_id, created_at DESC);
