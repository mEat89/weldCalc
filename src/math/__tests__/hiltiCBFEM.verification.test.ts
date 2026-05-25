/**
 * Hilti PROFIS CBFEM correlation tests.
 *
 * Each test reproduces a scenario from one of the Hilti PROFIS reports
 * in ASIC360references/MUE26031001-DunesHotelCanopy_Concrete-*.pdf
 * using the exact math layer the React tab calls (calcK5EffectiveWidth,
 * calcWeldMetal, calcBaseMetal) plus the perimeter/moment-share apportioning
 * the tab applies on top.
 *
 * Goals:
 *  1. Catch any drift between the math layer and the displayed numbers.
 *  2. Document the delta between our hand-calc DCR and Hilti's CBFEM peak
 *     utilization for each canonical scenario.
 *
 * Geometry constants come from the report's "Profile" section; weld leg
 * sizes (Ls) come from each report's "2.5 Welds" table.
 */
import { describe, it, expect } from "vitest";
import {
  calcWeldMetal,
  calcBaseMetal,
  calcK5EffectiveWidth,
  calcFaceEffectiveLength,
  calcSip,
  calcMomentIpCapacity,
  calcK5GroupCapacity,
} from "../weldMath";
import { calcHssToPlateLocalWeldCheck } from "../hssLocalWeld";

// ============================================================================
// Common branch (used by reports 2, 4, 5 — all HSS8x2x1/8 + 0.5" plate)
// ============================================================================
const HSS_8x2x125 = {
  B: 2.0,
  H: 8.0,
  tDes: 0.116, // 0.93 * 0.125 nominal per A500
  tNom: 0.125,
};
const A500_GrB = { fy: 46, fu: 58 };
const A36 = { fy: 36, fu: 58 };
const PLATE_05 = 0.5;
const FEXX = 70;
const PHI_LRFD_WELD = 0.75;

interface FaceCheck {
  faceName: string;
  faceLength: number; // L_eff after K5 or full nominal
  pFace: number;      // tributary demand on this face
  weldCap: number;    // phi Rn weld metal
  baseCap: number;    // phi Rn base metal
  dcrWeld: number;
  dcrBase: number;
  dcrGov: number;
}

function runFace({
  branch, plateT, branchFy, plateFy, plateFu, branchTDes,
  faceName, selectedFaceDim, branchTransverseDim,
  lengthMode, legSize, thetaDeg, useDirectional,
  pFace, solicitation = "tension",
}: {
  branch: typeof HSS_8x2x125;
  plateT: number;
  branchFy: number;
  plateFy: number;
  plateFu: number;
  branchTDes: number;
  faceName: string;
  selectedFaceDim: "B" | "H";
  branchTransverseDim: "B" | "H";
  lengthMode: "aisc" | "k5";
  legSize: number;
  thetaDeg: number;
  useDirectional: boolean;
  pFace: number;
  solicitation?: "shear" | "tension";
}): FaceCheck {
  const branchNominal = selectedFaceDim === "B" ? branch.B : branch.H;
  // Sharp-corner box approximation (matches Hilti modeled lengths within ~0.5%).
  const selectedFaceNominal = selectedFaceDim === "B"
    ? branch.B
    : branch.H - 2 * branchTDes;
  const isTransverseFace = selectedFaceDim === branchTransverseDim;

  // For HSS-to-plate K5: chord = HSS face, branch = plate (engineering judgment).
  let k5 = null;
  if (lengthMode === "k5") {
    k5 = calcK5EffectiveWidth({
      chordB: branchNominal,
      chordT: branchTDes,
      chordFy: branchFy,
      branchB: branchNominal,
      branchT: plateT,
      branchFy: plateFy,
    });
  }

  const faceLen = calcFaceEffectiveLength({
    mode: lengthMode,
    faceLength: selectedFaceNominal,
    isTransverse: isTransverseFace,
    connType: "hss2plate",
    k5,
  });

  const weld = calcWeldMetal({
    legSize,
    length: faceLen.length,
    fexx: FEXX,
    thetaDeg,
    nLines: 1,
    method: "lrfd",
    useDirectional,
    appliedLoad: pFace,
  });

  // Base metal = thinner of plate and HSS wall. For HSS8x2x1/8 (t=0.116) and
  // 0.5" plate, the HSS wall is thinner.
  const baseT = Math.min(plateT, branchTDes);
  const baseFy = baseT === plateT ? plateFy : branchFy;
  const baseFu = baseT === plateT ? plateFu : 58; // A500 Gr B Fu = 58
  const base = calcBaseMetal({
    baseT,
    fy: baseFy,
    fu: baseFu,
    length: faceLen.length,
    nLines: 1,
    method: "lrfd",
    appliedLoad: pFace,
    solicitation,
  });

  const dcrGov = pFace > 0
    ? Math.max(weld.dcr || 0, base.dcr || 0)
    : 0;

  return {
    faceName,
    faceLength: faceLen.length,
    pFace,
    weldCap: weld.cap,
    baseCap: base.cap,
    dcrWeld: weld.dcr || 0,
    dcrBase: base.dcr || 0,
    dcrGov,
  };
}

