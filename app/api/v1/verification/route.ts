import { NextResponse } from "next/server";
import { z } from "zod";
import { generateManifest, generateReceipt, tamperFrame } from "@/lib/verifier/demo";
import { settle, toUnits, fmt } from "@/lib/verifier/settlement";
import { verifyReceipt } from "@/lib/verifier/verify";

const Body = z.object({
  tamperFrameId: z.number().int().min(1).max(100).optional(),
  resign: z.boolean().default(true),
  feeTokens: z.number().positive().max(10_000).default(100),
  feeBps: z.number().int().min(0).max(2000).default(800),
});

/** DEMO verification on the synthetic judge-scenario dataset. Settlement is computed here, never by the client. */
export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => ({})));
  if (!b.success) return NextResponse.json({ error: b.error.flatten() }, { status: 400 });
  const { tamperFrameId, resign, feeTokens, feeBps } = b.data;
  const t0 = Date.UTC(2026, 0, 1, 12, 0, 0);
  const win = { start: t0, end: t0 + 9 * 60_000, downlinkHz: 437.795e6, maxDopplerHz: 10_000 };
  const manifest = generateManifest("demo-booking-1");
  let receipt = generateReceipt(manifest, "st-blr", win);
  const original = receipt;
  if (tamperFrameId) receipt = tamperFrame(receipt, tamperFrameId, resign);
  const report = verifyReceipt(manifest, receipt, win);
  const s = settle(toUnits(feeTokens), report.promised, report.verified, feeBps);
  return NextResponse.json({
    synthetic: true,
    label: "SYNTHETIC frame dataset based on a recorded-pass profile — not real telemetry",
    manifestRoot: manifest.root, report, tampered: tamperFrameId ?? null,
    settlement: { stationGross: fmt(s.stationGross), platformFee: fmt(s.platformFee), stationNet: fmt(s.stationNet), operatorRefund: fmt(s.operatorRefund), feeBps, feeModel: "platform fee deducted from station's earned share" },
    frames: receipt.frames.map(f => ({ id: f.id, t: f.receivedAt - win.start, rssi: f.rssiDbm, doppler: f.dopplerHz })),
    originalRoot: original.manifestRoot,
  });
}
