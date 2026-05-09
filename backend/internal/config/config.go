package config

import (
	"fmt"
	"os"
)

// Config uygulama genelinde kullanılan ortam değişkenlerini tutar.
// Tüm değerler Docker Compose environment: bloğundan gelir.
type Config struct {
	DatabaseURL    string // postgres://user:pass@host:5432/dbname
	Port           string // default: 8080
	AppDomain      string // örn:
	CognitoJWKSURL string // https://cognito-idp.{region}.amazonaws.com/{poolId}/.well-known/jwks.json
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

	return &Config{
		DatabaseURL:    dbURL,
		Port:           port,
		AppDomain:      os.Getenv("APP_DOMAIN"),       // örn: "websitedomaini.com"
		CognitoJWKSURL: os.Getenv("COGNITO_JWKS_URL"), // Cognito eklendiğinde doldurulacak
	}, nil
}
