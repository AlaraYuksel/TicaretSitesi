import React, { useState, useRef } from 'react';
import { useEditorStore, isContainerType, getElementBounds } from '../../store/useEditorStore';

const TYPE_ICON = {
  heading: 'title', paragraph: 'notes', button: 'smart_button',
  image: 'image', box: 'check_box_outline_blank', section: 'view_day',
  divider: 'remove', icon: 'interests',
  flexContainer: 'view_column', gridContainer: 'grid_view',
  navbar: 'web_asset', sidebar: 'view_sidebar', hero: 'panorama',
  footer: 'table_rows', form: 'assignment', badge: 'sell',
  accordion: 'expand_circle_down', tabs: 'tab', video: 'play_circle',
  table: 'table_chart', countdown: 'timer', progressBar: 'linear_scale',
};

// Badge shown when element spans full canvas width or is positioned at edge
function LayoutBadge({ el, canvasWidth, breakpoint }) {
  const b = getElementBounds(el, breakpoint);
  const isFullWidth = b.x === 0 && b.width >= canvasWidth - 2;
  const isPinnedTop = b.y === 0;
  const isNavbarLike = isFullWidth && isPinnedTop && b.height <= 80;
  const isSidebarLike = b.height > canvasWidth * 0.5 && b.width < canvasWidth * 0.4;

  if (isNavbarLike) return <Badge label="NAV" color="#4b8eff" />;
  if (isFullWidth && !isPinnedTop) return <Badge label="FULL" color="#10b981" />;
  if (isFullWidth) return <Badge label="FULL" color="#10b981" />;
  if (isSidebarLike) return <Badge label="SIDE" color="#a855f7" />;
  return null;
}

function Badge({ label, color }) {
  return (
    <span style={{
      fontSize: 7, fontWeight: 900, color,
      background: `${color}18`, padding: '1px 5px',
      borderRadius: 20, flexShrink: 0, letterSpacing: 0.5,
      border: `1px solid ${color}30`,
    }}>{label}</span>
  );
}

function LayerRow({ el, index, isSelected, total }) {
  const {
    selectElement, toggleVisibility, toggleLock,
    renameElement, bringForward, sendBackward,
    bringToFront, sendToBack, deleteElement, reorderElements,
    activeBreakpoint, canvasWidth,
  } = useEditorStore();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(el.name || el.type);
  const [dragOver, setDragOver] = useState(null);
  const inputRef = useRef(null);

  const commit = () => {
    renameElement(el.id, draft.trim() || el.type);
    setEditing(false);
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('layerIndex', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOver(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData('layerIndex'));
    const rect = e.currentTarget.getBoundingClientRect();
    let to = e.clientY < rect.top + rect.height / 2 ? index : index + 1;
    if (from < to) to -= 1;
    setDragOver(null);
    if (from !== to) reorderElements(from, to);
  };

  const childCount = isContainerType(el.type) ? (el.children?.length ?? 0) : null;

  return (
    <div draggable onDragStart={handleDragStart} onDragOver={handleDragOver} onDragLeave={() => setDragOver(null)} onDrop={handleDrop} style={{ position: 'relative' }}>
      {dragOver === 'above' && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: '#4b8eff', borderRadius: 1, zIndex: 10 }} />}

      <div
        onClick={() => selectElement(el.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
          background: isSelected ? 'rgba(75,142,255,0.1)' : 'transparent',
          border: isSelected ? '1px solid rgba(75,142,255,0.2)' : '1px solid transparent',
          opacity: !el.visible ? 0.4 : 1,
          transition: 'all 0.12s', userSelect: 'none',
        }}
        className="layer-row"
      >
        {/* Drag handle */}
        <span className="material-symbols-outlined" style={{ fontSize: 11, color: '#2a2a2a', flexShrink: 0, cursor: 'grab' }}>
          drag_indicator
        </span>

        {/* Type icon */}
        <span className="material-symbols-outlined" style={{
          fontSize: 14, flexShrink: 0,
          color: isSelected ? '#4b8eff' : isContainerType(el.type) ? '#8b5cf6' : '#444',
        }}>
          {TYPE_ICON[el.type] || 'widgets'}
        </span>

        {/* Name */}
        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); e.stopPropagation(); }}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1, background: '#222', border: '1px solid #4b8eff',
              color: '#fff', borderRadius: 4, padding: '2px 6px', fontSize: 11, outline: 'none',
            }}
          />
        ) : (
          <span
            onDoubleClick={e => { e.stopPropagation(); setDraft(el.name || el.type); setEditing(true); }}
            style={{
              flex: 1, fontSize: 11,
              color: isSelected ? '#e5e2e1' : '#777',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >{el.name || el.type}</span>
        )}

        {/* Layout badge (FULL / NAV / SIDE) */}
        <LayoutBadge el={el} canvasWidth={canvasWidth} breakpoint={activeBreakpoint} />

        {/* Child count badge */}
        {childCount !== null && (
          <span style={{
            fontSize: 8, fontWeight: 800, color: '#8b5cf6',
            background: 'rgba(139,92,246,0.12)', padding: '1px 5px', borderRadius: 20,
            flexShrink: 0,
          }}>{childCount}</span>
        )}

        {/* Actions */}
        <div
          style={{ display: 'flex', gap: 2, flexShrink: 0 }}
          className="layer-actions"
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => toggleVisibility(el.id)} style={layerBtn} title={el.visible ? 'Gizle' : 'Göster'}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{el.visible ? 'visibility' : 'visibility_off'}</span>
          </button>
          <button onClick={() => toggleLock(el.id)} style={{ ...layerBtn, color: el.locked ? '#4b8eff' : undefined }} title={el.locked ? 'Kilidi Aç' : 'Kilitle'}>
            <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>{el.locked ? 'lock' : 'lock_open'}</span>
          </button>
        </div>
      </div>

      {dragOver === 'below' && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: '#4b8eff', borderRadius: 1, zIndex: 10 }} />}
    </div>
  );
}

