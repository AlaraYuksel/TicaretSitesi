import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  apiAISolverSolve,
  apiAISolverSaveSolution,
  isAuthenticated,
} from '../../lib/api';
import { useCartStore } from '../../store/useCartStore';

// AI Çözüm Asistanı — marketplace sayfasına gömülü bölüm.
// Kullanıcı sorununu anlatır; AI çelişki analizi yapar, anlamsal arama ile ürün
// bulur, çok ürünlü bir çözüm paketi kurar ve canlı stok/fiyat doğrular.

const STEPS = [
  { key: 'analyzing', label: 'Analiz', desc: 'Sorun çelişkiye dönüştürülüyor' },
  { key: 'searching', label: 'Anlamsal Arama', desc: 'Katalogda ilgili ürünler taranıyor' },
  { key: 'packaging', label: 'Dinamik Paketleme', desc: 'Çözüm paketi oluşturuluyor' },
  { key: 'verifying', label: 'Operasyonel Kanıt', desc: 'Canlı stok ve fiyat doğrulanıyor' },
];

const EXAMPLE = 'Örn: Evimde çok kitap var ama kiradayım ve duvarları delmem yasak. Kitaplarımı nasıl düzenli tutabilirim?';

const formatPrice = (cents, currency = 'TRY') => {
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺';
  return `${sym}${((cents || 0) / 100).toFixed(2)}`;
};

