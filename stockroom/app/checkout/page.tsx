"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart-provider";
import { effectivePrice, money, type PricingStrategy } from "@/lib/types";

export default function CheckoutPage() {
  const { items, clear } = useCart();
  const router = useRouter();
  const [strategy, setStrategy] = useState<PricingStrategy>("discount");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = items.reduce((sum, item) => sum + effectivePrice(item.product, strategy) * item.quantity, 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map(({ product, quantity }) => ({ productId: product.id, quantity })), pricingStrategy: strategy }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось оформить заказ.");
      clear(); router.push(`/order/${data.orderCode}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Произошла ошибка."); }
    finally { setBusy(false); }
  }

  if (!items.length) return <main className="shell simple-page"><p className="eyebrow">ОФОРМЛЕНИЕ</p><h1 className="page-title">Корзина пуста.</h1><Link href="/#catalog" className="primary-button">Вернуться в каталог ↗</Link></main>;
  return <main className="shell simple-page"><p className="eyebrow">ПОСЛЕДНИЙ ШАГ / CHECKOUT</p><h1 className="page-title">Оформление<span className="title-count">02</span></h1><div className="checkout-layout"><form className="checkout-form" onSubmit={submit}><h2>Способ расчёта</h2><label className={`strategy-option ${strategy === "discount" ? "selected" : ""}`}><input type="radio" name="strategy" value="discount" checked={strategy === "discount"} onChange={() => setStrategy("discount")} /><span><strong>С учётом скидок</strong><small>Применить доступные скидочные цены</small></span></label><label className={`strategy-option ${strategy === "regular" ? "selected" : ""}`}><input type="radio" name="strategy" value="regular" checked={strategy === "regular"} onChange={() => setStrategy("regular")} /><span><strong>Обычная цена</strong><small>Рассчитать заказ без скидок</small></span></label><div className="checkout-notice"><strong>Как работает резерв</strong><p>После оформления товары будут зарезервированы на 10 минут. Если хотя бы одного товара не хватает, заказ целиком не создаётся.</p></div>{error && <p className="error-message" role="alert">{error}</p>}<button className="primary-button wide-button" disabled={busy}>{busy ? "Проверяем остатки…" : "Создать заказ и резерв ↗"}</button><Link href="/cart" className="back-link">← Вернуться в корзину</Link></form><aside className="order-summary"><p className="eyebrow">ВАШ ЗАКАЗ / {items.length} ПОЗ.</p>{items.map(({ product, quantity }) => <div className="summary-row" key={product.id}><span>{product.name} × {quantity}</span><span>{money(effectivePrice(product, strategy) * quantity)}</span></div>)}<div className="summary-total"><span>Итого</span><strong>{money(total)}</strong></div><p className="summary-hint">Оплата на следующем шаге демонстрационная. Деньги не списываются.</p></aside></div></main>;
}
