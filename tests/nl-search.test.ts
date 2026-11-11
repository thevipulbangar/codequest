import { describe, expect, it } from "vitest";
import { parsePassQuery } from "../lib/nl-search";

const NOW = Date.UTC(2026, 10, 11, 9, 0, 0); // 09:00 UTC

describe("parsePassQuery", () => {
  it("parses the spec example", () => {
    const p = parsePassQuery("Find the next pass over India above 30 degrees for X-band before 18:00 UTC.", NOW);
    expect(p.minEl).toBe(30);
    expect(p.band).toBe("X");
    expect(p.place).toBe("india");
    expect(p.before).toBe(Date.UTC(2026, 10, 11, 18, 0, 0));
    expect(p.hours).toBe(9);
  });
  it("rolls 'before' to tomorrow when the time already passed", () => {
    expect(parsePassQuery("uhf before 06:00", NOW).before).toBe(Date.UTC(2026, 10, 12, 6, 0, 0));
  });
  it("handles hours, price and 12-hour clock", () => {
    const p = parsePassQuery("S band passes in the next 12 hours under 50 credits after 2pm", NOW);
    expect(p.band).toBe("S"); expect(p.hours).toBe(12); expect(p.maxPrice).toBe(50);
    expect(p.after).toBe(Date.UTC(2026, 10, 11, 14, 0, 0));
  });
  it("doesn't read an elevation as a price or a place", () => {
    const p = parsePassQuery("above 45°", NOW);
    expect(p.minEl).toBe(45); expect(p.maxPrice).toBeUndefined(); expect(p.place).toBeUndefined();
  });
  it("returns nothing for unrelated text", () => {
    expect(parsePassQuery("hello", NOW).understood).toEqual([]);
  });
});
