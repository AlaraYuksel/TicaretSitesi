import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditorStore, BREAKPOINTS, BREAKPOINT_ORDER, getElementBounds } from '../../store/useEditorStore';
import AISiteBuilderModal from './AISiteBuilderModal';

const BP_COLORS = { desktop: '#4b8eff', tablet: '#a855f7', mobile: '#10b981' };

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function css(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k.replace(/([A-Z])/g, m => '-' + m.toLowerCase())}:${v}`)
    .join(';');
}

function toEmbedUrl(url) {
  if (!url) return '';
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  return url;
}

// ─── LINK ACTION WRAPPER ──────────────────────────────────────────────────────
function wrapWithLinkAction(html, el, pages) {
  const la = el.linkAction;
  if (!la || la.type === 'none' || !la.target) return html;

  if (la.type === 'page') {
    // Find page index by id
    const pageIdx = pages.findIndex(p => p.id === la.target);
    if (pageIdx === -1) return html;
    return `<div style="cursor:pointer;" onclick="window.__goToPage(${pageIdx})">${html}</div>`;
  }

  if (la.type === 'url') {
    const target = la.openIn === '_blank' ? '_blank' : '_self';
    return `<a href="${la.target}" target="${target}" style="text-decoration:none;color:inherit;display:contents;">${html}</a>`;
  }

  if (la.type === 'scrollTo') {
    return `<div style="cursor:pointer;" onclick="document.getElementById('${la.target}')?.scrollIntoView({behavior:'smooth'})">${html}</div>`;
  }

  return html;
}

// ─── ELEMENT → HTML ───────────────────────────────────────────────────────────
function elementToHTML(el, bp = 'desktop', pages = []) {
  const b = getElementBounds(el, bp);
  const p = el.props ?? {};
  const vis = el.visibleBreakpoints ?? { desktop: true, tablet: true, mobile: true };
  if (el.visible === false || vis[bp] === false) return '';

  const mode = el.positionMode || 'absolute';
  const base = {
    position: mode,
    left: b.x + 'px',
    top: mode === 'sticky' ? '0' : b.y + 'px',
    width: b.width + 'px',
    height: b.height + 'px',
    'box-sizing': 'border-box',
    overflow: el.overflow ?? 'hidden',
    ...(mode === 'fixed' ? { 'z-index': 100 } : {}),
    ...(mode === 'sticky' ? { 'z-index': 90 } : {}),
  };

  const gradBg = p.gradientEnabled
    ? `linear-gradient(${p.gradientAngle ?? 135}deg,${p.gradientStart ?? '#4b8eff'},${p.gradientEnd ?? '#8b5cf6'})`
    : null;

  switch (el.type) {

    case 'heading':
      return `<h1 style="${css({ ...base, 'font-size': `${p.fontSize ?? 48}px`, 'font-weight': p.fontWeight ?? '800', color: p.color ?? '#e5e2e1', 'text-align': p.align ?? 'left', margin: '0', 'font-family': p.fontFamily ?? 'inherit', 'line-height': p.lineHeight ?? 1.15, 'letter-spacing': (p.letterSpacing ?? 0) + 'px', 'text-decoration': p.textDecoration ?? 'none' })}">${p.text ?? ''}</h1>`;

    case 'paragraph':
      return `<p style="${css({ ...base, 'font-size': `${p.fontSize ?? 16}px`, 'font-weight': p.fontWeight ?? '400', color: p.color ?? '#9ca3af', 'text-align': p.align ?? 'left', margin: '0', 'font-family': p.fontFamily ?? 'inherit', 'line-height': p.lineHeight ?? 1.65, 'letter-spacing': (p.letterSpacing ?? 0) + 'px' })}">${(p.text ?? '').replace(/\n/g, '<br>')}</p>`;

    case 'button':
      return `<a href="${p.href || '#'}" style="${css({ ...base, background: p.bg ?? '#4b8eff', color: p.color ?? '#fff', 'border-radius': `${p.borderRadius ?? 8}px`, display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'font-size': `${p.fontSize ?? 15}px`, 'font-weight': p.fontWeight ?? '700', 'text-decoration': 'none', 'cursor': 'pointer' })}">${p.text ?? 'Button'}</a>`;

    case 'image':
      return `<div style="${css({ ...base, 'border-radius': `${p.borderRadius ?? 8}px`, overflow: 'hidden' })}"><img src="${p.src ?? ''}" alt="${p.alt ?? ''}" style="width:100%;height:100%;object-fit:${p.objectFit ?? 'cover'};display:block;" /></div>`;

    case 'video': {
      const embed = toEmbedUrl(p.url);
      if (!embed) return `<div style="${css({ ...base, background: '#0a0a0a', 'border-radius': `${p.borderRadius ?? 12}px`, 'border': '1.5px dashed #2a2a2a' })}"></div>`;
      return `<div style="${css({ ...base, 'border-radius': `${p.borderRadius ?? 12}px`, overflow: 'hidden', background: '#000' })}"><iframe src="${embed}" style="width:100%;height:100%;border:none;display:block;" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div>`;
    }

    case 'box':
      return `<div style="${css({ ...base, background: gradBg || (p.bg ?? '#1c1b1b'), 'border-radius': `${p.borderRadius ?? 0}px`, opacity: (p.opacity ?? 100) / 100, border: p.borderWidth ? `${p.borderWidth}px solid ${p.borderColor}` : 'none' })}"></div>`;

    case 'section': {
      const children = (el.children ?? []).map(c => {
        const cp = c.props ?? {};
        return `<div style="padding:8px;font-size:${cp.fontSize ?? 14}px;color:${cp.color ?? '#e5e2e1'}">${cp.text ?? ''}</div>`;
      }).join('');
      return `<div style="${css({ ...base, background: gradBg || (p.bg ?? '#141414'), 'border-radius': `${p.borderRadius ?? 0}px`, padding: `${p.padding ?? 20}px` })}">${children}</div>`;
    }

    case 'divider':
      return `<div style="${css({ ...base, display: 'flex', 'align-items': 'center' })}"><div style="width:100%;height:${p.thickness ?? 1}px;background:${p.color ?? '#2a2a2a'};border-style:${p.style ?? 'solid'};"></div></div>`;

    case 'dividerText':
      return `<div style="${css({ ...base, display: 'flex', 'align-items': 'center', gap: '16px' })}"><div style="flex:1;height:1px;background:${p.lineColor ?? '#2a2a2a'};"></div><span style="font-size:${p.fontSize ?? 12}px;font-weight:${p.fontWeight ?? '600'};color:${p.color ?? '#555'};white-space:nowrap;">${p.text ?? 'VEYA'}</span><div style="flex:1;height:1px;background:${p.lineColor ?? '#2a2a2a'};"></div></div>`;

    case 'icon':
      return `<div style="${css({ ...base, display: 'flex', 'align-items': 'center', 'justify-content': 'center' })}"><span class="material-symbols-outlined" style="font-size:${p.size ?? 40}px;color:${p.color ?? '#4b8eff'};font-variation-settings:'FILL' 1;">${p.name ?? 'star'}</span></div>`;

    case 'badge':
      return `<div style="${css({ ...base, display: 'flex', 'align-items': 'center', 'justify-content': 'center' })}"><span style="display:inline-flex;align-items:center;background:${p.bg ?? '#4b8eff'};color:${p.color ?? '#fff'};padding:${p.paddingY ?? 5}px ${p.paddingX ?? 12}px;border-radius:${p.borderRadius ?? 99}px;font-size:${p.fontSize ?? 11}px;font-weight:${p.fontWeight ?? '700'};text-transform:${p.uppercase ? 'uppercase' : 'none'};letter-spacing:${p.uppercase ? '1.5px' : '0'};">${p.text ?? 'Badge'}</span></div>`;

    case 'navbar': {
      const links = (p.links ?? []).map(l => {
        if (l.targetPageId) {
          const pageIdx = pages.findIndex(pg => pg.id === l.targetPageId);
          if (pageIdx !== -1) {
            return `<a href="#" onclick="event.preventDefault();window.__goToPage(${pageIdx})" style="color:${p.linkColor ?? '#e5e2e1'};text-decoration:none;font-size:${p.fontSize ?? 14}px;opacity:0.8;cursor:pointer;">${l.label}</a>`;
          }
        }
        return `<a href="${l.href || '#'}" style="color:${p.linkColor ?? '#e5e2e1'};text-decoration:none;font-size:${p.fontSize ?? 14}px;opacity:0.8;">${l.label}</a>`;
      }).join('');
      const cta = p.showCta !== false ? `<a href="${p.ctaHref || '#'}" style="background:${p.ctaBg ?? '#4b8eff'};color:${p.ctaColor ?? '#fff'};padding:8px 20px;border-radius:${p.ctaBorderRadius ?? 8}px;text-decoration:none;font-size:13px;font-weight:700;">${p.ctaText ?? 'Başla'}</a>` : '';
      return wrapWithLinkAction(`<nav style="${css({ ...base, background: p.bg ?? 'rgba(14,14,14,0.9)', display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '0 32px', 'border-bottom': `1px solid ${p.borderBottom ?? 'rgba(255,255,255,0.06)'}` })}"><span style="font-size:${p.logoFontSize ?? 18}px;font-weight:800;color:${p.logoColor ?? '#e5e2e1'};">${p.logo ?? 'Brand'}</span><div style="display:flex;gap:28px;align-items:center;">${links}</div>${cta}</nav>`, el, pages);
    }

    case 'sidebar': {
      const links = (p.links ?? []).map(l => {
        const linkContent = `<span style="font-size:13px;font-weight:${l.active ? 700 : 400};color:${l.active ? (p.activeLinkColor ?? '#e5e2e1') : (p.linkColor ?? '#888')};">${l.label}</span>`;
        if (l.targetPageId) {
          const pageIdx = pages.findIndex(pg => pg.id === l.targetPageId);
          if (pageIdx !== -1) {
            return `<div style="display:flex;align-items:center;gap:12px;padding:10px 20px;background:${l.active ? (p.activeBg ?? 'rgba(75,142,255,0.1)') : 'transparent'};border-left:3px solid ${l.active ? (p.activeAccent ?? '#4b8eff') : 'transparent'};cursor:pointer;" onclick="window.__goToPage(${pageIdx})">${linkContent}</div>`;
          }
        }
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 20px;background:${l.active ? (p.activeBg ?? 'rgba(75,142,255,0.1)') : 'transparent'};border-left:3px solid ${l.active ? (p.activeAccent ?? '#4b8eff') : 'transparent'};cursor:pointer;">${linkContent}</div>`;
      }).join('');
      return wrapWithLinkAction(`<aside style="${css({ ...base, background: p.bg ?? '#141414', 'border-right': `1px solid ${p.borderRight ?? 'rgba(255,255,255,0.06)'}`, display: 'flex', 'flex-direction': 'column', padding: '20px 0' })}"><div style="padding:0 20px 20px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:8px;"><span style="font-size:18px;font-weight:800;color:${p.logoColor ?? '#e5e2e1'};">${p.logo ?? 'App'}</span></div>${links}</aside>`, el, pages);
    }

    case 'hero': {
      const titleHtml = (p.title ?? '').split('\n').join('<br>');
      const cta = `<a href="${p.ctaHref || '#'}" style="background:${p.ctaBg ?? '#4b8eff'};color:${p.ctaColor ?? '#fff'};padding:14px 32px;border-radius:${p.ctaBorderRadius ?? 10}px;text-decoration:none;font-size:15px;font-weight:700;display:inline-block;">${p.ctaText ?? 'Başla'}</a>`;
      const sub = p.subCtaText ? `<a href="${p.subCtaHref || '#'}" style="border:1.5px solid rgba(255,255,255,0.15);color:#e5e2e1;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">${p.subCtaText}</a>` : '';
      const bgStyle = p.bgImageUrl
        ? `background:linear-gradient(rgba(0,0,0,${(p.overlayOpacity ?? 50) / 100}),rgba(0,0,0,${(p.overlayOpacity ?? 50) / 100})),url(${p.bgImageUrl}) center/cover;`
        : `background:${p.bg ?? '#0e0e0e'};`;
      return `<section style="${css({ ...base, 'text-align': p.align ?? 'center', display: 'flex', 'flex-direction': 'column', 'align-items': p.align === 'left' ? 'flex-start' : 'center', 'justify-content': 'center', padding: '60px 80px', gap: '20px' })};${bgStyle}"><span style="font-size:11px;font-weight:800;color:${p.tagColor ?? '#4b8eff'};background:${p.tagBg ?? 'rgba(75,142,255,0.1)'};padding:4px 14px;border-radius:99px;letter-spacing:2px;">${p.tag ?? ''}</span><h1 style="margin:0;font-size:56px;font-weight:900;color:${p.titleColor ?? '#e5e2e1'};line-height:1.1;">${titleHtml}</h1><p style="margin:0;font-size:18px;color:${p.subtitleColor ?? '#9ca3af'};max-width:600px;line-height:1.6;">${p.subtitle ?? ''}</p><div style="display:flex;gap:12px;flex-wrap:wrap;">${cta}${sub}</div></section>`;
    }

    case 'card': {
      const img = p.imageSrc ? `<img src="${p.imageSrc}" alt="${p.imageAlt ?? ''}" style="width:100%;height:100%;object-fit:cover;display:block;" />` : '';
      return `<div style="${css({ ...base, background: p.bg ?? '#1a1a1a', 'border-radius': `${p.borderRadius ?? 16}px`, border: `1px solid ${p.borderColor ?? 'rgba(255,255,255,0.06)'}`, overflow: 'hidden', display: 'flex', 'flex-direction': 'column' })}"><div style="height:200px;background:#111;overflow:hidden;flex-shrink:0;">${img}</div><div style="padding:20px;display:flex;flex-direction:column;gap:10px;flex:1;"><span style="font-size:10px;font-weight:800;color:${p.tagColor ?? '#4b8eff'};letter-spacing:1.5px;">${p.tag ?? ''}</span><h3 style="margin:0;font-size:18px;font-weight:700;color:${p.titleColor ?? '#e5e2e1'};line-height:1.3;">${p.title ?? ''}</h3><p style="margin:0;font-size:13px;color:${p.excerptColor ?? '#9ca3af'};line-height:1.6;">${p.excerpt ?? ''}</p><div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;"><span style="font-size:11px;color:${p.metaColor ?? '#555'};">${p.readTime ?? ''}</span><a href="#" style="font-size:13px;font-weight:600;color:${p.ctaColor ?? '#4b8eff'};text-decoration:none;">${p.ctaText ?? 'Devamını Oku →'}</a></div></div></div>`;
    }

    case 'form': {
      const fields = (p.fields ?? []).map(f => {
        const inp = f.type === 'textarea'
          ? `<textarea placeholder="${f.placeholder ?? ''}" rows="3" style="background:${p.inputBg ?? '#1e1e1e'};border:1px solid ${p.inputBorderColor ?? 'rgba(255,255,255,0.1)'};border-radius:8px;color:${p.inputColor ?? '#e5e2e1'};font-size:13px;padding:10px 14px;resize:none;outline:none;font-family:inherit;width:100%;box-sizing:border-box;"></textarea>`
          : `<input type="${f.type ?? 'text'}" placeholder="${f.placeholder ?? ''}" style="background:${p.inputBg ?? '#1e1e1e'};border:1px solid ${p.inputBorderColor ?? 'rgba(255,255,255,0.1)'};border-radius:8px;color:${p.inputColor ?? '#e5e2e1'};font-size:13px;padding:10px 14px;outline:none;font-family:inherit;width:100%;box-sizing:border-box;" />`;
        return `<div style="display:flex;flex-direction:column;gap:6px;"><label style="font-size:12px;font-weight:600;color:${p.labelColor ?? '#888'};">${f.label ?? ''}</label>${inp}</div>`;
      }).join('');
      return `<form style="${css({ ...base, display: 'flex', 'flex-direction': 'column', gap: `${p.gap ?? 16}px`, padding: '4px', 'box-sizing': 'border-box' })}" onsubmit="return false;">${fields}<button type="submit" style="width:100%;padding:12px;background:${p.submitBg ?? '#4b8eff'};color:${p.submitColor ?? '#fff'};border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">${p.submitText ?? 'Gönder'}</button></form>`;
    }

    case 'accordion': {
      const items = (p.items ?? []).map((item, i) => `<div style="background:${p.itemBg ?? '#1a1a1a'};border:1px solid ${p.borderColor ?? 'rgba(255,255,255,0.07)'};border-radius:10px;overflow:hidden;margin-bottom:8px;"><div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'"><span style="font-size:${p.fontSize ?? 14}px;font-weight:600;color:${p.questionColor ?? '#e5e2e1'};">${item.question}</span><span>+</span></div><div style="display:${i === 0 ? 'block' : 'none'};padding:0 18px 14px;font-size:13px;color:${p.answerColor ?? '#9ca3af'};line-height:1.6;">${item.answer}</div></div>`).join('');
      return `<div style="${css({ ...base, display: 'flex', 'flex-direction': 'column', overflow: 'auto' })}">${items}</div>`;
    }

    case 'tabs': {
      const tabList = p.tabs ?? [];
      const tabBtns = tabList.map((t, i) => `<div onclick="(function(el){var c=el.closest('.tabs-root');c.querySelectorAll('.tab-panel').forEach((p,j)=>{p.style.display=j===window.__tabIdx_${el.closest('.tabs-root').id}?'block':'none'});c.querySelectorAll('.tab-btn').forEach(b=>b.style.fontWeight='500');el.style.fontWeight='700';})(this);window.__tabIdx_${el.closest('.tabs-root').id}=${i};" class="tab-btn" style="padding:12px 20px;font-size:${p.fontSize ?? 13}px;font-weight:${i === 0 ? 700 : 500};color:${i === 0 ? (p.activeColor ?? '#4b8eff') : '#666'};cursor:pointer;border-bottom:2px solid ${i === 0 ? (p.activeColor ?? '#4b8eff') : 'transparent'};">${t.label}</div>`).join('');
      const panels = tabList.map((t, i) => `<div class="tab-panel" style="display:${i === 0 ? 'block' : 'none'};flex:1;background:${p.contentBg ?? '#1a1a1a'};padding:20px;font-size:14px;color:${p.textColor ?? '#9ca3af'};line-height:1.6;">${t.content}</div>`).join('');
      return `<div class="tabs-root" id="tabs_${Math.random().toString(36).slice(2)}" style="${css({ ...base, display: 'flex', 'flex-direction': 'column', overflow: 'hidden' })}"><div style="display:flex;border-bottom:1px solid ${p.borderColor ?? 'rgba(255,255,255,0.07)'};background:${p.tabBg ?? '#1a1a1a'};">${tabBtns}</div>${panels}</div>`;
    }

    case 'testimonial': {
      const stars = Array.from({ length: p.rating ?? 5 }).map(() => `<span style="color:${p.starColor ?? '#f59e0b'};font-size:16px;">★</span>`).join('');
      const avatar = p.avatarUrl ? `<img src="${p.avatarUrl}" alt="${p.name ?? ''}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" />` : `<div style="width:40px;height:40px;border-radius:50%;background:#2a2a2a;flex-shrink:0;"></div>`;
      return `<div style="${css({ ...base, background: p.bg ?? '#1a1a1a', 'border-radius': `${p.borderRadius ?? 16}px`, border: `1px solid ${p.borderColor ?? 'rgba(255,255,255,0.06)'}`, padding: '28px', 'box-sizing': 'border-box', display: 'flex', 'flex-direction': 'column', gap: '16px', overflow: 'hidden' })}"><div style="display:flex;gap:2px;">${stars}</div><p style="margin:0;font-size:14px;color:${p.quoteColor ?? '#9ca3af'};line-height:1.7;font-style:italic;">${p.quote ?? ''}</p><div style="display:flex;align-items:center;gap:12px;margin-top:auto;">${avatar}<div><div style="font-size:13px;font-weight:700;color:${p.nameColor ?? '#e5e2e1'};">${p.name ?? ''}</div><div style="font-size:11px;color:${p.metaColor ?? '#666'};">${p.role ?? ''}${p.company ? ' · ' + p.company : ''}</div></div></div></div>`;
    }

    case 'progressBar': {
      const pct = Math.min(100, Math.max(0, ((p.value ?? 75) / (p.max ?? 100)) * 100));
      return `<div style="${css({ ...base, display: 'flex', 'flex-direction': 'column', 'justify-content': 'center', gap: '8px', 'box-sizing': 'border-box' })}"><div style="display:flex;justify-content:space-between;"><span style="font-size:13px;color:${p.labelColor ?? '#9ca3af'};font-weight:600;">${p.label ?? 'Tamamlanma'}</span><span style="font-size:13px;font-weight:700;color:#e5e2e1;">${p.value ?? 75}%</span></div><div style="width:100%;height:${p.height ?? 10}px;background:${p.trackBg ?? '#1e1e1e'};border-radius:${p.borderRadius ?? 99}px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:${p.fillBg ?? '#4b8eff'};border-radius:${p.borderRadius ?? 99}px;"></div></div></div>`;
    }

    case 'countdown': {
      const end = new Date(p.targetDate ?? Date.now() + 86400000);
      const diff = Math.max(0, end - Date.now());
      const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      const units = [[d, p.labelDays ?? 'GÜN'], [h, p.labelHours ?? 'SAAT'], [m, p.labelMinutes ?? 'DAKİKA'], [s, p.labelSeconds ?? 'SANİYE']];
      const blocks = units.map(([v, l]) => `<div style="background:${p.bg ?? '#1a1a1a'};border-radius:${p.borderRadius ?? 12}px;padding:16px 20px;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:70px;"><span style="font-size:${p.numFontSize ?? 48}px;font-weight:900;color:${p.numColor ?? '#e5e2e1'};line-height:1;">${String(v).padStart(2, '0')}</span><span style="font-size:${p.labelFontSize ?? 10}px;color:${p.labelColor ?? '#666'};font-weight:700;letter-spacing:1.5px;">${l}</span></div>`).join('');
      return `<div style="${css({ ...base, display: 'flex', 'align-items': 'center', 'justify-content': 'center', gap: `${p.gap ?? 12}px` })}">${blocks}</div>`;
    }

    case 'avatar': {
      const img = p.src ? `<img src="${p.src}" alt="${p.name ?? ''}" style="width:100%;height:100%;object-fit:cover;" />` : '';
      return `<div style="${css({ ...base, display: 'flex', 'flex-direction': 'column', 'align-items': p.align === 'left' ? 'flex-start' : 'center', 'justify-content': 'center', gap: '10px', padding: '8px', 'box-sizing': 'border-box' })}"><div style="width:${p.size ?? 80}px;height:${p.size ?? 80}px;border-radius:${p.borderRadius ?? 99}px;overflow:hidden;border:${p.showBorder !== false ? `2px solid ${p.borderColor ?? 'rgba(255,255,255,0.1)'}` : 'none'};background:#1e1e1e;flex-shrink:0;">${img}</div><div style="text-align:${p.align ?? 'center'};"><div style="font-size:${p.nameFontSize ?? 16}px;font-weight:700;color:${p.nameColor ?? '#e5e2e1'};">${p.name ?? ''}</div><div style="font-size:${p.roleFontSize ?? 13}px;color:${p.roleColor ?? '#9ca3af'};margin-top:2px;">${p.role ?? ''}</div></div></div>`;
    }

    case 'codeBlock':
      return `<div style="${css({ ...base, background: p.bg ?? '#0d1117', 'border-radius': `${p.borderRadius ?? 10}px`, overflow: 'auto' })}"><div style="display:flex;align-items:center;gap:6px;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);"><div style="width:12px;height:12px;border-radius:50%;background:#ff5f57;"></div><div style="width:12px;height:12px;border-radius:50%;background:#febc2e;"></div><div style="width:12px;height:12px;border-radius:50%;background:#28c840;"></div><span style="margin-left:8px;font-size:11px;color:#666;font-family:monospace;">${p.language ?? 'javascript'}</span></div><pre style="margin:0;padding:16px;font-size:${p.fontSize ?? 13}px;color:${p.color ?? '#e6edf3'};font-family:'Fira Code',monospace;line-height:1.6;white-space:pre-wrap;overflow:auto;">${(p.code ?? '').replace(/</g, '<').replace(/>/g, '>')}</pre></div>`;

    case 'table': {
      const headers = (p.headers ?? []);
      const rows = (p.rows ?? []);
      const colW = headers.length > 0 ? Math.floor(100 / headers.length) : 100;
      const cols = headers.map(() => `<col style="width:${colW}%;">`).join('');
      const ths = headers.map(h => `<th style="padding:12px 16px;text-align:left;color:${p.headerColor ?? '#e5e2e1'};font-weight:700;border-bottom:1px solid ${p.borderColor ?? 'rgba(255,255,255,0.06)'};box-sizing:border-box;white-space:nowrap;">${h}</th>`).join('');
      const trs = rows.map((row, ri) => `<tr style="background:${ri % 2 === 0 ? (p.rowBg ?? '#141414') : (p.altRowBg ?? '#1a1a1a')};">${row.map(cell => `<td style="padding:11px 16px;color:${p.cellColor ?? '#9ca3af'};border-bottom:1px solid ${p.borderColor ?? 'rgba(255,255,255,0.04)'};box-sizing:border-box;">${cell}</td>`).join('')}</tr>`).join('');
      return `<div style="${css({ ...base, overflow: 'auto', 'border-radius': `${p.borderRadius ?? 10}px`, border: `1px solid ${p.borderColor ?? 'rgba(255,255,255,0.06)'}` })}"><table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:${p.fontSize ?? 13}px;"><colgroup>${cols}</colgroup><thead><tr style="background:${p.headerBg ?? '#1e1e1e'};">${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
    }

    case 'socialLinks': {
      const ICONS = { twitter: '𝕏', instagram: '📸', linkedin: 'in', github: '⌥', youtube: '▶', facebook: 'f', tiktok: '♪' };
      const links = (p.links ?? []).map(l => `<a href="${l.url || '#'}" style="width:${p.size ?? 40}px;height:${p.size ?? 40}px;background:${p.bg ?? 'rgba(255,255,255,0.05)'};border-radius:${p.borderRadius ?? 8}px;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:16px;color:${p.iconColor ?? '#e5e2e1'};font-weight:700;flex-shrink:0;">${ICONS[l.platform] ?? '🔗'}</a>`).join('');
      return `<div style="${css({ ...base, display: 'flex', 'align-items': 'center', 'flex-direction': p.direction ?? 'row', gap: `${p.gap ?? 12}px`, 'flex-wrap': 'wrap' })}">${links}</div>`;
    }

    case 'horizontalScroll': {
      const items = (p.items ?? []).map(item =>
        `<div style="flex:0 0 ${p.itemWidth ?? 220}px;height:${p.itemHeight ?? 200}px;background:${item.bg ?? '#1a1a1a'};border-radius:10px;border:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;padding:16px;box-sizing:border-box;scroll-snap-align:${p.snapToItem !== false ? 'start' : 'none'};"><div style="font-size:${p.titleFontSize ?? 14}px;font-weight:700;color:${p.titleColor ?? '#e5e2e1'};margin-bottom:4px;">${item.title}</div><div style="font-size:${p.descFontSize ?? 12}px;color:${p.descColor ?? '#9ca3af'};line-height:1.5;">${item.desc}</div></div>`
      ).join('');
      const trackId = `track_${Math.random().toString(36).slice(2, 9)}`;
      const step = (p.itemWidth ?? 220) + (p.gap ?? 16);
      const arrowBtn = (dir) => {
        if (p.showArrows === false) return '';
        const isLeft = dir === -1;
        return `<button onclick="document.getElementById('${trackId}').scrollBy({left: ${dir * step}, behavior: 'smooth'})" style="position:absolute;top:50%;transform:translateY(-50%);${isLeft ? 'left:8px;' : 'right:8px;'}z-index:10;width:36px;height:36px;border-radius:50%;background:${p.arrowBg ?? 'rgba(75,142,255,0.2)'};border:1px solid ${(p.arrowColor ?? '#4b8eff') + '44'};color:${p.arrowColor ?? '#4b8eff'};cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;"><span class="material-symbols-outlined" style="font-size:20px;">${isLeft ? 'chevron_left' : 'chevron_right'}</span></button>`;
      };
      return `<div style="${css({ ...base, background: p.bg ?? '#141414', 'border-radius': `${p.borderRadius ?? 12}px`, overflow: 'hidden' })}">
        ${arrowBtn(-1)}
        <div id="${trackId}" style="display:flex;flex-direction:row;gap:${p.gap ?? 16}px;padding:${p.padding ?? 16}px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:${p.snapToItem !== false ? 'x mandatory' : 'none'};scroll-behavior:smooth;height:100%;box-sizing:border-box;-webkit-overflow-scrolling:touch;scrollbar-width:none;">${items}</div>
        ${arrowBtn(1)}
      </div>`;
    }

    // ── 🛒 E-Ticaret Elementleri (Preview HTML — interaktif) ───────────────

    case 'productCard': {
      const pid = `prod_${el.id}`;
      const priceF = (p.price ?? 0).toFixed(2);
      const addJS = `window.__cart&&window.__cart.add({id:'${pid}',title:'${(p.title??'Ürün').replace(/'/g,"\\'")}',price:${p.price??0},qty:1,image:'${p.imageSrc??''}'})`;
      const img = p.imageSrc ? `<img src="${p.imageSrc}" alt="${p.imageAlt??''}" style="width:100%;height:100%;object-fit:cover;" />` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e,#16213e);"><span class="material-symbols-outlined" style="font-size:48px;color:#333;">inventory_2</span></div>`;
      const badge = p.showBadge && p.badge ? `<div style="position:absolute;top:12px;left:12px;z-index:2;background:${p.badgeBg??'#ef4444'};color:${p.badgeColor??'#fff'};font-size:9px;font-weight:800;padding:3px 10px;border-radius:6px;letter-spacing:1px;">${p.badge}</div>` : '';
      const stars = p.showRating ? `<div style="display:flex;gap:1px;">${Array.from({length:Math.floor(p.rating??4.5)}).map(()=>`<span style="color:#f59e0b;font-size:14px;">★</span>`).join('')}<span style="font-size:11px;color:#666;margin-left:4px;">(${p.reviewCount??0})</span></div>` : '';
      const compare = p.showComparePrice && p.comparePrice > 0 ? `<span style="font-size:14px;color:${p.oldPriceColor??'#555'};text-decoration:line-through;">${p.currency??'₺'}${(p.comparePrice).toFixed(2)}</span>` : '';
      return `<div style="${css({...base,background:p.bg??'#1a1a1a','border-radius':`${p.borderRadius??16}px`,border:`1px solid ${p.borderColor??'rgba(255,255,255,0.06)'}`,overflow:'hidden',display:'flex','flex-direction':'column'})}">${badge}<div style="height:200px;overflow:hidden;flex-shrink:0;">${img}</div><div style="padding:16px 18px;display:flex;flex-direction:column;gap:8px;flex:1;"><h3 style="margin:0;font-size:16px;font-weight:700;color:${p.titleColor??'#e5e2e1'};">${p.title??'Ürün Adı'}</h3><p style="margin:0;font-size:12px;color:${p.descColor??'#9ca3af'};line-height:1.5;">${p.description??''}</p>${stars}<div style="display:flex;align-items:center;gap:10px;margin-top:auto;"><span style="font-size:22px;font-weight:900;color:${p.priceColor??'#22c55e'};">${p.currency??'₺'}${priceF}</span>${compare}</div><button onclick="${addJS}" style="width:100%;padding:10px;background:${p.ctaBg??'#22c55e'};color:${p.ctaColor??'#fff'};border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;"><span class="material-symbols-outlined" style="font-size:16px;">shopping_cart</span>${p.ctaText??'Sepete Ekle'}</button></div></div>`;
    }

    case 'productGrid': {
      const products = p.products ?? [];
      const cols = p.columns ?? 3;
      const cards = products.map(prod => {
        const pid = `prod_${prod.id}`;
        const addJS = `window.__cart&&window.__cart.add({id:'${pid}',title:'${(prod.title??'').replace(/'/g,"\\'")}',price:${prod.price??0},qty:1,image:'${prod.image??''}'})`;
        const img = prod.image ? `<img src="${prod.image}" alt="${prod.title}" style="width:100%;height:100%;object-fit:cover;" />` : `<span class="material-symbols-outlined" style="font-size:36px;color:#333;">inventory_2</span>`;
        const bdg = prod.badge ? `<span style="position:absolute;top:8px;right:8px;font-size:8px;font-weight:800;background:${p.badgeBg??'#4b8eff'};color:${p.badgeColor??'#fff'};padding:2px 8px;border-radius:4px;">${prod.badge}</span>` : '';
        return `<div style="background:${p.cardBg??'#1a1a1a'};border:1px solid ${p.cardBorderColor??'rgba(255,255,255,0.06)'};border-radius:14px;overflow:hidden;display:flex;flex-direction:column;"><div style="height:140px;background:linear-gradient(135deg,#1a1a2e,#16213e);display:flex;align-items:center;justify-content:center;position:relative;">${img}${bdg}</div><div style="padding:12px 14px;display:flex;flex-direction:column;gap:6px;flex:1;"><span style="font-size:13px;font-weight:600;color:${p.titleColor??'#e5e2e1'};">${prod.title}</span><span style="font-size:18px;font-weight:800;color:${p.priceColor??'#22c55e'};margin-top:auto;">₺${(prod.price??0).toFixed(2)}</span><button onclick="${addJS}" style="width:100%;padding:8px;background:${p.ctaBg??'#22c55e'};color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;margin-top:4px;">Sepete Ekle</button></div></div>`;
      }).join('');
      const title = p.sectionTitle ? `<h2 style="margin:0 0 20px;font-size:${p.sectionTitleSize??28}px;font-weight:800;color:${p.sectionTitleColor??'#e5e2e1'};">${p.sectionTitle}</h2>` : '';
      return `<div style="${css({...base,background:p.bg??'#0e0e0e','border-radius':`${p.borderRadius??16}px`,padding:`${p.padding??24}px`,'box-sizing':'border-box',overflow:'auto'})}">${title}<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:${p.gap??20}px;">${cards}</div></div>`;
    }

    case 'cartButton': {
      const addJS = `window.__cart&&window.__cart.add({id:'btn_${el.id}',title:'Ürün',price:0,qty:1})`;
      return `<button onclick="${addJS}" style="${css({...base,background:p.bg??'#22c55e',color:p.color??'#fff','font-size':`${p.fontSize??15}px`,'font-weight':p.fontWeight??'700',border:'none','border-radius':`${p.borderRadius??10}px`,cursor:'pointer',display:'flex','align-items':'center','justify-content':'center',gap:'8px','box-shadow':`${p.shadowX??0}px ${p.shadowY??4}px ${p.shadowBlur??20}px ${p.shadowColor??'rgba(34,197,94,0.3)'}`})}">${p.text??'🛒 Sepete Ekle'}</button>`;
    }

    case 'priceTag': {
      const disc = p.showDiscount && p.comparePrice > p.price ? Math.round((1-p.price/p.comparePrice)*100) : 0;
      const compare = p.comparePrice > 0 ? `<span style="font-size:${p.comparePriceFontSize??18}px;color:${p.comparePriceColor??'#666'};text-decoration:line-through;">${p.currency??'₺'}${(p.comparePrice??399.99).toFixed(2)}</span>` : '';
      const discBadge = disc > 0 ? `<span style="font-size:12px;font-weight:800;background:${p.discountBg??'#ef4444'};color:${p.discountColor??'#fff'};padding:3px 10px;border-radius:6px;">-%${disc}</span>` : '';
      return `<div style="${css({...base,display:'flex','align-items':'center',gap:'12px','flex-wrap':'wrap'})}"><span style="font-size:${p.priceFontSize??32}px;font-weight:${p.fontWeight??'800'};color:${p.priceColor??'#22c55e'};">${p.currency??'₺'}${(p.price??299.99).toFixed(2)}</span>${compare}${discBadge}</div>`;
    }

    case 'storeHeader': {
      const cats = (p.categories??[]).map((c,i) => `<span style="font-size:12px;font-weight:${i===0?700:500};color:${i===0?(p.activeCategoryColor??'#4b8eff'):'#888'};background:${i===0?`${p.activeCategoryColor??'#4b8eff'}18`:'rgba(255,255,255,0.04)'};padding:6px 16px;border-radius:8px;cursor:pointer;">${c}</span>`).join('');
      const logo = p.logoSrc ? `<img src="${p.logoSrc}" alt="logo" style="width:100%;height:100%;object-fit:cover;border-radius:14px;" />` : `<span class="material-symbols-outlined" style="font-size:28px;color:#4b8eff;">storefront</span>`;
      const search = p.showSearch !== false ? `<div style="display:flex;align-items:center;gap:10px;background:${p.searchBg??'#1a1a1a'};border:1px solid ${p.searchBorderColor??'rgba(255,255,255,0.1)'};border-radius:12px;padding:12px 18px;max-width:500px;"><span class="material-symbols-outlined" style="font-size:18px;color:#555;">search</span><span style="font-size:14px;color:#444;">${p.searchPlaceholder??'Ürün ara...'}</span></div>` : '';
      return `<div style="${css({...base,background:p.bg??'linear-gradient(135deg,#0e0e0e 0%,#1a1a2e 100%)','border-radius':`${p.borderRadius??0}px`,padding:`${p.padding??40}px`,'box-sizing':'border-box',display:'flex','flex-direction':'column','justify-content':'center',gap:'20px'})}"><div style="display:flex;align-items:center;gap:16px;"><div style="width:56px;height:56px;border-radius:14px;background:rgba(75,142,255,0.1);border:1px solid rgba(75,142,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">${logo}</div><div><h1 style="margin:0;font-size:${p.nameFontSize??32}px;font-weight:900;color:${p.nameColor??'#e5e2e1'};">${p.storeName??'Mağaza Adı'}</h1><p style="margin:4px 0 0;font-size:${p.descFontSize??16}px;color:${p.descColor??'#9ca3af'};">${p.storeDesc??''}</p></div></div>${search}<div style="display:flex;gap:8px;flex-wrap:wrap;">${cats}</div></div>`;
    }

    case 'cartWidget': {
      return `<div style="${css({...base,display:'flex','align-items':'center','justify-content':'center',background:p.bg??'#22c55e','border-radius':`${p.borderRadius??16}px`,cursor:'pointer','box-shadow':`${p.shadowX??0}px ${p.shadowY??4}px ${p.shadowBlur??20}px ${p.shadowColor??'rgba(34,197,94,0.4)'}`})}" onclick="window.__toggleCart&&window.__toggleCart()"><span class="material-symbols-outlined" style="font-size:${p.iconSize??24}px;color:${p.color??'#fff'};font-variation-settings:'FILL' 1;">shopping_cart</span><span id="cart-badge" style="position:absolute;top:-4px;right:-4px;background:${p.badgeBg??'#ef4444'};color:${p.badgeColor??'#fff'};font-size:10px;font-weight:800;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;">0</span></div>`;
    }

    case 'checkoutForm': {
      const step = (n,l) => `<div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;border-radius:50%;background:${p.accentColor??'#22c55e'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;">${n}</div><span style="font-size:12px;color:${p.subtitleColor??'#9ca3af'};font-weight:600;">${l}</span></div>`;
      const steps = (p.stepLabels??['Bilgiler','Adres','Onay']).map((l,i) => step(i+1,l)).join('<div style="width:40px;height:1px;background:rgba(255,255,255,0.1);"></div>');
      const field = (lbl,ph,type='text',name='') => `<div style="margin-bottom:14px;"><label style="font-size:11px;font-weight:600;color:${p.labelColor??'#888'};display:block;margin-bottom:6px;">${lbl} <span style="color:#ef4444;">*</span></label><input type="${type}" name="${name}" placeholder="${ph}" style="width:100%;padding:11px 14px;background:${p.inputBg??'#1e1e1e'};border:1px solid ${p.inputBorderColor??'rgba(255,255,255,0.1)'};border-radius:8px;color:${p.inputColor??'#e5e2e1'};font-size:13px;outline:none;font-family:inherit;box-sizing:border-box;" /></div>`;
      return `<div id="sf-checkout" style="${css({...base,background:p.bg??'#141414','border-radius':`${p.borderRadius??16}px`,padding:'28px','box-sizing':'border-box',overflow:'auto'})}"><div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:24px;">${steps}</div><div id="sf-checkout-summary" style="background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.1);border-radius:10px;padding:14px;margin-bottom:16px;display:none;"><div style="font-size:12px;font-weight:700;color:#22c55e;margin-bottom:8px;">🛒 Sepet Özeti</div><div id="sf-checkout-items" style="font-size:12px;color:#9ca3af;"></div><div id="sf-checkout-total" style="font-size:15px;font-weight:800;color:#e5e2e1;margin-top:8px;text-align:right;"></div></div><div style="background:${p.cardBg??'#1a1a1a'};border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.06);">${field(p.nameLabel??'Ad Soyad',p.namePlaceholder??'Adınız Soyadınız','text','name')}${field(p.emailLabel??'E-posta',p.emailPlaceholder??'ornek@email.com','email','email')}${field(p.phoneLabel??'Telefon',p.phonePlaceholder??'+90 555 123 45 67','tel','phone')}${field(p.addressLabel??'Adres',p.addressPlaceholder??'Sokak, mahalle, bina no','text','address')}<div style="display:flex;gap:12px;">${field(p.cityLabel??'Şehir',p.cityPlaceholder??'İstanbul','text','city')}${field(p.zipLabel??'Posta Kodu',p.zipPlaceholder??'34000','text','zip')}</div></div><button onclick="window.__submitOrder&&window.__submitOrder()" style="width:100%;margin-top:16px;padding:14px;background:${p.buttonBg??'#22c55e'};color:${p.buttonColor??'#fff'};border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">${p.buttonText??'Siparişi Tamamla'}</button></div>`;
    }

    case 'miniCart': {
      return `<div id="sf-mini-cart" style="${css({...base,background:p.bg??'#1a1a1a','border-radius':`${p.borderRadius??16}px`,border:`1px solid ${p.borderColor??'rgba(255,255,255,0.06)'}`,overflow:'hidden',display:'flex','flex-direction':'column'})}"><div style="padding:16px 20px;background:${p.headerBg??'#141414'};border-bottom:1px solid ${p.borderColor??'rgba(255,255,255,0.06)'};display:flex;align-items:center;justify-content:space-between;"><span style="font-size:15px;font-weight:700;color:${p.titleColor??'#e5e2e1'};">${p.titleText??'Sepetim'}</span><span id="mc-count" style="font-size:11px;color:#666;">0 ürün</span></div><div id="mc-items" style="padding:0 20px;flex:1;overflow:auto;"><div style="padding:30px 0;text-align:center;color:#444;font-size:12px;">Sepet boş</div></div><div style="padding:16px 20px;border-top:1px solid ${p.borderColor??'rgba(255,255,255,0.06)'};"><div style="display:flex;justify-content:space-between;margin-bottom:12px;"><span style="font-size:13px;color:${p.totalLabelColor??'#9ca3af'};">Toplam</span><span id="mc-total" style="font-size:18px;font-weight:800;color:${p.totalValueColor??'#e5e2e1'};">${p.currency??'₺'}0,00</span></div><button onclick="window.__goToCheckout&&window.__goToCheckout()" style="width:100%;padding:12px;background:${p.checkoutBg??'#22c55e'};color:${p.checkoutColor??'#fff'};border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">${p.checkoutText??'Ödemeye Geç'}</button></div></div>`;
    }

    default: {
      const fallback = `<div style="${css({ ...base, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)', 'border-radius': '8px' })}"></div>`;
      return wrapWithLinkAction(fallback, el, pages);
    }
  }
}

