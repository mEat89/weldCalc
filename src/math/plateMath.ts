/**
 * Base Plate Rigidity Equations - Pure Mathematical Engine in TypeScript
 */

export interface AnchorTensionInput {
  Mu: number; // kip·in
  Pu: number; // kip
  anchorOffsetY: number; // in
  Nplate: number; // in
  bearingInsetFrac?: number;
}

export interface AnchorTensionResult {
  Tu: number;
  TuRaw: number;
  dLever: number;
  bearingInset: number;
  noTension: boolean;
}

export interface MethodBInput {
  Tu: number;
  x: number;
  beff: number;
  Fyp: number;
  tp: number;
}

export interface MethodBResult {
  sigmaMax: number;
  tReq: number;
  DCR: number;
  pass: boolean;
  trivial: boolean;
}

export interface DG1Input {
  Tu: number;
  x: number;
  beff: number;
  Fyp: number;
  tp: number;
  phi?: number;
}

export interface DG1Result {
  tReq: number;
  DCR: number;
  pass: boolean;
  trivial: boolean;
}

export interface RigidityVerdict {
  verdict: "RIGID" | "NOT RIGID" | "REVIEW";
  color: "ok" | "fail" | "warn";
  note: string;
}

/**
 * Estimate anchor row tension demand T_u under rigid-plate equilibrium
 */
export function calcAnchorTensionAuto(input: AnchorTensionInput): AnchorTensionResult {
  const { Mu, Pu, anchorOffsetY, Nplate, bearingInsetFrac = 0.05 } = input;

  if (!Number.isFinite(Mu) || Mu < 0)
    throw new Error("Mu must be non-negative (kip·in).");
  if (!Number.isFinite(Pu))
    throw new Error("Pu must be a finite number (kip).");
  if (!Number.isFinite(anchorOffsetY) || anchorOffsetY <= 0)
    throw new Error("Anchor offset must be positive (in).");
  if (!Number.isFinite(Nplate) || Nplate <= 0)
    throw new Error("Plate dimension along moment axis must be positive (in).");
  if (anchorOffsetY >= Nplate / 2)
    throw new Error(`Anchor offset (${anchorOffsetY} in) must be less than half the plate length (${Nplate / 2} in).`);

  try {
    const bearingInset = Nplate * bearingInsetFrac;
    const dLever = anchorOffsetY + (Nplate / 2 - bearingInset);
    if (dLever <= 0) {
      throw new Error("Lever arm is non-positive. Check geometry inputs.");
    }
    const TuRaw = Mu / dLever - Pu;
    const Tu = Math.max(TuRaw, 0); // anchors can only take tension, no compression anchorage load
    const noTension = TuRaw <= 0;

    return {
      Tu, TuRaw, dLever, bearingInset, noTension,
    };
  } catch (error) {
    throw new Error(`Error calculating anchor tension auto: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Method B: elastic plate bending under tension-side cantilever
 * σ_max = 6·Tu·x / (b_eff·t²) ≤ Fy
 */
export function calcMethodB(input: MethodBInput): MethodBResult {
  const { Tu, x, beff, Fyp, tp } = input;

  if (!Number.isFinite(Tu) || Tu < 0) throw new Error("Tu must be non-negative.");
  if (!Number.isFinite(x) || x < 0) throw new Error("Cantilever dimension x must be non-negative.");
  if (!Number.isFinite(beff) || beff <= 0) throw new Error("Effective width beff must be positive.");
  if (!Number.isFinite(Fyp) || Fyp <= 0) throw new Error("Plate yield stress Fyp must be positive.");
  if (!Number.isFinite(tp) || tp <= 0) throw new Error("Plate thickness tp must be positive.");

  try {
    if (Tu === 0 || x === 0) {
      return { sigmaMax: 0, tReq: 0, DCR: 0, pass: true, trivial: true };
    }
    const sigmaMax = (6 * Tu * x) / (beff * tp * tp);
    const tReq = Math.sqrt((6 * Tu * x) / (beff * Fyp));
    const DCR = sigmaMax / Fyp;
    const pass = DCR <= 1.0;
    return { sigmaMax, tReq, DCR, pass, trivial: false };
  } catch (error) {
    throw new Error(`Error in Method B calculation: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * AISC DG1 §3.4 plastic cantilever thickness check
 * t ≥ √(4·Tu·x / (φ·Fy·b_eff))
 */
export function calcDG1(input: DG1Input): DG1Result {
  const { Tu, x, beff, Fyp, tp, phi = 0.9 } = input;

  if (!Number.isFinite(Tu) || Tu < 0) throw new Error("Tu must be non-negative.");
  if (!Number.isFinite(x) || x < 0) throw new Error("Cantilever dimension x must be non-negative.");
  if (!Number.isFinite(beff) || beff <= 0) throw new Error("Effective width beff must be positive.");
  if (!Number.isFinite(Fyp) || Fyp <= 0) throw new Error("Plate yield stress Fyp must be positive.");
  if (!Number.isFinite(tp) || tp <= 0) throw new Error("Plate thickness tp must be positive.");
  if (!Number.isFinite(phi) || phi <= 0 || phi > 1)
    throw new Error("phi strength reduction factor must be in range (0, 1].");

  try {
    if (Tu === 0 || x === 0) {
      return { tReq: 0, DCR: 0, pass: true, trivial: true };
    }
    const tReq = Math.sqrt((4 * Tu * x) / (phi * Fyp * beff));
    const DCR = tReq / tp;
    const pass = DCR <= 1.0;
    return { tReq, DCR, pass, trivial: false };
  } catch (error) {
    throw new Error(`Error in DG1 calculation: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Rigidity verdict selector based on two checks
 */
export function calcRigidityVerdict(mB: MethodBResult, dg1: DG1Result): RigidityVerdict {
  try {
    if (mB.pass && dg1.pass) {
      return {
        verdict: "RIGID",
        color: "ok",
        note: "Both checks pass. Rigid-plate hand-calc anchor analysis (DG1 / ACI 318) is valid for this plate under the assumed Tu."
      };
    }
    if (dg1.pass && !mB.pass) {
      return {
        verdict: "NOT RIGID",
        color: "fail",
        note: "Method B (elastic plate bending) indicates yielding under Tu. DG1 with φ allows some plastic deformation but the plate cannot maintain elastic behavior. Rigid-plate anchor analysis is NOT representative — use CBFEM or thicken the plate. Note: DG1 alone passing is self-referential — it uses the rigid-plate-derived Tu as input to its own check."
      };
    }
    if (!dg1.pass) {
      return {
        verdict: "NOT RIGID",
        color: "fail",
        note: "Both checks fail. The plate cannot support the assumed anchor reactions even with plastic-section / φ allowance. CBFEM analysis required, or significantly thicker plate / additional stiffeners."
      };
    }
    return {
      verdict: "REVIEW",
      color: "warn",
      note: "Unusual check combination — review inputs and re-run."
    };
  } catch (error) {
    throw new Error(`Error calculating rigidity verdict: ${error instanceof Error ? error.message : String(error)}`);
  }
}
