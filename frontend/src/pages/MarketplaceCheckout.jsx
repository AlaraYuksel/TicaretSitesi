import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { apiMarketplaceCreateOrder } from '../lib/api';

const formatPrice = (cents) => `₺${(cents / 100).toFixed(2)}`;

export default function MarketplaceCheckout() {
  const navigate = useNavigate();
  const items = useCartStore(s => s.items);
  const subtotal = useCartStore(s => s.getSubtotal());
  const shipping = useCartStore(s => s.getShippingCost());
  const total = useCartStore(s => s.getTotal());
  const clearCart = useCartStore(s => s.clear);

  const [step, setStep] = useState(1); // 1=info, 2=payment
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [customer, setCustomer] = useState({ name: '', email: '', phone: '' });
  const [address, setAddress] = useState({ line1: '', line2: '', city: '', state: '', zip: '', country: 'TR' });
  const [card, setCard] = useState({ number: '4242 4242 4242 4242', name: '', expiry: '12/29', cvc: '123' });

  if (items.length === 0) {
    return (
      <div style={pageStyle}>
        <div style={{
          maxWidth: 600, margin: '120px auto', textAlign: 'center', padding: 24,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#a0a0a0' }}>shopping_bag</span>
          <p style={{ fontSize: 16, color: '#444748', margin: '16px 0 24px' }}>Sepetiniz boş.</p>
          <button onClick={() => navigate('/marketplace')} style={primaryBtnStyle}>MARKETPLACE'E DÖN</button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (step === 1) {
      if (!customer.name.trim() || !customer.email.trim() || !customer.phone.trim()
        || !address.line1.trim() || !address.city.trim()) {
        setError('Lütfen tüm zorunlu alanları doldurun.');
        return;
      }
      setStep(2);
      return;
    }

    // Step 2: Simüle ödeme — kart bilgileri sadece görsel doğrulama
    if (!card.number.trim() || !card.name.trim() || !card.expiry.trim() || !card.cvc.trim()) {
      setError('Lütfen kart bilgilerini eksiksiz girin (simülasyon).');
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiMarketplaceCreateOrder({
        customer,
        items: items.map(it => ({ product_id: it.productId, quantity: it.quantity })),
        shipping_address: address,
        payment_method: 'card_simulated',
      });
      clearCart();
      navigate(`/marketplace/order/${result.order_number}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Sipariş oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={pageStyle}>
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
            onClick={() => navigate('/marketplace/cart')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#5d5f5f',
              fontFamily: "'Hanken Grotesk', sans-serif",
            }}>← SEPETE DÖN</button>
        </nav>
      </header>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px' }}>
        {/* Steps */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 60, marginBottom: 40,
        }}>
          {['Bilgiler', 'Ödeme'].map((label, i) => {
            const active = step === i + 1;
            const done = step > i + 1;
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: done || active ? '#121926' : '#eceef1',
                  color: done || active ? '#fff' : '#747878',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, fontFamily: "'Hanken Grotesk', sans-serif",
                }}>{done ? '✓' : i + 1}</div>
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
                  color: active || done ? '#191c1e' : '#747878',
                  fontFamily: "'Hanken Grotesk', sans-serif",
                }}>{label.toUpperCase()}</span>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 40, alignItems: 'flex-start',
        }}>
          <div style={{ background: '#fff', border: '1px solid #c4c7c8', padding: 32 }}>
            {step === 1 ? (
              <>
                <SectionTitle>İLETİŞİM BİLGİLERİ</SectionTitle>
                <Field label="Ad Soyad *" value={customer.name} onChange={v => setCustomer({ ...customer, name: v })} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field label="E-posta *" type="email" value={customer.email} onChange={v => setCustomer({ ...customer, email: v })} />
                  <Field label="Telefon *" placeholder="+905551234567" value={customer.phone} onChange={v => setCustomer({ ...customer, phone: v })} />
                </div>

                <SectionTitle style={{ marginTop: 32 }}>TESLİMAT ADRESİ</SectionTitle>
                <Field label="Adres Satırı 1 *" value={address.line1} onChange={v => setAddress({ ...address, line1: v })} />
                <Field label="Adres Satırı 2 (opsiyonel)" value={address.line2} onChange={v => setAddress({ ...address, line2: v })} />
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
                  <Field label="Şehir *" value={address.city} onChange={v => setAddress({ ...address, city: v })} />
                  <Field label="İlçe" value={address.state} onChange={v => setAddress({ ...address, state: v })} />
                  <Field label="Posta Kodu" value={address.zip} onChange={v => setAddress({ ...address, zip: v })} />
                </div>
              </>
            ) : (
              <>
                <SectionTitle>ÖDEME BİLGİLERİ (SİMÜLASYON)</SectionTitle>
                <div style={{
                  background: '#fef3c7', border: '1px solid #fde68a', color: '#78350f',
                  padding: '12px 16px', fontSize: 12, marginBottom: 20, lineHeight: 1.5,
                }}>
                  ⚠️ <strong>Simüle ödeme modu.</strong> Kart bilgileri yalnızca form doğrulaması içindir;
                  gerçek bir tahsilat yapılmaz. Sipariş otomatik olarak "ödendi" olarak işaretlenir.
                </div>
                <Field label="Kart Numarası" value={card.number} onChange={v => setCard({ ...card, number: v })} />
                <Field label="Kart Üzerindeki İsim" value={card.name} onChange={v => setCard({ ...card, name: v })} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field label="Son Kullanma (AA/YY)" value={card.expiry} onChange={v => setCard({ ...card, expiry: v })} />
                  <Field label="CVC" value={card.cvc} onChange={v => setCard({ ...card, cvc: v })} />
                </div>
              </>
            )}

            {error && (
              <div style={{
                background: '#fee2e2', border: '1px solid #fecaca', color: '#7f1d1d',
                padding: '10px 14px', fontSize: 13, marginTop: 20,
              }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              {step === 2 && (
                <button type="button" onClick={() => setStep(1)} style={secondaryBtnStyle}>
                  ← GERİ
                </button>
              )}
              <button type="submit" disabled={submitting} style={{
                ...primaryBtnStyle, flex: 1, opacity: submitting ? 0.7 : 1,
                cursor: submitting ? 'wait' : 'pointer',
              }}>
                {submitting ? 'İŞLENİYOR...' : step === 1 ? 'DEVAM ET' : `₺${(total / 100).toFixed(2)} ÖDE`}
              </button>
            </div>
          </div>

          {/* Order Summary */}
          <div style={{
            background: '#fff', border: '1px solid #c4c7c8', padding: 24,
            position: 'sticky', top: 24,
          }}>
            <h3 style={{
              margin: '0 0 20px', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em',
              color: '#191c1e', fontFamily: "'Hanken Grotesk', sans-serif",
            }}>SİPARİŞ ÖZETİ</h3>

            <div style={{ marginBottom: 20 }}>
              {items.map(item => (
                <div key={item.productId} style={{
                  display: 'flex', gap: 12, marginBottom: 12, paddingBottom: 12,
                  borderBottom: '1px solid #eceef1',
                }}>
                  <div style={{
                    width: 50, height: 60, background: '#eceef1', flexShrink: 0,
                    overflow: 'hidden', position: 'relative',
                  }}>
                    {item.image && <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <span style={{
                      position: 'absolute', top: -6, right: -6,
                      background: '#121926', color: '#fff', width: 18, height: 18,
                      borderRadius: '50%', fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{item.quantity}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 12, fontWeight: 600, color: '#191c1e',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{item.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#747878' }}>
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <SummaryRow label="Ara Toplam" value={formatPrice(subtotal)} />
            <SummaryRow label="Kargo" value={shipping === 0 ? 'ÜCRETSİZ' : formatPrice(shipping)} />
            <div style={{ borderTop: '1px solid #c4c7c8', paddingTop: 12, marginTop: 12 }}>
              <SummaryRow label="Toplam" value={formatPrice(total)} bold />
            </div>
          </div>
        </form>
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

const secondaryBtnStyle = {
  background: '#fff', color: '#121926', border: '1px solid #121926',
  padding: '16px 24px', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.15em', cursor: 'pointer',
  fontFamily: "'Hanken Grotesk', sans-serif",
};

function SectionTitle({ children, style }) {
  return (
    <h3 style={{
      margin: '0 0 16px', fontSize: 12, fontWeight: 700, letterSpacing: '0.15em',
      color: '#5d5f5f', fontFamily: "'Hanken Grotesk', sans-serif", ...style,
    }}>{children}</h3>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
        color: '#5d5f5f', marginBottom: 6,
      }}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '12px 14px', border: '1px solid #c4c7c8',
          background: '#fff', outline: 'none', fontSize: 14, color: '#191c1e',
          fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

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
