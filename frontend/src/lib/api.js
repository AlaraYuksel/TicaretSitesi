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

// Siteyi yayınlar. html: editör önizlemesiyle birebir tam statik HTML —
// backend bunu S3'e {subdomain}/index.html olarak yazar.
export async function apiPublishSite(id, html) {
  return apiFetch(`/sites/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ html: html || '' }),
  });
}

export async function apiDeleteSite(id) {
  return apiFetch(`/sites/${id}`, {
    method: 'DELETE',
  });
}

// ─── Storefront API (Auth gerektirmez — ziyaretçi tarafı) ────────────────────

export async function apiStorefrontCreateOrder(orderData) {
  const res = await fetch(`${API_BASE}/storefront/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiStorefrontRequestOTP(email, phone) {
  const res = await fetch(`${API_BASE}/storefront/orders/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, phone }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Marketplace API (Auth gerektirmez — herkes erişebilir) ──────────────────

export async function apiMarketplaceListProducts({ q = '', category = '', sort = 'popular', page = 1, limit = 24 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category && category !== 'Tümü') params.set('category', category);
  if (sort) params.set('sort', sort);
  params.set('page', page);
  params.set('limit', limit);
  const res = await fetch(`${API_BASE}/marketplace/products?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiMarketplaceGetProduct(id) {
  const res = await fetch(`${API_BASE}/marketplace/products/${id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiMarketplaceListCategories() {
  const res = await fetch(`${API_BASE}/marketplace/categories`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function apiMarketplaceCreateOrder(orderData) {
  const res = await fetch(`${API_BASE}/marketplace/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiMarketplaceGetOrder(orderNumber) {
  const res = await fetch(`${API_BASE}/marketplace/orders/${orderNumber}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── AI — Asenkron iş kuyruğu (başlat + poll) ────────────────────────────────
//
// AI işlemleri sunucuda asenkron çalışır: başlat → { job_id } → GET /ai/jobs/{id}
// poll. İlerleme olayları job.events dizisinde birikir; poll bunları onEvent'e
// aktarır (eski SSE arayüzü korunur, sadece push yerine ~1.5sn poll).

const AI_POLL_INTERVAL = 1500; // ms
const AI_POLL_MAX = 400;       // ~10 dk üst sınır

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// pollAIJob — bir AI işini status done/error olana kadar poll eder.
// onEvent verilirse job.events'teki yeni olayları sırayla iletir.
// isCancelled() true dönerse durur.
async function pollAIJob(jobId, onEvent, isCancelled) {
  let seen = 0;
  for (let i = 0; i < AI_POLL_MAX; i++) {
    if (isCancelled && isCancelled()) return null;
    const job = await apiFetch(`/ai/jobs/${jobId}`);
    if (onEvent && Array.isArray(job.events)) {
      for (; seen < job.events.length; seen++) {
        if (isCancelled && isCancelled()) return null;
        onEvent(job.events[seen]);
      }
    }
    if (job.status === 'done' || job.status === 'error') return job;
    await sleep(AI_POLL_INTERVAL);
  }
  throw new Error('AI işi zaman aşımına uğradı');
}

// ─── AI Site Builder ─────────────────────────────────────────────────────────

// Plan üret — plan işini başlatır, tamamlanana kadar bekler.
// Döner: { plan_id, plan }. plan_id aslında PLAN İŞİ id'sidir — apiAIExecutePlan
// bunu plan_job_id olarak kullanır (arayan için opak token).
export async function apiAIPlanSite(siteId, prompt, style) {
  const { job_id } = await apiFetch('/ai/build-site/plan', {
    method: 'POST',
    body: JSON.stringify({ site_id: siteId, prompt, style: style || 'modern' }),
  });
  const job = await pollAIJob(job_id);
  if (!job || job.status === 'error') {
    throw new Error((job && job.error) || 'Plan üretilemedi');
  }
  const result = job.result || {};
  return { plan_id: job_id, plan: result.plan };
}

// Plan uygula — execute işini başlatır, ilerlemeyi poll eder.
// planJobId: apiAIPlanSite'in döndürdüğü plan_id (plan işi id'si).
// onEvent her olayda { type, ...payload } ile çağrılır.
// Geri dönen fonksiyon poll'u iptal eder.
export function apiAIExecutePlan(planJobId, siteId, onEvent) {
  let cancelled = false;
  (async () => {
    try {
      const { job_id } = await apiFetch('/ai/build-site/execute', {
        method: 'POST',
        body: JSON.stringify({ plan_job_id: planJobId, site_id: siteId }),
      });
      await pollAIJob(job_id, onEvent, () => cancelled);
    } catch (err) {
      if (!cancelled) onEvent({ type: 'error', message: err.message || String(err) });
    }
  })();
  return () => { cancelled = true; };
}

// ─── AI Çözüm Asistanı (Marketplace sorun çözücü) ────────────────────────────

// Sorunu çöz — solve işini başlatır, ilerlemeyi poll eder.
// Olay tipleri: started, step, analyzed, searched, done, error.
// Geri dönen fonksiyon poll'u iptal eder.
export function apiAISolverSolve(problem, onEvent) {
  let cancelled = false;
  (async () => {
    try {
      const { job_id } = await apiFetch('/marketplace/ai-solver/solve', {
        method: 'POST',
        body: JSON.stringify({ problem }),
      });
      await pollAIJob(job_id, onEvent, () => cancelled);
    } catch (err) {
      if (!cancelled) onEvent({ type: 'error', message: err.message || String(err) });
    }
  })();
  return () => { cancelled = true; };
}

// Çözümü kaydet — auth zorunlu. payload: { problem_text, analysis, package }.
export async function apiAISolverSaveSolution(payload) {
  return apiFetch('/marketplace/ai-solver/solutions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Kullanıcının kayıtlı çözümleri — auth zorunlu.
export async function apiAISolverListSolutions() {
  return apiFetch('/marketplace/ai-solver/solutions');
}

// Tek çözüm — auth zorunlu, yalnızca sahibi erişir.
export async function apiAISolverGetSolution(id) {
  return apiFetch(`/marketplace/ai-solver/solutions/${id}`);
}

// ─── Marketplace Alıcı: Profil + Adresler + Kayıtlı Kartlar (Auth) ───────────
//
// PCI not: yeni kart ekleme akışı tamamen Stripe.js (Elements) üzerinden ilerler.
// Backend yalnızca SetupIntent client_secret döndürür ve confirm sonrası pm_xxx
// token'ını kaydeder. Bizim DB'de PAN/CVV asla bulunmaz — sadece brand/last4/exp.

export async function apiBuyerUpdateProfile(payload) {
  return apiFetch('/buyer/profile', { method: 'PUT', body: JSON.stringify(payload) });
}

export async function apiBuyerListAddresses() {
  return apiFetch('/buyer/addresses');
}

export async function apiBuyerCreateAddress(payload) {
  return apiFetch('/buyer/addresses', { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiBuyerUpdateAddress(id, payload) {
  return apiFetch(`/buyer/addresses/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function apiBuyerDeleteAddress(id) {
  return apiFetch(`/buyer/addresses/${id}`, { method: 'DELETE' });
}

export async function apiBuyerSetDefaultAddress(id) {
  return apiFetch(`/buyer/addresses/${id}/default`, { method: 'PUT' });
}

export async function apiBuyerCreateSetupIntent() {
  return apiFetch('/buyer/payment-methods/setup-intent', { method: 'POST' });
}

export async function apiBuyerListPaymentMethods() {
  return apiFetch('/buyer/payment-methods');
}

export async function apiBuyerAttachPaymentMethod(stripePaymentMethodID, setAsDefault = false) {
  return apiFetch('/buyer/payment-methods', {
    method: 'POST',
    body: JSON.stringify({ stripe_payment_method_id: stripePaymentMethodID, set_as_default: setAsDefault }),
  });
}

export async function apiBuyerDeletePaymentMethod(id) {
  return apiFetch(`/buyer/payment-methods/${id}`, { method: 'DELETE' });
}

export async function apiBuyerSetDefaultPaymentMethod(id) {
  return apiFetch(`/buyer/payment-methods/${id}/default`, { method: 'PUT' });
}

export async function apiBuyerListOrders() {
  return apiFetch('/buyer/orders');
}

export async function apiBuyerCancelOrder(id, reason) {
  return apiFetch(`/buyer/orders/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || '' }),
  });
}

export async function apiMarketplaceConfirmPayment(id) {
  return apiFetch(`/marketplace/orders/${id}/confirm-payment`, { method: 'POST' });
}

// ─── Q&A (Ürün Soruları) ─────────────────────────────────────────────────────

export async function apiMarketplaceListQuestions(productId) {
  const res = await fetch(`${API_BASE}/marketplace/products/${productId}/questions`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function apiMarketplaceAskQuestion(productId, question) {
  return apiFetch(`/marketplace/products/${productId}/questions`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

export async function apiSellerListQuestions(status = '', countOnly = false) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (countOnly) params.set('count_only', '1');
  return apiFetch(`/seller/questions${params.toString() ? '?' + params : ''}`);
}

export async function apiSellerAnswerQuestion(id, answer) {
  return apiFetch(`/seller/questions/${id}/answer`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });
}

// ─── Satıcı Marketplace Sipariş Yönetimi ─────────────────────────────────────

export async function apiSellerListMarketplaceOrders(status = '', countOnly = false) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (countOnly) params.set('count_only', '1');
  return apiFetch(`/seller/marketplace-orders${params.toString() ? '?' + params : ''}`);
}

export async function apiSellerGetMarketplaceOrder(id) {
  return apiFetch(`/seller/marketplace-orders/${id}`);
}

export async function apiSellerApproveOrder(id) {
  return apiFetch(`/seller/marketplace-orders/${id}/approve`, { method: 'POST' });
}

export async function apiSellerRejectOrder(id, reason) {
  return apiFetch(`/seller/marketplace-orders/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function apiSellerShipOrder(id, payload) {
  return apiFetch(`/seller/marketplace-orders/${id}/ship`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiSellerMarkDelivered(id) {
  return apiFetch(`/seller/marketplace-orders/${id}/mark-delivered`, { method: 'POST' });
}

export async function apiSellerReleaseEscrow(id) {
  return apiFetch(`/seller/marketplace-orders/${id}/release-escrow`, { method: 'POST' });
}

export async function apiSellerCancelOrder(id, reason) {
  return apiFetch(`/seller/marketplace-orders/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || '' }),
  });
}

export async function apiSellerGetBalance() {
  return apiFetch('/seller/balance');
}

export async function apiSellerStripeConnect() {
  return apiFetch('/seller/connect', { method: 'POST' });
}

export async function apiSellerDashboard() {
  return apiFetch('/seller/dashboard');
}

// ─── Marketplace çağrıları (auth header'ı varsa otomatik gönderilir) ─────────

// Marketplace product detail artık { product, answered_questions } döner —
// MarketplaceProduct sayfası eski {product} yapısı için bu helper'ı kullanır.
export async function apiMarketplaceGetProductFull(id) {
  const res = await fetch(`${API_BASE}/marketplace/products/${id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json(); // { product, answered_questions }
}

// Marketplace order oluşturma — auth varsa otomatik bearer ekler (apiFetch),
// auth yoksa raw fetch. Backend her iki durumu da kabul eder.
export async function apiMarketplaceCreateOrderAuth(payload) {
  return apiFetch('/marketplace/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiStorefrontVerifyOTP(email, phone, code) {
  const res = await fetch(`${API_BASE}/storefront/orders/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, phone, code }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

