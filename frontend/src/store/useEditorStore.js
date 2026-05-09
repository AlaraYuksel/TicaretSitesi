import { create } from 'zustand';

const SNAP_THRESHOLD = 8;

// ─── BREAKPOINT DEFINITIONS ──────────────────────────────────────────────────
export const BREAKPOINTS = {
  desktop: { width: 1440, label: 'Desktop', icon: 'desktop_windows' },
  tablet: { width: 768, label: 'Tablet', icon: 'tablet_mac' },
  mobile: { width: 390, label: 'Mobile', icon: 'smartphone' },
};

export const BREAKPOINT_ORDER = ['desktop', 'tablet', 'mobile'];

// Media element types that should scale height proportionally with width
const SCALE_HEIGHT_TYPES = new Set(['image', 'video', 'hero', 'card', 'navbar', 'sidebar', 'testimonial', 'avatar', 'table', 'codeBlock', 'countdown', 'horizontalScroll']);

export function getElementBounds(el, breakpoint = 'desktop') {
  if (el.breakpoints) {
    const idx = BREAKPOINT_ORDER.indexOf(breakpoint);
    for (let i = idx; i >= 0; i--) {
      const srcBp = BREAKPOINT_ORDER[i];
      const bp = el.breakpoints[srcBp];
      if (!bp) continue;
      if (srcBp === breakpoint) return bp;
      const srcWidth = BREAKPOINTS[srcBp].width;
      const dstWidth = BREAKPOINTS[breakpoint].width;
      const ratio = dstWidth / srcWidth;
      const scaleH = SCALE_HEIGHT_TYPES.has(el.type);
      return {
        x: Math.round(bp.x * ratio),
        y: Math.round(bp.y * ratio),
        width: Math.round(bp.width * ratio),
        height: scaleH ? Math.round(bp.height * ratio) : bp.height,
      };
    }
  }
  return { x: el.x ?? 0, y: el.y ?? 0, width: el.width ?? 160, height: el.height ?? 80 };
}

export function hasBreakpointOverride(el, breakpoint) {
  return !!(el.breakpoints?.[breakpoint]);
}

// ─── DEFAULT SPACING ─────────────────────────────────────────────────────────
export function defaultSpacing() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

