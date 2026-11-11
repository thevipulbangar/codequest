"use client";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Satellite, LayoutDashboard, Search, Radio, Antenna, LogOut, User, BadgeCheck, ClipboardCheck, Boxes } from "lucide-react";
import { signOut, useSession } from "@/lib/session";
import { BADGE_LABEL, badgeStates, DEFAULT_SETUP } from "@/lib/verification/requirements";
import { useVerification } from "@/lib/verification/store";
import { toast } from "sonner";

const NAV = {
  operator: [
    ["/dashboard/operator", "Overview", LayoutDashboard],
    ["/dashboard/operator/find-pass", "Find Passes", Search],
    ["/dashboard/operator/stations", "Stations", Radio],
    ["/dashboard/operator/satellites", "My Satellites", Satellite],
    ["/dashboard/verification", "Owner verification", BadgeCheck],
  ],
  owner: [
    ["/dashboard/station-owner", "Overview", LayoutDashboard],
    ["/dashboard/station-owner/stations", "My Stations", Antenna],
    ["/dashboard/verification", "Owner verification", BadgeCheck],
  ],
  admin: [
    ["/dashboard/admin", "Verification review", ClipboardCheck],
    ["/dashboard/admin/assets", "Asset review", Boxes],
  ],
} as const;
const HOME = { operator: "/dashboard/operator", owner: "/dashboard/station-owner", admin: "/dashboard/admin" } as const;
const ROLE_LABEL = { operator: "Satellite operator", owner: "Ground station owner", admin: "Admin" } as const;

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const vstate = useVerification(!!session && session.role !== "admin");

  // Route protection (UX only; every API checks auth server-side) + role is fixed at sign-up: send users to their own area.
  useEffect(() => {
    if (session === null) router.replace("/login");
    else if (session) {
      const foreign = Object.entries(HOME).filter(([r]) => r !== session.role).map(([, h]) => h);
      if (foreign.some(h => path.startsWith(h))) router.replace(HOME[session.role]);
    }
  }, [session, path, router]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!session) return <div className="grid min-h-screen place-items-center"><div className="skeleton h-10 w-48" /></div>;

  const initials = session.name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const badges = session.role === "admin" ? [] : badgeStates(session.role === "operator" ? "satellite" : "station", vstate?.setup ?? DEFAULT_SETUP, vstate?.subs ?? {});
  async function logout() { await signOut(); toast.success("Signed out"); router.push("/login"); }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-bg2/80 p-4 md:block">
        <Link href={HOME[session.role]} className="mb-6 flex items-center gap-2 font-semibold"><Logo />OrbitPass</Link>
        <div className="mono mb-3 px-3 text-[11px] uppercase tracking-[.14em] text-muted">{ROLE_LABEL[session.role]}</div>
        <nav className="space-y-1">
          {NAV[session.role].map(([href, label, Icon]) => (
            <Link key={href} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${path === href ? "bg-white/8 text-white" : "text-muted hover:bg-white/5 hover:text-white"}`}><Icon size={16} />{label}</Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="glass glass-solid flex items-center justify-between px-4 py-3 pb-5 sm:px-6">
          <span className="text-sm text-muted">{ROLE_LABEL[session.role]}</span>
          <div className="flex items-center gap-4">
            <div className="relative" ref={menu}>
              <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3 text-sm hover:bg-white/5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-semibold">{initials}</span>
                <span className="hidden max-w-32 truncate sm:block">{session.name}</span>
              </button>
              {open && (
                <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-card shadow-2xl shadow-black/50">
                  <div className="border-b border-line p-4">
                    <div className="truncate font-medium">{session.name}</div>
                    <div className="truncate text-xs text-muted">{session.email}</div>
                    <div className="mono mt-2 text-[11px] text-cyan">{ROLE_LABEL[session.role]}{session.company ? ` · ${session.company}` : ""}</div>
                    {badges.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{badges.map(b => <span key={b.badge} className={`mono rounded px-1.5 py-0.5 text-[10px] ${b.earned ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-muted"}`}>{b.earned ? "✓ " : ""}{BADGE_LABEL(b.badge, vstate?.setup ?? DEFAULT_SETUP).replace("Verified ", "")}</span>)}</div>}
                  </div>
                  <Link role="menuitem" href="/dashboard/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-white/5"><User size={15} />Profile</Link>
                  <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-300 hover:bg-red-500/10"><LogOut size={15} />Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden" aria-label="Sections">
          {NAV[session.role].map(([href, label, Icon]) => (
            <Link key={href} href={href} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm ${path === href ? "bg-white/8 text-white" : "text-muted"}`}><Icon size={15} />{label}</Link>
          ))}
        </nav>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
