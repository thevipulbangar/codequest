"use client";
import { useState } from "react";
import { toast } from "sonner";
import { inputCls } from "@/components/ui";
import { api } from "@/lib/api-client";

export function ChangePassword() {
  const [f, setF] = useState({ current: "", next: "", again: "" });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.next.length < 8) return toast.error("New password needs at least 8 characters");
    if (f.next !== f.again) return toast.error("New passwords don’t match");
    setBusy(true);
    try { await api("/api/auth/password", { method: "PATCH", json: { current: f.current, next: f.next } }); setF({ current: "", next: "", again: "" }); toast.success("Password changed — other devices were signed out"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Couldn’t change password"); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="panel mt-4 max-w-3xl p-5">
      <div className="eyebrow mb-4">Change password</div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-xs text-muted">Current password<input type="password" autoComplete="current-password" className={inputCls} value={f.current} onChange={e => setF({ ...f, current: e.target.value })} /></label>
        <label className="text-xs text-muted">New password<input type="password" autoComplete="new-password" className={inputCls} value={f.next} onChange={e => setF({ ...f, next: e.target.value })} /></label>
        <label className="text-xs text-muted">Repeat new password<input type="password" autoComplete="new-password" className={inputCls} value={f.again} onChange={e => setF({ ...f, again: e.target.value })} /></label>
      </div>
      <button disabled={busy || !f.current || !f.next} className="mt-4 rounded-lg border border-line px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-40">{busy ? "Changing…" : "Change password"}</button>
    </form>
  );
}
