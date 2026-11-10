import { db } from "@/lib/server/db";
import { HttpError, requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { getObject } from "@/lib/server/storage";
import { audit } from "@/lib/server/verification";

/** Admin-only: decrypt and stream an uploaded document. Every view is audited. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ submissionId: string }> }) => {
  const admin = await requireUser(["admin"]);
  const { submissionId } = await params;
  const s = await db.submission.findUnique({ where: { id: submissionId } });
  if (!s?.storageKey || !s.mimeType) throw new HttpError(404, "No file for this submission");
  const buf = await getObject(s.storageKey);
  await audit(admin.id, "view_document", submissionId);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": s.mimeType,
      "Content-Disposition": `inline; filename="${(s.fileName ?? "document").replace(/["\r\n]/g, "")}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
