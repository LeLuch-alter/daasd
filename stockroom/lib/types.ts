export type PricingStrategy = "regular" | "discount";

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  image_url: string | null;
  price: number | string;
  discount_price: number | string | null;
  is_active: boolean;
  inventory?: { physical_stock: number }[] | { physical_stock: number } | null;
};

export type CartLine = {
  product: Product;
  quantity: number;
};

export function money(value: number | string) {
  return new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function effectivePrice(product: Product, strategy: PricingStrategy) {
  const regular = Number(product.price);
  const discounted = product.discount_price == null ? null : Number(product.discount_price);
  return strategy === "discount" && discounted !== null && discounted < regular ? discounted : regular;
}
