import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";

export const GET = handle(async () => {
  const u = await requireUser();
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.notification.count({ where: { userId: u.id, readAt: null } }),
  ]);
  return NextResponse.json({ unread, items: items.map(n => ({ id: n.id, title: n.title, body: n.body, link: n.link, read: !!n.readAt, at: n.createdAt.getTime() })) });
});

/** Mark notifications read (all when no ids are given). */
export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const b = await body(req, z.object({ ids: z.array(z.string().uuid()).max(100).optional() }));
  await db.notification.updateMany({ where: { userId: u.id, readAt: null, ...(b.ids ? { id: { in: b.ids } } : {}) }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
});
