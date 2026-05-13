// Package ai — Site Builder Agent için Gemini function-calling tool tanımları
// ve site_data JSON mutation implementasyonları.
package ai

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

// ─── Site Data Tipleri ────────────────────────────────────────────────────────
// Frontend useEditorStore.js'teki page/element shape'iyle uyumlu.

type SiteData struct {
	Pages         []*Page                `json:"pages"`
	CanvasHeights map[string]int         `json:"canvasHeights,omitempty"`
	Theme         map[string]interface{} `json:"theme,omitempty"`
}

type Page struct {
	ID              string     `json:"id"`
	Name            string     `json:"name"`
	BackgroundColor string     `json:"backgroundColor,omitempty"`
	Elements        []*Element `json:"elements"`
}

type Element struct {
	ID                  string                 `json:"id"`
	Type                string                 `json:"type"`
	Name                string                 `json:"name"`
	Visible             bool                   `json:"visible"`
	Locked              bool                   `json:"locked"`
	Props               map[string]interface{} `json:"props"`
	Children            []*Element             `json:"children,omitempty"`
	Spacing             *Spacing               `json:"spacing,omitempty"`
	Shadow              interface{}            `json:"shadow"`
	PositionMode        string                 `json:"positionMode,omitempty"`
	Overflow            string                 `json:"overflow,omitempty"`
	VisibleBreakpoints  map[string]bool        `json:"visibleBreakpoints,omitempty"`
	LinkAction          map[string]string      `json:"linkAction,omitempty"`
	Breakpoints         map[string]*Bounds     `json:"breakpoints,omitempty"`
}

type Spacing struct {
	Margin  map[string]int `json:"margin"`
	Padding map[string]int `json:"padding"`
}

type Bounds struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

// ─── ID Üretimi ───────────────────────────────────────────────────────────────

func genID() string {
	buf := make([]byte, 5)
	_, _ = rand.Read(buf)
	return fmt.Sprintf("el_%d_%s", time.Now().UnixNano(), hex.EncodeToString(buf))
}

// ─── Tool Definitions (Gemini'ye gönderilecek schema) ─────────────────────────

// SiteBuilderTools agent'a sunulan tool seti.
// Sadece tek bir tool: build_site_at_once. Bu tool tek bir çağrıyla
// tüm sayfaları ve elementleri üretir; ekstra round-trip ve kota tüketimi olmaz.
func SiteBuilderTools() []Tool {
	return []Tool{{
		FunctionDeclarations: []FunctionDeclaration{
			{
				Name:        "build_site_at_once",
				Description: "Tüm web sitesini (tüm sayfalar ve her sayfanın tüm elementleri) tek bir tool çağrısında inşa eder. Plandaki tüm sayfaları ve her sayfadaki tüm elementleri eksiksiz doldurman zorunludur. y koordinatları artan sırada, propslar Türkçe içerikle dolu olmalı.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"pages": map[string]interface{}{
							"type":        "array",
							"description": "Plandaki tüm sayfalar.",
							"items": map[string]interface{}{
								"type": "object",
								"properties": map[string]interface{}{
									"name":            map[string]interface{}{"type": "string", "description": "Sayfa adı, plandaki ile aynı."},
									"backgroundColor": map[string]interface{}{"type": "string", "description": "Hex renk, örn: '#0e0e0e'"},
									"elements": map[string]interface{}{
										"type":        "array",
										"description": "Sayfadaki tüm elementler, plandaki sırayla.",
										"items": map[string]interface{}{
											"type": "object",
											"properties": map[string]interface{}{
												"element_type": map[string]interface{}{"type": "string", "description": "Element tipi (heading, paragraph, button, image, hero, navbar, minimalistNavbar, card, form, productCard, productGrid, productListing, productDetailHero, categoryGrid, testimonial, badge, divider, icon, box, section, flexContainer, gridContainer, accordion, tabs, storeHeader, checkoutForm, cartWidget)"},
												"x":            map[string]interface{}{"type": "integer", "description": "Sol kenardan px. Tam ekran elementler için 0."},
												"y":            map[string]interface{}{"type": "integer", "description": "Üstten px. Sıralı artmalı, üst üste binme olmamalı."},
												"width":        map[string]interface{}{"type": "integer", "description": "Genişlik px. Boşsa varsayılan kullanılır."},
												"height":       map[string]interface{}{"type": "integer", "description": "Yükseklik px. Boşsa varsayılan kullanılır."},
												"props":        map[string]interface{}{"type": "object", "description": "Elementin Türkçe içerik propsları. Örn: heading için {text, fontSize, color}; hero için {tag, title, subtitle, ctaText}; productGrid için {sectionTitle, products}."},
											},
											"required": []string{"element_type", "y"},
										},
									},
								},
								"required": []string{"name", "elements"},
							},
						},
					},
					"required": []string{"pages"},
				},
			},
		},
	}}
}

