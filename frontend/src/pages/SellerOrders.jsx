import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import {
  apiSellerListMarketplaceOrders,
  apiSellerApproveOrder, apiSellerRejectOrder,
  apiSellerShipOrder, apiSellerMarkDelivered, apiSellerReleaseEscrow,
} from '../lib/api';

const formatPrice = (k) => `₺${(k / 100).toFixed(2)}`;
const formatDate = (iso) => iso ? new Date(iso).toLocaleString('tr-TR') : '';

export default function SellerOrders() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('pending_approval');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  const reload = async () => {
    setLoading(true);
    try { setList(await apiSellerListMarketplaceOrders(filter)); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [filter]);

  const wrap = (id, fn) => async () => {
    setBusy(b => ({ ...b, [id]: true }));
    try { await fn(); await reload(); }
    catch (e) { alert(e.message); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  };

  return (
    <DashboardLayout activeKey="orders">
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 24px' }}>Siparişler</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <Chip active={filter === 'pending_approval'} onClick={() => setFilter('pending_approval')}>Onay Bekleyen</Chip>
        <Chip active={filter === 'confirmed'} onClick={() => setFilter('confirmed')}>Hazırlanıyor</Chip>
        <Chip active={filter === 'shipped'} onClick={() => setFilter('shipped')}>Kargoda</Chip>
        <Chip active={filter === 'delivered'} onClick={() => setFilter('delivered')}>Teslim Edildi</Chip>
        <Chip active={filter === 'cancelled'} onClick={() => setFilter('cancelled')}>İptal/Red</Chip>
        <Chip active={filter === ''} onClick={() => setFilter('')}>Hepsi</Chip>
      </div>

      {loading && <div style={{ color: '#999' }}>Yükleniyor...</div>}
      {!loading && list.length === 0 && <div style={{ color: '#999' }}>Bu filtreye uyan sipariş yok.</div>}

      {list.map(o => (
        <OrderCard key={o.id} order={o} busy={!!busy[o.id]} wrap={(fn) => wrap(o.id, fn)} />
      ))}
    </DashboardLayout>
  );
}

function OrderCard({ order, busy, wrap }) {
  const [showShip, setShowShip] = useState(false);
  const [items, setItems] = useState([]);
  useEffect(() => {
    try {
      if (typeof order.items === 'string') setItems(JSON.parse(order.items));
      else if (Array.isArray(order.items)) setItems(order.items);
      else setItems([]);
    } catch { setItems([]); }
  }, [order.items]);

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{order.order_number}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{formatDate(order.created_at)} · {order.customer_name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{formatPrice(order.total_amount)}</div>
          <Status order={order} />
        </div>
      </div>

      <div style={{ background: '#0f0f0f', padding: 12, borderRadius: 4, marginBottom: 12 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
            <span>{it.title} × {it.quantity}</span>
            <span>{formatPrice(it.price * it.quantity)}</span>
          </div>
        ))}
      </div>

      {/* Aksiyonlar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {order.approval_status === 'pending_approval' && order.payment_status === 'paid' && (
          <>
            <button disabled={busy} style={primaryBtn} onClick={wrap(() => apiSellerApproveOrder(order.id))}>ONAYLA</button>
            <button disabled={busy} style={dangerBtn} onClick={wrap(async () => {
              const reason = prompt('Red sebebi:');
              if (reason !== null) await apiSellerRejectOrder(order.id, reason);
            })}>REDDET</button>
          </>
        )}
        {order.approval_status === 'approved' && order.status === 'confirmed' && !showShip && (
          <button disabled={busy} style={primaryBtn} onClick={() => setShowShip(true)}>KARGOYA VERDİM</button>
        )}
        {order.status === 'shipped' && (
          <button disabled={busy} style={primaryBtn} onClick={wrap(() => apiSellerMarkDelivered(order.id))}>TESLİM EDİLDİ</button>
        )}
        {order.status === 'delivered' && order.escrow_status === 'held' && (
          <button disabled={busy} style={primaryBtn} onClick={wrap(() => apiSellerReleaseEscrow(order.id))}>BAKİYEME AKTAR</button>
        )}
        {order.tracking_number && (
          <div style={{ fontSize: 12, color: '#86efac', alignSelf: 'center' }}>
            🚚 {order.carrier || ''} · {order.tracking_number}
          </div>
        )}
      </div>

      {showShip && (
        <ShipForm order={order} onCancel={() => setShowShip(false)} onShipped={() => { setShowShip(false); wrap(async () => {})(); }} />
      )}

      {order.rejected_reason && (
        <div style={{ marginTop: 12, padding: 10, background: '#1f0a0a', color: '#fca5a5', fontSize: 13, borderRadius: 4 }}>
          Red sebebi: {order.rejected_reason}
        </div>
      )}
    </div>
  );
}

function ShipForm({ order, onCancel, onShipped }) {
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier] = useState('Yurtiçi Kargo');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      await apiSellerShipOrder(order.id, { tracking_number: tracking.trim(), carrier, tracking_url: url.trim() });
      onShipped();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ marginTop: 12, padding: 12, background: '#0f0f0f', borderRadius: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
        <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Takip numarası *" style={input} />
        <input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="Kargo firması" style={input} />
      </div>
      <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Takip URL'i (opsiyonel)" style={{ ...input, marginBottom: 8 }} />
      {err && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={submit} disabled={saving || tracking.trim() === ''} style={primaryBtn}>
          {saving ? 'GÖNDERİLİYOR...' : 'KAYDET'}
        </button>
        <button onClick={onCancel} style={ghostBtn}>VAZGEÇ</button>
      </div>
    </div>
  );
}

function Status({ order }) {
  let label = order.status, color = '#666';
  if (order.payment_status === 'refunded' || order.approval_status === 'rejected') { label = 'İptal/İade'; color = '#7f1d1d'; }
  else if (order.escrow_status === 'released') { label = 'Bakiyede'; color = '#10b981'; }
  else if (order.status === 'delivered') { label = 'Teslim Edildi'; color = '#22c55e'; }
  else if (order.status === 'shipped') { label = 'Kargoda'; color = '#3b82f6'; }
  else if (order.approval_status === 'pending_approval') { label = 'Onay Bekliyor'; color = '#a16207'; }
  else if (order.status === 'confirmed') { label = 'Hazırlanıyor'; color = '#3b82f6'; }
  return <span style={{
    display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '4px 10px',
    background: color, color: '#fff', marginTop: 4,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  }}>{label}</span>;
}

const cardStyle = { background: '#1c1b1b', border: '1px solid #2a2a2a', padding: 20, marginBottom: 12, borderRadius: 6 };
const primaryBtn = { background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer' };
const dangerBtn = { background: '#7f1d1d', color: '#fff', border: 'none', padding: '10px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer' };
const ghostBtn = { background: 'transparent', color: '#c1c6d7', border: '1px solid #2a2a2a', padding: '10px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer' };
const input = { background: '#0c0d0d', color: '#e5e2e1', border: '1px solid #2a2a2a', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' };

function Chip({ active, onClick, children }) {
  return <button onClick={onClick} style={{
    background: active ? '#2a2a2a' : 'transparent', color: '#e5e2e1',
    border: '1px solid #2a2a2a', padding: '8px 16px', fontSize: 12,
    cursor: 'pointer', borderRadius: 999, fontWeight: active ? 700 : 500,
  }}>{children}</button>;
}
