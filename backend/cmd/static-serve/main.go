// ═══════════════════════════════════════════════════════════════════════════════
// Static Serve Lambda — iluvcode.art SPA isteklerini karşılar
// ═══════════════════════════════════════════════════════════════════════════════
//
// API Gateway $default route'undan tetiklenir.
// /api/* dışındaki tüm istekleri yakalar ve S3 React bucket'tan serve eder.
//
// Akış:
//   1. İstek path'ini al (/about, /dashboard, /static/js/main.js)
//   2. S3 React bucket'tan dosyayı çek
//   3. Dosya yoksa → index.html döndür (SPA client-side routing)
//
// Build:
//   GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bootstrap ./cmd/static-serve
//   zip static-serve.zip bootstrap
//
// Env vars:
//   S3_REACT_BUCKET  — React build dosyalarının bucket'ı
//   S3_ASSETS_BUCKET — Kullanıcı görselleri bucket'ı (opsiyonel)
// ═══════════════════════════════════════════════════════════════════════════════
package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"mime"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3GetObjectAPI interface {
	GetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error)
}

var (
	s3Client    S3GetObjectAPI
	reactBucket string
	assetsBucket string

	// index.html cache — her deploy'da Lambda yeniden başlar, cache temizlenir
	indexCache     []byte
	indexCacheMu   sync.RWMutex
	indexCacheTime time.Time
	indexCacheTTL  = 60 * time.Second // 60 saniye cache
)

func init() {
	reactBucket = os.Getenv("S3_REACT_BUCKET")
	assetsBucket = os.Getenv("S3_ASSETS_BUCKET")

	if reactBucket == "" {
		log.Fatal("S3_REACT_BUCKET env var gerekli")
	}

	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		log.Fatalf("AWS config yüklenemedi: %v", err)
	}
	s3Client = s3.NewFromConfig(cfg)
}

func handler(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	path := req.RawPath
	if path == "" {
		path = "/"
	}

	// Güvenlik: path traversal engelle
	if strings.Contains(path, "..") {
		return errorResp(400, "Geçersiz path"), nil
	}

	// /api/* istekleri bu Lambda'ya gelmemeli — API Gateway route'ları yakalar
	// Ama güvenlik için kontrol et
	if strings.HasPrefix(path, "/api/") {
		return errorResp(404, "API endpoint bulunamadı"), nil
	}

	// ── /assets/* → Assets bucket'tan serve et ───────────────────────────────
	if strings.HasPrefix(path, "/assets/") && assetsBucket != "" {
		return serveFromBucket(ctx, assetsBucket, strings.TrimPrefix(path, "/"))
	}

	// ── Diğer tüm istekler → React bucket'tan serve et ──────────────────────
	return serveReactApp(ctx, path)
}

func serveReactApp(ctx context.Context, path string) (events.APIGatewayV2HTTPResponse, error) {
	// Root → index.html
	if path == "/" {
		return serveIndexHTML(ctx)
	}

	// Dosya uzantısı varsa (js, css, png vb.) → doğrudan S3'ten çek
	s3Key := strings.TrimPrefix(path, "/")
	if hasFileExtension(s3Key) {
		resp, err := serveFromBucket(ctx, reactBucket, s3Key)
		if err != nil {
			return resp, err
		}
		// Dosya bulunamadı → SPA fallback
		if resp.StatusCode == 404 {
			return serveIndexHTML(ctx)
		}
		return resp, nil
	}

	// Uzantısız path (/about, /dashboard) → SPA route, index.html döndür
	return serveIndexHTML(ctx)
}

func serveIndexHTML(ctx context.Context) (events.APIGatewayV2HTTPResponse, error) {
	// Cache kontrol
	indexCacheMu.RLock()
	if indexCache != nil && time.Since(indexCacheTime) < indexCacheTTL {
		cached := string(indexCache)
		indexCacheMu.RUnlock()
		return events.APIGatewayV2HTTPResponse{
			StatusCode: 200,
			Headers: map[string]string{
				"Content-Type":  "text/html; charset=utf-8",
				"Cache-Control": "public, max-age=60",
				"X-Served-By":   "static-serve",
				"X-Cache":       "HIT",
			},
			Body: cached,
		}, nil
	}
	indexCacheMu.RUnlock()

	// S3'ten çek
	key := "index.html"
	result, err := s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: &reactBucket,
		Key:    &key,
	})
	if err != nil {
		return errorResp(503, "React uygulaması yüklenemedi — S3'e deploy edilmemiş olabilir"), nil
	}
	defer result.Body.Close()

	body, err := io.ReadAll(result.Body)
	if err != nil {
		return errorResp(500, "index.html okunamadı"), nil
	}

	// Cache güncelle
	indexCacheMu.Lock()
	indexCache = body
	indexCacheTime = time.Now()
	indexCacheMu.Unlock()

	return events.APIGatewayV2HTTPResponse{
		StatusCode: 200,
		Headers: map[string]string{
			"Content-Type":  "text/html; charset=utf-8",
			"Cache-Control": "public, max-age=60",
			"X-Served-By":   "static-serve",
			"X-Cache":       "MISS",
		},
		Body: string(body),
	}, nil
}