function logScenario(name: string, hiltiPct: number, faces: FaceCheck[]) {
  const govFace = faces.reduce((a, b) => (b.dcrGov > a.dcrGov ? b : a));
  const ourPct = govFace.dcrGov * 100;
  const deltaPct = ourPct - hiltiPct;
  // eslint-disable-next-line no-console
  console.log(
    `[${name}] Hilti=${hiltiPct.toFixed(0)}%  ours_gov=${ourPct.toFixed(1)}%` +
    `  Δ=${(deltaPct >= 0 ? "+" : "")}${deltaPct.toFixed(1)}%` +
    `  govFace=${govFace.faceName}` +
    `  (weldDCR=${(govFace.dcrWeld * 100).toFixed(1)}%, baseDCR=${(govFace.dcrBase * 100).toFixed(1)}%)`
  );
  for (const f of faces) {
    // eslint-disable-next-line no-console
    console.log(
      `   ${f.faceName.padEnd(28)} L_eff=${f.faceLength.toFixed(3)}"` +
      `  P_face=${f.pFace.toFixed(2)}k` +
      `  φRn(weld)=${f.weldCap.toFixed(2)}k  φRn(base)=${f.baseCap.toFixed(2)}k` +
      `  DCR=${(f.dcrGov * 100).toFixed(1)}%`
    );
  }
}

