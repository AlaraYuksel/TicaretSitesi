import React, { useState } from 'react';

// ─── SİPARİŞ TAKİP PORTALI ──────────────────────────────────────────────────
// Website builder'dan bağımsız. Ziyaretçiler sipariş durumunu görebilir.
// Akış: E-posta + Telefon → OTP Kod → Sipariş Listesi

const API_BASE = '/api';

const STATUS_MAP = {
  pending: { label: 'Beklemede', color: '#f59e0b', icon: 'schedule' },
  confirmed: { label: 'Onaylandı', color: '#3b82f6', icon: 'check_circle' },
  processing: { label: 'Hazırlanıyor', color: '#8b5cf6', icon: 'inventory' },
  shipped: { label: 'Kargoda', color: '#06b6d4', icon: 'local_shipping' },
  delivered: { label: 'Teslim Edildi', color: '#22c55e', icon: 'done_all' },
  completed: { label: 'Tamamlandı', color: '#10b981', icon: 'verified' },
  cancelled: { label: 'İptal Edildi', color: '#ef4444', icon: 'cancel' },
};

const PAYMENT_MAP = {
  pending: { label: 'Ödeme Bekleniyor', color: '#f59e0b' },
  paid: { label: 'Ödendi', color: '#22c55e' },
  refunded: { label: 'İade Edildi', color: '#8b5cf6' },
  failed: { label: 'Başarısız', color: '#ef4444' },
};

