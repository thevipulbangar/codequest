import { Counter } from "./Motion";
export const PageTitle = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="mb-6"><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{sub && <p className="mt-1 text-sm text-muted">{sub}</p>}</div>
);

export const Stat = ({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ok" | "warn" }) => (
  <div className="panel p-4">
    <div className="text-xs text-muted">{label}</div>
    <div className={`mt-1 text-2xl font-semibold tracking-tight ${tone === "ok" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : ""}`}><Counter value={value} /></div>
    {hint && <div className="mono mt-1 text-[11px] text-muted">{hint}</div>}
  </div>
);

export const Badge = ({ children, tone = "muted" }: { children: React.ReactNode; tone?: "ok" | "warn" | "bad" | "muted" }) => {
  const c = { ok: "bg-emerald-500/10 text-emerald-400", warn: "bg-amber-500/10 text-amber-400", bad: "bg-red-500/10 text-red-400", muted: "bg-white/5 text-muted" }[tone];
  return <span className={`mono rounded px-2 py-0.5 text-xs ${c}`}>{children}</span>;
};

export const fmtTime = (t: number) => new Date(t).toISOString().slice(5, 16).replace("T", " ") + "Z";
