/**
 * AISC 360-22 §K4-9 — Combined Loading Unity Check for HSS Connections.
 *
 * For HSS branches under simultaneous axial and in-plane bending currently
 * supported by the app, the connection must satisfy:
 *
 *     P_r / P_c  +  M_r,ip / M_c,ip  ≤  1.0
 *
 * Where each P_r/P_c (and M_r/M_c) is the DCR (demand-to-capacity ratio) the
 * user has already established for that single solicitation. Missing terms
 * are treated as zero (the user has not yet evaluated that load case).
 */

export interface K4UnityInput {
  axialDCR?: number | null;
  ipMomentDCR?: number | null;
}

export interface K4UnityResult {
  unity: number;
  status: "OK" | "NG";
  terms: {
    axial: number;
    ipMoment: number;
  };
  /** True iff at least one term was supplied (i.e., the check is meaningful). */
  hasAnyTerm: boolean;
}

function term(v: number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (!Number.isFinite(v)) return 0;
  if (v < 0) throw new Error(`Combined-loading DCR terms must be non-negative; got ${v}.`);
  return v;
}

export function calcK4Unity(input: K4UnityInput): K4UnityResult {
  const axial = term(input.axialDCR);
  const ipMoment = term(input.ipMomentDCR);

  const unity = axial + ipMoment;
  const hasAnyTerm =
    (input.axialDCR !== null && input.axialDCR !== undefined) ||
    (input.ipMomentDCR !== null && input.ipMomentDCR !== undefined);

  return {
    unity,
    status: unity <= 1.0 + 1e-9 ? "OK" : "NG",
    terms: { axial, ipMoment },
    hasAnyTerm,
  };
}
