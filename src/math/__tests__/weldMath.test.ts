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
    it("calculates base metal yielding and rupture capacity correctly and governs yielding", () => {
      const result = calcBaseMetal({
        baseT: 0.5,
        fy: 36,
        fu: 58,
        length: 10,
        nLines: 2,
        method: "lrfd",
        appliedLoad: 50,
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

  describe("calcFaceEffectiveLength", () => {
    it("returns cbfemLc in cbfem mode", () => {
      const result = calcFaceEffectiveLength({
        mode: "cbfem",
        faceLength: 8.0,
        isTransverse: true,
        connType: "hss2hss",
        cbfemLc: 5.5,
      });
      expect(result.length).toBe(5.5);
      expect(result.reduced).toBe(true);
    });

    it("throws error in cbfem mode if Lc exceeds face length", () => {
      expect(() => {
        calcFaceEffectiveLength({
          mode: "cbfem",
          faceLength: 8.0,
          isTransverse: true,
          connType: "hss2hss",
          cbfemLc: 9.0,
        });
      }).toThrow("Lc = 9.000 in exceeds nominal face length 8 in");
    });

    it("returns k5 effective width in k5 mode for transverse faces", () => {
      const k5Result = {
        beRaw: 4.5,
        be: 4.5,
        capped: false,
        beta: 0.5,
        Bt: 20,
      };
      const result = calcFaceEffectiveLength({
        mode: "k5",
        faceLength: 8.0,
        isTransverse: true,
        connType: "hss2hss",
        k5: k5Result,
      });
      expect(result.length).toBe(4.5);
      expect(result.reduced).toBe(true);
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