func serveFromBucket(ctx context.Context, bucket, key string) (events.APIGatewayV2HTTPResponse, error) {
	result, err := s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: &bucket,
		Key:    &key,
	})
	if err != nil {
		return events.APIGatewayV2HTTPResponse{
			StatusCode: 404,
			Headers:    map[string]string{"Content-Type": "application/json"},
			Body:       `{"error":"Dosya bulunamadı"}`,
		}, nil
	}
	defer result.Body.Close()

	body, err := io.ReadAll(result.Body)
	if err != nil {
		return errorResp(500, "Dosya okunamadı"), nil
	}

	contentType := detectContentType(key)
	isBinary := isBinaryContent(contentType)

	headers := map[string]string{
		"Content-Type":  contentType,
		"Cache-Control": cacheControlForPath(key, contentType),
		"X-Served-By":   "static-serve",
	}

	if isBinary {
		return events.APIGatewayV2HTTPResponse{
			StatusCode:      200,
			Headers:         headers,
			Body:            base64.StdEncoding.EncodeToString(body),
			IsBase64Encoded: true,
		}, nil
	}

	return events.APIGatewayV2HTTPResponse{
		StatusCode: 200,
		Headers:    headers,
		Body:       string(body),
	}, nil
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

func hasFileExtension(path string) bool {
	ext := filepath.Ext(path)
	return ext != "" && len(ext) <= 6 // .woff2 = 6 karakter
}

func detectContentType(path string) string {
	ext := filepath.Ext(path)
	if ext == "" {
		return "text/html; charset=utf-8"
	}

	known := map[string]string{
		".html": "text/html; charset=utf-8",
		".css":  "text/css; charset=utf-8",
		".js":   "application/javascript; charset=utf-8",
		".mjs":  "application/javascript; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".map":  "application/json; charset=utf-8",
		".svg":  "image/svg+xml",
		".png":  "image/png",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".gif":  "image/gif",
		".webp": "image/webp",
		".avif": "image/avif",
		".ico":  "image/x-icon",
		".woff":  "font/woff",
		".woff2": "font/woff2",
		".ttf":   "font/ttf",
		".eot":   "application/vnd.ms-fontobject",
		".mp4":   "video/mp4",
		".webm":  "video/webm",
	}
	if ct, ok := known[ext]; ok {
		return ct
	}
	if ct := mime.TypeByExtension(ext); ct != "" {
		return ct
	}
	return "application/octet-stream"
}

func isBinaryContent(contentType string) bool {
	textPrefixes := []string{
		"text/",
		"application/javascript",
		"application/json",
		"image/svg",
	}
	for _, prefix := range textPrefixes {
		if strings.HasPrefix(contentType, prefix) {
			return false
		}
	}
	return true
}

// cacheControlForPath — Vite hash'li dosyalar uzun cache, index.html kısa
func cacheControlForPath(path, contentType string) string {
	// Vite build çıktıları hash içerir: main.a1b2c3d4.js
	// Bu dosyalar immutable cache'lenebilir
	if strings.Contains(path, "/assets/") || strings.Contains(path, ".") {
		base := filepath.Base(path)
		parts := strings.Split(base, ".")
		// dosya.HASH.ext formatı → immutable
		if len(parts) >= 3 {
			return "public, max-age=31536000, immutable" // 1 yıl
		}
	}

	if strings.HasPrefix(contentType, "text/html") {
		return "public, max-age=60" // HTML: 1 dakika
	}
	if strings.HasPrefix(contentType, "image/") {
		return "public, max-age=2592000" // Görseller: 30 gün
	}
	// Diğer: 1 saat
	return "public, max-age=3600"
}

func errorResp(status int, msg string) events.APIGatewayV2HTTPResponse {
	// HTML hata sayfası
	if status >= 500 {
		return events.APIGatewayV2HTTPResponse{
			StatusCode: status,
			Headers:    map[string]string{"Content-Type": "text/html; charset=utf-8"},
			Body: fmt.Sprintf(`<!DOCTYPE html>
<html><head><title>Hata %d</title></head>
<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;background:#0a0c10;color:#e8eaf0">
<div style="text-align:center">
<h1 style="font-size:4rem;opacity:0.3">%d</h1>
<p style="color:#8b90a0">%s</p>
</div></body></html>`, status, status, msg),
		}
	}
	return events.APIGatewayV2HTTPResponse{
		StatusCode: status,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       fmt.Sprintf(`{"error":"%s","status":%d}`, msg, status),
	}
}

func main() {
	lambda.Start(handler)
}
