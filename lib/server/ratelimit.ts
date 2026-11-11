import "server-only";
import { HttpError } from "./auth";
import { db } from "./db";

/**
 * Fixed-window limiter shared by ALL server instances (single atomic upsert in Postgres).
 * Use for abuse-sensitive endpoints (login, sign-up, password reset); costs one DB round trip.
 */
export async function rateLimitShared(key: string, max: number, windowMs: number) {
  const reset = new Date(Date.now() + windowMs);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${reset})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN ${reset} ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  if ((rows[0]?.count ?? 0) > max) throw new HttpError(429, "Too many attempts, try again later");
}
