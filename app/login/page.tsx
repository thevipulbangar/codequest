"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Antenna, ArrowRight, Loader2, Satellite, ShieldCheck } from "lucide-react";
import { signIn, signUp } from "@/lib/session";
import { FadeIn } from "@/components/Motion";

const Schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(60).optional(),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters").max(72),
});

type Role = "operator" | "owner" | "admin";
const TABS = [
  { id: "operator", title: "Satellite operator", icon: Satellite, blurb: "Find and book passes for your satellite." },
  { id: "owner", title: "Station owner", icon: Antenna, blurb: "List your ground station and earn per pass." },
] as const;
const NOUN = { operator: "satellite operator", owner: "station owner", admin: "admin" } as const;
const HOME = { operator: "/dashboard/operator", owner: "/dashboard/station-owner", admin: "/dashboard/admin" } as const;

const META = [["VERIFICATION", "3-badge owner checks"], ["ORBIT DATA", "Live CelesTrak · SGP4"], ["SETTLEMENT", "Pro-rata, verified"]];
const gridBg = {
  backgroundImage: "linear-gradient(#ffffff0d 1px, transparent 1px), linear-gradient(90deg, #ffffff0d 1px, transparent 1px)",
  backgroundSize: "56px 56px",
  maskImage: "radial-gradient(ellipse at 40% 50%, #000 30%, transparent 75%)",
  WebkitMaskImage: "radial-gradient(ellipse at 40% 50%, #000 30%, transparent 75%)",
} as const;

export default function Login() {
  // useSearchParams needs a Suspense boundary for prerendering.
  return <Suspense><LoginForm /></Suspense>;
}

