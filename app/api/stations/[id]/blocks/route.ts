import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, requireUser } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";

async function own(id: string, userId: string) {
  const s = await db.groundStation.findFirst({ where: { id, ownerId: userId }, select: { id: true } });
  if (!s) throw new HttpError(404, "Not found");
}

/** Unavailable periods for a station (upcoming only). */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(["owner"]);
  const { id } = await params;
  await own(id, u.id);
  const blocks = await db.stationBlock.findMany({ where: { stationId: id, end: { gt: new Date() } }, orderBy: { start: "asc" } });
  return NextResponse.json({ blocks: blocks.map(b => ({ id: b.id, start: b.start.getTime(), end: b.end.getTime(), reason: b.reason })) });
});

const Block = z.object({ start: z.number().int(), end: z.number().int(), reason: z.string().trim().max(200).optional() })
  .refine(b => b.end > b.start, { message: "End must be after start", path: ["end"] })
  .refine(b => b.end - b.start <= 90 * 86_400_000, { message: "At most 90 days per block", path: ["end"] });

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(["owner"]);
  const { id } = await params;
  await own(id, u.id);
  const b = await body(req, Block);
  if (b.end < Date.now()) throw new HttpError(400, "That period is already over");
  const clash = await db.booking.count({ where: { stationId: id, status: { in: ["confirmed", "manifest_committed"] }, aos: { lt: new Date(b.end) }, los: { gt: new Date(b.start) } } });
  if (clash) throw new HttpError(409, `${clash} confirmed booking(s) fall in that period — cancel them first`);
  const blk = await db.stationBlock.create({ data: { stationId: id, start: new Date(b.start), end: new Date(b.end), reason: b.reason } });
  return NextResponse.json({ id: blk.id }, { status: 201 });
});

export const DELETE = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(["owner"]);
  const { id } = await params;
  await own(id, u.id);
  const blockId = new URL(req.url).searchParams.get("blockId") ?? "";
  const r = await db.stationBlock.deleteMany({ where: { id: blockId, stationId: id } });
  if (!r.count) throw new HttpError(404, "Not found");
  return NextResponse.json({ ok: true });
});