// ─── DEFAULT PROPS ────────────────────────────────────────────────────────────
export function defaultProps(type) {
  const map = {
    // ── Text ─────────────────────────────────────────────────────────────────
    heading: {
      text: 'Yeni Başlık', fontSize: 48, fontWeight: '800', color: '#e5e2e1', align: 'left',
      fontFamily: 'inherit', lineHeight: 1.15, letterSpacing: 0, textDecoration: 'none', textShadow: '',
    },
    paragraph: {
      text: 'Buraya metin yazın.', fontSize: 16, fontWeight: '400', color: '#9ca3af', align: 'left',
      fontFamily: 'inherit', lineHeight: 1.65, letterSpacing: 0, textDecoration: 'none', textShadow: '',
    },
    dividerText: {
      text: 'VEYA', fontSize: 12, fontWeight: '600', color: '#555', lineColor: '#2a2a2a',
    },

    // ── Interactive ───────────────────────────────────────────────────────────
    button: {
      text: 'Tıkla', bg: '#4b8eff', color: '#ffffff', fontSize: 15, fontWeight: '700',
      borderRadius: 8, paddingX: 24, paddingY: 12, href: '',
      shadowX: 0, shadowY: 4, shadowBlur: 16, shadowColor: 'rgba(75,142,255,0.35)',
    },
    form: {
      fields: [
        { id: 'f1', type: 'text', label: 'Ad Soyad', placeholder: 'Adınızı girin' },
        { id: 'f2', type: 'email', label: 'E-posta', placeholder: 'ornek@email.com' },
        { id: 'f3', type: 'textarea', label: 'Mesajınız', placeholder: 'Mesajınızı yazın...' },
      ],
      submitText: 'Gönder', submitBg: '#4b8eff', submitColor: '#fff',
      bg: 'transparent', gap: 16, borderRadius: 12,
      inputBg: '#1e1e1e', inputBorderColor: 'rgba(255,255,255,0.1)', inputColor: '#e5e2e1',
      labelColor: '#888',
    },
    accordion: {
      items: [
        { id: 'a1', question: 'Sıkça sorulan soru 1?', answer: 'Bu sorunun yanıtı burada yer alıyor. Detaylı bilgi için bize ulaşabilirsiniz.' },
        { id: 'a2', question: 'Sıkça sorulan soru 2?', answer: 'İkinci sorunun yanıtı burada yer alıyor.' },
        { id: 'a3', question: 'Sıkça sorulan soru 3?', answer: 'Üçüncü sorunun yanıtı burada yer alıyor.' },
      ],
      bg: 'transparent', itemBg: '#1a1a1a', borderColor: 'rgba(255,255,255,0.07)',
      questionColor: '#e5e2e1', answerColor: '#9ca3af', accentColor: '#4b8eff',
      fontSize: 14,
    },
    tabs: {
      tabs: [
        { id: 't1', label: 'Sekme 1', content: 'Birinci sekmenin içeriği burada.' },
        { id: 't2', label: 'Sekme 2', content: 'İkinci sekmenin içeriği burada.' },
        { id: 't3', label: 'Sekme 3', content: 'Üçüncü sekmenin içeriği burada.' },
      ],
      activeTab: 't1',
      activeColor: '#4b8eff', tabBg: '#1a1a1a', activeBg: '#4b8eff',
      contentBg: '#1a1a1a', borderColor: 'rgba(255,255,255,0.07)',
      textColor: '#e5e2e1', fontSize: 13,
    },
    countdown: {
      targetDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
      labelDays: 'GÜN', labelHours: 'SAAT', labelMinutes: 'DAKİKA', labelSeconds: 'SANİYE',
      numColor: '#e5e2e1', labelColor: '#666', bg: '#1a1a1a',
      numFontSize: 48, labelFontSize: 10, borderRadius: 12, gap: 12,
    },
    progressBar: {
      label: 'Tamamlanma', value: 75, max: 100,
      trackBg: '#1e1e1e', fillBg: '#4b8eff', labelColor: '#9ca3af',
      height: 10, borderRadius: 99, showLabel: true, showValue: true,
    },
    socialLinks: {
      links: [
        { id: 's1', platform: 'twitter', url: '#', icon: 'twitter' },
        { id: 's2', platform: 'instagram', url: '#', icon: 'instagram' },
        { id: 's3', platform: 'linkedin', url: '#', icon: 'linkedin' },
        { id: 's4', platform: 'github', url: '#', icon: 'github' },
      ],
      size: 40, gap: 12, iconColor: '#e5e2e1', bg: 'rgba(255,255,255,0.05)',
      hoverBg: '#4b8eff', borderRadius: 8, direction: 'row',
    },

    // ── Media ─────────────────────────────────────────────────────────────────
    image: {
      src: '', alt: 'Görsel', objectFit: 'cover', borderRadius: 8,
    },
    video: {
      url: '',
      type: 'youtube', borderRadius: 12, autoplay: false, controls: true,
    },
    codeBlock: {
      code: 'const hello = "World";\nconsole.log(hello);',
      language: 'javascript', bg: '#0d1117', color: '#e6edf3',
      borderRadius: 10, fontSize: 13, showLineNumbers: true,
    },

    // ── Shapes ────────────────────────────────────────────────────────────────
    box: {
      bg: '#1c1b1b', borderRadius: 12, opacity: 100,
      borderColor: '#333', borderWidth: 0,
      shadowX: 0, shadowY: 0, shadowBlur: 0, shadowColor: 'rgba(0,0,0,0.5)',
      gradientEnabled: false, gradientStart: '#4b8eff', gradientEnd: '#8b5cf6', gradientAngle: 135,
    },
    section: {
      bg: '#141414', borderRadius: 0, opacity: 100, padding: 20,
      shadowX: 0, shadowY: 0, shadowBlur: 0, shadowColor: 'rgba(0,0,0,0.5)',
      gradientEnabled: false, gradientStart: '#0e0e0e', gradientEnd: '#1a1a1a', gradientAngle: 135,
    },
    divider: { color: '#2a2a2a', thickness: 1, style: 'solid' },
    icon: { name: 'star', color: '#4b8eff', size: 40 },
    badge: {
      text: 'NEW', bg: '#4b8eff', color: '#fff', fontSize: 11, fontWeight: '700',
      borderRadius: 99, paddingX: 12, paddingY: 5, uppercase: true,
    },
    table: {
      headers: ['Sütun 1', 'Sütun 2', 'Sütun 3'],
      rows: [
        ['Veri 1', 'Veri 2', 'Veri 3'],
        ['Veri 4', 'Veri 5', 'Veri 6'],
        ['Veri 7', 'Veri 8', 'Veri 9'],
      ],
      headerBg: '#1e1e1e', headerColor: '#e5e2e1', rowBg: '#141414', altRowBg: '#1a1a1a',
      cellColor: '#9ca3af', borderColor: 'rgba(255,255,255,0.06)', fontSize: 13,
      borderRadius: 10,
    },

    // ── Layout ────────────────────────────────────────────────────────────────
    flexContainer: {
      bg: 'transparent', borderRadius: 12, opacity: 100,
      border: '1.5px dashed #3a3a3a',
      flexDirection: 'row', flexWrap: 'wrap',
      alignItems: 'center', justifyContent: 'flex-start',
      gap: 16, padding: 20,
    },
    gridContainer: {
      bg: 'transparent', borderRadius: 12, opacity: 100,
      border: '1.5px dashed #3a3a3a',
      columns: 3, gap: 16, padding: 20, autoRows: 120,
    },
    horizontalScroll: {
      bg: '#141414', borderRadius: 12, opacity: 100,
      gap: 16, padding: 16,
      itemWidth: 220, itemHeight: 200,
      arrowColor: '#4b8eff', arrowBg: 'rgba(75,142,255,0.15)',
      showArrows: true, snapToItem: true,
      items: [
        { id: 'hs1', title: 'Kart 1', desc: 'Açıklama metni', bg: '#1a1a1a' },
        { id: 'hs2', title: 'Kart 2', desc: 'Açıklama metni', bg: '#1e1e2e' },
        { id: 'hs3', title: 'Kart 3', desc: 'Açıklama metni', bg: '#1a1a1a' },
        { id: 'hs4', title: 'Kart 4', desc: 'Açıklama metni', bg: '#1e1e2e' },
      ],
      titleColor: '#e5e2e1', descColor: '#9ca3af', titleFontSize: 14, descFontSize: 12,
    },

    // ── Navigation ────────────────────────────────────────────────────────────
    navbar: {
      logo: 'MyBrand',
      logoSrc: '',
      links: [
        { id: 'l1', label: 'Ana Sayfa', href: '#' },
        { id: 'l2', label: 'Hakkımızda', href: '#' },
        { id: 'l3', label: 'Blog', href: '#' },
        { id: 'l4', label: 'İletişim', href: '#' },
      ],
      ctaText: 'Başla', ctaHref: '#',
      bg: 'rgba(14,14,14,0.85)', backdropBlur: 16,
      linkColor: '#e5e2e1', logoColor: '#e5e2e1',
      ctaBg: '#4b8eff', ctaColor: '#fff', ctaBorderRadius: 8,
      borderBottom: 'rgba(255,255,255,0.06)',
      position: 'sticky', fontSize: 14, logoFontSize: 18, logoFontWeight: '800',
      showCta: true,
    },
    sidebar: {
      logo: 'App',
      links: [
        { id: 'sl1', label: 'Dashboard', icon: 'grid_view', href: '#', active: true },
        { id: 'sl2', label: 'Analytics', icon: 'bar_chart', href: '#', active: false },
        { id: 'sl3', label: 'Blog', icon: 'article', href: '#', active: false },
        { id: 'sl4', label: 'Media', icon: 'photo_library', href: '#', active: false },
        { id: 'sl5', label: 'Settings', icon: 'settings', href: '#', active: false },
      ],
      bg: '#141414', linkColor: '#888', activeLinkColor: '#e5e2e1', activeBg: 'rgba(75,142,255,0.1)',
      activeAccent: '#4b8eff', borderRight: 'rgba(255,255,255,0.06)',
      logoColor: '#e5e2e1', showIcons: true, collapsed: false,
      side: 'left', footerText: 'v1.0.0',
    },

    // ── Blocks ────────────────────────────────────────────────────────────────
    hero: {
      tag: 'NEW RELEASE',
      title: 'Harika Web Siteleri\nHızla Oluşturun',
      subtitle: 'Sürükle-bırak editörümüzle profesyonel web siteleri tasarlayın. Kod bilgisi gerekmez.',
      ctaText: 'Ücretsiz Başla', ctaHref: '#',
      ctaBg: '#4b8eff', ctaColor: '#fff', ctaBorderRadius: 10,
      subCtaText: 'Demo İzle', subCtaHref: '#',
      bg: '#0e0e0e', titleColor: '#e5e2e1', subtitleColor: '#9ca3af',
      tagColor: '#4b8eff', tagBg: 'rgba(75,142,255,0.1)',
      align: 'center', bgImageUrl: '',
      overlayOpacity: 50,
    },
    card: {
      imageSrc: '', imageAlt: 'Kart görseli',
      tag: 'BLOG', tagColor: '#4b8eff',
      title: 'Blog Yazı Başlığı',
      excerpt: 'Bu blog yazısının kısa bir özeti. Daha fazlası için tıklayın.',
      author: '', date: '', readTime: '5 dk okuma',
      ctaText: 'Devamını Oku', ctaHref: '#',
      bg: '#1a1a1a', borderRadius: 16,
      titleColor: '#e5e2e1', excerptColor: '#9ca3af', metaColor: '#555',
      ctaColor: '#4b8eff', borderColor: 'rgba(255,255,255,0.06)',
    },
    testimonial: {
      quote: '"Bu araç inanılmaz! Web siteyi hiç bu kadar kolay yapmamıştım. Kesinlikle tavsiye ederim."',
      name: 'Ahmet Yılmaz',
      role: 'Ürün Müdürü',
      company: '@TechCorp',
      avatarUrl: '',
      rating: 5,
      bg: '#1a1a1a', textColor: '#e5e2e1', nameColor: '#e5e2e1',
      metaColor: '#666', starColor: '#f59e0b', quoteColor: '#9ca3af',
      borderRadius: 16, borderColor: 'rgba(255,255,255,0.06)',
    },
    avatar: {
      src: '', name: 'Ad Soyad', role: 'Unvan / Rol', size: 80,
      nameFontSize: 16, roleFontSize: 13,
      nameColor: '#e5e2e1', roleColor: '#9ca3af',
      align: 'center', bg: 'transparent', borderRadius: 99,
      showBorder: true, borderColor: 'rgba(255,255,255,0.1)',
    },
  };
  return map[type] ?? {};
}

