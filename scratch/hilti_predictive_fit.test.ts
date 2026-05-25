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
  N: number;
  Vx: number;
  Vy: number;
  Mx: number;
  My: number;
  hilti: number;
};

const CASES: Case[] = [
  { report: 7, profile: "HSS4X2X.125", H: 4, B: 2, tDes: 0.116, tNom: 0.125, N: 12, Vx: 0, Vy: 4, Mx: 0, My: 0, hilti: 0.68 },
  { report: 8, profile: "HSS4X3X.125", H: 4, B: 3, tDes: 0.116, tNom: 0.125, N: 12, Vx: 0, Vy: 4, Mx: 0, My: 0, hilti: 0.76 },
  { report: 9, profile: "HSS3X1X.125", H: 3, B: 1, tDes: 0.116, tNom: 0.125, N: 12, Vx: 0, Vy: 4, Mx: 0, My: 0, hilti: 0.76 },
  { report: 10, profile: "HSS2X1X.125", H: 2, B: 1, tDes: 0.116, tNom: 0.125, N: 12, Vx: 0, Vy: 4, Mx: 0, My: 0, hilti: 0.69 },
  { report: 11, profile: "HSS2X1X.125", H: 2, B: 1, tDes: 0.116, tNom: 0.125, N: 23, Vx: 0, Vy: 8, Mx: 0, My: 0, hilti: 0.95 },
  { report: 12, profile: "HSS2X1X.125", H: 2, B: 1, tDes: 0.116, tNom: 0.125, N: 15, Vx: 8, Vy: 8, Mx: 0, My: 0, hilti: 0.97 },
  { report: 13, profile: "HSS3X2X.125", H: 3, B: 2, tDes: 0.116, tNom: 0.125, N: 15, Vx: 8, Vy: 0, Mx: 0, My: 0, hilti: 0.76 },
  { report: 14, profile: "HSS3X2X.125", H: 3, B: 2, tDes: 0.116, tNom: 0.125, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 12, hilti: 3.96 },
  { report: 15, profile: "HSS4X2X.125", H: 4, B: 2, tDes: 0.116, tNom: 0.125, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 12, hilti: 2.31 },
  { report: 16, profile: "HSS5X2X.250", H: 5, B: 2, tDes: 0.233, tNom: 0.25, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 12, hilti: 1.31 },
  { report: 17, profile: "HSS6X2X.375", H: 6, B: 2, tDes: 0.349, tNom: 0.375, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 10, hilti: 0.82 },
  { report: 18, profile: "HSS7X2X.125", H: 7, B: 2, tDes: 0.116, tNom: 0.125, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 10, hilti: 0.76 },
  { report: 19, profile: "HSS8X4X.125", H: 8, B: 4, tDes: 0.116, tNom: 0.125, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 16, hilti: 0.77 },
  { report: 20, profile: "HSS8X4X.125", H: 8, B: 4, tDes: 0.116, tNom: 0.125, N: 12, Vx: 8, Vy: 0, Mx: 0, My: 0, hilti: 0.46 },
  { report: 21, profile: "HSS10X3X.375", H: 10, B: 3, tDes: 0.349, tNom: 0.375, N: 12, Vx: 8, Vy: 0, Mx: 0, My: 0, hilti: 0.52 },
  { report: 22, profile: "HSS12X4X.1875", H: 12, B: 4, tDes: 0.174, tNom: 0.1875, N: 12, Vx: 8, Vy: 0, Mx: 0, My: 0, hilti: 0.31 },
  { report: 23, profile: "HSS12X8X.625", H: 12, B: 8, tDes: 0.581, tNom: 0.625, N: 12, Vx: 8, Vy: 0, Mx: 0, My: 0, hilti: 0.15 },
  { report: 24, profile: "HSS12X10X.500", H: 12, B: 10, tDes: 0.465, tNom: 0.5, N: 9, Vx: 12, Vy: 0, Mx: 0, My: 0, hilti: 0.13 },
  { report: 25, profile: "HSS12X4X.250", H: 12, B: 4, tDes: 0.233, tNom: 0.25, N: 9, Vx: 12, Vy: 0, Mx: 0, My: 0, hilti: 0.26 },
  { report: 26, profile: "HSS10X8X.500", H: 10, B: 8, tDes: 0.465, tNom: 0.5, N: 9, Vx: 12, Vy: 0, Mx: 0, My: 0, hilti: 0.17 },
  { report: 27, profile: "HSS10X5X.250", H: 10, B: 5, tDes: 0.233, tNom: 0.25, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 13, hilti: 0.76 },
  { report: 28, profile: "HSS10X3X.250", H: 10, B: 3, tDes: 0.233, tNom: 0.25, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 13, hilti: 0.77 },
];