// Helper: wrap non-navbar/sidebar elements that have simple HTML output
function elementToHTMLWrapped(el, bp, pages) {
  const html = elementToHTML(el, bp, pages);
  if (['navbar', 'sidebar'].includes(el.type)) return html;
  if (!el.linkAction || el.linkAction.type === 'none' || !el.linkAction.target) return html;
  return wrapWithLinkAction(html, el, pages);
}

// ─── E-TİCARET ZORUNLU TOOL KONTROLÜ ─────────────────────────────────────────
const ECOMMERCE_PRODUCT_TYPES = new Set(['productCard', 'productGrid', 'storeHeader']);
const ECOMMERCE_REQUIRED_TYPES = new Set(['checkoutForm', 'cartWidget']);

function checkEcommerceRequirements(pages) {
  const allElements = pages.flatMap(p => p.elements || []);
  const types = new Set(allElements.map(e => e.type));

  const hasProducts = [...ECOMMERCE_PRODUCT_TYPES].some(t => types.has(t));
  if (!hasProducts) return { valid: true, missing: [] };

  const missing = [];
  if (!types.has('checkoutForm')) missing.push('Ödeme Formu (checkoutForm)');
  if (!types.has('cartWidget')) missing.push('Sepet Widget (cartWidget)');

  return { valid: missing.length === 0, missing };
}

