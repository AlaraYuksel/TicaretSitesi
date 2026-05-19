// ai-site-builder Lambda — AI ile site kurma ajanı.
//
// Lambda Function URL (RESPONSE_STREAM) ile çalışır: ExecutePlan SSE akışı
// dakikalarca sürebilir; API Gateway'in 30sn limiti uygulanmaz.
package main

import (
	"log"
	"net/http"

	"go-backend-projem/internal/lambdart"
)

func main() {
	d := lambdart.MustLoad()
	if d.AISiteBuilder == nil {
		log.Fatal("ai-site-builder: GEMINI_API_KEY tanımlı değil — handler kurulamadı")
	}

	mux := http.NewServeMux()
	mux.Handle("POST /api/ai/build-site/plan", d.Auth(http.HandlerFunc(d.AISiteBuilder.PlanSite)))
	mux.Handle("POST /api/ai/build-site/execute", d.Auth(http.HandlerFunc(d.AISiteBuilder.ExecutePlan)))

	lambdart.StartHTTPStreaming(mux)
}
