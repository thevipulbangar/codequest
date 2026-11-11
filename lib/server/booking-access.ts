import "server-only";
import type { User } from "@prisma/client";
import { HttpError } from "./auth";
import { bookingInclude, canSee } from "./bookings";
import { db } from "./db";

/** Load a booking the caller is allowed to see (404 otherwise, so ids can't be probed). */
export async function loadBooking(id: string, u: User) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Not found");
  const b = await db.booking.findUnique({ where: { id }, include: bookingInclude, relationLoadStrategy: "join" });
  if (!b || !canSee(b, u)) throw new HttpError(404, "Not found");
  return b;
}
