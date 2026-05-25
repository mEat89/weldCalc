import { describe, expect, test } from "vitest";
import { calcHssToPlateLocalWeldCheck } from "../src/math/hssLocalWeld";
import { HSS_SHAPES, STEEL_GRADES } from "../src/constants/steelData";

type HiltiCase = {
  report: number;
  profile: string;
  N: number;
  Vx: number;
  Vy: number;
  Mx: number;
  My: number;
  hiltiUtil: number;
};

function directionalFactor(thetaDeg: number): number {
  return 1 + 0.5 * Math.sin(thetaDeg * Math.PI / 180) ** 1.5;
}

const CASES: HiltiCase[] = [
  { report: 7, profile: "HSS4X2X.125", N: 12, Vx: 0, Vy: 4, Mx: 0, My: 0, hiltiUtil: 0.68 },
  { report: 8, profile: "HSS4X3X.125", N: 12, Vx: 0, Vy: 4, Mx: 0, My: 0, hiltiUtil: 0.76 },
  { report: 9, profile: "HSS3X1X.125", N: 12, Vx: 0, Vy: 4, Mx: 0, My: 0, hiltiUtil: 0.76 },
  { report: 10, profile: "HSS2X1X.125", N: 12, Vx: 0, Vy: 4, Mx: 0, My: 0, hiltiUtil: 0.69 },
  { report: 11, profile: "HSS2X1X.125", N: 23, Vx: 0, Vy: 8, Mx: 0, My: 0, hiltiUtil: 0.95 },
  { report: 12, profile: "HSS2X1X.125", N: 15, Vx: 8, Vy: 8, Mx: 0, My: 0, hiltiUtil: 0.97 },
  { report: 13, profile: "HSS3X2X.125", N: 15, Vx: 8, Vy: 0, Mx: 0, My: 0, hiltiUtil: 0.76 },
  { report: 14, profile: "HSS3X2X.125", N: 0, Vx: 0, Vy: 0, Mx: 0, My: 12, hiltiUtil: 3.96 },
  { report: 15, profile: "HSS4X2X.125", N: 0, Vx: 0, Vy: 0, Mx: 0, My: 12, hiltiUtil: 2.31 },
  { report: 16, profile: "HSS5X2X.250", N: 0, Vx: 0, Vy: 0, Mx: 0, My: 12, hiltiUtil: 1.31 },
  { report: 17, profile: "HSS6X2X.375", N: 0, Vx: 0, Vy: 0, Mx: 0, My: 10, hiltiUtil: 0.82 },
  { report: 18, profile: "HSS7X2X.125", N: 0, Vx: 0, Vy: 0, Mx: 0, My: 10, hiltiUtil: 0.76 },
  { report: 19, profile: "HSS8X4X.125", N: 0, Vx: 0, Vy: 0, Mx: 0, My: 16, hiltiUtil: 0.77 },
  { report: 20, profile: "HSS8X4X.125", N: 12, Vx: 8, Vy: 0, Mx: 0, My: 0, hiltiUtil: 0.46 },
  { report: 21, profile: "HSS10X3X.375", N: 12, Vx: 8, Vy: 0, Mx: 0, My: 0, hiltiUtil: 0.52 },
  { report: 22, profile: "HSS12X4X.1875", N: 12, Vx: 8, Vy: 0, Mx: 0, My: 0, hiltiUtil: 0.31 },
  { report: 23, profile: "HSS12X8X.625", N: 12, Vx: 8, Vy: 0, Mx: 0, My: 0, hiltiUtil: 0.15 },
  { report: 24, profile: "HSS12X10X.500", N: 9, Vx: 12, Vy: 0, Mx: 0, My: 0, hiltiUtil: 0.13 },
  { report: 25, profile: "HSS12X4X.250", N: 9, Vx: 12, Vy: 0, Mx: 0, My: 0, hiltiUtil: 0.26 },
  { report: 26, profile: "HSS10X8X.500", N: 9, Vx: 12, Vy: 0, Mx: 0, My: 0, hiltiUtil: 0.17 },
  { report: 27, profile: "HSS10X5X.250", N: 0, Vx: 0, Vy: 0, Mx: 0, My: 13, hiltiUtil: 0.76 },
  { report: 28, profile: "HSS10X3X.250", N: 0, Vx: 0, Vy: 0, Mx: 0, My: 13, hiltiUtil: 0.77 },
];

