package ai

import "fmt"

// defaultProps — useEditorStore.js'teki defaultProps() fonksiyonunun Go portu.
// En sık kullanılan element tipleri için makul varsayılan props döndürür.
// Eksik tipler için boş map döner (Gemini kendi propslarını set edebilir).
func defaultProps(elementType string) map[string]interface{} {
	switch elementType {
	case "heading":
		return map[string]interface{}{
			"text": "Yeni Başlık", "fontSize": 48, "fontWeight": "800",
			"color": "#e5e2e1", "align": "left", "lineHeight": 1.15,
		}
	case "paragraph":
		return map[string]interface{}{
			"text": "Buraya metin yazın.", "fontSize": 16, "fontWeight": "400",
			"color": "#9ca3af", "align": "left", "lineHeight": 1.65,
		}
	case "button":
		return map[string]interface{}{
			"text": "Tıkla", "bg": "#4b8eff", "color": "#ffffff",
			"fontSize": 15, "fontWeight": "700", "borderRadius": 8,
			"paddingX": 24, "paddingY": 12, "href": "",
		}
	case "image":
		return map[string]interface{}{
			"src":          "https://placehold.co/600x400/1a1a1a/4b8eff?text=Görsel",
			"alt":          "Görsel",
			"objectFit":    "cover",
			"borderRadius": 8,
		}
	case "box":
		return map[string]interface{}{
			"bg": "#1c1b1b", "borderRadius": 12, "opacity": 100,
		}
	case "section":
		return map[string]interface{}{
			"bg": "#141414", "borderRadius": 12, "padding": 24,
		}
	case "hero":
		return map[string]interface{}{
			"tag":      "YENİ",
			"title":    "Hoş Geldiniz",
			"subtitle": "Sitemizde sizleri ağırlamaktan mutluluk duyuyoruz.",
			"ctaText":  "Keşfet",
			"bg":       "#0e0e0e",
		}
	case "navbar":
		return map[string]interface{}{
			"brand": "Marka",
			"items": []map[string]string{
				{"label": "Anasayfa", "href": "#"},
				{"label": "Hakkımızda", "href": "#"},
				{"label": "İletişim", "href": "#"},
			},
			"bg":    "#0a0a0a",
			"color": "#e5e2e1",
		}
	case "minimalistNavbar":
		return map[string]interface{}{
			"brand": "Marka",
			"items": []map[string]string{
				{"label": "Ürünler", "href": "#"},
				{"label": "Sepet", "href": "#"},
			},
			"bg":    "#ffffff",
			"color": "#1a1a1a",
		}
	case "card":
		return map[string]interface{}{
			"title":       "Kart Başlığı",
			"description": "Bu bir kart açıklamasıdır.",
			"image":       "https://placehold.co/400x300/1a1a1a/4b8eff?text=Kart",
			"buttonText":  "Detay",
		}
	case "form":
		return map[string]interface{}{
			"fields": []map[string]string{
				{"id": "f1", "type": "text", "label": "Ad Soyad", "placeholder": "Adınızı girin"},
				{"id": "f2", "type": "email", "label": "E-posta", "placeholder": "ornek@email.com"},
				{"id": "f3", "type": "textarea", "label": "Mesaj", "placeholder": "Mesajınız..."},
			},
			"submitText": "Gönder",
			"submitBg":   "#4b8eff",
			"submitColor": "#ffffff",
		}
	case "testimonial":
		return map[string]interface{}{
			"quote":  "Harika bir hizmet aldım, kesinlikle tavsiye ederim!",
			"author": "Ahmet Yılmaz",
			"role":   "Müşteri",
		}
	case "badge":
		return map[string]interface{}{
			"text": "YENİ", "bg": "#4b8eff", "color": "#ffffff",
		}
	case "divider":
		return map[string]interface{}{
			"color": "rgba(255,255,255,0.1)", "thickness": 1,
		}
	case "icon":
		return map[string]interface{}{
			"name": "star", "size": 32, "color": "#4b8eff",
		}
	case "productCard":
		return map[string]interface{}{
			"title":         "Ürün Adı",
			"description":   "Ürün açıklaması burada.",
			"price":         99.99,
			"currency":      "TL",
			"imageSrc":      "https://placehold.co/400x400/1a1a1a/4b8eff?text=Ürün",
			"imageAlt":      "Ürün",
			"rating":        4.5,
			"reviewCount":   12,
			"badge":         "",
			"showRating":    true,
		}
	case "productGrid":
		return map[string]interface{}{
			"columns":          3,
			"gap":              20,
			"padding":          24,
			"sectionTitle":     "Öne Çıkan Ürünler",
			"sectionTitleSize": 24,
			"products": []map[string]interface{}{
				{"id": "p1", "title": "Ürün 1", "price": 99.99, "image": "https://placehold.co/400x400/1a1a1a/4b8eff?text=1", "rating": 4.5, "badge": "YENİ"},
				{"id": "p2", "title": "Ürün 2", "price": 149.99, "image": "https://placehold.co/400x400/1a1a1a/4b8eff?text=2", "rating": 4.7, "badge": ""},
				{"id": "p3", "title": "Ürün 3", "price": 79.99, "image": "https://placehold.co/400x400/1a1a1a/4b8eff?text=3", "rating": 4.3, "badge": "İNDİRİM"},
			},
			"cardBg":     "#1a1a1a",
			"priceColor": "#4b8eff",
			"titleColor": "#e5e2e1",
		}
	case "productListing":
		return map[string]interface{}{
			"pageTitle":    "Tüm Ürünler",
			"pageLabel":    "Koleksiyon",
			"columns":      4,
			"showFilters":  true,
			"products":     []map[string]interface{}{},
			"primaryColor": "#1a1a1a",
			"textColor":    "#1a1a1a",
			"accentColor":  "#4b8eff",
		}
	case "productDetailHero":
		return map[string]interface{}{
			"productName": "Ürün Adı",
			"productDesc": "Ürün detaylı açıklaması.",
			"price":       199.99,
			"colors": []map[string]string{
				{"id": "c1", "hex": "#000000", "label": "Siyah"},
				{"id": "c2", "hex": "#ffffff", "label": "Beyaz"},
			},
			"sizes":    []string{"S", "M", "L", "XL"},
			"imageSrc": "https://placehold.co/600x600/1a1a1a/4b8eff?text=Ürün",
		}
	case "categoryGrid":
		return map[string]interface{}{
			"sectionTitle": "Kategoriler",
			"categories": []map[string]interface{}{
				{"id": "c1", "label": "Kategori 1", "image": "https://placehold.co/300x300/1a1a1a/4b8eff?text=1"},
				{"id": "c2", "label": "Kategori 2", "image": "https://placehold.co/300x300/1a1a1a/4b8eff?text=2"},
			},
		}
	case "cartWidget":
		return map[string]interface{}{"itemCount": 0, "bg": "#4b8eff"}
	case "checkoutForm":
		return map[string]interface{}{
			"title":       "Ödeme",
			"submitText":  "Siparişi Tamamla",
			"submitBg":    "#4b8eff",
			"submitColor": "#ffffff",
		}
	case "storeHeader":
		return map[string]interface{}{
			"storeName": "Mağazam",
			"tagline":   "Kaliteli ürünler, uygun fiyatlar",
			"bg":        "#0a0a0a",
		}
	case "flexContainer":
		return map[string]interface{}{
			"direction": "row", "gap": 16, "padding": 16,
			"justifyContent": "flex-start", "alignItems": "stretch",
			"bg": "transparent",
		}
	case "gridContainer":
		return map[string]interface{}{
			"columns": 3, "gap": 16, "padding": 16,
			"bg": "transparent",
		}
	default:
		return map[string]interface{}{}
	}
}

