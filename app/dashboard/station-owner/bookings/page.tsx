import { PageTitle } from "@/components/ui";
import { BookingsList } from "@/components/BookingsList";

export default function StationBookings() {
  return (
    <div className="max-w-4xl">
      <PageTitle title="Bookings on my stations" sub="Track the pass, then upload your signed receipt. Payment is released for every verified frame." />
      <details className="panel mb-4 p-4 text-sm">
        <summary className="cursor-pointer font-medium">How to sign a receipt</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>Once: run <code className="mono text-slate-200">node scripts/station-keygen.mjs</code> and register the printed public key under <b>My Stations</b>.</li>
          <li>After the pass, list what you received in <code className="mono">received.json</code> (frame id, SHA-256, time, RSSI, Doppler).</li>
          <li>Run <code className="mono text-slate-200">node scripts/sign-receipt.mjs --booking &lt;id&gt; --station &lt;id&gt; --root &lt;manifest root&gt; --frames received.json --key station-key.pem</code>.</li>
          <li>Click <b>Submit signed receipt</b> and pick <code className="mono">receipt.json</code>. Receipts are accepted up to 24 h after the pass.</li>
        </ol>
      </details>
      <BookingsList empty="Bookings appear here when operators book passes on your active stations." />
    </div>
  );
}
