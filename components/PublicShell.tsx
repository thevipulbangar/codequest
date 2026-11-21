import Link from "next/link";
import { Logo } from "@/components/Logo";

/** Frame for public, shareable pages (proofs, certificates, estimate). */
export function PublicShell({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/" className="display mb-10 flex w-fit items-center gap-2 text-2xl"><Logo />OrbitPass</Link>
      <div className="mono text-xs uppercase tracking-[.14em] text-muted">{eyebrow}</div>
      <h1 className="display mt-2 text-4xl sm:text-5xl">{title}</h1>
      {sub && <p className="mt-3 max-w-2xl text-muted">{sub}</p>}
      <div className="mt-8">{children}</div>
      <p className="mt-14 border-t border-line pt-5 text-xs text-muted">OrbitPass · pay-per-pass ground stations settled on Proof of Downlink · <Link href="/" className="underline">Home</Link> · <Link href="/terms" className="underline">Terms</Link></p>
    </main>
  );
}

export const Check = ({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) => (
  <li className="flex gap-3 border-t border-line py-3 first:border-t-0">
    <span aria-hidden className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold ${ok ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{ok ? "✓" : "✕"}</span>
    <div><div className="text-sm font-medium">{label}<span className="sr-only">{ok ? " (passed)" : " (failed)"}</span></div>{detail && <div className="mono mt-0.5 break-all text-xs text-muted">{detail}</div>}</div>
  </li>
);
