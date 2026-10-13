import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    if (!/^[A-Z0-9]{20}$/i.test(code)) return NextResponse.json({ error: "Неверный номер заказа." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("pay_order", { p_order_code: code.toUpperCase() });
    if (error) {
      console.error("pay_order", error);
      return NextResponse.json({ error: "Не удалось выполнить демонстрационную оплату." }, { status: 500 });
    }
    if (!data?.ok) {
      const messages: Record<string, string> = {
        order_not_found: "Заказ не найден.", reservation_expired: "Время резерва истекло. Создайте новый заказ.",
        order_cancelled: "Нельзя оплатить отменённый заказ.", reservation_missing: "У заказа отсутствует резерв.",
        insufficient_stock: "Складской остаток изменился. Обратитесь к администратору.",
      };
      return NextResponse.json({ error: messages[data?.error] ?? "Оплата не выполнена." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, alreadyPaid: Boolean(data.already_paid) });
  } catch (error) {
    console.error("POST pay", error);
    return NextResponse.json({ error: "Не удалось обработать оплату." }, { status: 500 });
  }
}
