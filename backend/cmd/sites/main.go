// sites Lambda — editör site CRUD + publish endpoint'leri.
// API Gateway: /api/sites...
package main

import (
	"net/http"

	"go-backend-projem/internal/lambdart"
)

func main() {
	d := lambdart.MustLoad()
	mux := http.NewServeMux()

	mux.Handle("GET /api/sites", d.Auth(http.HandlerFunc(d.Site.List)))
	mux.Handle("POST /api/sites", d.Auth(http.HandlerFunc(d.Site.Create)))
	mux.Handle("GET /api/sites/{id}", d.Auth(http.HandlerFunc(d.Site.Get)))
	mux.Handle("PUT /api/sites/{id}/data", d.Auth(http.HandlerFunc(d.Site.SaveData)))
	mux.Handle("POST /api/sites/{id}/publish", d.Auth(http.HandlerFunc(d.Site.Publish)))
	mux.Handle("POST /api/sites/{id}/unpublish", d.Auth(http.HandlerFunc(d.Site.Unpublish)))
	mux.Handle("DELETE /api/sites/{id}", d.Auth(http.HandlerFunc(d.Site.Delete)))

	lambdart.StartHTTP(mux)
}
