import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { emailEnabled } from "@/lib/server/email";

export const GET = handle(async () => {
  await requireUser(["admin"]);
  const t = Date.now();
  const [users, stations, sats, bookings, escrow, revenue, credits, openDisputes, pendingDocs, recent] = await Promise.all([
    db.user.groupBy({ by: ["role"], _count: true }),
    db.groundStation.groupBy({ by: ["status"], _count: true }),
    db.satellite.groupBy({ by: ["status"], _count: true }),
    db.booking.groupBy({ by: ["status"], _count: true }),
    db.booking.aggregate({ where: { status: { in: ["confirmed", "manifest_committed"] } }, _sum: { price: true } }),
    db.ledgerEntry.aggregate({ where: { type: "platform_fee" }, _sum: { amount: true } }),
    db.creditAccount.aggregate({ _sum: { balance: true } }),
    db.dispute.count({ where: { status: "open" } }),
    db.submission.count({ where: { status: "submitted" } }),
    db.ledgerEntry.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { user: { select: { email: true } } } }),
  ]);
  const dbMs = Date.now() - t;
  const count = (rows: { _count: number }[], key: string, v: string) => (rows as unknown as Record<string, unknown>[]).find(r => r[key] === v)?._count as number ?? 0;
  return NextResponse.json({
    users: { operator: count(users, "role", "operator"), owner: count(users, "role", "owner"), admin: count(users, "role", "admin") },
    stations: Object.fromEntries(stations.map(s => [s.status, s._count])),
    satellites: Object.fromEntries(sats.map(s => [s.status, s._count])),
    bookings: Object.fromEntries(bookings.map(s => [s.status, s._count])),
    escrowHeld: Number(escrow._sum.price ?? 0),
    platformRevenue: Number(revenue._sum.amount ?? 0),
    creditsOutstanding: Number(credits._sum.balance ?? 0),
    openDisputes, pendingDocs,
    recent: recent.map(e => ({ id: e.id, type: e.type, amount: Number(e.amount), who: e.user?.email ?? "platform", note: e.note, at: e.createdAt.getTime() })),
    health: { dbQueryMs: dbMs, email: emailEnabled() ? "configured" : "not configured" },
  });
});
