"use client";
import { useMemo, useSyncExternalStore } from "react";

export interface Session {
  email: string; name: string; role: "operator" | "owner" | "admin"; demo: boolean;
  jobTitle?: string; phone?: string; country?: string;
  company?: string; companyType?: string; website?: string; about?: string;
}

const KEY = "orbitpass.session";
const EVT = "orbitpass-session";

const subscribe = (cb: () => void) => {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
};

/** undefined = still hydrating, null = signed out. DEMO session in localStorage; swap for Supabase Auth. */
export function useSession(): Session | null | undefined {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY) ?? "", () => undefined);
  return useMemo(() => {
    if (raw === undefined) return undefined;
    try { return raw ? (JSON.parse(raw) as Session) : null; } catch { return null; }
  }, [raw]);
}

export function saveSession(s: Session) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(EVT));
}
export function clearSession() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVT));
}
