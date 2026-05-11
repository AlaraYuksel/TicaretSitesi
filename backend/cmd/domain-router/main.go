// ═══════════════════════════════════════════════════════════════════════════════
// Domain Router Lambda — *.iluvcode.art isteklerini karşılar
// ═══════════════════════════════════════════════════════════════════════════════
//
// Cloudflare wildcard DNS: *.iluvcode.art → bu Lambda Function URL
//
// Akış:
//   1. Host header'dan subdomain parse et (ahmet.iluvcode.art → "ahmet")
//   2. S3 Published Sites bucket'ından /{ahmet}/index.html dosyasını çek
//   3. HTML olarak döndür
//
// Build:
//   GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bootstrap ./cmd/domain-router
//   zip domain-router.zip bootstrap
//
// Env vars:
//   S3_PUBLISHED_BUCKET — yayınlanmış sitelerin bucket adı
//   DOMAIN_NAME         — ana platform domain'i (iluvcode.art)
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

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var (
	s3Client   *s3.Client
	bucketName string
	domainName string
)

func init() {
	bucketName = os.Getenv("S3_PUBLISHED_BUCKET")
	domainName = os.Getenv("DOMAIN_NAME")

	if bucketName == "" {
		log.Fatal("S3_PUBLISHED_BUCKET env var gerekli")
	}
	if domainName == "" {
		log.Fatal("DOMAIN_NAME env var gerekli")
	}

	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		log.Fatalf("AWS config yüklenemedi: %v", err)
	}
	s3Client = s3.NewFromConfig(cfg)
}

func handler(ctx context.Context, req events.LambdaFunctionURLRequest) (events.LambdaFunctionURLResponse, error) {
	// ── 1. Host header'dan subdomain parse et ────────────────────────────────
	host := req.Headers["host"]
	if host == "" {
		return errorResponse(400, "Host header bulunamadı"), nil
	}

	// Port varsa temizle
	if i := strings.LastIndex(host, ":"); i > 0 {
		host = host[:i]
	}

	subdomain := extractSubdomain(host, domainName)
	if subdomain == "" || subdomain == "www" {
		return errorResponse(404, "Geçersiz subdomain"), nil
	}

	// ── 2. İstek path'ini belirle ────────────────────────────────────────────
	path := req.RawPath
	if path == "" || path == "/" {
		path = "/index.html"
	}

	// Güvenlik: path traversal engelle
	path = strings.TrimPrefix(path, "/")
	if strings.Contains(path, "..") {
		return errorResponse(400, "Geçersiz path"), nil
	}

	// S3 key: {subdomain}/{path}
	s3Key := fmt.Sprintf("%s/%s", subdomain, path)

	// ── 3. S3'ten dosyayı çek ────────────────────────────────────────────────
	result, err := s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: &bucketName,
		Key:    &s3Key,
	})
	if err != nil {
		// Dosya bulunamadı → SPA fallback: index.html dene
		if path != "index.html" {
			fallbackKey := fmt.Sprintf("%s/index.html", subdomain)
			result, err = s3Client.GetObject(ctx, &s3.GetObjectInput{
				Bucket: &bucketName,
				Key:    &fallbackKey,
			})
			if err != nil {
				return notFoundResponse(subdomain), nil
			}
		} else {
			return notFoundResponse(subdomain), nil
		}
	}
	defer result.Body.Close()

	body, err := io.ReadAll(result.Body)
	if err != nil {
		return errorResponse(500, "Dosya okunamadı"), nil
	}

	// ── 4. Content-Type belirle ve döndür ────────────────────────────────────
	contentType := detectContentType(path)
	isBinary := isBinaryContent(contentType)

	if isBinary {
		return events.LambdaFunctionURLResponse{
			StatusCode:      200,
			Headers:         responseHeaders(contentType, subdomain),
			Body:            base64.StdEncoding.EncodeToString(body),
			IsBase64Encoded: true,
		}, nil
	}

	return events.LambdaFunctionURLResponse{
		StatusCode: 200,
		Headers:    responseHeaders(contentType, subdomain),
		Body:       string(body),
	}, nil
}

