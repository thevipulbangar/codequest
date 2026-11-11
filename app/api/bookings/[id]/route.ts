import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { bookingView } from "@/lib/server/bookings";
import { loadBooking } from "@/lib/server/booking-access";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  const b = await loadBooking((await params).id, u);
  return NextResponse.json({ booking: bookingView(b, u) });
});
