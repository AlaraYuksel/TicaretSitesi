// 🔄 COGNITO_SWITCH: Bu dosyanın tamamı lokal JWT auth ile çalışır.
// Cognito'ya geçildiğinde:
//   1. login/register → Cognito SDK çağrılarına dönüşür
//   2. checkAuth → Cognito session kontrolü olur
//   3. Token yönetimi Cognito SDK tarafından yapılır

import { create } from 'zustand';
import { apiLogin, apiRegister, apiGetMe, apiLogout, isAuthenticated } from '../lib/api';

export const useAuthStore = create((set) => ({
  user: null,
  isLoading: true,
  error: null,

  // Sayfa yüklendiğinde token geçerliliğini kontrol et
  checkAuth: async () => {
    if (!isAuthenticated()) {
      set({ user: null, isLoading: false });
      return false;
    }
    try {
      const user = await apiGetMe();
      set({ user, isLoading: false, error: null });
      return true;
    } catch {
      apiLogout();
      set({ user: null, isLoading: false });
      return false;
    }
  },

  login: async (email, password) => {
    set({ error: null, isLoading: true });
    try {
      const data = await apiLogin(email, password);
      set({ user: data.user, isLoading: false, error: null });
      return true;
    } catch (err) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  register: async (email, password) => {
    set({ error: null, isLoading: true });
    try {
      const data = await apiRegister(email, password);
      set({ user: data.user, isLoading: false, error: null });
      return true;
    } catch (err) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  logout: () => {
    apiLogout();
    set({ user: null, error: null });
  },

  clearError: () => set({ error: null }),
}));
