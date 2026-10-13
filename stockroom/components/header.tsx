"use client";
import Link from "next/link";
import { useCart } from "@/components/cart-provider";

export function Header() {
  const { count } = useCart();
  return (
    <header className="site-header">
      <Link href="/" className="wordmark"><span className="mark">S.</span><span>STOCKROOM</span></Link>
      <nav className="main-nav"><Link href="/#catalog">Каталог</Link><Link href="/#about">О магазине</Link></nav>
      <Link className="cart-link" href="/cart">Корзина <span className="cart-count">{count}</span></Link>
    </header>
  );
}
