"use client";
import Link from "next/link";
import { Logo } from "@/components/Logo";

/** Shown when a page fails to render. Says what happened and offers the two useful ways out. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="on-ink space grid min-h-screen place-items-center px-6 py-16 text-center">
      <div>
        <Logo size={120} className="mx-auto" />
        <h1 className="display mt-10 text-5xl font-light sm:text-6xl">Signal lost</h1>
        <p className="mx-auto mt-5 max-w-md text-slate-300">This page could not be loaded. Nothing was booked, cancelled or charged by this error.</p>
        {error.digest && <p className="mono mt-3 text-xs text-muted">Reference {error.digest}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="rounded-full bg-accent px-6 py-3 text-sm font-semibold">Try again</button>
          <Link href="/" className="rounded-full border border-line px-6 py-3 text-sm font-semibold hover:bg-white/5">Back to OrbitPass</Link>
        </div>
      </div>
    </main>
  );
}
