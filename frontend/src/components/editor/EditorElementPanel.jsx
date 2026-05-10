import React, { useState, useMemo } from 'react';
import { useEditorStore, defaultDimensions, defaultProps, defaultElementName } from '../../store/useEditorStore';

// ─── ELEMENT CATALOGUE ────────────────────────────────────────────────────────
const ELEMENT_GROUPS = [
  {
    label: 'Navigation',
    color: '#a855f7',
    items: [
      { type: 'navbar',  icon: 'menu', label: 'Navbar',  desc: 'Sticky nav + logo + links' },
      { type: 'sidebar', icon: 'view_sidebar', label: 'Sidebar', desc: 'Vertical nav panel' },
    ],
  },
  {
    label: 'Blocks',
    color: '#4b8eff',
    items: [
      { type: 'hero',        icon: 'web_asset',  label: 'Hero',        desc: 'Full-width hero section' },
      { type: 'card',        icon: 'article',    label: 'Card',        desc: 'Blog / product card' },
      { type: 'testimonial', icon: 'format_quote', label: 'Testimonial', desc: 'Quote + author' },
      { type: 'avatar',      icon: 'account_circle', label: 'Avatar', desc: 'Profile + name + role' },
    ],
  },
  {
    label: 'Text',
    color: '#10b981',
    items: [
      { type: 'heading',     icon: 'title',   label: 'Heading'  },
      { type: 'paragraph',   icon: 'notes',   label: 'Paragraph' },
      { type: 'dividerText', icon: 'horizontal_rule', label: 'Divider Text' },
      { type: 'codeBlock',   icon: 'code',    label: 'Code Block' },
    ],
  },
  {
    label: 'Media',
    color: '#f59e0b',
    items: [
      { type: 'image', icon: 'image',       label: 'Image'  },
      { type: 'video', icon: 'play_circle', label: 'Video'  },
      { type: 'icon',  icon: 'interests',   label: 'Icon'   },
    ],
  },
  {
    label: 'Interactive',
    color: '#ef4444',
    items: [
      { type: 'button',      icon: 'smart_button', label: 'Button'   },
      { type: 'form',        icon: 'assignment',  label: 'Form'     },
      { type: 'accordion',   icon: 'expand_more', label: 'Accordion' },
      { type: 'tabs',        icon: 'tab',         label: 'Tabs'     },
      { type: 'countdown',   icon: 'timer',       label: 'Countdown' },
      { type: 'socialLinks', icon: 'share',       label: 'Social Links' },
      { type: 'progressBar', icon: 'linear_scale', label: 'Progress'  },
    ],
  },
  {
    label: 'Display',
    color: '#06b6d4',
    items: [
      { type: 'badge',  icon: 'new_releases', label: 'Badge'  },
      { type: 'table',  icon: 'grid_on',      label: 'Table'  },
      { type: 'divider',icon: 'remove',       label: 'Divider'},
    ],
  },
  {
    label: 'Shapes',
    color: '#8b5cf6',
    items: [
      { type: 'box',     icon: 'check_box_outline_blank', label: 'Box'     },
      { type: 'section', icon: 'view_day',               label: 'Section' },
    ],
  },
  {
    label: 'Layout',
    color: '#4b8eff',
    items: [
      { type: 'flexContainer',    icon: 'view_column',   label: 'Flex',    badge: 'FLEX', desc: 'Row / column layout' },
      { type: 'gridContainer',   icon: 'grid_view',     label: 'Grid',    badge: 'GRID', desc: 'Multi-col grid' },
      { type: 'horizontalScroll',icon: 'swipe_right',   label: 'H-Scroll',badge: 'NEW',  desc: 'Yatay kaydırma şeridi' },
    ],
  },
  {
    label: '🛒 E-Ticaret',
    color: '#22c55e',
    items: [
      { type: 'productCard',  icon: 'inventory_2',     label: 'Ürün Kartı',     badge: 'NEW', desc: 'Fiyat + sepet + yıldız' },
      { type: 'productGrid',  icon: 'grid_view',       label: 'Ürün Grid',      badge: 'NEW', desc: 'Çoklu ürün vitrin' },
      { type: 'cartButton',   icon: 'shopping_cart',   label: 'Sepet Butonu',   desc: 'Sepete ekle CTA' },
      { type: 'priceTag',     icon: 'sell',            label: 'Fiyat Etiketi',  desc: 'İndirim + eski fiyat' },
      { type: 'storeHeader',  icon: 'storefront',      label: 'Mağaza Header',  badge: 'NEW', desc: 'Logo + arama + kategoriler' },
    ],
  },
];

