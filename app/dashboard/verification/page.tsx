"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, CheckCircle2, CircleDashed, Clock, FileUp, Loader2, Search, ShieldAlert, X } from "lucide-react";
import { Badge as Pill, PageTitle } from "@/components/ui";
import { useSession, type Session } from "@/lib/session";
import { DEFAULT_SETUP, BADGE_DESC, BADGE_LABEL, badgeStates, docsFor, validateFile, validateText, type Badge, type DocDef, type Setup, type SiteControl, type Submission } from "@/lib/verification/requirements";
import { actions, useVerification } from "@/lib/verification/store";

const STEPS = [["Identity", "organisation"], ["Representative", "organisation"], ["Asset ownership", "asset"], ["Regulatory", "operator"], ["Admin approval", null]] as const;
const TONE = { approved: "ok", submitted: "warn", rejected: "bad", more_info: "warn" } as const;
const STATUS_LABEL = { approved: "Approved", submitted: "In review", rejected: "Rejected", more_info: "More info needed" } as const;
const REP_DOCS = new Set(["signatory", "board_res", "rep_letter", "directors"]);

export default function VerificationPage() {
  const session = useSession();
  if (!session || session.role === "admin") return session ? <div className="panel p-8 text-sm text-muted">Admins review applications under <b>Verification review</b>.</div> : null;
  return <Owner session={session as Session & { role: "operator" | "owner" }} />;
}

function Owner({ session }: { session: Session & { role: "operator" | "owner" } }) {
  const state = useVerification();
  const kind = session.role === "operator" ? "satellite" : "station";
  const setup = state?.setup ?? DEFAULT_SETUP;
  const subs = state?.subs ?? {};
  const docs = docsFor(kind, setup);
  const badges = badgeStates(kind, setup, subs);
  const submittedCount = docs.filter(x => subs[x.id]).length;
  const stepDone = (b: Badge | null) => b ? badges.find(x => x.badge === b)!.earned : state?.decision?.status === "approved";

  const setS = (patch: Partial<Setup>) => actions.setSetup({ ...setup, ...patch }).catch(e => toast.error(e.message));
  const sel = "mt-1.5 w-full rounded-lg border border-line bg-bg2 px-3 py-2.5 text-sm outline-none focus:border-accent";

  const groups: { title: string; filter: (d: DocDef) => boolean }[] = [
    { title: setup.ownerType === "company" ? "1 · Company identity" : "1 · Your identity", filter: d => d.badge === "organisation" && !REP_DOCS.has(d.id) },
    { title: "2 · Authorised representative", filter: d => d.badge === "organisation" && REP_DOCS.has(d.id) },
    { title: kind === "satellite" ? "3 · Satellite ownership" : "3 · Station ownership & site control", filter: d => d.badge === "asset" },
    { title: "4 · Operating & spectrum authorisations", filter: d => d.badge === "operator" },
  ];

  return (
    <div className="max-w-4xl space-y-5">
      <PageTitle title="Owner verification" sub={`${kind === "satellite" ? "Satellite operator" : "Ground-station owner"} · we verify you actually own or control what you list, before you can trade.`} />

      {/* Badges */}
      <div className="grid gap-3 md:grid-cols-3">
        {badges.map(b => (
          <div key={b.badge} className={`panel p-4 ${b.earned ? "border-emerald-500/50" : ""}`}>
            <div className="flex items-center gap-2 text-sm font-medium">{b.earned ? <BadgeCheck size={17} className="text-emerald-400" /> : <ShieldAlert size={17} className="text-muted" />}{BADGE_LABEL(b.badge, setup)}</div>
            <p className="mt-1 text-xs text-muted">{BADGE_DESC[b.badge]}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${b.total ? (b.approved / b.total) * 100 : 0}%` }} /></div>
            <div className="mono mt-1.5 text-[11px] text-muted">{b.approved}/{b.total} required approved{b.pending ? ` · ${b.pending} in review` : ""}{b.blocked ? ` · ${b.blocked} need attention` : ""}</div>
          </div>
        ))}
      </div>

      {/* Workflow */}
      <ol className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
        {STEPS.map(([label, b], i) => (
          <li key={label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${stepDone(b) ? "border-emerald-500/40 text-emerald-300" : "border-line text-muted"}`}>
            <span className="mono">{i + 1}</span>{label}{stepDone(b) && <CheckCircle2 size={13} className="ml-auto" />}
          </li>
        ))}
      </ol>
      {state?.decision && <div className={`panel p-4 text-sm ${state.decision.status === "approved" ? "border-emerald-500/40" : "border-amber-500/40"}`}><b>Admin decision: {state.decision.status.replace("_", " ")}.</b> {state.decision.note}</div>}

      {/* Setup */}
      <div className="panel p-5">
        <div className="eyebrow mb-4">About you — decides which documents apply</div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs text-muted">Owner type
            <select className={sel} value={setup.ownerType} onChange={e => setS({ ownerType: e.target.value as Setup["ownerType"] })}><option value="company">Company / institution</option><option value="individual">Individual</option></select></label>
          {setup.ownerType === "company"
            ? <label className="text-xs text-muted">Registered for GST?<select className={sel} value={String(setup.gstRegistered)} onChange={e => setS({ gstRegistered: e.target.value === "true" })}><option value="false">No</option><option value="true">Yes — add GST certificate</option></select></label>
            : <label className="text-xs text-muted">Registering on behalf of someone else?<select className={sel} value={String(setup.representative)} onChange={e => setS({ representative: e.target.value === "true" })}><option value="false">No</option><option value="true">Yes — add representative letter</option></select></label>}
          <label className="text-xs text-muted">{kind === "satellite" ? "Did you acquire this satellite from someone?" : "Did you acquire this station from someone?"}
            <select className={sel} value={String(setup.assetAcquired)} onChange={e => setS({ assetAcquired: e.target.value === "true" })}><option value="false">No — we built / launched it</option><option value="true">Yes — acquisition / transfer agreements apply</option></select></label>
          {kind === "satellite"
            ? <label className="text-xs text-muted">Is the operator different from the owner?<select className={sel} value={String(setup.operatorDiffers)} onChange={e => setS({ operatorDiffers: e.target.value === "true" })}><option value="false">No</option><option value="true">Yes — operator appointment agreement applies</option></select></label>
            : <label className="text-xs text-muted">Your right to use the site<select className={sel} value={setup.siteControl} onChange={e => setS({ siteControl: e.target.value as SiteControl })}><option value="owned">We own the land</option><option value="leased">We lease the site</option><option value="permission">We have permission to use it</option></select></label>}
        </div>
        {kind === "station" && <p className="mt-3 text-xs text-muted">You don’t need to own the land — we verify your right to operate and provide services from the site.</p>}
      </div>

      {groups.map(g => {
        const list = docs.filter(g.filter);
        if (!list.length) return null;
        return (
          <div key={g.title} className="panel overflow-hidden">
            <div className="border-b border-line px-5 py-3 text-sm font-medium">{g.title}</div>
            {list.map(doc => <DocRow key={doc.id} doc={doc} sub={subs[doc.id]} kind={kind} />)}
          </div>
        );
      })}

      <div className="panel p-5 text-sm">
        <div className="eyebrow mb-2">5 · Admin approval</div>
        <p className="text-muted">{submittedCount} of {docs.length} documents submitted. Reviewers approve, reject or request more evidence per document; badges are issued automatically once every required document for that badge is approved.</p>
        <p className="mono mt-3 text-[11px] text-muted">Files are encrypted (AES-256-GCM) before storage and can only be opened by reviewers; every view is logged. Official-register checks (MCA, GST, IN-SPACe, DoT, Space-Track) are done by the reviewer.</p>
      </div>
    </div>
  );
}

