import "server-only";
import { HttpError } from "./auth";

/**
 * Shared demo accounts whose logins are published in the README for judges and visitors.
 * Everything a visitor needs to try works (booking, guarantees, receipts, top-ups); changes that would
 * break the demo for the next person (password, profile, verification, keys, deleting assets) are refused.
 */
export const SHOWCASE_EMAILS = new Set(["operator@orbitpass.example", "owner@orbitpass.example"]);

export function assertEditable(u: { email: string }, what: string) {
  if (SHOWCASE_EMAILS.has(u.email)) throw new HttpError(403, `This is a shared demo account, so ${what} is switched off. Create your own account to try it.`);
}
