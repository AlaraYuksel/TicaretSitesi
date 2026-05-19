package handler

import (
	"net/http"
	"strings"

	"go-backend-projem/internal/config"
	"go-backend-projem/internal/db"
	"go-backend-projem/internal/render"
)

// ServeHandler — domain routing'in kalbi.
//
// Akış:
//   GET https://merhaba.websitedomaini.com
//   → Host header'dan "merhaba" al
//   → sites tablosunda subdomain = "merhaba" bul
//   → site_data JSONB'den HTML üret ve serve et
type ServeHandler struct {
	store  *db.Store
	config *config.Config
}

func NewServeHandler(store *db.Store, cfg *config.Config) *ServeHandler {
	return &ServeHandler{store: store, config: cfg}
}

func (h *ServeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	host := r.Host

	// Port varsa temizle (örn: localhost:8080 → localhost)
	if i := strings.LastIndex(host, ":"); i > 0 {
		host = host[:i]
	}

	var subdomain, customDomain string

	if h.config.AppDomain != "" && strings.HasSuffix(host, "."+h.config.AppDomain) {
		// merhaba.websitedomaini.com → "merhaba"
		subdomain = strings.TrimSuffix(host, "."+h.config.AppDomain)
	} else {
		// www.kullanicinin-domaini.com → custom domain araması
		customDomain = host
	}

	site, err := h.store.GetSiteByDomain(r.Context(), subdomain, customDomain)
	if err != nil {
		http.Error(w, notFoundPage(), http.StatusNotFound)
		return
	}

	htmlOutput, err := render.GenerateHTML(site)
	if err != nil {
		http.Error(w, "Sayfa oluşturulamadı", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(htmlOutput))
}

func notFoundPage() string {
	return `<!DOCTYPE html>
<html><head><title>404 - Sayfa Bulunamadı</title></head>
<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui">
<div style="text-align:center"><h1 style="font-size:4rem;margin-bottom:1rem">404</h1>
<p>Bu adrese ait bir site bulunamadı.</p></div>
</body></html>`
}
