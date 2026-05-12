import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Marketplace Cart Store ───────────────────────────────────────────────
// Sepet localStorage'da tutulur (zustand persist). Backend'e yalnızca checkout
// sırasında gönderilir — fiyatlar backend'de yeniden doğrulanır.

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [], // [{ productId, title, price, image, seller, quantity, siteId, currency }]

      addItem: (product, quantity = 1) => {
        const items = get().items;
        const existing = items.find(it => it.productId === product.id);
        if (existing) {
          set({
            items: items.map(it =>
              it.productId === product.id
                ? { ...it, quantity: it.quantity + quantity }
                : it
            ),
          });
        } else {
          set({
            items: [
              ...items,
              {
                productId: product.id,
                title: product.title,
                price: product.price, // kuruş
                image: product.image || '',
                seller: product.seller || '',
                quantity,
                siteId: product.site_id || '',
                currency: product.currency || 'TRY',
              },
            ],
          });
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter(it => it.productId !== productId) });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set({
          items: get().items.map(it =>
            it.productId === productId ? { ...it, quantity } : it
          ),
        });
      },

      clear: () => set({ items: [] }),

      // ── Computed ──
      getItemCount: () => get().items.reduce((sum, it) => sum + it.quantity, 0),
      getSubtotal: () => get().items.reduce((sum, it) => sum + it.price * it.quantity, 0),
      getShippingCost: () => {
        const sub = get().getSubtotal();
        return sub >= 20000 ? 0 : 500; // 200 TL üstü ücretsiz
      },
      getTotal: () => get().getSubtotal() + get().getShippingCost(),
    }),
    {
      name: 'marketplace-cart',
    }
  )
);
