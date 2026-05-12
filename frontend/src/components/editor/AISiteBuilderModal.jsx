import React, { useEffect, useRef, useState } from 'react';
import { apiAIPlanSite, apiAIExecutePlan } from '../../lib/api';
import { useEditorStore } from '../../store/useEditorStore';

const STYLES = [
  { key: 'modern',    label: 'Modern' },
  { key: 'minimal',   label: 'Minimal' },
  { key: 'colorful',  label: 'Renkli' },
  { key: 'corporate', label: 'Kurumsal' },
];

// State akışı:
// idle → planning → reviewing → executing → done | error
export default function AISiteBuilderModal({ siteId, onClose }) {
  const loadSiteData = useEditorStore(s => s.loadSiteData);
  const [stage, setStage] = useState('idle');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('modern');
  const [plan, setPlan] = useState(null);
  const [planId, setPlanId] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const cancelRef = useRef(null);
  const logRef = useRef(null);

  useEffect(() => {
    // Stream log alanını her güncellemede en alta scroll et
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  useEffect(() => () => { if (cancelRef.current) cancelRef.current(); }, []);

  async function handleGeneratePlan() {
    if (!prompt.trim()) return;
    setStage('planning');
    setError(null);
    try {
      const res = await apiAIPlanSite(siteId, prompt.trim(), style);
      setPlan(res.plan);
      setPlanId(res.plan_id);
      setStage('reviewing');
    } catch (err) {
      setError(err.message || String(err));
      setStage('error');
    }
  }

  function handleApprove() {
    setStage('executing');
    setEvents([{ type: 'started', message: 'Site oluşturuluyor...' }]);
    cancelRef.current = apiAIExecutePlan(planId, siteId, (evt) => {
      setEvents(prev => [...prev, evt]);
      if (evt.type === 'done' && evt.siteData) {
        loadSiteData(evt.siteData);
        setStage('done');
      } else if (evt.type === 'error') {
        setError(evt.message);
        setStage('error');
      }
    });
  }

  function handleCancel() {
    if (cancelRef.current) cancelRef.current();
    onClose();
  }

  return (
    <div style={overlayStyle} onClick={stage === 'executing' ? undefined : handleCancel}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <Header stage={stage} onClose={handleCancel} disableClose={stage === 'executing'} />

        {stage === 'idle' && (
          <IdleStage
            prompt={prompt} setPrompt={setPrompt}
            style={style} setStyle={setStyle}
            onGenerate={handleGeneratePlan}
          />
        )}

        {stage === 'planning' && <Loading text="Plan oluşturuluyor..." />}

        {stage === 'reviewing' && plan && (
          <ReviewStage
            plan={typeof plan === 'string' ? safeParse(plan) : plan}
            onApprove={handleApprove}
            onRetry={() => { setPlan(null); setPlanId(null); setStage('idle'); }}
          />
        )}

        {stage === 'executing' && <ExecutingStage events={events} logRef={logRef} />}

        {stage === 'done' && <DoneStage onClose={onClose} />}

        {stage === 'error' && (
          <ErrorStage error={error} onRetry={() => { setError(null); setStage('idle'); }} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

// ─── Stages ──────────────────────────────────────────────────────────────────

function Header({ stage, onClose, disableClose }) {
  const titles = {
    idle: 'AI ile Site Tasarla',
    planning: 'Plan Oluşturuluyor',
    reviewing: 'Planı İncele',
    executing: 'Site İnşa Ediliyor',
    done: 'Tamamlandı',
    error: 'Hata Oluştu',
  };
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:18 }}>✨</span>
        <h2 style={{ margin:0, color:'#e5e2e1', fontSize:16, fontWeight:800 }}>{titles[stage]}</h2>
      </div>
      <button onClick={onClose} disabled={disableClose} style={{ background:'none', border:'none', color: disableClose ? '#333' : '#666', cursor: disableClose ? 'not-allowed' : 'pointer', padding:6, borderRadius:6 }}>
        <span className="material-symbols-outlined" style={{ fontSize:20 }}>close</span>
      </button>
    </div>
  );
}

function IdleStage({ prompt, setPrompt, style, setStyle, onGenerate }) {
  return (
    <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
      <label style={labelStyle}>Nasıl bir site istiyorsun?</label>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Örnek: Modern bir kahve dükkanı sitesi. Anasayfada hoş geldiniz mesajı ve menü tanıtımı olsun, ayrı bir 'Hakkımızda' sayfası ve iletişim formu istiyorum."
        rows={6}
        style={textareaStyle}
        autoFocus
      />
      <label style={labelStyle}>Stil</label>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {STYLES.map(s => (
          <button key={s.key} onClick={() => setStyle(s.key)}
            style={{ ...chipStyle, ...(style === s.key ? chipActiveStyle : {}) }}>
            {s.label}
          </button>
        ))}
      </div>
      <button onClick={onGenerate} disabled={!prompt.trim()} style={{ ...primaryButtonStyle, opacity: prompt.trim() ? 1 : 0.4, cursor: prompt.trim() ? 'pointer' : 'not-allowed' }}>
        <span className="material-symbols-outlined" style={{ fontSize:16 }}>auto_awesome</span>
        Plan Üret
      </button>
    </div>
  );
}

function Loading({ text }) {
  return (
    <div style={{ padding:'48px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:16, color:'#666' }}>
      <div style={{ width:32, height:32, border:'3px solid rgba(75,142,255,0.2)', borderTopColor:'#4b8eff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <span style={{ fontSize:13 }}>{text}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ReviewStage({ plan, onApprove, onRetry }) {
  if (!plan) return <Loading text="Plan yükleniyor..." />;
  return (
    <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16, maxHeight:'60vh', overflow:'auto' }}>
      {plan.summary && (
        <div style={{ background:'rgba(75,142,255,0.08)', border:'1px solid rgba(75,142,255,0.2)', borderRadius:10, padding:'12px 14px', fontSize:13, color:'#e5e2e1', lineHeight:1.5 }}>
          {plan.summary}
        </div>
      )}
      {plan.theme && (
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'#666', textTransform:'uppercase', letterSpacing:0.5 }}>Tema:</span>
          {plan.theme.primaryColor && <ColorSwatch label="Birincil" color={plan.theme.primaryColor} />}
          {plan.theme.accentColor && <ColorSwatch label="Vurgu" color={plan.theme.accentColor} />}
          {plan.theme.backgroundColor && <ColorSwatch label="Arkaplan" color={plan.theme.backgroundColor} />}
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {(plan.pages || []).map((page, idx) => (
          <div key={idx} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <span style={{ width:22, height:22, borderRadius:6, background:'rgba(75,142,255,0.18)', color:'#4b8eff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>{idx + 1}</span>
              <span style={{ color:'#e5e2e1', fontWeight:700, fontSize:14 }}>{page.name}</span>
              <span style={{ marginLeft:'auto', fontSize:11, color:'#555' }}>{(page.elements || []).length} element</span>
            </div>
            <ul style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:6 }}>
              {(page.elements || []).map((el, ei) => (
                <li key={ei} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#aaa' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'#4b8eff', flexShrink:0 }} />
                  <strong style={{ color:'#ccc', fontWeight:600 }}>{el.type}</strong>
                  <span style={{ color:'#666' }}>— {el.purpose}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:10, marginTop:8 }}>
        <button onClick={onRetry} style={secondaryButtonStyle}>
          <span className="material-symbols-outlined" style={{ fontSize:14 }}>edit</span>
          Yeniden Dene
        </button>
        <button onClick={onApprove} style={{ ...primaryButtonStyle, flex:1 }}>
          <span className="material-symbols-outlined" style={{ fontSize:16 }}>check_circle</span>
          Onayla ve İnşa Et
        </button>
      </div>
    </div>
  );
}

function ExecutingStage({ events, logRef }) {
  return (
    <div style={{ padding:'16px 24px', display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, color:'#4b8eff' }}>
        <div style={{ width:14, height:14, border:'2px solid rgba(75,142,255,0.3)', borderTopColor:'#4b8eff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
        <span style={{ fontSize:13, fontWeight:600 }}>Agent çalışıyor...</span>
        <span style={{ fontSize:11, color:'#555', marginLeft:'auto' }}>{events.length} olay</span>
      </div>
      <div ref={logRef} style={{ maxHeight:'50vh', overflow:'auto', background:'#0a0a0a', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:12, display:'flex', flexDirection:'column', gap:6, fontFamily:'monospace', fontSize:11.5 }}>
        {events.map((e, i) => <EventLine key={i} evt={e} />)}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function EventLine({ evt }) {
  const map = {
    started:   { color: '#666', icon: '→',  prefix: '' },
    thinking:  { color: '#888', icon: '💭', prefix: '' },
    tool_call: { color: '#4b8eff', icon: '✓', prefix: '' },
    tool_error:{ color: '#f59e0b', icon: '!', prefix: '' },
    error:     { color: '#ef4444', icon: '✕', prefix: 'Hata: ' },
    done:      { color: '#10b981', icon: '★', prefix: 'Tamamlandı!' },
  };
  const m = map[evt.type] || { color:'#888', icon:'·' };
  let text = evt.message || '';
  if (evt.type === 'tool_call') {
    if (evt.name === 'add_page') text = `Sayfa eklendi: ${evt.args?.name || evt.result?.name || '...'}`;
    else if (evt.name === 'add_element') text = `Element eklendi: ${evt.args?.element_type || '...'}`;
    else if (evt.name === 'set_page_background') text = `Sayfa rengi: ${evt.args?.color}`;
    else if (evt.name === 'update_element_props') text = `Element güncellendi`;
    else if (evt.name === 'done') text = 'Agent bitirdi';
    else text = evt.name;
  }
  return (
    <div style={{ color: m.color, display:'flex', gap:8, lineHeight:1.5 }}>
      <span style={{ flexShrink:0 }}>{m.icon}</span>
      <span style={{ wordBreak:'break-word' }}>{m.prefix}{text}</span>
    </div>
  );
}

function DoneStage({ onClose }) {
  return (
    <div style={{ padding:'40px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:14, textAlign:'center' }}>
      <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(16,185,129,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span className="material-symbols-outlined" style={{ fontSize:32, color:'#10b981' }}>check_circle</span>
      </div>
      <div>
        <h3 style={{ margin:0, color:'#e5e2e1', fontSize:18, fontWeight:800 }}>Site Hazır!</h3>
        <p style={{ margin:'6px 0 0', color:'#888', fontSize:13 }}>Düzenleyiciye geri dönüp özelleştirebilirsin.</p>
      </div>
      <button onClick={onClose} style={{ ...primaryButtonStyle, marginTop:8 }}>Editöre Dön</button>
    </div>
  );
}

function ErrorStage({ error, onRetry, onClose }) {
  return (
    <div style={{ padding:24, display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:10, padding:14, color:'#fca5a5', fontSize:13, lineHeight:1.5 }}>
        {error || 'Bilinmeyen hata'}
      </div>
      <p style={{ margin:0, color:'#666', fontSize:11, lineHeight:1.5 }}>
        GEMINI_API_KEY .env'de ayarlanmış olmalı. Anahtarı kontrol edip tekrar dene.
      </p>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onClose} style={secondaryButtonStyle}>Kapat</button>
        <button onClick={onRetry} style={{ ...primaryButtonStyle, flex:1 }}>Tekrar Dene</button>
      </div>
    </div>
  );
}

function ColorSwatch({ label, color }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#888' }}>
      <span style={{ width:14, height:14, borderRadius:4, background:color, border:'1px solid rgba(255,255,255,0.1)' }} />
      <span>{label}: <span style={{ color:'#aaa', fontFamily:'monospace' }}>{color}</span></span>
    </div>
  );
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const modalStyle = {
  background: '#141414', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, width: '90%', maxWidth: 640, maxHeight: '90vh',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
  fontFamily: 'Inter, sans-serif',
};

const labelStyle = { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 };

const textareaStyle = {
  background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10, padding: '12px 14px', color: '#e5e2e1',
  fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit',
  resize: 'vertical', outline: 'none',
};

const chipStyle = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  color: '#888', borderRadius: 8, padding: '7px 14px',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

const chipActiveStyle = {
  background: 'rgba(75,142,255,0.15)', borderColor: 'rgba(75,142,255,0.4)', color: '#4b8eff',
};

const primaryButtonStyle = {
  background: '#4b8eff', border: 'none', color: '#fff',
  borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center',
};

const secondaryButtonStyle = {
  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa',
  borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
};
