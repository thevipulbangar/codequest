import { parseTle } from "./passes";

/** Sample TLE (ISS, stale 2019 epoch) used ONLY if CelesTrak is unreachable; results are then labelled "demo". */
const SAMPLE_TLE = [
  "ISS (SAMPLE)",
  "1 25544U 98067A   19156.50900463  .00003075  .00000000  00000-0  59442-4 0  9992",
  "2 25544  51.6433  59.2583 0008217  16.4489 347.6173 15.51174618173442",
];

export interface TleResult { name: string; l1: string; l2: string; source: "celestrak" | "sample"; rec: ReturnType<typeof parseTle> }

export async function tleFor(norad: number): Promise<TleResult> {
  try {
    const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${norad}&FORMAT=TLE`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
    const lines = (await res.text()).trim().split(/\r?\n/);
    if (res.ok && lines.length >= 3 && lines[1].startsWith("1 ")) return { name: lines[0].trim(), l1: lines[1], l2: lines[2], source: "celestrak", rec: parseTle(lines[1], lines[2]) };
  } catch { /* fall through to labelled sample */ }
  return { name: SAMPLE_TLE[0], l1: SAMPLE_TLE[1], l2: SAMPLE_TLE[2], source: "sample", rec: parseTle(SAMPLE_TLE[1], SAMPLE_TLE[2]) };
}