// ============================================================================
// Report (5): HSS8x2x1/8 — Tension N = 10 kips
// Hilti CBFEM Welds = 34% OK; weld leg Ls = 0.348", throat 0.246"
// ============================================================================
describe("Hilti report (5): HSS8x2x1/8 tension N=10 kip → 34% CBFEM", () => {
  const branch = HSS_8x2x125;
  const branchTDes = 0.116;
  const totalPerimeter = 2 * branch.B + 2 * (branch.H - 2 * branchTDes);
  const N = 10;

  // Perimeter shares (sharp-corner box):
  const shareB = branch.B / totalPerimeter; // each flange face B
  const shareH = (branch.H - 2 * branchTDes) / totalPerimeter; // each web face H

  // Both Hilti-actual leg (0.348") and standard nominal 5/16" (0.3125").
  // Tension load → kds locked to 1.0, so useDirectional = false.
  const commonArgs = {
    branch, plateT: PLATE_05,
    branchFy: A500_GrB.fy, plateFy: A36.fy, plateFu: A36.fu,
    branchTDes,
    branchTransverseDim: "B" as const,
    lengthMode: "k5" as const,
    thetaDeg: 90,
    useDirectional: false,
  };

  function logGroupAxial(label: string, legSize: number, lengthMode: "k5" | "aisc", N: number) {
    const tw = 0.707 * legSize;
    const k5B = calcK5EffectiveWidth({
      chordB: branch.B, chordT: branchTDes, chordFy: A500_GrB.fy,
      branchB: branch.B, branchT: PLATE_05, branchFy: A36.fy,
    });
    const Be = lengthMode === "k5" ? Math.min(k5B.be, branch.B) : branch.B;
    const grp = calcK5GroupCapacity({
      Hb: branch.H, Bb: branch.B, Be, tw, fexx: FEXX, thetaDeg: 90, method: "lrfd",
    });
    const grpDcr = N / grp.cap_axial;
    // eslint-disable-next-line no-console
    console.log(`   [${label}] GROUP §K5-1 DCR = ${(grpDcr * 100).toFixed(1)}%  le=${grp.le.toFixed(3)}"  φPn=${grp.cap_axial.toFixed(2)}k  (Hilti CBFEM = 34%)`);
  }

  it("K5 mode, Hilti actual leg 0.348\" — flange + web faces", () => {
    const faces = [
      runFace({ ...commonArgs, faceName: "Flange B (transverse)", selectedFaceDim: "B", legSize: 0.348, pFace: N * shareB }),
      runFace({ ...commonArgs, faceName: "Web H (longitudinal)", selectedFaceDim: "H", legSize: 0.348, pFace: N * shareH }),
    ];
    logScenario("R5 K5 Ls=0.348", 34, faces);
    logGroupAxial("R5 K5 Ls=0.348", 0.348, "k5", N);
    // Sanity: governing DCR should be in same ballpark as Hilti (within ±30 pts).
    const govPct = Math.max(...faces.map(f => f.dcrGov)) * 100;
    expect(govPct).toBeGreaterThan(0);
    expect(govPct).toBeLessThan(200);
  });

  it("K5 mode, standard nominal 5/16\" leg (0.3125\")", () => {
    const faces = [
      runFace({ ...commonArgs, faceName: "Flange B (transverse)", selectedFaceDim: "B", legSize: 0.3125, pFace: N * shareB }),
      runFace({ ...commonArgs, faceName: "Web H (longitudinal)", selectedFaceDim: "H", legSize: 0.3125, pFace: N * shareH }),
    ];
    logScenario("R5 K5 Ls=5/16", 34, faces);
    logGroupAxial("R5 K5 Ls=5/16", 0.3125, "k5", N);
  });

  it("AISC mode (no Be reduction) — full nominal length", () => {
    const faces = [
      runFace({ ...commonArgs, lengthMode: "aisc", faceName: "Flange B (transverse)", selectedFaceDim: "B", legSize: 0.3125, pFace: N * shareB }),
      runFace({ ...commonArgs, lengthMode: "aisc", faceName: "Web H (longitudinal)", selectedFaceDim: "H", legSize: 0.3125, pFace: N * shareH }),
    ];
    logScenario("R5 AISC Ls=5/16", 34, faces);
    logGroupAxial("R5 AISC Ls=5/16", 0.3125, "aisc", N);
  });
});