// ─── STOREFRONT CART JS ───────────────────────────────────────────────────────
function getStorefrontJS() {
  return `
  (function(){
    var CART_KEY = 'sf_cart';
    var cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');

    function save() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); render(); }

    function fmt(n) { return (n/100).toLocaleString('tr-TR',{minimumFractionDigits:2}); }
    function fmtD(n) { return n.toLocaleString('tr-TR',{minimumFractionDigits:2}); }

    function total() { return cart.reduce(function(s,i){ return s + i.price * i.qty; },0); }
    function count() { return cart.reduce(function(s,i){ return s + i.qty; },0); }

    function render() {
      // Badge
      var badge = document.getElementById('cart-badge');
      if(badge) badge.textContent = count();

      // Mini Cart items
      var mc = document.getElementById('mc-items');
      if(mc) {
        if(cart.length === 0) {
          mc.innerHTML = '<div style="padding:30px 0;text-align:center;color:#444;font-size:12px;">Sepet boş</div>';
        } else {
          mc.innerHTML = cart.map(function(item) {
            return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">'
              + '<div style="width:40px;height:40px;border-radius:8px;background:#1e1e1e;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;">'
              + (item.image ? '<img src="'+item.image+'" style="width:100%;height:100%;object-fit:cover;" />' : '<span class="material-symbols-outlined" style="font-size:18px;color:#444;">inventory_2</span>')
              + '</div>'
              + '<div style="flex:1;min-width:0;">'
              + '<div style="font-size:12px;font-weight:600;color:#e5e2e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+item.title+'</div>'
              + '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">'
              + '<button onclick="window.__cart.updateQty(\\''+item.id+'\\','+Math.max(1,item.qty-1)+')" style="width:22px;height:22px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:#1e1e1e;color:#888;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;">−</button>'
              + '<span style="font-size:12px;color:#e5e2e1;font-weight:700;min-width:16px;text-align:center;">'+item.qty+'</span>'
              + '<button onclick="window.__cart.updateQty(\\''+item.id+'\\','+(item.qty+1)+')" style="width:22px;height:22px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:#1e1e1e;color:#888;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;">+</button>'
              + '</div>'
              + '</div>'
              + '<div style="text-align:right;flex-shrink:0;">'
              + '<div style="font-size:13px;font-weight:700;color:#22c55e;">₺'+fmtD(item.price * item.qty)+'</div>'
              + '<button onclick="window.__cart.remove(\\''+item.id+'\\');" style="background:none;border:none;color:#ef4444;font-size:10px;cursor:pointer;margin-top:2px;">Sil</button>'
              + '</div>'
              + '</div>';
          }).join('');
        }
      }

      // Mini Cart count & total
      var mcCount = document.getElementById('mc-count');
      if(mcCount) mcCount.textContent = count() + ' ürün';
      var mcTotal = document.getElementById('mc-total');
      if(mcTotal) mcTotal.textContent = '₺' + fmtD(total());

      // Checkout summary
      var cSummary = document.getElementById('sf-checkout-summary');
      var cItems = document.getElementById('sf-checkout-items');
      var cTotal = document.getElementById('sf-checkout-total');
      if(cSummary && cItems && cTotal) {
        if(cart.length > 0) {
          cSummary.style.display = 'block';
          cItems.innerHTML = cart.map(function(i){ return '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>'+i.title+' x'+i.qty+'</span><span>₺'+fmtD(i.price*i.qty)+'</span></div>'; }).join('');
          cTotal.textContent = 'Toplam: ₺' + fmtD(total());
        } else {
          cSummary.style.display = 'none';
        }
      }
    }

    window.__cart = {
      add: function(product) {
        var ex = cart.find(function(i){ return i.id === product.id; });
        if(ex) { ex.qty += (product.qty||1); }
        else { cart.push({id:product.id,title:product.title,price:product.price,qty:product.qty||1,image:product.image||''}); }
        save();
      },
      remove: function(pid) {
        cart = cart.filter(function(i){ return i.id !== pid; });
        save();
      },
      updateQty: function(pid, qty) {
        var item = cart.find(function(i){ return i.id === pid; });
        if(item) { item.qty = Math.max(1, qty); save(); }
      },
      clear: function() { cart = []; save(); },
      get: function() { return cart; },
      getTotal: total,
      count: count
    };

    window.__toggleCart = function() {
      var mc = document.getElementById('sf-mini-cart');
      if(!mc) return;
      if(mc.style.display === 'none' || mc.style.opacity === '0') {
        mc.style.display = 'flex';
        mc.style.opacity = '1';
      } else {
        mc.style.display = 'none';
      }
    };

    window.__goToCheckout = function() {
      var checkoutPage = window.__checkoutPageIdx;
      if(typeof checkoutPage === 'number' && checkoutPage >= 0 && checkoutPage !== window.__currentPage) {
        window.__goToPage(checkoutPage);
        setTimeout(function(){
          var co = document.getElementById('sf-checkout');
          if(co) co.scrollIntoView({behavior:'smooth'});
        }, 300);
      } else {
        var co = document.getElementById('sf-checkout');
        if(co) co.scrollIntoView({behavior:'smooth'});
      }
    };

    window.__submitOrder = function() {
      if(cart.length === 0) { alert('Sepetiniz boş!'); return; }
      var co = document.getElementById('sf-checkout');
      if(!co) return;
      var name = co.querySelector('[name=name]');
      var email = co.querySelector('[name=email]');
      var phone = co.querySelector('[name=phone]');
      if(!name||!name.value||!email||!email.value||!phone||!phone.value) {
        alert('Lütfen zorunlu alanları doldurunuz.');
        return;
      }
      alert('Siparişiniz alındı! Toplam: ₺'+fmtD(total())+'\\nTeşekkürler, '+name.value+'!');
      cart = []; save();
    };

    // Cross-tab sync
    window.addEventListener('storage', function(e) {
      if(e.key === CART_KEY) { cart = JSON.parse(e.newValue || '[]'); render(); }
    });

    setTimeout(render, 100);
  })();`;
}

