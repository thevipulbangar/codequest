import "server-only";
import { Prisma } from "@prisma/client";
import { HttpError } from "./auth";
import { db } from "./db";

type Tx = Prisma.TransactionClient;
const D = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);

/** Interactive-transaction options: the DB is far away, so allow more time than Prisma's 5 s default. */
export const TX = { timeout: 30_000, maxWait: 15_000 } as const;

export const balanceOf = async (userId: string) =>
  D((await db.creditAccount.findUnique({ where: { userId } }))?.balance ?? 0);

/** Credit a user (inside a transaction). Returns the new balance. */
export async function credit(tx: Tx, userId: string, amount: Prisma.Decimal, entry: { type: "credit_grant" | "payout" | "refund" | "adjustment"; bookingId?: string; note?: string }) {
  if (amount.isNegative()) throw new Error("credit amount must be >= 0");
  const acc = await tx.creditAccount.upsert({ where: { userId }, create: { userId, balance: amount }, update: { balance: { increment: amount } } });
  await tx.ledgerEntry.create({ data: { userId, amount, balanceAfter: acc.balance, ...entry } });
  return acc.balance;
}

/** Debit a user only if they have enough (atomic conditional update). Throws 402 otherwise. */
export async function debit(tx: Tx, userId: string, amount: Prisma.Decimal, entry: { type: "escrow_lock" | "adjustment"; bookingId?: string; note?: string }) {
  const r = await tx.creditAccount.updateMany({ where: { userId, balance: { gte: amount } }, data: { balance: { decrement: amount } } });
  if (r.count !== 1) throw new HttpError(402, "Not enough credits");
  const acc = await tx.creditAccount.findUniqueOrThrow({ where: { userId } });
  await tx.ledgerEntry.create({ data: { userId, amount: amount.negated(), balanceAfter: acc.balance, ...entry } });
  return acc.balance;
}

/** Platform revenue entry (userId = null). */
export const platformFee = (tx: Tx, amount: Prisma.Decimal, bookingId: string) =>
  tx.ledgerEntry.create({ data: { userId: null, amount, type: "platform_fee", bookingId } });

export const toCents = (d: Prisma.Decimal.Value) => BigInt(D(d).mul(100).toFixed(0));
export const fromCents = (c: bigint) => D(c.toString()).div(100);
