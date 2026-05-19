// ai-api Lambda — AI HTTP endpoint'leri (API Gateway).
//
// AI işlemleri asenkron: bu Lambda işi başlatır (ai_jobs kaydı + SQS) ve
// job_id döndürür; ağır işi ai-worker Lambda yapar. Tüm endpoint'ler hızlı —
// API Gateway 30sn limiti sorun olmaz.
package main

import (
	"net/http"

	"go-backend-projem/internal/lambdart"
)

func main() {
	d := lambdart.MustLoad()
	mux := http.NewServeMux()

	// Asenkron AI işleri — başlat + durum
	mux.Handle("POST /api/ai/build-site/plan", d.Auth(http.HandlerFunc(d.AIJobs.StartPlan)))
	mux.Handle("POST /api/ai/build-site/execute", d.Auth(http.HandlerFunc(d.AIJobs.StartExecute)))
	mux.Handle("POST /api/marketplace/ai-solver/solve", d.Auth(http.HandlerFunc(d.AIJobs.StartSolve)))
	mux.Handle("GET /api/ai/jobs/{id}", d.Auth(http.HandlerFunc(d.AIJobs.GetJob)))

	// AI Solver kayıtlı çözümleri — senkron, hızlı DB işlemleri
	if d.AISolver != nil {
		mux.Handle("POST /api/marketplace/ai-solver/solutions", d.Auth(http.HandlerFunc(d.AISolver.SaveSolution)))
		mux.Handle("GET /api/marketplace/ai-solver/solutions", d.Auth(http.HandlerFunc(d.AISolver.ListSolutions)))
		mux.Handle("GET /api/marketplace/ai-solver/solutions/{id}", d.Auth(http.HandlerFunc(d.AISolver.GetSolution)))
	}

	lambdart.StartHTTP(mux)
}
