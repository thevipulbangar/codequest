"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { clearSession, saveSession, useSession, type Session } from "@/lib/session";

const FIELDS = {
  person: [["name", "Full name", "Your name"], ["jobTitle", "Job title", "e.g. Mission operations lead"], ["phone", "Phone", "+91 98765 43210"], ["country", "Country", "India"]],
  company: [["company", "Company / organisation", "Acme Space Pvt Ltd"], ["companyType", "Organisation type", "Startup, university, agency…"], ["website", "Website", "https://example.com"]],
} as const;

export default function Profile() {
  const session = useSession();
  if (!session) return null; // layout handles loading + redirect
  return <ProfileForm key={session.email} session={session} />;
}

function ProfileForm({ session }: { session: Session }) {
  const router = useRouter();
  const [f, setF] = useState<Session>(session);
  const set = (k: keyof Session) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const inp = "mt-1.5 w-full rounded-lg border border-line bg-bg2 px-3 py-2.5 text-sm normal-case tracking-normal text-white outline-none transition focus:border-accent";

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.name.trim().length < 2) return toast.error("Enter your name");
    if (f.website && !/^https?:\/\/\S+\.\S+{/.test(f.website)) return toast.error("Website must start with http:// or https://");
    saveSession({ ...f, name: f.name.trim() });
    toast.success("Profile saved");
  }

  const group = (title: string, rows: readonly (readonly [keyof Session, string, string])[]) => (
    <div className="panel p-5">
      <div className="eyebrow mb-4">{title}</div>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(([k, label, ph]) => <label key={k} className="text-xs text-muted">{label}<input className={inp} placeholder={ph} value={(f[k] as string) ?? ""} onChange={set(k)} /></label>)}
      </div>
    </div>
  );

  return (
    <form onSubmit={save} className="max-w-3xl space-y-4">
      <PageTitle title="Profile" sub={`${{ operator: "Satellite operator", owner: "Ground station owner", admin: "Admin" }[session.role]} · ${session.email} · role is set at sign-in`} />
      {group("Person", FIELDS.person)}
      {group("Company", FIELDS.company)}
      <div className="panel p-5">
        <label className="text-xs text-muted">About your {session.role === "operator" ? "mission" : "station"}
          <textarea rows={3} maxLength={400} className={inp} placeholder={session.role === "operator" ? "What satellites do you operate and what data do you need?" : "Describe your antenna setup and availability."} value={f.about ?? ""} onChange={set("about")} />
        </label>
      </div>
      <div className="flex items-center justify-between">
        <button className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium hover:bg-blue-500">Save profile</button>
        <button type="button" onClick={() => { clearSession(); router.push("/login"); }} className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/10"><LogOut size={15} />Log out</button>
      </div>
      <p className="mono text-[11px] text-muted">Demo mode: profile is stored in this browser only.</p>
    </form>
  );
}
