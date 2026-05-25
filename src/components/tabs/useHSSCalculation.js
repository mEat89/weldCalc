import {
  HSS_SHAPES,
  STEEL_GRADES,
  LENGTH_METHODS,
} from "../../constants/steelData";
import {
  calcWeldSize,
  calcK5EffectiveWidth,
  calcK5LOA,
  calcSip,
  calcMomentIpCapacity,
  calcK5GroupCapacity,
} from "../../math/weldMath";
import { calcK4Unity } from "../../math/combinedLoading";

/**
 * HSS Connection Calculation Pipeline.
 *
 * Pure derivation from the tab's state inputs — no hooks, no side effects,
 * so unit tests can exercise this directly without rendering React. The tab
 * passes its raw state in and renders the returned object.
 *
 * Shape:
 *   { shared, shear, tension, ipMoment, k4Unity }
 *
 * Each solicitation result is null if its load is zero; otherwise it holds
 * one group-capacity DCR. K4-9 unity is auto-aggregated from those current
 * group DCRs — no face selector, no load-direction selector, no capture step.
 */
export function useHSSCalculation(state) {
  const {
    connType,
    lengthMode,
    branchIdx,
    branchGradeIdx,
    chordIdx,
    chordGradeIdx,
    plateT,
    plateGradeIdx,
    branchTransverseDim,
    legSize,
    fexx,
    appliedShear,
    appliedTension,
    appliedMip,
  } = state;

  const branch = HSS_SHAPES[branchIdx] || HSS_SHAPES[0];
  const chord = HSS_SHAPES[chordIdx] || HSS_SHAPES[0];
  const branchGrade = STEEL_GRADES[branchGradeIdx] || STEEL_GRADES[0];
  const chordGrade = STEEL_GRADES[chordGradeIdx] || STEEL_GRADES[0];
  const plateGrade = STEEL_GRADES[plateGradeIdx] || STEEL_GRADES[0];

  const transverseLen = branchTransverseDim === "B" ? branch.B : branch.H;
  const parallelLen = branchTransverseDim === "B" ? branch.H : branch.B;
  const branchNominal = transverseLen;
  const thetaDeg = 90;
  const totalPerimeter = 2 * branch.B + 2 * (branch.H - 2 * (branch.tDes || 0));

  // ---- §K5 effective width (Be) ----
  let k5 = null;
  let k5Error = null;
  if (connType === "hss2hss") {
    try {
      k5 = calcK5EffectiveWidth({
        chordB: chord.B,
        chordT: chord.tDes,
        chordFy: chordGrade.fy,
        branchB: branchNominal,
        branchT: branch.tDes,
        branchFy: branchGrade.fy,
      });
    } catch (error) { k5Error = error instanceof Error ? error.message : String(error); }
  } else if (connType === "hss2plate" && lengthMode === "k5") {
    try {
      k5 = calcK5EffectiveWidth({
        chordB: branchNominal,
        chordT: branch.tDes,
        chordFy: branchGrade.fy,
        branchB: branchNominal,
        branchT: plateT,
        branchFy: plateGrade.fy,
      });
    } catch (error) { k5Error = error instanceof Error ? error.message : String(error); }
  }

  let loa = null;
  if (connType === "hss2hss") {
    try {
      loa = calcK5LOA({ chord, branch, chordFy: chordGrade.fy, branchFy: branchGrade.fy });
    } catch {
      // LOA warnings are advisory; geometry can still be evaluated.
    }
  }

  // ---- Base metal selection (thinner of plate / HSS wall / chord) ----
  let baseT, baseFy, baseFu, baseLabel;
  if (connType === "hss2plate") {
    if (plateT <= branch.tDes) {
      baseT = plateT; baseFy = plateGrade.fy; baseFu = plateGrade.fu; baseLabel = "Plate (thinner)";
    } else {
      baseT = branch.tDes; baseFy = branchGrade.fy; baseFu = branchGrade.fu; baseLabel = "HSS wall (thinner)";
    }
  } else {
    baseT = chord.tDes; baseFy = chordGrade.fy; baseFu = chordGrade.fu; baseLabel = "Chord wall";
  }
  const baseTNominal = connType === "hss2plate"
    ? Math.min(plateT, branch.tNom)
    : Math.min(chord.tNom, branch.tNom);

  // ---- Weld size limits (shared across solicitations) ----
  let size = null;
  try { size = calcWeldSize({ legSize, baseT: baseTNominal }); } catch {
    // Size errors are surfaced through the absence of the size card.
  }

  // ---- Sip (shared geometry for the moment solicitations) ----
  const tw_throat = 0.707 * legSize;
  const Be_for_sip = (lengthMode === "k5" && k5 && k5.be > 0) ? k5.be : transverseLen;
  let sipResult = null;
  try { sipResult = calcSip({ Hb: parallelLen, Be: Be_for_sip, tw: tw_throat, thetaDeg }); } catch {
    // Group capacity below will surface if Sip cannot be computed.
  }
  let momentCap = null;
  try { if (sipResult) momentCap = calcMomentIpCapacity({ Sip: sipResult.Sip, fexx, method: "lrfd" }); } catch {
    // Moment result stays null when inputs are invalid.
  }

  // ---- §K5 group capacity (axial Pn + in-plane Mn) ----
  let groupCap = null;
  let groupCapError = null;
  try {
    if (Be_for_sip > 0 && tw_throat > 0 && thetaDeg > 0) {
      groupCap = calcK5GroupCapacity({
        Hb: parallelLen, Bb: transverseLen, Be: Be_for_sip, tw: tw_throat, fexx, thetaDeg, method: "lrfd",
      });
    }
  } catch (e) { groupCapError = e instanceof Error ? e.message : String(e); }

  // ---- Group effective length trace block (used in UI + report) ----
  const groupLengthBlock = groupCap ? {
    title: `Group effective length [${LENGTH_METHODS.find((m) => m.id === lengthMode)?.short}]`,
    codeRef: "AISC 360-22 §K5 Eq. K5-5 — full weld group",
    traceSteps: [
      { eq: `Branch width, Bb = ${transverseLen.toFixed(3)} in`, codeRef: "AISC rectangular HSS convention: catalog B maps to Be/Bb", value: `${transverseLen.toFixed(3)} in` },
      { eq: `Branch depth, Hb = ${parallelLen.toFixed(3)} in`, codeRef: "AISC rectangular HSS convention: catalog H maps to bending depth / longitudinal welds", value: `${parallelLen.toFixed(3)} in` },
      ...(k5 ? [
        { eq: `Be = min(Be_raw, Bb) = min(${k5.beRaw.toFixed(3)}, ${transverseLen.toFixed(3)})`, codeRef: connType === "hss2hss" ? "AISC §K5 Eq. K1-1" : "K5 Be engineering-judgment mode for HSS-to-plate", value: `${Be_for_sip.toFixed(3)} in` },
      ] : [
        { eq: `Be = Bb = ${transverseLen.toFixed(3)} in`, codeRef: "Full group width; no K5 Be reduction selected", value: `${Be_for_sip.toFixed(3)} in` },
      ]),
      { eq: `le = 2·Hb/sinθ + 2·Be`, codeRef: "AISC §K5 Eq. K5-5, θ = 90° for perpendicular branch-to-plate/chord", value: `${groupCap.le.toFixed(3)} in` },
    ],
    statCards: [
      { label: "Mode", value: LENGTH_METHODS.find((m) => m.id === lengthMode)?.short ?? "" },
      { label: "Be", value: `${Be_for_sip.toFixed(3)} in` },
      { label: "le", value: `${groupCap.le.toFixed(3)} in` },
    ],
  } : null;

  // ---- Solicitation-aware compute ----
  // Returns null if load <= 0. Otherwise returns full per-solicitation result.
  function computeFor(solicitation, load) {
    if (!load || load <= 0 || !groupCap) return null;

    const isMoment = solicitation === "moment";
    const demand = isMoment ? load * 12 : load;
    const cap = isMoment ? groupCap.cap_ip : groupCap.cap_axial;
    const nominal = isMoment ? groupCap.Mn_ip : groupCap.Pn_axial;
    const dcr = demand / cap;
    const controlling = {
      which: isMoment ? "Total weld group (§K5 Eq. K5-2)" : "Total weld group (§K5 Eq. K5-1)",
      cap,
      nominal,
      capUnit: isMoment ? "kip-in" : "kips",
      demand,
      dcr,
      status: dcr <= 1.0 ? "OK" : "NG",
      source: "group",
    };

    return {
      solicitation, load,
      governing: controlling,
      controlling,
      groupDcr: dcr,
      groupCap,
      calcError: null,
    };
  }

  const shear = computeFor("shear", appliedShear);
  const tension = computeFor("tension", appliedTension);
  const ipMoment = computeFor("moment", appliedMip);
  // K4-9 unity: AISC §K4 interaction.
  // Pr/Pc term = max of shear and tension controlling DCRs (per §K4 the axial
  // term is the connection's axial demand normalized by its axial capacity;
  // when both V and N are present we take the worse active axial check).
  const axialDCR =
    shear && tension
      ? Math.max(shear.controlling?.dcr ?? 0, tension.controlling?.dcr ?? 0)
      : (shear?.controlling?.dcr ?? tension?.controlling?.dcr ?? null);
  const k4 = calcK4Unity({
    axialDCR,
    ipMomentDCR: ipMoment?.controlling?.dcr ?? null,
  });

  const shared = {
    branch, chord, branchGrade, chordGrade, plateGrade,
    transverseLen, parallelLen, branchNominal,
    thetaDeg, totalPerimeter,
    k5, k5Error, loa,
    faceLen: null, faceLenError: null,
    sipResult, momentCap, groupCap, groupCapError, Be_for_sip, tw_throat,
    baseT, baseFy, baseFu, baseLabel, baseTNominal,
    size,
    effLenBlock: groupLengthBlock,
    activeLengthMethods: LENGTH_METHODS,
  };

  return {
    shared,
    shear, tension, ipMoment,
    k4Unity: k4,
  };
}
