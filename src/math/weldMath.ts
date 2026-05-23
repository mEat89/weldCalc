/**
 * AISC 360 Weld Capacity Equations - Pure Mathematical Engine in TypeScript
 */

export interface WeldMetalInput {
  legSize: number;
  length: number;
  fexx: number;
  thetaDeg: number;
  nLines: number;
  method: "lrfd" | "asd";
  useDirectional: boolean;
  appliedLoad: number;
}

export interface WeldMetalResult {
  te: number;
  Awe: number;
  Fnw: number;
  Rn: number;
  cap: number;
  dcr: number | null;
  status: "OK" | "NG" | null;
  dirFactor: number;
  beta: number;
}

export interface BaseMetalInput {
  baseT: number;
  fy: number;
  fu: number;
  length: number;
  nLines: number;
  method: "lrfd" | "asd";
  appliedLoad: number;
}

export interface BaseMetalResult {
  A: number;
  RnYield: number;
  RnRupture: number;
  capYield: number;
  capRupture: number;
  cap: number;
  governs: "yielding" | "rupture";
  dcr: number | null;
  status: "OK" | "NG" | null;
}

export interface WeldSizeInput {
  legSize: number;
  baseT: number;
}

export interface WeldSizeResult {
  minSize: number;
  minLabel: string;
  maxSize: number;
  maxLabel: string;
  minOk: boolean;
  maxOk: boolean;
  status: "OK" | "NG";
}

export interface K5EffectiveWidthInput {
  chordB: number;
  chordT: number;
  chordFy: number;
  branchB: number;
  branchT: number;
  branchFy: number;
}

export interface K5EffectiveWidthResult {
  beRaw: number;
  be: number;
  capped: boolean;
  beta: number;
  Bt: number;
}

export interface HssProfile {
  B: number;
  H: number;
  tDes: number;
}

export interface K5LOAInput {
  chord: HssProfile;
  branch: HssProfile;
  chordFy: number;
  branchFy: number;
}

export interface K5LOAResult {
  withinLOA: boolean;
  violations: string[];
  beta: number;
  gamma: number;
}

export interface FaceEffectiveLengthInput {
  mode: "standard" | "aisc" | "k5" | "cbfem";
  faceLength: number;
  isTransverse: boolean;
  connType: "hss2hss" | "hss2plate";
  k5?: K5EffectiveWidthResult | null;
  cbfemLc?: number;
}

export interface FaceEffectiveLengthResult {
  length: number;
  nominal: number;
  reduced: boolean;
  ref: string;
}

/**
 * Converts a decimal value to a standard US fraction string (e.g. 1/4", 1-1/16") rounded to nearest 1/16th.
 */
