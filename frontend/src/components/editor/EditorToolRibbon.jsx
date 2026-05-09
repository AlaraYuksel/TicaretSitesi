import React, { useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';

// ─── SNAP / ALIGN PRESETS ─────────────────────────────────────────────────────
// These helpers let user "pin" a selected element to common layout positions.
function useSnapActions() {
  const { selectedId, getElements, updateElementBounds, activeBreakpoint, canvasWidth, getActiveCanvasHeight } = useEditorStore();

  const apply = (fn) => {
    if (!selectedId) return;
    const el = getElements().find(e => e.id === selectedId);
    if (!el) return;
    const { getElementBounds } = require('../../store/useEditorStore');
    const b = getElementBounds(el, activeBreakpoint);
    const cw = canvasWidth;
    const ch = getActiveCanvasHeight();
    const next = fn(b, cw, ch);
    updateElementBounds(selectedId, next);
  };

  return {
    // Edge snaps
    snapLeft: () => apply((b) => ({ ...b, x: 0 })),
    snapRight: () => apply((b, cw) => ({ ...b, x: cw - b.width })),
    snapTop: () => apply((b) => ({ ...b, y: 0 })),
    snapBottom: () => apply((b, cw, ch) => ({ ...b, y: ch - b.height })),

    // Full-width (stretch edge to edge)
    makeFullWidth: () => apply((b, cw) => ({ ...b, x: 0, width: cw })),

    // Center
    centerH: () => apply((b, cw) => ({ ...b, x: Math.round((cw - b.width) / 2) })),
    centerV: () => apply((b, cw, ch) => ({ ...b, y: Math.round((ch - b.height) / 2) })),

    // Navbar preset — pin to top, full width, standard height
    pinAsNavbar: () => apply((b, cw) => ({ x: 0, y: 0, width: cw, height: 64 })),

    // Sidebar preset — pin to right, full height
    pinAsSidebar: () => apply((b, cw, ch) => ({ x: cw - (b.width || 280), y: 0, width: b.width || 280, height: ch })),

    // Footer preset — pin to bottom, full width
    pinAsFooter: () => apply((b, cw, ch) => ({ x: 0, y: ch - b.height, width: cw, height: b.height })),
  };
}

// ─── TOOLTIP ──────────────────────────────────────────────────────────────────
function Tooltip({ children, label, shortcut }) {
  return (
    <div style={{ position: 'relative' }} className="ribbon-tooltip-host">
      {children}
      <div style={{
        position: 'absolute', left: 68, top: '50%', transform: 'translateY(-50%)',
        background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)',
        color: '#e5e2e1', fontSize: 10, fontWeight: 600,
        padding: '5px 10px', borderRadius: 6, whiteSpace: 'nowrap',
        pointerEvents: 'none', opacity: 0, transition: 'opacity 0.15s',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)', zIndex: 200,
        display: 'flex', alignItems: 'center', gap: 8,
      }} className="ribbon-tooltip">
        {label}
        {shortcut && <span style={{ color: '#555', fontSize: 9 }}>{shortcut}</span>}
      </div>
    </div>
  );
}

// ─── ICON BUTTON ──────────────────────────────────────────────────────────────
function RibbonBtn({ icon, label, shortcut, onClick, active, danger, disabled }) {
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <button
        onClick={onClick}
        disabled={disabled}
        title={label}
        style={{
          width: 44, height: 44,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 2, border: 'none', borderRadius: 10, cursor: disabled ? 'default' : 'pointer',
          background: active ? 'rgba(75,142,255,0.14)' : 'transparent',
          color: disabled ? '#2a2a2a' : danger ? '#e53e3e' : active ? '#4b8eff' : '#666',
          transition: 'all 0.15s',
          outline: active ? '1px solid rgba(75,142,255,0.2)' : '1px solid transparent',
          opacity: disabled ? 0.4 : 1,
        }}
        onMouseEnter={e => { if (!active && !disabled) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = danger ? '#f87171' : '#ccc'; } }}
        onMouseLeave={e => { if (!active && !disabled) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = disabled ? '#2a2a2a' : danger ? '#e53e3e' : '#666'; } }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{icon}</span>
      </button>
    </Tooltip>
  );
}