export function defaultDimensions(type) {
  const map = {
    heading: { width: 380, height: 72 },
    paragraph: { width: 420, height: 100 },
    button: { width: 160, height: 52 },
    image: { width: 320, height: 220 },
    box: { width: 200, height: 120 },
    section: { width: 860, height: 320 },
    divider: { width: 400, height: 12 },
    icon: { width: 60, height: 60 },
    flexContainer: { width: 680, height: 280 },
    gridContainer: { width: 680, height: 340 },
    // New
    navbar: { width: 1440, height: 72 },
    sidebar: { width: 260, height: 700 },
    hero: { width: 1440, height: 560 },
    card: { width: 360, height: 480 },
    form: { width: 480, height: 480 },
    video: { width: 560, height: 315 },
    accordion: { width: 640, height: 360 },
    tabs: { width: 640, height: 380 },
    testimonial: { width: 400, height: 260 },
    avatar: { width: 200, height: 180 },
    badge: { width: 80, height: 32 },
    progressBar: { width: 400, height: 60 },
    socialLinks: { width: 220, height: 60 },
    countdown: { width: 500, height: 160 },
    codeBlock: { width: 520, height: 220 },
    table: { width: 680, height: 260 },
    dividerText: { width: 400, height: 32 },
    horizontalScroll: { width: 900, height: 280 },
  };
  return map[type] ?? { width: 160, height: 80 };
}

