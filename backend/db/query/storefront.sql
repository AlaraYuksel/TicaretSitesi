-- ═══════════════════════════════════════════════════════════════════════════════
-- Storefront SQL Sorguları — sqlc
-- Ziyaretçi tarafı sipariş, sepet ve OTP işlemleri
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── ZİYARETÇİ SİPARİŞLERİ ────────────────────────────────────────────────

-- name: CreateGuestOrder :one
INSERT INTO guest_orders (
    site_id, order_number, customer_email, customer_phone, customer_name,
    items, subtotal, shipping_cost, tax_amount, total_amount,
    shipping_address, status, payment_status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
) RETURNING *;

-- name: GetGuestOrder :one
SELECT * FROM guest_orders WHERE id = $1;

-- name: GetGuestOrderByNumber :one
SELECT * FROM guest_orders WHERE order_number = $1;

-- name: ListGuestOrdersByEmail :many
SELECT * FROM guest_orders
WHERE customer_email = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListGuestOrdersByEmailAndPhone :many
SELECT * FROM guest_orders
WHERE customer_email = $1 AND customer_phone = $2
ORDER BY created_at DESC;

-- name: ListGuestOrdersBySite :many
SELECT * FROM guest_orders
WHERE site_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateGuestOrderStatus :exec
UPDATE guest_orders SET status = $2, updated_at = NOW() WHERE id = $1;

-- name: UpdateGuestOrderPayment :exec
UPDATE guest_orders SET payment_status = $2, paid_at = NOW(), updated_at = NOW() WHERE id = $1;

-- name: UpdateGuestOrderShipping :exec
UPDATE guest_orders SET
    status = 'shipped', tracking_number = $2, tracking_url = $3,
    carrier = $4, shipped_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: UpdateGuestOrderDelivered :exec
UPDATE guest_orders SET status = 'delivered', delivered_at = NOW(), updated_at = NOW() WHERE id = $1;

-- ─── OTP KODLARI ────────────────────────────────────────────────────────────

-- name: CreateOTP :one
INSERT INTO otp_codes (identifier, code, purpose, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetActiveOTP :one
SELECT * FROM otp_codes
WHERE identifier = $1 AND purpose = $2
  AND verified = FALSE AND attempts < max_attempts
  AND expires_at > NOW()
ORDER BY created_at DESC
LIMIT 1;

-- name: IncrementOTPAttempts :exec
UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1;

-- name: VerifyOTP :exec
UPDATE otp_codes SET verified = TRUE WHERE id = $1;

-- name: CleanExpiredOTPs :exec
DELETE FROM otp_codes WHERE expires_at < NOW();

-- ─── ZİYARETÇİ SEPETİ ──────────────────────────────────────────────────────

-- name: UpsertGuestCart :one
INSERT INTO guest_cart_snapshots (site_id, session_id, items, total)
VALUES ($1, $2, $3, $4)
ON CONFLICT (id) DO UPDATE
SET items = EXCLUDED.items, total = EXCLUDED.total, expires_at = NOW() + INTERVAL '24 hours'
RETURNING *;

-- name: GetGuestCart :one
SELECT * FROM guest_cart_snapshots
WHERE session_id = $1 AND site_id = $2 AND expires_at > NOW()
ORDER BY created_at DESC LIMIT 1;

-- name: DeleteGuestCart :exec
DELETE FROM guest_cart_snapshots WHERE session_id = $1 AND site_id = $2;

-- name: CleanExpiredCarts :exec
DELETE FROM guest_cart_snapshots WHERE expires_at < NOW();