// ─── COLLAPSIBLE SECTION ──────────────────────────────────────────────────────
function Section({ label, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ width: '100%' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', background: 'none', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px 4px', cursor: 'pointer',
          color: '#333', fontSize: 7.5, fontWeight: 800,
          letterSpacing: 1.5, textTransform: 'uppercase',
        }}
      >
        {label}
        <span className="material-symbols-outlined" style={{ fontSize: 10, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
          expand_more
        </span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, padding: '0 4px 6px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function EditorToolRibbon() {
  const {
    toggleElementPanel, isElementPanelOpen,
    toggleLayersPanel, isLayersPanelOpen,
    togglePagesPanel, isPagesPanelOpen,
    toggleGrid, showGrid,
    getElements, selectedId,
  } = useEditorStore();

  const snap = useSnapActions();
  const elements = getElements();
  const hasSelection = !!selectedId;

  return (
    <>
      <style>{`
        .ribbon-tooltip-host:hover .ribbon-tooltip { opacity: 1 !important; }
        .ribbon-tooltip-host:hover > button { background: rgba(255,255,255,0.05); }
      `}</style>

      <aside style={{
        position: 'fixed', left: 0, top: 64,
        height: 'calc(100vh - 92px)', /* leave room for status bar */
        width: 68,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        overflowY: 'auto', overflowX: 'hidden',
        paddingBottom: 8,
        background: '#0f0f0f',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        zIndex: 40,
        scrollbarWidth: 'none',
      }}>

        {/* ── PANELS ─────────────────────────────────────────────────── */}
        <Section label="Panels">
          <RibbonBtn
            icon="add_circle" label="Elements" onClick={toggleElementPanel} active={isElementPanelOpen}
          />
          <RibbonBtn
            icon="layers" label={`Layers${elements.length ? ` (${elements.length})` : ''}`}
            onClick={toggleLayersPanel} active={isLayersPanelOpen}
          />
          <RibbonBtn
            icon="web" label="Pages" onClick={togglePagesPanel} active={isPagesPanelOpen}
          />
        </Section>

        <Divider />

        {/* ── SNAP TO EDGE ───────────────────────────────────────────── */}
        <Section label="Snap Edge" defaultOpen={true}>
          <RibbonBtn icon="align_horizontal_left" label="Snap Left" onClick={snap.snapLeft} disabled={!hasSelection} />
          <RibbonBtn icon="align_horizontal_right" label="Snap Right" onClick={snap.snapRight} disabled={!hasSelection} />
          <RibbonBtn icon="align_vertical_top" label="Snap Top" onClick={snap.snapTop} disabled={!hasSelection} />
          <RibbonBtn icon="align_vertical_bottom" label="Snap Bottom" onClick={snap.snapBottom} disabled={!hasSelection} />
        </Section>

        <Divider />

        {/* ── ALIGN / DISTRIBUTE ─────────────────────────────────────── */}
        <Section label="Align" defaultOpen={true}>
          <RibbonBtn icon="align_horizontal_center" label="Center Horizontal" onClick={snap.centerH} disabled={!hasSelection} />
          <RibbonBtn icon="align_vertical_center" label="Center Vertical" onClick={snap.centerV} disabled={!hasSelection} />
        </Section>

        <Divider />

        {/* ── LAYOUT PRESETS ─────────────────────────────────────────── */}
        {/*
          These are "smart pin" actions — they resize + reposition
          the selected element to common real-site layout positions.
          Ideal for: navbar (full-width top), sidebar (full-height right),
          footer (full-width bottom), hero (full-width, tall).
        */}
        <Section label="Pin As" defaultOpen={true}>
          <RibbonBtn
            icon="horizontal_rule"
            label="Full-Width (stretch to canvas edges)"
            onClick={snap.makeFullWidth}
            disabled={!hasSelection}
          />
          <RibbonBtn
            icon="web_asset"
            label="Pin as Navbar (full-width, top, 64px)"
            onClick={snap.pinAsNavbar}
            disabled={!hasSelection}
          />
          <RibbonBtn
            icon="view_sidebar"
            label="Pin as Sidebar (right edge, full height)"
            onClick={snap.pinAsSidebar}
            disabled={!hasSelection}
          />
          <RibbonBtn
            icon="table_rows"
            label="Pin as Footer (full-width, bottom)"
            onClick={snap.pinAsFooter}
            disabled={!hasSelection}
          />
        </Section>

        <Divider />

        {/* ── VIEW ───────────────────────────────────────────────────── */}
        <Section label="View">
          <RibbonBtn icon="grid_on" label="Toggle Grid" onClick={toggleGrid} active={showGrid} />
        </Section>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Help */}
        <Tooltip label="Keyboard Shortcuts">
          <button
            style={{
              width: 40, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer',
              background: 'transparent', color: '#333', marginBottom: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#666'}
            onMouseLeave={e => e.currentTarget.style.color = '#333'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>help_outline</span>
          </button>
        </Tooltip>
      </aside>
    </>
  );
}

function Divider() {
  return <div style={{ width: 36, height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />;
}