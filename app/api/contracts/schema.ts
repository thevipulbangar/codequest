import { z } from "zod";

/** Shared by quote and purchase. Money is never taken from here: the server re-plans and re-prices. */
export const ContractBody = z.object({
  satelliteId: z.string().uuid(),
  targetMB: z.number().min(0.1).max(1_000_000),
  rateKbps: z.number().min(0.1).max(2_000_000),
  deadline: z.number().int().positive(),
  minElDeg: z.number().min(0).max(80).default(10),
  compensation: z.number().min(0).max(1_000_000),
});
