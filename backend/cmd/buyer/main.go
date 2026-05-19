// buyer Lambda — alıcı profili, adresler, kayıtlı ödeme yöntemleri.
// Tüm endpoint'ler auth gerektirir.
package main

import (
	"net/http"

	"go-backend-projem/internal/lambdart"
)

func main() {
	d := lambdart.MustLoad()
	mux := http.NewServeMux()

	mux.Handle("PUT /api/buyer/profile", d.Auth(http.HandlerFunc(d.Buyer.UpdateProfile)))

	// Adresler
	mux.Handle("GET /api/buyer/addresses", d.Auth(http.HandlerFunc(d.Buyer.ListAddresses)))
	mux.Handle("POST /api/buyer/addresses", d.Auth(http.HandlerFunc(d.Buyer.CreateAddress)))
	mux.Handle("PUT /api/buyer/addresses/{id}", d.Auth(http.HandlerFunc(d.Buyer.UpdateAddress)))
	mux.Handle("DELETE /api/buyer/addresses/{id}", d.Auth(http.HandlerFunc(d.Buyer.DeleteAddress)))
	mux.Handle("PUT /api/buyer/addresses/{id}/default", d.Auth(http.HandlerFunc(d.Buyer.SetDefaultAddress)))

	// Ödeme yöntemleri (Stripe token tabanlı)
	mux.Handle("POST /api/buyer/payment-methods/setup-intent", d.Auth(http.HandlerFunc(d.Buyer.CreateSetupIntent)))
	mux.Handle("GET /api/buyer/payment-methods", d.Auth(http.HandlerFunc(d.Buyer.ListPaymentMethods)))
	mux.Handle("POST /api/buyer/payment-methods", d.Auth(http.HandlerFunc(d.Buyer.AttachPaymentMethod)))
	mux.Handle("DELETE /api/buyer/payment-methods/{id}", d.Auth(http.HandlerFunc(d.Buyer.DeletePaymentMethod)))
	mux.Handle("PUT /api/buyer/payment-methods/{id}/default", d.Auth(http.HandlerFunc(d.Buyer.SetDefaultPaymentMethod)))

	lambdart.StartHTTP(mux)
}