// defaultDimensions — useEditorStore.js::defaultDimensions Go portu.
func defaultDimensions(elementType string) (width, height int) {
	dims := map[string][2]int{
		"heading":             {380, 72},
		"paragraph":           {420, 100},
		"button":              {160, 52},
		"image":               {320, 220},
		"box":                 {200, 120},
		"section":             {860, 320},
		"divider":             {400, 12},
		"icon":                {60, 60},
		"flexContainer":       {680, 280},
		"gridContainer":       {680, 340},
		"navbar":              {1440, 72},
		"sidebar":             {260, 700},
		"hero":                {1440, 560},
		"card":                {360, 480},
		"form":                {480, 480},
		"video":               {560, 315},
		"accordion":           {640, 360},
		"tabs":                {640, 380},
		"testimonial":         {400, 260},
		"avatar":              {200, 180},
		"badge":               {80, 32},
		"progressBar":         {400, 60},
		"socialLinks":         {220, 60},
		"countdown":           {500, 160},
		"codeBlock":           {520, 220},
		"table":               {680, 260},
		"dividerText":         {400, 32},
		"horizontalScroll":    {900, 280},
		"productCard":         {320, 460},
		"productGrid":         {1200, 680},
		"cartButton":          {200, 52},
		"priceTag":            {280, 80},
		"storeHeader":         {1440, 280},
		"cartWidget":          {64, 64},
		"checkoutForm":        {560, 640},
		"miniCart":            {380, 520},
		"minimalistNavbar":    {1440, 80},
		"productListing":      {1200, 780},
		"cartPage":            {1200, 680},
		"productDetailHero":   {1200, 600},
		"categoryGrid":        {1200, 520},
	}
	if d, ok := dims[elementType]; ok {
		return d[0], d[1]
	}
	return 160, 80
}

// defaultElementName — Türkçe element ismi döndürür (panel ve layers için).
func defaultElementName(elementType string, count int) string {
	names := map[string]string{
		"heading": "Başlık", "paragraph": "Paragraf", "button": "Buton",
		"image": "Görsel", "box": "Kutu", "section": "Bölüm",
		"divider": "Ayraç", "icon": "İkon",
		"flexContainer": "Flex", "gridContainer": "Grid",
		"navbar": "Navbar", "sidebar": "Sidebar", "hero": "Hero",
		"card": "Kart", "form": "Form", "video": "Video",
		"accordion": "Akordeon", "tabs": "Sekme", "testimonial": "Yorum",
		"avatar": "Avatar", "badge": "Rozet", "progressBar": "İlerleme",
		"socialLinks": "Sosyal", "countdown": "Geri Sayım",
		"codeBlock": "Kod", "table": "Tablo", "dividerText": "Ayraç Metin",
		"horizontalScroll": "Scroll",
		"productCard":      "Ürün Kartı", "productGrid": "Ürün Grid",
		"cartButton":       "Sepet Butonu", "priceTag": "Fiyat",
		"storeHeader":      "Mağaza Header",
		"cartWidget":       "Sepet Widget", "checkoutForm": "Ödeme",
		"miniCart":         "Mini Sepet",
		"minimalistNavbar": "Min. Navbar",
		"productListing":   "Ürün Listeleme",
		"cartPage":         "Sepet Sayfası",
		"productDetailHero": "Ürün Detay",
		"categoryGrid":      "Kategori Grid",
	}
	name, ok := names[elementType]
	if !ok {
		name = elementType
	}
	return fmt.Sprintf("%s %d", name, count)
}

// containerTypes — children alanı olan element tipleri.
func isContainerType(elementType string) bool {
	switch elementType {
	case "flexContainer", "gridContainer", "section":
		return true
	}
	return false
}
