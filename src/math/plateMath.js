/**
 * Base Plate Rigidity Equations - Pure Mathematical Engine
 */

// Estimate anchor row tension demand T_u under rigid-plate equilibrium
export function calcAnchorTensionAuto({
  Mu, Pu, anchorOffsetY, Nplate, bearingInsetFrac = 0.05,
}) {
  if (!Number.isFinite(Mu) || Mu < 0)
    throw new Error("Mu must be non-negative (kip·in).");
  if (!Number.isFinite(Pu))
    throw new Error("Pu must be a finite number (kip).");
  if (!Number.isFinite(anchorOffsetY) || anchorOffsetY <= 0)
    throw new Error("Anchor offset must be positive (in).");
  if (!Number.isFinite(Nplate) || Nplate <= 0)
    throw new Error("Plate dimension along moment axis must be positive (in).");
  if (anchorOffsetY >= Nplate / 2)
    throw new Error(`Anchor offset (${anchorOffsetY}) must be less than half the plate (${Nplate / 2}).`);

  const bearingInset = Nplate * bearingInsetFrac;
  const dLever = anchorOffsetY + (Nplate / 2 - bearingInset);
  const TuRaw = Mu / dLever - Pu;
  const Tu = Math.max(TuRaw, 0); // anchors can only take tension
  const noTension = TuRaw <= 0;

  return {
    Tu, TuRaw, dLever, bearingInset, noTension,
  };
}

// Method B: elastic plate bending under tension-side cantilever
// σ_max = 6·Tu·x / (b_eff·t²) ≤ Fy
export function calcMethodB({ Tu, x, beff, Fyp, tp }) {
  if (!Number.isFinite(Tu) || Tu < 0) throw new Error("Tu must be ≥ 0.");
  if (!Number.isFinite(x) || x < 0) throw new Error("x must be ≥ 0.");
  if (!Number.isFinite(beff) || beff <= 0) throw new Error("beff must be > 0.");
  if (!Number.isFinite(Fyp) || Fyp <= 0) throw new Error("Fyp must be > 0.");
  if (!Number.isFinite(tp) || tp <= 0) throw new Error("tp must be > 0.");

  if (Tu === 0) {
    return { sigmaMax: 0, tReq: 0, DCR: 0, pass: true, trivial: true };
  }
  const sigmaMax = (6 * Tu * x) / (beff * tp * tp);
  const tReq = Math.sqrt((6 * Tu * x) / (beff * Fyp));
  const DCR = sigmaMax / Fyp;
  const pass = DCR <= 1.0;
  return { sigmaMax, tReq, DCR, pass, trivial: false };
}

// AISC DG1 §3.4 plastic cantilever thickness check
// t ≥ √(4·Tu·x / (φ·Fy·b_eff))
export function calcDG1({ Tu, x, beff, Fyp, tp, phi = 0.9 }) {
  if (!Number.isFinite(Tu) || Tu < 0) throw new Error("Tu must be ≥ 0.");
  if (!Number.isFinite(x) || x < 0) throw new Error("x must be ≥ 0.");
  if (!Number.isFinite(beff) || beff <= 0) throw new Error("beff must be > 0.");
  if (!Number.isFinite(Fyp) || Fyp <= 0) throw new Error("Fyp must be > 0.");
  if (!Number.isFinite(tp) || tp <= 0) throw new Error("tp must be > 0.");
  if (!Number.isFinite(phi) || phi <= 0 || phi > 1)
    throw new Error("phi must be in (0,1].");

  if (Tu === 0) {
    return { tReq: 0, DCR: 0, pass: true, trivial: true };
  }
  const tReq = Math.sqrt((4 * Tu * x) / (phi * Fyp * beff));
  const DCR = tReq / tp;
  const pass = DCR <= 1.0;
  return { tReq, DCR, pass, trivial: false };
}

// Rigidity verdict selector based on two checks
export function calcRigidityVerdict(mB, dg1) {
  if (mB.pass && dg1.pass) {
    return { verdict: "RIGID", color: "ok",
      note: "Both checks pass. Rigid-plate hand-calc anchor analysis (DG1 / ACI 318) is valid for this plate under the assumed Tu." };
  }
  if (dg1.pass && !mB.pass) {
    return { verdict: "NOT RIGID", color: "fail",
      note: "Method B (elastic plate bending) indicates yielding under Tu. DG1 with φ allows some plastic deformation but the plate cannot maintain elastic behavior. Rigid-plate anchor analysis is NOT representative — use CBFEM or thicken the plate. Note: DG1 alone passing is self-referential — it uses the rigid-plate-derived Tu as input to its own check." };
  }
  if (!dg1.pass) {
    return { verdict: "NOT RIGID", color: "fail",
      note: "Both checks fail. The plate cannot support the assumed anchor reactions even with plastic-section / φ allowance. CBFEM analysis required, or significantly thicker plate / additional stiffeners." };
  }
  return { verdict: "REVIEW", color: "warn",
    note: "Unusual check combination — review inputs and re-run." };
}