// ─── Tool Execution — site_data üzerinde mutasyon ────────────────────────────

// ExecuteTool tek bir tool çağrısını site_data üzerinde uygular ve sonucu döndürür.
// done dışındaki tüm tool'lar map[string]interface{} sonuç döner; agent'ın bir sonraki adımı için referans olur.
// done çağrıldığında done=true döner; handler agent loop'u sonlandırır.
func ExecuteTool(site *SiteData, call *FunctionCall) (result map[string]interface{}, done bool, err error) {
	switch call.Name {

	case "build_site_at_once":
		pagesInf, ok := call.Args["pages"].([]interface{})
		if !ok {
			return nil, false, fmt.Errorf("pages dizisi hatalı")
		}
		for _, pInf := range pagesInf {
			pMap, _ := pInf.(map[string]interface{})
			name, _ := pMap["name"].(string)
			bg, _ := pMap["backgroundColor"].(string)
			if bg == "" {
				bg = "#0e0e0e"
			}
			page := &Page{
				ID:              genID(),
				Name:            name,
				BackgroundColor: bg,
				Elements:        []*Element{},
			}
			site.Pages = append(site.Pages, page)

			elementsInf, _ := pMap["elements"].([]interface{})
			for _, eInf := range elementsInf {
				eMap, _ := eInf.(map[string]interface{})
				elementType, _ := eMap["element_type"].(string)
				if elementType == "" {
					continue
				}

				x := asInt(eMap["x"], 0)
				y := asInt(eMap["y"], 0)
				w, h := defaultDimensions(elementType)
				if cw := asInt(eMap["width"], 0); cw > 0 {
					w = cw
				}
				if ch := asInt(eMap["height"], 0); ch > 0 {
					h = ch
				}

				props := defaultProps(elementType)
				if extra, ok := eMap["props"].(map[string]interface{}); ok {
					for k, v := range extra {
						props[k] = v
					}
				}

				el := &Element{
					ID:           genID(),
					Type:         elementType,
					Name:         defaultElementName(elementType, len(page.Elements)+1),
					Visible:      true,
					Locked:       false,
					Props:        props,
					PositionMode: "absolute",
					Overflow:     "hidden",
					Spacing: &Spacing{
						Margin:  map[string]int{"top": 0, "right": 0, "bottom": 0, "left": 0},
						Padding: map[string]int{"top": 0, "right": 0, "bottom": 0, "left": 0},
					},
					Shadow:             nil,
					VisibleBreakpoints: map[string]bool{"desktop": true, "tablet": true, "mobile": true},
					LinkAction:         map[string]string{"type": "none", "target": ""},
					Breakpoints: map[string]*Bounds{
						"desktop": {X: x, Y: y, Width: w, Height: h},
						"tablet":  nil,
						"mobile":  nil,
					},
				}
				if isContainerType(elementType) {
					el.Children = []*Element{}
				}
				page.Elements = append(page.Elements, el)
			}
		}
		// Bu tool tek seferde işi bitirdiği için doğrudan done=true dönüyoruz.
		return map[string]interface{}{"ok": true, "message": "Site başarıyla inşa edildi!"}, true, nil

	case "add_page":
		name, _ := call.Args["name"].(string)
		if name == "" {
			name = fmt.Sprintf("Sayfa %d", len(site.Pages)+1)
		}
		bg, _ := call.Args["backgroundColor"].(string)
		if bg == "" {
			bg = "#0e0e0e"
		}
		page := &Page{
			ID:              genID(),
			Name:            name,
			BackgroundColor: bg,
			Elements:        []*Element{},
		}
		site.Pages = append(site.Pages, page)
		return map[string]interface{}{
			"page_id": page.ID,
			"name":    page.Name,
		}, false, nil

	case "add_element":
		pageID, _ := call.Args["page_id"].(string)
		page := findPage(site, pageID)
		if page == nil {
			return nil, false, fmt.Errorf("sayfa bulunamadı: %s", pageID)
		}
		elementType, _ := call.Args["element_type"].(string)
		if elementType == "" {
			return nil, false, fmt.Errorf("element_type zorunlu")
		}

		x := asInt(call.Args["x"], 0)
		y := asInt(call.Args["y"], 0)
		w, h := defaultDimensions(elementType)
		if cw := asInt(call.Args["width"], 0); cw > 0 {
			w = cw
		}
		if ch := asInt(call.Args["height"], 0); ch > 0 {
			h = ch
		}

		// Props: default + override
		props := defaultProps(elementType)
		if extra, ok := call.Args["props"].(map[string]interface{}); ok {
			for k, v := range extra {
				props[k] = v
			}
		}

		el := &Element{
			ID:           genID(),
			Type:         elementType,
			Name:         defaultElementName(elementType, len(page.Elements)+1),
			Visible:      true,
			Locked:       false,
			Props:        props,
			PositionMode: "absolute",
			Overflow:     "hidden",
			Spacing: &Spacing{
				Margin:  map[string]int{"top": 0, "right": 0, "bottom": 0, "left": 0},
				Padding: map[string]int{"top": 0, "right": 0, "bottom": 0, "left": 0},
			},
			Shadow:             nil,
			VisibleBreakpoints: map[string]bool{"desktop": true, "tablet": true, "mobile": true},
			LinkAction:         map[string]string{"type": "none", "target": ""},
			Breakpoints: map[string]*Bounds{
				"desktop": {X: x, Y: y, Width: w, Height: h},
				"tablet":  nil,
				"mobile":  nil,
			},
		}
		if isContainerType(elementType) {
			el.Children = []*Element{}
		}
		page.Elements = append(page.Elements, el)

		return map[string]interface{}{
			"element_id": el.ID,
			"type":       el.Type,
			"x":          x,
			"y":          y,
			"width":      w,
			"height":     h,
			"hint":       fmt.Sprintf("Sonraki elementi y=%d civarına yerleştir.", y+h+24),
		}, false, nil

	case "update_element_props":
		pageID, _ := call.Args["page_id"].(string)
		elementID, _ := call.Args["element_id"].(string)
		page := findPage(site, pageID)
		if page == nil {
			return nil, false, fmt.Errorf("sayfa bulunamadı: %s", pageID)
		}
		el := findElement(page, elementID)
		if el == nil {
			return nil, false, fmt.Errorf("element bulunamadı: %s", elementID)
		}
		if extra, ok := call.Args["props"].(map[string]interface{}); ok {
			if el.Props == nil {
				el.Props = map[string]interface{}{}
			}
			for k, v := range extra {
				el.Props[k] = v
			}
		}
		return map[string]interface{}{"ok": true}, false, nil

	case "set_page_background":
		pageID, _ := call.Args["page_id"].(string)
		color, _ := call.Args["color"].(string)
		page := findPage(site, pageID)
		if page == nil {
			return nil, false, fmt.Errorf("sayfa bulunamadı: %s", pageID)
		}
		page.BackgroundColor = color
		return map[string]interface{}{"ok": true}, false, nil

	case "done":
		return map[string]interface{}{"ok": true}, true, nil
	}

	return nil, false, fmt.Errorf("bilinmeyen tool: %s", call.Name)
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

func findPage(site *SiteData, id string) *Page {
	for _, p := range site.Pages {
		if p.ID == id {
			return p
		}
	}
	return nil
}

func findElement(page *Page, id string) *Element {
	for _, e := range page.Elements {
		if e.ID == id {
			return e
		}
	}
	return nil
}

// asInt JSON'dan gelebilecek float64/int değerleri int'e çevirir.
func asInt(v interface{}, def int) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case int64:
		return int(n)
	}
	return def
}
