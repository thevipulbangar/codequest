import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service — OrbitPass" };

// Template wording — have it reviewed by a lawyer before relying on it.
export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="11 November 2026">
      <p>These terms govern your use of OrbitPass, a marketplace that connects satellite operators with independent ground-station owners. By creating an account you agree to them.</p>
      <h2>1. Accounts and verification</h2>
      <ul>
        <li>You must give accurate information and keep your password secure. You are responsible for activity on your account.</li>
        <li>Operators and station owners must complete owner verification. Satellites and stations can only be listed or booked after OrbitPass approves both the owner and the asset.</li>
        <li>You confirm you hold, or are authorised to use, every licence, spectrum authorisation and right to operate needed for the assets you list or book.</li>
      </ul>
      <h2>2. Credits, escrow and settlement</h2>
      <ul>
        <li>Bookings are paid in OrbitPass credits. The price is held in escrow when you book.</li>
        <li>After a pass, the station’s signed receipt is verified against the operator’s committed frame manifest. The station is paid for the verified share of frames, minus the platform fee; the rest is refunded to the operator.</li>
        <li>Operators may cancel up to 1 hour before a pass for a full refund. If no verified receipt is submitted within 24 hours of the pass, the operator may reclaim the full escrow.</li>
        <li>Verification results and settlements are calculated automatically and deterministically by the platform.</li>
      </ul>
      <h2>3. Disputes</h2>
      <p>Either party may dispute a settlement within 24 hours. OrbitPass reviews the evidence and may move credits between the parties up to the amount paid to the station for that pass. Its decision is final within the platform.</p>
      <h2>4. Acceptable use</h2>
      <ul>
        <li>No false documents, impersonation, interference with satellites or ground systems, or attempts to manipulate receipts or verification.</li>
        <li>We may suspend accounts or assets that breach these terms or applicable law.</li>
      </ul>
      <h2>5. Liability</h2>
      <p>OrbitPass provides a marketplace and verification service. We do not operate satellites or ground stations and do not guarantee any pass, link or data delivery. To the extent permitted by law, our liability is limited to the platform fees you paid in the 3 months before the claim.</p>
      <h2>6. Changes</h2>
      <p>We may update these terms and will notify you of material changes. Continued use after a change means you accept it.</p>
      <h2>Contact</h2>
      <p>Questions: contact OrbitPass support.</p>
    </LegalPage>
  );
}
