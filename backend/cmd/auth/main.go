// auth Lambda — kimlik doğrulama endpoint'leri.
// API Gateway: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
package main

import (
	"net/http"

	"go-backend-projem/internal/lambdart"
)

func main() {
	d := lambdart.MustLoad()
	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/auth/register", d.AuthH.Register)
	mux.HandleFunc("POST /api/auth/login", d.AuthH.Login)
	mux.Handle("GET /api/auth/me", d.Auth(http.HandlerFunc(d.AuthH.Me)))

	lambdart.StartHTTP(mux)
}
