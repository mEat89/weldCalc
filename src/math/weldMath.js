/**
 * AISC 360 Weld Capacity Equations - Pure Mathematical Engine
 */

export function toFraction(decimal) {
  if (!Number.isFinite(decimal) || decimal === 0) return "0";
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
}

export function to16ths(decimal) {
  if (!Number.isFinite(decimal)) return "—";
  const sixteenths = Math.round(decimal * 16);
  return `${sixteenths}/16"`;
}

// AISC 360-16 §J2.4 — Fillet weld metal shear rupture
export function calcWeldMetal({
  legSize, length, fexx, thetaDeg, nLines, method, useDirectional, appliedLoad,
}) {
  if (!Number.isFinite(legSize) || legSize <= 0)
    throw new Error("Leg size w must be positive.");
  if (!Number.isFinite(length) || length <= 0)
    throw new Error("Length L must be positive.");
  if (!Number.isFinite(fexx) || fexx <= 0)
    throw new Error("FEXX must be positive.");
  if (!Number.isFinite(nLines) || nLines <= 0)
    throw new Error("Number of weld lines must be positive.");
  if (thetaDeg < 0 || thetaDeg > 90)
    throw new Error("Load angle θ must be 0° to 90°.");

  const te = 0.707 * legSize;
  const Awe = te * length * nLines;
  const thetaRad = (thetaDeg * Math.PI) / 180;
  const dirFactor = useDirectional
    ? 1.0 + 0.5 * Math.pow(Math.sin(thetaRad), 1.5)
    : 1.0;
  const Fnw = 0.6 * fexx * dirFactor;
  const Rn = Fnw * Awe;
  const cap = method === "lrfd" ? 0.75 * Rn : Rn / 2.0;

  const dcr = appliedLoad > 0 ? appliedLoad / cap : null;
  const status = dcr === null ? null : dcr <= 1.0 ? "OK" : "NG";
  return { te, Awe, Fnw, Rn, cap, dcr, status, dirFactor };
}

// AISC 360-16 §J4.2 — Base metal shear (yielding & rupture)
export function calcBaseMetal({ baseT, fy, fu, length, nLines, method, appliedLoad }) {
  if (!Number.isFinite(baseT) || baseT <= 0)
    throw new Error("Base metal thickness must be positive.");
  if (!Number.isFinite(fy) || fy <= 0)
    throw new Error("Base metal Fy must be positive.");
  if (!Number.isFinite(fu) || fu <= 0)
    throw new Error("Base metal Fu must be positive.");

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
}

// AISC 360-16 §J2.2b & Table J2.4 — Min/Max fillet leg size
export function calcWeldSize({ legSize, baseT }) {
  if (!Number.isFinite(baseT) || baseT <= 0)
    throw new Error("Base metal thickness must be positive.");

  let minSize, minLabel;
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
}

// AISC 360-16 §K5 Eq. K1-1 — Effective width Be for transverse plate/branch
export function calcK5EffectiveWidth({
  chordB, chordT, chordFy, branchB, branchT, branchFy,
}) {
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

  const beta = branchB / chordB;
  const Bt = chordB / chordT;
  const beRaw = (10 / Bt) * ((chordFy * chordT) / (branchFy * branchT)) * branchB;
  const be = Math.min(beRaw, branchB);
  const capped = beRaw > branchB;

  return { beRaw, be, capped, beta, Bt };
}

// AISC 360-16 Table K3.1A — Limits of Applicability for branch-to-rect-HSS
export function calcK5LOA({ chord, branch, chordFy, branchFy }) {
  const violations = [];
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
  if (Hbtb > 35) violations.push(`Branch Hb/tb = ${Hbtb.toFixed(1)} > 35`);

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
}

// Effective length for the user-selected face — mode-aware dispatcher
export function calcFaceEffectiveLength({
  mode, faceLength, isTransverse, connType, k5, cbfemLc,
}) {
  if (!Number.isFinite(faceLength) || faceLength <= 0)
    throw new Error("Face length must be positive.");

  // Mode 3 — CBFEM peak-element Lc
  if (mode === "cbfem") {
    if (!Number.isFinite(cbfemLc) || cbfemLc <= 0)
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

  // Mode 1 — Strict AISC code
  if (connType === "hss2hss" && isTransverse) {
    if (!k5) throw new Error("K5 result required for transverse HSS-to-HSS face.");
    return {
      length: k5.be,
      nominal: faceLength,
      reduced: k5.be < faceLength - 1e-9,
      ref: "AISC 360 §K5 Eq. K1-1 — Be effective width",
    };
  }
  return {
    length: faceLength,
    nominal: faceLength,
    reduced: false,
    ref: connType === "hss2plate"
      ? "Full nominal length per AISC code — rigid plate (Tousignant & Packer 2015); kds=1.0 captures non-uniform stress"
      : "AISC 360 §K5 Table K5.1 — longitudinal weld portion fully effective",
  };
}

// Effective-area-proportional load distribution (pure axial only)
export function calcLoadDistribution({ pTotal, faceBEff, faceHEff }) {
  if (!Number.isFinite(pTotal) || pTotal < 0)
    throw new Error("P_total must be non-negative.");
  if (!Number.isFinite(faceBEff) || faceBEff <= 0)
    throw new Error("Face B effective length must be positive.");
  if (!Number.isFinite(faceHEff) || faceHEff <= 0)
    throw new Error("Face H effective length must be positive.");

  const Ltotal = 2 * faceBEff + 2 * faceHEff;
  if (Ltotal <= 0)
    throw new Error("Total effective length must be positive.");

  const PB = pTotal * (faceBEff / Ltotal);
  const PH = pTotal * (faceHEff / Ltotal);

  return {
    faceBEff, faceHEff, Ltotal,
    PB, PH,
    PBPct: (faceBEff / Ltotal) * 100,
    PHPct: (faceHEff / Ltotal) * 100,
  };
}