function DocRow({ doc, sub, kind }: { doc: DocDef; sub?: Submission; kind: "satellite" | "station" }) {
  const file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(sub?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [naOpen, setNaOpen] = useState(false);
  const [naReason, setNaReason] = useState("");
  const [lookup, setLookup] = useState<null | { loading: boolean; data?: Record<string, any>; error?: string }>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const locked = sub?.status === "approved";

  /** Runs a server action with busy/error handling. */
  async function run(fn: () => Promise<unknown>, ok: string) {
    setErr(""); setBusy(true);
    try { await fn(); toast.success(ok); return true; }
    catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong"); return false; }
    finally { setBusy(false); }
  }
  async function onFile(f?: File) {
    if (!f) return;
    const e = validateFile(f);
    if (e) return setErr(e);
    await run(() => actions.uploadFile(doc.id, f), `${doc.name} uploaded`);
    if (file.current) file.current.value = "";
  }
  function onText() {
    const e = validateText(doc, text);
    if (e) return setErr(e);
    run(() => actions.submitText(doc.id, text.trim()), `${doc.name} submitted`);
  }
  async function onNA() {
    if (naReason.trim().length < 10) return setErr("Explain why this doesn’t apply (min 10 characters)");
    if (await run(() => actions.markNotApplicable(doc.id, naReason.trim()), "Marked not applicable — a reviewer will confirm")) setNaOpen(false);
  }
  async function check() {
    setLookup({ loading: true });
    try { const r = await fetch(`/api/v1/satellite-check?norad=${encodeURIComponent(text.trim())}`); setLookup({ loading: false, data: await r.json(), error: r.ok ? undefined : "Invalid NORAD ID" }); }
    catch { setLookup({ loading: false, error: "Lookup failed" }); }
  }

  return (
    <div className="border-b border-line px-5 py-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">{doc.name}<Pill tone={doc.priority === "Required" ? "bad" : "muted"}>{doc.priority}</Pill>{doc.minimum && <Pill tone="muted">needed for badge</Pill>}</div>
          <div className="mt-0.5 text-xs text-muted">{doc.purpose}</div>
          {doc.note && <div className="mt-1 text-xs text-amber-400/90">{doc.note}</div>}
        </div>
        <div className="flex items-center gap-2">
          {sub ? <Pill tone={TONE[sub.status]}>{sub.status === "submitted" ? <Clock size={11} className="mr-1 inline" /> : null}{STATUS_LABEL[sub.status]}</Pill> : <span className="mono flex items-center gap-1 text-xs text-muted"><CircleDashed size={13} />Missing</span>}
        </div>
      </div>

      {sub && (
        <div className="mt-2 rounded-lg bg-white/3 p-3 text-xs">
          {sub.notApplicable ? <>Declared not applicable: “{sub.notApplicable}”</> : sub.text ? <span className="mono">{sub.text}</span> : sub.fileName ? <><span className="mono">{sub.fileName}</span> · {(sub.size! / 1024).toFixed(0)} KB<div className="mono mt-1 break-all text-muted">sha256 {sub.sha256}</div></> : "Submitted"}
          {sub.note && <div className="mt-1.5 text-amber-300">Reviewer: {sub.note}</div>}
        </div>
      )}

      {!locked && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(!doc.kind || doc.kind === "file") && (<>
            <input ref={file} type="file" accept=".pdf,.png,.jpg,.jpeg" hidden onChange={e => onFile(e.target.files?.[0])} />
            <button disabled={busy} onClick={() => file.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs hover:bg-white/5">{busy ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />}{sub?.fileName ? "Replace file" : "Upload PDF / image"}</button>
          </>)}
          {doc.kind === "text" && (<>
            <input value={text} onChange={e => setText(e.target.value)} placeholder={doc.patternHint} className="mono w-64 max-w-full rounded-lg border border-line bg-bg2 px-3 py-2 text-xs uppercase outline-none focus:border-accent" aria-label={doc.name} />
            <button disabled={busy} onClick={onText} className="rounded-lg bg-accent px-3 py-2 text-xs font-medium hover:bg-blue-500">{sub?.text ? "Update" : "Submit"}</button>
            {doc.id === "norad" && kind === "satellite" && <button disabled={!text.trim() || lookup?.loading} onClick={check} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs hover:bg-white/5 disabled:opacity-40">{lookup?.loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}Check public records</button>}
          </>)}
          {doc.kind === "kyc" && <button disabled={busy} onClick={() => run(() => actions.startKyc(doc.id), "KYC request recorded — a reviewer will complete it")} className="rounded-lg border border-line px-3 py-2 text-xs hover:bg-white/5">Request KYC check</button>}
          {doc.whereApplicable && !sub && <button onClick={() => setNaOpen(!naOpen)} className="text-xs text-muted underline underline-offset-4 hover:text-white">Not applicable to me</button>}
          {sub && sub.status !== "approved" && <button disabled={busy} onClick={() => run(() => actions.remove(doc.id), "Removed")} className="inline-flex items-center gap-1 text-xs text-muted hover:text-red-300"><X size={12} />Remove</button>}
        </div>
      )}
      {naOpen && !sub && (
        <div className="mt-2 flex flex-wrap gap-2"><input value={naReason} onChange={e => setNaReason(e.target.value)} placeholder="Why does this not apply to your station/service?" className="min-w-0 flex-1 rounded-lg border border-line bg-bg2 px-3 py-2 text-xs outline-none focus:border-accent" /><button disabled={busy} onClick={onNA} className="rounded-lg bg-accent px-3 py-2 text-xs">Confirm</button></div>
      )}
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      {lookup?.data && (
        <div className="mt-2 rounded-lg border border-line p-3 text-xs">
          {lookup.error ? <span className="text-red-400">{lookup.error}</span> : lookup.data.found ? (<>
            <div>CelesTrak: <b>{lookup.data.celestrak?.name ?? "—"}</b> · {lookup.data.celestrak?.internationalDesignator ?? "—"}</div>
            <div>SatNOGS DB: <b>{lookup.data.satnogs?.name ?? "—"}</b> · status {lookup.data.satnogs?.status ?? "—"} · operator {lookup.data.satnogs?.operator ?? "—"}</div>
            <div className="mt-1 text-amber-400/90">{lookup.data.disclaimer}</div></>) : <span className="text-amber-300">No public record found for this ID.</span>}
        </div>
      )}
    </div>
  );
}
