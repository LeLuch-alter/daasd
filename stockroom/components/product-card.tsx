"use client";
import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { effectivePrice, money, type Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const price = effectivePrice(product, "discount");
  const hasDiscount = product.discount_price != null && Number(product.discount_price) < Number(product.price);
  const stock = Array.isArray(product.inventory) ? product.inventory[0]?.physical_stock : product.inventory?.physical_stock;
  return (
    <article className="product-card">
      <Link href={`/products/${product.slug}`} className="product-image-wrap">
        {hasDiscount && <span className="sale-tag">СКИДКА</span>}
        {product.image_url ? <img className="product-image" src={product.image_url} alt={product.name} loading="lazy" /> : <div className="image-placeholder">STOCKROOM / OBJECT</div>}
        <span className="image-index">{product.category}</span>
      </Link>
      <div className="product-info">
        <div><Link href={`/products/${product.slug}`} className="product-name">{product.name}</Link><p className="stock-note">{stock === undefined ? "В наличии" : stock > 0 ? `На складе: ${stock}` : "Нет в наличии"}</p></div>
        <div className="product-price-block"><strong>{money(price)}</strong>{hasDiscount && <del>{money(product.price)}</del>}</div>
      </div>
      <button className="add-button" onClick={() => add(product)} disabled={stock === 0}>Добавить <span>↗</span></button>
    </article>
  );
}
