import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Elements, CardElement, useStripe, useElements,
} from '@stripe/react-stripe-js';
import { useCartStore } from '../store/useCartStore';
import {
  apiMarketplaceCreateOrderAuth, apiMarketplaceConfirmPayment,
  apiBuyerListAddresses, apiBuyerListPaymentMethods,
  isAuthenticated,
} from '../lib/api';
import { STRIPE_PK, getStripe } from '../lib/stripe';
import { useAuthStore } from '../store/useAuthStore';

const formatPrice = (k) => `₺${(k / 100).toFixed(2)}`;

export default function MarketplaceCheckout() {
  // Stripe.js yalnızca bu sayfa açıldığında yüklenir (lazy).
  const [stripePromise] = useState(() => getStripe());
  return (
    <Elements stripe={stripePromise}>
      <CheckoutInner />
    </Elements>
  );
}

function CheckoutInner() {
  const navigate = useNavigate();
  const items = useCartStore(s => s.items);
  const subtotal = useCartStore(s => s.getSubtotal());
  const shipping = useCartStore(s => s.getShippingCost());
  const total = useCartStore(s => s.getTotal());
  const clearCart = useCartStore(s => s.clear);

  const { user, checkAuth } = useAuthStore();
  const authed = isAuthenticated();

  const [step, setStep] = useState(1); // 1=info, 2=payment
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [customer, setCustomer] = useState({ name: '', email: '', phone: '' });
  const [address, setAddress] = useState({ line1: '', line2: '', city: '', state: '', zip: '', country: 'TR' });

  // Auth — kayıtlı adres + kart listesi
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [savedAddrID, setSavedAddrID] = useState('');
  const [savedPMs, setSavedPMs] = useState([]);
  const [savedPMID, setSavedPMID] = useState('');
  const [useNewCard, setUseNewCard] = useState(false);

  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    if (authed && !user) checkAuth();
  }, [authed, user, checkAuth]);

  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        const [addrs, pms] = await Promise.all([
          apiBuyerListAddresses(), apiBuyerListPaymentMethods(),
        ]);
        setSavedAddresses(addrs);
        const def = addrs.find(a => a.is_default) || addrs[0];
        if (def) setSavedAddrID(def.id);
        setSavedPMs(pms);
        const defPM = pms.find(p => p.is_default) || pms[0];
        if (defPM) setSavedPMID(defPM.id);
        setUseNewCard(pms.length === 0);
      } catch (e) { console.error(e); }
    })();
  }, [authed]);

  // Auth varsa profilden customer'ı doldur
  useEffect(() => {
    if (user) {
      setCustomer(prev => ({
        name: prev.name || user.full_name || '',
        email: prev.email || user.email || '',
        phone: prev.phone || user.phone || '',
      }));
    }
  }, [user]);

  if (items.length === 0) {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 600, margin: '120px auto', textAlign: 'center', padding: 24 }}>
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
      // Auth + kayıtlı adres seçiliyse onun bilgisini kullan
      if (authed && savedAddrID) {
        setStep(2);
        return;
      }
      if (!customer.name.trim() || !customer.email.trim() || !customer.phone.trim()
        || !address.line1.trim() || !address.city.trim()) {
        setError('Lütfen tüm zorunlu alanları doldurun.');
        return;
      }
      setStep(2);
      return;
    }

    // STEP 2: Ödeme
    if (!stripe) {
      setError('Ödeme servisi henüz hazır değil. Lütfen sayfayı yenileyin.');
      return;
    }

    setSubmitting(true);
    try {
      let paymentMethodID = '';
      let savedPMIDValue = '';

      if (authed && savedPMID && !useNewCard) {
        // Kayıtlı kart — backend pm_xxx'i kendi DB'sinden çekecek
        savedPMIDValue = savedPMID;
      } else {
        // Yeni kart — Stripe'ta PaymentMethod oluştur ve pm_xxx'i geç
        if (!elements) { setError('Stripe Elements yüklenmedi'); setSubmitting(false); return; }
        const card = elements.getElement(CardElement);
        const { error: pmErr, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card', card,
          billing_details: {
            name: customer.name || (user && user.full_name) || '',
            email: customer.email || (user && user.email) || '',
            phone: customer.phone || (user && user.phone) || '',
          },
        });
        if (pmErr) { setError(pmErr.message); setSubmitting(false); return; }
        paymentMethodID = paymentMethod.id;
      }

      // Backend order yarat — multi-seller varsa N PaymentIntent döner
      const response = await apiMarketplaceCreateOrderAuth({
        customer,
        items: items.map(it => ({ product_id: it.productId, quantity: it.quantity })),
        shipping_address: authed && savedAddrID ? undefined : address,
        saved_address_id: authed && savedAddrID ? savedAddrID : '',
        payment_method_id: paymentMethodID,
        saved_payment_method_id: savedPMIDValue,
      });

      // Her PaymentIntent için confirm + backend'i bilgilendir
      for (const ord of response.orders) {
        if (ord.simulated) continue;
        if (!ord.client_secret) continue;
        const { error: confErr } = await stripe.confirmCardPayment(ord.client_secret, {
          payment_method: paymentMethodID || undefined,
        });
        if (confErr) throw new Error(`Sipariş ${ord.order_number}: ${confErr.message}`);
        // Webhook'a güvenmeden order'ı paid işaretle (Stripe'tan PI durumunu doğrular).
        try {
          await apiMarketplaceConfirmPayment(ord.order_id);
        } catch (e) {
          console.warn(`confirm-payment ${ord.order_number}:`, e);
        }
      }

      clearCart();
      const first = response.orders[0];
      navigate(`/marketplace/order/${first.order_number}`, {
        replace: true,
        state: { allOrders: response.orders.map(o => o.order_number) },
      });
    } catch (err) {
      setError(err.message || 'Sipariş oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  // Multi-seller uyarısı
  const sellerCount = useMemo(() => {
    const s = new Set(items.map(it => it.siteId).filter(Boolean));
    return s.size;
  }, [items]);

  return (
    <div style={pageStyle}>
      <header style={{ background: '#fff', borderBottom: '1px solid #c4c7c8' }}>
        <nav style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 72,
        }}>
          <a href="/marketplace" style={logoStyle}>MARKETPLACE</a>
          <button onClick={() => navigate('/marketplace/cart')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#5d5f5f',
            fontFamily: "'Hanken Grotesk', sans-serif",
          }}>← SEPETE DÖN</button>
        </nav>
      </header>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 60, marginBottom: 40 }}>
          {['Bilgiler', 'Ödeme'].map((label, i) => {
            const active = step === i + 1, done = step > i + 1;
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

        {sellerCount > 1 && step === 1 && (
          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe',
            color: '#1e3a8a', padding: 16, fontSize: 13, marginBottom: 24,
          }}>
            Sepetinizde <strong>{sellerCount} farklı satıcının</strong> ürünleri var.
            Her satıcı için ayrı sipariş ve ayrı ödeme oluşturulacak.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 40, alignItems: 'flex-start',
        }}>
          <div style={{ background: '#fff', border: '1px solid #c4c7c8', padding: 32 }}>
            {step === 1 ? (
              <>
                {!authed && (
                  <div style={{
                    background: '#f7f9fc', border: '1px solid #eceef1', padding: 16, marginBottom: 24,
                    fontSize: 13, color: '#444748',
                  }}>
                    Adres ve kartlarınızı kaydetmek için{' '}
                    <a href={`/marketplace/auth?next=/marketplace/checkout`} style={{ color: '#121926', fontWeight: 600 }}>giriş yapın</a>{' '}
                    veya misafir olarak devam edin.
                  </div>
                )}

                {authed && savedAddresses.length > 0 ? (
                  <>
                    <SectionTitle>TESLİMAT ADRESİ</SectionTitle>
                    {savedAddresses.map(a => (
                      <label key={a.id} style={{
                        display: 'flex', gap: 12, padding: 12, marginBottom: 8,
                        border: savedAddrID === a.id ? '2px solid #121926' : '1px solid #c4c7c8',
                        cursor: 'pointer',
                      }}>
                        <input type="radio" checked={savedAddrID === a.id}
                          onChange={() => setSavedAddrID(a.id)} />
                        <div style={{ fontSize: 13 }}>
                          <div style={{ fontWeight: 600 }}>{a.recipient_name} {a.label && <span style={{ color: '#747878', fontWeight: 400 }}>· {a.label}</span>}</div>
                          <div style={{ color: '#5d5f5f' }}>
                            {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}
                          </div>
                          <div style={{ color: '#747878', fontSize: 12 }}>{a.phone}</div>
                        </div>
                      </label>
                    ))}
                    <a href="/marketplace/account?tab=addresses" style={{ fontSize: 12, color: '#121926' }}>+ Yeni adres ekle</a>
                  </>
                ) : (
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
                )}
              </>
            ) : (
              <>
                <SectionTitle>ÖDEME BİLGİLERİ</SectionTitle>

                {!STRIPE_PK && (
                  <div style={{
                    background: '#fef3c7', border: '1px solid #fde68a', color: '#78350f',
                    padding: '12px 16px', fontSize: 12, marginBottom: 20, lineHeight: 1.5,
                  }}>
                    ⚠️ VITE_STRIPE_PUBLISHABLE_KEY tanımlı değil. Sipariş simüle olarak oluşturulacak.
                  </div>
                )}

                {authed && savedPMs.length > 0 && !useNewCard && (
                  <>
                    {savedPMs.map(pm => (
                      <label key={pm.id} style={{
                        display: 'flex', gap: 12, padding: 12, marginBottom: 8,
                        border: savedPMID === pm.id ? '2px solid #121926' : '1px solid #c4c7c8',
                        cursor: 'pointer', alignItems: 'center',
                      }}>
                        <input type="radio" checked={savedPMID === pm.id}
                          onChange={() => setSavedPMID(pm.id)} />
                        <div style={{ fontSize: 13 }}>
                          <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{pm.brand}</span>{' '}
                          •••• {pm.last4} <span style={{ color: '#747878' }}>· {String(pm.exp_month).padStart(2, '0')}/{String(pm.exp_year).slice(-2)}</span>
                        </div>
                      </label>
                    ))}
                    <button type="button" onClick={() => setUseNewCard(true)}
                      style={{ background: 'none', border: 'none', color: '#121926', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                      + Farklı bir kart kullan
                    </button>
                  </>
                )}

                {(useNewCard || !authed || savedPMs.length === 0) && STRIPE_PK && (
                  <>
                    <div style={{
                      border: '1px solid #c4c7c8', padding: '14px',
                      marginBottom: 12, background: '#fff',
                    }}>
                      <CardElement options={{ style: { base: { fontSize: '14px', color: '#191c1e' } } }} />
                    </div>
                    <p style={{ fontSize: 11, color: '#747878', margin: '0 0 16px' }}>
                      🔒 Kart bilgileri doğrudan Stripe'a gönderilir; bizim sunucumuza ulaşmaz.
                    </p>
                    {authed && savedPMs.length > 0 && (
                      <button type="button" onClick={() => setUseNewCard(false)}
                        style={{ background: 'none', border: 'none', color: '#121926', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                        ← Kayıtlı kartlara dön
                      </button>
                    )}
                  </>
                )}
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
                <button type="button" onClick={() => setStep(1)} style={secondaryBtnStyle}>← GERİ</button>
              )}
              <button type="submit" disabled={submitting} style={{
                ...primaryBtnStyle, flex: 1, opacity: submitting ? 0.7 : 1,
                cursor: submitting ? 'wait' : 'pointer',
              }}>
                {submitting ? 'İŞLENİYOR...' : step === 1 ? 'DEVAM ET' : `${formatPrice(total)} ÖDE`}
              </button>
            </div>
          </div>

          {/* Sipariş Özeti */}
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
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#191c1e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#747878' }}>{formatPrice(item.price * item.quantity)}</p>
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

const pageStyle = { minHeight: '100vh', background: '#f7f9fc', color: '#191c1e', fontFamily: "'Inter', 'Hanken Grotesk', sans-serif" };
const logoStyle = { fontSize: 20, fontWeight: 700, color: '#191c1e', textDecoration: 'none', fontFamily: "'Hanken Grotesk', sans-serif" };
const primaryBtnStyle = { background: '#121926', color: '#fff', border: 'none', padding: '16px 24px', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', cursor: 'pointer', fontFamily: "'Hanken Grotesk', sans-serif" };
const secondaryBtnStyle = { background: '#fff', color: '#121926', border: '1px solid #121926', padding: '16px 24px', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', cursor: 'pointer', fontFamily: "'Hanken Grotesk', sans-serif" };

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
