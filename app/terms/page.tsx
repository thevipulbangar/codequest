import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service — OrbitPass" };

// Template wording written from how the platform works — have it reviewed by a lawyer before relying on it.
export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="11 November 2026">
      <p>These terms govern your use of OrbitPass, a marketplace that connects small-satellite operators with independent ground-station owners. By creating an account or using the platform you agree to them. If you do not agree, do not use OrbitPass.</p>

      <h2>1. What OrbitPass is</h2>
      <ul>
        <li>OrbitPass is a marketplace and verification service. Operators book individual satellite passes over stations listed by station owners.</li>
        <li>We do not own or operate any satellite or ground station, and we are not a party to the radio link itself. We provide booking, escrow, delivery verification and settlement.</li>
        <li>Pass times are computed from public orbital data (TLEs) and may differ from the real orbit. Predictions are estimates, not guarantees.</li>
      </ul>

      <h2>2. Accounts</h2>
      <ul>
        <li>You must be at least 18 and able to enter a binding contract, or act for an organisation that can.</li>
        <li>Choose one account type at sign-up: satellite operator or station owner. The type cannot be changed afterwards.</li>
        <li>Give accurate information, keep it up to date, and keep your password secret. You are responsible for everything done through your account. Tell us at once if you suspect misuse.</li>
        <li>One person or organisation should hold one account. We may merge or close duplicates.</li>
      </ul>

      <h2>3. Owner verification and listing</h2>
      <ul>
        <li>Before assets go live, you must complete owner verification by uploading the documents we ask for. We review them manually and may ask for more, or refuse or withdraw approval.</li>
        <li>A satellite or station is visible and bookable only while the asset itself is approved <em>and</em> its owner’s verification is approved. If either is withdrawn, the asset is hidden immediately; existing bookings are not cancelled automatically.</li>
        <li>You confirm that every document and detail you submit is genuine and that you hold, or are authorised to use, every licence, spectrum or frequency authorisation, landing right and permission required to operate or use the assets you list or book. You must comply with the laws that apply to you in the countries involved.</li>
        <li>Verification documents are stored encrypted and used only to verify you. Approval is not an endorsement or a guarantee of an asset’s quality, safety or legality.</li>
      </ul>

      <h2>4. Station owners</h2>
      <ul>
        <li>You set the price per pass and the frequency bands your station supports. You must keep stations accurate (location, altitude, bands) and mark periods when you are unavailable as blocked.</li>
        <li>You must register a signing key. Receipts you submit must be signed with it. Keep the private key secret; anyone holding it can sign receipts in your name.</li>
        <li>You must record the pass honestly and submit a signed receipt of the frames you actually received. Fabricated, altered or duplicated frames or receipts are a serious breach (see section 10).</li>
        <li>You may cancel a booking at any time before the pass starts; the operator is refunded in full and this may affect your reliability score.</li>
      </ul>

      <h2>5. Operators</h2>
      <ul>
        <li>You may book passes only for satellites registered to your account and approved by us.</li>
        <li>Before each pass you must commit a frame manifest (a Merkle-rooted list of the frames you expect to be downlinked). Without a committed manifest, delivery cannot be verified and the pass cannot be settled.</li>
        <li>You are responsible for your satellite’s transmissions, including compliance with its licence, power and frequency limits.</li>
        <li>Bookings must be made at least 10 minutes before the pass. You may cancel up to 1 hour before the pass starts for a full refund; after that, a cancellation is not available.</li>
      </ul>

      <h2>6. Credits, escrow and fees</h2>
      <ul>
        <li>Bookings are paid in OrbitPass credits, a prepaid platform balance. Credits are added to your account by an administrator after you pay us outside the platform. At present, credits have no cash value, earn no interest, are not transferable between users, and can be used only on OrbitPass.</li>
        <li>When you book, the full price is held in escrow. It is released only as described in section 7, or refunded as described in sections 5 and 8.</li>
        <li>OrbitPass keeps a platform fee, currently 8%, taken from the station’s earned share. The fee on a booking is fixed when the booking is made.</li>
        <li>Station owners earn credits when passes settle. Cash withdrawal of earned credits is not yet available; when it is, it will have its own terms, and taxes, bank charges and verification checks may apply.</li>
        <li>Every credit movement is recorded in an append-only ledger visible to you. You are responsible for your own taxes on amounts you pay or earn.</li>
        <li>We may correct clear errors in the ledger, and may place a hold on credits that we reasonably believe came from fraud, chargeback or misuse.</li>
      </ul>

      <h2>7. Proof of Downlink and settlement</h2>
      <ul>
        <li>After the pass, the station submits a signed receipt listing the frames it received. The platform checks the signature, the match with the operator’s committed manifest, hashes, timestamps within the pass window, duplicates and signal plausibility.</li>
        <li>The station is paid pro-rata for the share of promised frames that are verified, minus the platform fee. The undelivered share is refunded to the operator. Amounts are calculated in whole cents by an automatic, deterministic process and recorded in the ledger.</li>
        <li>A receipt with an invalid signature or a manifest that does not match is refused rather than settled; the station may correct and resubmit it before the deadline.</li>
        <li>If no receipt is settled within 24 hours after the pass ends, the booking expires automatically and the operator is refunded in full. This counts against the station’s reliability score.</li>
        <li>Settlement is final within the platform except as provided for disputes in section 8.</li>
      </ul>

      <h2>8. Disputes</h2>
      <ul>
        <li>Either party may open one dispute per booking within 24 hours of settlement, giving reasons and evidence.</li>
        <li>An administrator reviews the evidence and may move credits from the station’s payout back to the operator, up to the amount paid to the station for that pass. Lost disputes count against the station’s reliability score.</li>
        <li>Our decision is final within the platform. Nothing here limits your legal rights outside it.</li>
      </ul>

      <h2>9. Reliability score</h2>
      <p>Station reliability scores are calculated from settled history: average verified delivery, completion rate and dispute record. The formula is shown on the platform. New stations show as “New” until their first settlement. The score is information, not a guarantee.</p>

      <h2>10. Acceptable use</h2>
      <ul>
        <li>No false documents, identity or ownership claims, or impersonation.</li>
        <li>No fabricated, replayed, altered or recycled frames, signatures or receipts, and no attempt to manipulate verification, pricing, ratings, disputes or the ledger.</li>
        <li>No interference with, jamming of, or unauthorised access to any satellite, ground station, network or system, including ours.</li>
        <li>No automated scraping, load testing, or probing for vulnerabilities without our written permission. If you find a security problem, tell us promptly.</li>
        <li>No use of OrbitPass for anything unlawful, including sanctions or export-control violations, or for harmful or military-targeting purposes we reasonably cannot support.</li>
      </ul>
      <p>We may warn, hide assets, hold payouts related to a breach, suspend or close accounts, refund affected users and report unlawful conduct to the authorities.</p>

      <h2>11. Your content and our platform</h2>
      <ul>
        <li>You keep ownership of what you upload. You give us a limited licence to store, process and display it as needed to run the platform and to resolve disputes.</li>
        <li>OrbitPass’s software, branding, design and data compilations belong to us. You may not copy, resell or reverse-engineer them except as the law allows.</li>
        <li>Frame contents are not stored on OrbitPass; only hashes, metadata and signed receipts are used for verification.</li>
      </ul>

      <h2>12. Availability</h2>
      <p>We aim to keep OrbitPass available but do not promise uninterrupted or error-free service. We may change, pause or remove features, and carry out maintenance. Booking and settlement depend on third-party services (for example orbital data and hosting) that may be unavailable.</p>

      <h2>13. Disclaimers and liability</h2>
      <ul>
        <li>OrbitPass is provided “as is”. We do not guarantee that any pass, link, signal or data delivery will succeed, or that any asset, owner or user is reliable or lawful beyond the checks described here.</li>
        <li>To the extent the law allows, we are not liable for indirect or consequential loss, loss of data, mission failure, lost revenue, or loss of a satellite, and our total liability for any claim is limited to the platform fees you paid in the 3 months before the claim.</li>
        <li>Nothing in these terms excludes liability that cannot be excluded by law, such as fraud or death or personal injury caused by negligence.</li>
        <li>You agree to compensate us for losses we suffer from your breach of these terms, your unlawful use of the platform, or claims by others arising from your satellite’s or station’s operation.</li>
      </ul>

      <h2>14. Ending your account</h2>
      <p>You may stop using OrbitPass at any time. You may ask us to close your account once no booking is open and no dispute is pending. We may suspend or close accounts as described in section 10 or if required by law. Closure does not affect settled bookings, the ledger, or sections that by nature continue (including fees, liability, disputes and legal obligations). Remaining credits are handled according to section 6.</p>

      <h2>15. Privacy</h2>
      <p>How we handle personal data is described in the <a href="/privacy" className="underline">Privacy Policy</a>.</p>

      <h2>16. Changes</h2>
      <p>We may update these terms. For material changes we will notify you in the app or by email. Continued use after the effective date means you accept the new terms. If you do not, stop using OrbitPass and close your account.</p>

      <h2>17. General</h2>
      <ul>
        <li>These terms are the whole agreement between you and OrbitPass about the platform. If a part is unenforceable, the rest still applies.</li>
        <li>You may not transfer your account or rights without our consent. We may transfer ours as part of a business sale or reorganisation.</li>
        <li>Not enforcing a right is not a waiver of it.</li>
        <li>Disputes about these terms are decided under the law of the place where OrbitPass is established, and its courts have jurisdiction, subject to any mandatory consumer rights you have where you live.</li>
      </ul>

      <h2>Contact</h2>
      <p>Questions about these terms: contact OrbitPass support.</p>
    </LegalPage>
  );
}
