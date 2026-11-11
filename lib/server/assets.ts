import "server-only";
import type { GroundStation, Satellite } from "@prisma/client";
import type { OwnedSatellite, OwnedStation, PublicStation } from "../assets";
import { db } from "./db";

/**
 * THE activation rule, in one place: an asset is live only if an admin approved the asset itself
 * AND its owner's verification decision is "approved". Losing owner approval hides it automatically.
 */
const ownerApproved = { owner: { verification: { is: { decision: "approved" } } } } as const;

export const activeStations = () =>
  db.groundStation.findMany({ where: { status: "active", ...ownerApproved }, include: { owner: { select: { name: true, company: true } } }, orderBy: { createdAt: "asc" } });

export const activeSatellites = (ownerId?: string) =>
  db.satellite.findMany({ where: { status: "active", ...ownerApproved, ...(ownerId ? { ownerId } : {}) }, orderBy: { createdAt: "asc" } });

export async function isOwnerApproved(userId: string) {
  const v = await db.verification.findUnique({ where: { userId }, select: { decision: true } });
  return v?.decision === "approved";
}

export const publicStation = (s: GroundStation & { owner: { name: string; company: string | null } }): PublicStation => ({
  id: s.id, name: s.name, country: s.country, latitude: s.latitude, longitude: s.longitude, altitudeM: s.altitudeM,
  antennaType: s.antennaType, antennaSizeM: s.antennaSizeM, bands: s.bands, protocols: s.protocols,
  pricePerPass: Number(s.pricePerPass), ownerName: s.owner.company || s.owner.name,
});

export const ownedStation = (s: GroundStation): OwnedStation => ({
  id: s.id, name: s.name, country: s.country, latitude: s.latitude, longitude: s.longitude, altitudeM: s.altitudeM,
  antennaType: s.antennaType, antennaSizeM: s.antennaSizeM, bands: s.bands, protocols: s.protocols,
  pricePerPass: Number(s.pricePerPass), status: s.status, reviewNote: s.reviewNote, createdAt: s.createdAt.toISOString(),
});

export const ownedSatellite = (s: Satellite): OwnedSatellite => ({
  id: s.id, name: s.name, noradId: s.noradId, intlDesignator: s.intlDesignator, band: s.band, downlinkMHz: s.downlinkMHz,
  protocol: s.protocol, status: s.status, reviewNote: s.reviewNote, createdAt: s.createdAt.toISOString(),
});
