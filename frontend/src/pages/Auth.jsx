import React, { useState } from 'react';
import Logo from '../components/common/Logo';
import FloatingInput from '../components/auth/FloatingInput';
import SocialButton from '../components/auth/SocialButton';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate(); // Hook'u tanımladık

  const handleSubmit = (e) => {
    e.preventDefault();
    // Burada normalde API'ye istek atılır, şimdilik direkt yönlendiriyoruz
    navigate('/dashboard');
  }; // Sign In / Sign Up geçişi için state

  return (
    <div className="bg-mesh font-body text-on-surface min-h-screen flex flex-col items-center justify-center selection:bg-primary/30 selection:text-white antialiased">

      {/* Üst Logo */}
      <div className="fixed top-12 left-0 w-full flex justify-center z-10">
        <Logo />
      </div>

      <main className="w-full max-w-lg px-6 relative z-20">
        {/* Arka plan renkli bulanık daireler */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-tertiary/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="glass-card rounded-3xl p-10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] relative overflow-hidden">
          <header className="mb-10 text-center">
            <h1 className="text-4xl font-bold tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-on-surface-variant/80 text-base font-medium">Precision tools for the modern digital workspace.</p>
          </header>

          {/* Geçiş Butonları (Sign In / Sign Up) */}
          <div className="flex p-1.5 bg-surface-container-lowest/50 rounded-2xl mb-10 border border-white/5 relative">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${isLogin ? 'bg-surface-container-high text-on-surface shadow-lg' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${!isLogin ? 'bg-surface-container-high text-on-surface shadow-lg' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Sign Up
            </button>
          </div>

          <form className="space-y-7" onSubmit={handleSubmit}>
            <FloatingInput id="email" type="email" label="Email Address" />
            <FloatingInput id="password" type="password" label="Password" />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" className="w-5 h-5 rounded-md bg-surface-container-highest border-white/10 text-primary focus:ring-offset-black focus:ring-primary/40 transition-all cursor-pointer" />
                </div>
                <span className="text-on-surface-variant group-hover:text-on-surface transition-colors">Remember me</span>
              </label>
              {isLogin && <a href="#" className="text-primary hover:text-white font-semibold transition-colors">Forgot password?</a>}
            </div>

            <button type="submit" className="w-full py-4 bg-gradient-to-r from-primary-container to-primary-container/80 text-on-primary-container font-bold text-lg rounded-2xl shadow-xl shadow-primary-container/20 hover:shadow-primary-container/30 hover:brightness-110 active:scale-[0.98] transition-all duration-300">
              Enter Workspace
            </button>
          </form>

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
              <span className="px-5 bg-transparent text-on-surface-variant/60 font-bold">Or authenticate with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SocialButton provider="Google" svgPath="M12.48 10.92v3.28h7.84c-.24 1.84-.909 3.292-2.09 4.413-1.212 1.151-2.909 2.37-6.23 2.37-5.414 0-9.738-4.384-9.738-9.8s4.324-9.8 9.738-9.8c2.94 0 5.111 1.151 6.697 2.651l2.315-2.315C18.91 1.79 16.03 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.57 0 6.26-1.171 8.35-3.341 2.14-2.14 2.82-5.13 2.82-7.74 0-.74-.06-1.42-.18-2.06h-11z" />
            <SocialButton provider="GitHub" svgPath="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </div>
        </div>

        {/* Alt Bilgi */}
        <footer className="mt-12 text-center">
          <p className="text-on-surface-variant/40 text-[11px] font-bold uppercase tracking-[0.2em]">
            © 2024 The Kinetic Architect. Technical Precision for Digital Creators.
          </p>
          <div className="mt-6 flex justify-center gap-8 text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-widest">
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-primary transition-colors">Support</a>
          </div>
        </footer>
      </main>

      {/* En alt dekoratif öğeler */}
      <div className="fixed bottom-0 left-0 w-full overflow-hidden pointer-events-none opacity-40 h-64 z-0">
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[140px] -mb-[300px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-tertiary/10 rounded-full blur-[120px] -mb-[250px]"></div>
      </div>
    </div>
  );
}