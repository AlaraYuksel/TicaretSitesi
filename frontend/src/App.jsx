import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { isAuthenticated } from './lib/api';

// Sayfalarımızı içe aktarıyoruz
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import OrderTracker from './pages/OrderTracker';
import Marketplace from './pages/Marketplace';
import MarketplaceProduct from './pages/MarketplaceProduct';
import MarketplaceCart from './pages/MarketplaceCart';
import MarketplaceCheckout from './pages/MarketplaceCheckout';
import MarketplaceOrderSuccess from './pages/MarketplaceOrderSuccess';
import MarketplaceAuth from './pages/MarketplaceAuth';
import MarketplaceAccount from './pages/MarketplaceAccount';
import SellerQuestions from './pages/SellerQuestions';
import SellerOrders from './pages/SellerOrders';
import SellerBalance from './pages/SellerBalance';

// ─── Route Guard: Giriş yapmamış kullanıcıyı Auth'a yönlendir ───────────────
function ProtectedRoute({ children, redirectTo = '/' }) {
  const { user, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    if (!user && isAuthenticated()) {
      checkAuth();
    }
  }, []);

  // Token yoksa direkt auth'a gönder
  if (!isAuthenticated()) {
    return <Navigate to={redirectTo} replace />;
  }

  // Token var ama user henüz yüklenmedi → loading
  if (isLoading && !user) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0a0a', color: '#555',
        fontFamily: 'Inter, sans-serif', fontSize: 14
      }}>
        Yükleniyor...
      </div>
    );
  }

  return children;
}

// ─── Auth Guard: Giriş yapmış kullanıcıyı Dashboard'a yönlendir ─────────────
function AuthRoute({ children }) {
  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Ana sayfa olarak Auth (Giriş/Kayıt) ekranını gösteriyoruz */}
        <Route path="/" element={
          <AuthRoute><Auth /></AuthRoute>
        } />
        
        {/* Sipariş takip sayfası — auth gerektirmez, website builder'dan bağımsız */}
        <Route path="/track" element={<OrderTracker />} />
        
        {/* Marketplace sayfaları — auth gerektirmez */}
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/marketplace/product/:id" element={<MarketplaceProduct />} />
        <Route path="/marketplace/cart" element={<MarketplaceCart />} />
        <Route path="/marketplace/checkout" element={<MarketplaceCheckout />} />
        <Route path="/marketplace/order/:orderNumber" element={<MarketplaceOrderSuccess />} />
        <Route path="/marketplace/auth" element={<MarketplaceAuth />} />
        <Route path="/marketplace/account" element={
          <ProtectedRoute redirectTo="/marketplace/auth"><MarketplaceAccount /></ProtectedRoute>
        } />

        {/* Satıcı dashboard alt sayfaları */}
        <Route path="/dashboard/questions" element={<ProtectedRoute><SellerQuestions /></ProtectedRoute>} />
        <Route path="/dashboard/orders" element={<ProtectedRoute><SellerOrders /></ProtectedRoute>} />
        <Route path="/dashboard/balance" element={<ProtectedRoute><SellerBalance /></ProtectedRoute>} />
        
        {/* Dashboard sayfası — auth gerekli */}
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        
        {/* Editör sayfası — siteId parametresi ile */}
        <Route path="/editor/:siteId" element={
          <ProtectedRoute><Editor /></ProtectedRoute>
        } />
        
        {/* Eski /editor route'u dashboard'a yönlendir */}
        <Route path="/editor" element={<Navigate to="/dashboard" replace />} />
        
        {/* Olmayan bir URL girilirse Dashboard'a yönlendir */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;