import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Elements, CardElement, useStripe, useElements,
} from '@stripe/react-stripe-js';
import { useAuthStore } from '../store/useAuthStore';
import {
  apiBuyerUpdateProfile,
  apiBuyerListAddresses, apiBuyerCreateAddress, apiBuyerUpdateAddress,
  apiBuyerDeleteAddress, apiBuyerSetDefaultAddress,
  apiBuyerListPaymentMethods, apiBuyerCreateSetupIntent, apiBuyerAttachPaymentMethod,
  apiBuyerDeletePaymentMethod, apiBuyerSetDefaultPaymentMethod,
  apiBuyerListOrders, apiBuyerCancelOrder,
} from '../lib/api';
import { getStripe } from '../lib/stripe';

const formatPrice = (kurus) => `₺${(kurus / 100).toFixed(2)}`;
const formatDate = (iso) => iso ? new Date(iso).toLocaleString('tr-TR') : '';

const TABS = ['profile', 'addresses', 'payments', 'orders'];

export default function MarketplaceAccount() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, logout, checkAuth } = useAuthStore();
  const [tab, setTab] = useState(() => params.get('tab') || 'profile');

  useEffect(() => {
    if (!user) checkAuth();
  }, [user, checkAuth]);

  useEffect(() => {
    setParams({ tab }, { replace: true });
  }, [tab, setParams]);

  if (!user) {
    return <div style={{ padding: 48, fontFamily: 'Inter, sans-serif', color: '#5d5f5f' }}>Yükleniyor...</div>;
  }

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <nav style={navStyle}>
          <a href="/marketplace" style={logoStyle}>MARKETPLACE</a>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#5d5f5f' }}>{user.email}</span>
            <button onClick={() => { logout(); navigate('/marketplace'); }} style={smallLinkBtn}>
              ÇIKIŞ
            </button>
          </div>
        </nav>
      </header>

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 24px', color: '#191c1e', fontFamily: "'Hanken Grotesk', sans-serif" }}>
          Hesabım
        </h1>

        <div style={{ display: 'flex', gap: 8, marginBottom: 32, borderBottom: '1px solid #c4c7c8' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '12px 16px', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
              color: tab === t ? '#191c1e' : '#747878',
              borderBottom: tab === t ? '2px solid #121926' : '2px solid transparent',
              fontFamily: "'Hanken Grotesk', sans-serif",
            }}>{LABELS[t]}</button>
          ))}
        </div>

        {tab === 'profile' && <ProfileTab user={user} onUpdated={checkAuth} />}
        {tab === 'addresses' && <AddressesTab />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'orders' && <OrdersTab />}
      </main>
    </div>
  );
}

const LABELS = { profile: 'PROFİL', addresses: 'ADRESLER', payments: 'KARTLAR', orders: 'SİPARİŞLERİM' };

// ─── Profil ─────────────────────────────────────────────────────────────

function ProfileTab({ user, onUpdated }) {
  const [fullName, setFullName] = useState(user.full_name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await apiBuyerUpdateProfile({ full_name: fullName, phone });
      setMsg({ ok: true, text: 'Profil güncellendi' });
      onUpdated && onUpdated();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <SectionTitle>Profil Bilgileri</SectionTitle>
      <form onSubmit={handleSave}>
        <ReadonlyField label="E-posta" value={user.email} />
        <Field label="Ad Soyad" value={fullName} onChange={setFullName} />
        <Field label="Telefon" value={phone} onChange={setPhone} placeholder="+905551234567" />
        {msg && <Banner ok={msg.ok}>{msg.text}</Banner>}
        <PrimaryBtn type="submit" disabled={saving}>{saving ? 'KAYDEDİLİYOR...' : 'KAYDET'}</PrimaryBtn>
      </form>
    </Card>
  );
}

// ─── Adresler ──────────────────────────────────────────────────────────

function AddressesTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      setList(await apiBuyerListAddresses());
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Adresi silmek istediğinize emin misiniz?')) return;
    try {
      await apiBuyerDeleteAddress(id);
      reload();
    } catch (err) { alert(err.message); }
  };

  const handleSetDefault = async (id) => {
    try { await apiBuyerSetDefaultAddress(id); reload(); }
    catch (err) { alert(err.message); }
  };

  if (loading) return <Card>Yükleniyor...</Card>;

  return (
    <>
      {!showForm && !editing && (
        <div style={{ marginBottom: 16 }}>
          <PrimaryBtn onClick={() => setShowForm(true)}>+ YENİ ADRES EKLE</PrimaryBtn>
        </div>
      )}

      {(showForm || editing) && (
        <Card>
          <AddressForm
            initial={editing}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            onSaved={() => { setShowForm(false); setEditing(null); reload(); }}
          />
        </Card>
      )}

      {list.length === 0 && !showForm && (
        <Card>
          <p style={{ margin: 0, color: '#5d5f5f' }}>Henüz kayıtlı adresiniz yok.</p>
        </Card>
      )}

      {list.map(a => (
        <Card key={a.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                {a.label && <Tag>{a.label}</Tag>}
                {a.is_default && <Tag color="#1f7a3c">Varsayılan</Tag>}
              </div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{a.recipient_name}</div>
              <div style={{ color: '#5d5f5f', fontSize: 13 }}>{a.phone}</div>
              <div style={{ color: '#444748', fontSize: 13, marginTop: 6 }}>
                {a.line1}{a.line2 ? `, ${a.line2}` : ''}
                <br />
                {a.city}{a.state ? ` / ${a.state}` : ''}{a.zip ? ` ${a.zip}` : ''} — {a.country}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
              {!a.is_default && (
                <button onClick={() => handleSetDefault(a.id)} style={smallLinkBtn}>Varsayılan Yap</button>
              )}
              <button onClick={() => setEditing(a)} style={smallLinkBtn}>Düzenle</button>
              <button onClick={() => handleDelete(a.id)} style={{ ...smallLinkBtn, color: '#7f1d1d' }}>Sil</button>
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}

function AddressForm({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState(initial || {
    label: '', recipient_name: '', phone: '',
    line1: '', line2: '', city: '', state: '', zip: '', country: 'TR',
    is_default: false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const payload = {
        label: form.label, recipient_name: form.recipient_name, phone: form.phone,
        line1: form.line1, line2: form.line2,
        city: form.city, state: form.state, zip: form.zip, country: form.country || 'TR',
        is_default: !!form.is_default,
      };
      if (initial) await apiBuyerUpdateAddress(initial.id, payload);
      else await apiBuyerCreateAddress(payload);
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit}>
      <SectionTitle>{initial ? 'Adresi Düzenle' : 'Yeni Adres'}</SectionTitle>
      <Field label="Etiket (ör. Ev, İş)" value={form.label} onChange={v => set('label', v)} />
      <Field label="Alıcı Adı *" value={form.recipient_name} onChange={v => set('recipient_name', v)} />
      <Field label="Telefon *" value={form.phone} onChange={v => set('phone', v)} placeholder="+905551234567" />
      <Field label="Adres Satırı 1 *" value={form.line1} onChange={v => set('line1', v)} />
      <Field label="Adres Satırı 2" value={form.line2} onChange={v => set('line2', v)} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
        <Field label="Şehir *" value={form.city} onChange={v => set('city', v)} />
        <Field label="İlçe" value={form.state} onChange={v => set('state', v)} />
        <Field label="Posta Kodu" value={form.zip} onChange={v => set('zip', v)} />
      </div>
      <Field label="Ülke" value={form.country} onChange={v => set('country', v)} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16 }}>
        <input type="checkbox" checked={!!form.is_default} onChange={e => set('is_default', e.target.checked)} />
        Varsayılan adres olarak ayarla
      </label>
      {err && <Banner>{err}</Banner>}
      <div style={{ display: 'flex', gap: 12 }}>
        <PrimaryBtn type="submit" disabled={saving}>{saving ? 'KAYDEDİLİYOR...' : 'KAYDET'}</PrimaryBtn>
        <SecondaryBtn type="button" onClick={onCancel}>VAZGEÇ</SecondaryBtn>
      </div>
    </form>
  );
}

// ─── Ödeme Yöntemleri (Stripe Elements ile) ───────────────────────────

function PaymentsTab() {
  // Stripe.js yalnızca Ödeme Yöntemleri sekmesi açıldığında yüklenir (lazy).
  const [stripePromise] = useState(() => getStripe());
  if (!stripePromise) {
    return (
      <Card>
        <Banner>
          VITE_STRIPE_PUBLISHABLE_KEY tanımlı değil. Yeni kart eklemek için .env'e
          test mode key'i ekleyin (pk_test_...).
        </Banner>
      </Card>
    );
  }
  return (
    <Elements stripe={stripePromise}>
      <PaymentsTabInner />
    </Elements>
  );
}

function PaymentsTabInner() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const reload = async () => {
    setLoading(true);
    try { setList(await apiBuyerListPaymentMethods()); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Kartı silmek istediğinize emin misiniz?')) return;
    try { await apiBuyerDeletePaymentMethod(id); reload(); }
    catch (e) { alert(e.message); }
  };

  const handleSetDefault = async (id) => {
    try { await apiBuyerSetDefaultPaymentMethod(id); reload(); }
    catch (e) { alert(e.message); }
  };

  if (loading) return <Card>Yükleniyor...</Card>;

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        {!showAdd && <PrimaryBtn onClick={() => setShowAdd(true)}>+ YENİ KART EKLE</PrimaryBtn>}
      </div>

      {showAdd && (
        <Card>
          <AddCardForm onCancel={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); reload(); }} />
        </Card>
      )}

      {list.length === 0 && !showAdd && (
        <Card><p style={{ margin: 0, color: '#5d5f5f' }}>Henüz kayıtlı kartınız yok.</p></Card>
      )}

      {list.map(pm => (
        <Card key={pm.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{pm.brand}</span>
                <span style={{ color: '#5d5f5f' }}>•••• {pm.last4}</span>
                {pm.is_default && <Tag color="#1f7a3c">Varsayılan</Tag>}
              </div>
              <div style={{ fontSize: 12, color: '#747878' }}>
                Son Kullanma: {String(pm.exp_month).padStart(2, '0')}/{String(pm.exp_year).slice(-2)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!pm.is_default && <button onClick={() => handleSetDefault(pm.id)} style={smallLinkBtn}>Varsayılan Yap</button>}
              <button onClick={() => handleDelete(pm.id)} style={{ ...smallLinkBtn, color: '#7f1d1d' }}>Sil</button>
            </div>
          </div>
        </Card>
      ))}

      <p style={{ fontSize: 12, color: '#747878', marginTop: 16 }}>
        🔒 Kart bilgileriniz Stripe (PCI DSS Level 1) tarafından saklanır. Bu sitenin
        sunucularında yalnızca kartın markası, son 4 hanesi ve son kullanma tarihi yer alır.
      </p>
    </>
  );
}

function AddCardForm({ onCancel, onSaved }) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [setAsDefault, setSetAsDefault] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSaving(true); setErr(null);
    try {
      const { client_secret } = await apiBuyerCreateSetupIntent();
      const card = elements.getElement(CardElement);
      const result = await stripe.confirmCardSetup(client_secret, {
        payment_method: { card },
      });
      if (result.error) throw new Error(result.error.message);
      const pmID = result.setupIntent.payment_method;
      await apiBuyerAttachPaymentMethod(pmID, setAsDefault);
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit}>
      <SectionTitle>Yeni Kart</SectionTitle>
      <div style={{
        border: '1px solid #c4c7c8', padding: '14px',
        marginBottom: 16, background: '#fff',
      }}>
        <CardElement options={{ style: { base: { fontSize: '14px', color: '#191c1e' } } }} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16 }}>
        <input type="checkbox" checked={setAsDefault} onChange={e => setSetAsDefault(e.target.checked)} />
        Varsayılan kart olarak ayarla
      </label>
      {err && <Banner>{err}</Banner>}
      <div style={{ display: 'flex', gap: 12 }}>
        <PrimaryBtn type="submit" disabled={!stripe || saving}>{saving ? 'KAYDEDİLİYOR...' : 'KARTI KAYDET'}</PrimaryBtn>
        <SecondaryBtn type="button" onClick={onCancel}>VAZGEÇ</SecondaryBtn>
      </div>
    </form>
  );
}

