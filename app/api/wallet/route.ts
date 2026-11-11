import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

/** Own credit balance, escrow currently held for your bookings, and the latest ledger entries. */
export const GET = handle(async () => {
  const u = await requireUser(["operator", "owner"]);
  const [acc, entries, held] = await Promise.all([
    db.creditAccount.findUnique({ where: { userId: u.id } }),
    db.ledgerEntry.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.booking.aggregate({ where: { operatorId: u.id, status: { in: ["confirmed", "manifest_committed"] } }, _sum: { price: true } }),
  ]);
  return NextResponse.json({
    balance: Number(acc?.balance ?? 0),
    inEscrow: Number(held._sum.price ?? 0),
    entries: entries.map(e => ({ id: e.id, type: e.type, amount: Number(e.amount), balanceAfter: e.balanceAfter === null ? null : Number(e.balanceAfter), note: e.note, bookingId: e.bookingId, at: e.createdAt.getTime() })),
  });
});