// ─── TEMPLATES ────────────────────────────────────────────────────────────────
function genId() { return `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

const TEMPLATES = [
  {
    label: 'Blog Hero',
    icon: 'web_asset',
    desc: 'Navbar + Hero section',
    build: () => {
      const navDims = defaultDimensions('navbar');
      const heroDims = defaultDimensions('hero');
      return [
        { id: genId(), type: 'navbar', name: 'Navbar 1', visible: true, locked: false, props: defaultProps('navbar'), spacing: { margin: { top:0,right:0,bottom:0,left:0 }, padding: { top:0,right:0,bottom:0,left:0 } }, visibleBreakpoints: { desktop:true, tablet:true, mobile:true }, breakpoints: { desktop: { x: 0, y: 0, width: navDims.width, height: navDims.height }, tablet: null, mobile: null } },
        { id: genId(), type: 'hero',   name: 'Hero 1',   visible: true, locked: false, props: defaultProps('hero'),   spacing: { margin: { top:0,right:0,bottom:0,left:0 }, padding: { top:0,right:0,bottom:0,left:0 } }, visibleBreakpoints: { desktop:true, tablet:true, mobile:true }, breakpoints: { desktop: { x: 0, y: navDims.height, width: heroDims.width, height: heroDims.height }, tablet: null, mobile: null } },
      ];
    },
  },
  {
    label: 'Blog Card Grid',
    icon: 'article',
    desc: '3-column card layout',
    build: () => {
      const cardDims = defaultDimensions('card');
      const gap = 24, startX = 80, startY = 80;
      return [0, 1, 2].map((i) => ({
        id: genId(), type: 'card', name: `Card ${i + 1}`, visible: true, locked: false,
        props: { ...defaultProps('card'), tag: ['BLOG', 'DESIGN', 'DEV'][i], title: ['Web Tasarım Trendleri', 'UI/UX İpuçları', 'React Performans'][i], readTime: `${i + 3} dk okuma` },
        spacing: { margin: { top:0,right:0,bottom:0,left:0 }, padding: { top:0,right:0,bottom:0,left:0 } },
        visibleBreakpoints: { desktop:true, tablet:true, mobile:true },
        breakpoints: { desktop: { x: startX + i * (cardDims.width + gap), y: startY, width: cardDims.width, height: cardDims.height }, tablet: null, mobile: null },
      }));
    },
  },
  {
    label: 'Features Grid',
    icon: 'grid_view',
    desc: 'Section + 3 feature cards',
    build: () => {
      const icons = ['bolt', 'shield', 'palette'];
      const titles = ['Hızlı', 'Güvenli', 'Güzel'];
      const descs = ['Ultra hızlı performans.', 'Kurumsal güvenlik.', 'Şık tasarım.'];
      const startX = 80;
      return titles.map((t, i) => ({
        id: genId(), type: 'box', name: `Feature ${i + 1}`, visible: true, locked: false,
        props: { bg: '#1a1a1a', borderRadius: 16, opacity: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
        spacing: { margin: { top:0,right:0,bottom:0,left:0 }, padding: { top:0,right:0,bottom:0,left:0 } },
        visibleBreakpoints: { desktop:true, tablet:true, mobile:true },
        breakpoints: { desktop: { x: startX + i * 240, y: 80, width: 220, height: 200 }, tablet: null, mobile: null },
      }));
    },
  },
  {
    label: 'Contact Form',
    icon: 'assignment',
    desc: 'Heading + Form',
    build: () => [
      { id: genId(), type: 'heading', name: 'Contact Title', visible: true, locked: false, props: { ...defaultProps('heading'), text: 'Bize Ulaşın', fontSize: 36 }, spacing: { margin: { top:0,right:0,bottom:0,left:0 }, padding: { top:0,right:0,bottom:0,left:0 } }, visibleBreakpoints: { desktop:true, tablet:true, mobile:true }, breakpoints: { desktop: { x: 480, y: 80, width: 480, height: 60 }, tablet: null, mobile: null } },
      { id: genId(), type: 'form',    name: 'Contact Form',  visible: true, locked: false, props: defaultProps('form'), spacing: { margin: { top:0,right:0,bottom:0,left:0 }, padding: { top:0,right:0,bottom:0,left:0 } }, visibleBreakpoints: { desktop:true, tablet:true, mobile:true }, breakpoints: { desktop: { x: 480, y: 160, width: 480, height: 460 }, tablet: null, mobile: null } },
    ],
  },
  {
    label: 'Testimonials',
    icon: 'format_quote',
    desc: '3 testimonial cards',
    build: () => {
      const w = 380, gap = 24, startX = 60;
      const names = ['Ayşe K.', 'Mehmet T.', 'Zeynep A.'];
      const roles = ['CEO, TechCo', 'Tasarımcı', 'Pazarlama Müdürü'];
      return names.map((name, i) => ({
        id: genId(), type: 'testimonial', name: `Testimonial ${i+1}`, visible: true, locked: false,
        props: { ...defaultProps('testimonial'), name, role: roles[i], rating: 5 - (i % 2) },
        spacing: { margin: { top:0,right:0,bottom:0,left:0 }, padding: { top:0,right:0,bottom:0,left:0 } },
        visibleBreakpoints: { desktop:true, tablet:true, mobile:true },
        breakpoints: { desktop: { x: startX + i * (w + gap), y: 80, width: w, height: 260 }, tablet: null, mobile: null },
      }));
    },
  },
  {
    label: 'App Sidebar',
    icon: 'view_sidebar',
    desc: 'Sidebar + content area',
    build: () => [
      { id: genId(), type: 'sidebar', name: 'Sidebar 1', visible: true, locked: false, props: defaultProps('sidebar'), spacing: { margin: { top:0,right:0,bottom:0,left:0 }, padding: { top:0,right:0,bottom:0,left:0 } }, visibleBreakpoints: { desktop:true, tablet:true, mobile:false }, breakpoints: { desktop: { x: 0, y: 0, width: 260, height: 700 }, tablet: null, mobile: null } },
      { id: genId(), type: 'box',     name: 'Content',   visible: true, locked: false, props: { bg: '#0e0e0e', borderRadius: 0, opacity: 100, borderWidth: 0 }, spacing: { margin: { top:0,right:0,bottom:0,left:0 }, padding: { top:0,right:0,bottom:0,left:0 } }, visibleBreakpoints: { desktop:true, tablet:true, mobile:true }, breakpoints: { desktop: { x: 260, y: 0, width: 1180, height: 700 }, tablet: null, mobile: null } },
    ],
  },
  {
    label: 'Scroll Showcase',
    icon: 'swipe_right',
    desc: 'Yatay kaydırma şeridi',
    build: () => [
      { id: genId(), type: 'horizontalScroll', name: 'Scroll List 1', visible: true, locked: false,
        props: {
          ...defaultProps('horizontalScroll'),
          items: [
            { id: 'hs1', title: 'Ürün 1', desc: 'Harika bir özellik', bg: '#1a1a1a' },
            { id: 'hs2', title: 'Ürün 2', desc: 'Diğer harika özellik', bg: '#1e1e2e' },
            { id: 'hs3', title: 'Ürün 3', desc: 'Müthis özellik', bg: '#1a1a1a' },
            { id: 'hs4', title: 'Ürün 4', desc: 'Süper özellik', bg: '#1e1e2e' },
            { id: 'hs5', title: 'Ürün 5', desc: 'Harika', bg: '#1a1a1a' },
          ],
        },
        spacing: { margin: { top:0,right:0,bottom:0,left:0 }, padding: { top:0,right:0,bottom:0,left:0 } },
        visibleBreakpoints: { desktop:true, tablet:true, mobile:true },
        breakpoints: { desktop: { x: 60, y: 80, width: 1320, height: 280 }, tablet: null, mobile: null },
      },
    ],
  },
  {
    label: 'E-Commerce Store',
    icon: 'storefront',
    desc: 'Mağaza header + ürün grid',
    build: () => {
      const storeDims = defaultDimensions('storeHeader');
      const gridDims = defaultDimensions('productGrid');
      return [
        { id: genId(), type: 'storeHeader', name: 'Mağaza Header', visible: true, locked: false,
          props: defaultProps('storeHeader'),
          spacing: { margin: { top:0,right:0,bottom:0,left:0 }, padding: { top:0,right:0,bottom:0,left:0 } },
          visibleBreakpoints: { desktop:true, tablet:true, mobile:true },
          breakpoints: { desktop: { x: 0, y: 0, width: storeDims.width, height: storeDims.height }, tablet: null, mobile: null },
        },
        { id: genId(), type: 'productGrid', name: 'Ürün Vitrini', visible: true, locked: false,
          props: defaultProps('productGrid'),
          spacing: { margin: { top:0,right:0,bottom:0,left:0 }, padding: { top:0,right:0,bottom:0,left:0 } },
          visibleBreakpoints: { desktop:true, tablet:true, mobile:true },
          breakpoints: { desktop: { x: 120, y: storeDims.height + 40, width: gridDims.width, height: gridDims.height }, tablet: null, mobile: null },
        },
      ];
    },
  },
];

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function EditorElementPanel() {
  const { isElementPanelOpen, addTemplate } = useEditorStore();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('elements'); // 'elements' | 'templates'

  const handleDragStart = (e, type) => {
    e.dataTransfer.setData('elementType', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return ELEMENT_GROUPS;
    const q = search.toLowerCase();
    return ELEMENT_GROUPS.map(g => ({
      ...g,
      items: g.items.filter(el => el.label.toLowerCase().includes(q) || el.type.includes(q) || (el.desc ?? '').toLowerCase().includes(q)),
    })).filter(g => g.items.length > 0);
  }, [search]);

  return (
    <aside style={{
      position: 'fixed', left: 80, top: 64,
      height: 'calc(100vh - 64px)', width: 264,
      background: '#141414',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column', zIndex: 30,
      transform: isElementPanelOpen ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 14px 0' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3 }}>
          {[['elements','Elementler'],['templates','Şablonlar']].map(([tab, lbl]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: activeTab === tab ? '#4b8eff' : 'transparent',
              color: activeTab === tab ? '#fff' : '#555',
              transition: 'all 0.15s',
            }}>{lbl}</button>
          ))}
        </div>

        {/* Search — only in elements tab */}
        {activeTab === 'elements' && (
          <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#555' }}>search</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Element ara..."
              style={{ background: 'none', border: 'none', outline: 'none', color: '#e5e2e1', fontSize: 12, flex: 1, fontFamily: 'inherit' }}
            />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 80px' }}>
        {/* ── ELEMENTS TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'elements' && (
          filtered.length === 0
            ? <div style={{ textAlign: 'center', color: '#444', padding: '40px 0', fontSize: 12 }}>Sonuç bulunamadı</div>
            : filtered.map(group => (
              <div key={group.label} style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 8, fontWeight: 800, color: group.color ?? '#444', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8, marginLeft: 2 }}>
                  {group.label}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  {group.items.map(el => (
                    <div
                      key={el.type}
                      draggable
                      onDragStart={e => handleDragStart(e, el.type)}
                      style={{
                        background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: 10, padding: '10px 6px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', gap: 5, cursor: 'grab', position: 'relative',
                        transition: 'all 0.15s', userSelect: 'none', minHeight: 72,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#222'; e.currentTarget.style.border = `1px solid ${group.color ?? '#4b8eff'}44`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'none'; }}
                    >
                      {el.badge && (
                        <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 6, fontWeight: 900, color: group.color ?? '#4b8eff', background: `${group.color ?? '#4b8eff'}18`, padding: '1px 5px', borderRadius: 20, letterSpacing: 1 }}>{el.badge}</div>
                      )}
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: group.color ?? '#4b8eff' }}>{el.icon}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#888', textAlign: 'center', lineHeight: 1.2 }}>{el.label}</span>
                      {el.desc && <span style={{ fontSize: 7.5, color: '#444', textAlign: 'center', lineHeight: 1.2 }}>{el.desc}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}

        {/* ── TEMPLATES TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'templates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {TEMPLATES.map(tpl => (
              <button
                key={tpl.label}
                onClick={() => addTemplate(tpl.build())}
                style={{
                  background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12, padding: '14px', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#222'; e.currentTarget.style.borderColor = 'rgba(75,142,255,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(75,142,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#4b8eff' }}>{tpl.icon}</span>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#e5e2e1', marginBottom: 2 }}>{tpl.label}</div>
                  <div style={{ fontSize: 10, color: '#555' }}>{tpl.desc}</div>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#333', marginLeft: 'auto' }}>add_circle</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(75,142,255,0.08), rgba(139,92,246,0.08))', border: '1px solid rgba(75,142,255,0.1)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#4b8eff,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#fff', fontVariationSettings:"'FILL' 1" }}>auto_awesome</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#e5e2e1' }}>AI Designer</span>
          <span style={{ fontSize: 8, background: 'rgba(75,142,255,0.15)', color: '#4b8eff', padding: '1px 6px', borderRadius: 20, fontWeight: 700, marginLeft: 'auto' }}>BETA</span>
        </div>
      </div>
    </aside>
  );
}