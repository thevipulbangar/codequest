/**
 * Owner-verification rules. Pure + deterministic (no I/O) so they are unit-tested.
 * Three badges, each earned ONLY when every applicable *minimum* document for it is admin-approved:
 *   organisation -> who you are and that your representative may act   (individuals: "Verified Identity")
 *   asset        -> you own, or are legally authorised to control, the satellite / station
 *   operator     -> required operating / spectrum authorisations are in place
 * A valid incorporation certificate alone never yields the asset or operator badge.
 */
export type Badge = "organisation" | "asset" | "operator";
export type OwnerType = "company" | "individual";
export type AssetKind = "satellite" | "station";
export type Priority = "Required" | "High" | "Conditional" | "Supporting";
export type DocStatus = "submitted" | "approved" | "rejected" | "more_info";
export type SiteControl = "owned" | "leased" | "permission";

export interface Setup {
  ownerType: OwnerType;
  gstRegistered: boolean;      // company: GST certificate applies
  operatorDiffers: boolean;    // satellite: operator is not the owner
  assetAcquired: boolean;      // asset was bought / transferred -> acquisition & transfer agreements
  siteControl: SiteControl;    // station: owns land, leases it, or has permission only
  representative: boolean;     // individual registering on behalf of someone else
}
export const DEFAULT_SETUP: Setup = { ownerType: "company", gstRegistered: false, operatorDiffers: false, assetAcquired: false, siteControl: "leased", representative: false };

export interface DocDef {
  id: string; name: string; priority: Priority; purpose: string; badge: Badge;
  minimum: boolean;                     // gates the badge
  kind?: "file" | "text" | "kyc";       // default file
  pattern?: RegExp; patternHint?: string; // text validation
  whereApplicable?: boolean;            // user may declare "not applicable" (admin reviews the reason)
  when?: (s: Setup) => boolean;         // otherwise always applicable
  note?: string;
}

const d = (x: DocDef): DocDef => x;

// ---- A. Organisation / identity ---------------------------------------------------------------
const COMPANY_DOCS: DocDef[] = [
  d({ id: "cert_inc", name: "Certificate of Incorporation", priority: "Required", purpose: "Verify legal company existence", badge: "organisation", minimum: true }),
  d({ id: "reg_no", name: "CIN / LLPIN (company registration number)", priority: "Required", purpose: "Independently identify the company (checked against MCA)", badge: "organisation", minimum: true, kind: "text",
     pattern: /^([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}|[A-Z]{3}-\d{4})$/, patternHint: "CIN (21 chars, e.g. U72900KA2020PTC123456) or LLPIN (e.g. AAB-1234)" }),
  d({ id: "pan", name: "Company PAN / Tax ID", priority: "High", purpose: "Additional identity verification", badge: "organisation", minimum: true, kind: "text",
     pattern: /^([A-Z]{5}\d{4}[A-Z]|[A-Za-z0-9-]{5,20})$/, patternHint: "PAN like ABCDE1234F, or your national tax ID" }),
  d({ id: "gst", name: "GST Certificate", priority: "Conditional", purpose: "Verify tax registration", badge: "organisation", minimum: true, when: s => s.gstRegistered }),
  d({ id: "reg_office", name: "Registered Office Proof", priority: "High", purpose: "Verify registered address", badge: "organisation", minimum: false }),
  d({ id: "directors", name: "Director / Officer Details", priority: "Required", purpose: "Identify responsible persons", badge: "organisation", minimum: false }),
  d({ id: "beneficial", name: "Beneficial Ownership Declaration", priority: "High", purpose: "Identify controlling owners", badge: "organisation", minimum: false }),
  d({ id: "signatory", name: "Authorised Signatory Proof", priority: "Required", purpose: "Verify the representative", badge: "organisation", minimum: true }),
  d({ id: "board_res", name: "Board Resolution / Authorisation Letter", priority: "Required", purpose: "Verify authority to use the platform", badge: "organisation", minimum: true }),
];
const COMPANY_KYC_STATION = d({ id: "company_kyc", name: "Company KYC", priority: "Required", purpose: "Corporate KYC pack", badge: "organisation", minimum: false });

const INDIVIDUAL_DOCS: DocDef[] = [
  d({ id: "gov_id", name: "Passport / government-issued ID", priority: "Required", purpose: "Verify identity", badge: "organisation", minimum: true,
      note: "Do NOT upload Aadhaar copies. For India, identity should be checked through an approved KYC provider." }),
  d({ id: "addr_proof", name: "Address proof", priority: "Required", purpose: "Verify residence or correspondence address", badge: "organisation", minimum: true }),
  d({ id: "liveness", name: "Selfie / liveness verification", priority: "Required", purpose: "Confirm the person is present", badge: "organisation", minimum: true, kind: "kyc" }),
  d({ id: "rep_letter", name: "Authorised representative letter", priority: "Conditional", purpose: "If registering on behalf of another person", badge: "organisation", minimum: true, when: s => s.representative }),
];

