/**
 * Pro-rata settlement in integer base units (bigint) — mirrors the Solidity escrow.
 * Fee model: the platform fee is taken from the STATION's earned share. The operator never pays more than
 * the booking fee and always gets back exactly fee * (1 - delivery).
 */
export interface Settlement { stationGross: bigint; platformFee: bigint; stationNet: bigint; operatorRefund: bigint }
export const DEFAULT_FEE_BPS = 800;
export const TOKEN_DECIMALS = 6;

export function settle(bookingFee: bigint, promised: number, verified: number, feeBps = DEFAULT_FEE_BPS): Settlement {
  if (bookingFee < 0n || promised <= 0 || verified < 0 || verified > promised || feeBps < 0 || feeBps > 2000)
    throw new RangeError("invalid settlement inputs");
  const stationGross = (bookingFee * BigInt(verified)) / BigInt(promised);
  const platformFee = (stationGross * BigInt(feeBps)) / 10000n;
  return { stationGross, platformFee, stationNet: stationGross - platformFee, operatorRefund: bookingFee - stationGross };
}

export const toUnits = (tokens: number) => BigInt(Math.round(tokens * 10 ** TOKEN_DECIMALS));
export const fmt = (u: bigint) => (Number(u) / 10 ** TOKEN_DECIMALS).toFixed(2);
