// seller Lambda — satıcı paneli: dashboard, Stripe Connect, kargo,
// marketplace sipariş yönetimi, ürün soruları, bakiye.
package main

import (
	"net/http"

	"go-backend-projem/internal/lambdart"
)

func main() {
	d := lambdart.MustLoad()
	mux := http.NewServeMux()

	// Satıcı temel
	mux.Handle("GET /api/seller/dashboard", d.Auth(http.HandlerFunc(d.Seller.Dashboard)))
	mux.Handle("POST /api/seller/register", d.Auth(http.HandlerFunc(d.Seller.Register)))
	mux.Handle("POST /api/seller/connect", d.Auth(http.HandlerFunc(d.Seller.StripeConnect)))
	mux.Handle("POST /api/seller/shipments", d.Auth(http.HandlerFunc(d.Seller.CreateShipment)))

	// Satıcı ürün soruları
	mux.Handle("GET /api/seller/questions", d.Auth(http.HandlerFunc(d.Questions.SellerList)))
	mux.Handle("POST /api/seller/questions/{id}/answer", d.Auth(http.HandlerFunc(d.Questions.Answer)))

	// Satıcı marketplace sipariş yönetimi
	mux.Handle("GET /api/seller/marketplace-orders", d.Auth(http.HandlerFunc(d.SellerOrders.List)))
	mux.Handle("GET /api/seller/marketplace-orders/{id}", d.Auth(http.HandlerFunc(d.SellerOrders.Get)))
	mux.Handle("POST /api/seller/marketplace-orders/{id}/approve", d.Auth(http.HandlerFunc(d.SellerOrders.Approve)))
	mux.Handle("POST /api/seller/marketplace-orders/{id}/reject", d.Auth(http.HandlerFunc(d.SellerOrders.Reject)))
	mux.Handle("POST /api/seller/marketplace-orders/{id}/cancel", d.Auth(http.HandlerFunc(d.SellerOrders.Cancel)))
	mux.Handle("POST /api/seller/marketplace-orders/{id}/ship", d.Auth(http.HandlerFunc(d.SellerOrders.Ship)))
	mux.Handle("POST /api/seller/marketplace-orders/{id}/mark-delivered", d.Auth(http.HandlerFunc(d.SellerOrders.MarkDelivered)))
	mux.Handle("POST /api/seller/marketplace-orders/{id}/release-escrow", d.Auth(http.HandlerFunc(d.SellerOrders.ReleaseEscrow)))
	mux.Handle("GET /api/seller/balance", d.Auth(http.HandlerFunc(d.SellerOrders.Balance)))

	lambdart.StartHTTP(mux)
}
