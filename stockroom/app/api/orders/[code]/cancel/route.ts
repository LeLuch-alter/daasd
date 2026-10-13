import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    if (!/^[A-Z0-9]{20}$/i.test(code)) return NextResponse.json({ error: "Неверный номер заказа." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("cancel_order", { p_order_code: code.toUpperCase() });
    if (error) {
      console.error("cancel_order", error);
      return NextResponse.json({ error: "Не удалось отменить заказ." }, { status: 500 });
    }
    if (!data?.ok) {
      const messages: Record<string, string> = { order_not_found: "Заказ не найден.", order_paid: "Оплаченный заказ нельзя отменить этой операцией." };
      return NextResponse.json({ error: messages[data?.error] ?? "Не удалось отменить заказ." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, status: data.status });
  } catch (error) {
    console.error("POST cancel", error);
    return NextResponse.json({ error: "Не удалось обработать отмену." }, { status: 500 });
  }
}
