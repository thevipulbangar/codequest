import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Page not found — OrbitPass" };

export default function NotFound() {
  return (
    <main className="on-ink space grid min-h-screen place-items-center px-6 py-16 text-center">
      <div>
        <Logo size={120} className="mx-auto" />
        <p className="mono mt-10 text-sm text-muted">404</p>
        <h1 className="display mt-2 text-5xl font-light sm:text-7xl">Below the horizon</h1>
        <p className="mx-auto mt-5 max-w-md text-slate-300">This page is out of range. It may have moved, or the address may be mistyped.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-full bg-accent px-6 py-3 text-sm font-semibold">Back to OrbitPass</Link>
          <Link href="/login" className="rounded-full border border-line px-6 py-3 text-sm font-semibold hover:bg-white/5">Sign in</Link>
        </div>
      </div>
    </main>
  );
}
