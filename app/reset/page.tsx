"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { inputCls } from "@/components/ui";
import { api } from "@/lib/api-client";

export default function Reset() {
  return <Suspense><ResetForm /></Suspense>;
}

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState({ a: "", b: "" });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.a.length < 8) return setErr("At least 8 characters");
    if (pw.a !== pw.b) return setErr("Passwords don’t match");
    setErr(""); setState("busy");
    try { await api("/api/auth/reset", { json: { token, password: pw.a } }); setState("done"); }
    catch (x) { setErr(x instanceof Error ? x.message : "Something went wrong"); setState("idle"); }
  }
  return (
    <AuthShell title="Choose a new password">
      {!token ? <p className="text-sm text-red-400">This link is missing its token. Request a new one from <Link href="/forgot" className="underline">Forgot password</Link>.</p>
        : state === "done" ? <p className="text-sm text-muted">Your password was changed and you were signed out everywhere. <Link href="/login" className="text-cyan underline">Sign in</Link> with the new password.</p>
        : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-xs text-muted">New password<input type="password" autoComplete="new-password" className={inputCls} value={pw.a} onChange={e => setPw({ ...pw, a: e.target.value })} /></label>
            <label className="block text-xs text-muted">Repeat password<input type="password" autoComplete="new-password" className={inputCls} value={pw.b} onChange={e => setPw({ ...pw, b: e.target.value })} /></label>
            <button disabled={state === "busy"} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium disabled:opacity-50">{state === "busy" ? "Saving…" : "Set new password"}</button>
            {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
          </form>
        )}
    </AuthShell>
  );
}
