-- ═══════════════════════════════════════════════════════════════════════════════
-- AI İŞ KUYRUĞU — Asenkron AI işleri (plan / execute / solve)
-- Platform DB Schema — v8 (AI Async Jobs)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Mimari notu:
--   AI işlemleri (site planı, site inşası, çözüm üretimi) uzun sürer (~1-2 dk) —
--   API Gateway'in 30sn limitini aşar. Bu yüzden asenkron çalışır:
--     1. HTTP başlat endpoint'i bir ai_jobs kaydı oluşturur (status=pending),
--        SQS'e mesaj atar ve job_id döndürür.
--     2. ai-worker Lambda (SQS tüketici) işi çalıştırır, ilerleme olaylarını
--        events dizisine yazar, biten sonucu result'a yazar.
--     3. Frontend GET /api/ai/jobs/{id} ile durumu poll eder.

CREATE TABLE IF NOT EXISTS ai_jobs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL,
    kind       TEXT NOT NULL,                       -- plan | execute | solve
    status     TEXT NOT NULL DEFAULT 'pending',     -- pending | running | done | error
    params     JSONB NOT NULL DEFAULT '{}'::jsonb,  -- işin girdileri
    events     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ilerleme olayları (SSE eşdeğeri)
    result     JSONB,                               -- biten işin çıktısı
    error      TEXT,                                -- hata mesajı (status=error ise)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_user    ON ai_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_created ON ai_jobs(created_at);
