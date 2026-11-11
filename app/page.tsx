import Link from "next/link";
import { ArrowRight, Radio, Satellite, ShieldCheck, Coins, Search, Lock, FileCheck2, Globe2, Cpu } from "lucide-react";
import { GlobeClient } from "@/components/globe/GlobeClient";
import { Reveal } from "@/components/Reveal";
import { Counter, FadeIn, GrowBar } from "@/components/Motion";
import { MobileNav } from "@/components/MobileNav";
import { activeStations, publicStation } from "@/lib/server/assets";
import { getNetworkStats } from "@/lib/orbital/stats";
import { connection } from "next/server";
import { Suspense } from "react";

const steps = [
  [Search, "Discover", "Real SGP4 pass prediction over live public TLEs."],
  [Radio, "Filter", "Band, protocol and elevation fit per station."],
  [Lock, "Book & hold", "Your fee is held until delivery is verified."],
  [FileCheck2, "Verify", "Manifest × signed receipt × pass physics."],
  [Coins, "Settle", "Station paid per verified frame. Rest refunded."],
] as const;

const Btn = ({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) => (
  <Link href={href} className={`inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-medium btn-press ${primary ? "bg-accent text-white hover:bg-blue-500" : "border border-line text-slate-200 hover:bg-white/5"}`}>
    {children}
  </Link>
);

/** Live numbers stream in after the static shell (they depend on the current time). */
async function LiveTiles() {
  await connection();
  const stats = await getNetworkStats(); // real SGP4 numbers, cached 5 min
  const tiles = [
    [String(stats.stations), "Verified ground stations"],
    [String(stats.satellites), "Verified satellites"],
    [String(stats.passes24h), "Predicted passes, next 24 h"],
    [`${stats.contactMin24h.toLocaleString("en-US")} min`, "Predicted contact time, next 24 h"],
  ];
  return <>
    {tiles.map(([v, l]) => (
      <div key={l} className="panel m-1 p-5"><div className="text-3xl font-semibold tracking-tight"><Counter value={v} /></div><div className="mt-1 text-sm text-muted">{l}</div></div>
    ))}
  </>;
}

/** Globe markers = verified, active stations only. */
async function GlobeStations() {
  await connection();
  const stations = (await activeStations()).map(s => ({ id: s.id, name: s.name, lat: s.latitude, lon: s.longitude }));
  return <GlobeClient stations={stations} />;
}

async function FeaturedStations() {
  await connection();
  const [list, stats] = await Promise.all([activeStations(), getNetworkStats()]);
  if (!list.length) return (
    <div className="panel p-8 text-center">
      <div className="font-medium">The first verified stations are being onboarded.</div>
      <p className="mt-1 text-sm text-muted">Own a ground station? Get verified and list it.</p>
      <div className="mt-4"><Btn href="/login?as=owner&mode=signup">Become a Ground Station Partner</Btn></div>
    </div>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.slice(0, 6).map(publicStation).map(s => {
        const p = stats.perStation.find(x => x.id === s.id);
        return (
          <Reveal key={s.id}><div className="grad-border lift p-5">
            <div className="flex items-start justify-between gap-2"><div className="font-medium">{s.name}</div><span className="mono rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">verified</span></div>
            <div className="mt-1 text-sm text-muted">{s.country} · {s.antennaType} {s.antennaSizeM} m</div>
            <div className="mt-4 flex flex-wrap gap-1.5">{s.bands.map(b => <span key={b} className="mono rounded border border-line px-2 py-0.5 text-xs text-slate-300">{b}</span>)}</div>
            <div className="mono mt-4 text-sm">{s.pricePerPass.toFixed(2)} <span className="text-muted">/ pass</span></div>
            {p && <div className="mono mt-1 text-xs text-cyan">{p.passes} passes · {p.contactMin} contact min next 24 h</div>}
          </div></Reveal>
        );
      })}
    </div>
  );
}

