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

	"go-backend-projem/internal/ai"
	"go-backend-projem/internal/config"
	dbpkg "go-backend-projem/internal/db"
	"go-backend-projem/internal/handler"
	"go-backend-projem/internal/middleware"
	"go-backend-projem/internal/payments"
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

	// Gemini istemcisi — GEMINI_API_KEY yoksa nil; AI özellikleri devre dışı kalır.
	geminiClient, gErr := ai.NewGeminiClient()
	if gErr != nil {
		log.Printf("Gemini istemcisi devre dışı: %v", gErr)
		geminiClient = nil
	}

	siteHandler := handler.NewSiteHandler(store, geminiClient)
	serveHandler := handler.NewServeHandler(store, cfg)

	// 🔄 COGNITO_SWITCH: Lokal auth handler.
	// Cognito'ya geçildiğinde bu handler kaldırılır,
	// register/login işlemleri Cognito hosted UI'a bırakılır.
	authHandler := handler.NewAuthHandler(store, cfg.JWTSecret)

	// ── Stripe (test mode) — secret yoksa Configured()==false, handler'lar 503 döner.
	stripeClient := payments.NewClient(cfg.StripeSecretKey, cfg.StripeWebhookSecret, cfg.PlatformFeePercent)
	if stripeClient.Configured() {
		log.Printf("Stripe yapılandırıldı (komisyon: %%%d, escrow %d gün)", cfg.PlatformFeePercent, cfg.EscrowReleaseDays)
	} else {
		log.Println("Stripe yapılandırılmadı — ödeme akışları devre dışı")
	}

	// ── E-Ticaret Handler'ları ────────────────────────────────────────────────
	productHandler := handler.NewProductHandler(store)
	orderHandler := handler.NewOrderHandler(store)
	sellerHandler := handler.NewSellerHandler(store, stripeClient, cfg)
	webhookHandler := handler.NewWebhookHandler(store, stripeClient, os.Getenv("EASYPOST_WEBHOOK_SECRET"))
	storefrontHandler := handler.NewStorefrontHandler(store)
	marketplaceHandler := handler.NewMarketplaceHandler(store, stripeClient, cfg.JWTSecret)
	buyerHandler := handler.NewBuyerHandler(store, stripeClient)
	questionsHandler := handler.NewQuestionsHandler(store)
	sellerOrdersHandler := handler.NewSellerOrdersHandler(store, stripeClient, cfg)

	// ── AI Handler'ı (Gemini) ─────────────────────────────────────────────────
	// GEMINI_API_KEY ortam değişkeni boşsa AI özellikleri devre dışı kalır;
	// uygulamanın geri kalanı normal çalışmaya devam eder.
	aiSiteBuilderHandler, aiErr := handler.NewAISiteBuilderHandler(store)
	if aiErr != nil {
		log.Printf("AI Site Builder devre dışı: %v", aiErr)
	}

	// AI Çözüm Asistanı (marketplace sorun çözücü) — Gemini gerektirir.
	aiSolverHandler, solverErr := handler.NewAISolverHandler(store)
	if solverErr != nil {
		log.Printf("AI Çözüm Asistanı devre dışı: %v", solverErr)
	}

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
	mux.Handle("POST /api/sites/{id}/unpublish", auth(http.HandlerFunc(siteHandler.Unpublish)))
	mux.Handle("DELETE /api/sites/{id}", auth(http.HandlerFunc(siteHandler.Delete)))

	// ── 🛒 E-Ticaret: Ürün API ───────────────────────────────────────────────
	mux.HandleFunc("GET /api/products", productHandler.List)                             // Herkes görebilir
	mux.HandleFunc("GET /api/products/{id}", productHandler.Get)                         // Herkes görebilir
	mux.Handle("POST /api/products", auth(http.HandlerFunc(productHandler.Create)))      // Satıcı
	mux.Handle("PUT /api/products/{id}", auth(http.HandlerFunc(productHandler.Update)))  // Satıcı
	mux.Handle("DELETE /api/products/{id}", auth(http.HandlerFunc(productHandler.Delete))) // Satıcı

	// ── 🛒 E-Ticaret: Sipariş API ────────────────────────────────────────────
	mux.Handle("GET /api/orders", auth(http.HandlerFunc(orderHandler.List)))
	mux.Handle("POST /api/orders", auth(http.HandlerFunc(orderHandler.Create)))
	mux.Handle("GET /api/orders/{id}", auth(http.HandlerFunc(orderHandler.Get)))

	// ── 🛒 E-Ticaret: Satıcı API ─────────────────────────────────────────────
	mux.Handle("GET /api/seller/dashboard", auth(http.HandlerFunc(sellerHandler.Dashboard)))
	mux.Handle("POST /api/seller/register", auth(http.HandlerFunc(sellerHandler.Register)))
	mux.Handle("POST /api/seller/connect", auth(http.HandlerFunc(sellerHandler.StripeConnect)))
	mux.Handle("POST /api/seller/shipments", auth(http.HandlerFunc(sellerHandler.CreateShipment)))

	// ── 🔗 Webhooks (auth yok — dış servislerden gelir, HMAC ile doğrulanır) ─
	mux.HandleFunc("POST /api/webhooks/easypost", webhookHandler.EasyPost)
	mux.HandleFunc("POST /api/webhooks/stripe", webhookHandler.Stripe)

	// ── 🛍️ Storefront API (auth yok — ziyaretçiler için) ─────────────────────
	mux.HandleFunc("POST /api/storefront/orders", storefrontHandler.CreateOrder)
	mux.HandleFunc("POST /api/storefront/orders/track", storefrontHandler.RequestOTP)
	mux.HandleFunc("POST /api/storefront/orders/verify", storefrontHandler.VerifyOTP)
	mux.HandleFunc("GET /api/storefront/orders/detail/{orderNumber}", storefrontHandler.GetOrderByNumber)
	mux.HandleFunc("GET /api/storefront/sites/{siteId}/products", storefrontHandler.ListProducts)

	// ── 🛒 Marketplace API (auth yok — herkes görebilir) ─────────────────────
	mux.HandleFunc("GET /api/marketplace/products", marketplaceHandler.ListProducts)
	mux.HandleFunc("GET /api/marketplace/products/{id}", marketplaceHandler.GetProduct)
	mux.HandleFunc("GET /api/marketplace/categories", marketplaceHandler.ListCategories)
	mux.HandleFunc("POST /api/marketplace/orders", marketplaceHandler.CreateOrder)
	mux.HandleFunc("GET /api/marketplace/orders/{orderNumber}", marketplaceHandler.GetOrder)
	mux.HandleFunc("POST /api/marketplace/orders/{id}/confirm-payment", marketplaceHandler.ConfirmPayment)

	// ── 👤 Marketplace Alıcı: profil / adresler / kayıtlı kartlar (auth) ─────
	mux.Handle("PUT /api/buyer/profile", auth(http.HandlerFunc(buyerHandler.UpdateProfile)))

	mux.Handle("GET /api/buyer/addresses", auth(http.HandlerFunc(buyerHandler.ListAddresses)))
	mux.Handle("POST /api/buyer/addresses", auth(http.HandlerFunc(buyerHandler.CreateAddress)))
	mux.Handle("PUT /api/buyer/addresses/{id}", auth(http.HandlerFunc(buyerHandler.UpdateAddress)))
	mux.Handle("DELETE /api/buyer/addresses/{id}", auth(http.HandlerFunc(buyerHandler.DeleteAddress)))
	mux.Handle("PUT /api/buyer/addresses/{id}/default", auth(http.HandlerFunc(buyerHandler.SetDefaultAddress)))

	mux.Handle("POST /api/buyer/payment-methods/setup-intent", auth(http.HandlerFunc(buyerHandler.CreateSetupIntent)))
	mux.Handle("GET /api/buyer/payment-methods", auth(http.HandlerFunc(buyerHandler.ListPaymentMethods)))
	mux.Handle("POST /api/buyer/payment-methods", auth(http.HandlerFunc(buyerHandler.AttachPaymentMethod)))
	mux.Handle("DELETE /api/buyer/payment-methods/{id}", auth(http.HandlerFunc(buyerHandler.DeletePaymentMethod)))
	mux.Handle("PUT /api/buyer/payment-methods/{id}/default", auth(http.HandlerFunc(buyerHandler.SetDefaultPaymentMethod)))
	mux.Handle("GET /api/buyer/orders", auth(http.HandlerFunc(marketplaceHandler.ListMyOrders)))
	mux.Handle("POST /api/buyer/orders/{id}/cancel", auth(http.HandlerFunc(marketplaceHandler.CancelByBuyer)))

	// ── ❓ Ürün Soruları (Q&A) ───────────────────────────────────────────────
	mux.HandleFunc("GET /api/marketplace/products/{id}/questions", questionsHandler.PublicList)
	mux.Handle("POST /api/marketplace/products/{id}/questions", auth(http.HandlerFunc(questionsHandler.Ask)))
	mux.Handle("GET /api/seller/questions", auth(http.HandlerFunc(questionsHandler.SellerList)))
	mux.Handle("POST /api/seller/questions/{id}/answer", auth(http.HandlerFunc(questionsHandler.Answer)))

	// ── 📦 Satıcı Marketplace Sipariş Yönetimi ───────────────────────────────
	mux.Handle("GET /api/seller/marketplace-orders", auth(http.HandlerFunc(sellerOrdersHandler.List)))
	mux.Handle("GET /api/seller/marketplace-orders/{id}", auth(http.HandlerFunc(sellerOrdersHandler.Get)))
	mux.Handle("POST /api/seller/marketplace-orders/{id}/approve", auth(http.HandlerFunc(sellerOrdersHandler.Approve)))
	mux.Handle("POST /api/seller/marketplace-orders/{id}/reject", auth(http.HandlerFunc(sellerOrdersHandler.Reject)))
	mux.Handle("POST /api/seller/marketplace-orders/{id}/cancel", auth(http.HandlerFunc(sellerOrdersHandler.Cancel)))
	mux.Handle("POST /api/seller/marketplace-orders/{id}/ship", auth(http.HandlerFunc(sellerOrdersHandler.Ship)))
	mux.Handle("POST /api/seller/marketplace-orders/{id}/mark-delivered", auth(http.HandlerFunc(sellerOrdersHandler.MarkDelivered)))
	mux.Handle("POST /api/seller/marketplace-orders/{id}/release-escrow", auth(http.HandlerFunc(sellerOrdersHandler.ReleaseEscrow)))
	mux.Handle("GET /api/seller/balance", auth(http.HandlerFunc(sellerOrdersHandler.Balance)))

	// ── 🤖 AI — Asenkron iş kuyruğu ──────────────────────────────────────────
	// Frontend job-tabanlı async API kullanır (başlat + poll). Lokal monolitte
	// SQS yok → AIJobHandler işleri arka plan goroutine'inde çalıştırır
	// (prod'da ai-api + ai-worker Lambda + SQS).
	aiJobHandler := handler.NewAIJobHandler(store, nil, aiSiteBuilderHandler, aiSolverHandler)
	mux.Handle("GET /api/ai/jobs/{id}", auth(http.HandlerFunc(aiJobHandler.GetJob)))
	if aiSiteBuilderHandler != nil {
		mux.Handle("POST /api/ai/build-site/plan", auth(http.HandlerFunc(aiJobHandler.StartPlan)))
		mux.Handle("POST /api/ai/build-site/execute", auth(http.HandlerFunc(aiJobHandler.StartExecute)))
	}
	if aiSolverHandler != nil {
		mux.Handle("POST /api/marketplace/ai-solver/solve", auth(http.HandlerFunc(aiJobHandler.StartSolve)))
		mux.Handle("POST /api/marketplace/ai-solver/solutions", auth(http.HandlerFunc(aiSolverHandler.SaveSolution)))
		mux.Handle("GET /api/marketplace/ai-solver/solutions", auth(http.HandlerFunc(aiSolverHandler.ListSolutions)))
		mux.Handle("GET /api/marketplace/ai-solver/solutions/{id}", auth(http.HandlerFunc(aiSolverHandler.GetSolution)))
	}

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
