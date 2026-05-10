-- ═══════════════════════════════════════════════════════════════════════════════
-- E-Ticaret SQL Sorguları — sqlc
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── SELLER PROFİLLERİ ──────────────────────────────────────────────────────

-- name: GetSellerByUserID :one
SELECT * FROM seller_profiles WHERE user_id = $1;

-- name: GetSellerBySlug :one
SELECT * FROM seller_profiles WHERE store_slug = $1;

-- name: CreateSeller :one
INSERT INTO seller_profiles (user_id, store_name, store_slug, store_description)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateSellerStripeAccount :exec
UPDATE seller_profiles
SET stripe_account_id = $2, stripe_onboarded = $3, payout_enabled = $4, updated_at = NOW()
WHERE id = $1;

-- name: UpdateSellerStats :exec
UPDATE seller_profiles
SET total_sales = $2, total_revenue = $3, updated_at = NOW()
WHERE id = $1;

-- ─── ÜRÜNLER ────────────────────────────────────────────────────────────────

-- name: ListProductsBySeller :many
SELECT * FROM products
WHERE seller_id = $1 AND status != 'archived'
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListActiveProducts :many
SELECT p.*, sp.store_name as seller_name
FROM products p
JOIN seller_profiles sp ON p.seller_id = sp.id
WHERE p.status = 'active'
ORDER BY p.created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListProductsByCategory :many
SELECT p.*, sp.store_name as seller_name
FROM products p
JOIN seller_profiles sp ON p.seller_id = sp.id
WHERE p.category_id = $1 AND p.status = 'active'
ORDER BY p.created_at DESC
LIMIT $2 OFFSET $3;

-- name: SearchProducts :many
SELECT p.*, sp.store_name as seller_name
FROM products p
JOIN seller_profiles sp ON p.seller_id = sp.id
WHERE p.status = 'active'
  AND (p.title ILIKE '%' || @query::text || '%' OR p.description ILIKE '%' || @query::text || '%')
ORDER BY p.created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetProduct :one
SELECT p.*, sp.store_name as seller_name, sp.store_slug as seller_slug
FROM products p
JOIN seller_profiles sp ON p.seller_id = sp.id
WHERE p.id = $1;

-- name: CreateProduct :one
INSERT INTO products (
    seller_id, category_id, title, slug, description, short_desc,
    price, compare_price, currency, sku, stock_quantity,
    weight_grams, images, thumbnail_url, variants, tags, status
) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11,
    $12, $13, $14, $15, $16, $17
) RETURNING *;

-- name: UpdateProduct :exec
UPDATE products SET
    title = $2, description = $3, short_desc = $4,
    price = $5, compare_price = $6, stock_quantity = $7,
    images = $8, thumbnail_url = $9, variants = $10,
    tags = $11, status = $12, updated_at = NOW()
WHERE id = $1;

-- name: DeleteProduct :exec
UPDATE products SET status = 'archived', updated_at = NOW() WHERE id = $1;

-- name: DecrementStock :exec
UPDATE products SET stock_quantity = stock_quantity - $2, updated_at = NOW()
WHERE id = $1 AND stock_quantity >= $2;

-- name: IncrementViewCount :exec
UPDATE products SET view_count = view_count + 1 WHERE id = $1;

-- ─── SİPARİŞLER ────────────────────────────────────────────────────────────

-- name: CreateOrder :one
INSERT INTO orders (
    order_number, buyer_id, seller_id,
    subtotal, shipping_cost, tax_amount, total_amount, platform_fee,
    stripe_payment_intent_id, shipping_address, status, payment_status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
) RETURNING *;

-- name: GetOrder :one
SELECT * FROM orders WHERE id = $1;

-- name: GetOrderByNumber :one
SELECT * FROM orders WHERE order_number = $1;

-- name: ListOrdersByBuyer :many
SELECT o.*, sp.store_name as seller_name
FROM orders o
JOIN seller_profiles sp ON o.seller_id = sp.id
WHERE o.buyer_id = $1
ORDER BY o.created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListOrdersBySeller :many
SELECT o.*, u.full_name as buyer_name, u.email as buyer_email
FROM orders o
JOIN users u ON o.buyer_id = u.id
WHERE o.seller_id = $1
ORDER BY o.created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateOrderStatus :exec
UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1;

-- name: UpdateOrderPayment :exec
UPDATE orders
SET payment_status = $2, stripe_payment_intent_id = $3, paid_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: UpdateOrderShipping :exec
UPDATE orders
SET status = 'shipped',
    easypost_shipment_id = $2, tracking_number = $3,
    tracking_url = $4, carrier = $5, shipped_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: UpdateOrderDelivered :exec
UPDATE orders
SET status = 'delivered', delivered_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: UpdateOrderEscrowReleased :exec
UPDATE orders
SET escrow_status = 'released', stripe_transfer_id = $2,
    escrow_released_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- ─── SİPARİŞ KALEMLERİ ─────────────────────────────────────────────────────

-- name: CreateOrderItem :one
INSERT INTO order_items (order_id, product_id, title, variant_info, quantity, unit_price, total_price)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListOrderItems :many
SELECT * FROM order_items WHERE order_id = $1;

-- ─── FİNANSAL İŞLEMLER ─────────────────────────────────────────────────────

-- name: CreateTransaction :one
INSERT INTO transactions (order_id, seller_id, type, amount, currency, stripe_id, status, idempotency_key, description)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetTransactionByIdempotencyKey :one
SELECT * FROM transactions WHERE idempotency_key = $1;

-- name: ListTransactionsBySeller :many
SELECT * FROM transactions WHERE seller_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3;

-- ─── DEĞERLENDİRMELER ──────────────────────────────────────────────────────

-- name: CreateReview :one
INSERT INTO reviews (product_id, buyer_id, order_id, rating, title, body, is_verified)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListProductReviews :many
SELECT r.*, u.full_name as reviewer_name
FROM reviews r
JOIN users u ON r.buyer_id = u.id
WHERE r.product_id = $1
ORDER BY r.created_at DESC
LIMIT $2 OFFSET $3;

-- ─── KATEGORİLER ────────────────────────────────────────────────────────────

-- name: ListCategories :many
SELECT * FROM categories ORDER BY sort_order, name;

-- name: GetCategory :one
SELECT * FROM categories WHERE id = $1;
