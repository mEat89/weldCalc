import { describe, expect, test } from "vitest";
import { calcHssToPlateLocalWeldCheck, type HssLocalProfile } from "../src/math/hssLocalWeld";

const A500_GR_B = { fy: 46, fu: 58, shortLabel: "A500 Gr B" };
const A36 = { fy: 36, fu: 58, shortLabel: "A36" };

type Case = {
  report: number;
  profile: string;
  H: number;
  B: number;
  tDes: number;
  tNom: number;
  plateT: number;
  legSize: number;
  N: number;
  Vx: number;
  Vy: number;
  Mx: number;
  My: number;
  hilti: number;
};

const CASES: Case[] = [
  { report: 31, profile: "HSS8X4X.125", H: 8, B: 4, tDes: 0.116, tNom: 0.125, plateT: 0.5, legSize: 0.223, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 4, hilti: 0.54 },
  { report: 33, profile: "HSS10X6X.500", H: 10, B: 6, tDes: 0.465, tNom: 0.5, plateT: 0.5, legSize: 0.223, N: 0, Vx: 43, Vy: 0, Mx: 0, My: 0, hilti: 0.48 },
  { report: 34, profile: "HSS10X6X.500", H: 10, B: 6, tDes: 0.465, tNom: 0.5, plateT: 0.5, legSize: 0.223, N: 11, Vx: 0, Vy: 0, Mx: 0, My: 0, hilti: 0.52 },
  { report: 35, profile: "HSS10X6X.500", H: 10, B: 6, tDes: 0.465, tNom: 0.5, plateT: 0.5, legSize: 0.223, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 4, hilti: 0.49 },
  { report: 36, profile: "HSS10X6X.500", H: 10, B: 6, tDes: 0.465, tNom: 0.5, plateT: 0.375, legSize: 0.223, N: 0, Vx: 43, Vy: 0, Mx: 0, My: 0, hilti: 0.48 },
  { report: 37, profile: "HSS10X6X.500", H: 10, B: 6, tDes: 0.465, tNom: 0.5, plateT: 0.375, legSize: 0.223, N: 11, Vx: 0, Vy: 0, Mx: 0, My: 0, hilti: 0.67 },
  { report: 38, profile: "HSS10X6X.500", H: 10, B: 6, tDes: 0.465, tNom: 0.5, plateT: 0.375, legSize: 0.223, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 4, hilti: 0.63 },
  { report: 39, profile: "HSS10X6X.500", H: 10, B: 6, tDes: 0.465, tNom: 0.5, plateT: 0.25, legSize: 0.223, N: 0, Vx: 43, Vy: 0, Mx: 0, My: 0, hilti: 0.53 },
  { report: 40, profile: "HSS10X6X.500", H: 10, B: 6, tDes: 0.465, tNom: 0.5, plateT: 0.25, legSize: 0.223, N: 11, Vx: 0, Vy: 0, Mx: 0, My: 0, hilti: 0.76 },
  { report: 41, profile: "HSS10X6X.500", H: 10, B: 6, tDes: 0.465, tNom: 0.5, plateT: 0.25, legSize: 0.223, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 4, hilti: 0.76 },
  { report: 42, profile: "HSS12X4X.375", H: 12, B: 4, tDes: 0.349, tNom: 0.375, plateT: 0.25, legSize: 0.223, N: 0, Vx: 43, Vy: 0, Mx: 0, My: 0, hilti: 0.43 },
  { report: 43, profile: "HSS12X4X.375", H: 12, B: 4, tDes: 0.349, tNom: 0.375, plateT: 0.25, legSize: 0.223, N: 11, Vx: 0, Vy: 0, Mx: 0, My: 0, hilti: 0.76 },
  { report: 44, profile: "HSS12X4X.375", H: 12, B: 4, tDes: 0.349, tNom: 0.375, plateT: 0.25, legSize: 0.223, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 4, hilti: 0.76 },
  { report: 45, profile: "HSS12X4X.375", H: 12, B: 4, tDes: 0.349, tNom: 0.375, plateT: 0.375, legSize: 0.223, N: 0, Vx: 43, Vy: 0, Mx: 0, My: 0, hilti: 0.44 },
  { report: 46, profile: "HSS12X4X.375", H: 12, B: 4, tDes: 0.349, tNom: 0.375, plateT: 0.375, legSize: 0.223, N: 11, Vx: 0, Vy: 0, Mx: 0, My: 0, hilti: 0.70 },
  { report: 47, profile: "HSS12X4X.375", H: 12, B: 4, tDes: 0.349, tNom: 0.375, plateT: 0.375, legSize: 0.223, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 4, hilti: 0.61 },
  { report: 48, profile: "HSS12X4X.375", H: 12, B: 4, tDes: 0.349, tNom: 0.375, plateT: 0.25, legSize: 0.223, N: 0, Vx: 43, Vy: 0, Mx: 0, My: 0, hilti: 0.43 },
  { report: 49, profile: "HSS12X4X.375", H: 12, B: 4, tDes: 0.349, tNom: 0.375, plateT: 0.25, legSize: 0.223, N: 11, Vx: 0, Vy: 0, Mx: 0, My: 0, hilti: 0.76 },
  { report: 50, profile: "HSS12X4X.375", H: 12, B: 4, tDes: 0.349, tNom: 0.375, plateT: 0.25, legSize: 0.223, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 4, hilti: 0.76 },
];

function branch(c: Case): HssLocalProfile {
  return { name: c.profile, H: c.H, B: c.B, tDes: c.tDes, tNom: c.tNom };
}

function isSupported(c: Case): boolean {
  return c.Mx === 0;
}

function hiltiShearAlongHss(c: Case): number {
  // In reports 31-50, Hilti's global Vx is the downward shear along the HSS long side.
  return Math.abs(c.Vy) > 0 ? c.Vy : c.Vx;
}

describe("Hilti reports 31-50 mechanics calibration", () => {
  test("prints current supported-case trend deviations", () => {
    const rows = CASES.filter(isSupported).map((c) => {
      const result = calcHssToPlateLocalWeldCheck({
        branch: branch(c),
        branchGrade: A500_GR_B,
        plateT: c.plateT,
        plateGrade: A36,
        legSize: c.legSize,
        fexx: 70,
        appliedTension: c.N,
        appliedShearY: hiltiShearAlongHss(c),
        appliedMomentY: c.My,
        method: "lrfd",
      });
      return {
        report: c.report,
        profile: c.profile,
        plateT: c.plateT,
        load: c.N > 0 ? "N" : c.My > 0 ? "Mu" : hiltiShearAlongHss(c) > 0 ? "V" : "other",
        hilti: c.hilti,
        model: result.correlation.governingDcr,
        deviationPct: ((result.correlation.governingDcr - c.hilti) / c.hilti) * 100,
      };
    });
    const rms = Math.sqrt(rows.reduce((sum, row) => sum + row.deviationPct ** 2, 0) / rows.length);
    const maxAbs = Math.max(...rows.map((row) => Math.abs(row.deviationPct)));
    console.table(rows);
    console.log(`Supported reports 31-50 RMS=${rms.toFixed(2)}% maxAbs=${maxAbs.toFixed(2)}%`);
    expect(rows).toHaveLength(19);
    expect(rms).toBeLessThan(6);
    expect(maxAbs).toBeLessThan(10);
  });
});