export function defaultElementName(type, count) {
  const names = {
    heading: 'Heading', paragraph: 'Paragraph', button: 'Button',
    image: 'Image', box: 'Box', section: 'Section',
    divider: 'Divider', icon: 'Icon',
    flexContainer: 'Flex', gridContainer: 'Grid',
    navbar: 'Navbar', sidebar: 'Sidebar', hero: 'Hero',
    card: 'Card', form: 'Form', video: 'Video',
    accordion: 'Accordion', tabs: 'Tabs', testimonial: 'Testimonial',
    avatar: 'Avatar', badge: 'Badge', progressBar: 'Progress Bar',
    socialLinks: 'Social Links', countdown: 'Countdown',
    codeBlock: 'Code Block', table: 'Table', dividerText: 'Divider Text',
    horizontalScroll: 'Scroll List',
  };
  return `${names[type] ?? type} ${count}`;
}

export function isContainerType(type) {
  return ['flexContainer', 'gridContainer', 'section'].includes(type);
}

export function isBlockType(type) {
  return ['navbar', 'sidebar', 'hero', 'card', 'form', 'accordion', 'tabs', 'testimonial'].includes(type);
}

// ─── SNAP ENGINE ─────────────────────────────────────────────────────────────
export function calculateSnap(movingEl, allElements, newX, newY, breakpoint = 'desktop') {
  const others = allElements.filter(e => e.id !== movingEl.id && !e.locked);
  let finalX = newX, finalY = newY;
  const lines = [];
  const w = movingEl.width, h = movingEl.height;
  const myCenter = newX + w / 2, myMiddle = newY + h / 2;
  const myRight = newX + w, myBottom = newY + h;

  for (const other of others) {
    const ob = getElementBounds(other, breakpoint);
    const oR = ob.x + ob.width, oB = ob.y + ob.height;
    const oC = ob.x + ob.width / 2, oM = ob.y + ob.height / 2;
    if (Math.abs(newX - ob.x) < SNAP_THRESHOLD) { finalX = ob.x; lines.push({ type: 'v', pos: ob.x }); }
    else if (Math.abs(myCenter - oC) < SNAP_THRESHOLD) { finalX = oC - w / 2; lines.push({ type: 'v', pos: oC }); }
    else if (Math.abs(myRight - oR) < SNAP_THRESHOLD) { finalX = oR - w; lines.push({ type: 'v', pos: oR }); }
    else if (Math.abs(newX - oR) < SNAP_THRESHOLD) { finalX = oR; lines.push({ type: 'v', pos: oR }); }
    else if (Math.abs(myRight - ob.x) < SNAP_THRESHOLD) { finalX = ob.x - w; lines.push({ type: 'v', pos: ob.x }); }
    if (Math.abs(newY - ob.y) < SNAP_THRESHOLD) { finalY = ob.y; lines.push({ type: 'h', pos: ob.y }); }
    else if (Math.abs(myMiddle - oM) < SNAP_THRESHOLD) { finalY = oM - h / 2; lines.push({ type: 'h', pos: oM }); }
    else if (Math.abs(myBottom - oB) < SNAP_THRESHOLD) { finalY = oB - h; lines.push({ type: 'h', pos: oB }); }
    else if (Math.abs(newY - oB) < SNAP_THRESHOLD) { finalY = oB; lines.push({ type: 'h', pos: oB }); }
    else if (Math.abs(myBottom - ob.y) < SNAP_THRESHOLD) { finalY = ob.y - h; lines.push({ type: 'h', pos: ob.y }); }
  }
  return { finalX, finalY, lines };
}

