import React from 'react';
import TopNavBar from './TopNavBar';
import SideNavBar from './SideNavBar';

// Dashboard alt sayfalarının ortak çerçevesi (TopNav + SideNav + content).
export default function DashboardLayout({ children, activeKey }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0c0d0d', color: '#e5e2e1' }}>
      <TopNavBar />
      <SideNavBar activeKey={activeKey} />
      <main style={{ marginLeft: 256, paddingTop: 96, padding: '96px 32px 48px 288px', fontFamily: 'Inter, sans-serif' }}>
        {children}
      </main>
    </div>
  );
}
