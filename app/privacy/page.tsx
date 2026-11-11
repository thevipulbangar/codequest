import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy — OrbitPass" };

// Template wording describing how this codebase actually handles data — have it reviewed before relying on it.
export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="11 November 2026">
      <p>This policy explains what OrbitPass collects, why, and how it is protected.</p>
      <h2>What we collect</h2>
      <ul>
        <li><b>Account data:</b> name, email, role, and optional profile details (job title, phone, country, company, website).</li>
        <li><b>Verification documents:</b> the company, identity, ownership and licensing documents you upload, plus registration numbers you enter.</li>
        <li><b>Assets and activity:</b> satellites and stations you register, bookings, manifests (frame hashes only — never your payload data), signed receipts, settlements, disputes and credit transactions.</li>
        <li><b>Technical data:</b> a session cookie to keep you signed in, and IP addresses used briefly for rate limiting.</li>
      </ul>
      <h2>How it is protected</h2>
      <ul>
        <li>Passwords are stored only as salted scrypt hashes.</li>
        <li>Verification documents are encrypted (AES-256-GCM) before storage and can only be opened by OrbitPass reviewers. Every document view is logged.</li>
        <li>We do not collect Aadhaar copies; identity checks for individuals should go through an approved KYC provider.</li>
      </ul>
      <h2>How it is used</h2>
      <ul>
        <li>To run the marketplace: verify owners and assets, predict passes, settle bookings and resolve disputes.</li>
        <li>To send account and booking notifications.</li>
        <li>We do not sell personal data. Station listings show the station name, location, specifications, price and the operator’s company or name.</li>
      </ul>
      <h2>Retention and your rights</h2>
      <p>We keep account and transaction records while your account is active and as long as required for legal, tax and dispute purposes. You can ask to access, correct or delete your data by contacting support; some financial records must be retained.</p>
      <h2>Processors</h2>
      <p>Hosting (Netlify), database and file storage (Supabase), email delivery (Resend), and public orbital data (CelesTrak, SatNOGS — no personal data is sent to them).</p>
    </LegalPage>
  );
}
