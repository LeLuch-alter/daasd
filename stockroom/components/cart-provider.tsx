"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, Product } from "@/lib/types";

type CartContextValue = {
  items: CartLine[];
  add: (product: Product) => void;
  remove: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "stockroom-cart-v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartLine[]);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, loaded]);

  const add = useCallback((product: Product) => {
    setItems((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) return current.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, 99) } : item);
      return [...current, { product, quantity: 1 }];
    });
  }, []);

  const remove = useCallback((productId: string) => setItems((current) => current.filter((item) => item.product.id !== productId)), []);
  const setQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) return remove(productId);
    setItems((current) => current.map((item) => item.product.id === productId ? { ...item, quantity: Math.min(quantity, 99) } : item));
  }, [remove]);
  const clear = useCallback(() => setItems([]), []);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const value = useMemo(() => ({ items, add, remove, setQuantity, clear, count }), [items, add, remove, setQuantity, clear, count]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
