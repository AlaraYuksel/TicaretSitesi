// ═══════════════════════════════════════════════════════════════════════════════
// Domain Router Lambda — *.iluvcode.art isteklerini karşılar
// ═══════════════════════════════════════════════════════════════════════════════
//
// API Gateway (wildcard custom domain *.iluvcode.art) arkasında çalışır.
// (Önceden Lambda Function URL kullanıyordu; sandbox hesabı public Function URL
//  erişimini engellediği için API Gateway'e taşındı — servis-principal çağrı.)
//
// Akış:
//   1. Host header'dan subdomain parse et (ahmet.iluvcode.art → "ahmet")
//   2. S3 Published Sites bucket'ından /{ahmet}/{path} dosyasını çek
//   3. Döndür (binary'ler API Gateway adapter'ı tarafından base64'lenir)
//
// Env vars:
//   S3_PUBLISHED_BUCKET — yayınlanmış sitelerin bucket adı
//   DOMAIN_NAME         — ana platform domain'i (iluvcode.art)
// ═══════════════════════════════════════════════════════════════════════════════
package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"go-backend-projem/internal/lambdart"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type s3GetObjectAPI interface {
	GetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error)
}

var (
	s3Client   s3GetObjectAPI
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

func serve(w http.ResponseWriter, r *http.Request) {
	// ── 1. Host'tan subdomain ────────────────────────────────────────────────
	host := r.Host
	if i := strings.LastIndex(host, ":"); i > 0 {
		host = host[:i]
	}
	subdomain := extractSubdomain(host, domainName)
	if subdomain == "" || subdomain == "www" {
		writeNotFound(w, subdomain)
		return
	}

	// ── 2. Path ──────────────────────────────────────────────────────────────
	path := strings.TrimPrefix(r.URL.Path, "/")
	if path == "" {
		path = "index.html"
	}
	if strings.Contains(path, "..") {
		http.Error(w, `{"error":"Geçersiz path"}`, http.StatusBadRequest)
		return
	}

	// ── 3. S3'ten çek (yoksa SPA fallback: index.html) ───────────────────────
	body, err := fetch(r.Context(), subdomain+"/"+path)
	if err != nil {
		if path != "index.html" {
			body, err = fetch(r.Context(), subdomain+"/index.html")
		}
		if err != nil {
			writeNotFound(w, subdomain)
			return
		}
		path = "index.html"
	}

	contentType := detectContentType(path)
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", cacheControl(contentType))
	w.Header().Set("X-Served-By", "domain-router")
	w.Header().Set("X-Site", subdomain)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

func fetch(ctx context.Context, key string) ([]byte, error) {
	out, err := s3Client.GetObject(ctx, &s3.GetObjectInput{Bucket: &bucketName, Key: &key})
	if err != nil {
		return nil, err
	}
	defer out.Body.Close()
	return io.ReadAll(out.Body)
}

// extractSubdomain — "ahmet.iluvcode.art" → "ahmet" (tek seviye).
func extractSubdomain(host, domain string) string {
	suffix := "." + domain
	if !strings.HasSuffix(host, suffix) {
		return ""
	}
	sub := strings.TrimSuffix(host, suffix)
	if strings.Contains(sub, ".") {
		return "" // çoklu seviye subdomain reddedilir
	}
	return strings.ToLower(sub)
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
		".json": "application/json; charset=utf-8",
		".svg":  "image/svg+xml",
		".png":  "image/png",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".gif":  "image/gif",
		".webp": "image/webp",
		".ico":  "image/x-icon",
		".woff":  "font/woff",
		".woff2": "font/woff2",
		".ttf":   "font/ttf",
	}
	if ct, ok := known[ext]; ok {
		return ct
	}
	if ct := mime.TypeByExtension(ext); ct != "" {
		return ct
	}
	return "application/octet-stream"
}

func cacheControl(contentType string) string {
	switch {
	case strings.HasPrefix(contentType, "text/html"):
		return "public, max-age=300"
	case strings.HasPrefix(contentType, "image/"):
		return "public, max-age=2592000, immutable"
	default:
		return "public, max-age=604800, immutable"
	}
}

func writeNotFound(w http.ResponseWriter, subdomain string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusNotFound)
	label := subdomain
	if label == "" {
		label = "Bu adres"
	} else {
		label = subdomain + "." + domainName
	}
	fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Site Bulunamadı</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{min-height:100vh;display:flex;align-items:center;justify-content:center;
       font-family:system-ui,-apple-system,sans-serif;
       background:linear-gradient(135deg,#0a0c10,#111318);color:#e8eaf0}
  .card{text-align:center;padding:3rem;border:1px solid rgba(255,255,255,.07);
        border-radius:16px;background:rgba(255,255,255,.03)}
  h1{font-size:4rem;margin-bottom:.5rem;opacity:.3}
  p{color:#8b90a0;margin-bottom:1rem} a{color:#3b82f6;text-decoration:none}
</style></head><body><div class="card">
<h1>404</h1>
<p><strong>%s</strong> adresinde yayınlanmış bir site bulunamadı.</p>
<a href="https://%s">Kendi siteni oluştur →</a>
</div></body></html>`, label, domainName)
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/", serve)
	lambdart.StartHTTP(mux)
}
