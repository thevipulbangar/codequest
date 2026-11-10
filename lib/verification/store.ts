"use client";
import { api, revalidate, useApi } from "../api-client";
import type { DocStatus, Setup, Submission } from "./requirements";

export interface VerificationState {
  userId: string; email: string; name: string; role: "operator" | "owner";
  setup: Setup; subs: Record<string, Submission>;
  decision?: { status: "approved" | "rejected" | "more_info"; note: string; at: number };
  updatedAt: number;
}

const MINE = "/api/verification";
const ALL = "/api/admin/verifications";

/** Own verification (undefined while loading). */
export const useVerification = (enabled = true) => useApi<VerificationState>(enabled ? MINE : null);
/** Admin: every applicant, keyed by userId. */
export function useAllVerifications() {
  const d = useApi<{ items: VerificationState[] }>(ALL);
  return d === undefined ? undefined : Object.fromEntries((d?.items ?? []).map(v => [v.userId, v]));
}

const mine = async <T>(p: Promise<T>) => { const r = await p; await revalidate(MINE); return r; };
const all = async <T>(p: Promise<T>) => { const r = await p; await revalidate(ALL); return r; };

export const actions = {
  setSetup: (setup: Setup) => mine(api(`${MINE}/setup`, { method: "PUT", json: setup })),
  uploadFile: (docId: string, file: File) => {
    const form = new FormData(); form.set("docId", docId); form.set("file", file);
    return mine(api(`${MINE}/documents`, { form }));
  },
  submitText: (docId: string, text: string) => mine(api(`${MINE}/documents`, { json: { docId, text } })),
  markNotApplicable: (docId: string, reason: string) => mine(api(`${MINE}/documents`, { json: { docId, notApplicable: reason } })),
  startKyc: (docId: string) => mine(api(`${MINE}/documents`, { json: { docId, kyc: true } })),
  remove: (docId: string) => mine(api(`${MINE}/documents/${docId}`, { method: "DELETE" })),
  review: (userId: string, docId: string, status: DocStatus, note?: string) =>
    all(api(`/api/admin/verifications/${userId}/review`, { json: { docId, status, note } })),
  decide: (userId: string, status: "approved" | "rejected" | "more_info", note: string) =>
    all(api(`/api/admin/verifications/${userId}/decide`, { json: { status, note } })),
};
