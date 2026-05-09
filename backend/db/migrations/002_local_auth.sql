-- ═══════════════════════════════════════════════════════════════════════════════
-- 🔄 COGNITO_SWITCH: Bu dosyanın tamamı lokal auth içindir.
-- Cognito'ya geçildiğinde bu migration geri alınabilir (password_hash DROP edilir).
-- ═══════════════════════════════════════════════════════════════════════════════

-- Lokal auth için password_hash kolonu ekleniyor.
-- Cognito modunda bu kolon kullanılmaz.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Lokal auth'da users.id artık gen_random_uuid() ile oluşturulacak
-- (Cognito'da Cognito sub claim kullanılıyordu)
ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();
