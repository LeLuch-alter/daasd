import Link from "next/link";
import { notFound } from "next/navigation";
import { demoProducts } from "@/lib/demo-products";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ProductDetailActions } from "@/components/product-detail-actions";
import { effectivePrice, money, type Product } from "@/lib/types";

export const revalidate = 0;

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product: Product | undefined;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("products").select("id,name,slug,description,category,image_url,price,discount_price,is_active,inventory(physical_stock)").eq("slug", slug).eq("is_active", true).single();
    if (!error && data) product = data as Product;
  } catch { /* use demo fallback for local preview */ }
  product ??= demoProducts.find((item) => item.slug === slug);
  if (!product) notFound();
  const hasDiscount = product.discount_price != null && Number(product.discount_price) < Number(product.price);
  return <main className="shell detail-page"><Link href="/#catalog" className="back-link">← Назад в каталог</Link><div className="detail-layout"><div className="detail-image">{product.image_url ? <img src={product.image_url} alt={product.name} /> : <div className="image-placeholder">STOCKROOM</div>}<span className="image-index">{product.category}</span></div><div className="detail-copy"><p className="eyebrow">STOCKROOM OBJECT / {product.category.toUpperCase()}</p><h1>{product.name}</h1><p className="detail-description">{product.description}</p><div className="detail-price"><strong>{money(effectivePrice(product, "discount"))}</strong>{hasDiscount && <del>{money(product.price)}</del>}</div><ProductDetailActions product={product} /><div className="detail-note"><span>01 / ПРОСТОТА</span><p>Понятная вещь для ежедневного использования. Остаток и доступность уточняются при оформлении заказа.</p></div></div></div></main>;
}