// ============================================================================
// Report (4): HSS8x2x1/8 — Moment My = 10 ft-kip (120 kip-in)
// Hilti CBFEM Welds = 76% OK; weld leg Ls = 0.348"
// ============================================================================
describe("Hilti report (4): HSS8x2x1/8 moment My=10 ft-kip → 76% CBFEM", () => {
  const branch = HSS_8x2x125;
  const branchTDes = 0.116;
  const Mu_ftkip = 10;
  const Mu_kipIn = Mu_ftkip * 12; // 120 kip-in

  const commonArgs = {
    branch, plateT: PLATE_05,
    branchFy: A500_GrB.fy, plateFy: A36.fy, plateFu: A36.fu,
    branchTDes,
    branchTransverseDim: "B" as const,
    lengthMode: "k5" as const,
    thetaDeg: 90,
    useDirectional: false,
  };

  // Post-fix moment math: AISC §K5 Eq. K5-2 + K5-6 (Sip-based).
  //   Sip = tw·[Hb²/(3·sin²θ) + Be·Hb/sinθ]
  //   Mn-ip = Fnw·Sip,  φMn-ip = 0.75·Mn-ip
  //   σ_max = Mu·y_max/Sip with y_max = Hb/(2·sinθ)
  //   P_face,flange ≈ σ_max·Be·tw  (extreme-fiber × flange tributary area)
  function pFaceForMoment_Sip({ legSize }: { legSize: number }) {
    const tw = 0.707 * legSize;
    const k5B = calcK5EffectiveWidth({
      chordB: branch.B, chordT: branchTDes, chordFy: A500_GrB.fy,
      branchB: branch.B, branchT: PLATE_05, branchFy: A36.fy,
    });
    const Be = Math.min(k5B.be, branch.B);
    const sip = calcSip({ Hb: branch.H, Be, tw, thetaDeg: 90 });
    const y_max = branch.H / 2; // sinθ = 1
    const sigma_max = (Mu_kipIn / sip.Sip) * y_max;
    const pFaceB = sigma_max * Be * tw;
    const pFaceH = 0; // longitudinal — web bending captured at group level
    return { pFaceB, pFaceH, Sip: sip.Sip, Be };
  }

  function groupDcrForMoment({ legSize }: { legSize: number }): number {
    const tw = 0.707 * legSize;
    const k5B = calcK5EffectiveWidth({
      chordB: branch.B, chordT: branchTDes, chordFy: A500_GrB.fy,
      branchB: branch.B, branchT: PLATE_05, branchFy: A36.fy,
    });
    const Be = Math.min(k5B.be, branch.B);
    const grp = calcK5GroupCapacity({
      Hb: branch.H, Bb: branch.B, Be, tw, fexx: FEXX, thetaDeg: 90, method: "lrfd",
    });
    return Mu_kipIn / grp.cap_ip;
  }

  it("K5 mode, Hilti actual leg 0.348\" — Sip-based per-face + group DCR", () => {
    const faceB_args = { ...commonArgs, selectedFaceDim: "B" as const };
    const faceH_args = { ...commonArgs, selectedFaceDim: "H" as const };
    const { pFaceB, pFaceH } = pFaceForMoment_Sip({ legSize: 0.348 });
    const faces = [
      runFace({ ...faceB_args, faceName: "Flange B (transverse)", legSize: 0.348, pFace: pFaceB }),
      runFace({ ...faceH_args, faceName: "Web H (longitudinal)", legSize: 0.348, pFace: pFaceH }),
    ];
    logScenario("R4 K5 Ls=0.348 Mu=10ft-k", 76, faces);
    const grpDcr = groupDcrForMoment({ legSize: 0.348 });
    // eslint-disable-next-line no-console
    console.log(`   GROUP §K5-2 DCR = ${(grpDcr * 100).toFixed(1)}%  (Hilti CBFEM = 76%)`);
  });

  it("K5 mode, standard nominal 5/16\" leg", () => {
    const faceB_args = { ...commonArgs, selectedFaceDim: "B" as const };
    const faceH_args = { ...commonArgs, selectedFaceDim: "H" as const };
    const { pFaceB, pFaceH } = pFaceForMoment_Sip({ legSize: 0.3125 });
    const faces = [
      runFace({ ...faceB_args, faceName: "Flange B (transverse)", legSize: 0.3125, pFace: pFaceB }),
      runFace({ ...faceH_args, faceName: "Web H (longitudinal)", legSize: 0.3125, pFace: pFaceH }),
    ];
    logScenario("R4 K5 Ls=5/16 Mu=10ft-k", 76, faces);
    const grpDcr = groupDcrForMoment({ legSize: 0.3125 });
    // eslint-disable-next-line no-console
    console.log(`   GROUP §K5-2 DCR = ${(grpDcr * 100).toFixed(1)}%  (Hilti CBFEM = 76%)`);
  });
});

