import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

// MarketplaceAuth — alıcı (buyer) için login + register sayfası.
// Mevcut useAuthStore'u kullanır (tek users tablosu, role'ü seller_profiles belirler).
// ?next=/marketplace/checkout gibi parametre ile geri yönlendirme yapılır.
export default function MarketplaceAuth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/marketplace';

  const { login, register, isLoading, error, clearError } = useAuthStore();
  const [mode, setMode] = useState('login'); // login | register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    const ok = mode === 'login'
      ? await login(email.trim(), password)
      : await register(email.trim(), password);
    if (ok) {
      navigate(next, { replace: true });
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <a href="/marketplace" style={{
          display: 'block', textDecoration: 'none', color: '#191c1e',
          fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: '0.05em',
          fontFamily: "'Hanken Grotesk', sans-serif",
        }}>MARKETPLACE</a>
        <p style={{ margin: '0 0 28px', fontSize: 13, color: '#5d5f5f' }}>
          {mode === 'login' ? 'Hesabınıza giriş yapın' : 'Hesap oluşturun ve alışverişe başlayın'}
        </p>

        <form onSubmit={handleSubmit}>
          <Field label="E-posta" type="email" value={email} onChange={setEmail} autoComplete="email" />
          <Field label="Parola" type="password" value={password} onChange={setPassword} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />

          {error && (
            <div style={{
              background: '#fee2e2', border: '1px solid #fecaca', color: '#7f1d1d',
              padding: '10px 14px', fontSize: 13, marginBottom: 16,
            }}>{error}</div>
          )}

          <button type="submit" disabled={isLoading} style={{
            width: '100%', background: '#121926', color: '#fff', border: 'none',
            padding: '14px 24px', fontSize: 12, fontWeight: 700, letterSpacing: '0.15em',
            cursor: isLoading ? 'wait' : 'pointer', opacity: isLoading ? 0.7 : 1,
            fontFamily: "'Hanken Grotesk', sans-serif",
          }}>
            {isLoading ? 'BEKLEYİN...' : mode === 'login' ? 'GİRİŞ YAP' : 'HESAP OLUŞTUR'}
          </button>
        </form>

        <div style={{
          marginTop: 24, textAlign: 'center', fontSize: 13, color: '#5d5f5f',
        }}>
          {mode === 'login' ? 'Hesabınız yok mu?' : 'Zaten hesabınız var mı?'}{' '}
          <button onClick={() => { clearError(); setMode(mode === 'login' ? 'register' : 'login'); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#121926', fontWeight: 600, padding: 0,
            }}>
            {mode === 'login' ? 'Hesap oluşturun' : 'Giriş yapın'}
          </button>
        </div>

        <div style={{
          marginTop: 32, paddingTop: 24, borderTop: '1px solid #eceef1',
          textAlign: 'center', fontSize: 12, color: '#747878',
        }}>
          Misafir olarak alışveriş için{' '}
          <a href="/marketplace" style={{ color: '#121926', fontWeight: 600 }}>buradan</a>{' '}
          devam edebilirsiniz.
        </div>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: '100vh', background: '#f7f9fc',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24, fontFamily: "'Inter', sans-serif",
};

const cardStyle = {
  width: '100%', maxWidth: 420, background: '#fff',
  border: '1px solid #c4c7c8', padding: 40,
};

function Field({ label, value, onChange, type = 'text', autoComplete }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
        color: '#5d5f5f', marginBottom: 6, textTransform: 'uppercase',
      }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        style={{
          width: '100%', padding: '12px 14px', border: '1px solid #c4c7c8',
          background: '#fff', outline: 'none', fontSize: 14, color: '#191c1e',
          fontFamily: 'inherit', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
