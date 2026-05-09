// 🔄 COGNITO_SWITCH: Bu dosyanın tamamı lokal JWT auth ile çalışır.
// Cognito'ya geçildiğinde:
//   1. Token localStorage yerine Cognito SDK'dan alınır
//   2. register/login fonksiyonları Cognito Auth.signUp / Auth.signIn olur
//   3. getToken() → Auth.currentSession().getIdToken() olur

const API_BASE = '/api';

// ─── Token Yönetimi ──────────────────────────────────────────────────────────

export function getToken() {
  return localStorage.getItem('auth_token');
}

export function setToken(token) {
  localStorage.setItem('auth_token', token);
}

export function removeToken() {
  localStorage.removeItem('auth_token');
}

export function isAuthenticated() {
  return !!getToken();
}

// ─── Fetch Wrapper ───────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // 401 → token geçersiz, logout yap
  if (res.status === 401) {
    removeToken();
    // Auth sayfasına yönlendir (çağıran tarafta handle edilir)
    throw new Error('UNAUTHORIZED');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return null;

  return res.json();
}

// ─── Auth API ────────────────────────────────────────────────────────────────

export async function apiRegister(email, password) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.token) setToken(data.token);
  return data;
}

export async function apiLogin(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.token) setToken(data.token);
  return data;
}

export async function apiGetMe() {
  return apiFetch('/auth/me');
}

export function apiLogout() {
  removeToken();
}

// ─── Sites API ───────────────────────────────────────────────────────────────

export async function apiListSites() {
  return apiFetch('/sites');
}

export async function apiCreateSite(title, subdomain) {
  return apiFetch('/sites', {
    method: 'POST',
    body: JSON.stringify({ title, subdomain: subdomain || undefined }),
  });
}

export async function apiGetSite(id) {
  return apiFetch(`/sites/${id}`);
}

export async function apiSaveSiteData(id, siteData) {
  return apiFetch(`/sites/${id}/data`, {
    method: 'PUT',
    body: JSON.stringify({ site_data: siteData }),
  });
}

export async function apiPublishSite(id) {
  return apiFetch(`/sites/${id}/publish`, {
    method: 'POST',
  });
}

export async function apiDeleteSite(id) {
  return apiFetch(`/sites/${id}`, {
    method: 'DELETE',
  });
}
