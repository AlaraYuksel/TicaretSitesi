import React from 'react';
import {
  useEditorStore, isContainerType, defaultProps, defaultDimensions,
  BREAKPOINTS, BREAKPOINT_ORDER, getElementBounds, hasBreakpointOverride,
} from '../../store/useEditorStore';

const BP_COLORS = { desktop: '#4b8eff', tablet: '#a855f7', mobile: '#10b981' };

// ─── Field helpers ────────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <span style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>
      {children}
    </span>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 6, color: '#e5e2e1', fontSize: 12, padding: '6px 10px',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

function NumInput({ value, onChange, min, max, step = 1 }) {
  return (
    <input
      type="number" value={value} min={min} max={max} step={step}
      onChange={e => onChange(Number(e.target.value))}
      style={inputStyle}
    />
  );
}

function ColorRow({ label, value, onChange }) {
  return (
    <Row label={label}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="color" value={value ?? '#000000'}
          onChange={e => onChange(e.target.value)}
          style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', padding: 0, borderRadius: 4 }}
        />
        <input
          type="text" value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11 }}
        />
      </div>
    </Row>
  );
}

function AlignRow({ value, onChange }) {
  return (
    <Row label="Text Align">
      <div style={{ display: 'flex', gap: 4 }}>
        {['left', 'center', 'right', 'justify'].map(a => (
          <button
            key={a}
            onClick={() => onChange(a)}
            style={{
              flex: 1, height: 30, border: 'none', borderRadius: 5, cursor: 'pointer',
              background: value === a ? '#4b8eff' : '#1e1e1e',
              color: value === a ? '#fff' : '#666', transition: 'all 0.12s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>format_align_{a}</span>
          </button>
        ))}
      </div>
    </Row>
  );
}

function SectionDivider({ title }) {
  return (
    <div style={{ margin: '20px 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 9, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: 2, whiteSpace: 'nowrap' }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
    </div>
  );
}

// ─── POSITION & SIZE — BREAKPOINT-AWARE ───────────────────────────────────────
function PositionSizeSection({ selected, moveElement, updateElementBounds }) {
  const { activeBreakpoint } = useEditorStore();
  const color = BP_COLORS[activeBreakpoint];
  const bpInfo = BREAKPOINTS[activeBreakpoint];
  const isOverridden = hasBreakpointOverride(selected, activeBreakpoint);
  const bounds = getElementBounds(selected, activeBreakpoint);

  // Determine which breakpoint the value is cascading FROM (if not overridden)
  let cascadeFrom = null;
  if (!isOverridden && activeBreakpoint !== 'desktop') {
    const order = BREAKPOINT_ORDER.slice(0, BREAKPOINT_ORDER.indexOf(activeBreakpoint));
    for (let i = order.length - 1; i >= 0; i--) {
      if (selected.breakpoints?.[order[i]]) { cascadeFrom = order[i]; break; }
    }
  }

  return (
    <>
      <div style={{ margin: '20px 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: 2, whiteSpace: 'nowrap' }}>
          Position & Size
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
        {/* Breakpoint chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: `${color}15`, border: `1px solid ${color}33`,
          borderRadius: 20, padding: '2px 8px',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 10, color }}>{bpInfo.icon}</span>
          <span style={{ fontSize: 8, fontWeight: 800, color, letterSpacing: 1 }}>{bpInfo.label}</span>
        </div>
      </div>

      {/* Cascade notice */}
      {!isOverridden && activeBreakpoint !== 'desktop' && (
        <div style={{
          fontSize: 9, color: '#666', background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 6, padding: '5px 10px', marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 11, color: '#555' }}>link</span>
          <span>
            <b style={{ color: BP_COLORS[cascadeFrom ?? 'desktop'] }}>{BREAKPOINTS[cascadeFrom ?? 'desktop'].label}</b>'dan devralıyor
            {' '}— düzenlemek için değerleri değiştir
          </span>
        </div>
      )}

      {isOverridden && activeBreakpoint !== 'desktop' && (
        <div style={{
          fontSize: 9, color: color, background: `${color}08`,
          border: `1px solid ${color}22`,
          borderRadius: 6, padding: '5px 10px', marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>tune</span>
          {bpInfo.label} için özel konum
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Row label="X">
          <NumInput value={Math.round(bounds.x)} onChange={v => moveElement(selected.id, v, bounds.y)} />
        </Row>
        <Row label="Y">
          <NumInput value={Math.round(bounds.y)} onChange={v => moveElement(selected.id, bounds.x, v)} />
        </Row>
        <Row label="Width">
          <NumInput value={Math.round(bounds.width)} onChange={v => updateElementBounds(selected.id, { width: v })} min={20} />
        </Row>
        <Row label="Height">
          <NumInput value={Math.round(bounds.height)} onChange={v => updateElementBounds(selected.id, { height: v })} min={20} />
        </Row>
      </div>
    </>
  );
}

// ─── TYPOGRAPHY INSPECTOR ─────────────────────────────────────────────────────
function TypographySection({ p, update }) {
  return (
    <>
      <SectionDivider title="Typography" />
      <Row label="Content">
        <textarea
          value={p.text ?? ''}
          onChange={e => update('text', e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
      </Row>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
        {'fontSize' in p && (
          <Row label="Size (px)">
            <NumInput value={p.fontSize ?? 16} onChange={v => update('fontSize', v)} min={8} max={200} />
          </Row>
        )}
        {'color' in p && (
          <Row label="Color">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="color" value={p.color ?? '#fff'} onChange={e => update('color', e.target.value)}
                style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
              <span style={{ fontSize: 10, color: '#777', fontFamily: 'monospace' }}>{p.color}</span>
            </div>
          </Row>
        )}
      </div>
      {'fontWeight' in p && (
        <Row label="Weight">
          <div style={{ display: 'flex', gap: 4, marginTop: 0 }}>
            {[['400', 'Regular'], ['500', 'Medium'], ['600', 'Semi'], ['700', 'Bold'], ['800', 'Extra']].map(([w, l]) => (
              <button key={w} onClick={() => update('fontWeight', w)} style={{
                flex: 1, padding: '5px 0', border: 'none', borderRadius: 5, cursor: 'pointer',
                background: (p.fontWeight ?? '400') === w ? '#4b8eff' : '#1e1e1e',
                color: (p.fontWeight ?? '400') === w ? '#fff' : '#666',
                fontSize: 9, fontWeight: 700, transition: 'all 0.12s',
              }}>{l}</button>
            ))}
          </div>
        </Row>
      )}
      {'align' in p && <div style={{ marginTop: 8 }}><AlignRow value={p.align} onChange={v => update('align', v)} /></div>}
    </>
  );
}

// ─── BUTTON INSPECTOR ─────────────────────────────────────────────────────────
function ButtonSection({ p, update }) {
  return (
    <>
      <SectionDivider title="Button" />
      <Row label="Label">
        <input type="text" value={p.text ?? ''} onChange={e => update('text', e.target.value)} style={inputStyle} />
      </Row>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
        <ColorRow label="Background" value={p.bg} onChange={v => update('bg', v)} />
        <ColorRow label="Text Color" value={p.color} onChange={v => update('color', v)} />
        <Row label="Font Size">
          <NumInput value={p.fontSize ?? 14} onChange={v => update('fontSize', v)} min={8} max={72} />
        </Row>
        <Row label="Radius">
          <NumInput value={p.borderRadius ?? 8} onChange={v => update('borderRadius', v)} min={0} max={100} />
        </Row>
      </div>
    </>
  );
}

// ─── BOX INSPECTOR ───────────────────────────────────────────────────────────
function BoxSection({ p, update }) {
  return (
    <>
      <SectionDivider title="Appearance" />
      <ColorRow label="Background" value={p.bg} onChange={v => update('bg', v)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
        <Row label="Radius">
          <NumInput value={p.borderRadius ?? 0} onChange={v => update('borderRadius', v)} min={0} max={200} />
        </Row>
        {'opacity' in p && (
          <Row label={`Opacity: ${p.opacity ?? 100}%`}>
            <input type="range" min={0} max={100} value={p.opacity ?? 100}
              onChange={e => update('opacity', Number(e.target.value))}
              style={{ width: '100%', accentColor: '#4b8eff', marginTop: 8 }} />
          </Row>
        )}
        <Row label="Border Width">
          <NumInput value={p.borderWidth ?? 0} onChange={v => update('borderWidth', v)} min={0} max={16} />
        </Row>
        <ColorRow label="Border Color" value={p.borderColor ?? '#333333'} onChange={v => update('borderColor', v)} />
      </div>
    </>
  );
}

// ─── IMAGE INSPECTOR ─────────────────────────────────────────────────────────
function ImageSection({ p, update }) {
  return (
    <>
      <SectionDivider title="Image" />
      <Row label="URL">
        <input type="text" value={p.src ?? ''} onChange={e => update('src', e.target.value)}
          placeholder="https://..." style={inputStyle} />
      </Row>
      <Row label="Alt Text">
        <input type="text" value={p.alt ?? ''} onChange={e => update('alt', e.target.value)} style={inputStyle} />
      </Row>
      <Row label="Object Fit">
        <div style={{ display: 'flex', gap: 4 }}>
          {['cover', 'contain', 'fill', 'none'].map(f => (
            <button key={f} onClick={() => update('objectFit', f)} style={{
              flex: 1, padding: '5px 0', border: 'none', borderRadius: 5, cursor: 'pointer',
              background: (p.objectFit ?? 'cover') === f ? '#4b8eff' : '#1e1e1e',
              color: (p.objectFit ?? 'cover') === f ? '#fff' : '#666', fontSize: 9, fontWeight: 700,
            }}>{f}</button>
          ))}
        </div>
      </Row>
      <Row label="Radius">
        <NumInput value={p.borderRadius ?? 8} onChange={v => update('borderRadius', v)} min={0} max={200} />
      </Row>
    </>
  );
}

// ─── ICON INSPECTOR ──────────────────────────────────────────────────────────
const COMMON_ICONS = ['star', 'favorite', 'home', 'settings', 'person', 'check_circle', 'arrow_forward', 'add', 'close', 'search', 'mail', 'phone', 'location_on', 'shopping_cart', 'thumb_up', 'visibility', 'lock', 'share', 'download', 'edit'];

function IconSection({ p, update }) {
  return (
    <>
      <SectionDivider title="Icon" />
      <Row label="Icon Name">
        <input type="text" value={p.name ?? 'star'} onChange={e => update('name', e.target.value)} style={inputStyle} />
      </Row>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 0' }}>
        {COMMON_ICONS.map(icon => (
          <button
            key={icon}
            onClick={() => update('name', icon)}
            title={icon}
            style={{
              width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer',
              background: p.name === icon ? '#4b8eff' : '#1e1e1e',
              color: p.name === icon ? '#fff' : '#888',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
        <Row label="Size">
          <NumInput value={p.size ?? 40} onChange={v => update('size', v)} min={12} max={200} />
        </Row>
        <ColorRow label="Color" value={p.color ?? '#4b8eff'} onChange={v => update('color', v)} />
      </div>
    </>
  );
}

// ─── DIVIDER INSPECTOR ───────────────────────────────────────────────────────
function DividerSection({ p, update }) {
  return (
    <>
      <SectionDivider title="Divider" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <ColorRow label="Color" value={p.color ?? '#2a2a2a'} onChange={v => update('color', v)} />
        <Row label="Thickness">
          <NumInput value={p.thickness ?? 1} onChange={v => update('thickness', v)} min={1} max={20} />
        </Row>
      </div>
      <Row label="Style">
        <div style={{ display: 'flex', gap: 4 }}>
          {['solid', 'dashed', 'dotted'].map(s => (
            <button key={s} onClick={() => update('style', s)} style={{
              flex: 1, padding: '5px 0', border: 'none', borderRadius: 5, cursor: 'pointer',
              background: (p.style ?? 'solid') === s ? '#4b8eff' : '#1e1e1e',
              color: (p.style ?? 'solid') === s ? '#fff' : '#666', fontSize: 10, fontWeight: 700,
            }}>{s}</button>
          ))}
        </div>
      </Row>
    </>
  );
}

// ─── FLEX CONTAINER INSPECTOR ────────────────────────────────────────────────
function FlexContainerSection({ el, p, update, addChild, removeChild, reorderChild }) {
  const children = el.children ?? [];
  const { selectedChildId, updateChildProp } = useEditorStore();
  const selChild = children.find(c => c.id === selectedChildId);

  return (
    <>
      <SectionDivider title="Flex Layout" />

      <Row label="Background">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="color" value={p.bg || '#000001'} onChange={e => update('bg', e.target.value === '#000001' ? 'transparent' : e.target.value)}
            style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
          <button onClick={() => update('bg', 'transparent')} style={{ ...inputStyle, cursor: 'pointer', fontSize: 10, color: '#888', textAlign: 'center', padding: '4px 8px', width: 'auto' }}>transparent</button>
        </div>
      </Row>

      <Row label="Direction">
        <div style={{ display: 'flex', gap: 4 }}>
          {[['row', '→ Row'], ['column', '↓ Col'], ['row-reverse', '← Rev'], ['column-reverse', '↑ Rev']].map(([v, l]) => (
            <button key={v} onClick={() => update('flexDirection', v)} style={{
              flex: 1, padding: '5px 0', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 9,
              background: (p.flexDirection ?? 'row') === v ? '#4b8eff' : '#1e1e1e',
              color: (p.flexDirection ?? 'row') === v ? '#fff' : '#666', fontWeight: 700,
            }}>{l}</button>
          ))}
        </div>
      </Row>

      <Row label="Wrap">
        <div style={{ display: 'flex', gap: 4 }}>
          {[['wrap', 'Wrap'], ['nowrap', 'No Wrap'], ['wrap-reverse', 'Rev']].map(([v, l]) => (
            <button key={v} onClick={() => update('flexWrap', v)} style={{
              flex: 1, padding: '5px 0', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 9,
              background: (p.flexWrap ?? 'wrap') === v ? '#4b8eff' : '#1e1e1e',
              color: (p.flexWrap ?? 'wrap') === v ? '#fff' : '#666', fontWeight: 700,
            }}>{l}</button>
          ))}
        </div>
      </Row>

      <Row label="Align Items">
        <select value={p.alignItems ?? 'center'} onChange={e => update('alignItems', e.target.value)} style={inputStyle}>
          {['flex-start', 'center', 'flex-end', 'stretch', 'baseline'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </Row>

      <Row label="Justify Content">
        <select value={p.justifyContent ?? 'flex-start'} onChange={e => update('justifyContent', e.target.value)} style={inputStyle}>
          {['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </Row>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
        <Row label="Gap">
          <NumInput value={p.gap ?? 16} onChange={v => update('gap', v)} min={0} max={100} />
        </Row>
        <Row label="Padding">
          <NumInput value={p.padding ?? 20} onChange={v => update('padding', v)} min={0} max={100} />
        </Row>
        <Row label="Radius">
          <NumInput value={p.borderRadius ?? 12} onChange={v => update('borderRadius', v)} min={0} max={200} />
        </Row>
      </div>

      <SectionDivider title={`Children (${children.length})`} />
      <ChildrenList containerId={el.id} children={children} />

      {/* Selected child props */}
      {selChild && (
        <>
          <SectionDivider title={`${selChild.name} · ${selChild.type}`} />
          <ChildInspector
            containerId={el.id}
            child={selChild}
            updateChildProp={updateChildProp}
          />
        </>
      )}
    </>
  );
}

// ─── GRID CONTAINER INSPECTOR ─────────────────────────────────────────────────
function GridContainerSection({ el, p, update }) {
  const children = el.children ?? [];
  const { selectedChildId, updateChildProp } = useEditorStore();
  const selChild = children.find(c => c.id === selectedChildId);

  return (
    <>
      <SectionDivider title="Grid Layout" />

      <Row label="Columns">
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <button key={n} onClick={() => update('columns', n)} style={{
              flex: 1, padding: '6px 0', border: 'none', borderRadius: 5, cursor: 'pointer',
              background: (p.columns ?? 3) === n ? '#4b8eff' : '#1e1e1e',
              color: (p.columns ?? 3) === n ? '#fff' : '#666', fontSize: 12, fontWeight: 800,
            }}>{n}</button>
          ))}
        </div>
      </Row>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
        <Row label="Gap">
          <NumInput value={p.gap ?? 16} onChange={v => update('gap', v)} min={0} max={100} />
        </Row>
        <Row label="Padding">
          <NumInput value={p.padding ?? 20} onChange={v => update('padding', v)} min={0} max={100} />
        </Row>
        <Row label="Row Height">
          <NumInput value={p.autoRows ?? 120} onChange={v => update('autoRows', v)} min={40} max={600} />
        </Row>
        <Row label="Radius">
          <NumInput value={p.borderRadius ?? 12} onChange={v => update('borderRadius', v)} min={0} max={200} />
        </Row>
      </div>

      <Row label="Background">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="color" value={p.bg || '#000001'} onChange={e => update('bg', e.target.value)}
            style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
          <button onClick={() => update('bg', 'transparent')} style={{ ...inputStyle, cursor: 'pointer', fontSize: 10, color: '#888', padding: '4px 8px', width: 'auto' }}>transparent</button>
        </div>
      </Row>

      <SectionDivider title={`Children (${children.length})`} />
      <ChildrenList containerId={el.id} children={children} />

      {selChild && (
        <>
          <SectionDivider title={`${selChild.name} · ${selChild.type}`} />
          <ChildInspector containerId={el.id} child={selChild} updateChildProp={updateChildProp} />
        </>
      )}
    </>
  );
}

// ─── SECTION INSPECTOR ───────────────────────────────────────────────────────
function SectionInspectorSection({ el, p, update }) {
  const children = el.children ?? [];
  const { selectedChildId, updateChildProp } = useEditorStore();
  const selChild = children.find(c => c.id === selectedChildId);

  return (
    <>
      <SectionDivider title="Section" />
      <ColorRow label="Background" value={p.bg ?? '#141414'} onChange={v => update('bg', v)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
        <Row label="Padding">
          <NumInput value={p.padding ?? 20} onChange={v => update('padding', v)} min={0} max={200} />
        </Row>
        <Row label="Radius">
          <NumInput value={p.borderRadius ?? 0} onChange={v => update('borderRadius', v)} min={0} max={200} />
        </Row>
        <Row label={`Opacity: ${p.opacity ?? 100}%`}>
          <input type="range" min={0} max={100} value={p.opacity ?? 100}
            onChange={e => update('opacity', Number(e.target.value))}
            style={{ width: '100%', accentColor: '#4b8eff' }} />
        </Row>
      </div>

      <SectionDivider title={`Children (${children.length})`} />
      <ChildrenList containerId={el.id} children={children} />
      {selChild && (
        <>
          <SectionDivider title={`${selChild.name} · ${selChild.type}`} />
          <ChildInspector containerId={el.id} child={selChild} updateChildProp={updateChildProp} />
        </>
      )}
    </>
  );
}

// ─── CHILDREN LIST ───────────────────────────────────────────────────────────
const TYPE_ICON = { heading: 'title', paragraph: 'notes', button: 'smart_button', image: 'image', box: 'check_box_outline_blank', section: 'view_day', divider: 'remove', icon: 'star', flexContainer: 'view_column', gridContainer: 'grid_view' };

function ChildrenList({ containerId, children }) {
  const { selectElement, selectedChildId, deleteChild, duplicateChild, reorderChildren, toggleChildVisibility } = useEditorStore();

  const handleDragStart = (e, idx) => {
    e.dataTransfer.setData('childIdx', String(idx));
    e.stopPropagation();
  };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e, toIdx) => {
    e.preventDefault(); e.stopPropagation();
    const fromIdx = Number(e.dataTransfer.getData('childIdx'));
    if (fromIdx !== toIdx) reorderChildren(containerId, fromIdx, toIdx);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {children.length === 0 && (
        <div style={{ fontSize: 10, color: '#444', padding: '8px 0', textAlign: 'center' }}>
          Boş — elementi sürükle & bırak
        </div>
      )}
      {children.map((child, idx) => (
        <div
          key={child.id}
          draggable
          onDragStart={e => handleDragStart(e, idx)}
          onDragOver={handleDragOver}
          onDrop={e => handleDrop(e, idx)}
          onClick={() => selectElement(containerId, child.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
            background: selectedChildId === child.id ? 'rgba(75,142,255,0.12)' : 'rgba(255,255,255,0.03)',
            border: selectedChildId === child.id ? '1px solid rgba(75,142,255,0.25)' : '1px solid transparent',
            opacity: child.visible === false ? 0.4 : 1,
            transition: 'all 0.12s',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: selectedChildId === child.id ? '#4b8eff' : '#555' }}>
            {TYPE_ICON[child.type] ?? 'widgets'}
          </span>
          <span style={{ flex: 1, fontSize: 11, color: selectedChildId === child.id ? '#e5e2e1' : '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {child.name}
          </span>
          <button onClick={e => { e.stopPropagation(); toggleChildVisibility(containerId, child.id); }} style={smallBtn} title="Gizle/Göster">
            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{child.visible !== false ? 'visibility' : 'visibility_off'}</span>
          </button>
          <button onClick={e => { e.stopPropagation(); duplicateChild(containerId, child.id); }} style={smallBtn} title="Çoğalt">
            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>content_copy</span>
          </button>
          <button onClick={e => { e.stopPropagation(); deleteChild(containerId, child.id); }} style={{ ...smallBtn, color: '#e53e3e' }} title="Sil">
            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>delete</span>
          </button>
        </div>
      ))}
    </div>
  );
}

const smallBtn = {
  background: 'none', border: 'none', color: '#555', cursor: 'pointer',
  padding: 2, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function ChildInspector({ containerId, child, updateChildProp }) {
  const p = child.props;
  const update = (k, v) => updateChildProp(containerId, child.id, k, v);
  const { updateChildBounds, updateChildLinkAction, pages } = useEditorStore();
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
        <Row label="Width"><NumInput value={child.width ?? 160} onChange={v => updateChildBounds(containerId, child.id, v, null)} min={20} /></Row>
        <Row label="Height"><NumInput value={child.height ?? 80} onChange={v => updateChildBounds(containerId, child.id, null, v)} min={20} /></Row>
      </div>
      {'text' in p && child.type !== 'button' && <TypographySection p={p} update={update} />}
      {child.type === 'button' && <ButtonSection p={p} update={update} />}
      {child.type === 'image' && <ImageSection p={p} update={update} />}
      {'bg' in p && !('text' in p) && child.type !== 'image' && child.type !== 'button' && <BoxSection p={p} update={update} />}
      {child.type === 'icon' && <IconSection p={p} update={update} />}
      {child.type === 'divider' && <DividerSection p={p} update={update} />}
      {/* Link action for clickable child types */}
      {CLICKABLE_TYPES.includes(child.type) && (
        <LinkActionSection
          id={child.id}
          linkAction={child.linkAction}
          onUpdate={(la) => updateChildLinkAction(containerId, child.id, la)}
          pages={pages}
        />
      )}
    </div>
  );
}

// ─── CLICKABLE ELEMENT TYPES ─────────────────────────────────────────────────
const CLICKABLE_TYPES = ['button', 'image', 'icon', 'card', 'hero', 'heading', 'paragraph', 'box', 'badge', 'avatar', 'navbar', 'sidebar', 'section', 'flexContainer', 'gridContainer', 'testimonial', 'socialLinks', 'dividerText', 'horizontalScroll'];

// ─── LINK ACTION SECTION ─────────────────────────────────────────────────────
function LinkActionSection({ id, linkAction, onUpdate, pages }) {
  const la = linkAction ?? { type: 'none', target: '' };
  const setField = (key, value) => onUpdate({ ...la, [key]: value });

  const ACTION_TYPES = [
    { value: 'none', label: 'Yok', icon: 'block', desc: 'Tıklama etkisi yok' },
    { value: 'page', label: 'Sayfa', icon: 'web', desc: 'Sayfaya yönlendir' },
    { value: 'url', label: 'URL', icon: 'link', desc: 'Harici bağlantı aç' },
    { value: 'scrollTo', label: 'Kaydır', icon: 'arrow_downward', desc: 'Elemente kaydır' },
  ];

  return (
    <>
      <SectionDivider title="Tıklama Eylemi" />
      {/* Action type buttons */}
      <Row label="Eylem Türü">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
          {ACTION_TYPES.map(at => (
            <button
              key={at.value}
              onClick={() => setField('type', at.value)}
              style={{
                padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer',
                background: la.type === at.value ? 'rgba(75,142,255,0.15)' : '#1e1e1e',
                color: la.type === at.value ? '#4b8eff' : '#666',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                transition: 'all 0.12s',
                outline: la.type === at.value ? '1px solid rgba(75,142,255,0.3)' : '1px solid transparent',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{at.icon}</span>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5 }}>{at.label}</span>
            </button>
          ))}
        </div>
      </Row>

      {/* Action description chip */}
      {la.type !== 'none' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 8,
          background: 'rgba(75,142,255,0.06)',
          border: '1px solid rgba(75,142,255,0.12)',
          marginTop: 4, marginBottom: 4,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#4b8eff' }}>
            {ACTION_TYPES.find(a => a.value === la.type)?.icon}
          </span>
          <span style={{ fontSize: 9, color: '#888' }}>
            {ACTION_TYPES.find(a => a.value === la.type)?.desc}
          </span>
        </div>
      )}

      {/* Page selector */}
      {la.type === 'page' && (
        <Row label="Hedef Sayfa">
          <select
            value={la.target ?? ''}
            onChange={e => setField('target', e.target.value)}
            style={inputStyle}
          >
            <option value="">— Sayfa seçin —</option>
            {pages.map(page => (
              <option key={page.id} value={page.id}>{page.name}</option>
            ))}
          </select>
          {la.target && (
            <div style={{
              marginTop: 4, display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 8px', borderRadius: 6,
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.15)',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 11, color: '#10b981' }}>check_circle</span>
              <span style={{ fontSize: 9, color: '#10b981', fontWeight: 600 }}>
                {pages.find(p => p.id === la.target)?.name ?? 'Bilinmeyen sayfa'}
              </span>
            </div>
          )}
        </Row>
      )}

      {/* URL input */}
      {la.type === 'url' && (
        <>
          <Row label="URL">
            <input
              type="text"
              value={la.target ?? ''}
              onChange={e => setField('target', e.target.value)}
              placeholder="https://..."
              style={inputStyle}
            />
          </Row>
          <Row label="Açılış">
            <div style={{ display: 'flex', gap: 4 }}>
              {[['_self', 'Aynı Sekme'], ['_blank', 'Yeni Sekme']].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setField('openIn', v)}
                  style={{
                    flex: 1, padding: '5px 0', border: 'none', borderRadius: 5, cursor: 'pointer',
                    fontSize: 9, fontWeight: 700,
                    background: (la.openIn ?? '_self') === v ? '#4b8eff' : '#1e1e1e',
                    color: (la.openIn ?? '_self') === v ? '#fff' : '#666',
                  }}
                >{l}</button>
              ))}
            </div>
          </Row>
        </>
      )}

      {/* Scroll to element selector */}
      {la.type === 'scrollTo' && (
        <Row label="Hedef Element ID">
          <input
            type="text"
            value={la.target ?? ''}
            onChange={e => setField('target', e.target.value)}
            placeholder="element-id"
            style={inputStyle}
          />
          <span style={{ fontSize: 8, color: '#555', marginTop: 2 }}>
            Element adını veya ID'sini girin
          </span>
        </Row>
      )}
    </>
  );
}

// ─── MAIN INSPECTOR ───────────────────────────────────────────────────────────
export default function EditorInspector() {
  const {
    getElements, selectedId, selectedChildId,
    updateProp, moveElement, updateElementBounds,
    deleteElement, duplicateElement,
    toggleVisibility, toggleLock,
    bringToFront, sendToBack, bringForward, sendBackward,
    addChildToContainer, deleteChild, reorderChildren,
    renameElement,
    pages, updateLinkAction, updateChildLinkAction,
  } = useEditorStore();

  const elements = getElements();
  const selected = elements.find(el => el.id === selectedId);

  if (!selected) {
    return (
      <aside style={panelStyle}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#333' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 40, marginBottom: 12 }}>ads_click</span>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}>Bir Element Seç</p>
        </div>
      </aside>
    );
  }

  const p = selected.props;
  const update = (k, v) => updateProp(selected.id, k, v);
  const store = useEditorStore.getState();

  return (
    <aside style={panelStyle}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px' }}>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#4b8eff', background: 'rgba(75,142,255,0.1)', padding: '2px 8px', borderRadius: 20, letterSpacing: 1 }}>
              {selected.type.toUpperCase()}
            </span>
            {selected.locked && <span style={{ fontSize: 9, color: '#d97706', background: 'rgba(217,119,6,0.1)', padding: '2px 6px', borderRadius: 20 }}>🔒 KİLİTLİ</span>}
          </div>
          <input value={selected.name} onChange={e => renameElement(selected.id, e.target.value)}
            style={{ background: 'none', border: 'none', color: '#e5e2e1', fontSize: 14, fontWeight: 700, outline: 'none', width: '100%', padding: 0 }} />
        </div>

        {/* Visibility + Lock */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button onClick={() => toggleVisibility(selected.id)} style={{ flex: 1, padding: '7px 0', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, cursor: 'pointer', background: selected.visible ? '#1e1e1e' : 'rgba(229,62,62,0.1)', color: selected.visible ? '#777' : '#e53e3e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, fontWeight: 700 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{selected.visible ? 'visibility' : 'visibility_off'}</span>
            {selected.visible ? 'Görünür' : 'Gizli'}
          </button>
          <button onClick={() => toggleLock(selected.id)} style={{ flex: 1, padding: '7px 0', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, cursor: 'pointer', background: selected.locked ? 'rgba(75,142,255,0.1)' : '#1e1e1e', color: selected.locked ? '#4b8eff' : '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, fontWeight: 700 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>{selected.locked ? 'lock' : 'lock_open'}</span>
            {selected.locked ? 'Kilitli' : 'Serbest'}
          </button>
        </div>

        {/* Layer order */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, marginBottom: 8 }}>
          {[['vertical_align_top', 'Öne', () => bringToFront(selected.id)], ['expand_less', '+1', () => bringForward(selected.id)], ['expand_more', '-1', () => sendBackward(selected.id)], ['vertical_align_bottom', 'Arka', () => sendToBack(selected.id)]].map(([icon, label, action]) => (
            <button key={icon} onClick={action} style={{ border: 'none', borderRadius: 6, cursor: 'pointer', background: '#1e1e1e', color: '#666', padding: '6px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, transition: 'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#2a2a2a'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = '#1e1e1e'; e.currentTarget.style.color = '#666'; }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{icon}</span>
              <span style={{ fontSize: 8, fontWeight: 700 }}>{label}</span>
            </button>
          ))}
        </div>

        <PositionSizeSection selected={selected} moveElement={moveElement} updateElementBounds={updateElementBounds} />
        <SpacingSection id={selected.id} spacing={selected.spacing} updateSpacing={store.updateSpacing} />
        <ResponsiveSection id={selected.id} el={selected} updatePositionMode={store.updatePositionMode} updateOverflow={store.updateOverflow} toggleBreakpointVisibility={store.toggleBreakpointVisibility} />
        <ShadowSection id={selected.id} shadow={selected.shadow} updateShadow={store.updateShadow} />

        {/* Background (box/section/hero) */}
        {('bg' in p || 'gradientEnabled' in p) && !['navbar', 'sidebar', 'card', 'testimonial', 'form', 'accordion', 'tabs'].includes(selected.type) && (
          <BackgroundSection p={p} update={update} />
        )}

        {/* ── Block-specific inspectors ───────────────────────────────── */}
        {selected.type === 'navbar' && <NavbarInspector p={p} update={update} />}
        {selected.type === 'sidebar' && <SidebarInspector p={p} update={update} />}
        {selected.type === 'hero' && <HeroInspector p={p} update={update} />}
        {selected.type === 'card' && <CardInspector p={p} update={update} />}
        {selected.type === 'testimonial' && <TestimonialInspector p={p} update={update} />}
        {selected.type === 'form' && <FormInspector p={p} update={update} />}
        {selected.type === 'accordion' && <AccordionInspector p={p} update={update} />}
        {selected.type === 'tabs' && <TabsInspector p={p} update={update} />}
        {selected.type === 'video' && <VideoInspector p={p} update={update} />}
        {selected.type === 'countdown' && <CountdownInspector p={p} update={update} />}
        {selected.type === 'progressBar' && <ProgressInspector p={p} update={update} />}
        {selected.type === 'socialLinks' && <SocialLinksInspector p={p} update={update} />}
        {selected.type === 'codeBlock' && <CodeBlockInspector p={p} update={update} />}
        {selected.type === 'avatar' && <AvatarInspector p={p} update={update} />}
        {selected.type === 'badge' && <BadgeInspector p={p} update={update} />}
        {selected.type === 'table' && <TableInspector p={p} update={update} />}
        {selected.type === 'horizontalScroll' && <HorizontalScrollInspector p={p} update={update} />}

        {/* ── Existing element inspectors ─────────────────────────────── */}
        {'text' in p && !['button', 'navbar', 'sidebar', 'hero', 'card', 'testimonial', 'form', 'accordion', 'tabs', 'badge', 'dividerText'].includes(selected.type) && (
          <TypographySection p={p} update={update} />
        )}
        {['heading', 'paragraph'].includes(selected.type) && <AdvancedTypographySection p={p} update={update} />}
        {selected.type === 'button' && <ButtonSection p={p} update={update} />}
        {selected.type === 'image' && <ImageSection p={p} update={update} />}
        {selected.type === 'icon' && <IconSection p={p} update={update} />}
        {selected.type === 'divider' && <DividerSection p={p} update={update} />}
        {selected.type === 'box' && <BoxSection p={p} update={update} />}
        {selected.type === 'section' && <SectionInspectorSection el={selected} p={p} update={update} />}
        {selected.type === 'flexContainer' && <FlexContainerSection el={selected} p={p} update={update} />}
        {selected.type === 'gridContainer' && <GridContainerSection el={selected} p={p} update={update} />}

        {/* Link Action — for all clickable element types */}
        {CLICKABLE_TYPES.includes(selected.type) && (
          <LinkActionSection
            id={selected.id}
            linkAction={selected.linkAction}
            onUpdate={(la) => updateLinkAction(selected.id, la)}
            pages={pages}
          />
        )}

        {/* Actions */}
        <SectionDivider title="Actions" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => duplicateElement(selected.id)} style={actionBtn('#1e1e1e', '#888')}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
            Duplicate (Ctrl+D)
          </button>
          <button onClick={() => deleteElement(selected.id)} style={actionBtn('rgba(229,62,62,0.08)', '#e53e3e')}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
            Delete Element
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── SPACING (MARGIN / PADDING BOX-MODEL) ────────────────────────────────────
function SpacingSection({ id, spacing, updateSpacing }) {
  const sp = spacing ?? { margin: { top: 0, right: 0, bottom: 0, left: 0 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } };
  const SpBox = ({ type, label, color }) => {
    const vals = sp[type] ?? { top: 0, right: 0, bottom: 0, left: 0 };
    return (
      <div>
        <Label>{label}</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginTop: 4 }}>
          {['top', 'right', 'bottom', 'left'].map(side => (
            <div key={side} style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
              <span style={{ fontSize: 8, color: '#555', textTransform: 'uppercase' }}>{side[0].toUpperCase()}</span>
              <input type="number" value={vals[side] ?? 0} min={0} max={500}
                onChange={e => updateSpacing(id, side, type, Number(e.target.value))}
                style={{ ...inputStyle, padding: '4px 0', textAlign: 'center', fontSize: 11, borderColor: `${color}33` }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };
  return (
    <>
      <SectionDivider title="Spacing" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SpBox type="margin" label="Margin" color="#f59e0b" />
        <SpBox type="padding" label="Padding" color="#4b8eff" />
      </div>
    </>
  );
}

// ─── SHADOW SECTION ───────────────────────────────────────────────────────────
function ShadowSection({ id, shadow, updateShadow }) {
  const sh = shadow ?? { x: 0, y: 4, blur: 16, spread: 0, color: 'rgba(0,0,0,0.4)', enabled: false };
  const update = (k, v) => updateShadow(id, { ...sh, [k]: v });
  return (
    <>
      <SectionDivider title="Box Shadow" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#888' }}>Shadow</span>
        <button onClick={() => updateShadow(id, { ...sh, enabled: !sh.enabled })}
          style={{
            background: sh.enabled ? '#4b8eff' : '#1e1e1e', border: 'none', borderRadius: 20, padding: '3px 12px',
            color: sh.enabled ? '#fff' : '#555', fontSize: 10, fontWeight: 700, cursor: 'pointer'
          }}>
          {sh.enabled ? 'ON' : 'OFF'}
        </button>
      </div>
      {sh.enabled && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[['x', 'X Offset'], ['y', 'Y Offset'], ['blur', 'Blur'], ['spread', 'Spread']].map(([k, l]) => (
            <Row key={k} label={l}><NumInput value={sh[k] ?? 0} onChange={v => update(k, v)} min={-100} max={100} /></Row>
          ))}
          <div style={{ gridColumn: '1/-1' }}><ColorRow label="Color" value={sh.color ?? 'rgba(0,0,0,0.4)'} onChange={v => update('color', v)} /></div>
        </div>
      )}
    </>
  );
}

// ─── BACKGROUND SECTION ───────────────────────────────────────────────────────
function BackgroundSection({ p, update }) {
  const mode = p.gradientEnabled ? 'gradient' : (p.bgImageUrl ? 'image' : 'solid');
  return (
    <>
      <SectionDivider title="Background" />
      <Row label="Mode">
        <div style={{ display: 'flex', gap: 4 }}>
          {[['solid', 'Solid'], ['gradient', 'Gradient'], ['image', 'Image']].map(([m, l]) => (
            <button key={m} onClick={() => { update('gradientEnabled', m === 'gradient'); if (m !== 'image') update('bgImageUrl', ''); }}
              style={{
                flex: 1, padding: '5px 0', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                background: mode === m ? '#4b8eff' : '#1e1e1e', color: mode === m ? '#fff' : '#666'
              }}>{l}</button>
          ))}
        </div>
      </Row>
      {mode === 'solid' && <ColorRow label="Color" value={p.bg ?? '#141414'} onChange={v => update('bg', v)} />}
      {mode === 'gradient' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <ColorRow label="Start" value={p.gradientStart ?? '#4b8eff'} onChange={v => update('gradientStart', v)} />
            <ColorRow label="End" value={p.gradientEnd ?? '#8b5cf6'} onChange={v => update('gradientEnd', v)} />
          </div>
          <Row label={`Angle: ${p.gradientAngle ?? 135}°`}>
            <input type="range" min={0} max={360} value={p.gradientAngle ?? 135} onChange={e => update('gradientAngle', Number(e.target.value))}
              style={{ width: '100%', accentColor: '#4b8eff' }} />
          </Row>
          <div style={{ height: 32, borderRadius: 8, background: `linear-gradient(${p.gradientAngle ?? 135}deg, ${p.gradientStart ?? '#4b8eff'}, ${p.gradientEnd ?? '#8b5cf6'})` }} />
        </div>
      )}
      {mode === 'image' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Row label="Image URL">
            <input type="text" value={p.bgImageUrl ?? ''} onChange={e => update('bgImageUrl', e.target.value)} placeholder="https://..." style={inputStyle} />
          </Row>
          <Row label={`Overlay: ${p.overlayOpacity ?? 50}%`}>
            <input type="range" min={0} max={100} value={p.overlayOpacity ?? 50} onChange={e => update('overlayOpacity', Number(e.target.value))}
              style={{ width: '100%', accentColor: '#4b8eff' }} />
          </Row>
        </div>
      )}
    </>
  );
}

// ─── RESPONSIVE SECTION ───────────────────────────────────────────────────────
function ResponsiveSection({ id, el, updatePositionMode, updateOverflow, toggleBreakpointVisibility }) {
  const vis = el.visibleBreakpoints ?? { desktop: true, tablet: true, mobile: true };
  const BP_MAP = [['desktop', 'desktop_windows', '#4b8eff'], ['tablet', 'tablet_mac', '#a855f7'], ['mobile', 'smartphone', '#10b981']];
  return (
    <>
      <SectionDivider title="Responsive" />
      <Row label="Visibility per Breakpoint">
        <div style={{ display: 'flex', gap: 6 }}>
          {BP_MAP.map(([bp, icon, color]) => (
            <button key={bp} onClick={() => toggleBreakpointVisibility(id, bp)}
              style={{
                flex: 1, padding: '7px 0', border: 'none', borderRadius: 8, cursor: 'pointer',
                background: vis[bp] ? `${color}18` : '#1e1e1e', color: vis[bp] ? color : '#444',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, transition: 'all 0.15s'
              }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{icon}</span>
              <span style={{ fontSize: 8, fontWeight: 700 }}>{vis[bp] ? 'Görünür' : 'Gizli'}</span>
            </button>
          ))}
        </div>
      </Row>
      <Row label="Position Mode">
        <div style={{ display: 'flex', gap: 4 }}>
          {['absolute', 'fixed', 'sticky'].map(m => (
            <button key={m} onClick={() => updatePositionMode(id, m)}
              style={{
                flex: 1, padding: '5px 0', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                background: (el.positionMode ?? 'absolute') === m ? '#4b8eff' : '#1e1e1e',
                color: (el.positionMode ?? 'absolute') === m ? '#fff' : '#666'
              }}>{m}</button>
          ))}
        </div>
      </Row>
      <Row label="Overflow">
        <div style={{ display: 'flex', gap: 4 }}>
          {['hidden', 'visible', 'auto'].map(m => (
            <button key={m} onClick={() => updateOverflow(id, m)}
              style={{
                flex: 1, padding: '5px 0', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                background: (el.overflow ?? 'hidden') === m ? '#4b8eff' : '#1e1e1e',
                color: (el.overflow ?? 'hidden') === m ? '#fff' : '#666'
              }}>{m}</button>
          ))}
        </div>
      </Row>
    </>
  );
}

// ─── ADVANCED TYPOGRAPHY ──────────────────────────────────────────────────────
const GOOGLE_FONTS = ['Inter', 'Roboto', 'Outfit', 'Poppins', 'Lato', 'Montserrat', 'Playfair Display', 'Merriweather', 'Fira Code', 'Space Grotesk', 'DM Sans', 'Nunito', 'Raleway', 'Oswald', 'Open Sans'];

function AdvancedTypographySection({ p, update }) {
  return (
    <>
      <SectionDivider title="Advanced Typography" />
      <Row label="Font Family">
        <select value={p.fontFamily ?? 'inherit'} onChange={e => update('fontFamily', e.target.value)} style={inputStyle}>
          <option value="inherit">Default</option>
          {GOOGLE_FONTS.map(f => <option key={f} value={`'${f}', sans-serif`}>{f}</option>)}
        </select>
      </Row>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
        <Row label="Line Height">
          <NumInput value={p.lineHeight ?? 1.5} onChange={v => update('lineHeight', v)} min={0.5} max={5} step={0.05} />
        </Row>
        <Row label="Letter Spacing">
          <NumInput value={p.letterSpacing ?? 0} onChange={v => update('letterSpacing', v)} min={-5} max={20} step={0.5} />
        </Row>
      </div>
      <Row label="Decoration">
        <div style={{ display: 'flex', gap: 4 }}>
          {['none', 'underline', 'line-through', 'overline'].map(d => (
            <button key={d} onClick={() => update('textDecoration', d)}
              style={{
                flex: 1, padding: '5px 0', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 8, fontWeight: 700,
                background: (p.textDecoration ?? 'none') === d ? '#4b8eff' : '#1e1e1e',
                color: (p.textDecoration ?? 'none') === d ? '#fff' : '#666'
              }}>{d === 'none' ? '—' : d === 'underline' ? 'U̲' : d === 'line-through' ? 'S̶' : 'Ō'}</button>
          ))}
        </div>
      </Row>
    </>
  );
}

// ─── NAVBAR INSPECTOR ─────────────────────────────────────────────────────────
function NavbarInspector({ p, update }) {
  const links = p.links ?? [];
  const { pages } = useEditorStore();
  return (
    <>
      <SectionDivider title="Navbar" />
      <Row label="Logo Text"><input type="text" value={p.logo ?? 'Brand'} onChange={e => update('logo', e.target.value)} style={inputStyle} /></Row>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Row label="Logo Size"><NumInput value={p.logoFontSize ?? 18} onChange={v => update('logoFontSize', v)} min={10} max={40} /></Row>
        <Row label="Link Size"><NumInput value={p.fontSize ?? 14} onChange={v => update('fontSize', v)} min={10} max={24} /></Row>
        <ColorRow label="Logo Color" value={p.logoColor ?? '#e5e2e1'} onChange={v => update('logoColor', v)} />
        <ColorRow label="Link Color" value={p.linkColor ?? '#e5e2e1'} onChange={v => update('linkColor', v)} />
      </div>
      <ColorRow label="Background" value={p.bg ?? 'rgba(14,14,14,0.85)'} onChange={v => update('bg', v)} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: '#888' }}>Show CTA Button</span>
        <button onClick={() => update('showCta', !p.showCta)}
          style={{ background: p.showCta !== false ? '#4b8eff' : '#1e1e1e', border: 'none', borderRadius: 20, padding: '3px 12px', color: p.showCta !== false ? '#fff' : '#555', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
          {p.showCta !== false ? 'ON' : 'OFF'}
        </button>
      </div>
      {p.showCta !== false && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
          <Row label="CTA Text"><input type="text" value={p.ctaText ?? 'Başla'} onChange={e => update('ctaText', e.target.value)} style={inputStyle} /></Row>
          <ColorRow label="CTA BG" value={p.ctaBg ?? '#4b8eff'} onChange={v => update('ctaBg', v)} />
        </div>
      )}
      <SectionDivider title={`Nav Links (${links.length})`} />
      {links.map((l, i) => (
        <div key={l.id} style={{ background: '#1a1a1a', borderRadius: 8, padding: '8px', marginBottom: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <input value={l.label} onChange={e => update('links', links.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} style={{ ...inputStyle, flex: 1 }} placeholder="Link adı" />
            <button onClick={() => update('links', links.filter((_, j) => j !== i))} style={{ background: 'rgba(229,62,62,0.1)', border: 'none', borderRadius: 6, color: '#e53e3e', cursor: 'pointer', padding: '0 8px', fontSize: 14 }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 11, color: l.targetPageId ? '#10b981' : '#444' }}>web</span>
            <select
              value={l.targetPageId ?? ''}
              onChange={e => update('links', links.map((x, j) => j === i ? { ...x, targetPageId: e.target.value || undefined } : x))}
              style={{ ...inputStyle, flex: 1, fontSize: 10, padding: '4px 6px' }}
            >
              <option value="">— Sayfa seç —</option>
              {pages.map(pg => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
            </select>
          </div>
        </div>
      ))}
      <button onClick={() => update('links', [...links, { id: `l${Date.now()}`, label: 'Link', href: '#' }])}
        style={{ width: '100%', padding: '7px', background: '#1e1e1e', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 7, color: '#666', cursor: 'pointer', fontSize: 11, marginTop: 4 }}>
        + Link Ekle
      </button>
    </>
  );
}

// ─── SIDEBAR INSPECTOR ────────────────────────────────────────────────────────
function SidebarInspector({ p, update }) {
  const links = p.links ?? [];
  const { pages } = useEditorStore();
  return (
    <>
      <SectionDivider title="Sidebar" />
      <Row label="Logo"><input type="text" value={p.logo ?? 'App'} onChange={e => update('logo', e.target.value)} style={inputStyle} /></Row>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <ColorRow label="Background" value={p.bg ?? '#141414'} onChange={v => update('bg', v)} />
        <ColorRow label="Active Accent" value={p.activeAccent ?? '#4b8eff'} onChange={v => update('activeAccent', v)} />
        <ColorRow label="Link Color" value={p.linkColor ?? '#888'} onChange={v => update('linkColor', v)} />
        <ColorRow label="Active Color" value={p.activeLinkColor ?? '#e5e2e1'} onChange={v => update('activeLinkColor', v)} />
      </div>
      <SectionDivider title={`Nav Links (${links.length})`} />
      {links.map((l, i) => (
        <div key={l.id} style={{ background: '#1a1a1a', borderRadius: 8, padding: '8px', marginBottom: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <input value={l.icon ?? ''} placeholder="icon" onChange={e => update('links', links.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))} style={{ ...inputStyle, width: 60, flex: 'none' }} />
            <input value={l.label} onChange={e => update('links', links.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => update('links', links.map((x, j) => j === i ? { ...x, active: !x.active } : x))}
              style={{ background: l.active ? 'rgba(75,142,255,0.15)' : '#1e1e1e', border: 'none', borderRadius: 6, color: l.active ? '#4b8eff' : '#555', cursor: 'pointer', padding: '4px 8px', fontSize: 10 }}>
              {l.active ? '✓' : '○'}
            </button>
            <button onClick={() => update('links', links.filter((_, j) => j !== i))} style={{ background: 'rgba(229,62,62,0.1)', border: 'none', borderRadius: 6, color: '#e53e3e', cursor: 'pointer', padding: '0 8px', fontSize: 14 }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 11, color: l.targetPageId ? '#10b981' : '#444' }}>web</span>
            <select
              value={l.targetPageId ?? ''}
              onChange={e => update('links', links.map((x, j) => j === i ? { ...x, targetPageId: e.target.value || undefined } : x))}
              style={{ ...inputStyle, flex: 1, fontSize: 10, padding: '4px 6px' }}
            >
              <option value="">— Sayfa seç —</option>
              {pages.map(pg => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
            </select>
          </div>
        </div>
      ))}
      <button onClick={() => update('links', [...links, { id: `sl${Date.now()}`, label: 'Item', icon: 'circle', href: '#', active: false }])}
        style={{ width: '100%', padding: '7px', background: '#1e1e1e', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 7, color: '#666', cursor: 'pointer', fontSize: 11, marginTop: 4 }}>
        + Menü Öğesi Ekle
      </button>
    </>
  );
}

// ─── HERO INSPECTOR ───────────────────────────────────────────────────────────
function HeroInspector({ p, update }) {
  return (
    <>
      <SectionDivider title="Hero Content" />
      <Row label="Tag / Badge"><input value={p.tag ?? ''} onChange={e => update('tag', e.target.value)} style={inputStyle} placeholder="NEW" /></Row>
      <Row label="Title (\\n = new line)">
        <textarea value={p.title ?? ''} rows={3} onChange={e => update('title', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
      </Row>
      <Row label="Subtitle">
        <textarea value={p.subtitle ?? ''} rows={2} onChange={e => update('subtitle', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
      </Row>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Row label="Align">
          <div style={{ display: 'flex', gap: 4 }}>
            {['left', 'center'].map(a => (
              <button key={a} onClick={() => update('align', a)}
                style={{
                  flex: 1, padding: '5px 0', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                  background: (p.align ?? 'center') === a ? '#4b8eff' : '#1e1e1e', color: (p.align ?? 'center') === a ? '#fff' : '#666'
                }}>
                {a === 'left' ? '←Left' : '⊙Center'}
              </button>
            ))}
          </div>
        </Row>
        <Row label="CTA Text"><input value={p.ctaText ?? 'Başla'} onChange={e => update('ctaText', e.target.value)} style={inputStyle} /></Row>
        <ColorRow label="Title Color" value={p.titleColor ?? '#e5e2e1'} onChange={v => update('titleColor', v)} />
        <ColorRow label="BG Color" value={p.bg ?? '#0e0e0e'} onChange={v => update('bg', v)} />
        <ColorRow label="CTA Color" value={p.ctaBg ?? '#4b8eff'} onChange={v => update('ctaBg', v)} />
      </div>
      <Row label="Background Image URL"><input value={p.bgImageUrl ?? ''} onChange={e => update('bgImageUrl', e.target.value)} placeholder="https://..." style={inputStyle} /></Row>
    </>
  );
}

// ─── FORM INSPECTOR ───────────────────────────────────────────────────────────
function FormInspector({ p, update }) {
  const fields = p.fields ?? [];
  return (
    <>
      <SectionDivider title="Form Fields" />
      {fields.map((f, i) => (
        <div key={f.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <select value={f.type} onChange={e => update('fields', fields.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} style={{ ...inputStyle, width: 80, flex: 'none', padding: '6px 4px' }}>
            {['text', 'email', 'password', 'tel', 'textarea', 'select'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={f.label} onChange={e => update('fields', fields.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Label" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={() => update('fields', fields.filter((_, j) => j !== i))} style={{ background: 'rgba(229,62,62,0.1)', border: 'none', borderRadius: 6, color: '#e53e3e', cursor: 'pointer', padding: '0 8px', fontSize: 14 }}>✕</button>
        </div>
      ))}
      <button onClick={() => update('fields', [...fields, { id: `f${Date.now()}`, type: 'text', label: 'Yeni Alan', placeholder: '' }])}
        style={{ width: '100%', padding: '7px', background: '#1e1e1e', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 7, color: '#666', cursor: 'pointer', fontSize: 11 }}>
        + Alan Ekle
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <Row label="Submit Text"><input value={p.submitText ?? 'Gönder'} onChange={e => update('submitText', e.target.value)} style={inputStyle} /></Row>
        <ColorRow label="Submit BG" value={p.submitBg ?? '#4b8eff'} onChange={v => update('submitBg', v)} />
        <ColorRow label="Input BG" value={p.inputBg ?? '#1e1e1e'} onChange={v => update('inputBg', v)} />
        <ColorRow label="Label Color" value={p.labelColor ?? '#888'} onChange={v => update('labelColor', v)} />
      </div>
    </>
  );
}

// ─── ACCORDION INSPECTOR ──────────────────────────────────────────────────────
function AccordionInspector({ p, update }) {
  const items = p.items ?? [];
  return (
    <>
      <SectionDivider title="Accordion Items" />
      {items.map((item, i) => (
        <div key={item.id} style={{ background: '#1a1a1a', borderRadius: 8, padding: '10px', marginBottom: 6 }}>
          <input value={item.question} onChange={e => update('items', items.map((x, j) => j === i ? { ...x, question: e.target.value } : x))} placeholder="Soru..." style={{ ...inputStyle, marginBottom: 4 }} />
          <textarea value={item.answer} rows={2} onChange={e => update('items', items.map((x, j) => j === i ? { ...x, answer: e.target.value } : x))} placeholder="Cevap..." style={{ ...inputStyle, resize: 'vertical' }} />
          <button onClick={() => update('items', items.filter((_, j) => j !== i))} style={{ marginTop: 4, background: 'rgba(229,62,62,0.1)', border: 'none', borderRadius: 6, color: '#e53e3e', cursor: 'pointer', padding: '3px 10px', fontSize: 10 }}>Sil</button>
        </div>
      ))}
      <button onClick={() => update('items', [...items, { id: `a${Date.now()}`, question: 'Yeni soru?', answer: 'Cevap burada.' }])}
        style={{ width: '100%', padding: '7px', background: '#1e1e1e', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 7, color: '#666', cursor: 'pointer', fontSize: 11 }}>
        + Soru Ekle
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <ColorRow label="Item BG" value={p.itemBg ?? '#1a1a1a'} onChange={v => update('itemBg', v)} />
        <ColorRow label="Accent" value={p.accentColor ?? '#4b8eff'} onChange={v => update('accentColor', v)} />
      </div>
    </>
  );
}

// ─── TABS INSPECTOR ───────────────────────────────────────────────────────────
function TabsInspector({ p, update }) {
  const tabs = p.tabs ?? [];
  return (
    <>
      <SectionDivider title="Tabs" />
      {tabs.map((t, i) => (
        <div key={t.id} style={{ background: '#1a1a1a', borderRadius: 8, padding: '10px', marginBottom: 6 }}>
          <input value={t.label} onChange={e => update('tabs', tabs.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Tab ismi..." style={{ ...inputStyle, marginBottom: 4 }} />
          <textarea value={t.content} rows={2} onChange={e => update('tabs', tabs.map((x, j) => j === i ? { ...x, content: e.target.value } : x))} placeholder="İçerik..." style={{ ...inputStyle, resize: 'vertical' }} />
          <button onClick={() => update('tabs', tabs.filter((_, j) => j !== i))} style={{ marginTop: 4, background: 'rgba(229,62,62,0.1)', border: 'none', borderRadius: 6, color: '#e53e3e', cursor: 'pointer', padding: '3px 10px', fontSize: 10 }}>Sil</button>
        </div>
      ))}
      <button onClick={() => update('tabs', [...tabs, { id: `t${Date.now()}`, label: 'Yeni Sekme', content: 'İçerik...' }])}
        style={{ width: '100%', padding: '7px', background: '#1e1e1e', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 7, color: '#666', cursor: 'pointer', fontSize: 11 }}>
        + Sekme Ekle
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <ColorRow label="Active Color" value={p.activeColor ?? '#4b8eff'} onChange={v => update('activeColor', v)} />
        <ColorRow label="Content BG" value={p.contentBg ?? '#1a1a1a'} onChange={v => update('contentBg', v)} />
      </div>
    </>
  );
}

// ─── CARD INSPECTOR ───────────────────────────────────────────────────────────
function CardInspector({ p, update }) {
  return (
    <>
      <SectionDivider title="Card Content" />
      <Row label="Tag"><input value={p.tag ?? ''} onChange={e => update('tag', e.target.value)} style={inputStyle} /></Row>
      <Row label="Title"><input value={p.title ?? ''} onChange={e => update('title', e.target.value)} style={inputStyle} /></Row>
      <Row label="Excerpt"><textarea value={p.excerpt ?? ''} rows={2} onChange={e => update('excerpt', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} /></Row>
      <Row label="CTA Text"><input value={p.ctaText ?? 'Devamını Oku'} onChange={e => update('ctaText', e.target.value)} style={inputStyle} /></Row>
      <Row label="Read Time"><input value={p.readTime ?? ''} onChange={e => update('readTime', e.target.value)} style={inputStyle} /></Row>
      <Row label="Image URL"><input value={p.imageSrc ?? ''} onChange={e => update('imageSrc', e.target.value)} placeholder="https://..." style={inputStyle} /></Row>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
        <ColorRow label="BG" value={p.bg ?? '#1a1a1a'} onChange={v => update('bg', v)} />
        <ColorRow label="Tag Color" value={p.tagColor ?? '#4b8eff'} onChange={v => update('tagColor', v)} />
        <Row label="Radius"><NumInput value={p.borderRadius ?? 16} onChange={v => update('borderRadius', v)} min={0} max={40} /></Row>
      </div>
    </>
  );
}

// ─── TESTIMONIAL INSPECTOR ────────────────────────────────────────────────────
function TestimonialInspector({ p, update }) {
  return (
    <>
      <SectionDivider title="Testimonial" />
      <Row label="Quote"><textarea value={p.quote ?? ''} rows={3} onChange={e => update('quote', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} /></Row>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Row label="Name"><input value={p.name ?? ''} onChange={e => update('name', e.target.value)} style={inputStyle} /></Row>
        <Row label="Role"><input value={p.role ?? ''} onChange={e => update('role', e.target.value)} style={inputStyle} /></Row>
        <Row label="Company"><input value={p.company ?? ''} onChange={e => update('company', e.target.value)} style={inputStyle} /></Row>
        <Row label={`Stars: ${p.rating ?? 5}`}><input type="range" min={1} max={5} value={p.rating ?? 5} onChange={e => update('rating', Number(e.target.value))} style={{ width: '100%', accentColor: '#f59e0b' }} /></Row>
        <ColorRow label="BG" value={p.bg ?? '#1a1a1a'} onChange={v => update('bg', v)} />
        <ColorRow label="Stars" value={p.starColor ?? '#f59e0b'} onChange={v => update('starColor', v)} />
      </div>
      <Row label="Avatar URL"><input value={p.avatarUrl ?? ''} onChange={e => update('avatarUrl', e.target.value)} placeholder="https://..." style={inputStyle} /></Row>
    </>
  );
}

// ─── PROGRESS / BADGE / SOCIAL / COUNTDOWN / TABLE / VIDEO ───────────────────
function ProgressInspector({ p, update }) {
  return (
    <>
      <SectionDivider title="Progress Bar" />
      <Row label="Label"><input value={p.label ?? 'Tamamlanma'} onChange={e => update('label', e.target.value)} style={inputStyle} /></Row>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Row label={`Value: ${p.value ?? 75}`}><input type="range" min={0} max={p.max ?? 100} value={p.value ?? 75} onChange={e => update('value', Number(e.target.value))} style={{ width: '100%', accentColor: '#4b8eff' }} /></Row>
        <Row label="Max"><NumInput value={p.max ?? 100} onChange={v => update('max', v)} min={1} /></Row>
        <Row label="Height"><NumInput value={p.height ?? 10} onChange={v => update('height', v)} min={2} max={40} /></Row>
        <ColorRow label="Fill" value={p.fillBg ?? '#4b8eff'} onChange={v => update('fillBg', v)} />
      </div>
    </>
  );
}

function VideoInspector({ p, update }) {
  const urlType = (url) => {
    if (!url) return null;
    if (/youtube\.com|youtu\.be/.test(url)) return { label: 'YouTube', color: '#ff4444', icon: '▶' };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { label: 'Direkt Video', color: '#10b981', icon: '▶' };
    if (/embed/.test(url)) return { label: 'Embed URL', color: '#4b8eff', icon: '▶' };
    return { label: 'Bilinmeyen', color: '#888', icon: '?' };
  };
  const detected = urlType(p.url);
  return (
    <>
      <SectionDivider title="Video" />
      <Row label="URL">
        <input
          value={p.url ?? ''}
          onChange={e => update('url', e.target.value)}
          placeholder="YouTube, Vimeo veya embed URL..."
          style={inputStyle}
        />
      </Row>
      {detected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: -2, padding: '5px 8px', background: `${detected.color}10`, borderRadius: 6, border: `1px solid ${detected.color}22` }}>
          <span style={{ fontSize: 10, color: detected.color, fontWeight: 700 }}>{detected.icon} {detected.label} algılandı</span>
          <span style={{ fontSize: 9, color: '#555', marginLeft: 'auto' }}>Otomatik embed</span>
        </div>
      )}
      {!p.url && (
        <div style={{ background: '#1a1a1a', borderRadius: 8, padding: '10px', marginTop: 4 }}>
          <p style={{ fontSize: 10, color: '#555', marginBottom: 6, fontWeight: 600 }}>Desteklenen formatlar:</p>
          {[
            ['YouTube', 'youtube.com/watch?v=... veya youtu.be/...'],
            ['Embed', 'youtube.com/embed/VIDEO_ID'],
            ['Direkt', '.mp4, .webm dosya URL\'leri'],
          ].map(([type, hint]) => (
            <div key={type} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: '#4b8eff', fontWeight: 700, minWidth: 50 }}>{type}</span>
              <span style={{ fontSize: 9, color: '#444' }}>{hint}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <Row label="Radius"><NumInput value={p.borderRadius ?? 12} onChange={v => update('borderRadius', v)} min={0} max={40} /></Row>
        <Row label="Aspect">
          <select value={p.aspectRatio ?? '16/9'} onChange={e => update('aspectRatio', e.target.value)} style={inputStyle}>
            {['16/9', '4/3', '1/1', '9/16', '21/9'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Row>
      </div>
    </>
  );
}

function CountdownInspector({ p, update }) {
  return (
    <>
      <SectionDivider title="Countdown" />
      <Row label="Target Date"><input type="date" value={p.targetDate ?? ''} onChange={e => update('targetDate', e.target.value)} style={inputStyle} /></Row>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Row label="Number Size"><NumInput value={p.numFontSize ?? 48} onChange={v => update('numFontSize', v)} min={20} max={100} /></Row>
        <ColorRow label="Number Color" value={p.numColor ?? '#e5e2e1'} onChange={v => update('numColor', v)} />
        <ColorRow label="Label Color" value={p.labelColor ?? '#666'} onChange={v => update('labelColor', v)} />
        <ColorRow label="Block BG" value={p.bg ?? '#1a1a1a'} onChange={v => update('bg', v)} />
      </div>
    </>
  );
}

function SocialLinksInspector({ p, update }) {
  const links = p.links ?? [];
  const PLATFORMS = ['twitter', 'instagram', 'linkedin', 'github', 'youtube', 'facebook', 'tiktok'];
  return (
    <>
      <SectionDivider title="Social Links" />
      {links.map((l, i) => (
        <div key={l.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
          <select value={l.platform} onChange={e => update('links', links.map((x, j) => j === i ? { ...x, platform: e.target.value } : x))} style={{ ...inputStyle, flex: 1, padding: '6px 4px' }}>
            {PLATFORMS.map(pl => <option key={pl} value={pl}>{pl}</option>)}
          </select>
          <input value={l.url} onChange={e => update('links', links.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="URL" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={() => update('links', links.filter((_, j) => j !== i))} style={{ background: 'rgba(229,62,62,0.1)', border: 'none', borderRadius: 6, color: '#e53e3e', cursor: 'pointer', padding: '0 8px', fontSize: 14 }}>✕</button>
        </div>
      ))}
      <button onClick={() => update('links', [...links, { id: `s${Date.now()}`, platform: 'twitter', url: '#' }])}
        style={{ width: '100%', padding: '7px', background: '#1e1e1e', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 7, color: '#666', cursor: 'pointer', fontSize: 11 }}>
        + Platform Ekle
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <Row label="Icon Size"><NumInput value={p.size ?? 40} onChange={v => update('size', v)} min={24} max={80} /></Row>
        <Row label="Gap"><NumInput value={p.gap ?? 12} onChange={v => update('gap', v)} min={0} max={40} /></Row>
        <ColorRow label="Icon Color" value={p.iconColor ?? '#e5e2e1'} onChange={v => update('iconColor', v)} />
        <ColorRow label="BG" value={p.bg ?? 'rgba(255,255,255,0.05)'} onChange={v => update('bg', v)} />
      </div>
    </>
  );
}

function CodeBlockInspector({ p, update }) {
  return (
    <>
      <SectionDivider title="Code Block" />
      <Row label="Language">
        <select value={p.language ?? 'javascript'} onChange={e => update('language', e.target.value)} style={inputStyle}>
          {['javascript', 'typescript', 'python', 'html', 'css', 'json', 'bash', 'sql', 'rust', 'go'].map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </Row>
      <Row label="Code">
        <textarea value={p.code ?? ''} rows={6} onChange={e => update('code', e.target.value)} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }} />
      </Row>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Row label="Font Size"><NumInput value={p.fontSize ?? 13} onChange={v => update('fontSize', v)} min={8} max={20} /></Row>
        <ColorRow label="BG" value={p.bg ?? '#0d1117'} onChange={v => update('bg', v)} />
      </div>
    </>
  );
}

function AvatarInspector({ p, update }) {
  return (
    <>
      <SectionDivider title="Avatar" />
      <Row label="Image URL"><input value={p.src ?? ''} onChange={e => update('src', e.target.value)} placeholder="https://..." style={inputStyle} /></Row>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Row label="Name"><input value={p.name ?? ''} onChange={e => update('name', e.target.value)} style={inputStyle} /></Row>
        <Row label="Role"><input value={p.role ?? ''} onChange={e => update('role', e.target.value)} style={inputStyle} /></Row>
        <Row label="Size"><NumInput value={p.size ?? 80} onChange={v => update('size', v)} min={32} max={200} /></Row>
        <Row label="Radius"><NumInput value={p.borderRadius ?? 99} onChange={v => update('borderRadius', v)} min={0} max={100} /></Row>
        <ColorRow label="Name Color" value={p.nameColor ?? '#e5e2e1'} onChange={v => update('nameColor', v)} />
        <ColorRow label="Role Color" value={p.roleColor ?? '#9ca3af'} onChange={v => update('roleColor', v)} />
      </div>
    </>
  );
}

function BadgeInspector({ p, update }) {
  return (
    <>
      <SectionDivider title="Badge" />
      <Row label="Text"><input value={p.text ?? 'NEW'} onChange={e => update('text', e.target.value)} style={inputStyle} /></Row>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <ColorRow label="BG" value={p.bg ?? '#4b8eff'} onChange={v => update('bg', v)} />
        <ColorRow label="Color" value={p.color ?? '#fff'} onChange={v => update('color', v)} />
        <Row label="Font Size"><NumInput value={p.fontSize ?? 11} onChange={v => update('fontSize', v)} min={8} max={24} /></Row>
        <Row label="Radius"><NumInput value={p.borderRadius ?? 99} onChange={v => update('borderRadius', v)} min={0} max={50} /></Row>
        <Row label="Padding X"><NumInput value={p.paddingX ?? 12} onChange={v => update('paddingX', v)} min={0} max={40} /></Row>
        <Row label="Padding Y"><NumInput value={p.paddingY ?? 5} onChange={v => update('paddingY', v)} min={0} max={20} /></Row>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: '#888' }}>Uppercase</span>
        <button onClick={() => update('uppercase', !p.uppercase)}
          style={{ background: p.uppercase ? '#4b8eff' : '#1e1e1e', border: 'none', borderRadius: 20, padding: '3px 12px', color: p.uppercase ? '#fff' : '#555', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
          {p.uppercase ? 'ON' : 'OFF'}
        </button>
      </div>
    </>
  );
}

// ─── TABLE INSPECTOR ────────────────────────────────────────────────
function TableInspector({ p, update }) {
  const headers = p.headers ?? [];
  const rows = p.rows ?? [];
  const colCount = headers.length || 3;
  return (
    <>
      <SectionDivider title="Table" />
      <Row label="Column Headers">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {headers.map((h, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: '#555', minWidth: 16 }}>{i + 1}</span>
              <input value={h} onChange={e => update('headers', headers.map((x, j) => j === i ? e.target.value : x))}
                style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => update('headers', headers.filter((_, j) => j !== i))}
                style={{ background: 'rgba(229,62,62,0.1)', border: 'none', borderRadius: 6, color: '#e53e3e', cursor: 'pointer', padding: '0 8px', fontSize: 14 }}>✕</button>
            </div>
          ))}
          <button onClick={() => update('headers', [...headers, `Sütun ${headers.length + 1}`])}
            style={{ width: '100%', padding: '6px', background: '#1e1e1e', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 7, color: '#666', cursor: 'pointer', fontSize: 11 }}>
            + Sütun Ekle
          </button>
        </div>
      </Row>
      <SectionDivider title={`Rows (${rows.length})`} />
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: '#555', minWidth: 16 }}>{ri + 1}</span>
          {row.map((cell, ci) => (
            <input key={ci} value={cell}
              onChange={e => update('rows', rows.map((r2, ri2) => ri2 === ri ? r2.map((c, ci2) => ci2 === ci ? e.target.value : c) : r2))}
              style={{ ...inputStyle, flex: 1, padding: '4px 6px', fontSize: 11 }} />
          ))}
          <button onClick={() => update('rows', rows.filter((_, j) => j !== ri))}
            style={{ background: 'rgba(229,62,62,0.1)', border: 'none', borderRadius: 6, color: '#e53e3e', cursor: 'pointer', padding: '0 8px', fontSize: 14 }}>✕</button>
        </div>
      ))}
      <button onClick={() => update('rows', [...rows, Array(colCount).fill('')])}
        style={{ width: '100%', padding: '7px', background: '#1e1e1e', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 7, color: '#666', cursor: 'pointer', fontSize: 11, marginTop: 4 }}>
        + Satır Ekle
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <ColorRow label="Header BG" value={p.headerBg ?? '#1e1e1e'} onChange={v => update('headerBg', v)} />
        <ColorRow label="Header Color" value={p.headerColor ?? '#e5e2e1'} onChange={v => update('headerColor', v)} />
        <ColorRow label="Row BG" value={p.rowBg ?? '#141414'} onChange={v => update('rowBg', v)} />
        <ColorRow label="Alt Row BG" value={p.altRowBg ?? '#1a1a1a'} onChange={v => update('altRowBg', v)} />
        <Row label="Font Size"><NumInput value={p.fontSize ?? 13} onChange={v => update('fontSize', v)} min={8} max={24} /></Row>
        <Row label="Radius"><NumInput value={p.borderRadius ?? 10} onChange={v => update('borderRadius', v)} min={0} max={40} /></Row>
      </div>
    </>
  );
}

// ─── HORIZONTAL SCROLL INSPECTOR ──────────────────────────────────────
function HorizontalScrollInspector({ p, update }) {
  const items = p.items ?? [];
  return (
    <>
      <SectionDivider title="Horizontal Scroll" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Row label="Item Width">
          <NumInput value={p.itemWidth ?? 220} onChange={v => update('itemWidth', v)} min={100} max={600} />
        </Row>
        <Row label="Item Height">
          <NumInput value={p.itemHeight ?? 200} onChange={v => update('itemHeight', v)} min={60} max={600} />
        </Row>
        <Row label="Gap">
          <NumInput value={p.gap ?? 16} onChange={v => update('gap', v)} min={0} max={60} />
        </Row>
        <Row label="Padding">
          <NumInput value={p.padding ?? 16} onChange={v => update('padding', v)} min={0} max={60} />
        </Row>
        <Row label="Radius">
          <NumInput value={p.borderRadius ?? 12} onChange={v => update('borderRadius', v)} min={0} max={40} />
        </Row>
        <ColorRow label="Background" value={p.bg ?? '#141414'} onChange={v => update('bg', v)} />
        <ColorRow label="Arrow Color" value={p.arrowColor ?? '#4b8eff'} onChange={v => update('arrowColor', v)} />
        <ColorRow label="Title Color" value={p.titleColor ?? '#e5e2e1'} onChange={v => update('titleColor', v)} />
        <ColorRow label="Desc Color" value={p.descColor ?? '#9ca3af'} onChange={v => update('descColor', v)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: '#888' }}>Show Arrows</span>
        <button onClick={() => update('showArrows', p.showArrows === false)}
          style={{ background: p.showArrows !== false ? '#4b8eff' : '#1e1e1e', border: 'none', borderRadius: 20, padding: '3px 12px', color: p.showArrows !== false ? '#fff' : '#555', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
          {p.showArrows !== false ? 'ON' : 'OFF'}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: '#888' }}>Snap to Item</span>
        <button onClick={() => update('snapToItem', p.snapToItem === false)}
          style={{ background: p.snapToItem !== false ? '#4b8eff' : '#1e1e1e', border: 'none', borderRadius: 20, padding: '3px 12px', color: p.snapToItem !== false ? '#fff' : '#555', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
          {p.snapToItem !== false ? 'ON' : 'OFF'}
        </button>
      </div>
      <SectionDivider title={`Items (${items.length})`} />
      {items.map((item, i) => (
        <div key={item.id} style={{ background: '#1a1a1a', borderRadius: 8, padding: '10px', marginBottom: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <Row label="Başlık">
              <input value={item.title} onChange={e => update('items', items.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                style={inputStyle} />
            </Row>
            <Row label="Arka Plan">
              <input type="color" value={item.bg ?? '#1a1a1a'}
                onChange={e => update('items', items.map((x, j) => j === i ? { ...x, bg: e.target.value } : x))}
                style={{ width: '100%', height: 32, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
            </Row>
          </div>
          <Row label="Açıklama">
            <input value={item.desc} onChange={e => update('items', items.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))}
              style={inputStyle} />
          </Row>
          <button onClick={() => update('items', items.filter((_, j) => j !== i))}
            style={{ marginTop: 6, background: 'rgba(229,62,62,0.08)', border: 'none', borderRadius: 6, color: '#e53e3e', cursor: 'pointer', padding: '3px 10px', fontSize: 10 }}>Sil</button>
        </div>
      ))}
      <button onClick={() => update('items', [...items, { id: `hs${Date.now()}`, title: `Kart ${items.length + 1}`, desc: 'Açıklama metni', bg: '#1a1a1a' }])}
        style={{ width: '100%', padding: '7px', background: '#1e1e1e', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 7, color: '#666', cursor: 'pointer', fontSize: 11 }}>
        + Öğe Ekle
      </button>
    </>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const panelStyle = {
  position: 'fixed', right: 0, top: 64,
  height: 'calc(100vh - 64px)', width: 300,
  background: '#141414', borderLeft: '1px solid rgba(255,255,255,0.05)',
  zIndex: 40, display: 'flex', flexDirection: 'column', overflow: 'hidden',
};

const actionBtn = (bg, color) => ({
  width: '100%', padding: '9px 0', border: `1px solid ${color}22`,
  borderRadius: 8, cursor: 'pointer', background: bg, color,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 8, fontSize: 11, fontWeight: 700, transition: 'all 0.12s',
});