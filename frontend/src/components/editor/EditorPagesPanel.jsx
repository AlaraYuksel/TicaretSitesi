import React, { useState, useRef } from 'react';
import { useEditorStore } from '../../store/useEditorStore';

function PageThumbnail({ page, isActive }) {
  const elCount = page.elements?.length ?? 0;
  return (
    <div style={{
      width: '100%', aspectRatio: '16/9',
      background: page.backgroundColor ?? '#181818',
      borderRadius: 6,
      border: isActive ? '2px solid #4b8eff' : '1.5px solid rgba(255,255,255,0.05)',
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'border-color 0.15s',
    }}>
      {/* Mini element previews */}
      {page.elements?.slice(0, 6).map((el, i) => (
        <div key={el.id} style={{
          position: 'absolute',
          left: `${(el.x / 1440) * 100}%`,
          top:  `${(el.y / 900)  * 100}%`,
          width: `${(el.width / 1440) * 100}%`,
          height: `${(el.height / 900) * 100}%`,
          background: el.type === 'button' ? (el.props?.bg ?? '#4b8eff')
            : el.type === 'image' ? '#2a2a2a'
            : el.type === 'box'   ? (el.props?.bg ?? '#1c1b1b')
            : el.type === 'heading' || el.type === 'paragraph' ? 'rgba(255,255,255,0.15)'
            : 'rgba(255,255,255,0.05)',
          borderRadius: 1,
          opacity: 0.8,
        }} />
      ))}

      {elCount === 0 && (
        <span style={{ color: '#333', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>BOŞ</span>
      )}

      {isActive && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          width: 6, height: 6, borderRadius: '50%', background: '#4b8eff',
        }} />
      )}
    </div>
  );
}

function PageRow({ page, index, isActive, total }) {
  const {
    switchPage, renamePage, deletePage, duplicatePage, reorderPages, setPageBackground,
  } = useEditorStore();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(page.name);
  const [dragOver, setDragOver] = useState(null);
  const inputRef = useRef(null);
  const colorInputRef = useRef(null);

  const commitRename = () => {
    renamePage(page.id, draft.trim() || page.name);
    setEditing(false);
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('pageIndex', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOver(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const fromIdx = Number(e.dataTransfer.getData('pageIndex'));
    const rect = e.currentTarget.getBoundingClientRect();
    let toIdx = e.clientY < rect.top + rect.height / 2 ? index : index + 1;
    if (fromIdx < toIdx) toIdx -= 1;
    setDragOver(null);
    if (fromIdx !== toIdx) reorderPages(fromIdx, toIdx);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(null)}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {dragOver === 'above' && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: '#4b8eff', zIndex: 10 }} />}

      <div
        onClick={() => switchPage(page.id)}
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          cursor: 'pointer',
          background: isActive ? 'rgba(75,142,255,0.1)' : 'transparent',
          border: isActive ? '1px solid rgba(75,142,255,0.25)' : '1px solid transparent',
          transition: 'all 0.15s',
          userSelect: 'none',
        }}
        className="group"
      >
        {/* Page number + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            width: 20, height: 20, borderRadius: 4, flexShrink: 0,
            background: isActive ? '#4b8eff' : '#2a2a2a',
            color: isActive ? '#fff' : '#666',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 800,
          }}>{index + 1}</span>

          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditing(false);
                e.stopPropagation();
              }}
              onClick={e => e.stopPropagation()}
              autoFocus
              style={{
                flex: 1, background: '#222', border: '1px solid #4b8eff',
                color: '#fff', borderRadius: 4, padding: '2px 6px',
                fontSize: 12, outline: 'none',
              }}
            />
          ) : (
            <span
              onDoubleClick={e => {
                e.stopPropagation();
                setDraft(page.name);
                setEditing(true);
              }}
              style={{
                flex: 1, fontSize: 12, fontWeight: isActive ? 700 : 500,
                color: isActive ? '#e5e2e1' : '#9ca3af',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >{page.name}</span>
          )}

          {/* Actions */}
          <div
            style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.15s' }}
            className="group-hover:opacity-100"
            onClick={e => e.stopPropagation()}
          >
            {/* Background color picker */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => colorInputRef.current?.click()}
                title="Arka plan rengi"
                style={{
                  ...pageActionBtn,
                  background: page.backgroundColor ?? '#0e0e0e',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  overflow: 'hidden',
                }}
              >
                <input
                  ref={colorInputRef}
                  type="color"
                  value={page.backgroundColor ?? '#0e0e0e'}
                  onChange={e => setPageBackground(page.id, e.target.value)}
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', inset: 0, opacity: 0,
                    width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0,
                  }}
                />
              </button>
            </div>
            <button
              onClick={() => duplicatePage(page.id)}
              title="Çoğalt"
              style={pageActionBtn}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>content_copy</span>
            </button>
            {total > 1 && (
              <button
                onClick={() => deletePage(page.id)}
                title="Sil"
                style={{ ...pageActionBtn, color: '#e53e3e' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>delete</span>
              </button>
            )}
          </div>
        </div>

        {/* Thumbnail */}
        <PageThumbnail page={page} isActive={isActive} />

        {/* Meta */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 9, color: '#555' }}>{page.elements?.length ?? 0} element</span>
          <span style={{ fontSize: 9, color: '#444', fontFamily: 'monospace' }}>{page.id.slice(-4)}</span>
        </div>
      </div>

      {dragOver === 'below' && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: '#4b8eff', zIndex: 10 }} />}
    </div>
  );
}

