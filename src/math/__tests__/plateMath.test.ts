import { describe, it, expect } from "vitest";
import {
  calcAnchorTensionAuto,
  calcMethodB,
  calcDG1,
  calcRigidityVerdict,
  MethodBResult,
  DG1Result,
} from "../plateMath";

describe("plateMath Unit Tests", () => {
  describe("calcAnchorTensionAuto", () => {
    it("calculates anchor tension correctly under rigid-plate assumptions", () => {
      const result = calcAnchorTensionAuto({
        Mu: 1200, // kip-in
        Pu: 10,   // kip
        anchorOffsetY: 10,
        Nplate: 30,
        bearingInsetFrac: 0.05,
      });

      const bearingInset = 30 * 0.05; // 1.5 in
      const dLever = 10 + (15 - 1.5); // 23.5 in
      const expectedTuRaw = 1200 / 23.5 - 10; // 51.0638 - 10 = 41.0638 kips

      expect(result.bearingInset).toBe(bearingInset);
      expect(result.dLever).toBe(dLever);
      expect(result.TuRaw).toBeCloseTo(expectedTuRaw, 4);
      expect(result.Tu).toBeCloseTo(expectedTuRaw, 4);
      expect(result.noTension).toBe(false);
    });

    it("caps anchor tension to zero if tension demand is negative (pure compression zone)", () => {
      const result = calcAnchorTensionAuto({
        Mu: 100,
        Pu: 50,
        anchorOffsetY: 10,
        Nplate: 30,
      });

      expect(result.TuRaw).toBeLessThan(0);
      expect(result.Tu).toBe(0);
      expect(result.noTension).toBe(true);
    });

    it("throws an error if anchorOffset is invalid", () => {
      expect(() => {
        calcAnchorTensionAuto({
          Mu: 100,
          Pu: 5,
          anchorOffsetY: 20, // 20 >= 30/2
          Nplate: 30,
        });
      }).toThrow("Anchor offset (20 in) must be less than half the plate length (15 in).");
    });
  });

  describe("calcMethodB", () => {
    it("calculates elastic bending of plate cantilever (Method B) correctly", () => {
      const result = calcMethodB({
        Tu: 40,
        x: 3.0,
        beff: 12.0,
        Fyp: 36.0,
        tp: 1.25,
      });

      const expectedSigma = (6 * 40 * 3.0) / (12.0 * 1.25 * 1.25); // 720 / 18.75 = 38.4 ksi
      const expectedTReq = Math.sqrt((6 * 40 * 3.0) / (12.0 * 36.0)); // sqrt(720 / 432) = 1.291 in
      const expectedDCR = expectedSigma / 36.0; // 1.0667

      expect(result.sigmaMax).toBeCloseTo(expectedSigma, 4);
      expect(result.tReq).toBeCloseTo(expectedTReq, 4);
      expect(result.DCR).toBeCloseTo(expectedDCR, 4);
      expect(result.pass).toBe(false);
      expect(result.trivial).toBe(false);
    });

    it("handles zero anchor tension (trivial case) correctly", () => {
      const result = calcMethodB({
        Tu: 0,
        x: 3.0,
        beff: 12.0,
        Fyp: 36.0,
        tp: 1.25,
      });

      expect(result.sigmaMax).toBe(0);
      expect(result.tReq).toBe(0);
      expect(result.DCR).toBe(0);
      expect(result.pass).toBe(true);
      expect(result.trivial).toBe(true);
    });
  });

  describe("calcDG1", () => {
    it("calculates plastic cantilever thickness check (DG1 §3.4) correctly", () => {
      const result = calcDG1({
        Tu: 40,
        x: 3.0,
        beff: 12.0,
        Fyp: 36.0,
        tp: 1.25,
        phi: 0.9,
      });

      const expectedTReq = Math.sqrt((4 * 40 * 3.0) / (0.9 * 36.0 * 12.0)); // sqrt(480 / 388.8) = 1.1111 in
      const expectedDCR = expectedTReq / 1.25; // 0.8889

      expect(result.tReq).toBeCloseTo(expectedTReq, 4);
      expect(result.DCR).toBeCloseTo(expectedDCR, 4);
      expect(result.pass).toBe(true);
      expect(result.trivial).toBe(false);
    });
  });

  describe("calcRigidityVerdict", () => {
    it("determines verdict is RIGID when both checks pass", () => {
      const mB: MethodBResult = { sigmaMax: 20, tReq: 0.8, DCR: 0.5, pass: true, trivial: false };
      const dg1: DG1Result = { tReq: 0.7, DCR: 0.4, pass: true, trivial: false };

      const result = calcRigidityVerdict(mB, dg1);
      expect(result.verdict).toBe("RIGID");
      expect(result.color).toBe("ok");
    });

    it("determines verdict is NOT RIGID when Method B fails but DG1 passes", () => {
      const mB: MethodBResult = { sigmaMax: 40, tReq: 1.3, DCR: 1.1, pass: false, trivial: false };
      const dg1: DG1Result = { tReq: 1.1, DCR: 0.9, pass: true, trivial: false };

      const result = calcRigidityVerdict(mB, dg1);
      expect(result.verdict).toBe("NOT RIGID");
      expect(result.color).toBe("fail");
      expect(result.note).toContain("elastic plate bending");
    });

    it("determines verdict is NOT RIGID when both checks fail", () => {
      const mB: MethodBResult = { sigmaMax: 50, tReq: 1.5, DCR: 1.3, pass: false, trivial: false };
      const dg1: DG1Result = { tReq: 1.4, DCR: 1.2, pass: false, trivial: false };

      const result = calcRigidityVerdict(mB, dg1);
      expect(result.verdict).toBe("NOT RIGID");
      expect(result.color).toBe("fail");
      expect(result.note).toContain("Both checks fail");
    });
  });
});