// ─── Siparişlerim ──────────────────────────────────────────────────────

function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  const reload = async () => {
    setLoading(true);
    try { setOrders(await apiBuyerListOrders()); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const cancel = async (o) => {
    const reason = prompt('İptal sebebi (opsiyonel):') ?? '';
    if (!confirm('Siparişi iptal etmek istediğinize emin misiniz? Ödeme yapılmışsa otomatik iade tetiklenir.')) return;
    setBusy(b => ({ ...b, [o.id]: true }));
    try { await apiBuyerCancelOrder(o.id, reason); await reload(); }
    catch (e) { alert(e.message); }
    finally { setBusy(b => ({ ...b, [o.id]: false })); }
  };

  if (loading) return <Card>Yükleniyor...</Card>;
  if (orders.length === 0) {
    return <Card><p style={{ margin: 0, color: '#5d5f5f' }}>Henüz siparişiniz yok.</p></Card>;
  }

  const canCancel = (o) => o.status !== 'shipped' && o.status !== 'delivered' && o.status !== 'cancelled';

  return orders.map(o => (
    <Card key={o.id}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>{o.order_number}</div>
          <div style={{ fontSize: 12, color: '#747878' }}>{formatDate(o.created_at)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{formatPrice(o.total_amount)}</div>
          <StatusBadge status={o.status} approval={o.approval_status} payment={o.payment_status} />
        </div>
      </div>
      {o.tracking_number && (
        <div style={{ fontSize: 12, color: '#444748', marginBottom: 8 }}>
          Kargo: <strong>{o.carrier || 'Bilinmiyor'}</strong> · Takip No: {o.tracking_number}
          {o.tracking_url && <> · <a href={o.tracking_url} target="_blank" rel="noopener noreferrer" style={{ color: '#121926' }}>Takip Et</a></>}
        </div>
      )}
      {canCancel(o) && (
        <button disabled={!!busy[o.id]} onClick={() => cancel(o)} style={{
          background: 'transparent', border: '1px solid #7f1d1d', color: '#7f1d1d',
          padding: '8px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
          cursor: 'pointer', marginTop: 4,
        }}>
          {busy[o.id] ? 'İPTAL EDİLİYOR...' : 'SİPARİŞİ İPTAL ET'}
        </button>
      )}
    </Card>
  ));
}

function StatusBadge({ status, approval, payment }) {
  let label = status, color = '#747878';
  if (payment === 'refunded' || approval === 'rejected') { label = 'İade'; color = '#7f1d1d'; }
  else if (status === 'delivered') { label = 'Teslim Edildi'; color = '#1f7a3c'; }
  else if (status === 'shipped') { label = 'Kargoda'; color = '#1e40af'; }
  else if (approval === 'pending_approval') { label = 'Onay Bekliyor'; color = '#a16207'; }
  else if (status === 'confirmed' || approval === 'approved') { label = 'Hazırlanıyor'; color = '#1e40af'; }
  return (
    <span style={{
      display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 700,
      padding: '3px 10px', background: color, color: '#fff',
      letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>{label}</span>
  );
}

// ─── Reusable bits ─────────────────────────────────────────────────────

const pageStyle = { minHeight: '100vh', background: '#f7f9fc', color: '#191c1e', fontFamily: "'Inter', sans-serif" };
const headerStyle = { background: '#fff', borderBottom: '1px solid #c4c7c8' };
const navStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 72 };
const logoStyle = { fontSize: 20, fontWeight: 700, color: '#191c1e', textDecoration: 'none', fontFamily: "'Hanken Grotesk', sans-serif" };
const smallLinkBtn = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: '#5d5f5f' };

function Card({ children }) {
  return <div style={{ background: '#fff', border: '1px solid #c4c7c8', padding: 24, marginBottom: 16 }}>{children}</div>;
}

function SectionTitle({ children }) {
  return <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', color: '#5d5f5f', fontFamily: "'Hanken Grotesk', sans-serif", textTransform: 'uppercase' }}>{children}</h3>;
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: '#5d5f5f', marginBottom: 6, textTransform: 'uppercase' }}>{label}</label>
      <input type={type} value={value || ''} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', border: '1px solid #c4c7c8', background: '#fff', outline: 'none', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
    </div>
  );
}