// ---- B. Satellite ownership + operating authorisation -------------------------------------------
const SAT_ASSET: DocDef[] = [
  d({ id: "sat_decl", name: "Satellite Ownership Declaration", priority: "Required", purpose: "Owner claims ownership", badge: "asset", minimum: true }),
  d({ id: "norad", name: "NORAD Catalogue ID", priority: "Required", purpose: "Identify the tracked object (NORAD ID alone does not prove ownership)", badge: "asset", minimum: true, kind: "text", pattern: /^\d{1,9}$/, patternHint: "Numeric NORAD ID, e.g. 25544" }),
  d({ id: "sat_reg", name: "Satellite Registration / Identification Record", priority: "High", purpose: "Verify registered space object", badge: "asset", minimum: true }),
  d({ id: "intl_des", name: "International Designator", priority: "High", purpose: "Match object identity", badge: "asset", minimum: false, kind: "text", pattern: /^\d{4}-\d{3}[A-Z]{1,3}$/, patternHint: "e.g. 1998-067A" }),
  d({ id: "sat_acq", name: "Satellite Acquisition Agreement", priority: "Conditional", purpose: "Prove transfer or purchase", badge: "asset", minimum: true, when: s => s.assetAcquired }),
  d({ id: "sat_transfer", name: "Satellite Ownership Transfer Agreement", priority: "Conditional", purpose: "Verify ownership changes", badge: "asset", minimum: false, when: s => s.assetAcquired }),
  d({ id: "sat_operator", name: "Satellite Operator Appointment Agreement", priority: "Conditional", purpose: "Verify operator authority", badge: "asset", minimum: true, when: s => s.operatorDiffers }),
  d({ id: "sat_register", name: "Satellite Asset Register", priority: "Supporting", purpose: "Confirm internal asset record", badge: "asset", minimum: false }),
  d({ id: "launch", name: "Launch / Deployment Confirmation", priority: "Supporting", purpose: "Confirm satellite deployment", badge: "asset", minimum: false }),
];
const SAT_OPERATOR: DocDef[] = [
  d({ id: "sat_op_auth", name: "Relevant operating authorisation", priority: "Required", purpose: "Permission to operate the satellite (e.g. IN-SPACe)", badge: "operator", minimum: true, whereApplicable: true }),
  d({ id: "sat_spectrum", name: "Spectrum / frequency authorisation", priority: "Required", purpose: "WPC / DoT spectrum authorisation, frequency assignment", badge: "operator", minimum: true, whereApplicable: true }),
];

// ---- C. Ground-station ownership + operating authorisation ---------------------------------------
const GS_ASSET: DocDef[] = [
  d({ id: "gs_decl", name: "Ground Station Ownership Declaration", priority: "Required", purpose: "Owner declares ownership / control", badge: "asset", minimum: true }),
  d({ id: "equip_register", name: "Equipment Asset Register", priority: "High", purpose: "Identify equipment (antennas, SDRs, rotators)", badge: "asset", minimum: true }),
  d({ id: "equip_invoice", name: "Equipment Purchase Invoice / ownership evidence", priority: "High", purpose: "Prove equipment acquisition", badge: "asset", minimum: true }),
  d({ id: "equip_cert", name: "Equipment Ownership Certificate", priority: "Supporting", purpose: "Additional evidence", badge: "asset", minimum: false }),
  d({ id: "site_own", name: "Site Ownership Proof", priority: "Conditional", purpose: "Verify land ownership", badge: "asset", minimum: true, when: s => s.siteControl === "owned" }),
  d({ id: "site_lease", name: "Land Lease Agreement", priority: "Conditional", purpose: "Verify leased site", badge: "asset", minimum: true, when: s => s.siteControl === "leased" }),
  d({ id: "site_perm", name: "Site Permission Letter", priority: "Conditional", purpose: "Verify right to use the location", badge: "asset", minimum: true, when: s => s.siteControl === "permission" }),
  d({ id: "gs_acq", name: "Ground Station Acquisition Agreement", priority: "Conditional", purpose: "Verify transfer / purchase", badge: "asset", minimum: true, when: s => s.assetAcquired }),
  d({ id: "gs_transfer", name: "Ground Station Transfer Agreement", priority: "Conditional", purpose: "Verify ownership changes", badge: "asset", minimum: false, when: s => s.assetAcquired }),
  d({ id: "facility_ctrl", name: "Facility Ownership / Control Agreement", priority: "Conditional", purpose: "Verify operational control", badge: "asset", minimum: false, when: s => s.siteControl !== "owned" }),
];
const GS_OPERATOR: DocDef[] = [
  d({ id: "gs_op_auth", name: "Ground Station Operating Authorisation", priority: "Required", purpose: "Applicable station / service category authorisation", badge: "operator", minimum: true, whereApplicable: true }),
  d({ id: "gs_spectrum", name: "WPC / DoT spectrum & frequency authorisation", priority: "Required", purpose: "Spectrum authorisation / frequency assignment", badge: "operator", minimum: true, whereApplicable: true }),
  d({ id: "inspace", name: "IN-SPACe authorisation", priority: "Conditional", purpose: "Applicable station / service categories", badge: "operator", minimum: false, whereApplicable: true }),
  d({ id: "sacfa", name: "SACFA clearance", priority: "Conditional", purpose: "Site frequency clearance", badge: "operator", minimum: false, whereApplicable: true }),
  d({ id: "earth_filing", name: "Earth station filing / coordination", priority: "Conditional", purpose: "Coordination records", badge: "operator", minimum: false, whereApplicable: true }),
  d({ id: "sat_op_agreement", name: "Satellite Operator Agreement", priority: "Conditional", purpose: "Agreement with the satellite operator", badge: "operator", minimum: false, whereApplicable: true }),
  d({ id: "site_clearance", name: "Site clearance", priority: "Conditional", purpose: "Local / site clearance", badge: "operator", minimum: false, whereApplicable: true }),
  d({ id: "import_auth", name: "Equipment import authorisation", priority: "Conditional", purpose: "For imported radio equipment", badge: "operator", minimum: false, whereApplicable: true }),
  d({ id: "equip_type_cert", name: "Equipment certification", priority: "Conditional", purpose: "Type approval / certification", badge: "operator", minimum: false, whereApplicable: true }),
];

