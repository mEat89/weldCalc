import { describe, it, expect } from "vitest";
import {
  toFraction,
  to16ths,
  calcWeldMetal,
  calcBaseMetal,
  calcWeldSize,
  calcK5EffectiveWidth,
  calcK5LOA,
  calcFaceEffectiveLength,
  calcSip,
  calcMomentIpCapacity,
  calcK5GroupCapacity,
} from "../weldMath";

describe("weldMath Unit Tests", () => {
  describe("toFraction", () => {
    it("converts simple decimals to fractions", () => {
      expect(toFraction(0.25)).toBe('1/4"');
      expect(toFraction(0.125)).toBe('1/8"');
      expect(toFraction(0.1875)).toBe('3/16"');
      expect(toFraction(0.5)).toBe('1/2"');
      expect(toFraction(0.0625)).toBe('1/16"');
    });

    it("converts mixed numbers to fractions", () => {
      expect(toFraction(1.25)).toBe('1-1/4"');
      expect(toFraction(2.0625)).toBe('2-1/16"');
      expect(toFraction(3.0)).toBe('3"');
    });

    it("handles zero and invalid numbers", () => {
      expect(toFraction(0)).toBe("0");
      expect(() => toFraction(NaN)).toThrow();
    });
  });

  describe("to16ths", () => {
    it("converts decimals to absolute sixteenths", () => {
      expect(to16ths(0.25)).toBe('4/16"');
      expect(to16ths(0.1875)).toBe('3/16"');
      expect(to16ths(1.0)).toBe('16/16"');
      expect(to16ths(NaN)).toBe("—");
    });
  });

  describe("calcWeldMetal", () => {
    it("calculates fillet weld metal capacity correctly under LRFD with no directional factor", () => {
      const result = calcWeldMetal({
        legSize: 0.25, // 1/4"
        length: 10,
        fexx: 70,
        thetaDeg: 0,
        nLines: 2,
        method: "lrfd",
        useDirectional: false,
        appliedLoad: 20,
      });

      const te = 0.707 * 0.25;
      const Awe = te * 10 * 2;
      const Fnw = 0.6 * 70 * 1.0;
      const Rn = Fnw * Awe;
      const cap = 0.75 * Rn;

      expect(result.te).toBeCloseTo(te, 4);
      expect(result.Awe).toBeCloseTo(Awe, 4);
      expect(result.Fnw).toBe(Fnw);
      expect(result.Rn).toBeCloseTo(Rn, 4);
      expect(result.cap).toBeCloseTo(cap, 4);
      expect(result.dcr).toBeCloseTo(20 / cap, 4);
      expect(result.status).toBe("OK");
    });

    it("applies the directional factor when enabled for theta > 0", () => {
      const result = calcWeldMetal({
        legSize: 0.25,
        length: 10,
        fexx: 70,
        thetaDeg: 90, // transverse load
        nLines: 2,
        method: "lrfd",
        useDirectional: true,
        appliedLoad: 120,
      });

      expect(result.dirFactor).toBe(1.5); // 1.0 + 0.5 * sin^1.5(90) = 1.5
      expect(result.Fnw).toBeCloseTo(0.6 * 70 * 1.5, 4);
    });

    it("applies the beta reduction factor for long welds where L/w > 100", () => {
      // Weld size = 1/4", Length = 30", L/w = 120 > 100
      const result = calcWeldMetal({
        legSize: 0.25,
        length: 30,
        fexx: 70,
        thetaDeg: 0,
        nLines: 1,
        method: "lrfd",
        useDirectional: false,
        appliedLoad: 10,
      });

      const expectedBeta = 1.2 - 0.002 * 120; // 0.96
      expect(result.beta).toBeCloseTo(expectedBeta, 4);

      // Weld size = 1/4", Length = 80", L/w = 320 > 300
      const resultCapped = calcWeldMetal({
        legSize: 0.25,
        length: 80,
        fexx: 70,
        thetaDeg: 0,
        nLines: 1,
        method: "lrfd",
        useDirectional: false,
        appliedLoad: 10,
      });
      expect(resultCapped.beta).toBe(0.60);
    });

    it("throws error on invalid inputs", () => {
      expect(() => {
        calcWeldMetal({
          legSize: -0.25,
          length: 10,
          fexx: 70,
          thetaDeg: 0,
          nLines: 2,
          method: "lrfd",
          useDirectional: false,
          appliedLoad: 20,
        });
      }).toThrow("Leg size w must be positive.");
    });
  });

  describe("calcBaseMetal", () => {
    it("shear: uses §J4.2 Eq. J4-3/J4-4 with 0.6 factor and φ=1.00/0.75", () => {
      const result = calcBaseMetal({
        baseT: 0.5,
        fy: 36,
        fu: 58,
        length: 10,
        nLines: 2,
        method: "lrfd",
        appliedLoad: 50,
        solicitation: "shear",
      });

      const A = 0.5 * 10 * 2;
      const RnYield = 0.6 * 36 * A;
      const RnRupture = 0.6 * 58 * A;
      const capYield = 1.0 * RnYield;
      const capRupture = 0.75 * RnRupture;

      expect(result.A).toBe(A);
      expect(result.RnYield).toBe(RnYield);
      expect(result.RnRupture).toBe(RnRupture);
      expect(result.capYield).toBe(capYield);
      expect(result.capRupture).toBe(capRupture);
      expect(result.cap).toBe(Math.min(capYield, capRupture));
      expect(result.dcr).toBeCloseTo(50 / result.cap, 4);
    });

    it("tension: uses §J4.1 Eq. J4-1/J4-2 with NO 0.6 factor and φ=0.90/0.75", () => {
      const result = calcBaseMetal({
        baseT: 0.116,
        fy: 46,
        fu: 58,
        length: 0.344,
        nLines: 1,
        method: "lrfd",
        appliedLoad: 1.0,
        solicitation: "tension",
      });

      const A = 0.116 * 0.344;
      const RnYield = 46 * A;          // no 0.6 factor
      const RnRupture = 58 * A;        // no 0.6 factor
      const capYield = 0.90 * RnYield; // φ = 0.90 for tensile yielding
      const capRupture = 0.75 * RnRupture;

      expect(result.RnYield).toBeCloseTo(RnYield, 6);
      expect(result.RnRupture).toBeCloseTo(RnRupture, 6);
      expect(result.capYield).toBeCloseTo(capYield, 6);
      expect(result.capRupture).toBeCloseTo(capRupture, 6);
      expect(result.cap).toBeCloseTo(Math.min(capYield, capRupture), 6);
      // Sanity: tension cap is ~1.6× bigger than the same geometry checked as shear.
      const shearResult = calcBaseMetal({
        baseT: 0.116, fy: 46, fu: 58, length: 0.344, nLines: 1,
        method: "lrfd", appliedLoad: 1.0, solicitation: "shear",
      });
      expect(result.cap).toBeGreaterThan(shearResult.cap * 1.5);
    });

    it("defaults to shear when solicitation omitted (back-compat)", () => {
      const a = calcBaseMetal({ baseT: 0.5, fy: 36, fu: 58, length: 10, nLines: 2, method: "lrfd", appliedLoad: 0 });
      const b = calcBaseMetal({ baseT: 0.5, fy: 36, fu: 58, length: 10, nLines: 2, method: "lrfd", appliedLoad: 0, solicitation: "shear" });
      expect(a.cap).toBe(b.cap);
    });
  });

  describe("calcWeldSize", () => {
    it("determines min and max fillet weld sizes correctly for t=0.5", () => {
      const result = calcWeldSize({ legSize: 0.25, baseT: 0.5 });
      // t = 0.5 -> min size = 3/16" (0.1875), max size = t - 1/16" = 7/16" (0.4375)
      expect(result.minSize).toBe(0.1875);
      expect(result.maxSize).toBe(0.4375);
      expect(result.minOk).toBe(true);
      expect(result.maxOk).toBe(true);
      expect(result.status).toBe("OK");
    });

    it("marks NG if leg size exceeds max limit", () => {
      const result = calcWeldSize({ legSize: 0.5, baseT: 0.5 });
      expect(result.maxOk).toBe(false);
      expect(result.status).toBe("NG");
    });
  });

  describe("calcK5EffectiveWidth", () => {
    it("calculates AISC §K5 effective width correctly", () => {
      const result = calcK5EffectiveWidth({
        chordB: 12.0,
        chordT: 0.5,
        chordFy: 50,
        branchB: 8.0,
        branchT: 0.375,
        branchFy: 50,
      });

      const Bt = 12.0 / 0.5; // 24
      const beRaw = (10 / Bt) * ((50 * 0.5) / (50 * 0.375)) * 8.0;
      // beRaw = (10 / 24) * (0.5 / 0.375) * 8.0 = 0.4167 * 1.3333 * 8.0 = 4.444 in
      expect(result.beRaw).toBeCloseTo(beRaw, 4);
      expect(result.be).toBeCloseTo(beRaw, 4);
      expect(result.capped).toBe(false);
    });

    it("caps the effective width to branch B when raw calculation exceeds physical width", () => {
      const result = calcK5EffectiveWidth({
        chordB: 12.0,
        chordT: 1.0, // thick chord
        chordFy: 50,
        branchB: 6.0,
        branchT: 0.125, // thin branch
        branchFy: 50,
      });

      expect(result.capped).toBe(true);
      expect(result.be).toBe(6.0); // branchB
    });
  });

  describe("calcK5LOA", () => {
    it("reports within LOA for valid cross sections", () => {
      const result = calcK5LOA({
        chord: { B: 10, H: 10, tDes: 0.5 },
        branch: { B: 6, H: 6, tDes: 0.375 },
        chordFy: 50,
        branchFy: 50,
      });
      expect(result.withinLOA).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("flags violations if ratios are outside boundaries", () => {
      const result = calcK5LOA({
        chord: { B: 10, H: 10, tDes: 0.1 }, // Bt = 100 > 35
        branch: { B: 2, H: 2, tDes: 0.25 }, // beta = 2/10 = 0.2 < 0.25
        chordFy: 55, // Fy > 52 ksi
        branchFy: 50,
      });
      expect(result.withinLOA).toBe(false);
      expect(result.violations.some(v => v.includes("Chord B/t"))).toBe(true);
      expect(result.violations.some(v => v.includes("β = Bb/B"))).toBe(true);
      expect(result.violations.some(v => v.includes("Chord Fy"))).toBe(true);
    });
  });

  describe("calcSip (Eq. K5-6)", () => {
    it("computes web + flange terms by hand for θ=90°", () => {
      // For θ=90°, sinθ=1 → Sip = tw·[Hb²/3 + Be·Hb].
      const Hb = 8.0;
      const Be = 1.5;
      const tw = 0.246; // throat for 0.348" leg
      const expectedWeb = tw * (Hb * Hb) / 3;     // 0.246·64/3 ≈ 5.248
      const expectedFlange = tw * Be * Hb;        // 0.246·1.5·8 = 2.952
      const r = calcSip({ Hb, Be, tw, thetaDeg: 90 });
      expect(r.webTerm).toBeCloseTo(expectedWeb, 4);
      expect(r.flangeTerm).toBeCloseTo(expectedFlange, 4);
      expect(r.Sip).toBeCloseTo(expectedWeb + expectedFlange, 4);
    });

    it("scales Sip correctly for inclined branches (θ=45°)", () => {
      const r45 = calcSip({ Hb: 6, Be: 2, tw: 0.2, thetaDeg: 45 });
      const r90 = calcSip({ Hb: 6, Be: 2, tw: 0.2, thetaDeg: 90 });
      // Both web and flange terms grow as θ decreases (sinθ → 0).
      expect(r45.webTerm).toBeGreaterThan(r90.webTerm);
      expect(r45.flangeTerm).toBeGreaterThan(r90.flangeTerm);
    });

    it("throws on bad inputs", () => {
      expect(() => calcSip({ Hb: 0, Be: 1, tw: 0.2, thetaDeg: 90 })).toThrow();
      expect(() => calcSip({ Hb: 1, Be: 1, tw: 0.2, thetaDeg: 0 })).toThrow();
    });
  });

  describe("calcMomentIpCapacity (Eq. K5-2)", () => {
    it("Mn = 0.6·FEXX·Sip, φMn = 0.75·Mn under LRFD", () => {
      const Sip = 8.2;
      const r = calcMomentIpCapacity({ Sip, fexx: 70, method: "lrfd" });
      expect(r.Fnw).toBeCloseTo(0.6 * 70, 6); // 42 ksi
      expect(r.Mn).toBeCloseTo(0.6 * 70 * Sip, 4);
      expect(r.cap).toBeCloseTo(0.75 * 0.6 * 70 * Sip, 4);
    });
  });

  describe("calcK5GroupCapacity (Eq. K5-1 + K5-5/K5-6)", () => {
    it("le = 2·Hb/sinθ + 2·Be at θ=90°", () => {
      const r = calcK5GroupCapacity({
        Hb: 8, Bb: 2, Be: 1.2, tw: 0.246, fexx: 70, thetaDeg: 90, method: "lrfd",
      });
      expect(r.le).toBeCloseTo(2 * 8 + 2 * 1.2, 6); // 18.4 in
      expect(r.Pn_axial).toBeCloseTo(0.6 * 70 * 0.246 * r.le, 4);
      expect(r.cap_axial).toBeCloseTo(0.75 * r.Pn_axial, 4);
      expect(r.Mn_ip).toBeCloseTo(0.6 * 70 * r.Sip, 4);
      expect(r.cap_ip).toBeCloseTo(0.75 * r.Mn_ip, 4);
    });

    it("matches calcSip terms for the same inputs", () => {
      const sip = calcSip({ Hb: 6, Be: 2, tw: 0.2, thetaDeg: 90 });
      const grp = calcK5GroupCapacity({
        Hb: 6, Bb: 4, Be: 2, tw: 0.2, fexx: 70, thetaDeg: 90, method: "lrfd",
      });
      expect(grp.Sip).toBeCloseTo(sip.Sip, 6);
      expect(grp.terms.webTerm).toBeCloseTo(sip.webTerm, 6);
      expect(grp.terms.flangeTerm).toBeCloseTo(sip.flangeTerm, 6);
    });
  });

  describe("calcFaceEffectiveLength", () => {
    const k5Result = {
      beRaw: 4.5,
      be: 4.5,
      capped: false,
      beta: 0.5,
      Bt: 20,
    };

    it("returns k5 effective width in k5 mode for transverse faces", () => {
      const result = calcFaceEffectiveLength({
        mode: "k5",
        faceLength: 8.0,
        isTransverse: true,
        connType: "hss2hss",
        k5: k5Result,
      });
      expect(result.length).toBe(4.5);
      expect(result.reduced).toBe(true);
      expect(result.ref).toMatch(/Eq\. K1-1/);
    });

    it("returns full nominal length for k5 mode on a longitudinal face (parallel = fully effective)", () => {
      const result = calcFaceEffectiveLength({
        mode: "k5",
        faceLength: 8.0,
        isTransverse: false,
        connType: "hss2hss",
        k5: k5Result,
      });
      expect(result.length).toBe(8.0);
      expect(result.reduced).toBe(false);
      expect(result.ref).toMatch(/longitudinal/i);
    });

    it("force-K5-on-longitudinal override applies Be with a conservative-judgment label", () => {
      const result = calcFaceEffectiveLength({
        mode: "k5",
        faceLength: 8.0,
        isTransverse: false,
        connType: "hss2hss",
        k5: k5Result,
        forceK5OnLongitudinal: true,
      });
      expect(result.length).toBe(4.5);
      expect(result.reduced).toBe(true);
      expect(result.ref).toMatch(/Conservative engineering judgment/);
      expect(result.ref).toMatch(/longitudinal/);
    });

    it("HSS-to-plate K5 transverse path is labeled conservative engineering judgment", () => {
      const result = calcFaceEffectiveLength({
        mode: "k5",
        faceLength: 8.0,
        isTransverse: true,
        connType: "hss2plate",
        k5: k5Result,
      });
      expect(result.length).toBe(4.5);
      expect(result.ref).toMatch(/Conservative engineering judgment/);
    });

    it("returns full nominal length in aisc mode representing a rigid base", () => {
      const result = calcFaceEffectiveLength({
        mode: "aisc",
        faceLength: 8.0,
        isTransverse: true,
        connType: "hss2hss",
      });
      expect(result.length).toBe(8.0);
      expect(result.reduced).toBe(false);
    });
  });
});
