import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { apiSellerGetBalance, apiSellerStripeConnect } from '../lib/api';

const formatPrice = (k) => `₺${(k / 100).toFixed(2)}`;

export default function SellerBalance() {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const reload = async () => {
    setLoading(true);
    try { setBalance(await apiSellerGetBalance()); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { redirect_url } = await apiSellerStripeConnect();
      window.location.href = redirect_url;
    } catch (e) {
      alert(e.message);
      setConnecting(false);
    }
  };

  return (
    <DashboardLayout activeKey="balance">
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 24px' }}>Bakiye</h1>

      {loading && <div style={{ color: '#999' }}>Yükleniyor...</div>}

      {balance && (
        <>
          {!balance.stripe_onboarded && (
            <div style={{
              background: '#1e1b0a', border: '1px solid #a16207',
              padding: 16, marginBottom: 24, borderRadius: 6,
            }}>
              <div style={{ fontWeight: 700, color: '#fcd34d', marginBottom: 8 }}>
                Stripe hesabınız yapılandırılmamış
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#c1c6d7' }}>
                Marketplace üzerinden gelen siparişlerden bakiyenize aktarım yapabilmek için
                Stripe Connect hesabınızı tamamlayın.
              </p>
              <button onClick={handleConnect} disabled={connecting} style={primaryBtn}>
                {connecting ? 'YÖNLENDİRİLİYOR...' : 'STRIPE İLE BAĞLAN'}
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <BalanceCard label="Çekilebilir" value={formatPrice(balance.available_amount)} color="#10b981" />
            <BalanceCard label="Bekleyen (Escrow)" value={formatPrice(balance.pending_amount)} color="#3b82f6" />
            <BalanceCard label="Brüt Ciro" value={formatPrice(balance.gross_revenue)} color="#c1c6d7" />
            <BalanceCard label="Komisyon" value={formatPrice(balance.platform_fee_total)} color="#a16207" sub={`%${balance.platform_fee_percent}`} />
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Toplam Sipariş</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{balance.order_count}</div>
          </div>

          {balance.stripe_account_id && (
            <div style={{ fontSize: 11, color: '#666', marginTop: 16 }}>
              Stripe Connect: <code>{balance.stripe_account_id}</code>
              {balance.payout_enabled ? ' · Payouts: aktif' : ' · Payouts: bekleniyor'}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}

function BalanceCard({ label, value, color, sub }) {
  return (
    <div style={{ ...cardStyle, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 12, color: '#999', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const cardStyle = { background: '#1c1b1b', border: '1px solid #2a2a2a', padding: 20, borderRadius: 6 };
const primaryBtn = { background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer' };
