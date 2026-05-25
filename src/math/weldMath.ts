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
  /**
   * Routes the base-metal check to the correct AISC §J4 limit state:
   *  - "shear":   Eq. J4-3 yielding (0.6·Fy, φ=1.0) + Eq. J4-4 rupture (0.6·Fu, φ=0.75)
   *  - "tension": Eq. J4-1 yielding (Fy, φ=0.90)   + Eq. J4-2 rupture (Fu, φ=0.75)
   * Moment-couple demands route through "tension" (the apportioned force is a
   * tension/compression couple acting axially on the flange face).
   * Defaults to "shear" for backward compatibility with callers that haven't
   * yet been updated.
   */
  solicitation?: "shear" | "tension";
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

export interface SipInput {
  Hb: number;
  Be: number;
  tw: number;
  thetaDeg: number;
}

export interface SipResult {
  Sip: number;
  webTerm: number;    // tw · Hb²/(3·sin²θ)
  flangeTerm: number; // tw · Be · Hb/sinθ
}

export interface MomentCapacityInput {
  Sip: number;
  fexx: number;
  method: "lrfd" | "asd";
  /** Suppresses the directional increase. AISC §K5 user note locks kds=1.0
   *  when bending puts the weld in tension. Defaults to true. */
  suppressDirectional?: boolean;
}

export interface MomentCapacityResult {
  Fnw: number;
  Mn: number;  // kip-in
  cap: number; // kip-in (LRFD: φ·Mn with φ=0.75)
}

export interface K5GroupCapacityInput {
  Hb: number;
  Bb: number;
  Be: number;
  tw: number;
  fexx: number;
  thetaDeg: number;
  method: "lrfd" | "asd";
  /** Same directional-suppression policy as the moment helper. Default true. */
  suppressDirectional?: boolean;
}

export interface K5GroupCapacityResult {
  le: number;          // total effective weld length, Eq. K5-5
  Sip: number;         // total effective elastic section modulus, Eq. K5-6
  Fnw: number;         // nominal weld stress (kds = 1.0 for HSS branch welds)
  Pn_axial: number;    // Eq. K5-1: Fnw·tw·le
  cap_axial: number;   // φ·Pn (LRFD: φ=0.75)
  Mn_ip: number;       // Eq. K5-2: Fnw·Sip (kip-in)
  cap_ip: number;      // φ·Mn (kip-in)
  terms: { webTerm: number; flangeTerm: number };
}

