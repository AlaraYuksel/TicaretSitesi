import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  apiMarketplaceListProducts,
  apiMarketplaceListCategories,
  isAuthenticated,
} from '../lib/api';
import { useCartStore } from '../store/useCartStore';

const SORT_OPTIONS = [
  { value: 'popular', label: 'Popüler' },
  { value: 'newest', label: 'En Yeni' },
  { value: 'price_asc', label: 'Fiyat: Düşükten Yükseğe' },
  { value: 'price_desc', label: 'Fiyat: Yüksekten Düşüğe' },
  { value: 'rating', label: 'En Yüksek Puan' },
];

const formatPrice = (cents, currency = 'TRY') => {
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺';
  return `${sym}${(cents / 100).toFixed(2)}`;
};

// ─── Product Card ───────────────────────────────────────────────────────────
function ProductCard({ product, onOpen, onQuickAdd }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ cursor: 'pointer', transition: 'transform 0.3s ease' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(product)}
    >
      <div style={{
        position: 'relative', aspectRatio: '3/4', overflow: 'hidden', marginBottom: 12,
        background: '#eceef1', border: '1px solid #c4c7c8',
      }}>
        {product.image ? (
          <img src={product.image} alt={product.title} style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transition: 'transform 0.5s ease',
            transform: hovered ? 'scale(1.05)' : 'scale(1)',
          }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'linear-gradient(145deg, #eceef1, #d8dadd)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#a0a0a0' }}>inventory_2</span>
            <span style={{ fontSize: 10, color: '#888', letterSpacing: '0.1em', fontWeight: 600 }}>ÜRÜN</span>
          </div>
        )}
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.05)',
          opacity: hovered ? 1 : 0, transition: 'opacity 0.3s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); onQuickAdd(product); }}
            style={{
              background: '#fff', color: '#121926', padding: '10px 24px',
              border: '1px solid #121926', fontSize: 10, fontWeight: 700,
              letterSpacing: '0.1em', cursor: 'pointer', fontFamily: "'Hanken Grotesk', sans-serif",
            }}>HIZLI EKLE</button>
        </div>
        {product.badge && (
          <span style={{
            position: 'absolute', top: 12, left: 12,
            background: product.badge === 'İNDİRİM' || product.badge === 'SALE' ? '#ba1a1a' : '#121926',
            color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 10px',
            letterSpacing: '0.05em',
          }}>{product.badge}</span>
        )}
      </div>
      <div style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
        <h4 style={{
          margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
          color: '#191c1e', marginBottom: 4, lineHeight: 1.3,
        }}>{(product.title || '').toUpperCase()}</h4>
        {product.rating > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ display: 'flex', gap: 1 }}>
              {Array.from({ length: Math.floor(product.rating) }).map((_, i) => (
                <span key={i} style={{ color: '#f59e0b', fontSize: 11 }}>★</span>
              ))}
            </div>
            {product.review_count > 0 && (
              <span style={{ fontSize: 10, color: '#747878' }}>({product.review_count})</span>
            )}
          </div>
        )}
        <p style={{
          margin: 0, fontSize: 14, color: '#444748', fontFamily: "'Inter', sans-serif",
          fontWeight: 500,
        }}>{formatPrice(product.price, product.currency)}</p>
        {product.seller && (
          <p style={{ margin: '4px 0 0', fontSize: 10, color: '#747878', fontWeight: 500 }}>{product.seller}</p>
        )}
      </div>
    </div>
  );
}

