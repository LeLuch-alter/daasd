import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Некорректные данные заказа." }, { status: 400 });
    const data = body as { items?: unknown; pricingStrategy?: unknown };
    if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 50) {
      return NextResponse.json({ error: "Добавьте от 1 до 50 позиций в заказ." }, { status: 400 });
    }
    const items: { product_id: string; quantity: number }[] = [];
    for (const raw of data.items) {
      if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Некорректная позиция заказа." }, { status: 400 });
      const item = raw as { productId?: unknown; quantity?: unknown };
      if (typeof item.productId !== "string" || !/^[0-9a-f-]{36}$/i.test(item.productId)) {
        return NextResponse.json({ error: "В корзине есть товар без действительного ID. Обновите каталог после настройки базы." }, { status: 400 });
      }
      if (!Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 99) {
        return NextResponse.json({ error: "Количество каждого товара должно быть от 1 до 99." }, { status: 400 });
      }
      items.push({ product_id: item.productId, quantity: Number(item.quantity) });
    }
    const strategy = data.pricingStrategy === "regular" ? "regular" : data.pricingStrategy === "discount" ? "discount" : null;
    if (!strategy) return NextResponse.json({ error: "Выберите стратегию расчёта цены." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: result, error } = await supabase.rpc("create_order_and_reserve", {
      p_items: items,
      p_pricing_strategy: strategy,
    });
    if (error) {
      console.error("create_order_and_reserve", error);
      return NextResponse.json({ error: "Не удалось зарезервировать заказ. Проверьте базу данных и попробуйте ещё раз." }, { status: 500 });
    }
    if (!result?.ok) {
      const messages: Record<string, string> = {
        insufficient_stock: "Одного из товаров не хватает на складе. Заказ не создан, обновите корзину.",
        product_unavailable: "Один из товаров больше недоступен.",
        invalid_quantity: "Укажите корректное количество товара.",
        empty_order: "Корзина пуста.",
      };
      return NextResponse.json({ error: messages[result?.error] ?? "Не удалось создать заказ." }, { status: 409 });
    }
    return NextResponse.json({ orderCode: result.order_code, expiresAt: result.expires_at }, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders", error);
    return NextResponse.json({ error: "Не удалось обработать запрос." }, { status: 400 });
  }
}
