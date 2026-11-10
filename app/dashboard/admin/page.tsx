"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, MessageSquareWarning, X } from "lucide-react";
import { Badge as Pill, PageTitle } from "@/components/ui";
import { useSession } from "@/lib/session";
import { BADGE_LABEL, badgeStates, docsFor, type Submission } from "@/lib/verification/requirements";
import { actions, useAllVerifications, type VerificationState } from "@/lib/verification/store";

const SOURCES = [
  ["Company existence & status (CIN / name)", "https://www.mca.gov.in/content/mca/global/en/mca/master-data/MDS.html", "MCA Company Master Data"],
  ["GST registration", "https://services.gst.gov.in/services/searchtp", "GST Portal"],
  ["Ground-station authorisation framework", "https://www.inspace.gov.in/", "IN-SPACe"],
  ["Telecom / wireless authorisation", "https://dot.gov.in/", "DoT"],
  ["Satellite identity & orbital records", "https://www.space-track.org/", "Space-Track"],
  ["Public satellite / transmitter data", "https://db.satnogs.org/", "SatNOGS DB"],
] as const;
const TONE = { approved: "ok", submitted: "warn", rejected: "bad", more_info: "warn" } as const;

export default function AdminReview() {
  const session = useSession();
  const all = useAllVerifications();
  const [sel, setSel] = useState<string | null>(null);
  if (!session || !all) return <div className="skeleton h-40" />;
  if (session.role !== "admin") return <div className="panel p-8 text-sm text-muted">Admin access only.</div>;

  const list = Object.values(all).sort((a, b) => b.updatedAt - a.updatedAt);
  const cur = sel ? all[sel] : undefined;

  return (
    <>
      <PageTitle title="Verification review" sub="Review owner documents, tick the official-register checks, and approve, reject or request more evidence." />
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="panel h-fit overflow-hidden">
          {list.length === 0 && <div className="p-6 text-center text-sm text-muted">No applications yet.</div>}
          {list.map(v => {
            const b = badgeStates(v.role === "operator" ? "satellite" : "station", v.setup, v.subs);
            const pending = Object.values(v.subs).filter(s => s.status === "submitted").length;
            return (
              <button key={v.userId} onClick={() => setSel(v.userId)} className={`block w-full border-b border-line px-4 py-3 text-left last:border-0 hover:bg-white/5 ${sel === v.userId ? "bg-white/5" : ""}`}>
                <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{v.name}</span>{pending > 0 && <Pill tone="warn">{pending} to review</Pill>}</div>
                <div className="truncate text-xs text-muted">{v.email} · {v.role === "operator" ? "Satellite" : "Ground station"} · {v.setup.ownerType}</div>
                <div className="mono mt-1 text-[11px] text-muted">{b.filter(x => x.earned).length}/3 badges</div>
              </button>
            );
          })}
        </div>
        {cur ? <Detail key={cur.userId} v={cur} /> : <div className="panel grid min-h-48 place-items-center p-8 text-sm text-muted">Select an applicant to review.</div>}
      </div>
    </>
  );
}