export default function Home() {
  return (
    <main>
      <div className="h-[68px]" aria-hidden />
      <header className="glass glass-fixed pb-3">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight"><span className="grid h-7 w-7 place-items-center rounded-md bg-accent"><Satellite size={15} /></span>OrbitPass</Link>
        <div className="hidden gap-8 text-sm text-muted md:flex">
          <a href="#how" className="nav-link hover:text-white">How it works</a><a href="#proof" className="nav-link hover:text-white">Proof of Downlink</a><a href="#stack" className="nav-link hover:text-white">Architecture</a>
        </div>
        <div className="flex items-center gap-2"><Link href="/login" className="rounded-lg border border-line px-4 py-2 text-sm btn-press hover:bg-white/5">Get started</Link><MobileNav links={[["#how", "How it works"], ["#proof", "Proof of Downlink"], ["#stack", "Architecture"]]} /></div>
      </nav>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-4 px-4 pb-10 pt-6 sm:px-6 lg:grid-cols-2">
        <div>
          <FadeIn><div className="eyebrow mb-5 flex items-center gap-2"><span className="pulse-dot" />Verified ground-station network</div></FadeIn>
          <FadeIn delay={0.1}><h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-7xl">Your Satellite.<br />Every Pass.<br /><span className="shimmer-text bg-gradient-to-r from-accent via-cyan to-accent bg-clip-text text-transparent">Anywhere on Earth.</span></h1></FadeIn>
          <FadeIn delay={0.25}><p className="mt-6 max-w-xl text-lg text-muted">Access a global network of ground stations. Book satellite downlinks on demand. Pay only for the data successfully received.</p></FadeIn>
          <FadeIn delay={0.4}><div className="mt-8 flex flex-wrap gap-3">
            <Btn href="/dashboard/operator/find-pass" primary>Explore Satellite Passes <ArrowRight size={16} /></Btn>
            <Btn href="/login?as=owner&mode=signup">Become a Ground Station Partner</Btn>
          </div></FadeIn>
          <p className="mono mt-6 text-xs text-muted">Orbit paths on the globe are illustrative · Markers are verified ground stations · Pass figures are live SGP4 on CelesTrak data</p>
        </div>
        <FadeIn delay={0.3} y={0} className="relative h-[340px] sm:h-[460px] md:h-[600px]"><div className="float h-full w-full"><Suspense fallback={<GlobeClient stations={[]} />}><GlobeStations /></Suspense></div></FadeIn>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden px-6 md:grid-cols-4">
        <Suspense fallback={Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton m-1 h-[104px]" />)}><LiveTiles /></Suspense>
      </section>

      <Section id="how" eyebrow="How it works" title="A marketplace for every pass.">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          {steps.map(([Icon, t, d], i) => (
            <Reveal key={t} delay={i * 0.06}><div className="grad-border lift h-full p-5"><Icon size={18} className="text-cyan" /><div className="mono mt-4 text-xs text-muted">0{i + 1}</div><div className="mt-1 font-medium">{t}</div><p className="mt-2 text-sm text-muted">{d}</p></div></Reveal>
          ))}
        </div>
      </Section>

      <Section eyebrow="Ground stations" title="Verified stations">
        <Suspense fallback={<div className="skeleton h-40" />}><FeaturedStations /></Suspense>
      </Section>

      <Section id="proof" eyebrow="Proof of Downlink" title="Don’t trust the transaction. Verify the data.">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <ul className="space-y-4">
            {[["Manifest", "Frame hashes are committed as a Merkle root before the pass. Immutable after commitment."], ["Signed receipt", "The station signs (ed25519) the frames it received, with timestamps, RSSI and Doppler."], ["Merkle match", "The verifier recomputes hashes and detects missing, duplicate and tampered frames."], ["Physics check", "Timestamps must fall inside the predicted pass window; Doppler must follow the expected sweep."]].map(([t, d]) => (
              <li key={t} className="flex gap-3"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-400" /><div><div className="font-medium">{t}</div><div className="text-sm text-muted">{d}</div></div></li>
            ))}
          </ul>
          <div className="panel p-6">
            <div className="mono text-xs text-muted">EXAMPLE · ONE PASS · 100 FRAMES</div>
            <div className="mt-4 grid grid-cols-3 text-center"><div><div className="text-3xl font-semibold"><Counter value="100" /></div><div className="text-xs text-muted">PROMISED</div></div><div><div className="text-3xl font-semibold text-emerald-400"><Counter value="94" /></div><div className="text-xs text-muted">VERIFIED</div></div><div><div className="text-3xl font-semibold text-cyan"><Counter value="94%" /></div><div className="text-xs text-muted">DELIVERY</div></div></div>
            <div className="mt-5 flex h-2 overflow-hidden rounded-full"><GrowBar pct={94} className="bg-emerald-500" /><GrowBar pct={6} className="bg-red-500/70" /></div>
            <p className="mt-5 text-sm text-muted">94 frames verified → the station is paid for 94%, and 6% of the fee goes back to the operator.</p>
          </div>
        </div>
      </Section>

      <Section eyebrow="Value on both sides" title="Built for operators and station owners.">
        <div className="grid gap-3 md:grid-cols-2">
          <Reveal><div className="grad-border lift p-6"><div className="eyebrow">Satellite operators</div><ul className="mt-3 space-y-2 text-sm text-slate-300"><li>More downlink, no new hardware</li><li>Per-pass booking — no contracts</li><li>Pay only for verified frames; unverified share is refunded</li></ul></div></Reveal>
          <Reveal delay={0.08}><div className="grad-border lift p-6"><div className="eyebrow">Station owners</div><ul className="mt-3 space-y-2 text-sm text-slate-300"><li>Income from idle antennas</li><li>A public, transparent reliability score</li><li>Escrowed payment — paid on verification</li></ul></div></Reveal>
        </div>
      </Section>

      <Section id="stack" eyebrow="Technology architecture" title="Built on open data. Secured by verification.">
        <div className="grid gap-3 md:grid-cols-3">
          {[[Globe2, "L1 · Application", "Marketplace, pass finder, owner verification and admin review."], [Cpu, "L2 · Verification", "SGP4 prediction (CelesTrak TLEs), Merkle, timestamp and Doppler checks. Decides payouts — never an LLM."], [Coins, "L3 · Settlement", "Escrowed, pro-rata payout: only the verified share of the fee is released to the station."]].map(([I, t, d], i) => {
            const Icon = I as typeof Globe2;
            return <Reveal key={String(t)} delay={i * 0.06}><div className="grad-border lift h-full p-5"><Icon size={18} className="text-accent" /><div className="mt-3 font-medium">{t as string}</div><p className="mt-2 text-sm text-muted">{d as string}</p></div></Reveal>;
          })}
        </div>
      </Section>

      <section className="mx-auto max-w-7xl px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">OrbitPass makes every pass count.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3"><Btn href="/login" primary>Get started <ArrowRight size={16} /></Btn><Btn href="/login?as=owner&mode=signup">List your station</Btn></div>
      </section>
      <footer className="border-t border-line px-6 py-8 text-center text-xs text-muted">© 2026 OrbitPass</footer>
    </main>
  );
}

function Section({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-7xl px-6 py-16">
      <Reveal><div className="eyebrow">{eyebrow}</div><h2 className="mt-2 mb-8 max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{title}</h2></Reveal>
      {children}
    </section>
  );
}
