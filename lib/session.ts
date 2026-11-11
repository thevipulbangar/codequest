"use client";
import { api, clearApiCache, revalidate, useApi } from "./api-client";

export interface Session {
  id: string; email: string; name: string; role: "operator" | "owner" | "admin";
  jobTitle?: string | null; phone?: string | null; country?: string | null;
  company?: string | null; companyType?: string | null; website?: string | null; about?: string | null;
}

const ME = "/api/auth/me";

/** undefined = loading, null = signed out. Session lives in an httpOnly cookie; this reads /api/auth/me. */
export function useSession(): Session | null | undefined {
  const d = useApi<{ user: Session }>(ME);
  return d === undefined ? undefined : d?.user ?? null;
}

export async function signIn(email: string, password: string, role?: Session["role"]) {
  const { user } = await api<{ user: Session }>("/api/auth/login", { json: { email, password, role } });
  await revalidate(ME);
  return user;
}

export async function signUp(input: { name: string; email: string; password: string; role: "operator" | "owner" }) {
  const { user } = await api<{ user: Session }>("/api/auth/signup", { json: input });
  await revalidate(ME);
  return user;
}

export async function signOut() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  clearApiCache();
  await revalidate(ME);
}

export async function updateProfile(patch: Partial<Omit<Session, "id" | "email" | "role">>) {
  await api(ME, { method: "PATCH", json: patch });
  await revalidate(ME);
}