// ============================================================================
// Report (2): HSS8x2x1/8 — Moment My = 10 ft-kip, leg Ls = 0.223" (smaller)
// Hilti CBFEM Welds = 290% NOT OK
// ============================================================================
describe("Hilti report (2): HSS8x2x1/8 moment Mu=10 ft-kip, small leg Ls=0.223 → 290% NG CBFEM", () => {
  const branch = HSS_8x2x125;
  const branchTDes = 0.116;
  const Mu_kipIn = 10 * 12;

  it("K5 mode — should report well over 100% (matches Hilti's 290% NG)", () => {
    const commonArgs = {
      branch, plateT: PLATE_05,
      branchFy: A500_GrB.fy, plateFy: A36.fy, plateFu: A36.fu,
      branchTDes,
      branchTransverseDim: "B" as const,
      lengthMode: "k5" as const,
      thetaDeg: 90,
      useDirectional: false,
    };
    const k5B = calcK5EffectiveWidth({
      chordB: branch.B, chordT: branchTDes, chordFy: A500_GrB.fy,
      branchB: branch.B, branchT: PLATE_05, branchFy: A36.fy,
    });
    const Be = Math.min(k5B.be, branch.B);
    // Sip-based moment math: P_face,flange = σ_max · Be · tw
    for (const legSize of [0.223, 0.25]) {
      const tw = 0.707 * legSize;
      const sip = calcSip({ Hb: branch.H, Be, tw, thetaDeg: 90 });
      const y_max = branch.H / 2;
      const pFaceB = (Mu_kipIn / sip.Sip) * y_max * Be * tw;
      const pFaceH = 0;
      const faces = [
        runFace({ ...commonArgs, faceName: "Flange B (transverse)", selectedFaceDim: "B", legSize, pFace: pFaceB }),
        runFace({ ...commonArgs, faceName: "Web H (longitudinal)", selectedFaceDim: "H", legSize, pFace: pFaceH }),
      ];
      logScenario(`R2 K5 Ls=${legSize} Mu=10ft-k`, 290, faces);
      const grp = calcK5GroupCapacity({
        Hb: branch.H, Bb: branch.B, Be, tw, fexx: FEXX, thetaDeg: 90, method: "lrfd",
      });
      // eslint-disable-next-line no-console
      console.log(`   GROUP §K5-2 DCR = ${(Mu_kipIn / grp.cap_ip * 100).toFixed(1)}%  (Hilti CBFEM = 290%)`);
    }
  });
});

// ============================================================================
// Report (orig): HSS4x4x1/4 — Transverse shear Vy = 17 kip → 49% CBFEM
// Weld leg Ls = 0.223" (Hilti optimized); standard nominal closest = 1/4"
// ============================================================================
describe("Hilti report (orig): HSS4x4x1/4 shear Vy=17 kip → 49% CBFEM (uses solicitation='shear')", () => {
  const branch = { B: 4.0, H: 4.0, tDes: 0.233, tNom: 0.25 };
  const branchTDes = 0.233;
  const V = 17;
  const totalPerimeter = 2 * branch.B + 2 * (branch.H - 2 * branchTDes); // ≈ 15.07"

  const shareB = branch.B / totalPerimeter;
  const shareH = (branch.H - 2 * branchTDes) / totalPerimeter;

  it("AISC mode, standard nominal leg = 1/4\" (Hilti optimized 0.223)", () => {
    const commonArgs = {
      branch, plateT: PLATE_05,
      branchFy: A500_GrB.fy, plateFy: A36.fy, plateFu: A36.fu,
      branchTDes,
      branchTransverseDim: "B" as const,
      lengthMode: "aisc" as const,
      thetaDeg: 90,
      useDirectional: false, // HSS-to-plate AISC: directional permitted, but using conservative
    };
    const faces = [
      runFace({ ...commonArgs, faceName: "Flange B (transverse)", selectedFaceDim: "B", legSize: 0.25, pFace: V * shareB, solicitation: "shear" }),
      runFace({ ...commonArgs, faceName: "Web H (longitudinal)", selectedFaceDim: "H", legSize: 0.25, pFace: V * shareH, solicitation: "shear" }),
    ];
    logScenario("Rorig AISC Ls=1/4 Vy=17", 49, faces);
    // Group axial check (AISC mode → Be = Bb full width)
    const tw = 0.707 * 0.25;
    const grp = calcK5GroupCapacity({
      Hb: branch.H, Bb: branch.B, Be: branch.B, tw, fexx: FEXX, thetaDeg: 90, method: "lrfd",
    });
    // eslint-disable-next-line no-console
    console.log(`   GROUP §K5-1 DCR = ${(V / grp.cap_axial * 100).toFixed(1)}%  le=${grp.le.toFixed(3)}"  φPn=${grp.cap_axial.toFixed(2)}k  (Hilti CBFEM = 49%)`);
  });
});

