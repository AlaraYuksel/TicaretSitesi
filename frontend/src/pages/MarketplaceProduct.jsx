import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  apiMarketplaceGetProductFull, apiMarketplaceListQuestions, apiMarketplaceAskQuestion,
  isAuthenticated,
} from '../lib/api';
import { useCartStore } from '../store/useCartStore';

const formatPrice = (cents, currency = 'TRY') => {
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺';
  return `${sym}${(cents / 100).toFixed(2)}`;
};

export default function MarketplaceProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const addToCart = useCartStore(s => s.addItem);
  const cartCount = useCartStore(s => s.getItemCount());

  const reloadQuestions = async () => {
    try { setQuestions(await apiMarketplaceListQuestions(id)); } catch {}
  };

  useEffect(() => {
    setLoading(true);
    apiMarketplaceGetProductFull(id)
      .then(data => {
        setProduct(data.product);
        setQuestions(data.answered_questions || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    if (!product) return;
    addToCart(product, qty);
    navigate('/marketplace/checkout');
  };

  if (loading) {
    return <CenterMsg>Ürün yükleniyor...</CenterMsg>;
  }
  if (error) {
    return <CenterMsg>Hata: {error}</CenterMsg>;
  }
  if (!product) {
    return <CenterMsg>Ürün bulunamadı.</CenterMsg>;
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f7f9fc', color: '#191c1e',
      fontFamily: "'Inter', 'Hanken Grotesk', sans-serif",
    }}>
      <header style={{
        background: '#fff', borderBottom: '1px solid #c4c7c8',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <nav style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 72,
        }}>
          <a href="/marketplace" style={{
            fontSize: 20, fontWeight: 700, color: '#191c1e', textDecoration: 'none',
            fontFamily: "'Hanken Grotesk', sans-serif",
          }}>MARKETPLACE</a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a href={isAuthenticated() ? '/marketplace/account' : '/marketplace/auth'}
              style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                color: '#5d5f5f', textDecoration: 'none',
                fontFamily: "'Hanken Grotesk', sans-serif",
              }}>
              {isAuthenticated() ? 'HESABIM' : 'GİRİŞ YAP'}
            </a>
            <button
              onClick={() => navigate('/marketplace/cart')}
              style={{
                position: 'relative', background: 'none', border: 'none',
                cursor: 'pointer', color: '#5d5f5f',
              }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>shopping_bag</span>
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -6,
                  background: '#121926', color: '#fff', fontSize: 9, fontWeight: 800,
                  width: 16, height: 16, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{cartCount}</span>
              )}
            </button>
          </div>
        </nav>
      </header>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px' }}>
        <button
          onClick={() => navigate('/marketplace')}
          style={{
            background: 'none', border: 'none', color: '#5d5f5f', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, letterSpacing: '0.1em',
            marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: "'Hanken Grotesk', sans-serif",
          }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          MARKETPLACE'E DÖN
        </button>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60,
        }}>
          {/* Image */}
          <div style={{
            aspectRatio: '3/4', background: '#eceef1', border: '1px solid #c4c7c8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {product.image ? (
              <img src={product.image} alt={product.title} style={{
                width: '100%', height: '100%', objectFit: 'cover',
              }} />
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 80, color: '#a0a0a0' }}>inventory_2</span>
                <span style={{ fontSize: 11, color: '#888', letterSpacing: '0.1em', fontWeight: 600 }}>ÜRÜN GÖRSELİ</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {product.category && (
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', color: '#747878',
                margin: '0 0 12px', fontFamily: "'Hanken Grotesk', sans-serif",
              }}>{product.category.toUpperCase()}</p>
            )}
            <h1 style={{
              fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em',
              color: '#191c1e', margin: '0 0 16px', lineHeight: 1.15,
              fontFamily: "'Hanken Grotesk', sans-serif",
            }}>{product.title}</h1>

            {product.seller && (
              <p style={{ fontSize: 13, color: '#747878', margin: '0 0 16px' }}>
                <span style={{ color: '#5d5f5f', fontWeight: 600 }}>Satıcı: </span>
                {product.seller}
              </p>
            )}

            {product.rating > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} style={{
                      color: i < Math.floor(product.rating) ? '#f59e0b' : '#d1d5db',
                      fontSize: 16,
                    }}>★</span>
                  ))}
                </div>
                <span style={{ fontSize: 13, color: '#444748' }}>
                  {product.rating.toFixed(1)} {product.review_count > 0 && `(${product.review_count} değerlendirme)`}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24 }}>
              <span style={{
                fontSize: 32, fontWeight: 700, color: '#191c1e',
                fontFamily: "'Inter', sans-serif",
              }}>{formatPrice(product.price, product.currency)}</span>
              {product.compare_price && product.compare_price > product.price && (
                <span style={{
                  fontSize: 18, color: '#747878', textDecoration: 'line-through',
                }}>{formatPrice(product.compare_price, product.currency)}</span>
              )}
            </div>

            {product.description && (
              <p style={{
                fontSize: 15, color: '#444748', lineHeight: 1.7,
                marginBottom: 32, whiteSpace: 'pre-wrap',
              }}>{product.description}</p>
            )}

            {/* Quantity */}
            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                color: '#5d5f5f', marginBottom: 8,
                fontFamily: "'Hanken Grotesk', sans-serif",
              }}>MİKTAR</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: 'fit-content' }}>
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  style={qtyBtnStyle}>−</button>
                <span style={{
                  width: 56, textAlign: 'center', padding: '12px 0',
                  background: '#fff', border: '1px solid #c4c7c8', borderLeft: 'none', borderRight: 'none',
                  fontSize: 14, fontWeight: 600,
                }}>{qty}</span>
                <button
                  onClick={() => setQty(Math.min(99, qty + 1))}
                  style={qtyBtnStyle}>+</button>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <button
                onClick={handleAddToCart}
                style={{
                  flex: 1, background: '#fff', color: '#121926',
                  border: '1px solid #121926', padding: '16px 24px',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                  cursor: 'pointer', fontFamily: "'Hanken Grotesk', sans-serif",
                }}>
                {added ? '✓ EKLENDİ' : 'SEPETE EKLE'}
              </button>
              <button
                onClick={handleBuyNow}
                style={{
                  flex: 1, background: '#121926', color: '#fff',
                  border: 'none', padding: '16px 24px',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                  cursor: 'pointer', fontFamily: "'Hanken Grotesk', sans-serif",
                }}>HEMEN AL</button>
            </div>

            <div style={{
              marginTop: 32, padding: 20, background: '#eceef1',
              border: '1px solid #c4c7c8',
            }}>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                color: '#5d5f5f', margin: '0 0 8px',
                fontFamily: "'Hanken Grotesk', sans-serif",
              }}>📦 KARGO BİLGİSİ</p>
              <p style={{ fontSize: 13, color: '#444748', margin: 0, lineHeight: 1.5 }}>
                ₺200 ve üzeri alışverişlerde ücretsiz kargo. 1-3 iş günü içinde teslim.
              </p>
            </div>
          </div>
        </div>

        {/* Sorular ve Cevaplar */}
        <QASection
          productId={id}
          questions={questions}
          onAsked={reloadQuestions}
        />
      </div>
    </div>
  );
}

