import React, { useState } from 'react';
import Logo from '../components/common/Logo';
import FloatingInput from '../components/auth/FloatingInput';
import SocialButton from '../components/auth/SocialButton';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login, register, error, clearError } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    clearError();

    let success;
    if (isLogin) {
      success = await login(email, password);
    } else {
      success = await register(email, password);
    }

    setSubmitting(false);
    if (success) {
      navigate('/dashboard');
    }
  };

  const handleTabSwitch = (toLogin) => {
    setIsLogin(toLogin);
    clearError();
  };

  return (
    <div className="bg-mesh font-body text-on-surface min-h-screen flex flex-col items-center justify-center py-16 px-4 selection:bg-primary/30 selection:text-white antialiased">

      {/* Dekoratif arka plan ışıkları */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px] -mt-[200px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-tertiary/8 rounded-full blur-[120px] -mb-[200px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10 flex flex-col items-center gap-10">

        {/* Logo */}
        <Logo />

        {/* Kart */}
        <div className="w-full glass-card rounded-3xl p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.7)]">

          <header className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-on-surface-variant/70 text-sm">Precision tools for the modern digital workspace.</p>
          </header>

          {/* Sign In / Sign Up sekmeler */}
          <div className="flex p-1 bg-surface-container-lowest/60 rounded-2xl mb-8 border border-white/5">
            <button
              onClick={() => handleTabSwitch(true)}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${isLogin ? 'bg-surface-container-high text-on-surface shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => handleTabSwitch(false)}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${!isLogin ? 'bg-surface-container-high text-on-surface shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Sign Up
            </button>
          </div>

          {/* Hata Mesajı */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-error-container/20 border border-error-container/30 text-center">
              <p className="text-sm text-red-400 font-medium">{error}</p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <FloatingInput
              id="email"
              type="email"
              label="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FloatingInput
              id="password"
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="flex items-center justify-between text-sm pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded bg-surface-container-highest border-white/10 text-primary focus:ring-offset-0 focus:ring-primary/40 transition-all cursor-pointer"
                />
                <span className="text-on-surface-variant group-hover:text-on-surface transition-colors">Remember me</span>
              </label>
              {isLogin && (
                <a href="#" className="text-primary/80 hover:text-primary text-xs font-semibold transition-colors">
                  Forgot password?
                </a>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-primary-container to-primary text-white font-bold text-base rounded-2xl shadow-lg shadow-primary-container/20 hover:shadow-primary-container/30 hover:brightness-110 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Processing...
                </span>
              ) : (
                isLogin ? 'Enter Workspace' : 'Create Account'
              )}
            </button>
          </form>

          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
              <span className="px-4 bg-[#0e0e0e] text-on-surface-variant/40 font-bold">or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SocialButton provider="Google" svgPath="M12.48 10.92v3.28h7.84c-.24 1.84-.909 3.292-2.09 4.413-1.212 1.151-2.909 2.37-6.23 2.37-5.414 0-9.738-4.384-9.738-9.8s4.324-9.8 9.738-9.8c2.94 0 5.111 1.151 6.697 2.651l2.315-2.315C18.91 1.79 16.03 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.57 0 6.26-1.171 8.35-3.341 2.14-2.14 2.82-5.13 2.82-7.74 0-.74-.06-1.42-.18-2.06h-11z" />
            <SocialButton provider="GitHub" svgPath="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </div>
        </div>

        {/* Alt Bilgi */}
        <footer className="text-center">
          <p className="text-on-surface-variant/30 text-[11px] font-medium uppercase tracking-[0.15em]">
            © 2025 The Kinetic Architect
          </p>
        </footer>

      </div>
    </div>
  );
}
