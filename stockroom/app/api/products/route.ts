import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("products").select("id,name,slug,description,category,image_url,price,discount_price,is_active,inventory(physical_stock)").eq("is_active", true).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ products: data ?? [] });
  } catch (error) {
    console.error("GET /api/products", error);
    return NextResponse.json({ error: "Каталог временно недоступен. Проверьте подключение Supabase." }, { status: 503 });
  }
}
