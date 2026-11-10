"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Play, FlaskConical } from "lucide-react";
import { Badge, PageTitle, Stat } from "@/components/ui";

interface Result {
  manifestRoot: string; tampered: number | null; label: string;
  report: { promised: number; received: number; verified: number; missing: number[]; duplicates: number[]; invalidHashes: { id: number; expected: string; got: string }[]; timestampViolations: number[]; dopplerAnomalies: number[]; deliveryBps: number; confidence: string; rejected?: string; receivedRoot: string };
  settlement: { stationGross: string; platformFee: string; stationNet: string; operatorRefund: string; feeBps: number; feeModel: string };
}

const STEPS = ["Select satellite — SO-50", "Select station — Bengaluru Rooftop Array", "Book pass (100 frames, 100 tUSD)", "Lock escrow (simulated — contract not yet deployed)", "Commit manifest Merkle root", "Replay frames (synthetic dataset)", "Verify frames", "Calculate delivery %", "Settle escrow pro-rata", "Show payout & refund"];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function verify(tamper?: number): Promise<Result> {
  const r = await fetch("/api/v1/verification", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tamperFrameId: tamper }) });
  if (!r.ok) throw new Error("verification failed");
  return r.json();
}

export default function Verification() {
  const [step, setStep] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [tfid, setTfid] = useState(10);

  async function run(tamper?: number) {
    setBusy(true);
    try {
      if (tamper === undefined) {
        setRes(null);
        for (let i = 0; i < STEPS.length; i++) { setStep(i); if (i === 6) setRes(await verify()); await sleep(450); }
        toast.success("Demo complete — 94% delivered, 6.00 refunded");
      } else { setRes(await verify(tamper)); toast.warning(`Frame ${tamper} failed verification`); }
    } catch { toast.error("Verifier unreachable"); } finally { setBusy(false); }
  }

  const bad = new Set(res?.report.invalidHashes.map(x => x.id)), miss = new Set(res?.report.missing);
  return (
    <>
      <PageTitle title="Proof of Downlink" sub="Real verifier on a synthetic frame dataset. Settlement is computed server-side from the verified frame count." />
      <div className="mb-4 flex flex-wrap gap-3">
        <button disabled={busy} onClick={() => run()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}Run End-to-End Demo</button>
        <div className="flex items-center gap-2"><input type="number" min={1} max={100} value={tfid} onChange={e => setTfid(Math.min(100, Math.max(1, +e.target.value || 1)))} className="w-20 rounded-lg border border-line bg-bg2 px-3 py-2 text-sm" aria-label="Frame to tamper" />
          <button disabled={busy} onClick={() => run(tfid)} className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"><FlaskConical size={16} />Simulate Frame Tampering</button></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-1">
          <div className="eyebrow mb-3">Lifecycle</div>
          <ol className="space-y-2 text-sm">{STEPS.map((s, i) => <li key={s} className={`flex items-center gap-2 ${i <= step ? "text-white" : "text-muted"}`}>{i < step || (i === step && !busy) ? <Check size={14} className="text-emerald-400" /> : i === step ? <Loader2 size={14} className="animate-spin text-cyan" /> : <span className="w-3.5" />}{s}</li>)}</ol>
        </div>
        <div className="space-y-4 lg:col-span-2">
          {!res ? <div className="panel grid h-64 place-items-center text-sm text-muted">Run the demo to generate a manifest, replay frames and verify.</div> : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Promised" value={String(res.report.promised)} />
                <Stat label="Verified" value={String(res.report.verified)} tone="ok" />
                <Stat label="Missing" value={String(res.report.missing.length)} tone={res.report.missing.length ? "warn" : undefined} />
                <Stat label="Delivery" value={`${res.report.deliveryBps / 100}%`} hint={`confidence: ${res.report.confidence}`} />
              </div>
              <div className="panel p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-muted"><span>FRAME MAP · green verified · red invalid hash · grey missing</span><Badge tone="warn">SYNTHETIC DATA</Badge></div>
                <div className="grid grid-cols-[repeat(25,minmax(0,1fr))] gap-1">{Array.from({ length: 100 }, (_, i) => i + 1).map(id => <div key={id} title={`frame ${id}`} className={`aspect-square rounded-sm ${bad.has(id) ? "bg-red-500" : miss.has(id) ? "bg-white/10" : "bg-emerald-500/80"}`} />)}</div>
              </div>
              {res.report.invalidHashes.map(h => <div key={h.id} className="panel border-red-500/40 p-4 text-sm"><div className="font-medium text-red-300">Frame {h.id} failed hash verification</div><div className="mono mt-1 break-all text-xs text-muted">expected {h.expected}<br />received {h.got}</div></div>)}
              {res.report.rejected && <div className="panel border-red-500/40 p-4 text-sm text-red-300">Receipt rejected: {res.report.rejected}</div>}
              <div className="panel p-4">
                <div className="eyebrow mb-3">Settlement · 100 tUSD escrow · {res.settlement.feeBps / 100}% platform fee</div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-sm">
                  <div><div className="text-muted">Station earned</div><div className="mono text-lg">{res.settlement.stationGross}</div></div>
                  <div><div className="text-muted">Platform fee</div><div className="mono text-lg">−{res.settlement.platformFee}</div></div>
                  <div><div className="text-muted">Station receives</div><div className="mono text-lg text-emerald-400">{res.settlement.stationNet}</div></div>
                  <div><div className="text-muted">Operator refund</div><div className="mono text-lg text-cyan">{res.settlement.operatorRefund}</div></div>
                </div>
                <p className="mt-3 text-xs text-muted">{res.settlement.feeModel}. Escrow here is simulated; the Solidity contract and testnet transaction are not wired yet.</p>
                <div className="mono mt-2 break-all text-[11px] text-muted">manifest root {res.manifestRoot}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