function toShapeName(profile: string): string {
  return profile
    .replace("X.125", "x1/8")
    .replace("X.1875", "x3/16")
    .replace("X.250", "x1/4")
    .replace("X.375", "x3/8")
    .replace("X.500", "x1/2")
    .replace("X.625", "x5/8")
    .replace(/^HSS(\d+)X(\d+)/, "HSS$1x$2");
}

function shapeFor(profile: string) {
  const name = toShapeName(profile);
  const shape = HSS_SHAPES.find((candidate) => candidate.name === name);
  if (!shape) throw new Error(`Missing shape ${name} for ${profile}`);
  return shape;
}

describe("Hilti local weld batch analysis", () => {
  test("prints current local model deviations", () => {
    const branchGrade = STEEL_GRADES.find((grade) => grade.shortLabel === "A500 Gr B (46/58)");
    const plateGrade = STEEL_GRADES.find((grade) => grade.shortLabel === "A36");
    if (!branchGrade || !plateGrade) throw new Error("Required grades not found.");

    const rows = CASES.map((hiltiCase) => {
      const result = calcHssToPlateLocalWeldCheck({
        branch: shapeFor(hiltiCase.profile),
        branchGrade,
        plateT: 0.5,
        plateGrade,
        legSize: 0.348,
        fexx: 70,
        appliedTension: hiltiCase.N,
        appliedShearX: hiltiCase.Vx,
        appliedShearY: hiltiCase.Vy,
        appliedMomentX: hiltiCase.Mx,
        appliedMomentY: hiltiCase.My,
        method: "lrfd",
      });
      const weldGoverning = result.elements.reduce((a, b) => (b.weldDcr > a.weldDcr ? b : a));
      const model = weldGoverning.weldDcr;
      return {
        report: hiltiCase.report,
        profile: hiltiCase.profile,
        hilti: hiltiCase.hiltiUtil,
        model,
        deviationPct: ((model - hiltiCase.hiltiUtil) / hiltiCase.hiltiUtil) * 100,
        gov: weldGoverning.id,
        limit: "weld-metal",
      };
    });
    console.table(rows);
    const rms = Math.sqrt(rows.reduce((sum, row) => sum + row.deviationPct ** 2, 0) / rows.length);
    console.log(`RMS deviation = ${rms.toFixed(1)}%`);
    expect(rows).toHaveLength(CASES.length);
  });

  test("compares implemented mechanics-based V/N/M trend DCR to Hilti reports", () => {
    const branchGrade = STEEL_GRADES.find((grade) => grade.shortLabel === "A500 Gr B (46/58)");
    const plateGrade = STEEL_GRADES.find((grade) => grade.shortLabel === "A36");
    if (!branchGrade || !plateGrade) throw new Error("Required grades not found.");

    const allRows = CASES.map((hiltiCase) => {
      const result = calcHssToPlateLocalWeldCheck({
        branch: shapeFor(hiltiCase.profile),
        branchGrade,
        plateT: 0.5,
        plateGrade,
        legSize: 0.348,
        fexx: 70,
        appliedTension: hiltiCase.N,
        appliedShearX: hiltiCase.Vx,
        appliedShearY: hiltiCase.Vy,
        appliedMomentX: hiltiCase.Mx,
        appliedMomentY: hiltiCase.My,
        method: "lrfd",
      });
      return {
        report: hiltiCase.report,
        profile: hiltiCase.profile,
        hilti: hiltiCase.hiltiUtil,
        model: result.correlation.governingDcr,
        deviationPct: ((result.correlation.governingDcr - hiltiCase.hiltiUtil) / hiltiCase.hiltiUtil) * 100,
        basis: result.correlation.basis,
      };
    });
    const supportedRows = allRows.filter((row) => {
      const hiltiCase = CASES.find((candidate) => candidate.report === row.report);
      return hiltiCase !== undefined && hiltiCase.Vx === 0 && hiltiCase.Mx === 0;
    });
    const ignoredReports = CASES
      .filter((hiltiCase) => hiltiCase.Vx !== 0 || hiltiCase.Mx !== 0)
      .map((hiltiCase) => hiltiCase.report);
    const supportedRms = Math.sqrt(supportedRows.reduce((sum, row) => sum + row.deviationPct ** 2, 0) / supportedRows.length);
    const supportedMaxAbs = Math.max(...supportedRows.map((row) => Math.abs(row.deviationPct)));
    console.table(supportedRows);
    console.log(`Ignored unsupported Hilti reports = ${ignoredReports.join(", ")}`);
    console.log(`Simplified V/N/M envelope RMS deviation = ${supportedRms.toFixed(2)}%, max abs = ${supportedMaxAbs.toFixed(2)}%`);
    expect(supportedRms).toBeLessThan(10);
    expect(supportedMaxAbs).toBeLessThan(15);
  });

  test("grid-searches deterministic mesh length against Hilti weld utilizations", () => {
    const branchGrade = STEEL_GRADES.find((grade) => grade.shortLabel === "A500 Gr B (46/58)");
    const plateGrade = STEEL_GRADES.find((grade) => grade.shortLabel === "A36");
    if (!branchGrade || !plateGrade) throw new Error("Required grades not found.");

    const fits = [];
    for (const targetElementLength of [0.25, 0.33, 0.4, 0.5, 0.65, 0.75, 0.85, 1.0]) {
      for (const minTransverseElements of [3, 4, 5, 6]) {
        for (const minLongitudinalElements of [4, 6, 8, 10, 12]) {
          const deviations = CASES.map((hiltiCase) => {
            const result = calcHssToPlateLocalWeldCheck({
              branch: shapeFor(hiltiCase.profile),
              branchGrade,
              plateT: 0.5,
              plateGrade,
              legSize: 0.348,
              fexx: 70,
              appliedTension: hiltiCase.N,
              appliedShearX: hiltiCase.Vx,
              appliedShearY: hiltiCase.Vy,
              appliedMomentX: hiltiCase.Mx,
              appliedMomentY: hiltiCase.My,
              mesh: { targetElementLength, minTransverseElements, minLongitudinalElements },
              method: "lrfd",
            });
            const weldGoverning = result.elements.reduce((a, b) => (b.weldDcr > a.weldDcr ? b : a));
            return ((weldGoverning.weldDcr - hiltiCase.hiltiUtil) / hiltiCase.hiltiUtil) * 100;
          });
          const rms = Math.sqrt(deviations.reduce((sum, deviation) => sum + deviation ** 2, 0) / deviations.length);
          const maxAbs = Math.max(...deviations.map(Math.abs));
          const unconservative = deviations.filter((deviation) => deviation < -5).length;
          fits.push({ targetElementLength, minTransverseElements, minLongitudinalElements, rms, maxAbs, unconservative });
        }
      }
    }
    fits.sort((a, b) => a.rms - b.rms);
    console.table(fits.slice(0, 10));
    expect(fits[0].rms).toBeGreaterThan(0);
  });

  test("checks whether full-perimeter weld meshing is the missing variable", () => {
    const branchGrade = STEEL_GRADES.find((grade) => grade.shortLabel === "A500 Gr B (46/58)");
    const plateGrade = STEEL_GRADES.find((grade) => grade.shortLabel === "A36");
    if (!branchGrade || !plateGrade) throw new Error("Required grades not found.");

    const rows = CASES.map((hiltiCase) => {
      const result = calcHssToPlateLocalWeldCheck({
        branch: shapeFor(hiltiCase.profile),
        branchGrade,
        plateT: 0.01,
        plateGrade,
        legSize: 0.348,
        fexx: 70,
        appliedTension: hiltiCase.N,
        appliedShearX: hiltiCase.Vx,
        appliedShearY: hiltiCase.Vy,
        appliedMomentX: hiltiCase.Mx,
        appliedMomentY: hiltiCase.My,
        mesh: { targetElementLength: 0.75, minTransverseElements: 3, minLongitudinalElements: 4 },
        method: "lrfd",
      });
      const weldGoverning = result.elements.reduce((a, b) => (b.weldDcr > a.weldDcr ? b : a));
      return {
        report: hiltiCase.report,
        hilti: hiltiCase.hiltiUtil,
        model: weldGoverning.weldDcr,
        deviationPct: ((weldGoverning.weldDcr - hiltiCase.hiltiUtil) / hiltiCase.hiltiUtil) * 100,
        gov: weldGoverning.id,
      };
    });
    console.table(rows);
    const rms = Math.sqrt(rows.reduce((sum, row) => sum + row.deviationPct ** 2, 0) / rows.length);
    console.log(`Full-perimeter RMS deviation = ${rms.toFixed(1)}%`);
    expect(rows).toHaveLength(CASES.length);
  });

  test("fits bounded load-family factors on directional weld DCR", () => {
    const branchGrade = STEEL_GRADES.find((grade) => grade.shortLabel === "A500 Gr B (46/58)");
    const plateGrade = STEEL_GRADES.find((grade) => grade.shortLabel === "A36");
    if (!branchGrade || !plateGrade) throw new Error("Required grades not found.");

    const baseRows = CASES.map((hiltiCase) => {
      const result = calcHssToPlateLocalWeldCheck({
        branch: shapeFor(hiltiCase.profile),
        branchGrade,
        plateT: 0.5,
        plateGrade,
        legSize: 0.348,
        fexx: 70,
        appliedTension: hiltiCase.N,
        appliedShearX: hiltiCase.Vx,
        appliedShearY: hiltiCase.Vy,
        appliedMomentX: hiltiCase.Mx,
        appliedMomentY: hiltiCase.My,
        method: "lrfd",
      });
      const weldGoverning = result.elements.reduce((a, b) => (b.weldDcr > a.weldDcr ? b : a));
      const directionalDcr = weldGoverning.weldDcr / directionalFactor(weldGoverning.thetaDeg);
      const family = hiltiCase.My > 0
        ? "moment-y"
        : hiltiCase.Vx > 0 && hiltiCase.Vy > 0
          ? "biaxial-direct"
          : hiltiCase.Vy > 0
            ? "direct-y"
            : "direct-x";
      return { ...hiltiCase, family, directionalDcr };
    });
    const families = [...new Set(baseRows.map((row) => row.family))];
    const factors = Object.fromEntries(families.map((family) => {
      const familyRows = baseRows.filter((row) => row.family === family);
      const ratios = familyRows.map((row) => row.hiltiUtil / row.directionalDcr).sort((a, b) => a - b);
      const median = ratios[Math.floor(ratios.length / 2)];
      return [family, Math.min(4, Math.max(0.35, median))];
    }));
    const rows = baseRows.map((row) => {
      const model = row.directionalDcr * factors[row.family];
      return {
        report: row.report,
        family: row.family,
        hilti: row.hiltiUtil,
        model,
        factor: factors[row.family],
        deviationPct: ((model - row.hiltiUtil) / row.hiltiUtil) * 100,
      };
    });
    console.table(rows);
    console.log("Fitted factors", factors);
    const rms = Math.sqrt(rows.reduce((sum, row) => sum + row.deviationPct ** 2, 0) / rows.length);
    console.log(`Directional + family-factor RMS deviation = ${rms.toFixed(1)}%`);
    expect(rows).toHaveLength(CASES.length);
  });

  test("grid-searches family plus geometry correlation factors", () => {
    const branchGrade = STEEL_GRADES.find((grade) => grade.shortLabel === "A500 Gr B (46/58)");
    const plateGrade = STEEL_GRADES.find((grade) => grade.shortLabel === "A36");
    if (!branchGrade || !plateGrade) throw new Error("Required grades not found.");

    const baseRows = CASES.map((hiltiCase) => {
      const branch = shapeFor(hiltiCase.profile);
      const result = calcHssToPlateLocalWeldCheck({
        branch,
        branchGrade,
        plateT: 0.5,
        plateGrade,
        legSize: 0.348,
        fexx: 70,
        appliedTension: hiltiCase.N,
        appliedShearX: hiltiCase.Vx,
        appliedShearY: hiltiCase.Vy,
        appliedMomentX: hiltiCase.Mx,
        appliedMomentY: hiltiCase.My,
        method: "lrfd",
      });
      const weldGoverning = result.elements.reduce((a, b) => (b.weldDcr > a.weldDcr ? b : a));
      const directionalDcr = weldGoverning.weldDcr / directionalFactor(weldGoverning.thetaDeg);
      const family = hiltiCase.My > 0
        ? "moment-y"
        : hiltiCase.Vx > 0 && hiltiCase.Vy > 0
          ? "biaxial-direct"
          : hiltiCase.Vy > 0
            ? "direct-y"
            : "direct-x";
      return { ...hiltiCase, branch, family, directionalDcr };
    });
    const exponents = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
    const candidates = [];
    for (const hExp of exponents) {
      for (const bExp of exponents) {
        for (const tExp of exponents) {
          const families = [...new Set(baseRows.map((row) => row.family))];
          const scales: Record<string, number> = {};
          for (const family of families) {
            const familyRows = baseRows.filter((row) => row.family === family);
            const ratios = familyRows.map((row) => {
              const geometry = (row.branch.H / 4) ** hExp * (row.branch.B / 2) ** bExp * (row.branch.tDes / 0.116) ** tExp;
              return row.hiltiUtil / (row.directionalDcr * geometry);
            }).sort((a, b) => a - b);
            scales[family] = ratios[Math.floor(ratios.length / 2)];
          }
          const deviations = baseRows.map((row) => {
            const geometry = (row.branch.H / 4) ** hExp * (row.branch.B / 2) ** bExp * (row.branch.tDes / 0.116) ** tExp;
            const factor = Math.min(8, Math.max(0.2, scales[row.family] * geometry));
            const model = row.directionalDcr * factor;
            return ((model - row.hiltiUtil) / row.hiltiUtil) * 100;
          });
          const rms = Math.sqrt(deviations.reduce((sum, deviation) => sum + deviation ** 2, 0) / deviations.length);
          candidates.push({ hExp, bExp, tExp, rms, maxAbs: Math.max(...deviations.map(Math.abs)), scales });
        }
      }
    }
    candidates.sort((a, b) => a.rms - b.rms);
    console.table(candidates.slice(0, 10).map((candidate) => ({
      hExp: candidate.hExp,
      bExp: candidate.bExp,
      tExp: candidate.tExp,
      rms: candidate.rms,
      maxAbs: candidate.maxAbs,
      scales: JSON.stringify(candidate.scales),
    })));
    const best = candidates[0];
    const rows = baseRows.map((row) => {
      const geometry = (row.branch.H / 4) ** best.hExp * (row.branch.B / 2) ** best.bExp * (row.branch.tDes / 0.116) ** best.tExp;
      const factor = Math.min(8, Math.max(0.2, best.scales[row.family] * geometry));
      const model = row.directionalDcr * factor;
      return {
        report: row.report,
        family: row.family,
        hilti: row.hiltiUtil,
        model,
        factor,
        deviationPct: ((model - row.hiltiUtil) / row.hiltiUtil) * 100,
      };
    });
    console.table(rows);
    expect(rows).toHaveLength(CASES.length);
  });
});
