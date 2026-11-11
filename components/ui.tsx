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

const STATUS_TONE = { active: "ok", pending: "warn", rejected: "bad", suspended: "bad" } as const;
const STATUS_TEXT = { active: "Active", pending: "Pending review", rejected: "Rejected", suspended: "Suspended" } as const;
export const StatusPill = ({ status }: { status: keyof typeof STATUS_TONE }) => <Badge tone={STATUS_TONE[status]}>{STATUS_TEXT[status]}</Badge>;

export const Empty = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <div className="panel p-8 text-center"><div className="text-sm font-medium">{title}</div>{children && <div className="mt-1 text-sm text-muted">{children}</div>}</div>
);

export const inputCls = "mt-1.5 w-full rounded-lg border border-line bg-bg2 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent";

export const fmtTime =(t: number) => new Date(t).toISOString().slice(5, 16).replace("T", " ") + "Z";
