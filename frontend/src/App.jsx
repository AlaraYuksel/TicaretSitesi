import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Sayfalarımızı içe aktarıyoruz
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';

function App() {
  return (
    <Router>
      <Routes>
        {/* Ana sayfa olarak Auth (Giriş/Kayıt) ekranını gösteriyoruz */}
        <Route path="/" element={<Auth />} />
        
        {/* Dashboard sayfası */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Editör sayfası */}
        <Route path="/editor" element={<Editor />} />
        
        {/* Olmayan bir URL girilirse Dashboard'a yönlendir (veya 404 sayfası yapabilirsin) */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;