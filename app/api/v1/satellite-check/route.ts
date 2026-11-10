import { NextResponse } from "next/server";
import { z } from "zod";

const Q = z.object({ norad: z.coerce.number().int().min(1).max(999_999_999) });

/**
 * Looks a NORAD ID up in PUBLIC records (CelesTrak GP + SatNOGS DB).
 * This proves the object exists and shows its public identity ONLY — it never proves ownership.
 * Space-Track needs an account/credentials and is not queried here.
 */
export async function GET(req: Request) {
  const q = Q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return NextResponse.json({ error: "norad must be a positive integer" }, { status: 400 });
  const { norad } = q.data;
  const get = async (url: string) => {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(6000), next: { revalidate: 3600 } }); return r.ok ? await r.json() : null; } catch { return null; }
  };
  const [cel, nogs] = await Promise.all([
    get(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${norad}&FORMAT=JSON`),
    get(`https://db.satnogs.org/api/satellites/?norad_cat_id=${norad}&format=json`),
  ]);
  const c = Array.isArray(cel) ? cel[0] : null;
  const s = Array.isArray(nogs) ? nogs[0] : null;
  return NextResponse.json({
    norad, found: !!(c || s), identityOnly: true,
    celestrak: c ? { name: c.OBJECT_NAME, internationalDesignator: c.OBJECT_ID, epoch: c.EPOCH } : null,
    satnogs: s ? { name: s.name, status: s.status, operator: s.operator || null, countries: s.countries || null } : null,
    disclaimer: "Public identity record only. A NORAD ID does not prove ownership; a legal ownership or operator-authorisation document is still required.",
  });
}
