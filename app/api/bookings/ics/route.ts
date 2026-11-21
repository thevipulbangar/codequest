import { requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { OPEN_STATUSES } from "@/lib/server/bookings";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, m => `\${m}`).replace(/\n/g, "\n");

/** Upcoming booked passes as an iCalendar file (RFC 5545), for Google Calendar, Outlook or Apple Calendar. */
export const GET = handle(async () => {
  const u = await requireUser(["operator", "owner"]);
  const list = await db.booking.findMany({
    where: { status: { in: [...OPEN_STATUSES] }, los: { gt: new Date() }, ...(u.role === "operator" ? { operatorId: u.id } : { station: { ownerId: u.id } }) },
    include: { satellite: { select: { name: true, band: true, noradId: true } }, station: { select: { name: true, country: true } } },
    orderBy: { aos: "asc" }, take: 500,
  });
  const now = stamp(new Date());
  const events = list.map(b => [
    "BEGIN:VEVENT", `UID:${b.id}@orbitpass`, `DTSTAMP:${now}`, `DTSTART:${stamp(b.aos)}`, `DTEND:${stamp(b.los)}`,
    `SUMMARY:${esc(`${b.satellite.name} pass @ ${b.station.name}`)}`,
    `LOCATION:${esc(`${b.station.name}, ${b.station.country}`)}`,
    `DESCRIPTION:${esc(`NORAD ${b.satellite.noradId} · ${b.satellite.band} band · max elevation ${b.maxElDeg}°${b.status === "confirmed" ? "\nCommit the frame manifest before AOS." : ""}`)}`,
    "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:Pass starts in 15 minutes", "END:VALARM",
    "END:VEVENT",
  ].join("\r\n"));
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OrbitPass//Passes//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:OrbitPass passes", ...events, "END:VCALENDAR", ""].join("\r\n");
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="orbitpass-passes.ics"', "Cache-Control": "no-store" } });
});
