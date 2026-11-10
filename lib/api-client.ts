"use client";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Tiny fetch cache for client components.
 * useApi(url): undefined = loading, null = 401 / not found, otherwise the JSON body.
 */
const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<void>>();
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());

export async function revalidate(url: string) {
  const r = await fetch(url, { credentials: "same-origin", cache: "no-store" }).catch(() => null);
  if (!r) return;
  if (r.ok) cache.set(url, await r.json());
  else if (r.status === 401 || r.status === 403 || r.status === 404) cache.set(url, null);
  emit();
}

export function clearApiCache() { cache.clear(); emit(); }

export function useApi<T>(url: string | null): T | null | undefined {
  const v = useSyncExternalStore(
    cb => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => (url ? cache.get(url) : null),
    () => undefined,
  );
  useEffect(() => {
    if (!url || cache.has(url) || inflight.has(url)) return;
    inflight.set(url, revalidate(url).finally(() => inflight.delete(url)));
  }, [url]);
  return v as T | null | undefined;
}

/** JSON request; throws Error(message from server) on failure. */
export async function api<T = unknown>(path: string, init?: { method?: string; json?: unknown; form?: FormData }): Promise<T> {
  const r = await fetch(path, {
    method: init?.method ?? (init?.json || init?.form ? "POST" : "GET"),
    credentials: "same-origin",
    headers: init?.json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.form ?? (init?.json !== undefined ? JSON.stringify(init.json) : undefined),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `Request failed (${r.status})`);
  return data as T;
}
