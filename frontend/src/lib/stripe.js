// Stripe.js tembel (lazy) yükleyici.
//
// loadStripe'ı modül seviyesinde çağırmak, Stripe'ın dolandırıcılık tespiti
// iframe'lerini (m-outer, inner.html, controller-with-preconnect ...) UYGULAMA
// AÇILIR AÇILMAZ ve HER SAYFADA yükler. Oysa Stripe yalnızca ödeme/hesap
// akışında gerekli. Bu yüzden loadStripe yalnızca getStripe() ilk kez
// çağrıldığında (ilgili bileşen ekrana geldiğinde) tetiklenir.

import { loadStripe } from '@stripe/stripe-js';

// Publishable key (pk_test_*). .env → VITE_STRIPE_PUBLISHABLE_KEY.
// Eksikse Stripe akışları devre dışı kalır.
export const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

let _promise = null;

// getStripe — Stripe.js'i ilk çağrıda yükler, sonraki çağrılarda aynı
// promise'i döndürür (tek seferlik). Key yoksa null döner.
export function getStripe() {
  if (!_promise && STRIPE_PK) {
    _promise = loadStripe(STRIPE_PK);
  }
  return _promise;
}
