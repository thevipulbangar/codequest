import { BANDS } from "./assets";

export interface ParsedQuery {
  minEl?: number; band?: string; hours?: number;
  before?: number; after?: number;           // epoch ms (UTC)
  place?: string;                            // free text matched against station country / name
  maxPrice?: number;
  understood: string[];                      // human-readable list of what was recognised
}

const hhmm = (s: string) => { const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i); if (!m) return null; let h = +m[1]; const min = +(m[2] ?? 0); const ap = m[3]?.toLowerCase(); if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0; return h < 24 && min < 60 ? [h, min] as const : null; };

/**
 * Deterministic natural-language → filters. No LLM: the same text always gives the same filters,
 * and nothing here can affect prices or settlement.
 * e.g. "next pass over India above 30 degrees for X-band before 18:00 UTC"
 */
export function parsePassQuery(q: string, now = Date.now()): ParsedQuery {
  const t = ` ${q.toLowerCase().replace(/\s+/g, " ")} `;
  const out: ParsedQuery = { understood: [] };

  const el = t.match(/(?:above|over|at least|min(?:imum)?(?: elevation)?|>=?)\s*(\d{1,2})\s*(?:°|deg|degrees?)/) ?? t.match(/(\d{1,2})\s*(?:°|deg|degrees?)\s*(?:elevation|el)?/);
  if (el) { out.minEl = Math.min(90, +el[1]); out.understood.push(`elevation ≥ ${out.minEl}°`); }

  for (const b of BANDS) if (new RegExp(`[\\s(]${b.toLowerCase()}[\\s-]?band|\\s${b.toLowerCase()}\\s`).test(t)) { out.band = b; out.understood.push(`${b} band`); break; }

  const hrs = t.match(/(?:next|within|in the next)\s*(\d{1,2})\s*(?:h|hrs?|hours?)/);
  if (hrs) { out.hours = Math.min(72, Math.max(1, +hrs[1])); out.understood.push(`next ${out.hours} h`); }
  else if (/\btomorrow\b/.test(t)) { out.hours = 48; const d = new Date(now); d.setUTCHours(24, 0, 0, 0); out.after = d.getTime(); out.before = d.getTime() + 86_400_000; out.understood.push("tomorrow (UTC)"); }
  else if (/\btoday\b|\btonight\b/.test(t)) { const d = new Date(now); d.setUTCHours(24, 0, 0, 0); out.hours = Math.max(1, Math.ceil((d.getTime() - now) / 3600_000)); out.before = d.getTime(); out.understood.push("today (UTC)"); }

  const before = t.match(/before\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:utc|z|gmt)?/);
  if (before) { const v = hhmm(before[1].trim()); if (v) { const d = new Date(now); d.setUTCHours(v[0], v[1], 0, 0); if (d.getTime() <= now) d.setUTCDate(d.getUTCDate() + 1); out.before = d.getTime(); out.hours = Math.max(out.hours ?? 1, Math.ceil((d.getTime() - now) / 3600_000)); out.understood.push(`before ${String(v[0]).padStart(2, "0")}:${String(v[1]).padStart(2, "0")} UTC`); } }
  const after = t.match(/after\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:utc|z|gmt)?/);
  if (after) { const v = hhmm(after[1].trim()); if (v) { const d = new Date(now); d.setUTCHours(v[0], v[1], 0, 0); if (d.getTime() <= now) d.setUTCDate(d.getUTCDate() + 1); out.after = d.getTime(); out.understood.push(`after ${String(v[0]).padStart(2, "0")}:${String(v[1]).padStart(2, "0")} UTC`); } }

  const price = t.match(/(?:under|below|max(?:imum)?|cheaper than|<)\s*(\d+(?:\.\d+)?)\s*(?:credits?)?/);
  if (price && !/deg|°/.test(t.slice(t.indexOf(price[0]), t.indexOf(price[0]) + price[0].length + 4))) { out.maxPrice = +price[1]; out.understood.push(`price ≤ ${out.maxPrice}`); }

  const place = t.match(/\b(?:over|in|from|near|at)\s+([a-z][a-z .'-]{1,40}?)(?=\s+(?:above|over|for|with|before|after|under|below|at least|within|next|today|tomorrow|tonight|\d)|\s*$)/);
  if (place && !/^\d/.test(place[1]) && !["the", "a", "least"].includes(place[1].trim())) { out.place = place[1].trim(); out.understood.push(`location “${out.place}”`); }

  return out;
}