// ─── Marketplace Page ───────────────────────────────────────────────────────
export default function Marketplace() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('Tümü');
  const [sort, setSort] = useState('popular');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);

  const cartCount = useCartStore(s => s.getItemCount());
  const addToCart = useCartStore(s => s.addItem);

  useEffect(() => {
    apiMarketplaceListCategories()
      .then(data => setCategories(data.categories || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiMarketplaceListProducts({ q: search, category, sort, page: 1, limit: 48 })
      .then(data => {
        if (cancelled) return;
        setProducts(data.products || []);
        setTotal(data.total || 0);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message);
        setProducts([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [search, category, sort]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleOpenProduct = (p) => navigate(`/marketplace/product/${p.id}`);
  const handleQuickAdd = (p) => {
    addToCart(p, 1);
  };

  const allCategories = ['Tümü', ...categories];

  return (
    <div style={{
      minHeight: '100vh', background: '#f7f9fc', color: '#191c1e',
      fontFamily: "'Inter', 'Hanken Grotesk', sans-serif",
    }}>
      {/* ── NAVBAR ──────────────────────────────────────────────────── */}
      <header style={{
        background: '#fff', borderBottom: '1px solid #c4c7c8',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <nav style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 72,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
            <a href="/marketplace" style={{
              fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em',
              color: '#191c1e', textDecoration: 'none', fontFamily: "'Hanken Grotesk', sans-serif",
            }}>MARKETPLACE</a>
            <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              {allCategories.slice(0, 6).map(cat => (
                <button key={cat} onClick={() => setCategory(cat)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                  color: category === cat ? '#5d5f5f' : '#747878',
                  borderBottom: category === cat ? '1px solid #5d5f5f' : '1px solid transparent',
                  paddingBottom: 2, fontFamily: "'Hanken Grotesk', sans-serif",
                }}>{cat.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <form onSubmit={handleSearchSubmit} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#f2f4f7', border: '1px solid #c4c7c8', padding: '8px 16px',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#747878' }}>search</span>
              <input
                type="text" placeholder="ÜRÜN ARA..." value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', width: 140,
                  color: '#191c1e', fontFamily: "'Hanken Grotesk', sans-serif",
                }}
              />
            </form>
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
            <a href={isAuthenticated() ? '/marketplace/account' : '/marketplace/auth'} style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              color: '#5d5f5f', textDecoration: 'none',
              fontFamily: "'Hanken Grotesk', sans-serif",
            }}>{isAuthenticated() ? 'HESABIM' : 'GİRİŞ YAP'}</a>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                background: '#121926', color: '#fff', border: 'none',
                padding: '10px 20px', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.1em', cursor: 'pointer',
                fontFamily: "'Hanken Grotesk', sans-serif",
              }}>MAĞAZA OLUŞTUR</button>
          </div>
        </nav>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(135deg, #eceef1, #d8dadd)',
        padding: '80px 24px', textAlign: 'center',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', color: '#747878',
          display: 'block', marginBottom: 16, fontFamily: "'Hanken Grotesk', sans-serif",
        }}>MARKETPLACE 2026</span>
        <h1 style={{
          fontSize: 44, fontWeight: 600, letterSpacing: '-0.02em',
          color: '#191c1e', margin: '0 0 16px', lineHeight: 1.1,
          fontFamily: "'Hanken Grotesk', sans-serif",
        }}>TÜM MAĞAZALAR, TEK ÇATI ALTINDA</h1>
        <p style={{
          fontSize: 16, color: '#444748', maxWidth: 500, margin: '0 auto 32px',
          lineHeight: 1.5,
        }}>Bağımsız mağazaların özenle seçilmiş ürünlerini keşfedin.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => setCategory('Tümü')}
            style={{
              background: '#121926', color: '#fff', padding: '14px 32px', border: 'none',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer',
              fontFamily: "'Hanken Grotesk', sans-serif",
            }}>TÜM ÜRÜNLERİ GÖR</button>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: '#fff', color: '#121926', padding: '14px 32px',
              border: '1px solid #121926', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.1em', cursor: 'pointer',
              fontFamily: "'Hanken Grotesk', sans-serif",
            }}>MAĞAZA AÇ</button>
        </div>
      </section>

      {/* ── PRODUCT GRID ───────────────────────────────────────────── */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 32,
        }}>
          <div>
            <h2 style={{
              margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: '-0.01em',
              color: '#191c1e', fontFamily: "'Hanken Grotesk', sans-serif",
            }}>{category === 'Tümü' ? 'Tüm Ürünler' : category}</h2>
            <span style={{ fontSize: 12, color: '#747878' }}>
              {loading ? 'yükleniyor...' : `${total} ürün`}
            </span>
          </div>
          <select
            value={sort} onChange={e => setSort(e.target.value)}
            style={{
              background: '#fff', border: '1px solid #c4c7c8', padding: '8px 16px',
              fontSize: 12, color: '#191c1e', outline: 'none', cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {error && (
          <div style={{
            background: '#fee', border: '1px solid #fbb', color: '#900',
            padding: '12px 16px', marginBottom: 20, fontSize: 13,
          }}>
            Hata: {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#747878' }}>
            Yükleniyor...
          </div>
        ) : products.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 0', color: '#747878',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 12, display: 'block' }}>storefront</span>
            <p style={{ fontSize: 14, marginBottom: 8 }}>Henüz yayınlanmış ürün yok.</p>
            <p style={{ fontSize: 12 }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  background: 'none', border: 'none', color: '#121926',
                  textDecoration: 'underline', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}
              >Bir mağaza açın</button> ve ürün ekleyin.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32,
          }}>
            {products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onOpen={handleOpenProduct}
                onQuickAdd={handleQuickAdd}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer style={{
        background: '#f7f9fc', borderTop: '1px solid #c4c7c8', padding: '60px 24px 32px',
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'flex', justifyContent: 'space-between', gap: 40,
        }}>
          <div style={{ maxWidth: 320 }}>
            <a href="/marketplace" style={{
              fontSize: 20, fontWeight: 700, color: '#5d5f5f', textDecoration: 'none',
              fontFamily: "'Hanken Grotesk', sans-serif", display: 'block', marginBottom: 12,
            }}>MARKETPLACE</a>
            <p style={{ fontSize: 14, color: '#747878', lineHeight: 1.6 }}>
              Bağımsız mağazaların bir araya geldiği, özenle tasarlanmış ürünlerin keşfedildiği platform.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 60 }}>
            {[
              { title: 'MÜŞTERİ HİZMETLERİ', links: ['Kargo & İade', 'İletişim', 'SSS'] },
              { title: 'YASAL', links: ['Kullanım Koşulları', 'Gizlilik'] },
              { title: 'SOSYAL', links: ['Instagram', 'Twitter'] },
            ].map(section => (
              <div key={section.title}>
                <h5 style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                  color: '#191c1e', marginBottom: 12,
                  fontFamily: "'Hanken Grotesk', sans-serif",
                }}>{section.title}</h5>
                {section.links.map(link => (
                  <a key={link} href="#" style={{
                    display: 'block', fontSize: 14, color: '#747878',
                    textDecoration: 'none', marginBottom: 8,
                  }}>{link}</a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{
          maxWidth: 1280, margin: '32px auto 0',
          borderTop: '1px solid #c4c7c8', paddingTop: 20,
        }}>
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#747878',
            fontFamily: "'Hanken Grotesk', sans-serif",
          }}>© 2026 MARKETPLACE. TÜM HAKLARI SAKLIDIR.</p>
        </div>
      </footer>
    </div>
  );
}
