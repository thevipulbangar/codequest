import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, requireUser } from "@/lib/server/auth";
import { body, handle, rateLimit } from "@/lib/server/http";
import { putObject, sha256, sniffType } from "@/lib/server/storage";
import { ensureVerification, kindFor, setupOf } from "@/lib/server/verification";
import { MAX_BYTES, docsFor, validateText } from "@/lib/verification/requirements";

const Json = z.union([
  z.object({ docId: z.string().max(40), text: z.string().max(60) }),
  z.object({ docId: z.string().max(40), notApplicable: z.string().trim().min(10).max(500) }),
  z.object({ docId: z.string().max(40), kyc: z.literal(true) }),
]);

/** Submit one document: multipart (docId + file) or JSON (text / not-applicable / KYC). */
export const POST = handle(async (req: Request) => {
  const u = await requireUser(["operator", "owner"]);
  rateLimit(`docs:${u.id}`, 60, 3600_000);
  const v = await ensureVerification(u.id);
  const docs = docsFor(kindFor(u.role), setupOf(v));
  const find = (id: string) => {
    const d = docs.find(x => x.id === id);
    if (!d) throw new HttpError(400, "This document does not apply to your account");
    return d;
  };

  let data: { docId: string; fileName?: string; mimeType?: string; size?: number; sha256?: string; storageKey?: string; text?: string; notApplicable?: string };

  if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const form = await req.formData();
    const doc = find(String(form.get("docId") ?? ""));
    if (doc.kind && doc.kind !== "file") throw new HttpError(400, "This document is not a file upload");
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Missing file");
    if (file.size === 0 || file.size > MAX_BYTES) throw new HttpError(400, "File must be between 1 byte and 10 MB");
    const buf = Buffer.from(await file.arrayBuffer());
    const mimeType = sniffType(buf);
    if (!mimeType) throw new HttpError(400, "Only PDF, PNG or JPG files are accepted");
    const storageKey = `${u.id}/${doc.id}/${randomUUID()}`;
    await putObject(storageKey, buf); // encrypted before upload
    // NOTE: a replaced file's old object is left in storage; add a cleanup job if storage cost matters.
    data = { docId: doc.id, fileName: file.name.slice(0, 200), mimeType, size: file.size, sha256: sha256(buf), storageKey };
  } else {
    const b = await body(req, Json);
    const doc = find(b.docId);
    if ("text" in b) {
      if (doc.kind !== "text") throw new HttpError(400, "This document needs a file");
      const err = validateText(doc, b.text);
      if (err) throw new HttpError(400, err);
      data = { docId: doc.id, text: b.text.trim().toUpperCase() };
    } else if ("notApplicable" in b) {
      if (!doc.whereApplicable) throw new HttpError(400, "This document cannot be marked not applicable");
      data = { docId: doc.id, notApplicable: b.notApplicable };
    } else {
      if (doc.kind !== "kyc") throw new HttpError(400, "Not a KYC item");
      data = { docId: doc.id, text: "KYC-PROVIDER-NOT-CONNECTED" };
    }
  }

  const existing = await db.submission.findUnique({ where: { verificationId_docId: { verificationId: v.id, docId: data.docId } } });
  if (existing?.status === "approved") throw new HttpError(409, "Already approved — contact support to change it");
  const reset = { fileName: null, mimeType: null, size: null, sha256: null, storageKey: null, text: null, notApplicable: null };
  await db.$transaction([
    db.submission.upsert({
      where: { verificationId_docId: { verificationId: v.id, docId: data.docId } },
      create: { verificationId: v.id, ...data },
      update: { ...reset, ...data, status: "submitted", reviewNote: null, reviewedAt: null, submittedAt: new Date() },
    }),
    db.verification.update({ where: { id: v.id }, data: { decision: null, decisionNote: null, decidedAt: null } }),
  ]);
  return NextResponse.json({ ok: true }, { status: 201 });
});
