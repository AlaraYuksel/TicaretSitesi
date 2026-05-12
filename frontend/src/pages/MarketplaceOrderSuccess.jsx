import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiMarketplaceGetOrder } from '../lib/api';

const formatPrice = (cents) => `₺${(cents / 100).toFixed(2)}`;

export default function MarketplaceOrderSuccess() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiMarketplaceGetOrder(orderNumber)
      .then(setOrder)
      .catch(err => setError(err.message));
  }, [orderNumber]);

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 600, margin: '120px auto', textAlign: 'center', padding: 24 }}>
          <p style={{ color: '#ba1a1a' }}>Sipariş yüklenemedi: {error}</p>
          <button onClick={() => navigate('/marketplace')} style={primaryBtnStyle}>MARKETPLACE</button>
        </div>
      </div>
    );
  }
  if (!order) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'center', padding: '120px 24px', color: '#747878' }}>Yükleniyor...</div>
      </div>
    );
  }

  let items = [];
  try {
    items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  } catch (e) { /* */ }

  return (
    <div style={pageStyle}>
      <header style={{
        background: '#fff', borderBottom: '1px solid #c4c7c8',
      }}>
        <nav style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 72,
        }}>
          <a href="/marketplace" style={{
            fontSize: 20, fontWeight: 700, color: '#191c1e', textDecoration: 'none',
            fontFamily: "'Hanken Grotesk', sans-serif",
          }}>MARKETPLACE</a>
        </nav>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{
          background: '#fff', border: '1px solid #c4c7c8', padding: 48, textAlign: 'center',
        }}>
          <div style={{
            width: 72, height: 72, margin: '0 auto 24px',
            background: '#dcfce7', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#16a34a' }}>check</span>
          </div>
          <h1 style={{
            fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 12px',
            fontFamily: "'Hanken Grotesk', sans-serif",
          }}>Siparişiniz Alındı</h1>
          <p style={{ fontSize: 14, color: '#444748', margin: '0 0 8px' }}>
            Ödeme başarıyla işlendi (simülasyon). Onay e-postası en kısa sürede gönderilecek.
          </p>
          <p style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.2em',
            color: '#5d5f5f', margin: '24px 0 0',
            fontFamily: "'Hanken Grotesk', sans-serif",
          }}>SİPARİŞ NO</p>
          <p style={{
            fontSize: 20, fontWeight: 700, color: '#191c1e', margin: '4px 0 0',
            fontFamily: "'Inter', monospace",
          }}>{order.order_number}</p>
        </div>

        <div style={{
          background: '#fff', border: '1px solid #c4c7c8', padding: 32, marginTop: 24,
        }}>
          <h3 style={{
            margin: '0 0 20px', fontSize: 14, fontWeight: 700, letterSpacing: '0.15em',
            color: '#191c1e', fontFamily: "'Hanken Grotesk', sans-serif",
          }}>SİPARİŞ DETAYLARI</h3>

          {items.map((it, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '12px 0', borderBottom: '1px solid #eceef1',
              fontSize: 13,
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: '#191c1e' }}>{it.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#747878' }}>
                  {it.quantity} × {formatPrice(it.price)}
                </p>
              </div>
              <span style={{ fontWeight: 600, color: '#191c1e' }}>
                {formatPrice(it.price * it.quantity)}
              </span>
            </div>
          ))}

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #c4c7c8' }}>
            <SummaryRow label="Ara Toplam" value={formatPrice(order.subtotal)} />
            <SummaryRow label="Kargo" value={order.shipping_cost === 0 ? 'ÜCRETSİZ' : formatPrice(order.shipping_cost)} />
            <SummaryRow label="Toplam" value={formatPrice(order.total_amount)} bold />
          </div>

          <div style={{
            marginTop: 24, padding: 16, background: '#eceef1', fontSize: 12, lineHeight: 1.6,
          }}>
            <p style={{ margin: '0 0 4px', color: '#5d5f5f', fontWeight: 600 }}>
              Teslimat: <span style={{ color: '#191c1e', fontWeight: 500 }}>{order.customer_name}</span>
            </p>
            <p style={{ margin: 0, color: '#444748' }}>{order.customer_email} · {order.customer_phone}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button
            onClick={() => navigate('/marketplace')}
            style={{ ...primaryBtnStyle, flex: 1 }}>
            ALIŞVERİŞE DEVAM ET
          </button>
        </div>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: '100vh', background: '#f7f9fc', color: '#191c1e',
  fontFamily: "'Inter', 'Hanken Grotesk', sans-serif",
};

const primaryBtnStyle = {
  background: '#121926', color: '#fff', border: 'none',
  padding: '16px 24px', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.15em', cursor: 'pointer',
  fontFamily: "'Hanken Grotesk', sans-serif",
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
