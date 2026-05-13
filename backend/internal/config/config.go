package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config uygulama genelinde kullanılan ortam değişkenlerini tutar.
// Tüm değerler Docker Compose environment: bloğundan gelir.
type Config struct {
	DatabaseURL    string // postgres://user:pass@host:5432/dbname
	Port           string // default: 8080
	AppDomain      string // örn:
	CognitoJWKSURL string // https://cognito-idp.{region}.amazonaws.com/{poolId}/.well-known/jwks.json

	// 🔄 COGNITO_SWITCH: Lokal auth için JWT secret.
	// Cognito'ya geçildiğinde bu alan kaldırılabilir.
	JWTSecret string

	// Stripe — test mode (sk_test_*, pk_test_*, whsec_*)
	StripeSecretKey      string
	StripePublishableKey string
	StripeWebhookSecret  string
	PlatformFeePercent   int // örn: 5 → satıcıdan komisyon %5
	EscrowReleaseDays    int // teslimattan kaç gün sonra escrow release edilebilir

	// Frontend dönüş URL'leri (Stripe Connect onboarding redirect'leri için)
	FrontendBaseURL string
}

// Load ortam değişkenlerini okur ve Config döner.
// Zorunlu değişken eksikse hata döner — uygulama başlamaz.
func Load() (*Config, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL ortam değişkeni zorunludur")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// 🔄 COGNITO_SWITCH: Lokal auth'da JWT_SECRET zorunludur.
	// Cognito'ya geçildiğinde bu kontrol kaldırılır.
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "dev-secret-change-in-production-min-32-chars!!"
	}

	// Stripe (test mode). Boş bırakılırsa Stripe çağrıları handler tarafında 503 döner.
	feePct := atoiOr(os.Getenv("PLATFORM_FEE_PERCENT"), 5)
	if feePct < 0 || feePct > 100 {
		return nil, fmt.Errorf("PLATFORM_FEE_PERCENT 0-100 arası olmalı")
	}
	escrowDays := atoiOr(os.Getenv("ESCROW_RELEASE_DAYS"), 7)
	if escrowDays < 0 {
		return nil, fmt.Errorf("ESCROW_RELEASE_DAYS negatif olamaz")
	}

	frontend := os.Getenv("FRONTEND_BASE_URL")
	if frontend == "" {
		frontend = "http://localhost"
	}

	return &Config{
		DatabaseURL:          dbURL,
		Port:                 port,
		AppDomain:            os.Getenv("APP_DOMAIN"),       // örn: "websitedomaini.com"
		CognitoJWKSURL:       os.Getenv("COGNITO_JWKS_URL"), // Cognito eklendiğinde doldurulacak
		JWTSecret:            jwtSecret,
		StripeSecretKey:      os.Getenv("STRIPE_SECRET_KEY"),
		StripePublishableKey: os.Getenv("STRIPE_PUBLISHABLE_KEY"),
		StripeWebhookSecret:  os.Getenv("STRIPE_WEBHOOK_SECRET"),
		PlatformFeePercent:   feePct,
		EscrowReleaseDays:    escrowDays,
		FrontendBaseURL:      frontend,
	}, nil
}

func atoiOr(s string, fallback int) int {
	if s == "" {
		return fallback
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return fallback
	}
	return v
}
