/**
 * Zustand Global Store
 * Manages client-side state for the shopping cart.
 */
import { create } from 'zustand';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface NovaStore {
  cart: CartItem[];
  cartCount: number;
  isCartError: boolean;
  fetchCart: () => Promise<void>;
  addToCart: (product: any) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

export const useStore = create<NovaStore>((set, get) => ({
  cart: [],
  cartCount: 0,
  isCartError: false,

  /**
   * Fetches the current cart state from the backend.
   */
  fetchCart: async () => {
    try {
      const res = await fetch('/api/cart?userId=demo-user');
      if (!res.ok) {
        set({ isCartError: true });
        return;
      }
      const data = await res.json();
      set({ cart: data, cartCount: data.reduce((acc: number, item: any) => acc + item.quantity, 0), isCartError: false });
    } catch (error) {
      set({ isCartError: true });
    }
  },

  /**
   * Adds an item to the cart via the backend.
   */
  addToCart: async (product) => {
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'demo-user', product })
      });
      if (!res.ok) {
        set({ isCartError: true });
        return Promise.reject('Add to cart failed');
      }
      await get().fetchCart();
    } catch (error) {
      set({ isCartError: true });
      return Promise.reject(error);
    }
  },

  /**
   * Removes an item completely from the cart.
   */
  removeFromCart: async (productId: string) => {
    try {
      const res = await fetch(`/api/cart?userId=demo-user&productId=${productId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        set({ isCartError: true });
        return Promise.reject('Remove from cart failed');
      }
      await get().fetchCart();
    } catch (error) {
      set({ isCartError: true });
      return Promise.reject(error);
    }
  },

  /**
   * Clears the entire cart.
   */
  clearCart: async () => {
    try {
      const res = await fetch(`/api/cart?userId=demo-user&productId=clear`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        set({ isCartError: true });
        return Promise.reject('Clear cart failed');
      }
      await get().fetchCart();
    } catch (error) {
      set({ isCartError: true });
    }
  }
}));
