import { describe, expect, it } from "vitest";
import { DEFAULT_SETUP, badgeStates, docsFor, validateFile, validateText, type Submission } from "../lib/verification/requirements";

const approve = (ids: string[]): Record<string, Submission> =>
  Object.fromEntries(ids.map(id => [id, { docId: id, status: "approved" as const, submittedAt: 0 }]));
const ids = (kind: "satellite" | "station", s = DEFAULT_SETUP) => docsFor(kind, s).map(x => x.id);
const minIds = (kind: "satellite" | "station", badge: string, s = DEFAULT_SETUP) => docsFor(kind, s).filter(x => x.badge === badge && x.minimum).map(x => x.id);

describe("applicability", () => {
  it("GST only when registered", () => {
    expect(ids("station")).not.toContain("gst");
    expect(ids("station", { ...DEFAULT_SETUP, gstRegistered: true })).toContain("gst");
  });
  it("station owner needs lease OR site ownership OR permission — never all", () => {
    const pick = (siteControl: "owned" | "leased" | "permission") => ids("station", { ...DEFAULT_SETUP, siteControl }).filter(i => i.startsWith("site_") && i !== "site_clearance");
    expect(pick("owned")).toEqual(["site_own"]);
    expect(pick("leased")).toEqual(["site_lease"]);
    expect(pick("permission")).toEqual(["site_perm"]);
  });
  it("operator appointment agreement only when operator differs from owner", () => {
    expect(ids("satellite")).not.toContain("sat_operator");
    expect(ids("satellite", { ...DEFAULT_SETUP, operatorDiffers: true })).toContain("sat_operator");
  });
  it("individuals get identity docs, not incorporation docs", () => {
    const i = ids("satellite", { ...DEFAULT_SETUP, ownerType: "individual" });
    expect(i).toContain("gov_id"); expect(i).not.toContain("cert_inc");
  });
});

describe("badges", () => {
  it("valid incorporation alone does NOT earn asset or operator badge", () => {
    const b = badgeStates("satellite", DEFAULT_SETUP, approve(minIds("satellite", "organisation")));
    expect(b.find(x => x.badge === "organisation")!.earned).toBe(true);
    expect(b.find(x => x.badge === "asset")!.earned).toBe(false);
    expect(b.find(x => x.badge === "operator")!.earned).toBe(false);
  });
  it("NORAD ID + registration alone do not prove ownership", () => {
    const b = badgeStates("satellite", DEFAULT_SETUP, approve(["norad", "sat_reg"]));
    expect(b.find(x => x.badge === "asset")!.earned).toBe(false);
  });
  it("one missing minimum doc blocks the badge; all approved earns it", () => {
    const all = minIds("station", "asset");
    expect(badgeStates("station", DEFAULT_SETUP, approve(all.slice(1))).find(x => x.badge === "asset")!.earned).toBe(false);
    expect(badgeStates("station", DEFAULT_SETUP, approve(all)).find(x => x.badge === "asset")!.earned).toBe(true);
  });
  it("submitted / rejected docs do not count as approved", () => {
    const all = minIds("station", "organisation");
    const subs = approve(all);
    subs[all[0]] = { docId: all[0], status: "rejected", submittedAt: 0 };
    const o = badgeStates("station", DEFAULT_SETUP, subs).find(x => x.badge === "organisation")!;
    expect(o.earned).toBe(false); expect(o.blocked).toBe(1);
  });
});

describe("validation", () => {
  const doc = (id: string) => docsFor("satellite", DEFAULT_SETUP).find(x => x.id === id)!;
  it("CIN / LLPIN", () => {
    expect(validateText(doc("reg_no"), "U72900KA2020PTC123456")).toBeNull();
    expect(validateText(doc("reg_no"), "AAB-1234")).toBeNull();
    expect(validateText(doc("reg_no"), "12345")).not.toBeNull();
  });
  it("NORAD and international designator", () => {
    expect(validateText(doc("norad"), "25544")).toBeNull();
    expect(validateText(doc("norad"), "ISS")).not.toBeNull();
    expect(validateText(doc("intl_des"), "1998-067A")).toBeNull();
    expect(validateText(doc("intl_des"), "98067A")).not.toBeNull();
  });
  it("files: type and size", () => {
    expect(validateFile({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(validateFile({ type: "application/zip", size: 1000 })).not.toBeNull();
    expect(validateFile({ type: "application/pdf", size: 11 * 1024 * 1024 })).not.toBeNull();
  });
});
