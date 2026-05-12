import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';

const formatPrice = (cents, currency = 'TRY') => {
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺';
  return `${sym}${(cents / 100).toFixed(2)}`;
};

export default function MarketplaceCart() {
  const navigate = useNavigate();
  const items = useCartStore(s => s.items);
  const updateQuantity = useCartStore(s => s.updateQuantity);
  const removeItem = useCartStore(s => s.removeItem);
  const subtotal = useCartStore(s => s.getSubtotal());
  const shipping = useCartStore(s => s.getShippingCost());
  const total = useCartStore(s => s.getTotal());

  return (
    <div style={{
      minHeight: '100vh', background: '#f7f9fc', color: '#191c1e',
      fontFamily: "'Inter', 'Hanken Grotesk', sans-serif",
    }}>
      <header style={{
        background: '#fff', borderBottom: '1px solid #c4c7c8',
      }}>
        <nav style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 72,
        }}>
          <a href="/marketplace" style={{
            fontSize: 20, fontWeight: 700, color: '#191c1e', textDecoration: 'none',
            fontFamily: "'Hanken Grotesk', sans-serif",
          }}>MARKETPLACE</a>
          <button
            onClick={() => navigate('/marketplace')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#5d5f5f',
              fontFamily: "'Hanken Grotesk', sans-serif",
            }}>← ALIŞVERİŞE DEVAM ET</button>
        </nav>
      </header>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{
          fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em',
          margin: '0 0 32px', fontFamily: "'Hanken Grotesk', sans-serif",
        }}>Sepetim ({items.length})</h1>

        {items.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '120px 0', color: '#747878',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 64, marginBottom: 16, display: 'block' }}>shopping_bag</span>
            <p style={{ fontSize: 16, marginBottom: 24 }}>Sepetiniz boş.</p>
            <button
              onClick={() => navigate('/marketplace')}
              style={{
                background: '#121926', color: '#fff', border: 'none',
                padding: '14px 32px', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.1em', cursor: 'pointer',
                fontFamily: "'Hanken Grotesk', sans-serif",
              }}>ALIŞVERİŞE BAŞLA</button>
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 40, alignItems: 'flex-start',
          }}>
            {/* Items */}
            <div>
              {items.map(item => (
                <div key={item.productId} style={{
                  display: 'flex', gap: 20, padding: '20px 0',
                  borderBottom: '1px solid #c4c7c8',
                }}>
                  <div style={{
                    width: 100, height: 130, background: '#eceef1', flexShrink: 0,
                    border: '1px solid #c4c7c8', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {item.image ? (
                      <img src={item.image} alt={item.title} style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                      }} />
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#a0a0a0' }}>inventory_2</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{
                      margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '0.05em',
                      color: '#191c1e', marginBottom: 4,
                      fontFamily: "'Hanken Grotesk', sans-serif",
                    }}>{item.title}</h4>
                    {item.seller && (
                      <p style={{ margin: '0 0 12px', fontSize: 11, color: '#747878' }}>{item.seller}</p>
                    )}
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#191c1e' }}>
                      {formatPrice(item.price, item.currency)}
                    </p>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 16, marginTop: 12,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          style={qtyBtnStyle}>−</button>
                        <span style={{
                          width: 44, textAlign: 'center', padding: '8px 0',
                          background: '#fff', border: '1px solid #c4c7c8', borderLeft: 'none', borderRight: 'none',
                          fontSize: 13, fontWeight: 600,
                        }}>{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          style={qtyBtnStyle}>+</button>
                      </div>
                      <button
                        onClick={() => removeItem(item.productId)}
                        style={{
                          background: 'none', border: 'none', color: '#ba1a1a',
                          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                          cursor: 'pointer', fontFamily: "'Hanken Grotesk', sans-serif",
                        }}>KALDIR</button>
                    </div>
                  </div>
                  <div style={{
                    minWidth: 100, textAlign: 'right', fontSize: 16, fontWeight: 700,
                    color: '#191c1e',
                  }}>
                    {formatPrice(item.price * item.quantity, item.currency)}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div style={{
              background: '#fff', border: '1px solid #c4c7c8', padding: 24,
              position: 'sticky', top: 24,
            }}>
              <h3 style={{
                margin: '0 0 20px', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em',
                color: '#191c1e', fontFamily: "'Hanken Grotesk', sans-serif",
              }}>ÖZET</h3>
              <SummaryRow label="Ara Toplam" value={formatPrice(subtotal)} />
              <SummaryRow
                label="Kargo"
                value={shipping === 0 ? 'ÜCRETSİZ' : formatPrice(shipping)}
              />
              {shipping > 0 && (
                <p style={{
                  fontSize: 11, color: '#747878', margin: '8px 0 16px',
                  fontStyle: 'italic',
                }}>₺200 üstü ücretsiz kargo</p>
              )}
              <div style={{ borderTop: '1px solid #c4c7c8', paddingTop: 16, marginTop: 16 }}>
                <SummaryRow label="Toplam" value={formatPrice(total)} bold />
              </div>
              <button
                onClick={() => navigate('/marketplace/checkout')}
                style={{
                  width: '100%', marginTop: 24,
                  background: '#121926', color: '#fff', border: 'none',
                  padding: '16px 24px', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.15em', cursor: 'pointer',
                  fontFamily: "'Hanken Grotesk', sans-serif",
                }}>ÖDEMEYE GEÇ</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const qtyBtnStyle = {
  width: 32, height: 32,
  background: '#fff', border: '1px solid #c4c7c8',
  cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#191c1e',
};

function SummaryRow({ label, value, bold }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 8, fontSize: bold ? 16 : 13,
      fontWeight: bold ? 700 : 500,
      color: bold ? '#191c1e' : '#444748',
    }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
