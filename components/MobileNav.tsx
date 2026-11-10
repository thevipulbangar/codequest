"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";

/** Hamburger for <md. Menu is portaled to <body> because the glass header's mask would clip a child dropdown. */
export function MobileNav({ links }: { links: readonly (readonly [string, string])[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target only exists after mount
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} className="grid h-10 w-10 place-items-center rounded-lg border border-line">
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      {mounted && open && createPortal(
        <div className="fixed inset-x-0 top-[68px] z-[60] mx-3 overflow-hidden rounded-xl border border-line bg-bg2/95 shadow-2xl backdrop-blur-xl md:hidden">
          {links.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)} className="block border-b border-line px-5 py-4 text-sm last:border-0 hover:bg-white/5">{label}</a>)}
        </div>, document.body)}
    </div>
  );
}
