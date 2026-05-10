import React, { useRef, useCallback, memo, useState, useMemo, useEffect } from 'react';
import {
  useEditorStore, calculateSnap, isContainerType,
  defaultProps, defaultDimensions, defaultElementName,
  getElementBounds, BREAKPOINTS,
} from '../../store/useEditorStore';

// ─── CHILD ELEMENT RENDERER ───────────────────────────────────────────────────
const ChildContent = memo(({ child, containerId, isSelected, onSelect }) => {
  const { updateChildProp, deleteChild, duplicateChild, selectedChildId } = useEditorStore();
  const p = child.props;
  const sel = isSelected && selectedChildId === child.id;

  if (!child.visible) return null;

  const wrapStyle = {
    position: 'relative',
    width: child.width,
    height: child.height,
    flexShrink: 0,
    outline: sel ? '2px solid #4b8eff' : '1.5px solid transparent',
    outlineOffset: 1,
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'outline 0.1s',
  };

  const renderInner = () => {
    switch (child.type) {
      case 'heading':
        return (
          <h2
            contentEditable suppressContentEditableWarning
            onBlur={e => updateChildProp(containerId, child.id, 'text', e.target.innerText)}
            onClick={e => { e.stopPropagation(); onSelect(child.id); }}
            style={{
              fontSize: p.fontSize ?? 32, fontWeight: p.fontWeight ?? '700',
              color: p.color ?? '#e5e2e1', textAlign: p.align ?? 'left',
              lineHeight: 1.15, outline: 'none', margin: 0, padding: 0,
              width: '100%', whiteSpace: 'nowrap', overflow: 'visible',
            }}
          >{p.text}</h2>
        );
      case 'paragraph':
        return (
          <p
            contentEditable suppressContentEditableWarning
            onBlur={e => updateChildProp(containerId, child.id, 'text', e.target.innerText)}
            onClick={e => { e.stopPropagation(); onSelect(child.id); }}
            style={{
              fontSize: p.fontSize ?? 15, fontWeight: p.fontWeight ?? '400',
              color: p.color ?? '#9ca3af', textAlign: p.align ?? 'left',
              lineHeight: 1.6, outline: 'none', margin: 0, padding: 0,
              width: '100%', wordBreak: 'break-word', whiteSpace: 'pre-wrap', overflow: 'hidden',
            }}
          >{p.text}</p>
        );
      case 'button':
        return (
          <button
            onClick={e => { e.stopPropagation(); onSelect(child.id); }}
            style={{
              width: '100%', height: '100%',
              background: p.bg ?? '#4b8eff', color: p.color ?? '#fff',
              fontSize: p.fontSize ?? 14, fontWeight: p.fontWeight ?? '700',
              border: 'none', borderRadius: p.borderRadius ?? 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 16px', boxSizing: 'border-box', whiteSpace: 'nowrap',
            }}
          >{p.text}</button>
        );
      case 'image':
        return (
          <div
            onClick={e => { e.stopPropagation(); onSelect(child.id); }}
            style={{
              width: '100%', height: '100%', background: '#1e1e1e',
              borderRadius: p.borderRadius ?? 8, overflow: 'hidden',
              border: '1.5px dashed #2a2a2a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {p.src
              ? <img src={p.src} alt={p.alt} style={{ width: '100%', height: '100%', objectFit: p.objectFit ?? 'cover' }} />
              : <span style={{ color: '#555', fontSize: 11, userSelect: 'none' }}>🖼 Image</span>
            }
          </div>
        );
      case 'box':
        return (
          <div
            onClick={e => { e.stopPropagation(); onSelect(child.id); }}
            style={{
              width: '100%', height: '100%',
              background: p.bg ?? '#1c1b1b', borderRadius: p.borderRadius ?? 8,
              opacity: (p.opacity ?? 100) / 100,
              border: p.borderWidth ? `${p.borderWidth}px solid ${p.borderColor ?? '#333'}` : 'none',
            }}
          />
        );
      case 'divider':
        return (
          <div
            onClick={e => { e.stopPropagation(); onSelect(child.id); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', height: '100%' }}
          >
            <div style={{ width: '100%', height: p.thickness ?? 1, background: p.color ?? '#2a2a2a', borderStyle: p.style ?? 'solid' }} />
          </div>
        );
      case 'icon':
        return (
          <div
            onClick={e => { e.stopPropagation(); onSelect(child.id); }}
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: p.size ?? 40, color: p.color ?? '#4b8eff', fontVariationSettings: "'FILL' 1" }}>
              {p.name ?? 'star'}
            </span>
          </div>
        );
      case 'section':
        return (
          <div
            onClick={e => { e.stopPropagation(); onSelect(child.id); }}
            style={{
              width: '100%', height: '100%',
              background: p.bg ?? '#141414', borderRadius: p.borderRadius ?? 8,
              border: '1px dashed #2a2a2a', opacity: (p.opacity ?? 100) / 100,
              padding: p.padding ?? 12, boxSizing: 'border-box',
            }}
          >
            <span style={{ fontSize: 9, color: '#555', letterSpacing: 1, textTransform: 'uppercase', pointerEvents: 'none' }}>Section</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={wrapStyle} onClick={e => { e.stopPropagation(); onSelect(child.id); }}>
      {renderInner()}
      {sel && (
        <div
          style={{
            position: 'absolute', top: -30, left: 0,
            display: 'flex', gap: 3, zIndex: 100,
            pointerEvents: 'auto',
          }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <span style={childLabelStyle}>{child.type}</span>
          <button style={childBtnStyle} onMouseDown={e => { e.stopPropagation(); duplicateChild(containerId, child.id); }} title="Çoğalt">⎘</button>
          <button style={{ ...childBtnStyle, background: '#e53e3e', color: '#fff' }} onMouseDown={e => { e.stopPropagation(); deleteChild(containerId, child.id); }} title="Sil">✕</button>
        </div>
      )}
    </div>
  );
});
ChildContent.displayName = 'ChildContent';

const childLabelStyle = {
  background: '#4b8eff', color: '#fff', fontSize: 8, fontWeight: 800,
  padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: 1, lineHeight: '18px',
};
const childBtnStyle = {
  background: 'rgba(20,20,20,0.9)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#ccc', fontSize: 10, borderRadius: 3, width: 20, height: 20,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', lineHeight: 1, padding: 0,
};

// ─── ELEMENT CONTENT ──────────────────────────────────────────────────────────
// ─── HORIZONTAL SCROLL ELEMENT ─────────────────────────────────────────────────────
const HorizontalScrollEl = memo(({ p }) => {
  const trackRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    checkScroll();
    return () => el.removeEventListener('scroll', checkScroll);
  }, [checkScroll, p.items, p.itemWidth, p.gap]);

  const scroll = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const step = (p.itemWidth ?? 220) + (p.gap ?? 16);
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  const items = p.items ?? [];
  const arrowBtn = (dir, active) => ({
    position: 'absolute',
    top: '50%', transform: 'translateY(-50%)',
    [dir === -1 ? 'left' : 'right']: 8,
    zIndex: 10,
    width: 36, height: 36,
    borderRadius: '50%',
    background: active ? (p.arrowBg ?? 'rgba(75,142,255,0.2)') : 'rgba(0,0,0,0.3)',
    border: `1px solid ${active ? (p.arrowColor ?? '#4b8eff') + '44' : 'rgba(255,255,255,0.06)'}`,
    color: active ? (p.arrowColor ?? '#4b8eff') : '#333',
    cursor: active ? 'pointer' : 'default',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
    fontSize: 18,
  });

  return (
    <div style={{
      width: '100%', height: '100%',
      background: p.bg ?? '#141414',
      borderRadius: p.borderRadius ?? 12,
      overflow: 'hidden',
      position: 'relative',
      opacity: (p.opacity ?? 100) / 100,
    }}>
      {/* Left arrow */}
      {p.showArrows !== false && (
        <button
          onMouseDown={e => { e.stopPropagation(); scroll(-1); }}
          style={arrowBtn(-1, canScrollLeft)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_left</span>
        </button>
      )}

      {/* Track */}
      <div
        ref={trackRef}
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: p.gap ?? 16,
          padding: p.padding ?? 16,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: p.snapToItem !== false ? 'x mandatory' : 'none',
          scrollBehavior: 'smooth',
          height: '100%',
          boxSizing: 'border-box',
          WebkitOverflowScrolling: 'touch',
          // hide scrollbar cosmetically
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              flex: `0 0 ${p.itemWidth ?? 220}px`,
              height: `${p.itemHeight ?? 200}px`,
              background: item.bg ?? '#1a1a1a',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'flex-start', justifyContent: 'flex-end',
              padding: 16, boxSizing: 'border-box',
              scrollSnapAlign: p.snapToItem !== false ? 'start' : 'none',
              userSelect: 'none',
            }}
          >
            <div style={{ fontSize: p.titleFontSize ?? 14, fontWeight: 700, color: p.titleColor ?? '#e5e2e1', marginBottom: 4 }}>{item.title}</div>
            <div style={{ fontSize: p.descFontSize ?? 12, color: p.descColor ?? '#9ca3af', lineHeight: 1.5 }}>{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Right arrow */}
      {p.showArrows !== false && (
        <button
          onMouseDown={e => { e.stopPropagation(); scroll(1); }}
          style={arrowBtn(1, canScrollRight)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_right</span>
        </button>
      )}

      {/* Label */}
      <div style={{
        position: 'absolute', top: 6, left: 10,
        fontSize: 8, fontWeight: 800, letterSpacing: 1.5,
        color: 'rgba(75,142,255,0.4)', textTransform: 'uppercase',
        pointerEvents: 'none',
      }}>H-SCROLL · {items.length} items</div>
    </div>
  );
});
HorizontalScrollEl.displayName = 'HorizontalScrollEl';

const ElementContent = memo(({ el, updateProp, selectElement, selectedChildId }) => {
  const { addChildToContainer, enterContainer, activeContainerId } = useEditorStore();
  const p = el.props;

  const handleChildSelect = useCallback((childId) => {
    selectElement(el.id, childId);
  }, [el.id, selectElement]);

  const handleContainerDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleContainerDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const type = e.dataTransfer.getData('elementType');
    if (!type) return;
    addChildToContainer(el.id, type);
  }, [el.id, addChildToContainer]);

  const isEntered = activeContainerId === el.id;
  const children = el.children ?? [];

  switch (el.type) {
    case 'heading':
      return (
        <h1
          contentEditable suppressContentEditableWarning
          onBlur={e2 => updateProp(el.id, 'text', e2.target.innerText)}
          style={{
            fontSize: p.fontSize, fontWeight: p.fontWeight, color: p.color,
            textAlign: p.align, lineHeight: 1.1, outline: 'none',
            margin: 0, padding: 0, cursor: 'text', whiteSpace: 'nowrap', overflow: 'visible', width: '100%',
          }}
        >{p.text}</h1>
      );

    case 'paragraph':
      return (
        <p
          contentEditable suppressContentEditableWarning
          onBlur={e2 => updateProp(el.id, 'text', e2.target.innerText)}
          style={{
            fontSize: p.fontSize, fontWeight: p.fontWeight, color: p.color,
            textAlign: p.align, lineHeight: 1.65, outline: 'none',
            margin: 0, padding: 0, cursor: 'text', width: '100%',
            wordBreak: 'break-word', whiteSpace: 'pre-wrap', overflow: 'hidden',
          }}
        >{p.text}</p>
      );

    case 'button':
      return (
        <button style={{
          width: '100%', height: '100%', background: p.bg, color: p.color,
          fontSize: p.fontSize, fontWeight: p.fontWeight, border: 'none',
          borderRadius: p.borderRadius ?? 8, cursor: 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 12px', boxSizing: 'border-box', whiteSpace: 'nowrap',
        }}>{p.text}</button>
      );

    case 'image':
      return (
        <div style={{
          width: '100%', height: '100%', background: '#1e1e1e',
          borderRadius: p.borderRadius ?? 6, overflow: 'hidden',
          border: '1.5px dashed #2a2a2a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {p.src
            ? <img src={p.src} alt={p.alt} style={{ width: '100%', height: '100%', objectFit: p.objectFit ?? 'cover' }} />
            : <div style={{ textAlign: 'center', color: '#444', userSelect: 'none' }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>🖼</div>
              <div style={{ fontSize: 10, letterSpacing: 1 }}>IMAGE</div>
            </div>
          }
        </div>
      );

    case 'box':
      return (
        <div style={{
          width: '100%', height: '100%', background: p.bg,
          borderRadius: p.borderRadius ?? 0, opacity: (p.opacity ?? 100) / 100,
          border: p.borderWidth ? `${p.borderWidth}px solid ${p.borderColor ?? '#333'}` : 'none',
        }} />
      );

    case 'divider':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '100%', height: p.thickness ?? 1, background: p.color ?? '#2a2a2a' }} />
        </div>
      );

    case 'icon':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: p.size ?? 40, color: p.color ?? '#4b8eff', fontVariationSettings: "'FILL' 1" }}>
            {p.name ?? 'star'}
          </span>
        </div>
      );

    case 'section':
      return (
        <div
          onDragOver={handleContainerDragOver}
          onDrop={handleContainerDrop}
          onDoubleClick={e => { e.stopPropagation(); enterContainer(el.id); }}
          style={{
            width: '100%', height: '100%',
            background: p.bg ?? '#141414',
            borderRadius: p.borderRadius ?? 0,
            border: isEntered ? '1.5px solid #4b8eff' : '1px dashed #2a2a2a',
            opacity: (p.opacity ?? 100) / 100,
            padding: p.padding ?? 20,
            boxSizing: 'border-box',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {children.map(child => (
            <ChildContent
              key={child.id}
              child={child}
              containerId={el.id}
              isSelected={selectedChildId === child.id}
              onSelect={handleChildSelect}
            />
          ))}
          {isEntered && children.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{ color: '#4b8eff', fontSize: 11, fontWeight: 700, letterSpacing: 2, opacity: 0.6 }}>
                ↓ ELEMENT BIRAK
              </span>
            </div>
          )}
          <div style={{
            position: 'absolute', top: 4, right: 8,
            fontSize: 8, fontWeight: 800, letterSpacing: 1.5,
            color: isEntered ? '#4b8eff' : '#383838', textTransform: 'uppercase',
            pointerEvents: 'none',
          }}>SECTION</div>
        </div>
      );

    case 'flexContainer':
      return (
        <div
          onDragOver={handleContainerDragOver}
          onDrop={handleContainerDrop}
          onDoubleClick={e => { e.stopPropagation(); enterContainer(el.id); }}
          style={{
            width: '100%', height: '100%',
            background: p.bg || 'transparent',
            borderRadius: p.borderRadius ?? 12,
            border: isEntered ? '1.5px solid #4b8eff' : (p.border ?? '1.5px dashed #3a3a3a'),
            opacity: (p.opacity ?? 100) / 100,
            display: 'flex',
            flexDirection: p.flexDirection ?? 'row',
            flexWrap: p.flexWrap ?? 'wrap',
            alignItems: p.alignItems ?? 'center',
            justifyContent: p.justifyContent ?? 'flex-start',
            gap: p.gap ?? 16,
            padding: p.padding ?? 20,
            boxSizing: 'border-box',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {children.filter(c => c.visible !== false).map(child => (
            <ChildContent
              key={child.id}
              child={child}
              containerId={el.id}
              isSelected={selectedChildId === child.id}
              onSelect={handleChildSelect}
            />
          ))}
          {isEntered && children.length === 0 && (
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
              <span style={{ color: '#4b8eff', fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>↓ ELEMENT BIRAK</span>
            </div>
          )}
          <div style={{
            position: 'absolute', top: 4, left: 8,
            fontSize: 8, fontWeight: 800, letterSpacing: 1.5,
            color: isEntered ? '#4b8eff' : '#383838', textTransform: 'uppercase',
            pointerEvents: 'none',
          }}>
            FLEX · {p.flexDirection ?? 'row'} · {children.length} items
          </div>
        </div>
      );

    case 'gridContainer': {
      const cols = p.columns ?? 3;
      return (
        <div
          onDragOver={handleContainerDragOver}
          onDrop={handleContainerDrop}
          onDoubleClick={e => { e.stopPropagation(); enterContainer(el.id); }}
          style={{
            width: '100%', height: '100%',
            background: p.bg || 'transparent',
            borderRadius: p.borderRadius ?? 12,
            border: isEntered ? '1.5px solid #4b8eff' : (p.border ?? '1.5px dashed #3a3a3a'),
            opacity: (p.opacity ?? 100) / 100,
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridAutoRows: p.autoRows ?? 120,
            gap: p.gap ?? 16,
            padding: p.padding ?? 20,
            boxSizing: 'border-box',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {children.filter(c => c.visible !== false).map(child => (
            <div key={child.id} style={{ minHeight: 0, minWidth: 0 }}>
              <ChildContent
                child={{ ...child, width: '100%', height: '100%' }}
                containerId={el.id}
                isSelected={selectedChildId === child.id}
                onSelect={handleChildSelect}
              />
            </div>
          ))}
          {isEntered && children.length === 0 &&
            Array.from({ length: cols }).map((_, i) => (
              <div key={i} style={{
                background: 'rgba(75,142,255,0.05)',
                border: '1px dashed rgba(75,142,255,0.2)',
                borderRadius: 6, minHeight: p.autoRows ?? 120,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: 'rgba(75,142,255,0.35)', fontWeight: 700,
              }}>
                {i + 1}
              </div>
            ))
          }
          <div style={{
            position: 'absolute', top: 4, left: 8,
            fontSize: 8, fontWeight: 800, letterSpacing: 1.5,
            color: isEntered ? '#4b8eff' : '#383838', textTransform: 'uppercase',
            pointerEvents: 'none',
          }}>
            GRID {cols}×* · {children.length} items
          </div>
        </div>
      );
    }

    case 'horizontalScroll':
      return <HorizontalScrollEl p={p} />;

    // ── NAVBAR ──────────────────────────────────────────────────────────────
    case 'navbar': {
      const links = p.links ?? [];
      // Responsive: calculate how many links fit before switching to hamburger icon
      const maxLinks = Math.floor((el.props?.maxLinksVisible ?? links.length));
      const visibleLinks = links.slice(0, maxLinks);
      const hiddenLinks = links.slice(maxLinks);
      return (
        <div style={{
          width: '100%', height: '100%',
          background: p.bg ?? 'rgba(14,14,14,0.85)',
          backdropFilter: `blur(${p.backdropBlur ?? 16}px)`,
          borderBottom: `1px solid ${p.borderBottom ?? 'rgba(255,255,255,0.06)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px', boxSizing: 'border-box',
          flexWrap: 'nowrap', gap: 8,
        }}>
          <span style={{ fontSize: p.logoFontSize ?? 18, fontWeight: p.logoFontWeight ?? '800', color: p.logoColor ?? '#e5e2e1', letterSpacing: -0.5, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {p.logo ?? 'Brand'}
          </span>
          <nav style={{ display: 'flex', gap: 28, alignItems: 'center', flex: 1, justifyContent: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
            {visibleLinks.map(l => (
              <span key={l.id} style={{ fontSize: p.fontSize ?? 14, color: p.linkColor ?? '#e5e2e1', cursor: 'pointer', opacity: 0.8, whiteSpace: 'nowrap' }}>{l.label}</span>
            ))}
            {hiddenLinks.length > 0 && (
              <span style={{ fontSize: 12, color: p.linkColor ?? '#e5e2e1', opacity: 0.5 }}>⋯</span>
            )}
          </nav>
          {p.showCta !== false && (
            <div style={{ background: p.ctaBg ?? '#4b8eff', color: p.ctaColor ?? '#fff', borderRadius: p.ctaBorderRadius ?? 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {p.ctaText ?? 'Başla'}
            </div>
          )}
        </div>
      );
    }

    // ── SIDEBAR ─────────────────────────────────────────────────────────────
    case 'sidebar': {
      const slinks = p.links ?? [];
      return (
        <div style={{
          width: '100%', height: '100%',
          background: p.bg ?? '#141414',
          borderRight: `1px solid ${p.borderRight ?? 'rgba(255,255,255,0.06)'}`,
          display: 'flex', flexDirection: 'column',
          padding: '20px 0', boxSizing: 'border-box', overflow: 'hidden',
        }}>
          <div style={{ padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: p.logoColor ?? '#e5e2e1' }}>{p.logo ?? 'App'}</span>
          </div>
          {slinks.map(l => (
            <div key={l.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 20px', cursor: 'pointer',
              background: l.active ? (p.activeBg ?? 'rgba(75,142,255,0.1)') : 'transparent',
              borderLeft: l.active ? `3px solid ${p.activeAccent ?? '#4b8eff'}` : '3px solid transparent',
            }}>
              {p.showIcons !== false && <span className="material-symbols-outlined" style={{ fontSize: 18, color: l.active ? (p.activeAccent ?? '#4b8eff') : (p.linkColor ?? '#888') }}>{l.icon ?? 'circle'}</span>}
              <span style={{ fontSize: 13, fontWeight: l.active ? 700 : 400, color: l.active ? (p.activeLinkColor ?? '#e5e2e1') : (p.linkColor ?? '#888') }}>{l.label}</span>
            </div>
          ))}
          {p.footerText && <div style={{ marginTop: 'auto', padding: '12px 20px', fontSize: 10, color: '#444' }}>{p.footerText}</div>}
        </div>
      );
    }

    // ── HERO ────────────────────────────────────────────────────────────────
    case 'hero': {
      const lines = (p.title ?? '').split('\n');
      return (
        <div style={{
          width: '100%', height: '100%',
          background: p.bgImageUrl ? `linear-gradient(rgba(0,0,0,${(p.overlayOpacity ?? 50) / 100}),rgba(0,0,0,${(p.overlayOpacity ?? 50) / 100})), url(${p.bgImageUrl}) center/cover` : (p.bg ?? '#0e0e0e'),
          display: 'flex', flexDirection: 'column', alignItems: p.align === 'left' ? 'flex-start' : 'center',
          justifyContent: 'center', padding: '60px 80px', boxSizing: 'border-box', gap: 20,
          textAlign: p.align ?? 'center',
        }}>
          {p.tag && <span style={{ fontSize: 11, fontWeight: 800, color: p.tagColor ?? '#4b8eff', background: p.tagBg ?? 'rgba(75,142,255,0.1)', padding: '4px 14px', borderRadius: 99, letterSpacing: 2 }}>{p.tag}</span>}
          <h1 style={{ margin: 0, fontSize: 56, fontWeight: 900, color: p.titleColor ?? '#e5e2e1', lineHeight: 1.1, whiteSpace: 'pre-line' }}>
            {lines.map((l, i) => <span key={i}>{l}{i < lines.length - 1 && <br />}</span>)}
          </h1>
          {p.subtitle && <p style={{ margin: 0, fontSize: 18, color: p.subtitleColor ?? '#9ca3af', maxWidth: 600, lineHeight: 1.6 }}>{p.subtitle}</p>}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <div style={{ background: p.ctaBg ?? '#4b8eff', color: p.ctaColor ?? '#fff', borderRadius: p.ctaBorderRadius ?? 10, padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{p.ctaText ?? 'Başla'}</div>
            {p.subCtaText && <div style={{ border: '1.5px solid rgba(255,255,255,0.15)', color: '#e5e2e1', borderRadius: 10, padding: '14px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>{p.subCtaText}</div>}
          </div>
        </div>
      );
    }

    // ── CARD ────────────────────────────────────────────────────────────────
    case 'card':
      return (
        <div style={{ width: '100%', height: '100%', background: p.bg ?? '#1a1a1a', borderRadius: p.borderRadius ?? 16, border: `1px solid ${p.borderColor ?? 'rgba(255,255,255,0.06)'}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 200, background: '#111', overflow: 'hidden', flexShrink: 0 }}>
            {p.imageSrc ? <img src={p.imageSrc} alt={p.imageAlt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="material-symbols-outlined" style={{ fontSize: 40, color: '#333' }}>image</span></div>}
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            {p.tag && <span style={{ fontSize: 10, fontWeight: 800, color: p.tagColor ?? '#4b8eff', letterSpacing: 1.5 }}>{p.tag}</span>}
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: p.titleColor ?? '#e5e2e1', lineHeight: 1.3 }}>{p.title ?? 'Kart Başlığı'}</h3>
            <p style={{ margin: 0, fontSize: 13, color: p.excerptColor ?? '#9ca3af', lineHeight: 1.6 }}>{p.excerpt}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
              {p.readTime && <span style={{ fontSize: 11, color: p.metaColor ?? '#555' }}>{p.readTime}</span>}
              <span style={{ fontSize: 13, fontWeight: 600, color: p.ctaColor ?? '#4b8eff', cursor: 'pointer' }}>{p.ctaText ?? 'Devamını Oku →'}</span>
            </div>
          </div>
        </div>
      );

    // ── VIDEO ───────────────────────────────────────────────────────────────
    case 'video': {
      const toEmbed = (url) => {
        if (!url) return '';
        // YouTube: watch?v=ID or youtu.be/ID → embed/ID
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
        // Already an embed or direct file — use as is
        return url;
      };
      const embedUrl = toEmbed(p.url);
      return (
        <div style={{ width: '100%', height: '100%', borderRadius: p.borderRadius ?? 12, overflow: 'hidden', background: '#000', position: 'relative' }}>
          {embedUrl
            ? <>
              <iframe
                src={embedUrl}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="video"
              />
              {/* Transparent overlay — blocks iframe from eating mouse events in editor */}
              <div style={{ position: 'absolute', inset: 0, zIndex: 1, cursor: 'grab' }} />
            </>
            : <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#0a0a0a', border: '1.5px dashed #2a2a2a', borderRadius: p.borderRadius ?? 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 52, color: '#2a2a2a' }}>play_circle</span>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: '#444', marginBottom: 4, fontWeight: 600 }}>Video Embed</p>
                <p style={{ fontSize: 10, color: '#333' }}>Inspector'dan URL yapıştırın</p>
                <p style={{ fontSize: 9, color: '#2a2a2a', marginTop: 4 }}>YouTube · Vimeo · MP4</p>
              </div>
            </div>
          }
        </div>
      );
    }

    // ── FORM ────────────────────────────────────────────────────────────────
    case 'form': {
      const fields = p.fields ?? [];
      return (
        <div style={{ width: '100%', height: '100%', background: p.bg ?? 'transparent', borderRadius: p.borderRadius ?? 12, display: 'flex', flexDirection: 'column', gap: p.gap ?? 16, padding: 4, boxSizing: 'border-box', overflow: 'auto' }}>
          {fields.map(f => (
            <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: p.labelColor ?? '#888' }}>{f.label}</label>
              {f.type === 'textarea'
                ? <textarea placeholder={f.placeholder} rows={3} style={{ background: p.inputBg ?? '#1e1e1e', border: `1px solid ${p.inputBorderColor ?? 'rgba(255,255,255,0.1)'}`, borderRadius: 8, color: p.inputColor ?? '#e5e2e1', fontSize: 13, padding: '10px 14px', resize: 'none', outline: 'none', fontFamily: 'inherit' }} />
                : <input type={f.type} placeholder={f.placeholder} style={{ background: p.inputBg ?? '#1e1e1e', border: `1px solid ${p.inputBorderColor ?? 'rgba(255,255,255,0.1)'}`, borderRadius: 8, color: p.inputColor ?? '#e5e2e1', fontSize: 13, padding: '10px 14px', outline: 'none', fontFamily: 'inherit' }} />}
            </div>
          ))}
          <button style={{ width: '100%', padding: '12px', background: p.submitBg ?? '#4b8eff', color: p.submitColor ?? '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>{p.submitText ?? 'Gönder'}</button>
        </div>
      );
    }

    // ── ACCORDION ───────────────────────────────────────────────────────────
    case 'accordion': {
      const items = p.items ?? [];
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', boxSizing: 'border-box' }}>
          {items.map((item, i) => (
            <div key={item.id} style={{ background: p.itemBg ?? '#1a1a1a', border: `1px solid ${p.borderColor ?? 'rgba(255,255,255,0.07)'}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}>
                <span style={{ fontSize: p.fontSize ?? 14, fontWeight: 600, color: p.questionColor ?? '#e5e2e1' }}>{item.question}</span>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: p.accentColor ?? '#4b8eff' }}>{i === 0 ? 'remove' : 'add'}</span>
              </div>
              {i === 0 && <div style={{ padding: '0 18px 14px', fontSize: 13, color: p.answerColor ?? '#9ca3af', lineHeight: 1.6 }}>{item.answer}</div>}
            </div>
          ))}
        </div>
      );
    }

    // ── TABS ────────────────────────────────────────────────────────────────
    case 'tabs': {
      const tabList = p.tabs ?? [];
      const active = tabList[0];
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${p.borderColor ?? 'rgba(255,255,255,0.07)'}`, background: p.tabBg ?? '#1a1a1a' }}>
            {tabList.map((t, i) => (
              <div key={t.id} style={{ padding: '12px 20px', fontSize: p.fontSize ?? 13, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? (p.activeColor ?? '#4b8eff') : '#666', cursor: 'pointer', borderBottom: i === 0 ? `2px solid ${p.activeColor ?? '#4b8eff'}` : '2px solid transparent', whiteSpace: 'nowrap' }}>{t.label}</div>
            ))}
          </div>
          <div style={{ flex: 1, background: p.contentBg ?? '#1a1a1a', padding: '20px', fontSize: 14, color: p.textColor ?? '#9ca3af', lineHeight: 1.6 }}>
            {active?.content ?? ''}
          </div>
        </div>
      );
    }

    // ── TESTIMONIAL ─────────────────────────────────────────────────────────
    case 'testimonial':
      return (
        <div style={{ width: '100%', height: '100%', background: p.bg ?? '#1a1a1a', borderRadius: p.borderRadius ?? 16, border: `1px solid ${p.borderColor ?? 'rgba(255,255,255,0.06)'}`, padding: '28px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {Array.from({ length: p.rating ?? 5 }).map((_, i) => <span key={i} style={{ color: p.starColor ?? '#f59e0b', fontSize: 16 }}>★</span>)}
          </div>
          <p style={{ margin: 0, fontSize: 14, color: p.quoteColor ?? '#9ca3af', lineHeight: 1.7, fontStyle: 'italic' }}>{p.quote}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#2a2a2a', overflow: 'hidden', flexShrink: 0 }}>
              {p.avatarUrl ? <img src={p.avatarUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>person</span>}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: p.nameColor ?? '#e5e2e1' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: p.metaColor ?? '#666' }}>{p.role}{p.company ? ` · ${p.company}` : ''}</div>
            </div>
          </div>
        </div>
      );

    // ── AVATAR ──────────────────────────────────────────────────────────────
    case 'avatar':
      return (
        <div style={{ width: '100%', height: '100%', background: p.bg ?? 'transparent', display: 'flex', flexDirection: 'column', alignItems: p.align === 'left' ? 'flex-start' : 'center', justifyContent: 'center', gap: 10, padding: 8, boxSizing: 'border-box' }}>
          <div style={{ width: p.size ?? 80, height: p.size ?? 80, borderRadius: p.borderRadius ?? 99, overflow: 'hidden', border: p.showBorder !== false ? `2px solid ${p.borderColor ?? 'rgba(255,255,255,0.1)'}` : 'none', background: '#1e1e1e', flexShrink: 0 }}>
            {p.src ? <img src={p.src} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="material-symbols-outlined" style={{ fontSize: (p.size ?? 80) * 0.5, color: '#555' }}>person</span></div>}
          </div>
          <div style={{ textAlign: p.align ?? 'center' }}>
            <div style={{ fontSize: p.nameFontSize ?? 16, fontWeight: 700, color: p.nameColor ?? '#e5e2e1' }}>{p.name ?? 'Ad Soyad'}</div>
            <div style={{ fontSize: p.roleFontSize ?? 13, color: p.roleColor ?? '#9ca3af', marginTop: 2 }}>{p.role ?? 'Unvan'}</div>
          </div>
        </div>
      );

    // ── BADGE ───────────────────────────────────────────────────────────────
    case 'badge':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', background: p.bg ?? '#4b8eff', color: p.color ?? '#fff', fontSize: p.fontSize ?? 11, fontWeight: p.fontWeight ?? '700', borderRadius: p.borderRadius ?? 99, padding: `${p.paddingY ?? 5}px ${p.paddingX ?? 12}px`, letterSpacing: p.uppercase ? 1.5 : 0, textTransform: p.uppercase ? 'uppercase' : 'none', whiteSpace: 'nowrap' }}>{p.text ?? 'Badge'}</span>
        </div>
      );

    // ── PROGRESS BAR ────────────────────────────────────────────────────────
    case 'progressBar': {
      const pct = Math.min(100, Math.max(0, ((p.value ?? 75) / (p.max ?? 100)) * 100));
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, boxSizing: 'border-box', padding: '4px 0' }}>
          {p.showLabel !== false && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: p.labelColor ?? '#9ca3af', fontWeight: 600 }}>{p.label ?? 'Tamamlanma'}</span>
            {p.showValue !== false && <span style={{ fontSize: 13, fontWeight: 700, color: '#e5e2e1' }}>{p.value ?? 75}%</span>}
          </div>}
          <div style={{ width: '100%', height: p.height ?? 10, background: p.trackBg ?? '#1e1e1e', borderRadius: p.borderRadius ?? 99, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: p.fillBg ?? '#4b8eff', borderRadius: p.borderRadius ?? 99, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      );
    }

    // ── SOCIAL LINKS ────────────────────────────────────────────────────────
    case 'socialLinks': {
      const SOCIAL_ICONS = { twitter: '𝕏', instagram: '📸', linkedin: 'in', github: '⌥', youtube: '▶', facebook: 'f', tiktok: '♪' };
      const links = p.links ?? [];
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', flexDirection: p.direction ?? 'row', gap: p.gap ?? 12, flexWrap: 'wrap' }}>
          {links.map(l => (
            <div key={l.id} title={l.platform} style={{ width: p.size ?? 40, height: p.size ?? 40, background: p.bg ?? 'rgba(255,255,255,0.05)', borderRadius: p.borderRadius ?? 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: p.iconColor ?? '#e5e2e1', fontWeight: 700, flexShrink: 0 }}>
              {SOCIAL_ICONS[l.platform] ?? '🔗'}
            </div>
          ))}
        </div>
      );
    }

    // ── COUNTDOWN ───────────────────────────────────────────────────────────
    case 'countdown': {
      const end = new Date(p.targetDate ?? Date.now() + 86400000);
      const diff = Math.max(0, end - Date.now());
      const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      const units = [[d, p.labelDays ?? 'GÜN'], [h, p.labelHours ?? 'SAAT'], [m, p.labelMinutes ?? 'DAKİKA'], [s, p.labelSeconds ?? 'SANİYE']];
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: p.gap ?? 12 }}>
          {units.map(([v, l]) => (
            <div key={l} style={{ background: p.bg ?? '#1a1a1a', borderRadius: p.borderRadius ?? 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 70 }}>
              <span style={{ fontSize: p.numFontSize ?? 48, fontWeight: 900, color: p.numColor ?? '#e5e2e1', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{String(v).padStart(2, '0')}</span>
              <span style={{ fontSize: p.labelFontSize ?? 10, color: p.labelColor ?? '#666', fontWeight: 700, letterSpacing: 1.5 }}>{l}</span>
            </div>
          ))}
        </div>
      );
    }

    // ── CODE BLOCK ──────────────────────────────────────────────────────────
    case 'codeBlock':
      return (
        <div style={{ width: '100%', height: '100%', background: p.bg ?? '#0d1117', borderRadius: p.borderRadius ?? 10, overflow: 'auto', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            {['#ff5f57', '#febc2e', '#28c840'].map(c => <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />)}
            <span style={{ marginLeft: 8, fontSize: 11, color: '#666', fontFamily: 'monospace' }}>{p.language ?? 'javascript'}</span>
          </div>
          <pre style={{ margin: 0, padding: '16px', fontSize: p.fontSize ?? 13, color: p.color ?? '#e6edf3', fontFamily: "'Fira Code', 'Courier New', monospace", lineHeight: 1.6, whiteSpace: 'pre-wrap', overflow: 'auto' }}>
            {p.code ?? '// code here'}
          </pre>
        </div>
      );

    // ── TABLE ───────────────────────────────────────────────────────────────
    case 'table': {
      const headers = p.headers ?? [];
      const rows = p.rows ?? [];
      return (
        <div style={{ width: '100%', height: '100%', overflow: 'auto', borderRadius: p.borderRadius ?? 10, border: `1px solid ${p.borderColor ?? 'rgba(255,255,255,0.06)'}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: p.fontSize ?? 13 }}>
            <thead>
              <tr style={{ background: p.headerBg ?? '#1e1e1e' }}>
                {headers.map((h, i) => <th key={i} style={{ padding: '12px 16px', textAlign: 'left', color: p.headerColor ?? '#e5e2e1', fontWeight: 700, borderBottom: `1px solid ${p.borderColor ?? 'rgba(255,255,255,0.06)'}` }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? (p.rowBg ?? '#141414') : (p.altRowBg ?? '#1a1a1a') }}>
                  {row.map((cell, ci) => <td key={ci} style={{ padding: '11px 16px', color: p.cellColor ?? '#9ca3af', borderBottom: `1px solid ${p.borderColor ?? 'rgba(255,255,255,0.04)'}` }}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // ── DIVIDER TEXT ────────────────────────────────────────────────────────
    case 'dividerText':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, height: 1, background: p.lineColor ?? '#2a2a2a' }} />
          <span style={{ fontSize: p.fontSize ?? 12, fontWeight: p.fontWeight ?? '600', color: p.color ?? '#555', whiteSpace: 'nowrap' }}>{p.text ?? 'VEYA'}</span>
          <div style={{ flex: 1, height: 1, background: p.lineColor ?? '#2a2a2a' }} />
        </div>
      );

    // ── HORIZONTAL SCROLL ────────────────────────────────────────────────────────────────────
    case 'horizontalScroll':
      return <HorizontalScrollEl p={p} />;

    // ═══════════════════════════════════════════════════════════════════════════
    // 🛒 E-TİCARET ELEMENTLERİ
    // ═══════════════════════════════════════════════════════════════════════════

    // ── PRODUCT CARD ─────────────────────────────────────────────────────────
    case 'productCard': {
      const stars = Math.floor(p.rating ?? 4.5);
      const halfStar = (p.rating ?? 4.5) % 1 >= 0.5;
      const discount = p.showComparePrice && p.comparePrice > p.price
        ? Math.round((1 - p.price / p.comparePrice) * 100)
        : 0;
      return (
        <div style={{ width: '100%', height: '100%', background: p.bg ?? '#1a1a1a', borderRadius: p.borderRadius ?? 16, border: `1px solid ${p.borderColor ?? 'rgba(255,255,255,0.06)'}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* Badge */}
          {p.showBadge && p.badge && (
            <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2, background: p.badgeBg ?? '#ef4444', color: p.badgeColor ?? '#fff', fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 6, letterSpacing: 1 }}>{p.badge}</div>
          )}
          {/* Image */}
          <div style={{ height: 200, background: '#111', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
            {p.imageSrc
              ? <img src={p.imageSrc} alt={p.imageAlt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e, #16213e)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#333' }}>inventory_2</span>
                </div>}
          </div>
          {/* Content */}
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: p.titleColor ?? '#e5e2e1', lineHeight: 1.3 }}>{p.title ?? 'Ürün Adı'}</h3>
            <p style={{ margin: 0, fontSize: 12, color: p.descColor ?? '#9ca3af', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</p>
            {/* Rating */}
            {p.showRating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', gap: 1 }}>
                  {Array.from({ length: stars }).map((_, i) => <span key={i} style={{ color: '#f59e0b', fontSize: 14 }}>★</span>)}
                  {halfStar && <span style={{ color: '#f59e0b', fontSize: 14, opacity: 0.5 }}>★</span>}
                </div>
                <span style={{ fontSize: 11, color: '#666' }}>({p.reviewCount ?? 0})</span>
              </div>
            )}
            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto' }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: p.priceColor ?? '#22c55e' }}>{p.currency ?? '₺'}{(p.price ?? 0).toFixed(2)}</span>
              {p.showComparePrice && p.comparePrice > 0 && (
                <span style={{ fontSize: 14, color: p.oldPriceColor ?? '#555', textDecoration: 'line-through' }}>{p.currency ?? '₺'}{(p.comparePrice).toFixed(2)}</span>
              )}
              {discount > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, background: '#ef4444', color: '#fff', padding: '2px 7px', borderRadius: 4 }}>-%{discount}</span>
              )}
            </div>
            {/* CTA */}
            <button style={{ width: '100%', padding: '10px', background: p.ctaBg ?? '#22c55e', color: p.ctaColor ?? '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>shopping_cart</span>
              {p.ctaText ?? 'Sepete Ekle'}
            </button>
          </div>
        </div>
      );
    }

    // ── PRODUCT GRID ─────────────────────────────────────────────────────────
    case 'productGrid': {
      const products = p.products ?? [];
      const cols = p.columns ?? 3;
      return (
        <div style={{ width: '100%', height: '100%', background: p.bg ?? '#0e0e0e', borderRadius: p.borderRadius ?? 16, padding: p.padding ?? 24, boxSizing: 'border-box', overflow: 'auto' }}>
          {p.sectionTitle && (
            <h2 style={{ margin: '0 0 20px', fontSize: p.sectionTitleSize ?? 28, fontWeight: 800, color: p.sectionTitleColor ?? '#e5e2e1' }}>{p.sectionTitle}</h2>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: p.gap ?? 20 }}>
            {products.map(prod => (
              <div key={prod.id} style={{ background: p.cardBg ?? '#1a1a1a', border: `1px solid ${p.cardBorderColor ?? 'rgba(255,255,255,0.06)'}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 140, background: 'linear-gradient(135deg, #1a1a2e, #16213e)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {prod.image
                    ? <img src={prod.image} alt={prod.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#333' }}>inventory_2</span>}
                  {prod.badge && (
                    <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 8, fontWeight: 800, background: p.badgeBg ?? '#4b8eff', color: p.badgeColor ?? '#fff', padding: '2px 8px', borderRadius: 4, letterSpacing: 0.5 }}>{prod.badge}</span>
                  )}
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: p.titleColor ?? '#e5e2e1', lineHeight: 1.3 }}>{prod.title}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {Array.from({ length: Math.floor(prod.rating ?? 4) }).map((_, i) => <span key={i} style={{ color: '#f59e0b', fontSize: 11 }}>★</span>)}
                    <span style={{ fontSize: 10, color: '#666', marginLeft: 2 }}>{prod.rating}</span>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: p.priceColor ?? '#22c55e', marginTop: 'auto' }}>₺{(prod.price ?? 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', top: 6, right: 12, fontSize: 8, fontWeight: 800, letterSpacing: 1.5, color: 'rgba(34,197,94,0.3)', textTransform: 'uppercase', pointerEvents: 'none' }}>PRODUCT GRID · {products.length} items</div>
        </div>
      );
    }

    // ── CART BUTTON ───────────────────────────────────────────────────────────
    case 'cartButton':
      return (
        <button style={{
          width: '100%', height: '100%',
          background: p.bg ?? '#22c55e', color: p.color ?? '#fff',
          fontSize: p.fontSize ?? 15, fontWeight: p.fontWeight ?? '700',
          border: 'none', borderRadius: p.borderRadius ?? 10, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: `${p.shadowX ?? 0}px ${p.shadowY ?? 4}px ${p.shadowBlur ?? 20}px ${p.shadowColor ?? 'rgba(34,197,94,0.3)'}`,
          boxSizing: 'border-box', whiteSpace: 'nowrap',
          position: 'relative',
        }}>
          {p.text ?? '🛒 Sepete Ekle'}
          {p.showItemCount && p.itemCount > 0 && (
            <span style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p.itemCount}</span>
          )}
        </button>
      );

    // ── PRICE TAG ────────────────────────────────────────────────────────────
    case 'priceTag': {
      const disc = p.showDiscount && p.comparePrice > p.price
        ? Math.round((1 - p.price / p.comparePrice) * 100)
        : 0;
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: p.align === 'center' ? 'center' : 'flex-end', justifyContent: p.align === 'center' ? 'center' : 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: p.priceFontSize ?? 32, fontWeight: p.fontWeight ?? '800', color: p.priceColor ?? '#22c55e', lineHeight: 1 }}>
            {p.currency ?? '₺'}{(p.price ?? 299.99).toFixed(2)}
          </span>
          {p.comparePrice > 0 && (
            <span style={{ fontSize: p.comparePriceFontSize ?? 18, color: p.comparePriceColor ?? '#666', textDecoration: 'line-through', lineHeight: 1 }}>
              {p.currency ?? '₺'}{(p.comparePrice ?? 399.99).toFixed(2)}
            </span>
          )}
          {disc > 0 && (
            <span style={{ fontSize: 12, fontWeight: 800, background: p.discountBg ?? '#ef4444', color: p.discountColor ?? '#fff', padding: '3px 10px', borderRadius: 6 }}>-%{disc}</span>
          )}
        </div>
      );
    }

    // ── STORE HEADER ─────────────────────────────────────────────────────────
    case 'storeHeader': {
      const cats = p.categories ?? [];
      return (
        <div style={{ width: '100%', height: '100%', background: p.bg ?? 'linear-gradient(135deg, #0e0e0e 0%, #1a1a2e 100%)', borderRadius: p.borderRadius ?? 0, padding: p.padding ?? 40, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(75,142,255,0.1)', border: '1px solid rgba(75,142,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {p.logoSrc
                ? <img src={p.logoSrc} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
                : <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#4b8eff' }}>storefront</span>}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: p.nameFontSize ?? 32, fontWeight: 900, color: p.nameColor ?? '#e5e2e1', lineHeight: 1.2 }}>{p.storeName ?? 'Mağaza Adı'}</h1>
              <p style={{ margin: '4px 0 0', fontSize: p.descFontSize ?? 16, color: p.descColor ?? '#9ca3af' }}>{p.storeDesc}</p>
            </div>
          </div>
          {/* Search */}
          {p.showSearch !== false && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: p.searchBg ?? '#1a1a1a', border: `1px solid ${p.searchBorderColor ?? 'rgba(255,255,255,0.1)'}`, borderRadius: 12, padding: '12px 18px', maxWidth: 500 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#555' }}>search</span>
              <span style={{ fontSize: 14, color: '#444' }}>{p.searchPlaceholder ?? 'Ürün ara...'}</span>
            </div>
          )}
          {/* Categories */}
          {cats.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {cats.map((cat, i) => (
                <span key={i} style={{ fontSize: 12, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? (p.activeCategoryColor ?? '#4b8eff') : '#888', background: i === 0 ? `${p.activeCategoryColor ?? '#4b8eff'}18` : 'rgba(255,255,255,0.04)', padding: '6px 16px', borderRadius: 8, cursor: 'pointer', border: i === 0 ? `1px solid ${p.activeCategoryColor ?? '#4b8eff'}44` : '1px solid transparent' }}>{cat}</span>
              ))}
            </div>
          )}
          <div style={{ position: 'absolute', top: 8, right: 14, fontSize: 8, fontWeight: 800, letterSpacing: 1.5, color: 'rgba(34,197,94,0.3)', textTransform: 'uppercase', pointerEvents: 'none' }}>STORE HEADER</div>
        </div>
      );
    }

    default:
      return null;
  }
});
ElementContent.displayName = 'ElementContent';

// ─── RESIZE HANDLES ───────────────────────────────────────────────────────────
const HANDLES = [
  { pos: 'nw', style: { top: -5, left: -5, cursor: 'nwse-resize' } },
  { pos: 'ne', style: { top: -5, right: -5, cursor: 'nesw-resize' } },
  { pos: 'sw', style: { bottom: -5, left: -5, cursor: 'nesw-resize' } },
  { pos: 'se', style: { bottom: -5, right: -5, cursor: 'nwse-resize' } },
  { pos: 'n', style: { top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
  { pos: 's', style: { bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
  { pos: 'e', style: { right: -4, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' } },
  { pos: 'w', style: { left: -4, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' } },
];

// ─── RENDER ELEMENT ───────────────────────────────────────────────────────────
function RenderElement({ el }) {
  const {
    selectElement, updateProp, updateElementBounds, deleteElement,
    duplicateElement, bringForward, sendBackward, bringToFront, sendToBack,
    setSnapLines, selectedId, selectedChildId, zoom, commitMove,
    enterContainer, exitContainer, activeContainerId, activeBreakpoint,
    resolveElementBounds,
  } = useEditorStore();

  const bounds = resolveElementBounds(el);
  const isSelected = selectedId === el.id;
  const dragRef = useRef(null);
  if (!el.visible) return null;

  const handleMouseDown = useCallback((e, actionType) => {
    if (el.locked && actionType === 'drag') {
      e.stopPropagation();
      selectElement(el.id);
      return;
    }
    if (el.locked) return;
    e.stopPropagation();
    if (actionType === 'drag') selectElement(el.id, null);

    const scale = zoom / 100;
    // ── Capture scroll container position at drag start ──────────────────────
    const scrollEl = document.getElementById('canvas-scroll-area');
    dragRef.current = {
      type: actionType, startX: e.clientX, startY: e.clientY,
      initX: bounds.x, initY: bounds.y, initW: bounds.width, initH: bounds.height,
      // Track scroll so we can compensate when the container auto-scrolls
      startScrollTop: scrollEl?.scrollTop ?? 0,
      startScrollLeft: scrollEl?.scrollLeft ?? 0,
    };

    const MIN = 40;
    const onMove = (me) => {
      // Account for how much the scroll container has scrolled since drag started.
      // If the user dragged near the bottom and the container auto-scrolled by 50px,
      // the canvas moved up 50px in the viewport. We add the scroll delta so
      // the element stays exactly under the cursor.
      const el2 = document.getElementById('canvas-scroll-area');
      const scrollDeltaX = (el2?.scrollLeft ?? 0) - dragRef.current.startScrollLeft;
      const scrollDeltaY = (el2?.scrollTop ?? 0) - dragRef.current.startScrollTop;

      const dx = (me.clientX - dragRef.current.startX + scrollDeltaX) / scale;
      const dy = (me.clientY - dragRef.current.startY + scrollDeltaY) / scale;
      const { type, initX, initY, initW, initH } = dragRef.current;
      let newX = initX, newY = initY, newW = initW, newH = initH;

      if (type === 'drag') {
        const snapped = calculateSnap(
          { id: el.id, width: bounds.width, height: bounds.height },
          useEditorStore.getState().getElements(),
          initX + dx, initY + dy,
          activeBreakpoint
        );
        newX = snapped.finalX; newY = snapped.finalY;
        setSnapLines(snapped.lines);
      } else {
        if (type.includes('e')) newW = Math.max(MIN, initW + dx);
        if (type.includes('s')) newH = Math.max(MIN, initH + dy);
        if (type.includes('w')) { const a = initW - dx; if (a >= MIN) { newW = a; newX = initX + dx; } }
        if (type.includes('n')) { const a = initH - dy; if (a >= MIN) { newH = a; newY = initY + dy; } }
        setSnapLines([]);
      }
      updateElementBounds(el.id, { x: newX, y: newY, width: newW, height: newH });
    };

    const onUp = () => {
      setSnapLines([]); commitMove();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [el, bounds, zoom, activeBreakpoint, selectElement, updateElementBounds, setSnapLines, commitMove]);

  const handleKeyDown = useCallback((e) => {
    if (!isSelected) return;
    if (e.target.contentEditable === 'true') return;
    if (e.key === 'Delete' || e.key === 'Backspace') deleteElement(el.id);
    if (e.key === 'd' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); duplicateElement(el.id); }
    if (e.key === 'Escape') exitContainer();
  }, [isSelected, el.id, deleteElement, duplicateElement, exitContainer]);

  const isContainer = isContainerType(el.type);

  return (
    <div
      tabIndex={isSelected ? 0 : -1}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => handleMouseDown(e, 'drag')}
      style={{
        position: 'absolute',
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        overflow: el.type === 'heading' ? 'visible' : 'hidden',
        cursor: el.locked ? 'not-allowed' : isSelected ? 'grab' : 'pointer',
        userSelect: 'none',
        outline: isSelected ? '2px solid #4b8eff' : 'none',
        outlineOffset: 1,
        borderRadius: 2,
        zIndex: isSelected ? 10 : 'auto',
      }}
    >
      {/* Selection toolbar */}
      {isSelected && (
        <>
          <div
            style={{
              position: 'absolute', top: -36, left: 0,
              display: 'flex', alignItems: 'center', gap: 4, zIndex: 20,
            }}
            onMouseDown={e => e.stopPropagation()}
          >
            <span style={labelStyle}>{el.name || el.type}</span>
            {el.locked
              ? <span style={{ ...iconBtnStyle, background: '#d97706', color: '#fff' }}>🔒</span>
              : <>
                {isContainer && (
                  <button
                    onMouseDown={e => { e.stopPropagation(); enterContainer(el.id); }}
                    style={{ ...iconBtnStyle, color: '#4b8eff' }} title="İçine Gir (2x tıkla)"
                  >⤵</button>
                )}
                <button onMouseDown={e => { e.stopPropagation(); bringToFront(el.id); }} style={iconBtnStyle} title="En Öne">⤒</button>
                <button onMouseDown={e => { e.stopPropagation(); bringForward(el.id); }} style={iconBtnStyle} title="Öne Al">↑</button>
                <button onMouseDown={e => { e.stopPropagation(); sendBackward(el.id); }} style={iconBtnStyle} title="Geri Al">↓</button>
                <button onMouseDown={e => { e.stopPropagation(); sendToBack(el.id); }} style={iconBtnStyle} title="En Arka">⤓</button>
                <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
                <button onMouseDown={e => { e.stopPropagation(); duplicateElement(el.id); }} style={iconBtnStyle} title="Çoğalt">⎘</button>
                <button onMouseDown={e => { e.stopPropagation(); deleteElement(el.id); }} style={{ ...iconBtnStyle, background: '#e53e3e', color: '#fff' }} title="Sil">✕</button>
              </>
            }
          </div>

          {/* Size indicator */}
          <div style={{
            position: 'absolute', bottom: -22, left: 0,
            fontSize: 9, color: '#4b8eff', fontWeight: 700,
            letterSpacing: 0.5, pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            {Math.round(bounds.width)} × {Math.round(bounds.height)}
            {el.type === 'gridContainer' && ` · ${el.props.columns ?? 3} cols · ${(el.children ?? []).length} items`}
            {el.type === 'flexContainer' && ` · ${(el.children ?? []).length} items`}
          </div>

          {/* Link action badge */}
          {el.linkAction && el.linkAction.type !== 'none' && (
            <div
              style={{
                position: 'absolute', bottom: -22, right: 0,
                display: 'flex', alignItems: 'center', gap: 3,
                background: el.linkAction.type === 'page' ? 'rgba(16,185,129,0.15)' : 'rgba(75,142,255,0.15)',
                border: `1px solid ${el.linkAction.type === 'page' ? 'rgba(16,185,129,0.3)' : 'rgba(75,142,255,0.3)'}`,
                borderRadius: 10, padding: '1px 6px',
                pointerEvents: 'none', whiteSpace: 'nowrap',
              }}
            >
              <span className="material-symbols-outlined" style={{
                fontSize: 9,
                color: el.linkAction.type === 'page' ? '#10b981' : '#4b8eff',
              }}>
                {el.linkAction.type === 'page' ? 'web' : el.linkAction.type === 'url' ? 'link' : 'arrow_downward'}
              </span>
              <span style={{
                fontSize: 7, fontWeight: 800, letterSpacing: 0.5,
                color: el.linkAction.type === 'page' ? '#10b981' : '#4b8eff',
              }}>
                {el.linkAction.type === 'page' ? 'SAYFA' : el.linkAction.type === 'url' ? 'URL' : 'KAYDIR'}
              </span>
            </div>
          )}

          {/* Resize handles */}
          {!el.locked && HANDLES.map(h => (
            <div
              key={h.pos}
              onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, h.pos); }}
              style={{
                position: 'absolute', width: 10, height: 10,
                background: '#fff', border: '2px solid #4b8eff',
                borderRadius: h.pos.length === 1 ? 2 : 3, zIndex: 30,
                ...h.style,
              }}
            />
          ))}
        </>
      )}

      <ElementContent
        el={el}
        updateProp={updateProp}
        selectElement={selectElement}
        selectedChildId={selectedChildId}
      />
    </div>
  );
}

// ─── GRID OVERLAY ─────────────────────────────────────────────────────────────
function GridOverlay({ width, height, size }) {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
      width={width} height={height}
    >
      <defs>
        <pattern id="grid" width={size} height={size} patternUnits="userSpaceOnUse">
          <path d={`M ${size} 0 L 0 0 0 ${size}`} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
        </pattern>
        <pattern id="grid-large" width={size * 8} height={size * 8} patternUnits="userSpaceOnUse">
          <rect width={size * 8} height={size * 8} fill="url(#grid)" />
          <path d={`M ${size * 8} 0 L 0 0 0 ${size * 8}`} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-large)" />
    </svg>
  );
}

// ─── CANVAS HEIGHT RESIZE HANDLE ──────────────────────────────────────────────
// Placed OUTSIDE the inner canvas div so it doesn't need overflow:visible on
// the canvas. It receives `zoom` so drag distance is correctly unscaled.
function CanvasHeightHandle({ currentHeight, zoom = 100, onResize }) {
  const dragRef = useRef(null);
  const scale = zoom / 100;

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startY: e.clientY, initH: currentHeight };

    const onMove = (me) => {
      // Divide by scale: dragging 50px at 50% zoom = 100px canvas units
      const dy = (me.clientY - dragRef.current.startY) / scale;
      onResize(dragRef.current.initH + dy);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [currentHeight, scale, onResize]);

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        bottom: -14,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 80,
        height: 8,
        borderRadius: 100,
        background: 'rgba(75,142,255,0.35)',
        cursor: 'ns-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.15s, width 0.15s',
        zIndex: 50,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(75,142,255,0.7)'; e.currentTarget.style.width = '120px'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(75,142,255,0.35)'; e.currentTarget.style.width = '80px'; }}
      title="Sayfa yüksekliğini sürükle"
    >
      <span style={{
        fontSize: 7, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5,
        fontWeight: 800, textTransform: 'uppercase', userSelect: 'none',
        pointerEvents: 'none',
      }}>▼ UZAT</span>
    </div>
  );
}

// ─── BREAKPOINT BADGE ─────────────────────────────────────────────────────────
const BP_COLORS = { desktop: '#4b8eff', tablet: '#a855f7', mobile: '#10b981' };

function BreakpointBadge({ breakpoint }) {
  const bp = BREAKPOINTS[breakpoint];
  const color = BP_COLORS[breakpoint];
  return (
    <div style={{
      position: 'fixed', top: 68, right: 308,
      background: `${color}18`,
      border: `1px solid ${color}44`,
      color,
      borderRadius: 20, padding: '3px 12px',
      fontSize: 10, fontWeight: 800, letterSpacing: 1.5,
      zIndex: 200, display: 'flex', alignItems: 'center', gap: 6,
      pointerEvents: 'none',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{bp.icon}</span>
      {bp.label} · {bp.width}px
    </div>
  );
}

// ─── EDITOR CANVAS ─────────────────────────────────────────────────────────────
export default function EditorCanvas() {
  const canvasRef = useRef(null);
  const scrollRef = useRef(null);
  const {
    getElements, addElement, deselectElement,
    zoom, setZoom, isElementPanelOpen, isLayersPanelOpen, isPagesPanelOpen,
    snapLines, undo, redo, showGrid, gridSize,
    activeContainerId, exitContainer, selectedId,
    activeBreakpoint, getActiveCanvasWidth, getActiveCanvasHeight, setCanvasHeight,
    resolveElementBounds,
  } = useEditorStore();

  const elements = getElements();
  const leftPanel = isElementPanelOpen || isLayersPanelOpen || isPagesPanelOpen;

  const canvasWidth = getActiveCanvasWidth();

  // Track whether any element is being dragged — used to freeze dynamicHeight.
  // Without this, moving an element downward increases dynamicHeight → outer div
  // grows → scroll container scrolls → drag position jumps (feedback loop).
  const isDragging = useRef(false);
  const frozenHeight = useRef(null);

  // ── Dynamic canvas height ──────────────────────────────────────────────────
  const computedHeight = useMemo(() => {
    const BOTTOM_PAD = 200;
    const minH = getActiveCanvasHeight();
    if (elements.length === 0) return minH;
    const maxBottom = Math.max(...elements.map(el => {
      const b = resolveElementBounds(el);
      return b.y + b.height;
    }));
    return Math.max(minH, maxBottom + BOTTOM_PAD);
  }, [elements, activeBreakpoint, getActiveCanvasHeight, resolveElementBounds]);

  // While dragging, use the last frozen height to prevent scroll jump.
  // After drag ends (commitMove triggers re-render), computed height is used again.
  const dynamicHeight = isDragging.current ? (frozenHeight.current ?? computedHeight) : computedHeight;

  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('elementType');
    if (!type || !canvasRef.current) return;

    if (activeContainerId) {
      useEditorStore.getState().addChildToContainer(activeContainerId, type);
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const scale = zoom / 100;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    addElement(type, x, y);
  }, [zoom, addElement, activeContainerId]);

  // ── Freeze dynamicHeight during any element drag ───────────────────────────
  // Listen for mousedown anywhere on the canvas; when an element drag starts
  // (detected by mouseup commitment), unfreeze height so it can grow again.
  React.useEffect(() => {
    const onGlobalMouseDown = () => {
      // Freeze height at current computed value before drag starts changing things
      frozenHeight.current = computedHeight;
      isDragging.current = true;
    };
    const onGlobalMouseUp = () => {
      isDragging.current = false;
      frozenHeight.current = null;
    };
    window.addEventListener('mousedown', onGlobalMouseDown);
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => {
      window.removeEventListener('mousedown', onGlobalMouseDown);
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };
  }, [computedHeight]);

  const handleBgClick = useCallback((e) => {
    if (activeContainerId) { exitContainer(); return; }
    if (
      e.target.id === 'canvas-scroll-area' ||
      e.target.id === 'canvas-bg' ||
      e.target === canvasRef.current
    ) deselectElement();
  }, [deselectElement, activeContainerId, exitContainer]);

  const handleKeyDown = useCallback((e) => {
    if (e.target.contentEditable === 'true') return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
    if (e.key === 'Escape') { exitContainer(); deselectElement(); }
    if (e.key === '+' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setZoom(zoom + 10); }
    if (e.key === '-' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setZoom(zoom - 10); }
  }, [undo, redo, exitContainer, deselectElement, zoom, setZoom]);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = zoom / 100;
    setMousePos({
      x: Math.round((e.clientX - rect.left) / scale),
      y: Math.round((e.clientY - rect.top) / scale),
    });
  }, [zoom]);

  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(zoom + (e.deltaY < 0 ? 5 : -5));
    }
  }, [zoom, setZoom]);

  const handleHeightResize = useCallback((newH) => {
    setCanvasHeight(newH);
  }, [setCanvasHeight]);

  return (
    <main
      id="canvas-scroll-area"
      ref={scrollRef}
      className={`pt-16 h-screen overflow-auto bg-[#0e0e0e] canvas-dots text-center whitespace-nowrap transition-all duration-300`}
      style={{ marginLeft: leftPanel ? 344 : 80, marginRight: 300, outline: 'none' }}
      onMouseDown={handleBgClick}
      onKeyDown={handleKeyDown}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      tabIndex={0}
    >
      {/* Breakpoint badge */}
      <BreakpointBadge breakpoint={activeBreakpoint} />

      {/* Container enter indicator */}
      {activeContainerId && (
        <div style={{
          position: 'fixed', top: 68, left: '50%', transform: 'translateX(-50%)',
          background: '#4b8eff', color: '#fff', fontSize: 11, fontWeight: 700,
          padding: '4px 16px', borderRadius: 20, zIndex: 200,
          letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span className="material-symbols-outlined text-sm">folder_open</span>
          Container içi düzenleme — ESC ile çık
          <button
            onClick={exitContainer}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', fontSize: 10 }}
          >ESC</button>
        </div>
      )}

      {/* Canvas wrapper */}
      <div id="canvas-bg" className="inline-block text-left align-top p-16 relative min-w-full min-h-full">
        {/* Outer box — sized to zoom-scaled px, clips horizontal overflow */}
        <div style={{
          width: `${canvasWidth * (zoom / 100)}px`,
          height: `${dynamicHeight * (zoom / 100)}px`,
          position: 'relative',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 32px 80px rgba(0,0,0,0.8)',
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
        }}>
          {/* Inner canvas at 1:1 scale, transformed */}
          <div
            ref={canvasRef}
            onDragOver={onDragOver}
            onDrop={onDrop}
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top left',
              width: `${canvasWidth}px`,
              height: `${dynamicHeight}px`,
              position: 'absolute', top: 0, left: 0,
              background: '#181818',
              overflow: 'hidden',
            }}
          >
            {/* Grid overlay */}
            {showGrid && <GridOverlay width={canvasWidth} height={dynamicHeight} size={gridSize} />}

            {/* Canvas size label */}
            <div style={{
              position: 'absolute', top: 8, right: 12,
              fontSize: 9, color: '#2a2a2a', fontWeight: 700,
              letterSpacing: 1.5, pointerEvents: 'none', userSelect: 'none',
            }}>
              {canvasWidth} × {Math.round(dynamicHeight)}
            </div>

            {/* Empty state */}
            {elements.length === 0 && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.08)', pointerEvents: 'none', userSelect: 'none',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 64, marginBottom: 12 }}>drag_indicator</span>
                <p style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Eleman Sürükle & Bırak</p>
                <p style={{ fontSize: 10, marginTop: 6, opacity: 0.5, letterSpacing: '0.2em' }}>Sol panelden başla</p>
              </div>
            )}

            {/* Elements */}
            {elements.map(el => <RenderElement key={el.id} el={el} />)}

            {/* Snap lines */}
            {snapLines.map((line, i) => (
              <div key={i} style={{
                position: 'absolute', background: '#f0f', zIndex: 9999, pointerEvents: 'none',
                ...(line.type === 'v'
                  ? { left: line.pos, top: 0, bottom: 0, width: 1, opacity: 0.8 }
                  : { top: line.pos, left: 0, right: 0, height: 1, opacity: 0.8 }
                ),
              }} />
            ))}
          </div>

          {/* Canvas height resize handle — OUTSIDE inner canvas so it
              stays visible without requiring overflow:visible on the canvas */}
          <CanvasHeightHandle
            currentHeight={getActiveCanvasHeight()}
            zoom={zoom}
            onResize={handleHeightResize}
          />
        </div>
      </div>

      {/* Bottom toolbar */}
      <div style={{
        position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'rgba(18,18,18,0.92)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 999, padding: '6px 14px', zIndex: 100,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        {[
          { icon: 'undo', action: undo, title: 'Geri (Ctrl+Z)' },
          { icon: 'redo', action: redo, title: 'İleri (Ctrl+Y)' },
        ].map(({ icon, action, title }) => (
          <button key={icon} onClick={action} title={title}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = '#888'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
          </button>
        ))}

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        <button onClick={() => setZoom(zoom - 10)} style={toolBtnStyle}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>remove</span>
        </button>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#ccc', width: 44, textAlign: 'center' }}>{zoom}%</span>
        <button onClick={() => setZoom(zoom + 10)} style={toolBtnStyle}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
        </button>
        <button onClick={() => setZoom(100)} style={toolBtnStyle} title="Sıfırla">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>fit_screen</span>
        </button>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        <button
          onClick={() => useEditorStore.getState().toggleGrid()}
          title="Grid"
          style={{ ...toolBtnStyle, color: showGrid ? '#4b8eff' : '#888' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>grid_on</span>
        </button>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        {/* Mouse position */}
        <span style={{ fontSize: 10, color: '#555', fontFamily: 'monospace', minWidth: 80 }}>
          {mousePos.x}, {mousePos.y}
        </span>
      </div>
    </main>
  );
}

const labelStyle = {
  background: '#4b8eff', color: '#fff', fontSize: 9, fontWeight: 800,
  padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase',
  letterSpacing: 1, lineHeight: '18px', maxWidth: 120,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const iconBtnStyle = {
  background: 'rgba(15,15,15,0.88)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#ccc', fontSize: 11, borderRadius: 4, width: 22, height: 22,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', lineHeight: 1, padding: 0, backdropFilter: 'blur(4px)',
};
const toolBtnStyle = {
  background: 'none', border: 'none', color: '#888', cursor: 'pointer',
  padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center',
};      