function Detail({ v }: { v: VerificationState }) {
  const kind = v.role === "operator" ? "satellite" : "station";
  const docs = docsFor(kind, v.setup);
  const badges = badgeStates(kind, v.setup, v.subs);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [finalNote, setFinalNote] = useState("");

  const act = (docId: string, status: Submission["status"]) => {
    if ((status === "rejected" || status === "more_info") && !(notes[docId] ?? "").trim()) return toast.error("Add a note explaining what’s wrong or missing");
    actions.review(v.userId, docId, status, notes[docId]).then(() => toast.success(`Marked ${status.replace("_", " ")}`), e => toast.error(e.message));
  };
  const missing = docs.filter(d => d.minimum && !v.subs[d.id]);

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <div className="text-lg font-semibold">{v.name}</div>
        <div className="text-sm text-muted">{v.email} · {v.setup.ownerType === "company" ? "Company" : "Individual"} · {kind === "satellite" ? "Satellite owner/operator" : "Ground-station owner"}</div>
        <div className="mt-3 flex flex-wrap gap-2">{badges.map(b => <Pill key={b.badge} tone={b.earned ? "ok" : "muted"}>{b.earned ? "✓ " : ""}{BADGE_LABEL(b.badge, v.setup)} {b.approved}/{b.total}</Pill>)}</div>
      </div>

      <div className="panel p-5">
        <div className="eyebrow mb-3">Official-source checks (manual)</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {SOURCES.map(([what, url, name]) => (
            <label key={name} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={!!checks[name]} onChange={e => setChecks({ ...checks, [name]: e.target.checked })} />
              <span>{what} <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan hover:underline">{name}<ExternalLink size={11} /></a></span></label>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">These registers have no free public API here, so the reviewer checks them by hand. Ticks are a personal checklist and aren’t saved.</p>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-line px-5 py-3 text-sm font-medium">Documents ({docs.filter(d => v.subs[d.id]).length}/{docs.length} submitted)</div>
        {docs.map(d => {
          const s = v.subs[d.id];
          return (
            <div key={d.id} className="border-b border-line px-5 py-3 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">{d.name} {d.minimum && <Pill tone="muted">needed</Pill>} <Pill tone="muted">{d.priority}</Pill></div>
                {s ? <Pill tone={TONE[s.status]}>{s.status.replace("_", " ")}</Pill> : <span className="mono text-xs text-muted">not submitted</span>}
              </div>
              {s && (<>
                <div className="mt-1.5 rounded bg-white/3 p-2 text-xs">
                  {s.notApplicable ? `Declared not applicable: “${s.notApplicable}”` : s.text ? <span className="mono">{s.text}</span> : <>{s.id ? <a href={`/api/admin/documents/${s.id}`} target="_blank" rel="noreferrer" className="mono text-cyan underline">{s.fileName}</a> : <span className="mono">{s.fileName}</span>} · {((s.size ?? 0) / 1024).toFixed(0)} KB<div className="mono break-all text-muted">sha256 {s.sha256}</div></>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input value={notes[d.id] ?? s.note ?? ""} onChange={e => setNotes({ ...notes, [d.id]: e.target.value })} placeholder="Reviewer note (required to reject / request more)" className="min-w-0 flex-1 rounded-lg border border-line bg-bg2 px-3 py-1.5 text-xs outline-none focus:border-accent" />
                  <button onClick={() => act(d.id, "approved")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs"><Check size={12} />Approve</button>
                  <button onClick={() => act(d.id, "more_info")} className="inline-flex items-center gap-1 rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs text-amber-300"><MessageSquareWarning size={12} />More info</button>
                  <button onClick={() => act(d.id, "rejected")} className="inline-flex items-center gap-1 rounded-lg border border-red-500/50 px-3 py-1.5 text-xs text-red-300"><X size={12} />Reject</button>
                </div>
              </>)}
            </div>
          );
        })}
      </div>

      <div className="panel p-5">
        <div className="eyebrow mb-2">Final decision</div>
        {missing.length > 0 && <p className="mb-2 text-xs text-amber-300">{missing.length} required document(s) still missing — approval is blocked: {missing.map(m => m.name).join(", ")}.</p>}
        <input value={finalNote} onChange={e => setFinalNote(e.target.value)} placeholder="Note to the applicant" className="mb-3 w-full rounded-lg border border-line bg-bg2 px-3 py-2 text-sm outline-none focus:border-accent" />
        <div className="flex flex-wrap gap-2">
          <button disabled={badges.some(b => !b.earned)} onClick={() => actions.decide(v.userId, "approved", finalNote || "Approved.").then(() => toast.success("Applicant approved"), e => toast.error(e.message))} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm disabled:opacity-40">Approve applicant</button>
          <button onClick={() => finalNote.trim() ? actions.decide(v.userId, "more_info", finalNote).then(() => toast.success("Requested more evidence"), e => toast.error(e.message)) : toast.error("Add a note for the applicant")} className="rounded-lg border border-amber-500/50 px-4 py-2 text-sm text-amber-300">Request more evidence</button>
          <button onClick={() => finalNote.trim() ? actions.decide(v.userId, "rejected", finalNote).then(() => toast.success("Applicant rejected"), e => toast.error(e.message)) : toast.error("Add a note for the applicant")} className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-300">Reject</button>
        </div>
        <p className="mt-2 text-xs text-muted">“Approve applicant” unlocks only when all three badges are earned. Badges themselves come from per-document approvals, not this button.</p>
      </div>
    </div>
  );
}
