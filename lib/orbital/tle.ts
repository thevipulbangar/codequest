import { parseTle } from "./passes";

export interface TleResult { name: string; l1: string; l2: string; rec: ReturnType<typeof parseTle> }

/**
 * Current public TLE from CelesTrak (cached 1 h). Returns null when unavailable — callers must skip the
 * satellite rather than predict from a stale or substitute orbit.
 */
export async function tleFor(norad: number): Promise<TleResult | null> {
  try {
    const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${norad}&FORMAT=TLE`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
    const lines = (await res.text()).trim().split(/\r?\n/);
    if (res.ok && lines.length >= 3 && lines[1].startsWith("1 ")) return { name: lines[0].trim(), l1: lines[1], l2: lines[2], rec: parseTle(lines[1], lines[2]) };
  } catch { /* unavailable */ }
  return null;
}
