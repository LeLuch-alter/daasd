"use client";
import { useState } from "react";
import { useCart } from "@/components/cart-provider";
import type { Product } from "@/lib/types";

export function ProductDetailActions({ product }: { product: Product }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const stock = Array.isArray(product.inventory) ? product.inventory[0]?.physical_stock : product.inventory?.physical_stock;
  return <div className="detail-actions"><button className="primary-button wide-button" disabled={stock === 0} onClick={() => { add(product); setAdded(true); }}>{added ? "Добавлено в корзину ✓" : "Добавить в корзину ↗"}</button><p className="stock-note">{stock === undefined ? "Доступность подтвердится при резервировании" : stock > 0 ? `Физический остаток: ${stock} шт.` : "Сейчас нет в наличии"}</p></div>;
}