/** Applicable documents for an owner. */
export function docsFor(kind: AssetKind, setup: Setup): DocDef[] {
  const org = setup.ownerType === "company" ? [...COMPANY_DOCS, ...(kind === "station" ? [COMPANY_KYC_STATION] : [])] : INDIVIDUAL_DOCS;
  const rest = kind === "satellite" ? [...SAT_ASSET, ...SAT_OPERATOR] : [...GS_ASSET, ...GS_OPERATOR];
  return [...org, ...rest].filter(x => !x.when || x.when(setup));
}

export interface Submission {
  docId: string; status: DocStatus; submittedAt: number;
  fileName?: string; size?: number; sha256?: string;   // file docs: metadata + hash only (content is not stored)
  text?: string;                                       // text docs
  notApplicable?: string;                              // reason, for whereApplicable docs
  note?: string;                                       // reviewer note
}

export const BADGE_LABEL = (b: Badge, s: Setup) =>
  b === "organisation" ? (s.ownerType === "company" ? "Verified Organisation" : "Verified Identity") : b === "asset" ? "Verified Asset Owner" : "Verified Operator";
export const BADGE_DESC: Record<Badge, string> = {
  organisation: "Identity and authorised representative verified.",
  asset: "Ownership, or legally documented control, of the satellite / station verified.",
  operator: "Required operating and spectrum authorisations checked.",
};

export interface BadgeState { badge: Badge; earned: boolean; approved: number; total: number; pending: number; blocked: number }

/** A badge needs ALL applicable minimum docs approved. */
export function badgeStates(kind: AssetKind, setup: Setup, subs: Record<string, Submission | undefined>): BadgeState[] {
  const docs = docsFor(kind, setup);
  return (["organisation", "asset", "operator"] as Badge[]).map(badge => {
    const min = docs.filter(x => x.badge === badge && x.minimum);
    const st = (x: DocDef) => subs[x.id]?.status;
    const approved = min.filter(x => st(x) === "approved").length;
    return {
      badge, total: min.length, approved, earned: min.length > 0 && approved === min.length,
      pending: min.filter(x => st(x) === "submitted").length,
      blocked: min.filter(x => st(x) === "rejected" || st(x) === "more_info").length,
    };
  });
}

export const validateText = (doc: DocDef, v: string): string | null => {
  const t = v.trim().toUpperCase();
  if (!t) return "Enter a value";
  if (doc.pattern && !doc.pattern.test(t)) return `Invalid format — ${doc.patternHint}`;
  return null;
};

export const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
export const MAX_BYTES = 10 * 1024 * 1024;
export const validateFile = (f: { type: string; size: number }): string | null =>
  !ALLOWED_TYPES.includes(f.type) ? "Only PDF, PNG or JPG files" : f.size > MAX_BYTES ? "File is larger than 10 MB" : f.size === 0 ? "File is empty" : null;
