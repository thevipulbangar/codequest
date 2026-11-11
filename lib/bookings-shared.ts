/** Client-safe mirror of lib/server/bookings.ts bookingView(). */
export interface BookingView {
  id: string;
  status: "confirmed" | "manifest_committed" | "settled" | "cancelled" | "expired";
  role: "operator" | "station" | "admin";
  satellite: { id: string; name: string; noradId: number; band: string; downlinkMHz: number };
  station: { id: string; name: string; country: string; latitude: number; longitude: number; owner: string; hasKey: boolean };
  operator: string;
  aos: number; los: number; maxElDeg: number;
  price: number; feeBps: number;
  manifestRoot: string | null; framesPromised: number | null;
  framesVerified: number | null; deliveryBps: number | null;
  report: {
    promised: number; received: number; verified: number; missing: number[]; duplicates: number[];
    invalidHashes: { id: number }[]; timestampViolations: number[]; dopplerAnomalies: number[];
    confidence: string; deliveryBps: number;
  } | null;
  settlement: { stationGross: number; platformFee: number; stationNet: number; operatorRefund: number; settledAt: number } | null;
  receiptFrames: { id: number; t: number; rssi: number }[] | null;
  can: { commitManifest: boolean; cancel: boolean; submitReceipt: boolean; claimRefund: boolean; dispute: boolean };
}

export const BOOKING_STATUS: Record<BookingView["status"], { label: string; tone: "ok" | "warn" | "bad" | "muted" }> = {
  confirmed: { label: "Booked · awaiting manifest", tone: "warn" },
  manifest_committed: { label: "Ready · manifest committed", tone: "ok" },
  settled: { label: "Settled", tone: "ok" },
  cancelled: { label: "Cancelled · refunded", tone: "muted" },
  expired: { label: "Expired · refunded", tone: "bad" },
};

export const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
