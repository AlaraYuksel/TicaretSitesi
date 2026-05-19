// orders Lambda — sipariş akışları: klasik orders, marketplace orders,
// alıcı siparişleri, ziyaretçi (storefront) siparişleri.
package main

import (
	"net/http"

	"go-backend-projem/internal/lambdart"
)

func main() {
	d := lambdart.MustLoad()
	mux := http.NewServeMux()

	// Klasik sipariş API
	mux.Handle("GET /api/orders", d.Auth(http.HandlerFunc(d.Order.List)))
	mux.Handle("POST /api/orders", d.Auth(http.HandlerFunc(d.Order.Create)))
	mux.Handle("GET /api/orders/{id}", d.Auth(http.HandlerFunc(d.Order.Get)))

	// Marketplace siparişleri (auth yok — guest checkout destekli)
	mux.HandleFunc("POST /api/marketplace/orders", d.Marketplace.CreateOrder)
	mux.HandleFunc("GET /api/marketplace/orders/{orderNumber}", d.Marketplace.GetOrder)
	mux.HandleFunc("POST /api/marketplace/orders/{id}/confirm-payment", d.Marketplace.ConfirmPayment)

	// Alıcı siparişleri (auth)
	mux.Handle("GET /api/buyer/orders", d.Auth(http.HandlerFunc(d.Marketplace.ListMyOrders)))
	mux.Handle("POST /api/buyer/orders/{id}/cancel", d.Auth(http.HandlerFunc(d.Marketplace.CancelByBuyer)))

	// Storefront (ziyaretçi) siparişleri (auth yok)
	mux.HandleFunc("POST /api/storefront/orders", d.Storefront.CreateOrder)
	mux.HandleFunc("POST /api/storefront/orders/track", d.Storefront.RequestOTP)
	mux.HandleFunc("POST /api/storefront/orders/verify", d.Storefront.VerifyOTP)
	mux.HandleFunc("GET /api/storefront/orders/detail/{orderNumber}", d.Storefront.GetOrderByNumber)
	mux.HandleFunc("GET /api/storefront/sites/{siteId}/products", d.Storefront.ListProducts)

	lambdart.StartHTTP(mux)
}
