"use client";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Entrance on mount (hero, login panels). */
export function FadeIn({ children, delay = 0, y = 18, className }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

/** Horizontal bar that grows to `pct`% when scrolled into view. */
export function GrowBar({ pct, className }: { pct: number; className?: string }) {
  return <motion.div className={className} initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 1.1, ease: "easeOut" }} />;
}

/** Counts the first number in `value` up from 0 once visible ("18,420", "4.6 GB", "~95%", "5–15 min" -> animates 5). */
export function Counter({ value }: { value: string }) {
  const m = value.match(/^(\D*)(\d[\d,]*\.?\d*)(.*)$/s);
  const target = m ? parseFloat(m[2].replace(/,/g, "")) : NaN;
  const decimals = m?.[2].includes(".") ? m[2].split(".")[1].length : 0;
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  const commas = m?.[2].includes(",");

  useEffect(() => {
    if (!inView || reduce || isNaN(target)) return;
    const c = animate(0, target, { duration: 1.4, ease: "easeOut", onUpdate: setN });
    return () => c.stop();
  }, [inView, reduce, target]);

  if (!m || isNaN(target)) return <>{value}</>;
  const shown = reduce ? target : n;
  const txt = shown.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: !!commas });
  return <span ref={ref}>{m[1]}{txt}{m[3]}</span>;
}
