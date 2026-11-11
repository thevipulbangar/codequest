"use client";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useVerification } from "@/lib/verification/store";

/** Banner shown on asset pages until the owner's verification is approved. */
export function VerificationGate({ what }: { what: string }) {
  const v = useVerification();
  if (v === undefined || v?.decision?.status === "approved") return null;
  return (
    <div className="panel mb-4 flex flex-wrap items-center justify-between gap-3 border-amber-500/40 p-4 text-sm">
      <span className="flex items-center gap-2 text-amber-300"><ShieldAlert size={16} />Your {what} stay inactive until your owner verification is approved, and then each one is reviewed individually.</span>
      <Link href="/dashboard/verification" className="rounded-lg bg-accent px-3 py-1.5 text-xs">Go to verification</Link>
    </div>
  );
}
