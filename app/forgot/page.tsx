"use client";
import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { inputCls } from "@/components/ui";
import { api } from "@/lib/api-client";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setState("busy");
    try { await api("/api/auth/forgot", { json: { email } }); setState("sent"); }
    catch (x) { setErr(x instanceof Error ? x.message : "Something went wrong"); setState("idle"); }
  }
  return (
    <AuthShell title="Reset your password">
      {state === "sent" ? (
        <p className="text-sm text-muted">If an account exists for <b className="text-white">{email}</b>, a reset link is on its way. It expires in 1 hour. Check your spam folder too.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted">Enter your account email and we’ll send you a reset link.</p>
          <label className="block text-xs text-muted">Email<input type="email" required autoComplete="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} /></label>
          <button disabled={state === "busy" || !email} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium disabled:opacity-50">{state === "busy" ? "Sending…" : "Send reset link"}</button>
          {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
        </form>
      )}
      <p className="mt-6 text-sm text-muted"><Link href="/login" className="underline underline-offset-4 hover:text-white">Back to sign in</Link></p>
    </AuthShell>
  );
}
