
/** Real public satellites (NORAD IDs). Names/TLEs are pulled live from CelesTrak; see tleFor(). */
export const SATELLITES = [
  { norad: 25544, name: "ISS (ZARYA)", type: "Crewed station", band: "S", downlinkMHz: 2200, protocol: "CCSDS" },
  { norad: 27607, name: "SO-50", type: "Amateur CubeSat-class", band: "UHF", downlinkMHz: 436.795, protocol: "AX.25" },
  { norad: 40967, name: "AO-85 (Fox-1A)", type: "Amateur CubeSat", band: "UHF", downlinkMHz: 145.98, protocol: "AX.25" },
  { norad: 25338, name: "NOAA 15", type: "Weather", band: "VHF", downlinkMHz: 137.62, protocol: "APT" },
  { norad: 28654, name: "NOAA 18", type: "Weather", band: "VHF", downlinkMHz: 137.9125, protocol: "APT" },
  { norad: 33591, name: "NOAA 19", type: "Weather", band: "VHF", downlinkMHz: 137.1, protocol: "APT" },
] as const;

/**
 * Demo stations at REAL coordinates. Owners, prices, and reliability are SAMPLE data (clearly labelled in UI).
 */
export const STATIONS = [
  { id: "st-blr", name: "Bengaluru Rooftop Array", country: "India", lat: 12.9716, lon: 77.5946, antenna: "Yagi tracker", diameterM: 1.2, bands: ["VHF", "UHF"], protocols: ["AX.25", "APT"], pricePerPass: 40, reliability: 91, completed: 214, avgDelivery: 93.4, verified: true },
  { id: "st-lyr", name: "Svalbard Polar Dish", country: "Norway", lat: 78.2232, lon: 15.6267, antenna: "Parabolic dish", diameterM: 3.7, bands: ["UHF", "S", "X"], protocols: ["AX.25", "CCSDS"], pricePerPass: 85, reliability: 96, completed: 612, avgDelivery: 97.1, verified: true },
  { id: "st-scl", name: "Santiago Andes Station", country: "Chile", lat: -33.4489, lon: -70.6693, antenna: "Parabolic dish", diameterM: 2.4, bands: ["VHF", "UHF", "S"], protocols: ["AX.25", "CCSDS"], pricePerPass: 60, reliability: 84, completed: 148, avgDelivery: 88.9, verified: true },
  { id: "st-per", name: "Perth Outback Array", country: "Australia", lat: -31.9505, lon: 115.8605, antenna: "Helical array", diameterM: 1.8, bands: ["VHF", "UHF"], protocols: ["AX.25", "APT"], pricePerPass: 35, reliability: 78, completed: 72, avgDelivery: 81.2, verified: false },
  { id: "st-rkv", name: "Reykjavik Coastal Dish", country: "Iceland", lat: 64.1466, lon: -21.9426, antenna: "Parabolic dish", diameterM: 3.0, bands: ["UHF", "S"], protocols: ["AX.25", "CCSDS"], pricePerPass: 70, reliability: 93, completed: 305, avgDelivery: 95.0, verified: true },
] as const;