const layerBtn = {
  background: 'none', border: 'none', color: '#333', cursor: 'pointer',
  padding: 3, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
};

export default function EditorLayersPanel() {
  const { getElements, selectedId, isLayersPanelOpen, bringToFront, sendToBack, bringForward, sendBackward } = useEditorStore();

  const elements = getElements();
  if (!isLayersPanelOpen) return null;

  const reversed = [...elements].reverse();

  return (
    <aside style={{
      position: 'fixed', left: 68, top: 64,
      height: 'calc(100vh - 92px)',
      width: 248,
      background: '#141414', borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column', zIndex: 30,
    }}>
      {/* Header */}
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 11, fontWeight: 800, color: '#e5e2e1', textTransform: 'uppercase', letterSpacing: 2, margin: 0 }}>Layers</h2>
          <span style={{
            fontSize: 9, fontWeight: 800, color: '#555',
            background: '#1a1a1a', padding: '2px 8px', borderRadius: 20,
          }}>{elements.length}</span>
        </div>
        <p style={{ fontSize: 9, color: '#444', marginTop: 3 }}>Çift tıkla → yeniden adlandır · Sürükle → sırala</p>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {elements.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: 160, color: '#2a2a2a',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, marginBottom: 8 }}>layers</span>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Henüz element yok</p>
          </div>
        )}
        {reversed.map((el, revIdx) => {
          const originalIndex = elements.length - 1 - revIdx;
          return (
            <LayerRow
              key={el.id}
              el={el}
              index={originalIndex}
              isSelected={selectedId === el.id}
              total={elements.length}
            />
          );
        })}
      </div>

      {/* Footer — selected element quick z-order */}
      {selectedId && (() => {
        const sel = elements.find(e => e.id === selectedId);
        if (!sel) return null;
        return (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '10px 12px' }}>
            <p style={{ fontSize: 8, color: '#333', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 8 }}>Katman Sırası</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {[
                { icon: 'vertical_align_top', label: 'En Öne', action: () => bringToFront(selectedId) },
                { icon: 'expand_less', label: 'Öne Al', action: () => bringForward(selectedId) },
                { icon: 'expand_more', label: 'Geri Al', action: () => sendBackward(selectedId) },
                { icon: 'vertical_align_bottom', label: 'En Arka', action: () => sendToBack(selectedId) },
              ].map(({ icon, label, action }) => (
                <button key={icon} onClick={action} title={label} style={{
                  background: '#1a1a1a', border: 'none', color: '#555',
                  borderRadius: 6, padding: '6px 0', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  transition: 'all 0.12s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#222'; e.currentTarget.style.color = '#aaa'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#555'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{icon}</span>
                  <span style={{ fontSize: 7, fontWeight: 700 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}
    </aside>
  );
}