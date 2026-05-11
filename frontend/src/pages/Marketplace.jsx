import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Mock data (backend bağlantısı kurulana kadar) ──────────────────────────
const MOCK_PRODUCTS = [
  { id: 'mp1', title: 'Architectural Shirt', price: 18500, currency: '₺', image: '', seller: 'Studio Minimal', category: 'Giyim', rating: 4.8, reviewCount: 124, badge: 'YENİ', slug: 'architectural-shirt' },
  { id: 'mp2', title: 'Matte Geometric Vase', price: 7500, currency: '₺', image: '', seller: 'Ceramic Works', category: 'Dekorasyon', rating: 4.5, reviewCount: 89, badge: '', slug: 'matte-geometric-vase' },
  { id: 'mp3', title: 'Raw Edge Wallet', price: 12000, currency: '₺', image: '', seller: 'Leather Lab', category: 'Aksesuar', rating: 4.7, reviewCount: 201, badge: '', slug: 'raw-edge-wallet' },
  { id: 'mp4', title: 'Void Series 01 Watch', price: 35000, currency: '₺', image: '', seller: 'Void Watches', category: 'Aksesuar', rating: 4.9, reviewCount: 56, badge: 'POPÜLER', slug: 'void-series-01' },
  { id: 'mp5', title: 'Minimalist Desk Lamp', price: 4500, currency: '₺', image: '', seller: 'Light Studio', category: 'Dekorasyon', rating: 4.3, reviewCount: 78, badge: '', slug: 'minimalist-desk-lamp' },
  { id: 'mp6', title: 'Organic Cotton Tee', price: 8900, currency: '₺', image: '', seller: 'Studio Minimal', category: 'Giyim', rating: 4.6, reviewCount: 312, badge: 'EN ÇOK SATAN', slug: 'organic-cotton-tee' },
  { id: 'mp7', title: 'Concrete Planter', price: 3200, currency: '₺', image: '', seller: 'Green House', category: 'Dekorasyon', rating: 4.1, reviewCount: 45, badge: '', slug: 'concrete-planter' },
  { id: 'mp8', title: 'Canvas Tote Bag', price: 5600, currency: '₺', image: '', seller: 'Leather Lab', category: 'Aksesuar', rating: 4.4, reviewCount: 167, badge: 'YENİ', slug: 'canvas-tote-bag' },
  { id: 'mp9', title: 'Wireless Earbuds Pro', price: 24900, currency: '₺', image: '', seller: 'Tech Store', category: 'Elektronik', rating: 4.7, reviewCount: 432, badge: '', slug: 'wireless-earbuds-pro' },
  { id: 'mp10', title: 'Smart Home Hub', price: 15900, currency: '₺', image: '', seller: 'Tech Store', category: 'Elektronik', rating: 4.2, reviewCount: 98, badge: 'İNDİRİM', slug: 'smart-home-hub' },
  { id: 'mp11', title: 'Merino Wool Scarf', price: 6700, currency: '₺', image: '', seller: 'Studio Minimal', category: 'Giyim', rating: 4.8, reviewCount: 73, badge: '', slug: 'merino-wool-scarf' },
  { id: 'mp12', title: 'Brass Candle Holder', price: 4100, currency: '₺', image: '', seller: 'Ceramic Works', category: 'Dekorasyon', rating: 4.6, reviewCount: 112, badge: '', slug: 'brass-candle-holder' },
];

const CATEGORIES = ['Tümü', 'Giyim', 'Aksesuar', 'Dekorasyon', 'Elektronik'];
const SORT_OPTIONS = [
  { value: 'popular', label: 'Popüler' },
  { value: 'newest', label: 'En Yeni' },
  { value: 'price_asc', label: 'Fiyat: Düşükten Yükseğe' },
  { value: 'price_desc', label: 'Fiyat: Yüksekten Düşüğe' },
  { value: 'rating', label: 'En Yüksek Puan' },
];

const formatPrice = (cents, currency = '₺') => `${currency}${(cents / 100).toFixed(2)}`;

