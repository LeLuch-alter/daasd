"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function OrderActions({ code, expiresAt, initialExpired }: { code: string; expiresAt: string; initialExpired: boolean }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [expiresAt]);

  async function action(kind: "pay" | "cancel") {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/orders/${code}/${kind}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Операция не выполнена.");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка запроса."); router.refresh(); }
    finally { setBusy(false); }
  }
  const expired = initialExpired || remaining <= 0;
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  return <div className="reservation-panel"><div className="timer-row"><span>Резерв действует ещё</span><strong className={expired ? "timer-expired" : ""}>{expired ? "00:00" : `${minutes}:${seconds}`}</strong></div><p>Время отсчитывается по часам браузера только для отображения. Действительность резерва проверяется сервером.</p>{error && <p className="error-message">{error}</p>}<button className="primary-button wide-button" disabled={busy || expired} onClick={() => action("pay")}>{busy ? "Обрабатываем…" : "Оплатить демонстрационно ↗"}</button><button className="secondary-button wide-button" disabled={busy} onClick={() => action("cancel")}>Отменить заказ</button></div>;
}
