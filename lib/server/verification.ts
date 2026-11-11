import "server-only";
import { z } from "zod";
import type { Submission as DbSubmission, User, Verification } from "@prisma/client";
import { DEFAULT_SETUP, type AssetKind, type Setup, type Submission } from "../verification/requirements";
import { db } from "./db";

export const kindFor = (role: User["role"]): AssetKind => (role === "operator" ? "satellite" : "station");

export const SetupSchema = z.object({
  ownerType: z.enum(["company", "individual"]),
  gstRegistered: z.boolean(),
  operatorDiffers: z.boolean(),
  assetAcquired: z.boolean(),
  siteControl: z.enum(["owned", "leased", "permission"]),
  representative: z.boolean(),
});

export const setupOf = (v: Verification | null): Setup => {
  const r = SetupSchema.safeParse(v?.setup);
  return r.success ? r.data : DEFAULT_SETUP;
};

const toSub = (s: DbSubmission): Submission => ({
  id: s.id, docId: s.docId, status: s.status, submittedAt: s.submittedAt.getTime(),
  fileName: s.fileName ?? undefined, size: s.size ?? undefined, sha256: s.sha256 ?? undefined,
  text: s.text ?? undefined, notApplicable: s.notApplicable ?? undefined, note: s.reviewNote ?? undefined,
});

/** Client-facing shape (matches lib/verification/store.ts VerificationState). */
export function toState(u: User, v: (Verification & { submissions: DbSubmission[] }) | null) {
  return {
    userId: u.id, email: u.email, name: u.name, role: u.role as "operator" | "owner",
    setup: setupOf(v),
    subs: Object.fromEntries((v?.submissions ?? []).map(s => [s.docId, toSub(s)])),
    decision: v?.decision ? { status: v.decision as "approved" | "rejected" | "more_info", note: v.decisionNote ?? "", at: v.decidedAt?.getTime() ?? 0 } : undefined,
    updatedAt: (v?.updatedAt ?? u.updatedAt).getTime(),
  };
}

export const loadVerification = (userId: string) =>
  db.verification.findUnique({ where: { userId }, include: { submissions: true }, relationLoadStrategy: "join" });

export const ensureVerification = (userId: string) =>
  db.verification.upsert({ where: { userId }, create: { userId, setup: { ...DEFAULT_SETUP } }, update: {} });

export const audit = (actorId: string, action: string, target: string, detail?: string) =>
  db.auditLog.create({ data: { actorId, action, target, detail } });
