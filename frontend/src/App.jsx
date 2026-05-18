import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { isAuthenticated } from './lib/api';

// Sayfalar tembel (lazy) yüklenir — her sayfa kendi chunk'ı olur, yalnızca o
// route'a gidildiğinde indirilir. Böylece açılış bundle'ı küçülür ve ödeme
// sayfalarındaki Stripe.js gibi ağır bağımlılıklar gereksiz yere yüklenmez.
const Auth = lazy(() => import('./pages/Auth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Editor = lazy(() => import('./pages/Editor'));
const OrderTracker = lazy(() => import('./pages/OrderTracker'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const MarketplaceProduct = lazy(() => import('./pages/MarketplaceProduct'));
const MarketplaceCart = lazy(() => import('./pages/MarketplaceCart'));
const MarketplaceCheckout = lazy(() => import('./pages/MarketplaceCheckout'));
const MarketplaceOrderSuccess = lazy(() => import('./pages/MarketplaceOrderSuccess'));
const MarketplaceAuth = lazy(() => import('./pages/MarketplaceAuth'));
const MarketplaceAccount = lazy(() => import('./pages/MarketplaceAccount'));
const MarketplaceSolutions = lazy(() => import('./pages/MarketplaceSolutions'));
const SellerQuestions = lazy(() => import('./pages/SellerQuestions'));
const SellerOrders = lazy(() => import('./pages/SellerOrders'));
const SellerBalance = lazy(() => import('./pages/SellerBalance'));

// Sayfa chunk'ı indirilirken gösterilen geçici ekran.
function RouteFallback() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0a0a0a', color: '#555',
      fontFamily: 'Inter, sans-serif', fontSize: 14,
    }}>
      Yükleniyor...
    </div>
  );
}

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
      <Suspense fallback={<RouteFallback />}>
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
        <Route path="/marketplace/solutions" element={
          <ProtectedRoute redirectTo="/marketplace/auth"><MarketplaceSolutions /></ProtectedRoute>
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
      </Suspense>
    </Router>
  );
}

export default App;