const pageActionBtn = {
  background: 'rgba(255,255,255,0.06)', border: 'none',
  color: '#777', borderRadius: 4, width: 22, height: 22,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', padding: 0,
};

export default function EditorPagesPanel() {
  const { pages, activePageId, addPage, isPagesPanelOpen } = useEditorStore();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  if (!isPagesPanelOpen) return null;

  const handleAdd = () => {
    if (!adding) { setAdding(true); setNewName(''); return; }
    addPage(newName.trim() || `Page ${pages.length + 1}`);
    setAdding(false);
    setNewName('');
  };

  return (
    <aside style={{
      position: 'fixed', left: 80, top: 64,
      height: 'calc(100vh - 64px)', width: 256,
      background: '#141414', borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column', zIndex: 30,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h2 style={{ fontSize: 11, fontWeight: 800, color: '#e5e2e1', textTransform: 'uppercase', letterSpacing: 2, margin: 0 }}>Pages</h2>
          <p style={{ fontSize: 9, color: '#555', marginTop: 2 }}>{pages.length} sayfa · Çift tıkla → yeniden adlandır</p>
        </div>
        <button
          onClick={handleAdd}
          style={{
            background: '#4b8eff', border: 'none', color: '#fff',
            borderRadius: 6, width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Sayfa Ekle"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
        </button>
      </div>

      {/* Add page form */}
      {adding && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setAdding(false);
              e.stopPropagation();
            }}
            placeholder="Sayfa adı..."
            style={{
              width: '100%', background: '#222', border: '1px solid #4b8eff',
              color: '#fff', borderRadius: 6, padding: '6px 10px',
              fontSize: 12, outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button
              onClick={handleAdd}
              style={{
                flex: 1, background: '#4b8eff', border: 'none', color: '#fff',
                borderRadius: 6, padding: '5px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >Ekle</button>
            <button
              onClick={() => setAdding(false)}
              style={{
                flex: 1, background: '#222', border: 'none', color: '#888',
                borderRadius: 6, padding: '5px 0', fontSize: 11, cursor: 'pointer',
              }}
            >İptal</button>
          </div>
        </div>
      )}

      {/* Page list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {pages.map((page, idx) => (
          <PageRow
            key={page.id}
            page={page}
            index={idx}
            isActive={page.id === activePageId}
            total={pages.length}
          />
        ))}
      </div>

      {/* Footer stats */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 9, color: '#444' }}>
          Toplam {pages.reduce((s, p) => s + (p.elements?.length ?? 0), 0)} element
        </span>
        <button
          onClick={() => addPage()}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.08)',
            color: '#666', borderRadius: 6, padding: '4px 10px', fontSize: 10,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>add</span>
          Sayfa Ekle
        </button>
      </div>
    </aside>
  );
}