export interface FaceEffectiveLengthInput {
  mode: "standard" | "aisc" | "k5";
  faceLength: number;
  isTransverse: boolean;
  connType: "hss2hss" | "hss2plate";
  k5?: K5EffectiveWidthResult | null;
  /**
   * If true, force K5 Be reduction even when the selected face is longitudinal.
   * Strict §K5 says longitudinal (parallel) faces are fully effective — this
   * override is offered only as a conservative engineering judgment.
   */
  forceK5OnLongitudinal?: boolean;
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
 * AISC 360-22 §J4 — Base metal limit-state check.
 *
 * Routes between §J4.2 (shear yielding/rupture, Eq. J4-3/J4-4) and §J4.1/J4.2
 * (tension yielding/rupture, Eq. J4-1/J4-2) based on the `solicitation` field.
 * Shear uses the 0.6·Fy and 0.6·Fu factors; tension does not — this distinction
 * was previously collapsed in the app and over-stated the base-metal DCR for
 * any tension or moment-couple demand by a factor of 1/0.6 ≈ 1.67×.
 */
export function calcBaseMetal(input: BaseMetalInput): BaseMetalResult {
  const { baseT, fy, fu, length, nLines, method, appliedLoad } = input;
  const solicitation = input.solicitation ?? "shear";

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

    // Yield/rupture coefficient (0.6 for shear, 1.0 for tension)
    const k = solicitation === "shear" ? 0.6 : 1.0;
    // Yielding resistance factor (1.00 for §J4.2 shear, 0.90 for §J4.1 tension)
    const phiYield = solicitation === "shear" ? 1.00 : 0.90;
    // Rupture resistance factor is φ = 0.75 in both branches.
    const phiRupture = 0.75;

    const RnYield = k * fy * A;
    const RnRupture = k * fu * A;

    const capYield   = method === "lrfd" ? phiYield * RnYield   : RnYield   / (solicitation === "shear" ? 1.50 : 1.67);
    const capRupture = method === "lrfd" ? phiRupture * RnRupture : RnRupture / 2.00;

    const cap = Math.min(capYield, capRupture);
    const governs = capYield <= capRupture ? "yielding" : "rupture";

    const dcr = appliedLoad > 0 ? appliedLoad / cap : null;
    const status = dcr === null ? null : dcr <= 1.0 ? "OK" : "NG";

    return { A, RnYield, RnRupture, capYield, capRupture, cap, governs, dcr, status };
  } catch (error) {
    throw new Error(`Error calculating base metal ${solicitation}: ${error instanceof Error ? error.message : String(error)}`);
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

    const maxSize = baseT <= 0.25 ? baseT : baseT - 0.0625;
    const maxLabel = baseT <= 0.25
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
    // gamma per AISC §K5 is the chord half-width slenderness B/(2·t).
    // The §K5 limit γ ≤ 35 is mathematically equivalent to the B/t ≤ 70
    // bound, which is in turn implied by the stricter B/t ≤ 35 check below
    // (Bt > 35 ⇒ γ > 17.5; well below the γ ≤ 35 ceiling). We expose gamma
    // in the result for transparency but do not push a separate violation,
    // since the Bt check already covers (and exceeds) the §K5 γ requirement.
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
    if (Number.isFinite(Hbtb) && Hbtb > 35)
      violations.push(`Branch Hb/tb = ${Hbtb.toFixed(1)} > 35`);

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

/**
 * AISC 360-22 Table K5.1 Eq. K5-6 — Effective elastic section modulus for
 * in-plane bending of a rectangular HSS branch weld group.
 *
 *   Sip = tw · [ Hb²/(3·sin²θ)  +  Be · Hb/sinθ ]
 *
 * The first term is the webs' contribution (two longitudinal welds bending
 * about their strong axis); the second is the flanges' contribution (two
 * transverse welds at distance Hb/(2·sinθ) from the neutral axis, with Be
 * effective width per Eq. K1-1).
 */
export function calcSip(input: SipInput): SipResult {
  const { Hb, Be, tw, thetaDeg } = input;

  if (!Number.isFinite(Hb) || Hb <= 0) throw new Error("Hb must be positive.");
  if (!Number.isFinite(Be) || Be <= 0) throw new Error("Be must be positive.");
  if (!Number.isFinite(tw) || tw <= 0) throw new Error("tw must be positive.");
  if (!Number.isFinite(thetaDeg) || thetaDeg <= 0 || thetaDeg > 90)
    throw new Error("thetaDeg must be in (0, 90].");

  try {
    const sinT = Math.sin((thetaDeg * Math.PI) / 180);
    const webTerm = tw * (Hb * Hb) / (3 * sinT * sinT);
    const flangeTerm = tw * Be * Hb / sinT;
    return { Sip: webTerm + flangeTerm, webTerm, flangeTerm };
  } catch (error) {
    throw new Error(`Error calculating Sip: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * AISC 360-22 §K5 Eq. K5-2 — In-plane moment capacity of the weld group.
 *   Mn-ip = Fnw · Sip,  cap = φ · Mn  (φ = 0.75 LRFD)
 * Per §K5 user note, the directional strength increase factor cannot exceed
 * 1.0 in fillet welds at the end of rectangular HSS when bending puts the
 * weld in tension — so Fnw = 0.6·FEXX with no kds boost.
 */
export function calcMomentIpCapacity(input: MomentCapacityInput): MomentCapacityResult {
  const { Sip, fexx, method } = input;
  if (!Number.isFinite(Sip) || Sip <= 0) throw new Error("Sip must be positive.");
  if (!Number.isFinite(fexx) || fexx <= 0) throw new Error("FEXX must be positive.");

  try {
    const Fnw = 0.6 * fexx; // §K5 locks kds = 1.0 for bending tension
    const Mn = Fnw * Sip;
    const cap = method === "lrfd" ? 0.75 * Mn : Mn / 2.0;
    return { Fnw, Mn, cap };
  } catch (error) {
    throw new Error(`Error calculating Mn-ip: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * AISC 360-22 §K5 — Total group capacity for axial and in-plane moment.
 * Combines Eq. K5-1 (axial via le) and Eq. K5-2 (moment via Sip) into a
 * single helper for the HSS tab and report output.
 *
 * For HSS-to-HSS T-, Y-, and cross-connections (Table K5.1):
 *   le  = 2·Hb/sinθ + 2·Be           (Eq. K5-5)
 *   Sip = tw·[Hb²/(3·sin²θ) + Be·Hb/sinθ]  (Eq. K5-6)
 *   Pn  = Fnw·tw·le                  (Eq. K5-1)
 *   Mn  = Fnw·Sip                    (Eq. K5-2)
 * In K5 mode, pass Be from calcK5EffectiveWidth. In AISC mode (no reduction),
 * pass Be = Bb.
 */
export function calcK5GroupCapacity(input: K5GroupCapacityInput): K5GroupCapacityResult {
  const { Hb, Bb, Be, tw, fexx, thetaDeg, method } = input;
  if (!Number.isFinite(Hb) || Hb <= 0) throw new Error("Hb must be positive.");
  if (!Number.isFinite(Bb) || Bb <= 0) throw new Error("Bb must be positive.");
  if (!Number.isFinite(Be) || Be <= 0) throw new Error("Be must be positive.");
  if (!Number.isFinite(tw) || tw <= 0) throw new Error("tw must be positive.");
  if (!Number.isFinite(fexx) || fexx <= 0) throw new Error("FEXX must be positive.");
  if (!Number.isFinite(thetaDeg) || thetaDeg <= 0 || thetaDeg > 90)
    throw new Error("thetaDeg must be in (0, 90].");

  try {
    const sinT = Math.sin((thetaDeg * Math.PI) / 180);
    const le = 2 * Hb / sinT + 2 * Be;
    const sipResult = calcSip({ Hb, Be, tw, thetaDeg });
    const Fnw = 0.6 * fexx; // §K5: kds locked to 1.0 for HSS branch welds
    const Pn_axial = Fnw * tw * le;
    const Mn_ip = Fnw * sipResult.Sip;
    const cap_axial = method === "lrfd" ? 0.75 * Pn_axial : Pn_axial / 2.0;
    const cap_ip = method === "lrfd" ? 0.75 * Mn_ip : Mn_ip / 2.0;
    return {
      le,
      Sip: sipResult.Sip,
      Fnw,
      Pn_axial,
      cap_axial,
      Mn_ip,
      cap_ip,
      terms: { webTerm: sipResult.webTerm, flangeTerm: sipResult.flangeTerm },
    };
  } catch (error) {
    throw new Error(`Error calculating K5 group capacity: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Effective length for the user-selected face — mode-aware dispatcher.
 */
export function calcFaceEffectiveLength(input: FaceEffectiveLengthInput): FaceEffectiveLengthResult {
  const { mode, faceLength, isTransverse, connType, k5, forceK5OnLongitudinal } = input;

  if (!Number.isFinite(faceLength) || faceLength <= 0)
    throw new Error("Face length must be positive.");

  try {
    // K5 mode — apply Be only to the transverse (perpendicular-to-load) branch face.
    // Longitudinal (parallel) faces are fully effective per §K5 Table K5.1,
    // unless the user explicitly opts in to a conservative force-K5 override.
    if (mode === "k5") {
      const applyBe = isTransverse || forceK5OnLongitudinal === true;
      if (applyBe) {
        if (!k5) throw new Error("K5 result required for Be reduction in K5 mode.");
        let ref: string;
        if (isTransverse) {
          ref = connType === "hss2hss"
            ? "AISC 360 §K5 Eq. K1-1 — Be reduction (HSS chord face)"
            : "Conservative engineering judgment — K5 Be applied to plate (derived from Eq. K1-1; strict §K5 defines this for HSS chord faces only — reduces L_eff to bias DCR conservative)";
        } else {
          ref = "Conservative engineering judgment — K5 Be forced on longitudinal face (strict §K5 Table K5.1 treats parallel faces as fully effective; this override under-reports L_eff)";
        }
        return {
          length: k5.be,
          nominal: faceLength,
          reduced: k5.be < faceLength - 1e-9,
          ref,
        };
      }
      return {
        length: faceLength,
        nominal: faceLength,
        reduced: false,
        ref: "AISC 360 §K5 Table K5.1 — longitudinal (parallel) face fully effective",
      };
    }

    // AISC strict mode — assumes rigid base/chord, full nominal length applies.
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
