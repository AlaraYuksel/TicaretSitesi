-- sqlc için sorgu dosyası — users tablosu

-- name: UpsertUser :one
-- Cognito ile giriş yapan kullanıcıyı oluşturur veya günceller.
-- $1 = Cognito sub claim (UUID formatında)
INSERT INTO users (id, email)
VALUES ($1, $2)
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email, updated_at = NOW()
RETURNING id, email, full_name, avatar_url, plan,
          storage_used, storage_limit, created_at, updated_at;

-- name: GetUserByID :one
SELECT id, email, full_name, avatar_url, plan,
       storage_used, storage_limit, created_at, updated_at
FROM users
WHERE id = $1;
