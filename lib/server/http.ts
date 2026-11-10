import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { HttpError } from "./auth";

/** Wraps a route handler: maps HttpError -> status, hides internals for everything else. */
export function handle<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A) => {
    try { return await fn(...a); }
    catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error("[api]", e);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  };
}

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const r = schema.safeParse(await req.json().catch(() => null));
  if (!r.success) throw new HttpError(400, r.error.issues.map(i => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  return r.data;
}

// ponytail: in-memory fixed window, per server instance. On serverless each instance has its own counter;
// move to Postgres/Upstash if abuse shows up.
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now(), h = hits.get(key);
  if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return; }
  if (++h.n > max) throw new HttpError(429, "Too many attempts, try again later");
}
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
