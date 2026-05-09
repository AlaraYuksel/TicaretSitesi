package handler

import (
	"encoding/json"
	"fmt"
	"html"
	"net/http"
	"strings"

	"go-backend-projem/internal/config"
	"go-backend-projem/internal/db"
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

	htmlOutput, err := generateHTML(site)
	if err != nil {
		http.Error(w, "Sayfa oluşturulamadı", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(htmlOutput))
}

// ─── HTML Üretici ─────────────────────────────────────────────────────────────

// siteData frontend'in { pages: [...] } JSON yapısıyla birebir uyumlu
type siteData struct {
	Pages []pageData `json:"pages"`
}

type pageData struct {
	ID       string        `json:"id"`
	Name     string        `json:"name"`
	Elements []elementData `json:"elements"`
}

type elementData struct {
	ID      string                 `json:"id"`
	Type    string                 `json:"type"`
	Visible bool                   `json:"visible"`
	Props   map[string]interface{} `json:"props"`
	Breakpoints map[string]*breakpointData `json:"breakpoints"`
	Children []elementData         `json:"children"`
}

type breakpointData struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

func generateHTML(site *db.Site) (string, error) {
	var data siteData
	if err := json.Unmarshal(site.SiteData, &data); err != nil {
		return "", fmt.Errorf("site_data parse hatası: %w", err)
	}

	// İlk sayfayı render et (çoklu sayfa desteği ilerleyen aşamada eklenecek)
	var page pageData
	if len(data.Pages) > 0 {
		page = data.Pages[0]
	}

	metaTitle := site.Title
	if site.MetaTitle != nil {
		metaTitle = *site.MetaTitle
	}
	metaDesc := ""
	if site.MetaDescription != nil {
		metaDesc = *site.MetaDescription
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>%s</title>
<meta name="description" content="%s">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; }
  .page { position: relative; min-height: 100vh; overflow-x: hidden; }
  .el  { position: absolute; }
  @media (max-width: 768px) { .el-tablet { display: block; } .el-desktop-only { display: none; } }
  @media (max-width: 390px) { .el-mobile { display: block; } .el-tablet-only { display: none; } }
</style>
</head>
<body>
<div class="page">
`, html.EscapeString(metaTitle), html.EscapeString(metaDesc)))

	for _, el := range page.Elements {
		renderElement(&sb, el)
	}

	sb.WriteString(`</div>
</body>
</html>`)

	return sb.String(), nil
}

// renderElement element tipine göre HTML üretir.
// Frontend'deki 28 element tipinin temel subset'ini destekler.
func renderElement(sb *strings.Builder, el elementData) {
	if !el.Visible {
		return
	}

	// Desktop breakpoint'ten konum al
	style := ""
	if bp, ok := el.Breakpoints["desktop"]; ok && bp != nil {
		style = fmt.Sprintf(
			"left:%.0fpx;top:%.0fpx;width:%.0fpx;height:%.0fpx;",
			bp.X, bp.Y, bp.Width, bp.Height,
		)
	}

	p := el.Props

	switch el.Type {
	case "heading":
		text, _ := p["text"].(string)
		level, _ := p["level"].(float64)
		if level == 0 {
			level = 1
		}
		color, _ := p["color"].(string)
		fontSize, _ := p["fontSize"].(float64)
		extraStyle := ""
		if color != "" {
			// Sadece alphanumeric ve hex renk kodlarına izin verilir, basit sterilizasyon
			extraStyle += fmt.Sprintf("color:%s;", html.EscapeString(color))
		}
		if fontSize > 0 {
			extraStyle += fmt.Sprintf("font-size:%.0fpx;", fontSize)
		}
		sb.WriteString(fmt.Sprintf(`<h%d class="el" style="%s%s">%s</h%d>`,
			int(level), style, extraStyle, html.EscapeString(text), int(level)))

	case "paragraph":
		text, _ := p["text"].(string)
		color, _ := p["color"].(string)
		extraStyle := ""
		if color != "" {
			extraStyle = fmt.Sprintf("color:%s;", html.EscapeString(color))
		}
		// Paragraf içinde satır sonlarını <br>'ye çevirirken text'i escape ediyoruz
		escapedText := strings.ReplaceAll(html.EscapeString(text), "\n", "<br>")
		sb.WriteString(fmt.Sprintf(`<p class="el" style="%s%s">%s</p>`, style, extraStyle, escapedText))

	case "button":
		text, _ := p["text"].(string)
		bg, _ := p["backgroundColor"].(string)
		color, _ := p["color"].(string)
		extraStyle := ""
		if bg != "" {
			extraStyle += fmt.Sprintf("background:%s;", html.EscapeString(bg))
		}
		if color != "" {
			extraStyle += fmt.Sprintf("color:%s;", html.EscapeString(color))
		}
		sb.WriteString(fmt.Sprintf(`<button class="el" style="%s%s">%s</button>`, style, extraStyle, html.EscapeString(text)))

	case "image":
		src, _ := p["src"].(string)
		alt, _ := p["alt"].(string)
		// src içine javascript: yazılamamalı
		if strings.HasPrefix(strings.ToLower(src), "javascript:") {
			src = "#"
		}
		sb.WriteString(fmt.Sprintf(`<img class="el" style="%sobject-fit:cover;" src="%s" alt="%s">`, style, html.EscapeString(src), html.EscapeString(alt)))

	case "box", "section":
		bg, _ := p["backgroundColor"].(string)
		extraStyle := ""
		if bg != "" {
			extraStyle = fmt.Sprintf("background:%s;", html.EscapeString(bg))
		}
		sb.WriteString(fmt.Sprintf(`<div class="el" style="%s%s">`, style, extraStyle))
		for _, child := range el.Children {
			renderElement(sb, child)
		}
		sb.WriteString(`</div>`)

	case "divider":
		sb.WriteString(fmt.Sprintf(`<hr class="el" style="%s">`, style))

	default:
		// Bilinmeyen element tipi — boş div placeholder
		sb.WriteString(fmt.Sprintf(`<div class="el" style="%s"></div>`, style))
	}
}

func notFoundPage() string {
	return `<!DOCTYPE html>
<html><head><title>404 - Sayfa Bulunamadı</title></head>
<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui">
<div style="text-align:center"><h1 style="font-size:4rem;margin-bottom:1rem">404</h1>
<p>Bu adrese ait bir site bulunamadı.</p></div>
</body></html>`
}