function ReadonlyField({ label, value }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: '#5d5f5f', marginBottom: 6, textTransform: 'uppercase' }}>{label}</label>
      <div style={{ padding: '10px 12px', border: '1px solid #eceef1', background: '#f7f9fc', color: '#444748', fontSize: 14 }}>{value}</div>
    </div>
  );
}

function PrimaryBtn({ children, type = 'button', disabled, onClick }) {
  return <button type={type} disabled={disabled} onClick={onClick} style={{
    background: '#121926', color: '#fff', border: 'none', padding: '12px 20px',
    fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
    cursor: disabled ? 'wait' : 'pointer', opacity: disabled ? 0.7 : 1,
    fontFamily: "'Hanken Grotesk', sans-serif",
  }}>{children}</button>;
}

function SecondaryBtn({ children, type = 'button', onClick }) {
  return <button type={type} onClick={onClick} style={{
    background: '#fff', color: '#121926', border: '1px solid #121926',
    padding: '12px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
    cursor: 'pointer', fontFamily: "'Hanken Grotesk', sans-serif",
  }}>{children}</button>;
}

function Tag({ children, color = '#747878' }) {
  return <span style={{
    background: color, color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
    padding: '3px 8px', textTransform: 'uppercase',
  }}>{children}</span>;
}

function Banner({ ok = false, children }) {
  return <div style={{
    background: ok ? '#dcfce7' : '#fee2e2',
    border: `1px solid ${ok ? '#86efac' : '#fecaca'}`,
    color: ok ? '#14532d' : '#7f1d1d',
    padding: '10px 14px', fontSize: 13, marginBottom: 16,
  }}>{children}</div>;
}
