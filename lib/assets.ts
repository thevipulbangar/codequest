import { z } from "zod";

export const BANDS = ["VHF", "UHF", "L", "S", "X", "Ku", "Ka"] as const;
export const PROTOCOLS = ["AX.25", "CCSDS", "APT", "LRPT", "HRPT", "DVB-S2", "Other"] as const;
export type AssetStatus = "pending" | "active" | "rejected" | "suspended";

export const STATUS_LABEL: Record<AssetStatus, string> = {
  pending: "Pending review", active: "Active", rejected: "Rejected", suspended: "Suspended",
};

export const SatelliteInput = z.object({
  name: z.string().trim().min(2).max(80),
  noradId: z.coerce.number().int().min(1).max(999_999_999),
  intlDesignator: z.string().trim().toUpperCase().regex(/^\d{4}-\d{3}[A-Z]{1,3}$/, "e.g. 1998-067A").optional().or(z.literal("").transform(() => undefined)),
  band: z.enum(BANDS),
  downlinkMHz: z.coerce.number().positive().max(100_000),
  protocol: z.enum(PROTOCOLS),
});

export const StationInput = z.object({
  name: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(60),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  altitudeM: z.coerce.number().min(-500).max(9000).default(0),
  antennaType: z.string().trim().min(2).max(60),
  antennaSizeM: z.coerce.number().positive().max(100),
  bands: z.array(z.enum(BANDS)).min(1, "Pick at least one band"),
  protocols: z.array(z.enum(PROTOCOLS)).min(1, "Pick at least one protocol"),
  pricePerPass: z.coerce.number().min(0).max(1_000_000),
});

/** Public shapes (safe to send to any client). */
export interface PublicStation {
  id: string; name: string; country: string; latitude: number; longitude: number; altitudeM: number;
  antennaType: string; antennaSizeM: number; bands: string[]; protocols: string[]; pricePerPass: number; ownerName: string;
}
export interface OwnedSatellite {
  id: string; name: string; noradId: number; intlDesignator: string | null; band: string; downlinkMHz: number;
  protocol: string; status: AssetStatus; reviewNote: string | null; createdAt: string;
}
export interface OwnedStation extends Omit<PublicStation, "ownerName"> {
  status: AssetStatus; reviewNote: string | null; createdAt: string;
}
