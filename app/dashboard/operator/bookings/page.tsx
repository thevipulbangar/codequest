import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { BookingsList } from "@/components/BookingsList";

export default function OperatorBookings() {
  return (
    <div className="max-w-4xl">
      <PageTitle title="My bookings" sub="Commit your frame manifest before each pass. After the pass, the station’s signed receipt is verified and the escrow settles pro-rata." />
      <details className="panel mb-4 p-4 text-sm">
        <summary className="cursor-pointer font-medium">How to create a manifest</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>Put the frames you expect the satellite to send in a folder (one file per frame).</li>
          <li>Run <code className="mono text-slate-200">node scripts/make-manifest.mjs ./frames manifest.json</code> from the OrbitPass toolkit.</li>
          <li>Click <b>Commit manifest</b> on the booking and pick <code className="mono">manifest.json</code>. Only SHA-256 hashes are uploaded, never your data.</li>
        </ol>
      </details>
      <BookingsList empty={<>Find a pass and book it. <Link href="/dashboard/operator/find-pass" className="text-cyan underline">Find passes</Link></>} />
    </div>
  );
}
