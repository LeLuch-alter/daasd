import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart-provider";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "STOCKROOM — вещи для рабочего пространства",
  description: "Полезные предметы для учёбы, работы и повседневной жизни.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body><CartProvider><Header />{children}<footer className="site-footer"><span>STOCKROOM © 2026</span><span>Меньше вещей. Больше смысла.</span><a href="mailto:hello@stockroom.example">Связаться ↗</a></footer></CartProvider></body></html>;
}
