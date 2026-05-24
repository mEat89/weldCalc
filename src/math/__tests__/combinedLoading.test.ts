import { describe, it, expect } from "vitest";
import { calcK4Unity } from "../combinedLoading";

describe("calcK4Unity — AISC 360-22 §K4-9 combined loading unity", () => {
  it("returns 0 unity and hasAnyTerm=false when nothing is supplied", () => {
    const r = calcK4Unity({});
    expect(r.unity).toBe(0);
    expect(r.status).toBe("OK");
    expect(r.hasAnyTerm).toBe(false);
  });

  it("treats null/undefined terms as zero but flags hasAnyTerm when at least one is supplied", () => {
    const r = calcK4Unity({ axialDCR: 0.4 });
    expect(r.unity).toBeCloseTo(0.4, 6);
    expect(r.terms.ipMoment).toBe(0);
    expect(r.hasAnyTerm).toBe(true);
    expect(r.status).toBe("OK");
  });

  it("sums supported axial and in-plane moment terms and passes when ≤ 1.0", () => {
    const r = calcK4Unity({ axialDCR: 0.3, ipMomentDCR: 0.4 });
    expect(r.unity).toBeCloseTo(0.7, 6);
    expect(r.status).toBe("OK");
  });

  it("fails (NG) when the supported-term sum exceeds 1.0", () => {
    const r = calcK4Unity({ axialDCR: 0.6, ipMomentDCR: 0.5 });
    expect(r.unity).toBeCloseTo(1.1, 6);
    expect(r.status).toBe("NG");
  });

  it("throws on a negative DCR term", () => {
    expect(() => calcK4Unity({ axialDCR: -0.1 })).toThrow(/non-negative/);
  });

  it("passes a borderline 1.0 case as OK (allowing floating-point slack)", () => {
    const r = calcK4Unity({ axialDCR: 0.5, ipMomentDCR: 0.5 });
    expect(r.unity).toBeCloseTo(1.0, 9);
    expect(r.status).toBe("OK");
  });
});