export default function AISolverSection() {
  const navigate = useNavigate();
  const addToCart = useCartStore(s => s.addItem);

  const [problem, setProblem] = useState('');
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(null);
  const [doneSteps, setDoneSteps] = useState([]);
  const [searchCount, setSearchCount] = useState(0);
  const [analysis, setAnalysis] = useState(null);
  const [pkg, setPkg] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const cancelRef = useRef(null);
  const timeoutRef = useRef(null);
  useEffect(() => () => {
    if (cancelRef.current) cancelRef.current();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // finish — akışı sonlandırır: zaman aşımı sayacını temizler ve butonu açar.
  const finish = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    setRunning(false);
  };

  const reset = () => {
    setActiveStep(null);
    setDoneSteps([]);
    setSearchCount(0);
    setAnalysis(null);
    setPkg(null);
    setError(null);
    setSaved(false);
    setAddedToCart(false);
  };

  const markStepDone = (key) => {
    const idx = STEPS.findIndex(s => s.key === key);
    setDoneSteps(STEPS.slice(0, idx).map(s => s.key));
    setActiveStep(key);
  };

  const handleSolve = () => {
    if (problem.trim().length < 10 || running) return;
    reset();
    setRunning(true);

    // Güvenlik ağı: 120 sn içinde done/error gelmezse akışı zorla sonlandır,
    // böylece buton ve metin kutusu hiçbir koşulda kalıcı kilitlenmez.
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (cancelRef.current) cancelRef.current();
      setError('İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.');
      setActiveStep(null);
      setRunning(false);
      timeoutRef.current = null;
    }, 120000);

    cancelRef.current = apiAISolverSolve(problem.trim(), (ev) => {
      switch (ev.type) {
        case 'step':
          markStepDone(ev.step);
          break;
        case 'analyzed':
          setAnalysis(ev.analysis);
          break;
        case 'searched':
          setSearchCount(ev.count || 0);
          break;
        case 'done':
          setAnalysis(ev.analysis);
          setPkg(ev.package);
          setDoneSteps(STEPS.map(s => s.key));
          setActiveStep(null);
          finish();
          break;
        case 'error':
          setError(ev.message || 'Bir hata oluştu');
          setActiveStep(null);
          finish();
          break;
        default:
          break;
      }
    });
  };

  const handleAddPackageToCart = () => {
    if (!pkg || !pkg.items) return;
    pkg.items.forEach(it => {
      addToCart({
        id: it.product_id,
        title: it.title,
        price: it.price,
        image: it.image || '',
        seller: it.seller || '',
        site_id: it.site_id || '',
        currency: it.currency || 'TRY',
      }, it.quantity || 1);
    });
    setAddedToCart(true);
  };

  const handleSave = async () => {
    if (!pkg || !analysis || saving) return;
    setSaving(true);
    try {
      await apiAISolverSaveSolution({
        problem_text: problem.trim(),
        analysis,
        package: pkg,
      });
      setSaved(true);
    } catch (e) {
      setError(e.message === 'UNAUTHORIZED'
        ? 'Çözümü kaydetmek için giriş yapmalısınız.'
        : (e.message || 'Çözüm kaydedilemedi'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={{ background: '#fff', borderBottom: '1px solid #c4c7c8' }}>
      <style>{`@keyframes aiSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes aiPulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 24px' }}>
        {/* ── Başlık ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', color: '#7c5cff',
              display: 'block', marginBottom: 6, fontFamily: "'Hanken Grotesk', sans-serif",
            }}>AI ÇÖZÜM ASİSTANI</span>
            <h2 style={{
              margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em', color: '#191c1e',
              fontFamily: "'Hanken Grotesk', sans-serif",
            }}>Sorununu anlat, çözümü paketleyelim</h2>
          </div>
          {isAuthenticated() && (
            <button
              onClick={() => navigate('/marketplace/solutions')}
              style={{
                background: 'none', border: '1px solid #c4c7c8', padding: '10px 18px',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer',
                color: '#5d5f5f', fontFamily: "'Hanken Grotesk', sans-serif",
              }}>ÇÖZÜMLERİM</button>
          )}
        </div>

        {/* ── Giriş ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <textarea
            value={problem}
            onChange={e => setProblem(e.target.value)}
            placeholder={EXAMPLE}
            rows={3}
            disabled={running}
            style={{
              flex: 1, minWidth: 280, resize: 'vertical', padding: '14px 16px',
              border: '1px solid #c4c7c8', background: '#f7f9fc', fontSize: 14,
              color: '#191c1e', outline: 'none', fontFamily: "'Inter', sans-serif",
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={handleSolve}
            disabled={running || problem.trim().length < 10}
            style={{
              background: running || problem.trim().length < 10 ? '#9ca3af' : '#7c5cff',
              color: '#fff', border: 'none', padding: '0 32px', minHeight: 56,
              fontSize: 12, fontWeight: 800, letterSpacing: '0.1em',
              cursor: running || problem.trim().length < 10 ? 'not-allowed' : 'pointer',
              fontFamily: "'Hanken Grotesk', sans-serif", whiteSpace: 'nowrap',
            }}>{running ? 'ÇÖZÜLÜYOR…' : 'ÇÖZÜM ÜRET'}</button>
        </div>

        {/* ── Adımlar (çarklar) ──────────────────────────────────── */}
        {(running || doneSteps.length > 0) && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 24,
          }}>
            {STEPS.map(step => {
              const isDone = doneSteps.includes(step.key);
              const isActive = activeStep === step.key;
              return (
                <div key={step.key} style={{
                  padding: '14px 16px', border: '1px solid',
                  borderColor: isActive ? '#7c5cff' : isDone ? '#c4c7c8' : '#e3e5e8',
                  background: isActive ? '#f4f1ff' : '#fff',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="material-symbols-outlined" style={{
                      fontSize: 18,
                      color: isDone ? '#16a34a' : isActive ? '#7c5cff' : '#9ca3af',
                      animation: isActive ? 'aiSpin 1.4s linear infinite' : 'none',
                      display: 'inline-block',
                    }}>{isDone ? 'check_circle' : 'settings'}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
                      color: isActive || isDone ? '#191c1e' : '#9ca3af',
                      fontFamily: "'Hanken Grotesk', sans-serif",
                    }}>{step.label}</span>
                  </div>
                  <p style={{
                    margin: 0, fontSize: 11, color: '#747878', lineHeight: 1.4,
                    animation: isActive ? 'aiPulse 1.6s ease-in-out infinite' : 'none',
                  }}>
                    {step.key === 'searching' && searchCount > 0
                      ? `${searchCount} ilgili ürün bulundu`
                      : step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Hata ───────────────────────────────────────────────── */}
        {error && (
          <div style={{
            marginTop: 20, background: '#fef2f2', border: '1px solid #fca5a5',
            color: '#991b1b', padding: '12px 16px', fontSize: 13,
          }}>{error}</div>
        )}

        {/* ── Çelişki Analizi ────────────────────────────────────── */}
        {analysis && (
          <div style={{
            marginTop: 24, border: '1px solid #c4c7c8', padding: '20px 24px', background: '#f7f9fc',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', color: '#7c5cff',
              fontFamily: "'Hanken Grotesk', sans-serif",
            }}>ÇELİŞKİ ANALİZİ</span>
            <p style={{ margin: '8px 0 16px', fontSize: 14, color: '#444748', lineHeight: 1.5 }}>
              {analysis.summary}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220, background: '#fff', border: '1px solid #c4c7c8', padding: '12px 16px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#16a34a' }}>İYİLEŞEN</span>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#191c1e', fontWeight: 500 }}>{analysis.improving}</p>
              </div>
              <div style={{ flex: 1, minWidth: 220, background: '#fff', border: '1px solid #c4c7c8', padding: '12px 16px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#dc2626' }}>KISIT</span>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#191c1e', fontWeight: 500 }}>{analysis.constraint}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Çözüm Paketi ───────────────────────────────────────── */}
        {pkg && pkg.items && pkg.items.length > 0 && (
          <div style={{
            marginTop: 16, border: '2px solid #7c5cff', padding: '24px',
          }}>
            <h3 style={{
              margin: 0, fontSize: 20, fontWeight: 700, color: '#191c1e',
              fontFamily: "'Hanken Grotesk', sans-serif",
            }}>{pkg.package_title}</h3>
            {pkg.intro && (
              <p style={{ margin: '8px 0 0', fontSize: 14, color: '#444748', lineHeight: 1.5 }}>{pkg.intro}</p>
            )}

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pkg.items.map((it, i) => (
                <div key={`${it.product_id}-${i}`} style={{
                  display: 'flex', gap: 14, alignItems: 'center',
                  border: '1px solid #c4c7c8', padding: 12, background: '#fff',
                  cursor: 'pointer',
                }}
                  onClick={() => navigate(`/marketplace/product/${it.product_id}`)}>
                  <div style={{ width: 64, height: 64, flexShrink: 0, background: '#eceef1', overflow: 'hidden' }}>
                    {it.image
                      ? <img src={it.image} alt={it.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#a0a0a0' }}>inventory_2</span>
                        </div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', color: '#7c5cff',
                        background: '#f4f1ff', padding: '2px 8px',
                      }}>{(it.role || 'ÜRÜN').toUpperCase()}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#191c1e' }}>{it.title}</span>
                      <span style={{ fontSize: 11, color: '#747878' }}>× {it.quantity}</span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#747878', lineHeight: 1.4 }}>{it.reason}</p>
                    {it.replaced && it.replaced_note && (
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#b45309' }}>⟳ {it.replaced_note}</p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#191c1e' }}>
                      {formatPrice(it.line_total, it.currency)}
                    </p>
                    {it.quantity > 1 && (
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: '#747878' }}>
                        {formatPrice(it.price, it.currency)} / adet
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Toplam + aksiyonlar ── */}
            <div style={{
              marginTop: 20, paddingTop: 16, borderTop: '1px solid #c4c7c8',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 16, flexWrap: 'wrap',
            }}>
              <div>
                <span style={{ fontSize: 11, color: '#747878', fontWeight: 600 }}>
                  {pkg.item_count} ÜRÜNLÜ ÇÖZÜM PAKETİ
                </span>
                <p style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 700, color: '#191c1e' }}>
                  {formatPrice(pkg.total_price)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {isAuthenticated() && (
                  <button
                    onClick={handleSave}
                    disabled={saving || saved}
                    style={{
                      background: '#fff', color: saved ? '#16a34a' : '#191c1e',
                      border: '1px solid #c4c7c8', padding: '14px 22px',
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                      cursor: saving || saved ? 'default' : 'pointer',
                      fontFamily: "'Hanken Grotesk', sans-serif",
                    }}>{saved ? '✓ KAYDEDİLDİ' : saving ? 'KAYDEDİLİYOR…' : 'ÇÖZÜMÜ KAYDET'}</button>
                )}
                <button
                  onClick={handleAddPackageToCart}
                  style={{
                    background: addedToCart ? '#16a34a' : '#7c5cff', color: '#fff', border: 'none',
                    padding: '14px 26px', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
                    cursor: 'pointer', fontFamily: "'Hanken Grotesk', sans-serif",
                  }}>{addedToCart ? '✓ SEPETE EKLENDİ' : 'TEK TIKLA SEPETE EKLE'}</button>
              </div>
            </div>
            {addedToCart && (
              <p style={{ margin: '12px 0 0', fontSize: 12, color: '#16a34a' }}>
                Paket sepete eklendi.{' '}
                <button onClick={() => navigate('/marketplace/cart')} style={{
                  background: 'none', border: 'none', color: '#7c5cff', textDecoration: 'underline',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}>Sepete git</button>
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
