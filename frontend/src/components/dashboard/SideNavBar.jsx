import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiSellerListQuestions, apiSellerListMarketplaceOrders } from '../../lib/api';

// Dashboard sol navigasyon. Sayfa load'unda satıcının bekleyen sorularını ve
// onay bekleyen siparişlerini sayar, badge olarak gösterir.
export default function SideNavBar({ activeKey }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingQ, setPendingQ] = useState(0);
  const [pendingO, setPendingO] = useState(0);

  // Aktif key prop verilmemişse path'ten türet
  const active = activeKey || (
    location.pathname.startsWith('/dashboard/questions') ? 'questions' :
    location.pathname.startsWith('/dashboard/orders')    ? 'orders'    :
    location.pathname.startsWith('/dashboard/balance')   ? 'balance'   :
    'sites'
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [qc, oc] = await Promise.all([
          apiSellerListQuestions('', true).catch(() => ({ count: 0 })),
          apiSellerListMarketplaceOrders('pending_approval', true).catch(() => ({ count: 0 })),
        ]);
        if (!alive) return;
        setPendingQ(qc.count || 0);
        setPendingO(oc.count || 0);
      } catch {}
    })();
    return () => { alive = false; };
  }, [location.pathname]);

  const navLinks = [
    { key: 'sites',     icon: 'dashboard',                 label: 'My Sites',          to: '/dashboard' },
    { key: 'questions', icon: 'help_outline',              label: 'Müşteri Soruları',  to: '/dashboard/questions', badge: pendingQ },
    { key: 'orders',    icon: 'receipt_long',              label: 'Siparişler',        to: '/dashboard/orders',    badge: pendingO },
    { key: 'balance',   icon: 'account_balance_wallet',    label: 'Bakiye',            to: '/dashboard/balance' },
    { key: 'templates', icon: 'web',                       label: 'Templates' },
    { key: 'trash',     icon: 'delete',                    label: 'Trash' },
    { key: 'settings',  icon: 'settings',                  label: 'Settings' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full flex flex-col py-8 px-4 z-40 bg-[#1c1b1b] w-64 mt-16 border-r border-outline-variant/5">
      <div className="mb-8 px-2">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-primary-container rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary-container text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              architecture
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#e5e2e1]">Workspace</h3>
            <p className="text-[0.6875rem] text-[#c1c6d7] uppercase tracking-wider">Pro Plan</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navLinks.map((link) => {
          const isActive = active === link.key;
          return (
            <button
              key={link.key}
              onClick={() => link.to && navigate(link.to)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md transition-all duration-200 ${
                isActive
                  ? 'text-[#e5e2e1] bg-[#2a2a2a]'
                  : 'text-[#c1c6d7] hover:bg-[#353534] hover:text-[#e5e2e1] opacity-80 hover:opacity-100'
              }`}
              style={{ background: 'transparent', border: 'none', cursor: link.to ? 'pointer' : 'default', textAlign: 'left' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="material-symbols-outlined">{link.icon}</span>
                <span className="text-sm font-inter">{link.label}</span>
              </span>
              {link.badge > 0 && (
                <span style={{
                  background: '#ef4444', color: '#fff', minWidth: 20, height: 20,
                  borderRadius: 10, padding: '0 6px', fontSize: 11, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{link.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-8 border-t border-outline-variant/10 space-y-1">
        <a href="#" className="flex items-center gap-3 px-3 py-2 text-[#c1c6d7] hover:bg-[#353534] hover:text-[#e5e2e1] rounded-md transition-all duration-200 opacity-80 hover:opacity-100">
          <span className="material-symbols-outlined">help_outline</span>
          <span className="text-sm font-inter">Help</span>
        </a>
        <a href="#" className="flex items-center gap-3 px-3 py-2 text-[#c1c6d7] hover:bg-[#353534] hover:text-[#e5e2e1] rounded-md transition-all duration-200 opacity-80 hover:opacity-100">
          <span className="material-symbols-outlined">chat_bubble_outline</span>
          <span className="text-sm font-inter">Feedback</span>
        </a>
      </div>
    </aside>
  );
}