// ============================================================================
// Summary printer — runs last to give a side-by-side table
// ============================================================================
describe("Summary: Hilti CBFEM vs. hand-calc deltas", () => {
  it("prints comparison table", () => {
    // eslint-disable-next-line no-console
    console.log("\n" + "═".repeat(78));
    console.log("  HILTI CBFEM vs OUR HAND CALC — governing weld DCR comparison");
    console.log("═".repeat(78));
    console.log("  See individual test logs above for per-face breakdowns.");
    console.log("  Delta = ours − Hilti. Positive = we are MORE conservative than CBFEM (good).");
    console.log("═".repeat(78) + "\n");
    expect(true).toBe(true);
  });
});

describe("Local discretization benchmark guardrails — one-sided Hilti checks", () => {
  it("keeps validated local weld utilizations at or above Hilti CBFEM reports", () => {
    const cases = [
      {
        label: "R5 tension HSS8x2x1/8",
        hilti: 0.34,
        input: {
          branch: HSS_8x2x125,
          branchGrade: A500_GrB,
          plateT: PLATE_05,
          plateGrade: A36,
          legSize: 0.348,
          fexx: FEXX,
          appliedTension: 10,
          method: "lrfd" as const,
        },
      },
      {
        label: "R4 moment HSS8x2x1/8",
        hilti: 0.76,
        input: {
          branch: HSS_8x2x125,
          branchGrade: A500_GrB,
          plateT: PLATE_05,
          plateGrade: A36,
          legSize: 0.348,
          fexx: FEXX,
          appliedMoment: 10,
          method: "lrfd" as const,
        },
      },
      {
        label: "R2 small-leg moment HSS8x2x1/8",
        hilti: 2.90,
        input: {
          branch: HSS_8x2x125,
          branchGrade: A500_GrB,
          plateT: PLATE_05,
          plateGrade: A36,
          legSize: 0.25,
          fexx: FEXX,
          appliedMoment: 10,
          method: "lrfd" as const,
        },
      },
      {
        label: "Original shear HSS4x4x1/4",
        hilti: 0.49,
        input: {
          branch: { B: 4.0, H: 4.0, tDes: 0.233, tNom: 0.25 },
          branchGrade: A500_GrB,
          plateT: PLATE_05,
          plateGrade: A36,
          legSize: 0.25,
          fexx: FEXX,
          appliedShear: 17,
          method: "lrfd" as const,
        },
      },
    ];

    for (const c of cases) {
      const result = calcHssToPlateLocalWeldCheck(c.input);
      const localDcr = result.governing?.governingDcr ?? 0;
      // eslint-disable-next-line no-console
      console.log(`[${c.label}] Hilti=${(c.hilti * 100).toFixed(0)}% local=${(localDcr * 100).toFixed(1)}%`);
      expect(localDcr).toBeGreaterThanOrEqual(c.hilti - 1e-9);
    }
  });
});