function family(c: Case) {
  if (c.My > 0) return "moment-y";
  if (c.Vx > 0 && c.Vy > 0) return "biaxial-direct";
  if (c.Vy > 0) return "direct-y";
  return "direct-x";
}

function branch(c: Case): HssLocalProfile {
  return { name: c.profile, H: c.H, B: c.B, tDes: c.tDes, tNom: c.tNom };
}

function directionalFactor(thetaDeg: number) {
  return 1 + 0.5 * Math.sin(thetaDeg * Math.PI / 180) ** 1.5;
}

function baseline(c: Case) {
  const result = calcHssToPlateLocalWeldCheck({
    branch: branch(c),
    branchGrade: A500_GR_B,
    plateT: 0.5,
    plateGrade: A36,
    legSize: 0.348,
    fexx: 70,
    appliedTension: c.N,
    appliedShearX: c.Vx,
    appliedShearY: c.Vy,
    appliedMomentX: c.Mx,
    appliedMomentY: c.My,
    method: "lrfd",
  });
  const weldGoverning = result.elements.reduce((a, b) => (b.weldDcr > a.weldDcr ? b : a));
  return weldGoverning.weldDcr / directionalFactor(weldGoverning.thetaDeg);
}

type Row = Case & { family: string; directionalDcr: number; targetFactor: number };

function features(row: Row) {
  const v = Math.hypot(row.Vx, row.Vy);
  const m = Math.hypot(row.Mx, row.My);
  const totalDirect = row.N + v;
  return [
    1,
    Math.log(row.H / row.B),
    Math.log(row.B / row.tDes),
    Math.log(row.H / row.tDes),
    row.N / Math.max(totalDirect, 1),
    v / Math.max(totalDirect, 1),
    Math.log(Math.max(m, 1) / Math.max(row.B * row.H, 1)),
  ];
}

function solveLinear(a: number[][], b: number[]) {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const div = m[col][col] || 1e-12;
    for (let c = col; c <= n; c += 1) m[col][c] /= div;
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = m[r][col];
      for (let c = col; c <= n; c += 1) m[r][c] -= factor * m[col][c];
    }
  }
  return m.map((row) => row[n]);
}

function fit(rows: Row[], lambda: number) {
  const p = features(rows[0]).length;
  const xtx = Array.from({ length: p }, () => Array.from({ length: p }, () => 0));
  const xty = Array.from({ length: p }, () => 0);
  for (const row of rows) {
    const x = features(row);
    const y = Math.log(row.targetFactor);
    for (let i = 0; i < p; i += 1) {
      xty[i] += x[i] * y;
      for (let j = 0; j < p; j += 1) xtx[i][j] += x[i] * x[j];
    }
  }
  for (let i = 1; i < p; i += 1) xtx[i][i] += lambda;
  return solveLinear(xtx, xty);
}

function predict(row: Row, coeffs: number[]) {
  const x = features(row);
  return Math.exp(x.reduce((sum, value, i) => sum + value * coeffs[i], 0));
}

describe("predictive Hilti coefficient fitting", () => {
  test("prints log-linear coefficients and leave-one-out errors", () => {
    const rows: Row[] = CASES.map((c) => {
      const directionalDcr = baseline(c);
      return { ...c, family: family(c), directionalDcr, targetFactor: c.hilti / directionalDcr };
    });
    const families = [...new Set(rows.map((row) => row.family))].filter((name) => rows.filter((row) => row.family === name).length > 1);
    for (const fam of families) {
      const familyRows = rows.filter((row) => row.family === fam);
      const coeffs = fit(familyRows, 0.4);
      const inSample = familyRows.map((row) => {
        const factor = predict(row, coeffs);
        const model = row.directionalDcr * factor;
        return {
          report: row.report,
          hilti: row.hilti,
          model,
          factor,
          targetFactor: row.targetFactor,
          deviationPct: ((model - row.hilti) / row.hilti) * 100,
        };
      });
      const loocv = familyRows.map((row) => {
        const train = familyRows.filter((candidate) => candidate.report !== row.report);
        const localCoeffs = fit(train, 0.4);
        const model = row.directionalDcr * predict(row, localCoeffs);
        return { report: row.report, hilti: row.hilti, model, deviationPct: ((model - row.hilti) / row.hilti) * 100 };
      });
      const rms = Math.sqrt(inSample.reduce((sum, row) => sum + row.deviationPct ** 2, 0) / inSample.length);
      const cvRms = Math.sqrt(loocv.reduce((sum, row) => sum + row.deviationPct ** 2, 0) / loocv.length);
      console.log(fam, JSON.stringify(coeffs.map((c) => Number(c.toFixed(6)))));
      console.table(inSample);
      console.table(loocv);
      console.log(`${fam} RMS=${rms.toFixed(1)}% LOOCV_RMS=${cvRms.toFixed(1)}%`);
    }
    expect(rows).toHaveLength(22);
  });
});
