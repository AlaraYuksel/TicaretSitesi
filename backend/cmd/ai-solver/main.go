// ai-solver Lambda — AI marketplace problem çözücü.
//
// Lambda Function URL (RESPONSE_STREAM) ile çalışır: Solve endpoint'i SSE ile
// canlı ilerleme akışı yapar.
package main

import (
	"log"
	"net/http"

	"go-backend-projem/internal/lambdart"
)

func main() {
	d := lambdart.MustLoad()
	if d.AISolver == nil {
		log.Fatal("ai-solver: GEMINI_API_KEY tanımlı değil — handler kurulamadı")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/marketplace/ai-solver/solve", d.AISolver.Solve)
	mux.Handle("POST /api/marketplace/ai-solver/solutions", d.Auth(http.HandlerFunc(d.AISolver.SaveSolution)))
	mux.Handle("GET /api/marketplace/ai-solver/solutions", d.Auth(http.HandlerFunc(d.AISolver.ListSolutions)))
	mux.Handle("GET /api/marketplace/ai-solver/solutions/{id}", d.Auth(http.HandlerFunc(d.AISolver.GetSolution)))

	lambdart.StartHTTPStreaming(mux)
}
