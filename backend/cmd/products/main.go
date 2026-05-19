// products Lambda — satıcı ürün yönetimi + marketplace ürün listeleme + ürün Q&A.
// API Gateway: /api/products..., /api/marketplace/products..., /api/marketplace/categories
package main

import (
	"net/http"

	"go-backend-projem/internal/lambdart"
)

func main() {
	d := lambdart.MustLoad()
	mux := http.NewServeMux()

	// Satıcı ürün CRUD
	mux.HandleFunc("GET /api/products", d.Product.List)
	mux.HandleFunc("GET /api/products/{id}", d.Product.Get)
	mux.Handle("POST /api/products", d.Auth(http.HandlerFunc(d.Product.Create)))
	mux.Handle("PUT /api/products/{id}", d.Auth(http.HandlerFunc(d.Product.Update)))
	mux.Handle("DELETE /api/products/{id}", d.Auth(http.HandlerFunc(d.Product.Delete)))

	// Marketplace ürün listeleme (auth yok)
	mux.HandleFunc("GET /api/marketplace/products", d.Marketplace.ListProducts)
	mux.HandleFunc("GET /api/marketplace/products/{id}", d.Marketplace.GetProduct)
	mux.HandleFunc("GET /api/marketplace/categories", d.Marketplace.ListCategories)

	// Ürün soru-cevap
	mux.HandleFunc("GET /api/marketplace/products/{id}/questions", d.Questions.PublicList)
	mux.Handle("POST /api/marketplace/products/{id}/questions", d.Auth(http.HandlerFunc(d.Questions.Ask)))

	lambdart.StartHTTP(mux)
}