function QASection({ productId, questions, onAsked }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async () => {
    if (text.trim().length < 5) { setMsg({ ok: false, text: 'Soru çok kısa' }); return; }
    setBusy(true); setMsg(null);
    try {
      await apiMarketplaceAskQuestion(productId, text.trim());
      setText('');
      setMsg({ ok: true, text: 'Sorunuz satıcıya iletildi. Cevaplandığında bu sayfada göreceksiniz.' });
      onAsked();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <section style={{ marginTop: 80 }}>
      <h2 style={{
        fontSize: 22, fontWeight: 700, margin: '0 0 24px',
        fontFamily: "'Hanken Grotesk', sans-serif", color: '#191c1e',
      }}>Sorular ve Cevaplar</h2>

      {/* Soru sorma */}
      <div style={{ background: '#fff', border: '1px solid #c4c7c8', padding: 20, marginBottom: 24 }}>
        {!isAuthenticated() ? (
          <p style={{ margin: 0, color: '#5d5f5f', fontSize: 14 }}>
            Soru sormak için <a href={`/marketplace/auth?next=/marketplace/product/${productId}`} style={{ color: '#121926', fontWeight: 600 }}>giriş yapın</a>.
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#5d5f5f', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Satıcıya soru sor
            </p>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={3}
              placeholder="Ürün hakkında merak ettiğiniz şey..."
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1px solid #c4c7c8', padding: 12, fontSize: 14,
                fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            {msg && (
              <div style={{
                marginTop: 8, padding: '8px 12px', fontSize: 13,
                background: msg.ok ? '#dcfce7' : '#fee2e2',
                color: msg.ok ? '#14532d' : '#7f1d1d',
                border: `1px solid ${msg.ok ? '#86efac' : '#fecaca'}`,
              }}>{msg.text}</div>
            )}
            <button onClick={submit} disabled={busy} style={{
              marginTop: 12, background: '#121926', color: '#fff', border: 'none',
              padding: '12px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
              cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
              fontFamily: "'Hanken Grotesk', sans-serif",
            }}>{busy ? 'GÖNDERİLİYOR...' : 'SORUYU GÖNDER'}</button>
          </>
        )}
      </div>

      {/* Cevaplanmış sorular */}
      {questions.length === 0 ? (
        <p style={{ color: '#747878', fontSize: 14 }}>Henüz cevaplanmış soru yok.</p>
      ) : (
        questions.map(q => (
          <div key={q.id} style={{ background: '#fff', border: '1px solid #c4c7c8', padding: 20, marginBottom: 12 }}>
            <div style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: 12, color: '#5d5f5f', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {q.buyer_name || 'Kullanıcı'} sordu
              </strong>
              <p style={{ margin: '4px 0 0', color: '#191c1e' }}>{q.question}</p>
            </div>
            <div style={{ paddingLeft: 16, borderLeft: '3px solid #121926' }}>
              <strong style={{ fontSize: 12, color: '#5d5f5f', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Satıcı cevabı
              </strong>
              <p style={{ margin: '4px 0 0', color: '#191c1e' }}>{q.answer}</p>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

const qtyBtnStyle = {
  width: 40, height: 44,
  background: '#fff', border: '1px solid #c4c7c8',
  cursor: 'pointer', fontSize: 18, fontWeight: 600, color: '#191c1e',
};

function CenterMsg({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#f7f9fc', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      color: '#444748', fontSize: 14, fontFamily: "'Inter', sans-serif",
    }}>{children}</div>
  );
}