function genId() {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createPage(name, id) {
  return { id: id ?? genId(), name: name ?? 'Page', elements: [] };
}

// ─── STORE ───────────────────────────────────────────────────────────────────
export const useEditorStore = create((set, get) => {
  const firstPage = createPage('Home');
  return {
    pages: [firstPage],
    activePageId: firstPage.id,
    selectedId: null,
    selectedChildId: null,
    activeContainerId: null,
    zoom: 100,
    snapLines: [],
    isElementPanelOpen: true,
    isLayersPanelOpen: false,
    isPagesPanelOpen: false,

    // ── Responsive ─────────────────────────────────────────────────────────
    activeBreakpoint: 'desktop',
    canvasHeights: { desktop: 900, tablet: 900, mobile: 900 },

    showGrid: false,
    gridSize: 16,
    history: [],
    historyIndex: -1,

    // ── Computed helpers ───────────────────────────────────────────────────
    getActivePage: () => {
      const { pages, activePageId } = get();
      return pages.find(p => p.id === activePageId) ?? pages[0];
    },
    getElements: () => get().getActivePage()?.elements ?? [],
    getActiveCanvasWidth: () => BREAKPOINTS[get().activeBreakpoint].width,
    getActiveCanvasHeight: () => get().canvasHeights[get().activeBreakpoint],
    resolveElementBounds: (el) => getElementBounds(el, get().activeBreakpoint),

    // ── History ────────────────────────────────────────────────────────────
    _saveHistory: () => {
      const { pages, activePageId, history, historyIndex } = get();
      const snap = JSON.stringify({ pages, activePageId });
      const nh = [...history.slice(0, historyIndex + 1), snap].slice(-50);
      set({ history: nh, historyIndex: nh.length - 1 });
    },
    undo: () => {
      const { history, historyIndex } = get();
      if (historyIndex <= 0) return;
      const idx = historyIndex - 1;
      const { pages, activePageId } = JSON.parse(history[idx]);
      set({ pages, activePageId, historyIndex: idx, selectedId: null, selectedChildId: null });
    },
    redo: () => {
      const { history, historyIndex } = get();
      if (historyIndex >= history.length - 1) return;
      const idx = historyIndex + 1;
      const { pages, activePageId } = JSON.parse(history[idx]);
      set({ pages, activePageId, historyIndex: idx, selectedId: null, selectedChildId: null });
    },

    // ── Breakpoint actions ─────────────────────────────────────────────────
    setBreakpoint: (bp) => {
      if (!BREAKPOINTS[bp]) return;
      set({ activeBreakpoint: bp, selectedId: null, selectedChildId: null, activeContainerId: null });
    },
    setCanvasHeight: (h) => {
      const bp = get().activeBreakpoint;
      set(s => ({ canvasHeights: { ...s.canvasHeights, [bp]: Math.max(300, Math.round(h)) } }));
    },
    setCanvasSize: (w, h) => {
      const match = Object.entries(BREAKPOINTS).find(([, v]) => v.width === w);
      if (match) get().setBreakpoint(match[0]);
    },

    // ── Page actions ───────────────────────────────────────────────────────
    addPage: (name) => {
      get()._saveHistory();
      const page = createPage(name || `Page ${get().pages.length + 1}`);
      set(s => ({ pages: [...s.pages, page], activePageId: page.id, selectedId: null }));
    },
    deletePage: (id) => {
      if (get().pages.length <= 1) return;
      get()._saveHistory();
      const remaining = get().pages.filter(p => p.id !== id);
      set({ pages: remaining, activePageId: remaining[0].id, selectedId: null });
    },
    renamePage: (id, name) => {
      set(s => ({ pages: s.pages.map(p => p.id === id ? { ...p, name } : p) }));
    },
    duplicatePage: (id) => {
      get()._saveHistory();
      const page = get().pages.find(p => p.id === id);
      if (!page) return;
      const newPage = { ...JSON.parse(JSON.stringify(page)), id: genId(), name: `${page.name} (kopya)` };
      set(s => ({ pages: [...s.pages, newPage], activePageId: newPage.id, selectedId: null }));
    },
    switchPage: (id) => set({ activePageId: id, selectedId: null, selectedChildId: null, activeContainerId: null }),
    reorderPages: (fromIdx, toIdx) => {
      set(s => {
        const arr = [...s.pages];
        const [m] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, m);
        return { pages: arr };
      });
    },

    // ── UI toggles ─────────────────────────────────────────────────────────
    toggleElementPanel: () => set(s => ({ isElementPanelOpen: !s.isElementPanelOpen, isLayersPanelOpen: false, isPagesPanelOpen: false })),
    toggleLayersPanel: () => set(s => ({ isLayersPanelOpen: !s.isLayersPanelOpen, isElementPanelOpen: false, isPagesPanelOpen: false })),
    togglePagesPanel: () => set(s => ({ isPagesPanelOpen: !s.isPagesPanelOpen, isElementPanelOpen: false, isLayersPanelOpen: false })),
    toggleGrid: () => set(s => ({ showGrid: !s.showGrid })),
    setZoom: (z) => set({ zoom: Math.min(200, Math.max(10, z)) }),
    setGridSize: (s) => set({ gridSize: s }),
    setSnapLines: (lines) => set({ snapLines: lines }),

    selectElement: (id, childId = null) => set({ selectedId: id, selectedChildId: childId }),
    deselectElement: () => set({ selectedId: null, selectedChildId: null, snapLines: [], activeContainerId: null }),
    enterContainer: (id) => set({ activeContainerId: id }),
    exitContainer: () => set({ activeContainerId: null }),

    // ── Page element mutator ───────────────────────────────────────────────
    _updatePageElements: (updater) => {
      set(s => ({
        pages: s.pages.map(p =>
          p.id === s.activePageId ? { ...p, elements: updater(p.elements) } : p
        ),
      }));
    },

    // ── Add top-level element ──────────────────────────────────────────────
    addElement: (type, x, y) => {
      get()._saveHistory();
      const bp = get().activeBreakpoint;
      const count = get().getElements().length + 1;
      const dims = defaultDimensions(type);
      const bpX = Math.round(x - dims.width / 2);
      const bpY = Math.round(y - dims.height / 2);

      const newEl = {
        id: genId(), type,
        props: defaultProps(type),
        name: defaultElementName(type, count),
        visible: true, locked: false,
        children: isContainerType(type) ? [] : undefined,
        // Spacing & advanced style
        spacing: { margin: defaultSpacing(), padding: defaultSpacing() },
        shadow: null,
        positionMode: 'absolute', // absolute | fixed | sticky
        overflow: 'hidden',
        visibleBreakpoints: { desktop: true, tablet: true, mobile: true },
        // Link / click action
        linkAction: { type: 'none', target: '' }, // type: 'none' | 'page' | 'url' | 'scrollTo'
        breakpoints: {
          desktop: bp === 'desktop' ? { x: bpX, y: bpY, width: dims.width, height: dims.height } : null,
          tablet: bp === 'tablet' ? { x: bpX, y: bpY, width: dims.width, height: dims.height } : null,
          mobile: bp === 'mobile' ? { x: bpX, y: bpY, width: dims.width, height: dims.height } : null,
        },
      };
      if (bp !== 'desktop') {
        newEl.breakpoints.desktop = { x: bpX, y: bpY, width: dims.width, height: dims.height };
      }
      get()._updatePageElements(els => [...els, newEl]);
      set({ selectedId: newEl.id, selectedChildId: null });
      return newEl.id;
    },

    // ── Add from template (multi-element) ─────────────────────────────────
    addTemplate: (elements) => {
      get()._saveHistory();
      get()._updatePageElements(els => [...els, ...elements]);
    },

    // ── Add child into a container ─────────────────────────────────────────
    addChildToContainer: (containerId, type) => {
      get()._saveHistory();
      const els = get().getElements();
      const parent = els.find(e => e.id === containerId);
      if (!parent) return null;
      const childCount = (parent.children ?? []).length + 1;
      const dims = defaultDimensions(type);
      const newChild = {
        id: genId(), type, width: dims.width, height: dims.height,
        props: defaultProps(type),
        name: defaultElementName(type, childCount),
        visible: true, locked: false,
        children: isContainerType(type) ? [] : undefined,
      };
      get()._updatePageElements(els =>
        els.map(el => el.id !== containerId ? el : { ...el, children: [...(el.children ?? []), newChild] })
      );
      set({ selectedId: containerId, selectedChildId: newChild.id });
      return newChild.id;
    },

    deleteChild: (containerId, childId) => {
      get()._saveHistory();
      get()._updatePageElements(els =>
        els.map(el => el.id !== containerId ? el : {
          ...el, children: (el.children ?? []).filter(c => c.id !== childId),
        })
      );
      set(s => ({ selectedChildId: s.selectedChildId === childId ? null : s.selectedChildId }));
    },

    reorderChildren: (containerId, fromIdx, toIdx) => {
      get()._updatePageElements(els =>
        els.map(el => {
          if (el.id !== containerId) return el;
          const kids = [...(el.children ?? [])];
          const [m] = kids.splice(fromIdx, 1);
          kids.splice(toIdx, 0, m);
          return { ...el, children: kids };
        })
      );
    },

    updateChildProp: (containerId, childId, key, value) => {
      get()._updatePageElements(els =>
        els.map(el => el.id !== containerId ? el : {
          ...el,
          children: (el.children ?? []).map(c =>
            c.id !== childId ? c : { ...c, props: { ...c.props, [key]: value } }
          ),
        })
      );
    },

    updateChildBounds: (containerId, childId, w, h) => {
      get()._updatePageElements(els =>
        els.map(el => el.id !== containerId ? el : {
          ...el,
          children: (el.children ?? []).map(c =>
            c.id !== childId ? c : { ...c, width: Math.round(w ?? c.width), height: Math.round(h ?? c.height) }
          ),
        })
      );
    },

    updateChildName: (containerId, childId, name) => {
      get()._updatePageElements(els =>
        els.map(el => el.id !== containerId ? el : {
          ...el,
          children: (el.children ?? []).map(c => c.id !== childId ? c : { ...c, name }),
        })
      );
    },

    duplicateChild: (containerId, childId) => {
      get()._saveHistory();
      get()._updatePageElements(els =>
        els.map(el => {
          if (el.id !== containerId) return el;
          const kids = el.children ?? [];
          const src = kids.find(c => c.id === childId);
          if (!src) return el;
          const copy = { ...JSON.parse(JSON.stringify(src)), id: genId(), name: `${src.name} (kopya)` };
          return { ...el, children: [...kids, copy] };
        })
      );
    },

    toggleChildVisibility: (containerId, childId) => {
      get()._updatePageElements(els =>
        els.map(el => el.id !== containerId ? el : {
          ...el,
          children: (el.children ?? []).map(c =>
            c.id !== childId ? c : { ...c, visible: !c.visible }
          ),
        })
      );
    },

    // ── Top-level mutations ────────────────────────────────────────────────
    updateProp: (id, key, value) => {
      get()._updatePageElements(els =>
        els.map(el => el.id === id ? { ...el, props: { ...el.props, [key]: value } } : el)
      );
    },

    updateElementBounds: (id, bounds) => {
      const bp = get().activeBreakpoint;
      get()._updatePageElements(els =>
        els.map(el => {
          if (el.id !== id) return el;
          const current = getElementBounds(el, bp);
          const updated = {
            x: bounds.x !== undefined ? Math.round(bounds.x) : current.x,
            y: bounds.y !== undefined ? Math.round(bounds.y) : current.y,
            width: bounds.width !== undefined ? Math.round(bounds.width) : current.width,
            height: bounds.height !== undefined ? Math.round(bounds.height) : current.height,
          };
          return { ...el, breakpoints: { ...el.breakpoints, [bp]: updated } };
        })
      );
    },

    moveElement: (id, x, y) => {
      const bp = get().activeBreakpoint;
      get()._updatePageElements(els =>
        els.map(el => {
          if (el.id !== id) return el;
          const current = getElementBounds(el, bp);
          return {
            ...el,
            breakpoints: { ...el.breakpoints, [bp]: { ...current, x: Math.round(x), y: Math.round(y) } },
          };
        })
      );
    },

    commitMove: () => get()._saveHistory(),

    deleteElement: (id) => {
      get()._saveHistory();
      get()._updatePageElements(els => els.filter(el => el.id !== id));
      set(s => ({ selectedId: s.selectedId === id ? null : s.selectedId, snapLines: [] }));
    },

    duplicateElement: (id) => {
      get()._saveHistory();
      const el = get().getElements().find(e => e.id === id);
      if (!el) return;
      const bp = get().activeBreakpoint;
      const bounds = getElementBounds(el, bp);
      const copy = {
        ...JSON.parse(JSON.stringify(el)),
        id: genId(),
        name: `${el.name} (kopya)`,
        breakpoints: {
          ...JSON.parse(JSON.stringify(el.breakpoints ?? {})),
          [bp]: { ...bounds, x: bounds.x + 24, y: bounds.y + 24 },
        },
      };
      get()._updatePageElements(els => [...els, copy]);
      set({ selectedId: copy.id });
    },

    renameElement: (id, name) => { get()._updatePageElements(els => els.map(el => el.id === id ? { ...el, name } : el)); },
    toggleVisibility: (id) => { get()._updatePageElements(els => els.map(el => el.id === id ? { ...el, visible: !el.visible } : el)); },
    toggleLock: (id) => { get()._updatePageElements(els => els.map(el => el.id === id ? { ...el, locked: !el.locked } : el)); },

    // ── Advanced element props ─────────────────────────────────────────────
    updateSpacing: (id, side, type, value) => {
      // side: 'top'|'right'|'bottom'|'left', type: 'margin'|'padding'
      get()._updatePageElements(els =>
        els.map(el => el.id !== id ? el : {
          ...el,
          spacing: {
            ...(el.spacing ?? { margin: defaultSpacing(), padding: defaultSpacing() }),
            [type]: {
              ...(el.spacing?.[type] ?? defaultSpacing()),
              [side]: value,
            },
          },
        })
      );
    },

    updateShadow: (id, shadowObj) => {
      get()._updatePageElements(els =>
        els.map(el => el.id !== id ? el : { ...el, shadow: shadowObj })
      );
    },

    updatePositionMode: (id, positionMode) => {
      get()._updatePageElements(els =>
        els.map(el => el.id !== id ? el : { ...el, positionMode })
      );
    },

    updateOverflow: (id, overflow) => {
      get()._updatePageElements(els =>
        els.map(el => el.id !== id ? el : { ...el, overflow })
      );
    },

    toggleBreakpointVisibility: (id, bp) => {
      get()._updatePageElements(els =>
        els.map(el => {
          if (el.id !== id) return el;
          const current = el.visibleBreakpoints ?? { desktop: true, tablet: true, mobile: true };
          return { ...el, visibleBreakpoints: { ...current, [bp]: !current[bp] } };
        })
      );
    },

    // ── Link / Click Action ────────────────────────────────────────────────
    updateLinkAction: (id, linkAction) => {
      get()._updatePageElements(els =>
        els.map(el => el.id !== id ? el : { ...el, linkAction })
      );
    },

    updateChildLinkAction: (containerId, childId, linkAction) => {
      get()._updatePageElements(els =>
        els.map(el => el.id !== containerId ? el : {
          ...el,
          children: (el.children ?? []).map(c =>
            c.id !== childId ? c : { ...c, linkAction }
          ),
        })
      );
    },

    // ── Layer ordering ─────────────────────────────────────────────────────
    bringToFront: (id) => { get()._updatePageElements(els => { const el = els.find(e => e.id === id); return el ? [...els.filter(e => e.id !== id), el] : els; }); },
    sendToBack: (id) => { get()._updatePageElements(els => { const el = els.find(e => e.id === id); return el ? [el, ...els.filter(e => e.id !== id)] : els; }); },
    bringForward: (id) => {
      get()._updatePageElements(els => {
        const idx = els.findIndex(e => e.id === id);
        if (idx === els.length - 1) return els;
        const arr = [...els];[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; return arr;
      });
    },
    sendBackward: (id) => {
      get()._updatePageElements(els => {
        const idx = els.findIndex(e => e.id === id);
        if (idx === 0) return els;
        const arr = [...els];[arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]]; return arr;
      });
    },
    reorderElements: (fromIndex, toIndex) => {
      get()._saveHistory();
      get()._updatePageElements(els => {
        const arr = [...els];
        const [m] = arr.splice(fromIndex, 1);
        arr.splice(toIndex, 0, m);
        return arr;
      });
    },
  };
});