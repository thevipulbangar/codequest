import Link from "next/link";
import { Logo } from "@/components/Logo";

/** Centered card layout for small account pages (forgot / reset / verify). */
export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mono mb-8 flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[.2em]"><Logo />OrbitPass</Link>
        <div className="panel p-7">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </main>
  );
}