function formatPrice(amount) {
  return (amount / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('tr-TR', { 
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });
}

export default function OrderTracker() {
  const [step, setStep] = useState('form'); // form | otp | orders
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');

  // ── OTP Talep Et ─────────────────────────────────────────────────────────
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/storefront/orders/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bir hata oluştu');
      if (data._dev_code) setDevCode(data._dev_code);
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── OTP Doğrula ──────────────────────────────────────────────────────────
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/storefront/orders/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), phone: phone.trim(), code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Doğrulama başarısız');
      setOrders(data.orders || []);
      setStep('orders');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Stil Sabitleri ───────────────────────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '14px 18px', background: '#1e1e1e',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
    color: '#e5e2e1', fontSize: 14, outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box', transition: 'border-color 0.2s',
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6, display: 'block' };
  const btnStyle = {
    width: '100%', padding: '14px', background: '#4b8eff', color: '#fff',
    border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700,
    cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', flexDirection: 'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />

      {/* Header */}
      <header style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#4b8eff', fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#e5e2e1' }}>Sipariş Takip</span>
        </div>
        {step !== 'form' && (
          <button onClick={() => { setStep('form'); setOrders([]); setSelectedOrder(null); setError(''); setOtpCode(''); }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#888', padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            Yeni Sorgulama
          </button>
        )}
      </header>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>

        {/* ── STEP 1: E-posta + Telefon Formu ──────────────────────────────── */}
        {step === 'form' && (
          <div style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(75,142,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#4b8eff', fontVariationSettings: "'FILL' 1" }}>package_2</span>
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#e5e2e1', margin: '0 0 8px' }}>Siparişinizi Takip Edin</h1>
              <p style={{ fontSize: 14, color: '#666', margin: 0, lineHeight: 1.6 }}>
                Sipariş verirken kullandığınız e-posta ve telefon numarasını girin
              </p>
            </div>

            <form onSubmit={handleRequestOTP} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>E-posta Adresi <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@email.com" required style={inputStyle} onFocus={e => e.target.style.borderColor = '#4b8eff'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              </div>
              <div>
                <label style={labelStyle}>Telefon Numarası <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+90 555 123 45 67" required style={inputStyle} onFocus={e => e.target.style.borderColor = '#4b8eff'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              </div>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#ef4444', fontWeight: 500 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Gönderiliyor...' : 'Doğrulama Kodu Gönder'}
              </button>
            </form>
          </div>
        )}

        {/* ── STEP 2: OTP Doğrulama ────────────────────────────────────────── */}
        {step === 'otp' && (
          <div style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#22c55e', fontVariationSettings: "'FILL' 1" }}>sms</span>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#e5e2e1', margin: '0 0 8px' }}>Doğrulama Kodu</h2>
              <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.6 }}>
                <strong style={{ color: '#9ca3af' }}>{email}</strong> adresine gönderilen 6 haneli kodu girin
              </p>
            </div>

            {devCode && (
              <div style={{ background: 'rgba(75,142,255,0.08)', border: '1px solid rgba(75,142,255,0.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, textAlign: 'center' }}>
                <span style={{ fontSize: 10, color: '#4b8eff', fontWeight: 600 }}>DEV MODE — Kod: </span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#4b8eff', letterSpacing: 4 }}>{devCode}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <input type="text" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} required style={{ ...inputStyle, textAlign: 'center', fontSize: 28, fontWeight: 800, letterSpacing: 12 }} />

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#ef4444', fontWeight: 500 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading || otpCode.length !== 6} style={{ ...btnStyle, background: '#22c55e', opacity: (loading || otpCode.length !== 6) ? 0.5 : 1 }}>
                {loading ? 'Doğrulanıyor...' : 'Doğrula ve Siparişleri Göster'}
              </button>

              <button type="button" onClick={() => { setStep('form'); setError(''); }} style={{ background: 'none', border: 'none', color: '#666', fontSize: 12, cursor: 'pointer', padding: 8 }}>
                ← Geri Dön
              </button>
            </form>
          </div>
        )}

        {/* ── STEP 3: Sipariş Listesi ──────────────────────────────────────── */}
        {step === 'orders' && !selectedOrder && (
          <div style={{ width: '100%', maxWidth: 640 }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#e5e2e1', margin: '0 0 4px' }}>Siparişleriniz</h2>
              <p style={{ fontSize: 13, color: '#666', margin: 0 }}>{orders.length} sipariş bulundu</p>
            </div>

            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#444' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 12, display: 'block' }}>inbox</span>
                <p style={{ fontSize: 14 }}>Henüz sipariş bulunmuyor</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {orders.map(order => {
                  const st = STATUS_MAP[order.status] || STATUS_MAP.pending;
                  const pay = PAYMENT_MAP[order.payment_status] || PAYMENT_MAP.pending;
                  return (
                    <div key={order.id} onClick={() => setSelectedOrder(order)} style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#4b8eff44'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'none'; }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#e5e2e1' }}>{order.order_number}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${st.color}15`, padding: '4px 10px', borderRadius: 20 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: st.color, fontVariationSettings: "'FILL' 1" }}>{st.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#666' }}>{formatDate(order.created_at)}</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#e5e2e1' }}>₺{formatPrice(order.total_amount)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Sipariş Detay ────────────────────────────────────────────────── */}
        {step === 'orders' && selectedOrder && (
          <div style={{ width: '100%', maxWidth: 560 }}>
            <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', color: '#666', fontSize: 12, cursor: 'pointer', padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span> Tüm Siparişler
            </button>

            <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#e5e2e1', margin: 0 }}>{selectedOrder.order_number}</h3>
                  {(() => { const s = STATUS_MAP[selectedOrder.status] || STATUS_MAP.pending; return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${s.color}15`, padding: '6px 14px', borderRadius: 20 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: s.color, fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</span>
                    </div>
                  );})()}
                </div>
                <p style={{ fontSize: 12, color: '#666', margin: 0 }}>{formatDate(selectedOrder.created_at)}</p>
              </div>

              {/* Kargo Takip */}
              {selectedOrder.tracking_number && (
                <div style={{ padding: '16px 24px', background: 'rgba(6,182,212,0.05)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#06b6d4' }}>local_shipping</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#06b6d4' }}>Kargo Bilgileri</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
                    {selectedOrder.carrier && <span>{selectedOrder.carrier} — </span>}
                    Takip No: <strong style={{ color: '#e5e2e1' }}>{selectedOrder.tracking_number}</strong>
                  </p>
                  {selectedOrder.tracking_url && (
                    <a href={selectedOrder.tracking_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#4b8eff', textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>
                      Kargoyu Takip Et →
                    </a>
                  )}
                </div>
              )}

              {/* Ürünler */}
              <div style={{ padding: '16px 24px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Ürünler</p>
                {(() => {
                  try {
                    const items = typeof selectedOrder.items === 'string' ? JSON.parse(selectedOrder.items) : selectedOrder.items;
                    return (items || []).map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: '#1e1e1e', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e2e1' }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: '#666' }}>Adet: {item.quantity || item.qty}</div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>₺{formatPrice(item.price * (item.quantity || item.qty || 1))}</span>
                      </div>
                    ));
                  } catch { return <p style={{ fontSize: 12, color: '#666' }}>Ürün bilgisi yüklenemedi</p>; }
                })()}
              </div>

              {/* Fiyat Özeti */}
              <div style={{ padding: '16px 24px', background: '#141414', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#666' }}>Ara Toplam</span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>₺{formatPrice(selectedOrder.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: '#666' }}>Kargo</span>
                  <span style={{ fontSize: 12, color: selectedOrder.shipping_cost === 0 ? '#22c55e' : '#9ca3af' }}>
                    {selectedOrder.shipping_cost === 0 ? 'Ücretsiz' : `₺${formatPrice(selectedOrder.shipping_cost)}`}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e5e2e1' }}>Toplam</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#e5e2e1' }}>₺{formatPrice(selectedOrder.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#333', margin: 0 }}>Sipariş Takip Sistemi — Powered by Kinetic</p>
      </footer>
    </div>
  );
}