// ─── FULL HTML DOCUMENT ───────────────────────────────────────────────────────
function generateHTML(pages) {
  const fonts = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Fira+Code&display=swap";
  const icons = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200";

  // Check if site has e-commerce elements
  const allTypes = new Set(pages.flatMap(p => (p.elements||[]).map(e => e.type)));
  const hasEcommerce = [...ECOMMERCE_PRODUCT_TYPES].some(t => allTypes.has(t)) || allTypes.has('cartWidget') || allTypes.has('cartButton') || allTypes.has('miniCart');

  // Checkout sayfası indeksini bul (cross-page yönlendirme için)
  let checkoutPageIdx = -1;
  pages.forEach((page, pi) => {
    if ((page.elements || []).some(e => e.type === 'checkoutForm')) checkoutPageIdx = pi;
  });

  const pagesHTML = pages.map((page, pi) => {
    const desktopEls = page.elements.map(el => elementToHTMLWrapped(el, 'desktop', pages)).join('\n      ');
    const tabletEls = page.elements.map(el => elementToHTMLWrapped(el, 'tablet', pages)).join('\n      ');
    const mobileEls = page.elements.map(el => elementToHTMLWrapped(el, 'mobile', pages)).join('\n      ');
    const bg = page.backgroundColor ?? '#0e0e0e';
    const pageStyle = pi > 0 ? `style="display:none;background:${bg}"` : `style="background:${bg}"`;

    return `
  <div class="page" id="page-${pi}" ${pageStyle}>
    <div class="canvas desktop-canvas">
      ${desktopEls}
    </div>
    <div class="canvas tablet-canvas">
      ${tabletEls}
    </div>
    <div class="canvas mobile-canvas">
      ${mobileEls}
    </div>
  </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pages[0]?.name ?? 'My Website'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="${fonts}" rel="stylesheet">
  <link href="${icons}" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${pages[0]?.backgroundColor ?? '#0e0e0e'}; font-family: 'Inter', sans-serif; color: #e5e2e1; }
    .canvas { position: relative; margin: 0 auto; }
    .desktop-canvas { width: ${BREAKPOINTS.desktop.width}px; min-height: ${BREAKPOINTS.desktop.width * 0.6}px; }
    .tablet-canvas  { display: none; width: ${BREAKPOINTS.tablet.width}px; min-height: ${BREAKPOINTS.tablet.width}px; }
    .mobile-canvas  { display: none; width: ${BREAKPOINTS.mobile.width}px; min-height: ${BREAKPOINTS.mobile.width * 1.5}px; }
    @media (max-width: 1024px) {
      .desktop-canvas { display: none; }
      .tablet-canvas  { display: block; }
    }
    @media (max-width: 480px) {
      .tablet-canvas  { display: none; }
      .mobile-canvas  { display: block; }
    }
  </style>
</head>
<body>
${pagesHTML}
<script>
  window.__currentPage = 0;
  window.__checkoutPageIdx = ${checkoutPageIdx};
  window.__goToPage = function(pageIdx) {
    var allPages = document.querySelectorAll('.page');
    if (pageIdx < 0 || pageIdx >= allPages.length) return;
    allPages.forEach(function(p, i) {
      p.style.display = i === pageIdx ? 'block' : 'none';
    });
    document.body.style.background = allPages[pageIdx]?.style.background || '';
    window.__currentPage = pageIdx;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  ${hasEcommerce ? getStorefrontJS() : ''}
</script>
</body>
</html>`;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function EditorHeader({ siteId, siteTitle }) {
  const navigate = useNavigate();
  const [showExport, setShowExport] = useState(false);
  const [showAIBuilder, setShowAIBuilder] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [publishStatus, setPublishStatus] = useState('idle');
  const [ecomWarning, setEcomWarning] = useState(null); // { missing: [...] }
  const {
    undo, redo, getActivePage, pages, canvasHeights,
    activeBreakpoint, setBreakpoint,
    getActiveCanvasWidth, getActiveCanvasHeight,
  } = useEditorStore();

  const activePage = getActivePage();
  const canvasWidth = getActiveCanvasWidth();
  const canvasHeight = getActiveCanvasHeight();

  // ── Save → Backend ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!siteId) return;
    setSaveStatus('saving');
    try {
      const { apiSaveSiteData } = await import('../../lib/api');
      await apiSaveSiteData(siteId, { pages, canvasHeights });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Kaydetme hatası:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // ── Publish → Backend ────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!siteId) return;
    // E-ticaret zorunlu tool kontrolü
    const check = checkEcommerceRequirements(pages);
    if (!check.valid) {
      setEcomWarning({ missing: check.missing });
      return;
    }
    setSaveStatus('saving');
    try {
      const { apiSaveSiteData, apiPublishSite } = await import('../../lib/api');
      await apiSaveSiteData(siteId, { pages, canvasHeights });
      setSaveStatus('saved');

      setPublishStatus('publishing');
      // Editör önizlemesiyle birebir aynı tam HTML'i üret ve gönder —
      // backend bunu S3'e yazar (basit Go renderer'ı yerine).
      const fullHTML = generateHTML(pages);
      await apiPublishSite(siteId, fullHTML);
      setPublishStatus('published');
      setTimeout(() => {
        setPublishStatus('idle');
        setSaveStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('Yayınlama hatası:', err);
      setPublishStatus('error');
      setTimeout(() => setPublishStatus('idle'), 3000);
    }
  };

  // Ctrl+S ile kaydet
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [siteId, pages, canvasHeights]);

  const handlePreview = () => {
    // E-ticaret zorunlu tool kontrolü
    const check = checkEcommerceRequirements(pages);
    if (!check.valid) {
      setEcomWarning({ missing: check.missing });
      return;
    }
    const html = generateHTML(pages ?? [activePage]);
    window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
  };

  const handleExportJSON = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ pages }, null, 2)], { type: 'application/json' }));
    a.download = `${activePage?.name ?? 'project'}.json`;
    a.click();
  };

  const handleExportHTML = () => {
    const html = generateHTML(pages ?? [activePage]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = `${activePage?.name ?? 'website'}.html`;
    a.click();
  };

  const saveLabel = {
    idle: 'Save',
    saving: 'Saving...',
    saved: 'Saved ✓',
    error: 'Error!',
  }[saveStatus];

  const publishLabel = {
    idle: 'Publish',
    publishing: 'Publishing...',
    published: 'Published ✓',
    error: 'Error!',
  }[publishStatus];

  return (
    <>
    <header style={{ position: 'fixed', top: 0, width: '100%', zIndex: 50, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: '#0e0e0e', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span onClick={() => navigate('/dashboard')} style={{ fontSize: 16, fontWeight: 900, color: '#e5e2e1', cursor: 'pointer', letterSpacing: -0.5 }}>Kinetic</span>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#555' }}>home</span>
          <span style={{ fontSize: 12, color: '#666' }}>{siteTitle || 'Home'}</span>
          {activePage && <><span style={{ color: '#333', fontSize: 12 }}>/</span><span style={{ fontSize: 12, color: '#e5e2e1', fontWeight: 600 }}>{activePage.name}</span></>}
        </div>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', gap: 2 }}>
          {[{ icon: 'undo', action: undo }, { icon: 'redo', action: redo }].map(({ icon, action }) => (
            <button key={icon} onClick={action} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '6px 8px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.color = '#e5e2e1'} onMouseLeave={e => e.currentTarget.style.color = '#666'}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 3 }}>
          {BREAKPOINT_ORDER.map(bp => {
            const { label, icon, width } = BREAKPOINTS[bp];
            const isActive = activeBreakpoint === bp;
            const color = BP_COLORS[bp];
            return (
              <button key={bp} onClick={() => setBreakpoint(bp)} title={`${label} (${width}px)`}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: isActive ? `${color}18` : 'none', color: isActive ? color : '#555', transition: 'all 0.18s', position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 500 }}>{label}</span>
                <span style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: isActive ? '60%' : 0, height: 2, borderRadius: 1, background: color, transition: 'width 0.18s' }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: '#444', fontFamily: 'monospace' }}>{canvasWidth} × {Math.round(canvasHeight)}</span>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.08)' }} />

        {/* AI Site Builder Button */}
        <button onClick={() => setShowAIBuilder(true)} style={{
          background: 'linear-gradient(135deg, #4b8eff 0%, #8b5cf6 100%)',
          border: 'none', color: '#fff', borderRadius: 8, padding: '7px 14px',
          cursor: 'pointer', fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
          boxShadow: '0 2px 12px rgba(75,142,255,0.25)',
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
          AI ile Tasarla
        </button>

        {/* Save Button */}
        <button onClick={handleSave} disabled={saveStatus === 'saving'} style={{ 
          background: 'none', border: '1px solid rgba(255,255,255,0.08)', 
          color: saveStatus === 'saved' ? '#10b981' : saveStatus === 'error' ? '#ef4444' : '#888', 
          borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, 
          display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
          borderColor: saveStatus === 'saved' ? 'rgba(16,185,129,0.3)' : saveStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)',
        }}
          onMouseEnter={e => { if (saveStatus === 'idle') { e.currentTarget.style.color = '#e5e2e1'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}}
          onMouseLeave={e => { if (saveStatus === 'idle') { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{saveStatus === 'saved' ? 'check_circle' : saveStatus === 'error' ? 'error' : 'save'}</span>{saveLabel}
        </button>

        <button onClick={handlePreview} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#888', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#e5e2e1'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>Preview
        </button>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowExport(v => !v)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#888', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseEnter={e => e.currentTarget.style.color = '#e5e2e1'} onMouseLeave={e => e.currentTarget.style.color = '#888'}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>Export
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>expand_more</span>
          </button>
          {showExport && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden', minWidth: 150, zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
              {[{ icon: 'data_object', label: 'Export JSON', action: handleExportJSON }, { icon: 'html', label: 'Export HTML', action: handleExportHTML }].map(({ icon, label, action }) => (
                <button key={label} onClick={() => { action(); setShowExport(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#4b8eff' }}>{icon}</span>{label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={handlePublish} disabled={publishStatus === 'publishing'} style={{ 
          background: publishStatus === 'published' ? '#10b981' : publishStatus === 'error' ? '#ef4444' : '#4b8eff', 
          border: 'none', color: '#fff', borderRadius: 8, padding: '7px 20px', 
          cursor: publishStatus === 'publishing' ? 'wait' : 'pointer', 
          fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
          opacity: publishStatus === 'publishing' ? 0.7 : 1,
        }}
          onMouseEnter={e => { if (publishStatus === 'idle') e.currentTarget.style.opacity = '0.85'; }} 
          onMouseLeave={e => { if (publishStatus === 'idle') e.currentTarget.style.opacity = '1'; }}>
          {publishLabel}
        </button>
        <img alt="User" style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.1)' }}
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAkdjCZYlTiVi7d6pEBMx7f-m_CjtyyRwq0LKDerbZeJCVo8xusvNrzQeW51kqBNdZkButHHdEmgWcewAKqkXtGpvThq5LmjTLVtLPl1Ylh012df49BqYRzT8obHE9JDVPoi3W4Tf3W9zeN3tgbsfiBPig9HlgkA0Nw_g6s9fs07RSerCzC0BgPVOwk5ZETBns7nJss6zhPjxmi4yPnpyoUIKjpJunO_1XvsGySPbih_hBeReYxotV9MfSYzJTtDpS802eE1JFq"
        />
      </div>
    </header>

    {/* ── AI Site Builder Modalı ──────────────────────────────────────────── */}
    {showAIBuilder && (
      <AISiteBuilderModal siteId={siteId} onClose={() => setShowAIBuilder(false)} />
    )}

    {/* ── E-Ticaret Zorunlu Tool Uyarı Modalı ────────────────────────────── */}
    {ecomWarning && (
      <div style={{ position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center' }} onClick={() => setEcomWarning(null)}>
        <div style={{ background:'#1a1a1a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,padding:32,maxWidth:440,width:'90%',boxShadow:'0 24px 64px rgba(0,0,0,0.8)' }} onClick={e => e.stopPropagation()}>
          <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:20 }}>
            <div style={{ width:44,height:44,borderRadius:12,background:'rgba(239,68,68,0.1)',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize:24,color:'#ef4444' }}>warning</span>
            </div>
            <div>
              <h3 style={{ fontSize:16,fontWeight:800,color:'#e5e2e1',margin:0 }}>Eksik E-Ticaret Araçları</h3>
              <p style={{ fontSize:12,color:'#666',margin:0,marginTop:2 }}>Preview / Publish için aşağıdaki araçlar gerekli</p>
            </div>
          </div>
          <div style={{ background:'#141414',borderRadius:12,padding:16,marginBottom:20,border:'1px solid rgba(255,255,255,0.06)' }}>
            {ecomWarning.missing.map((m, i) => (
              <div key={i} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom: i < ecomWarning.missing.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span className="material-symbols-outlined" style={{ fontSize:16,color:'#ef4444' }}>cancel</span>
                <span style={{ fontSize:13,color:'#e5e2e1',fontWeight:600 }}>{m}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize:11,color:'#666',marginBottom:16,lineHeight:1.6 }}>
            E-ticaret ürün elementleri (Ürün Kartı, Ürün Grid, Mağaza Header) kullanıyorsanız,
            ziyaretçilerin alışveriş yapabilmesi için <strong style={{ color:'#22c55e' }}>Sepet Widget</strong> ve <strong style={{ color:'#22c55e' }}>Ödeme Formu</strong> eklemeniz zorunludur.
          </p>
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={() => setEcomWarning(null)} style={{ flex:1,padding:'11px',background:'#222',color:'#888',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,fontSize:12,fontWeight:600,cursor:'pointer' }}>Kapat</button>
            <button onClick={() => { setEcomWarning(null); /* Element panelini aç */ }} style={{ flex:1,padding:'11px',background:'#22c55e',color:'#fff',border:'none',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer' }}>Elementleri Ekle</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}