// webhooks Lambda — Stripe ve EasyPost webhook'larını karşılar.
// Auth yok; gelen istekler HMAC imzasıyla doğrulanır.
package main

import (
	"net/http"

	"go-backend-projem/internal/lambdart"
)

func main() {
	d := lambdart.MustLoad()
	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/webhooks/stripe", d.Webhook.Stripe)
	mux.HandleFunc("POST /api/webhooks/easypost", d.Webhook.EasyPost)

	lambdart.StartHTTP(mux)
}
