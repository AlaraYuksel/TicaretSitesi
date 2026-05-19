// Package lambdart, monolit HTTP backend'in AWS Lambda entrypoint'lerinde
// yeniden kullanılabilmesi için ortak altyapı sağlar.
//
// Her cmd/<lambda>/main.go şunu yapar:
//  1. lambdart.MustLoad() ile cold-start'ta config + DB pool + handler'ları kurar
//     (sync.Once ile — warm invocation'larda yeniden kurulmaz).
//  2. Kendi route alt-kümesini bir http.ServeMux'a kaydeder (route'lar main.go'dan).
//  3. lambdart.StartHTTP(mux) (API Gateway) veya lambdart.StartSQS(fn) (kuyruk) çağırır.
package lambdart

import (
	"context"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"go-backend-projem/internal/ai"
	"go-backend-projem/internal/config"
	"go-backend-projem/internal/db"
	"go-backend-projem/internal/handler"
	"go-backend-projem/internal/middleware"
	"go-backend-projem/internal/payments"
	"go-backend-projem/internal/queue"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Deps, bir Lambda'nın ihtiyaç duyabileceği tüm bağımlılıkları taşır.
// Tek bir cmd genelde bunların yalnızca bir alt kümesini kullanır; hepsini
// kurmanın maliyeti (struct oluşturma) ihmal edilebilir.
type Deps struct {
	Cfg    *config.Config
	Pool   *pgxpool.Pool
	Store  *db.Store
	Stripe *payments.Client
	Gemini *ai.GeminiClient

	// Auth, JWT doğrulayan middleware — main.go'daki `auth` ile aynı.
	Auth func(http.Handler) http.Handler

	Site         *handler.SiteHandler
	Serve        *handler.ServeHandler
	AuthH        *handler.AuthHandler
	Product      *handler.ProductHandler
	Order        *handler.OrderHandler
	Seller       *handler.SellerHandler
	Webhook      *handler.WebhookHandler
	Storefront   *handler.StorefrontHandler
	Marketplace  *handler.MarketplaceHandler
	Buyer        *handler.BuyerHandler
	Questions    *handler.QuestionsHandler
	SellerOrders *handler.SellerOrdersHandler
	// AI handler'ları GEMINI_API_KEY yoksa nil kalır.
	AISiteBuilder *handler.AISiteBuilderHandler
	AISolver      *handler.AISolverHandler
}

var (
	loadOnce sync.Once
	deps     *Deps
	loadErr  error
)

// Load, bağımlılıkları (idempotent) kurar. İlk çağrıda config okunur, DB pool
// açılır, handler'lar oluşturulur; sonraki çağrılar aynı *Deps'i döndürür.
// Lambda container'ı yeniden kullanıldığında pool paylaşılır.
func Load() (*Deps, error) {
	loadOnce.Do(func() {
		deps, loadErr = build()
	})
	return deps, loadErr
}

// MustLoad, Load'ı çağırır; hata varsa süreci sonlandırır (cold-start fail-fast).
func MustLoad() *Deps {
	d, err := Load()
	if err != nil {
		log.Fatalf("lambdart: bağımlılıklar yüklenemedi: %v", err)
	}
	return d
}

func build() (*Deps, error) {
	// Lambda'da her eşzamanlı çağrı kendi pool'unu açar → küçük pool kullan.
	// Çağıran terraform DB_MAX_CONNS set etmediyse güvenli bir varsayılan koy.
	if os.Getenv("DB_MAX_CONNS") == "" {
		_ = os.Setenv("DB_MAX_CONNS", "4")
	}

	cfg, err := config.Load()
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	store := db.NewStore(pool)

	// Gemini — GEMINI_API_KEY yoksa nil; AI dışı Lambda'lar etkilenmez.
	gemini, gErr := ai.NewGeminiClient()
	if gErr != nil {
		log.Printf("lambdart: Gemini devre dışı: %v", gErr)
		gemini = nil
	}

	stripe := payments.NewClient(cfg.StripeSecretKey, cfg.StripeWebhookSecret, cfg.PlatformFeePercent)

	d := &Deps{
		Cfg:          cfg,
		Pool:         pool,
		Store:        store,
		Stripe:       stripe,
		Gemini:       gemini,
		Auth:         middleware.JWTAuth(cfg.JWTSecret),
		Site:         handler.NewSiteHandler(store, gemini),
		Serve:        handler.NewServeHandler(store, cfg),
		AuthH:        handler.NewAuthHandler(store, cfg.JWTSecret),
		Product:      handler.NewProductHandler(store),
		Order:        handler.NewOrderHandler(store),
		Seller:       handler.NewSellerHandler(store, stripe, cfg),
		Webhook:      handler.NewWebhookHandler(store, stripe, os.Getenv("EASYPOST_WEBHOOK_SECRET")),
		Storefront:   handler.NewStorefrontHandler(store),
		Marketplace:  handler.NewMarketplaceHandler(store, stripe, cfg.JWTSecret),
		Buyer:        handler.NewBuyerHandler(store, stripe),
		Questions:    handler.NewQuestionsHandler(store),
		SellerOrders: handler.NewSellerOrdersHandler(store, stripe, cfg),
	}

	// AI handler'ları — Gemini gerektirir; yoksa nil bırakılır.
	if sb, err := handler.NewAISiteBuilderHandler(store); err != nil {
		log.Printf("lambdart: AI Site Builder devre dışı: %v", err)
	} else {
		d.AISiteBuilder = sb
	}
	if sv, err := handler.NewAISolverHandler(store); err != nil {
		log.Printf("lambdart: AI Solver devre dışı: %v", err)
	} else {
		d.AISolver = sv
	}

	wireQueues(ctx, d)
	return d, nil
}

// wireQueues, ilgili SQS kuyruk URL'leri ortamda tanımlıysa publish/finance
// hook'larını bağlar. URL yoksa (lokal/Docker) hook nil kalır.
func wireQueues(ctx context.Context, d *Deps) {
	if url := os.Getenv("SQS_PUBLISH_URL"); url != "" {
		if sender, err := queue.NewSender(ctx, url); err != nil {
			log.Printf("lambdart: publish SQS gönderici kurulamadı: %v", err)
		} else {
			d.Site.OnPublish = func(ctx context.Context, site *db.Site) {
				sub := ""
				if site.Subdomain != nil {
					sub = *site.Subdomain
				}
				msg := queue.PublishMessage{SiteID: site.ID, UserID: site.UserID, Subdomain: sub}
				if err := sender.Send(ctx, msg); err != nil {
					log.Printf("lambdart: publish SQS gönderimi başarısız: %v", err)
				}
			}
		}
	}

	if url := os.Getenv("SQS_FINANCE_URL"); url != "" {
		if sender, err := queue.NewSender(ctx, url); err != nil {
			log.Printf("lambdart: finance SQS gönderici kurulamadı: %v", err)
		} else {
			d.Webhook.OnDelivered = func(ctx context.Context, trackerID, trackingCode string) {
				msg := queue.FinanceMessage{
					EventType:    "easypost.delivered",
					TrackerID:    trackerID,
					TrackingCode: trackingCode,
				}
				if err := sender.Send(ctx, msg); err != nil {
					log.Printf("lambdart: finance SQS gönderimi başarısız: %v", err)
				}
			}
		}
	}
}
