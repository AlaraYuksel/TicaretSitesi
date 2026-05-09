package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go-backend-projem/internal/config"
	dbpkg "go-backend-projem/internal/db"
	"go-backend-projem/internal/handler"
	"go-backend-projem/internal/middleware"
)

func main() {
	// ─── Config ───────────────────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Config yüklenemedi: %v", err)
	}

	// ─── DB Pool ──────────────────────────────────────────────────────────────
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := dbpkg.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Veritabanı bağlantısı kurulamadı: %v", err)
	}
	defer pool.Close()
	log.Println("PostgreSQL bağlantısı kuruldu")

	// ─── Store & Handlers ─────────────────────────────────────────────────────
	store := dbpkg.NewStore(pool)

	siteHandler := handler.NewSiteHandler(store)
	serveHandler := handler.NewServeHandler(store, cfg)

	// 🔄 COGNITO_SWITCH: Lokal auth handler.
	// Cognito'ya geçildiğinde bu handler kaldırılır,
	// register/login işlemleri Cognito hosted UI'a bırakılır.
	authHandler := handler.NewAuthHandler(store, cfg.JWTSecret)

	// ─── Auth Middleware ──────────────────────────────────────────────────────
	// 🔄 COGNITO_SWITCH: Lokal JWT auth.
	// Cognito'ya geçildiğinde:
	//   auth := middleware.CognitoAuth(cfg.CognitoJWKSURL)
	auth := middleware.JWTAuth(cfg.JWTSecret)

	// ─── Router (saf net/http — Go 1.22 pattern matching) ────────────────────
	mux := http.NewServeMux()

	// Sağlık kontrolü — load balancer / Docker healthcheck için
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{"status":"ok"}`)
	})

	// ── 🔄 COGNITO_SWITCH: Lokal Auth API ─────────────────────────────────────
	// Cognito'ya geçildiğinde bu 2 route kaldırılır.
	mux.HandleFunc("POST /api/auth/register", authHandler.Register)
	mux.HandleFunc("POST /api/auth/login", authHandler.Login)
	mux.Handle("GET /api/auth/me", auth(http.HandlerFunc(authHandler.Me)))

	// ── Site API ──────────────────────────────────────────────────────────────
	mux.Handle("GET /api/sites", auth(http.HandlerFunc(siteHandler.List)))
	mux.Handle("POST /api/sites", auth(http.HandlerFunc(siteHandler.Create)))
	mux.Handle("GET /api/sites/{id}", auth(http.HandlerFunc(siteHandler.Get)))
	mux.Handle("PUT /api/sites/{id}/data", auth(http.HandlerFunc(siteHandler.SaveData)))
	mux.Handle("POST /api/sites/{id}/publish", auth(http.HandlerFunc(siteHandler.Publish)))
	mux.Handle("DELETE /api/sites/{id}", auth(http.HandlerFunc(siteHandler.Delete)))

	// ── Domain Serving ───────────────────────────────────────────────────────
	// Tüm diğer istekler → Host header'dan subdomain/custom domain bul → site serve et
	// GET https://merhaba.websitedomaini.com → bu handler karşılar
	mux.Handle("/", serveHandler)

	// ─── Global Middleware Zinciri ────────────────────────────────────────────
	// CORS → Logger → Router
	chain := middleware.CORS(logger(mux))

	// ─── HTTP Server ──────────────────────────────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      chain,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown: SIGINT / SIGTERM sinyali gelince bağlantıları bekle
	go func() {
		log.Printf("Sunucu :%s portunda başlatıldı", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Sunucu hatası: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Sunucu kapatılıyor...")

	shutCtx, shutCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutCancel()
	if err := srv.Shutdown(shutCtx); err != nil {
		log.Fatalf("Zorla kapatma hatası: %v", err)
	}
	log.Println("Sunucu temiz kapandı.")
}

// logger her isteği loglar.
func logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}
