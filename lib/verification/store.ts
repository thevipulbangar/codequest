"use client";
import { useMemo, useSyncExternalStore } from "react";
import { DEFAULT_SETUP, type DocStatus, type Setup, type Submission } from "./requirements";

/**
 * DEMO persistence: localStorage, keyed by user email. Only file METADATA + SHA-256 are kept — file contents are
 * never stored or uploaded. Production: Supabase Storage (encrypted bucket) + Postgres, same shapes.
 */
export interface VerificationState {
  email: string; name: string; role: "operator" | "owner";
  setup: Setup; subs: Record<string, Submission>;
  decision?: { status: "approved" | "rejected" | "more_info"; note: string; at: number };
  updatedAt: number;
}
type All = Record<string, VerificationState>;

const KEY = "orbitpass.verification";
const EVT = "orbitpass-verification";
const subscribe = (cb: () => void) => {
  window.addEventListener(EVT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
};
const read = (): All => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; } };
const write = (a: All) => { localStorage.setItem(KEY, JSON.stringify(a)); window.dispatchEvent(new Event(EVT)); };

/** undefined while hydrating. */
export function useAllVerifications(): All | undefined {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY) ?? "{}", () => undefined);
  return useMemo(() => { if (raw === undefined) return undefined; try { return JSON.parse(raw) as All; } catch { return {}; } }, [raw]);
}

export function useVerification(email: string): VerificationState | undefined {
  const all = useAllVerifications();
  return all?.[email];
}

function update(u: { email: string; name: string; role: "operator" | "owner" }, fn: (s: VerificationState) => void) {
  const all = read();
  const s = all[u.email] ?? { email: u.email, name: u.name, role: u.role, setup: DEFAULT_SETUP, subs: {}, updatedAt: Date.now() };
  s.name = u.name; s.role = u.role;
  fn(s);
  s.updatedAt = Date.now();
  all[u.email] = s;
  write(all);
}

type User = { email: string; name: string; role: "operator" | "owner" };
export const actions = {
  setSetup: (u: User, setup: Setup) => update(u, s => { s.setup = setup; }),
  submit: (u: User, sub: Omit<Submission, "status" | "submittedAt">) =>
    update(u, s => { s.subs[sub.docId] = { ...sub, status: "submitted", submittedAt: Date.now() }; delete s.decision; }),
  remove: (u: User, docId: string) => update(u, s => { delete s.subs[docId]; }),
  /** Admin: set a document's review status. */
  review: (email: string, docId: string, status: DocStatus, note?: string) => {
    const all = read(); const s = all[email]; if (!s?.subs[docId]) return;
    s.subs[docId] = { ...s.subs[docId], status, note: note || undefined }; s.updatedAt = Date.now(); write(all);
  },
  decide: (email: string, status: "approved" | "rejected" | "more_info", note: string) => {
    const all = read(); const s = all[email]; if (!s) return;
    s.decision = { status, note, at: Date.now() }; s.updatedAt = Date.now(); write(all);
  },
};

export async function sha256Hex(file: File): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
}
