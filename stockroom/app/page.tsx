import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { demoProducts } from "@/lib/demo-products";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Product } from "@/lib/types";

export const revalidate = 0;

async function loadProducts(): Promise<{ products: Product[]; demo: boolean }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("products").select("id,name,slug,description,category,image_url,price,discount_price,is_active,inventory(physical_stock)").eq("is_active", true).order("created_at", { ascending: false });
    if (error) throw error;
    return { products: (data ?? []) as Product[], demo: false };
  } catch (error) {
    console.error("Catalog fallback:", error);
    return { products: demoProducts, demo: true };
  }
}

export default async function HomePage() {
  const { products, demo } = await loadProducts();
  return <main>
    {demo && <div className="config-banner">Показаны демонстрационные товары. Для реального каталога настройте Supabase и выполните SQL-миграцию.</div>}
    <section className="hero shell">
      <div className="hero-kicker"><span className="orange-dot" /> КУРАТОРСКИЙ МАГАЗИН ПОЛЕЗНЫХ ВЕЩЕЙ <span>№ 001—026</span></div>
      <div className="hero-layout"><div><h1>Рабочее место.<br /><em>Новый порядок.</em></h1><p className="hero-copy">Предметы, которые помогают думать яснее, работать спокойнее и оставлять вокруг только нужное.</p><Link className="primary-button" href="#catalog">Смотреть каталог <span>↓</span></Link></div><div className="hero-art"><div className="art-circle" /><div className="art-label label-top">ФОРМА / 01</div><div className="art-object"><div className="object-screen" /><div className="object-base" /></div><div className="art-label label-bottom">ПОДОБРАНО ДЛЯ КАЖДОГО ДНЯ</div><span className="art-cross">+</span></div></div>
      <div className="hero-bottom"><span>ХОРОШИЕ ВЕЩИ — ХОРОШИЕ ПРИВЫЧКИ</span><span>АЛМАТЫ, KZ <b>↘</b></span></div>
    </section>
    <section className="catalog-section shell" id="catalog"><div className="section-heading"><div><p className="eyebrow">КАТАЛОГ / {String(products.length).padStart(2, "0")} ПОЗИЦИЙ</p><h2>Выбрано с умом.</h2></div><p className="section-description">Для рабочего стола, дороги и маленьких ежедневных ритуалов.</p></div>
      <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
    </section>
    <section className="manifesto shell" id="about"><p className="eyebrow">НАШ ПОДХОД / 01</p><div className="manifesto-content"><h2>Не больше.<br /><em>Лучше.</em></h2><div><p>STOCKROOM собирает практичные предметы без лишнего шума. Понятная функция, честная цена и дизайн, который не надоедает через неделю.</p><Link href="#catalog" className="text-link">Найти свою вещь ↗</Link></div></div></section>
  </main>;
}
