"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api, useApi } from "@/lib/api-client";

/** Asks the user to confirm their email — only when email sending is configured. */
export function EmailBanner() {
  const me = useApi<{ user: { emailVerifiedAt: string | null; email: string }; emailEnabled: boolean }>("/api/auth/me");
  const [sent, setSent] = useState(false);
  if (!me || !me.emailEnabled || me.user.emailVerifiedAt) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200 sm:px-6">
      <span>Please confirm your email address ({me.user.email}).</span>
      <button disabled={sent} onClick={async () => { try { await api("/api/auth/verify-email", { method: "PUT" }); setSent(true); toast.success("Confirmation email sent"); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn’t send"); } }} className="rounded-lg border border-amber-400/50 px-3 py-1 text-xs disabled:opacity-50">{sent ? "Sent — check your inbox" : "Resend confirmation"}</button>
    </div>
  );
}
