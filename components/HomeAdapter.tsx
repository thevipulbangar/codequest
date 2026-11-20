"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OrbitPassFrontend, {
  type OrbitPassData, type OrbitPassNetwork, type OrbitPassStation, type PassSearchQuery, type SatelliteIdentity,
} from "@/components/orbitpass/OrbitPassFrontend";
import { BANDS, type PublicStation } from "@/lib/assets";
import { useSession } from "@/lib/session";

/**
 * Thin adapter: OrbitPass backend -> portable frontend.
 * Reads only the public endpoints (/api/v1/stations, /api/v1/network-stats, /api/v1/satellite-check)
 * and the session; every authoritative number (prices, counts, predictions) comes from the server.
 */

const HOME = { operator: "/dashboard/operator", owner: "/dashboard/station-owner", admin: "/dashboard/admin/overview" } as const;
const FIND = "/dashboard/operator/find-pass";

interface StatsBody { generatedAt: number; stations: number; satellites: number; passes24h: number; contactMin24h: number; perStation: { id: string; passes: number; contactMin: number }[] }

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  return r.json() as Promise<T>;
}

export function HomeAdapter() {
  const router = useRouter();
  const session = useSession();
  const [stations, setStations] = useState<OrbitPassData<OrbitPassStation[]>>({ status: "loading" });
  const [network, setNetwork] = useState<OrbitPassData<OrbitPassNetwork>>({ status: "loading" });

  useEffect(() => {
    let dead = false;
    (async () => {
      const [st, ns] = await Promise.allSettled([
        getJson<{ stations: PublicStation[] }>("/api/v1/stations"),
        getJson<StatsBody>("/api/v1/network-stats"),
      ]);
      if (dead) return;
      const per = new Map(ns.status === "fulfilled" ? ns.value.perStation.map(p => [p.id, p]) : []);
      setNetwork(ns.status === "fulfilled"
        ? { status: "ready", data: { stations: ns.value.stations, satellites: ns.value.satellites, passes24h: ns.value.passes24h, contactMin24h: ns.value.contactMin24h, generatedAt: ns.value.generatedAt } }
        : { status: "unavailable" });
      setStations(st.status === "fulfilled"
        ? { status: "ready", data: st.value.stations.map(s => ({
            id: s.id, name: s.name, country: s.country, latitude: s.latitude, longitude: s.longitude, altitudeM: s.altitudeM,
            antennaType: s.antennaType, antennaSizeM: s.antennaSizeM, bands: s.bands, protocols: s.protocols,
            pricePerPass: s.pricePerPass, ownerName: s.ownerName, reliabilityScore: s.reliability?.score ?? null,
            passes24h: per.get(s.id)?.passes, contactMin24h: per.get(s.id)?.contactMin,
          })) }
        : { status: "unavailable" });
    })();
    return () => { dead = true; };
  }, []);

  /** Operators go straight to the finder; signed-out visitors sign in first and land on the same search. */
  const openFinder = useCallback((params: URLSearchParams): void | string => {
    const target = `${FIND}?${params}`;
    if (session && session.role !== "operator")
      return `Pass search is for satellite operator accounts. You are signed in as ${session.role === "owner" ? "a station owner" : "an admin"}.`;
    router.push(session ? target : `/login?as=operator&next=${encodeURIComponent(target)}`);
  }, [router, session]);

  const onSearchPasses = useCallback((q: PassSearchQuery) => {
    const p = new URLSearchParams({ hours: String(q.hours), minEl: String(q.minElevationDeg) });
    if (q.band) p.set("band", q.band);
    if (q.noradId) p.set("norad", String(q.noradId));
    return openFinder(p);
  }, [openFinder]);

  const onBookStation = useCallback((s: OrbitPassStation) => openFinder(new URLSearchParams({ stationId: s.id })), [openFinder]);

  const onCheckSatellite = useCallback(async (noradId: number): Promise<SatelliteIdentity> => {
    const d = await getJson<{ found: boolean; celestrak: { name: string; internationalDesignator: string; epoch: string } | null; satnogs: { name: string } | null }>(`/api/v1/satellite-check?norad=${noradId}`);
    return { noradId, found: d.found, name: d.celestrak?.name ?? d.satnogs?.name, internationalDesignator: d.celestrak?.internationalDesignator, epoch: d.celestrak?.epoch };
  }, []);

  return (
    <OrbitPassFrontend
      stations={stations}
      network={network}
      session={session === undefined ? undefined : session && { name: session.name, role: session.role }}
      bands={BANDS}
      routes={{ dashboard: session ? HOME[session.role] : "/login", findPass: FIND }}
      onNavigate={href => router.push(href)}
      onSearchPasses={onSearchPasses}
      onBookStation={onBookStation}
      onCheckSatellite={onCheckSatellite}
    />
  );
}
