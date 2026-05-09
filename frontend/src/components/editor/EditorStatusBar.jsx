import React from 'react';
import { useEditorStore } from '../../store/useEditorStore';

export default function EditorStatusBar() {
  const { getElements, selectedId, zoom, canvasWidth, canvasHeight, pages, activePageId } = useEditorStore();
  const elements = getElements();
  const selected = elements.find(e => e.id === selectedId);
  const pageIndex = pages.findIndex(p => p.id === activePageId) + 1;

  return (
    <footer style={{
      position: 'fixed', bottom: 0, left: 0, width: '100%',
      height: 28, background: '#0a0a0a',
      borderTop: '1px solid rgba(255,255,255,0.04)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', zIndex: 50,
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 9, color: '#444', fontWeight: 600 }}>Otomatik kaydedildi</span>
        </div>

        <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.06)' }} />

        <span style={{ fontSize: 9, color: '#333' }}>
          Sayfa {pageIndex}/{pages.length} · {elements.length} element
        </span>

        {selected && (
          <>
            <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace' }}>
              {selected.name} · {Math.round(selected.x)},{Math.round(selected.y)} · {Math.round(selected.width)}×{Math.round(selected.height)}
            </span>
          </>
        )}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 9, color: '#333', fontFamily: 'monospace' }}>
          {canvasWidth}×{canvasHeight}
        </span>
        <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.06)' }} />
        <span style={{ fontSize: 9, color: '#444', fontFamily: 'monospace' }}>{zoom}%</span>
      </div>
    </footer>
  );
}