export function toFraction(decimal: number): string {
  if (!Number.isFinite(decimal)) {
    throw new Error("Cannot convert NaN or non-finite numbers to fraction.");
  }
  if (decimal === 0) return "0";
  try {
    const sixteenths = Math.round(decimal * 16);
    if (sixteenths === 0) return `${decimal.toFixed(4)}"`;
    let num = sixteenths;
    let denom = 16;
    while (num % 2 === 0 && denom % 2 === 0) {
      num /= 2;
      denom /= 2;
    }
    const whole = Math.floor(num / denom);
    const remainder = num % denom;
    if (whole === 0) return `${num}/${denom}"`;
    if (remainder === 0) return `${whole}"`;
    return `${whole}-${remainder}/${denom}"`;
  } catch (error) {
    throw new Error(`Failed to convert decimal to fraction: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Converts a decimal value to absolute sixteenths of an inch.
 */
export function to16ths(decimal: number): string {
  if (!Number.isFinite(decimal)) return "—";
  const sixteenths = Math.round(decimal * 16);
  return `${sixteenths}/16"`;
}

/**
 * AISC 360-16 §J2.4 — Fillet weld metal shear rupture calculation.
 */
export function calcWeldMetal(input: WeldMetalInput): WeldMetalResult {
  const { legSize, length, fexx, thetaDeg, nLines, method, useDirectional, appliedLoad } = input;

  if (!Number.isFinite(legSize) || legSize <= 0)
    throw new Error("Leg size w must be positive.");
  if (!Number.isFinite(length) || length <= 0)
    throw new Error("Length L must be positive.");
  if (!Number.isFinite(fexx) || fexx <= 0)
    throw new Error("FEXX must be positive.");
  if (!Number.isFinite(nLines) || nLines <= 0)
    throw new Error("Number of weld lines must be positive.");
  if (!Number.isFinite(thetaDeg) || thetaDeg < 0 || thetaDeg > 90)
    throw new Error("Load angle θ must be between 0° and 90°.");

  try {
    const te = 0.707 * legSize;
    const Awe = te * length * nLines;
    const thetaRad = (thetaDeg * Math.PI) / 180;
    const dirFactor = useDirectional
      ? 1.0 + 0.5 * Math.pow(Math.sin(thetaRad), 1.5)
      : 1.0;
    const Fnw = 0.6 * fexx * dirFactor;
    const Rn = Fnw * Awe;

    // AISC §J2.2b (Eq. J2-1) weld length reduction factor (beta) for longitudinal shear (theta = 0)
    let beta = 1.0;
    if (thetaDeg === 0) {
      const ratio = length / legSize;
      if (ratio > 100) {
        beta = Math.max(1.2 - 0.002 * ratio, 0.6);
        if (ratio > 300) {
          beta = 0.60;
        }
      }
    }

    const RnReduced = Rn * beta;
    const cap = method === "lrfd" ? 0.75 * RnReduced : RnReduced / 2.0;

    const dcr = appliedLoad > 0 ? appliedLoad / cap : null;
    const status = dcr === null ? null : dcr <= 1.0 ? "OK" : "NG";
    
    return { te, Awe, Fnw, Rn: RnReduced, cap, dcr, status, dirFactor, beta };
  } catch (error) {
    throw new Error(`Error calculating weld metal shear rupture: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * AISC 360-16 §J4.2 — Base metal shear (yielding & rupture) calculation.
 */
export function calcBaseMetal(input: BaseMetalInput): BaseMetalResult {
  const { baseT, fy, fu, length, nLines, method, appliedLoad } = input;

  if (!Number.isFinite(baseT) || baseT <= 0)
    throw new Error("Base metal thickness must be positive.");
  if (!Number.isFinite(fy) || fy <= 0)
    throw new Error("Base metal Fy must be positive.");
  if (!Number.isFinite(fu) || fu <= 0)
    throw new Error("Base metal Fu must be positive.");
  if (!Number.isFinite(length) || length <= 0)
    throw new Error("Length must be positive.");
  if (!Number.isFinite(nLines) || nLines <= 0)
    throw new Error("Number of weld lines must be positive.");

  try {
    const A = baseT * length * nLines;
    const RnYield = 0.6 * fy * A;
    const RnRupture = 0.6 * fu * A;

    const capYield   = method === "lrfd" ? 1.00 * RnYield   : RnYield   / 1.50;
    const capRupture = method === "lrfd" ? 0.75 * RnRupture : RnRupture / 2.00;

    const cap = Math.min(capYield, capRupture);
    const governs = capYield <= capRupture ? "yielding" : "rupture";

    const dcr = appliedLoad > 0 ? appliedLoad / cap : null;
    const status = dcr === null ? null : dcr <= 1.0 ? "OK" : "NG";

    return { A, RnYield, RnRupture, capYield, capRupture, cap, governs, dcr, status };
  } catch (error) {
    throw new Error(`Error calculating base metal shear: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * AISC 360-16 §J2.2b & Table J2.4 — Min/Max fillet leg size limits verification.
 */
export function calcWeldSize(input: WeldSizeInput): WeldSizeResult {
  const { legSize, baseT } = input;

  if (!Number.isFinite(baseT) || baseT <= 0)
    throw new Error("Base metal thickness must be positive.");
  if (!Number.isFinite(legSize) || legSize <= 0)
    throw new Error("Leg size must be positive.");

  try {
    let minSize: number;
    let minLabel: string;
    
    if (baseT <= 0.25)      { minSize = 0.125;  minLabel = '1/8"'; }
    else if (baseT <= 0.5)  { minSize = 0.1875; minLabel = '3/16"'; }
    else if (baseT <= 0.75) { minSize = 0.25;   minLabel = '1/4"'; }
    else                    { minSize = 0.3125; minLabel = '5/16"'; }

    const maxSize = baseT < 0.25 ? baseT : baseT - 0.0625;
    const maxLabel = baseT < 0.25
      ? `t = ${toFraction(baseT)}`
      : `t − 1/16" = ${toFraction(maxSize)}`;

    const minOk = legSize >= minSize - 1e-9;
    const maxOk = legSize <= maxSize + 1e-9;
    const status = minOk && maxOk ? "OK" : "NG";

    return { minSize, minLabel, maxSize, maxLabel, minOk, maxOk, status };
  } catch (error) {
    throw new Error(`Error calculating weld size limits: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * AISC 360-16 §K5 Eq. K1-1 — Effective width Be for transverse plate or HSS branch.
 */
export function calcK5EffectiveWidth(input: K5EffectiveWidthInput): K5EffectiveWidthResult {
  const { chordB, chordT, chordFy, branchB, branchT, branchFy } = input;

  if (!Number.isFinite(chordB) || chordB <= 0)
    throw new Error("Chord width B must be positive.");
  if (!Number.isFinite(chordT) || chordT <= 0)
    throw new Error("Chord thickness t must be positive.");
  if (!Number.isFinite(chordFy) || chordFy <= 0)
    throw new Error("Chord Fy must be positive.");
  if (!Number.isFinite(branchB) || branchB <= 0)
    throw new Error("Branch width Bb must be positive.");
  if (!Number.isFinite(branchT) || branchT <= 0)
    throw new Error("Branch thickness tb must be positive.");
  if (!Number.isFinite(branchFy) || branchFy <= 0)
    throw new Error("Branch Fyb must be positive.");

  try {
    const beta = branchB / chordB;
    const Bt = chordB / chordT;
    const beRaw = (10 / Bt) * ((chordFy * chordT) / (branchFy * branchT)) * branchB;
    const be = Math.min(beRaw, branchB);
    const capped = beRaw > branchB;

    return { beRaw, be, capped, beta, Bt };
  } catch (error) {
    throw new Error(`Error calculating K5 effective width: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * AISC 360-16 Table K3.1A — Limits of Applicability (LOA) for branch-to-rectangular-HSS connections.
 */
export function calcK5LOA(input: K5LOAInput): K5LOAResult {
  const { chord, branch, chordFy, branchFy } = input;

  if (!chord || !branch) {
    throw new Error("Chord and branch HSS profiles are required.");
  }
  if (!Number.isFinite(chord.B) || chord.B <= 0 || !Number.isFinite(chord.tDes) || chord.tDes <= 0)
    throw new Error("Chord geometry is invalid or non-positive.");
  if (!Number.isFinite(branch.B) || branch.B <= 0 || !Number.isFinite(branch.tDes) || branch.tDes <= 0)
    throw new Error("Branch geometry is invalid or non-positive.");

  try {
    const violations: string[] = [];
    const E = 29000; // ksi, AISC modulus of elasticity

    const beta = branch.B / chord.B;
    const gamma = chord.B / (2 * chord.tDes);

    if (beta < 0.25)
      violations.push(`β = Bb/B = ${beta.toFixed(2)} < 0.25 (minimum width ratio)`);
    if (beta > 1.0)
      violations.push(`β = Bb/B = ${beta.toFixed(2)} > 1.0 (branch wider than chord — §K5 not applicable)`);

    const Bt = chord.B / chord.tDes;
    const Ht = chord.H / chord.tDes;
    if (Bt > 35) violations.push(`Chord B/t = ${Bt.toFixed(1)} > 35`);
    if (Ht > 35) violations.push(`Chord H/t = ${Ht.toFixed(1)} > 35`);

    const Bbtb = branch.B / branch.tDes;
    const Hbtb = branch.H / branch.tDes;
    if (Bbtb > 35) violations.push(`Branch Bb/tb = ${Bbtb.toFixed(1)} > 35`);
    if (Htbtb(Hbtb)) {
      if (Hbtb > 35) violations.push(`Branch Hb/tb = ${Hbtb.toFixed(1)} > 35`);
    }

    const branchCompLim = 1.25 * Math.sqrt(E / branchFy);
    if (Bbtb > branchCompLim)
      violations.push(`Branch Bb/tb = ${Bbtb.toFixed(1)} > 1.25·√(E/Fyb) = ${branchCompLim.toFixed(1)} (compression case)`);
    if (Hbtb > branchCompLim)
      violations.push(`Branch Hb/tb = ${Hbtb.toFixed(1)} > 1.25·√(E/Fyb) = ${branchCompLim.toFixed(1)} (compression case)`);

    const chordAR = chord.H / chord.B;
    const branchAR = branch.H / branch.B;
    if (chordAR < 0.5 || chordAR > 2.0)
      violations.push(`Chord H/B = ${chordAR.toFixed(2)} outside [0.5, 2.0]`);
    if (branchAR < 0.5 || branchAR > 2.0)
      violations.push(`Branch Hb/Bb = ${branchAR.toFixed(2)} outside [0.5, 2.0]`);

    if (chordFy > 52)
      violations.push(`Chord Fy = ${chordFy} ksi > 52 ksi limit`);
    if (branchFy > 52)
      violations.push(`Branch Fy = ${branchFy} ksi > 52 ksi limit`);

    return { withinLOA: violations.length === 0, violations, beta, gamma };
  } catch (error) {
    throw new Error(`Error calculating limits of applicability: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper utility to make TS compiler happy or just check Hbtb definition
function Htbtb(val: number): boolean {
  return Number.isFinite(val);
}

/**
 * Effective length for the user-selected face — mode-aware dispatcher.
 */
export function calcFaceEffectiveLength(input: FaceEffectiveLengthInput): FaceEffectiveLengthResult {
  const { mode, faceLength, isTransverse, connType, k5, cbfemLc } = input;

  if (!Number.isFinite(faceLength) || faceLength <= 0)
    throw new Error("Face length must be positive.");

  try {
    // Mode 3 — CBFEM peak-element Lc
    if (mode === "cbfem") {
      if (cbfemLc === undefined || !Number.isFinite(cbfemLc) || cbfemLc <= 0)
        throw new Error("CBFEM Lc must be positive.");
      if (cbfemLc > faceLength + 1e-9)
        throw new Error(`Lc = ${cbfemLc.toFixed(3)} in exceeds nominal face length ${faceLength} in — check input.`);
      return {
        length: cbfemLc,
        nominal: faceLength,
        reduced: cbfemLc < faceLength - 1e-9,
        ref: "CBFEM peak-element length Lc (Hilti Profis / IDEA StatiCa, user input)",
      };
    }

    // Mode 2 — K5 Be applied to transverse face regardless of connection type
    if (mode === "k5") {
      if (isTransverse) {
        if (!k5) throw new Error("K5 result required for transverse face in K5 mode.");
        return {
          length: k5.be,
          nominal: faceLength,
          reduced: k5.be < faceLength - 1e-9,
          ref: connType === "hss2hss"
            ? "AISC 360 §K5 Eq. K1-1 — Be (chord = HSS chord)"
            : "AISC 360 §K5 Eq. K1-1 — Be (chord = plate, engineering judgment)",
        };
      }
      return {
        length: faceLength,
        nominal: faceLength,
        reduced: false,
        ref: "AISC 360 §K5 Table K5.1 — longitudinal (parallel) face fully effective",
      };
    }

    // Mode 1 — AISC Strict: assumes rigid base/chord, full nominal length is considered
    return {
      length: faceLength,
      nominal: faceLength,
      reduced: false,
      ref: connType === "hss2plate"
        ? "Full nominal length per AISC — rigid plate assumption (Tousignant & Packer 2015)"
        : "Full nominal length per AISC — rigid chord wall assumption",
    };
  } catch (error) {
    throw new Error(`Error calculating face effective length: ${error instanceof Error ? error.message : String(error)}`);
  }
}