// ─── Product Card ───────────────────────────────────────────────────────────
function ProductCard({ product }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ cursor: 'pointer', transition: 'transform 0.3s ease' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image */}
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
        {/* Hover overlay */}
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.05)',
          opacity: hovered ? 1 : 0, transition: 'opacity 0.3s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <button style={{
            background: '#fff', color: '#121926', padding: '10px 24px',
            border: '1px solid #121926', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.1em', cursor: 'pointer', fontFamily: "'Hanken Grotesk', sans-serif",
          }}>HIZLI EKLE</button>
        </div>
        {/* Badge */}
        {product.badge && (
          <span style={{
            position: 'absolute', top: 12, left: 12,
            background: product.badge === 'İNDİRİM' ? '#ba1a1a' : '#121926',
            color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 10px',
            letterSpacing: '0.05em',
          }}>{product.badge}</span>
        )}
      </div>
      {/* Info */}
      <div style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
        <h4 style={{
          margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
          color: '#191c1e', marginBottom: 4, lineHeight: 1.3,
        }}>{product.title.toUpperCase()}</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 1 }}>
            {Array.from({ length: Math.floor(product.rating) }).map((_, i) => (
              <span key={i} style={{ color: '#f59e0b', fontSize: 11 }}>★</span>
            ))}
          </div>
          <span style={{ fontSize: 10, color: '#747878' }}>({product.reviewCount})</span>
        </div>
        <p style={{
          margin: 0, fontSize: 14, color: '#444748', fontFamily: "'Inter', sans-serif",
          fontWeight: 500,
        }}>{formatPrice(product.price, product.currency)}</p>
        <p style={{ margin: '4px 0 0', fontSize: 10, color: '#747878', fontWeight: 500 }}>{product.seller}</p>
      </div>
    </div>
  );
}

// ─── Marketplace Page ───────────────────────────────────────────────────────
export default function Marketplace() {
  const navigate = useNavigate();
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tümü');
  const [sort, setSort] = useState('popular');
  const [cartCount, setCartCount] = useState(0);

  // Fetch from backend when available
  useEffect(() => {
    fetch('/api/products?limit=50')
      .then(r => r.json())
      .then(data => {
        if (data.products?.length > 0) setProducts(data.products);
      })
      .catch(() => { /* use mock data */ });
  }, []);

  const filtered = useMemo(() => {
    let list = [...products];
    if (category !== 'Tümü') list = list.filter(p => p.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(q) || p.seller?.toLowerCase().includes(q));
    }
    switch (sort) {
      case 'price_asc': list.sort((a, b) => a.price - b.price); break;
      case 'price_desc': list.sort((a, b) => b.price - a.price); break;
      case 'rating': list.sort((a, b) => b.rating - a.rating); break;
      case 'newest': list.reverse(); break;
      default: list.sort((a, b) => b.reviewCount - a.reviewCount);
    }
    return list;
  }, [products, category, search, sort]);

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
              {['Tümü', 'Giyim', 'Aksesuar', 'Dekorasyon', 'Elektronik'].map(cat => (
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
            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#f2f4f7', border: '1px solid #c4c7c8', padding: '8px 16px',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#747878' }}>search</span>
              <input
                type="text" placeholder="ÜRÜN ARA..." value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', width: 140,
                  color: '#191c1e', fontFamily: "'Hanken Grotesk', sans-serif",
                }}
              />
            </div>
            {/* Cart */}
            <button style={{
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
        }}>MARKETPLACE 2024</span>
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
        {/* Toolbar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 32,
        }}>
          <div>
            <h2 style={{
              margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: '-0.01em',
              color: '#191c1e', fontFamily: "'Hanken Grotesk', sans-serif",
            }}>{category === 'Tümü' ? 'Tüm Ürünler' : category}</h2>
            <span style={{ fontSize: 12, color: '#747878' }}>{filtered.length} ürün</span>
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

        {/* Grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32,
        }}>
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '80px 0', color: '#747878',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 12, display: 'block' }}>search_off</span>
            <p style={{ fontSize: 14 }}>Aramanızla eşleşen ürün bulunamadı.</p>
          </div>
        )}
      </section>

      {/* ── NEWSLETTER ──────────────────────────────────────────────── */}
      <section style={{
        padding: '80px 24px', textAlign: 'center', maxWidth: 640, margin: '0 auto',
      }}>
        <h2 style={{
          fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em',
          color: '#191c1e', margin: '0 0 12px',
          fontFamily: "'Hanken Grotesk', sans-serif",
        }}>BÜLTEN</h2>
        <p style={{ fontSize: 14, color: '#747878', marginBottom: 32 }}>
          Yeni mağazalar ve özel fırsatlardan ilk siz haberdar olun.
        </p>
        <div style={{ display: 'flex', gap: 0 }}>
          <input
            type="email" placeholder="E-POSTA ADRESİNİZ"
            style={{
              flex: 1, border: '1px solid #c4c7c8', padding: '14px 20px',
              fontSize: 12, outline: 'none', fontFamily: "'Inter', sans-serif",
            }}
          />
          <button style={{
            background: '#121926', color: '#fff', padding: '14px 28px', border: 'none',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer',
            fontFamily: "'Hanken Grotesk', sans-serif",
          }}>ABONE OL</button>
        </div>
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
          }}>© 2024 MARKETPLACE. TÜM HAKLARI SAKLIDIR.</p>
        </div>
      </footer>
    </div>
  );
}
