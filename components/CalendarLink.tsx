import { CalendarPlus } from "lucide-react";

/** Downloads upcoming booked passes as an .ics file (Google Calendar, Outlook, Apple Calendar). */
export const CalendarLink = () => (
  <a href="/api/bookings/ics" download className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-sm hover:bg-white/5"><CalendarPlus size={14} />Add upcoming passes to my calendar</a>
);
