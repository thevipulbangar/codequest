"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { api } from "@/lib/api-client";

export default function VerifyEmail() {
  return <Suspense><Verify /></Suspense>;
}

function Verify() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"busy" | "ok" | "err">("busy");
  const [msg, setMsg] = useState("");
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return; // tokens are single-use: never submit twice
    once.current = true;
    api("/api/auth/verify-email", { json: { token } })
      .then(() => setState("ok"))
      .catch(e => { setMsg(e instanceof Error ? e.message : "Something went wrong"); setState("err"); });
  }, [token]);
  return (
    <AuthShell title="Confirm your email">
      {state === "busy" && <p className="text-sm text-muted">Confirming…</p>}
      {state === "ok" && <p className="text-sm text-muted">Thanks — your email is confirmed. <Link href="/login" className="text-cyan underline">Continue to OrbitPass</Link></p>}
      {state === "err" && <p className="text-sm text-red-400">{msg} You can request a new link from your dashboard.</p>}
    </AuthShell>
  );
}
