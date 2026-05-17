import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiAISolverListSolutions } from '../lib/api';
import { useCartStore } from '../store/useCartStore';

const formatPrice = (cents, currency = 'TRY') => {
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺';
  return `${sym}${((cents || 0) / 100).toFixed(2)}`;
};

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
};

// ─── Tek çözüm kartı ─────────────────────────────────────────────────────────
function SolutionCard({ solution }) {
  const navigate = useNavigate();
  const addToCart = useCartStore(s => s.addItem);
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);

  const pkg = solution.package || {};
  const analysis = solution.analysis || {};
  const items = pkg.items || [];

  const handleAdd = () => {
    items.forEach(it => {
      addToCart({
        id: it.product_id, title: it.title, price: it.price,
        image: it.image || '', seller: it.seller || '',
        site_id: it.site_id || '', currency: it.currency || 'TRY',
      }, it.quantity || 1);
    });
    setAdded(true);
  };

  return (
    <div style={{ border: '1px solid #c4c7c8', background: '#fff', marginBottom: 16 }}>
      <div style={{ padding: '18px 22px', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 10, color: '#747878', fontWeight: 600 }}>{formatDate(solution.created_at)}</span>
            <h3 style={{
              margin: '4px 0 6px', fontSize: 17, fontWeight: 700, color: '#191c1e',
              fontFamily: "'Hanken Grotesk', sans-serif",
            }}>{pkg.package_title || 'Çözüm Paketi'}</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#747878', lineHeight: 1.4 }}>
              "{solution.problem_text}"
            </p>
          </div>
          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#191c1e' }}>
              {formatPrice(pkg.total_price)}
            </p>
            <span style={{ fontSize: 11, color: '#747878' }}>{items.length} ürün</span>
          </div>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid #e3e5e8', padding: '18px 22px', background: '#f7f9fc' }}>
          {analysis.summary && (
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#444748', lineHeight: 1.5 }}>
              {analysis.summary}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((it, i) => (
              <div key={`${it.product_id}-${i}`}
                onClick={() => navigate(`/marketplace/product/${it.product_id}`)}
                style={{
                  display: 'flex', gap: 12, alignItems: 'center', background: '#fff',
                  border: '1px solid #c4c7c8', padding: 10, cursor: 'pointer',
                }}>
                <div style={{ width: 52, height: 52, flexShrink: 0, background: '#eceef1', overflow: 'hidden' }}>
                  {it.image && <img src={it.image} alt={it.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#7c5cff', letterSpacing: '0.05em' }}>
                    {(it.role || 'ÜRÜN').toUpperCase()}
                  </span>
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: '#191c1e' }}>
                    {it.title} <span style={{ color: '#747878', fontWeight: 400 }}>× {it.quantity}</span>
                  </p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#191c1e', whiteSpace: 'nowrap' }}>
                  {formatPrice(it.line_total, it.currency)}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={added}
            style={{
              marginTop: 16, background: added ? '#16a34a' : '#7c5cff', color: '#fff',
              border: 'none', padding: '12px 24px', fontSize: 11, fontWeight: 800,
              letterSpacing: '0.1em', cursor: added ? 'default' : 'pointer',
              fontFamily: "'Hanken Grotesk', sans-serif",
            }}>{added ? '✓ SEPETE EKLENDİ' : 'PAKETİ SEPETE EKLE'}</button>
        </div>
      )}
    </div>
  );
}

// ─── Kayıtlı Çözümler Sayfası ────────────────────────────────────────────────
export default function MarketplaceSolutions() {
  const navigate = useNavigate();
  const [solutions, setSolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiAISolverListSolutions()
      .then(data => setSolutions(data.solutions || []))
      .catch(err => setError(err.message === 'UNAUTHORIZED' ? null : err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: '#f7f9fc', color: '#191c1e',
      fontFamily: "'Inter', 'Hanken Grotesk', sans-serif",
    }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #c4c7c8' }}>
        <nav style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 72,
        }}>
          <a href="/marketplace" style={{
            fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', color: '#191c1e',
            textDecoration: 'none', fontFamily: "'Hanken Grotesk', sans-serif",
          }}>MARKETPLACE</a>
          <button onClick={() => navigate('/marketplace')} style={{
            background: 'none', border: '1px solid #c4c7c8', padding: '10px 18px',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer',
            color: '#5d5f5f', fontFamily: "'Hanken Grotesk', sans-serif",
          }}>← ALIŞVERİŞE DÖN</button>
        </nav>
      </header>

      <section style={{ maxWidth: 880, margin: '0 auto', padding: '48px 24px' }}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', color: '#7c5cff',
          display: 'block', marginBottom: 6, fontFamily: "'Hanken Grotesk', sans-serif",
        }}>AI ÇÖZÜM ASİSTANI</span>
        <h1 style={{
          margin: '0 0 32px', fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em',
          fontFamily: "'Hanken Grotesk', sans-serif",
        }}>Kayıtlı Çözümlerim</h1>

        {loading ? (
          <p style={{ color: '#747878', fontSize: 14 }}>Yükleniyor...</p>
        ) : error ? (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b',
            padding: '12px 16px', fontSize: 13,
          }}>{error}</div>
        ) : solutions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#747878' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 44, display: 'block', marginBottom: 12 }}>
              lightbulb
            </span>
            <p style={{ fontSize: 14, marginBottom: 8 }}>Henüz kaydedilmiş çözümünüz yok.</p>
            <button onClick={() => navigate('/marketplace')} style={{
              background: 'none', border: 'none', color: '#7c5cff', textDecoration: 'underline',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>Marketplace'te bir sorun çözdürün</button>
          </div>
        ) : (
          solutions.map(s => <SolutionCard key={s.id} solution={s} />)
        )}
      </section>
    </div>
  );
}