// extractSubdomain — "ahmet.iluvcode.art" → "ahmet"
func extractSubdomain(host, domain string) string {
	suffix := "." + domain
	if !strings.HasSuffix(host, suffix) {
		return ""
	}
	sub := strings.TrimSuffix(host, suffix)
	// Çoklu seviye subdomain engelle (a.b.iluvcode.art → geçersiz)
	if strings.Contains(sub, ".") {
		return ""
	}
	return strings.ToLower(sub)
}

// detectContentType — dosya uzantısına göre MIME type belirle
func detectContentType(path string) string {
	ext := filepath.Ext(path)
	if ext == "" {
		return "text/html; charset=utf-8"
	}

	// Yaygın web dosyaları için hızlı lookup
	known := map[string]string{
		".html": "text/html; charset=utf-8",
		".css":  "text/css; charset=utf-8",
		".js":   "application/javascript; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".svg":  "image/svg+xml",
		".png":  "image/png",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".gif":  "image/gif",
		".webp": "image/webp",
		".ico":  "image/x-icon",
		".woff": "font/woff",
		".woff2": "font/woff2",
		".ttf":  "font/ttf",
	}
	if ct, ok := known[ext]; ok {
		return ct
	}
	if ct := mime.TypeByExtension(ext); ct != "" {
		return ct
	}
	return "application/octet-stream"
}

// isBinaryContent — binary dosya mı yoksa text mi?
func isBinaryContent(contentType string) bool {
	textPrefixes := []string{"text/", "application/javascript", "application/json", "image/svg"}
	for _, prefix := range textPrefixes {
		if strings.HasPrefix(contentType, prefix) {
			return false
		}
	}
	return true
}

// responseHeaders — standart response header'ları
func responseHeaders(contentType, subdomain string) map[string]string {
	return map[string]string{
		"Content-Type":              contentType,
		"Cache-Control":            cacheControl(contentType),
		"X-Served-By":             "domain-router",
		"X-Site":                   subdomain,
		"Access-Control-Allow-Origin": "*",
	}
}

// cacheControl — dosya tipine göre cache süresi
func cacheControl(contentType string) string {
	if strings.HasPrefix(contentType, "text/html") {
		return "public, max-age=300" // HTML: 5 dakika
	}
	if strings.HasPrefix(contentType, "image/") {
		return "public, max-age=2592000, immutable" // Görseller: 30 gün
	}
	// JS, CSS, fontlar: 7 gün
	return "public, max-age=604800, immutable"
}

func errorResponse(status int, msg string) events.LambdaFunctionURLResponse {
	return events.LambdaFunctionURLResponse{
		StatusCode: status,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       fmt.Sprintf(`{"error":"%s"}`, msg),
	}
}

func notFoundResponse(subdomain string) events.LambdaFunctionURLResponse {
	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Site Bulunamadı</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
    background: linear-gradient(135deg, #0a0c10 0%%, #111318 100%%);
    color: #e8eaf0;
  }
  .card {
    text-align: center; padding: 3rem;
    border: 1px solid rgba(255,255,255,0.07); border-radius: 16px;
    background: rgba(255,255,255,0.03);
  }
  h1 { font-size: 4rem; margin-bottom: 0.5rem; opacity: 0.3; }
  p  { color: #8b90a0; margin-bottom: 1rem; }
  a  { color: #3b82f6; text-decoration: none; }
</style>
</head>
<body>
<div class="card">
  <h1>404</h1>
  <p><strong>%s</strong> adresinde yayınlanmış bir site bulunamadı.</p>
  <a href="https://%s">Kendi siteni oluştur →</a>
</div>
</body>
</html>`, subdomain+"."+domainName, domainName)

	return events.LambdaFunctionURLResponse{
		StatusCode: 404,
		Headers:    map[string]string{"Content-Type": "text/html; charset=utf-8"},
		Body:       html,
	}
}

func main() {
	lambda.Start(handler)
}
