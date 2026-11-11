"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { api, revalidate, useApi } from "@/lib/api-client";
import { fmtTime } from "@/components/ui";

type N = { unread: number; items: { id: string; title: string; body: string; link: string | null; read: boolean; at: number }[] };
const URL = "/api/notifications";

export function NotificationBell() {
  const data = useApi<N>(URL);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setInterval(() => revalidate(URL), 60_000); return () => clearInterval(t); }, []); // light polling
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const unread = data?.unread ?? 0;

  async function toggle() {
    const next = !open; setOpen(next);
    if (next && unread) { await api(URL, { json: {} }).catch(() => {}); revalidate(URL); }
  }

  return (
    <div className="relative" ref={box}>
      <button onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-card hover:bg-white/5">
        <Bell size={16} />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-line bg-card shadow-2xl shadow-black/50">
          <div className="border-b border-line px-4 py-3 text-sm font-medium">Notifications</div>
          {!data?.items.length && <p className="px-4 py-6 text-center text-sm text-muted">You&apos;re all caught up.</p>}
          {data?.items.map(n => {
            const inner = <><div className="text-sm font-medium">{n.title}</div><div className="mt-0.5 text-xs text-muted">{n.body}</div><div className="mono mt-1 text-[10px] text-muted">{fmtTime(n.at)}</div></>;
            return n.link
              ? <Link key={n.id} href={n.link} onClick={() => setOpen(false)} className={`block border-b border-line px-4 py-3 last:border-0 hover:bg-white/5 ${n.read ? "" : "bg-accent/5"}`}>{inner}</Link>
              : <div key={n.id} className={`border-b border-line px-4 py-3 last:border-0 ${n.read ? "" : "bg-accent/5"}`}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
