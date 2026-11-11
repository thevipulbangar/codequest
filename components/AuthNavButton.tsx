"use client";
import Link from "next/link";
import { useSession } from "@/lib/session";

export const HOME = { operator: "/dashboard/operator", owner: "/dashboard/station-owner", admin: "/dashboard/admin/overview" } as const;

/** Landing-page nav button: "Open dashboard" when signed in, "Get started" otherwise. */
export function AuthNavButton() {
  const s = useSession();
  const cls = "rounded-lg border border-line px-4 py-2 text-sm btn-press hover:bg-white/5";
  return s
    ? <Link href={HOME[s.role]} className={cls}>Open dashboard</Link>
    : <Link href="/login" className={cls}>Get started</Link>;
}