function LoginForm() {
  const router = useRouter();
  const q = useSearchParams();
  const initialRole: Role = q.get("as") === "owner" ? "owner" : q.get("as") === "admin" ? "admin" : "operator";
  const [mode, setMode] = useState<"login" | "signup">(q.get("mode") === "signup" && initialRole !== "admin" ? "signup" : "login");
  const [role, setRole] = useState<Role>(initialRole);
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = Schema.safeParse({ ...f, name: mode === "signup" ? f.name : undefined });
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map(i => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const user = mode === "signup"
        ? await signUp({ name: r.data.name!, email: r.data.email, password: r.data.password, role: role as "operator" | "owner" })
        : await signIn(r.data.email, r.data.password, role);
      toast.success(mode === "signup" ? "Account created" : "Signed in");
      router.push(HOME[user.role]);
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(false);
    }
  }

  const lbl = "mono block text-[11px] uppercase tracking-[.14em] text-muted";
  const inp = "mt-2 w-full rounded-md border border-line bg-bg2/70 px-4 py-3.5 text-sm normal-case tracking-normal text-white outline-none transition placeholder:text-muted/60 focus:border-accent";
  const err = (k: string) => errors[k] && <p className="mt-1.5 text-xs normal-case tracking-normal text-red-400">{errors[k]}</p>;

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      {/* Info panel */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-black/30 px-14 py-12 lg:flex">
        <div className="pointer-events-none absolute inset-0" style={gridBg} />
        <div className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
        <Link href="/" className="mono relative flex w-fit items-center gap-3 text-sm font-semibold uppercase tracking-[.2em]">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent"><Satellite size={15} /></span>OrbitPass
        </Link>
        <FadeIn className="relative">
          <div className="mono mb-6 flex items-center gap-2 text-xs uppercase tracking-[.14em] text-muted"><span className="pulse-dot" />MISSION CONTROL · LIVE</div>
          <h2 className="text-6xl font-semibold leading-[.98] tracking-tighter xl:text-8xl">Welcome to mission control<span className="text-accent">.</span></h2>
          <p className="mt-6 max-w-md text-muted">Book satellite passes on demand. Pay only for the frames that Proof of Downlink verifies.</p>
        </FadeIn>
        <dl className="relative grid grid-cols-3 gap-6 border-t border-line pt-6">
          {META.map(([k, v]) => <div key={k}><dt className="mono text-[11px] tracking-[.14em] text-muted">{k}</dt><dd className="mono mt-1 text-sm">{v}</dd></div>)}
        </dl>
      </section>

      {/* Form panel */}
      <section className="flex items-center px-6 py-12 sm:px-14 xl:px-24">
        <FadeIn delay={0.15} className="w-full max-w-md">
          <Link href="/" className="mono mb-10 flex items-center gap-2 text-sm font-semibold uppercase tracking-[.2em] lg:hidden"><span className="grid h-7 w-7 place-items-center rounded-md bg-accent"><Satellite size={15} /></span>OrbitPass</Link>
          {role !== "admin" ? (
            <div role="tablist" aria-label="Account type" className="grid grid-cols-2 gap-2">
              {TABS.map(({ id, title, icon: Icon, blurb }) => (
                <button type="button" role="tab" key={id} aria-selected={role === id} onClick={() => { setRole(id); setErrors({}); }}
                  className={`rounded-lg border p-3 text-left transition ${role === id ? "border-accent bg-accent/10" : "border-line hover:bg-white/5"}`}>
                  <span className={`flex items-center gap-2 text-sm font-medium ${role === id ? "text-white" : "text-muted"}`}><Icon size={15} className={role === id ? "text-cyan" : ""} />{title}</span>
                  <span className="mt-1 block text-xs text-muted">{blurb}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300"><ShieldCheck size={15} />Platform admin sign-in</div>
          )}

          <div className="mono mt-7 text-[11px] uppercase tracking-[.14em] text-muted">Authentication</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{mode === "login" ? `Sign in as ${role === "admin" ? "an" : "a"} ${NOUN[role]}` : `Create a ${NOUN[role]} account`}</h1>
          <p className="mt-2 text-sm text-muted">{role === "admin" ? "Review owner verifications and approvals." : mode === "login" ? "Pick up where your last pass left off." : "Your account type is fixed once the account is created."}</p>

          <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
            {mode === "signup" && <label className={lbl}>Name<input className={inp} placeholder="Your name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} autoComplete="name" />{err("name")}</label>}
            <label className={lbl}>Email<input type="email" className={inp} placeholder="you@company.com" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} autoComplete="email" />{err("email")}</label>
            <label className={lbl}>Password<input type="password" className={inp} placeholder="••••••••" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} autoComplete={mode === "login" ? "current-password" : "new-password"} />{err("password")}</label>
            {mode === "login" && <div className="text-right"><button type="button" onClick={() => toast.info("Password reset by email isn’t enabled yet — contact support")} className="text-sm text-muted underline underline-offset-4 hover:text-white">Forgot password?</button></div>}
            <button disabled={busy} className="mono flex w-full items-center justify-center gap-2 rounded-md bg-accent py-4 text-sm font-semibold uppercase tracking-[.14em] shadow-[0_3px_0_#1d4ed8] transition hover:bg-blue-500 active:translate-y-px active:shadow-none disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}{mode === "login" ? "Sign in" : "Create account"}{!busy && <ArrowRight size={15} />}
            </button>
            {errors.form && <p role="alert" className="text-sm normal-case tracking-normal text-red-400">{errors.form}</p>}
          </form>

          {role !== "admin" && <>
          <div className="my-6 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
          <button type="button" onClick={() => toast.info("Google sign-in isn’t enabled yet")} className="flex w-full items-center justify-center gap-3 rounded-md border border-line py-3 text-sm font-medium transition hover:bg-white/5">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" /><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
            Sign in with Google
          </button>

          <p className="mt-6 text-sm text-muted">
            {mode === "login" ? "Don’t have an account?" : "Already have an account?"}{" "}
            <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErrors({}); }} className="font-medium text-white underline underline-offset-4">{mode === "login" ? `Create a ${NOUN[role]} account` : "Sign in"}</button>
          </p>
          </>}

          <p className="mt-8 border-t border-line pt-4 text-xs text-muted">
            {role === "admin"
              ? <button onClick={() => { setRole("operator"); setErrors({}); }} className="underline underline-offset-4 hover:text-white">← Back to operator / station owner sign-in</button>
              : <>Platform admin? <button onClick={() => { setRole("admin"); setMode("login"); setErrors({}); }} className="underline underline-offset-4 hover:text-white">Admin sign-in</button></>}
          </p>
        </FadeIn>
      </section>
    </main>
  );
}
