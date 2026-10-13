import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { money } from "@/lib/types";
import { OrderActions } from "@/components/order-actions";

type OrderData = { id: string; public_order_code: string; status: string; total: number | string; created_at: string; reservations: { status: string; expires_at: string }[]; order_items: { product_name_snapshot: string; quantity: number; unit_price: number | string; line_total: number | string }[] };

export const revalidate = 0;

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let order: OrderData | null = null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("orders").select("id,public_order_code,status,total,created_at,reservations(status,expires_at),order_items(product_name_snapshot,quantity,unit_price,line_total)").eq("public_order_code", code.toUpperCase()).single();
    if (!error && data) order = data as unknown as OrderData;
  } catch { /* handled below */ }
  if (!order) notFound();
  const reservation = order.reservations?.[0];
  const expired = reservation?.expires_at ? new Date(reservation.expires_at).getTime() <= Date.now() : false;
  const displayStatus = expired && order.status === "pending" ? "expired" : order.status;
  const statusLabels: Record<string, string> = { pending: "Ожидает оплаты", paid: "Оплачен", cancelled: "Отменён", expired: "Резерв истёк" };
  return <main className="shell simple-page order-page"><p className="eyebrow">ЗАКАЗ / {order.public_order_code}</p><div className="order-title-row"><h1 className="page-title">Ваш заказ<span className="title-count">№ {order.public_order_code}</span></h1><span className={`status-pill status-${displayStatus}`}>{statusLabels[displayStatus] ?? displayStatus}</span></div><div className="checkout-layout"><section className="order-details"><h2>Состав заказа</h2>{order.order_items.map((item, index) => <div className="summary-row order-item-row" key={`${item.product_name_snapshot}-${index}`}><span>{item.product_name_snapshot} × {item.quantity}</span><strong>{money(item.line_total)}</strong></div>)}<div className="summary-total"><span>Итого</span><strong>{money(order.total)}</strong></div>{order.status === "pending" && reservation && <OrderActions code={order.public_order_code} expiresAt={reservation.expires_at} initialExpired={expired} />}{order.status === "paid" && <div className="success-note"><strong>Оплата подтверждена.</strong><p>Складской остаток списан один раз. Спасибо за заказ.</p></div>}{order.status === "cancelled" && <div className="checkout-notice"><strong>Заказ отменён</strong><p>Резерв освобождён, складской остаток не уменьшался.</p></div>}{displayStatus === "expired" && <div className="error-message">Время резерва истекло. Создайте новый заказ, чтобы проверить доступность товаров.</div>}</section><aside className="order-summary"><p className="eyebrow">ИНФОРМАЦИЯ</p><div className="summary-row"><span>Номер заказа</span><strong>{order.public_order_code}</strong></div><div className="summary-row"><span>Создан</span><span>{new Date(order.created_at).toLocaleString("ru-KZ")}</span></div><p className="summary-hint">Демонстрационная оплата не использует банковские данные и не списывает реальные деньги.</p><Link className="text-link" href="/#catalog">Вернуться в магазин ↗</Link></aside></div></main>;
}
