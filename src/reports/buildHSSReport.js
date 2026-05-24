import { toFraction, to16ths } from "../math/weldMath";

/**
 * Build the report model for the HSS Connections tab.
 *
 * The HSS tab dispatches the effective-length trace through a complex
 * branch/mode-aware IIFE, so the tab itself passes the already-assembled
 * effective-length check object via `calcs.effLenBlock`.
 */
export function buildHSSReport({ state, calcs, meta, diagramSvgString }) {
  const {
    connType, lengthMode, solicitation,
    branch, branchGrade, chord, chordGrade,
    plateT, plateGrade,
    branchTransverseDim, selectedFaceDim,
    loadCase, angleDeg, legSize, fexx,
    appliedLoad, appliedMoment, pFace, useDirectional, overrideLength, customLength,
  } = state;
  const {
    weld, base, size, governing, faceLen, k5, loa, dCouple,
    effLenBlock,
    fnwEq, fnwRef, designEq, designRef,
    baseT, baseFy, baseFu, baseLabel,
    thetaDeg, effectiveUseDirectional, lockDirectional, lockReason,
    selectedFaceNominal, faceDescription,
  } = calcs;

  const inputs = [
    {
      group: "Connection geometry",
      rows: [
        { label: "Connection type", value: connType === "hss2hss" ? "HSS-to-HSS" : "HSS-to-Plate" },
        { label: "Solicitation type", value: solicitation === "shear" ? "Shear (In-Plane)" : solicitation === "tension" ? "Tension (Out-of-Plane)" : "Moment (In-Plane Flexure)" },
        { label: "Branch HSS", value: branch.name,
          extra: `B = ${branch.B}", H = ${branch.H}", t_des = ${branch.tDes.toFixed(4)}"` },
        ...(connType === "hss2hss" ? [
          { label: "Chord HSS", value: chord.name,
            extra: `B = ${chord.B}", H = ${chord.H}", t_des = ${chord.tDes.toFixed(4)}"` },
        ] : [
          { label: "Plate thickness, tp", value: toFraction(plateT) },
        ]),
        { label: "Branch transverse dim", value: branchTransverseDim },
        { label: "Selected face", value: selectedFaceDim, extra: faceDescription || "" },
        { label: "Effective length method", value: lengthMode === "k5" ? "K5 effective width" : "AISC nominal" },
        ...(overrideLength ? [{ label: "Length override", value: `${customLength}"` }] : []),
      ],
    },
    {
      group: "Materials",
      rows: [
        { label: "Branch grade", value: branchGrade.shortLabel,
          extra: `Fy = ${branchGrade.fy} ksi, Fu = ${branchGrade.fu} ksi` },
        ...(connType === "hss2hss" ? [
          { label: "Chord grade", value: chordGrade.shortLabel,
            extra: `Fy = ${chordGrade.fy} ksi, Fu = ${chordGrade.fu} ksi` },
        ] : [
          { label: "Plate grade", value: plateGrade.shortLabel,
            extra: `Fy = ${plateGrade.fy} ksi, Fu = ${plateGrade.fu} ksi` },
        ]),
        { label: "Governing base metal", value: `${baseLabel}, t = ${baseT.toFixed(4)}"`,
          extra: `Fy = ${baseFy} ksi, Fu = ${baseFu} ksi` },
      ],
    },
    {
      group: "Weld parameters",
      rows: [
        { label: "Leg size, w", value: toFraction(legSize), extra: to16ths(legSize) },
        { label: "Electrode", value: `E${fexx}` },
        { label: "Load case", value: solicitation === "shear" ? loadCase : solicitation, extra: `θ = ${thetaDeg}°` },
        { label: "Directional increase",
          value: effectiveUseDirectional ? "Allowed (1.5×)" : "Suppressed",
          extra: lockDirectional ? `Locked: ${lockReason}` : (useDirectional ? "" : "Manually suppressed") },
      ],
    },
    {
      group: "Applied loads",
      rows: solicitation === "moment" ? [
        { label: "Bending moment, M_u", value: appliedMoment > 0 ? `${appliedMoment.toFixed(2)} ft-kips` : "0 (no demand)" },
        { label: "Couple arm, d_couple", value: `${dCouple?.toFixed(2) ?? "—"} in` },
        { label: "Moment share factor", value: faceLen ? `${(faceLen.length / (faceLen.length + dCouple / 3) * 100).toFixed(1)}%` : "—" },
        { label: "Demand on face, P_face", value: pFace > 0 ? `${pFace.toFixed(2)} kips` : "0 (no demand)" },
      ] : [
        { label: "Total branch load, P_total", value: appliedLoad > 0 ? `${appliedLoad.toFixed(2)} kips` : "0 (no demand)" },
        { label: "Face share factor", value: `${(selectedFaceNominal / (2 * (branch.B + branch.H)) * 100).toFixed(1)}%` },
        { label: "Demand on face, P_face", value: pFace > 0 ? `${pFace.toFixed(2)} kips` : "0 (no demand)" },
      ],
    },
  ];

  const results = [];
  if (faceLen) results.push({
    label: `Effective length on selected face (${selectedFaceDim})`,
    value: `L_eff = ${faceLen.length.toFixed(3)} in (nominal ${selectedFaceNominal} in)`,
  });
  if (weld) results.push({
    label: solicitation === "shear" ? "Weld metal (§J2.4)" : "Weld metal tension (§J2.4)",
    value: `φRn = ${weld.cap.toFixed(2)} kips, DCR = ${weld.dcr !== null ? weld.dcr.toFixed(3) : "—"}`,
    status: weld.status ? (weld.status === "OK" ? "pass" : "fail") : undefined,
  });
  if (base) results.push({
    label: solicitation === "shear" ? `Base metal — ${baseLabel} (§J4.2)` : `Base metal tension — ${baseLabel} (§J4.2)`,
    value: `φRn = ${base.cap.toFixed(2)} kips, DCR = ${base.dcr !== null ? base.dcr.toFixed(3) : "—"}`,
    status: base.status ? (base.status === "OK" ? "pass" : "fail") : undefined,
  });
  if (size) results.push({
    label: "Weld size limits (§J2.2b, Table J2.4)",
    value: `min ${size.minLabel} ≤ w = ${toFraction(legSize)} ≤ max ${size.maxLabel}`,
    status: size.status === "OK" ? "pass" : "fail",
  });
  if (governing && governing.status) results.push({
    label: `Governing strength check — ${governing.which}`,
    value: `φRn = ${governing.cap.toFixed(2)} kips, DCR = ${governing.dcr.toFixed(3)}`,
    status: governing.status === "OK" ? "pass" : "fail",
  });

  const checks = [];

  if (effLenBlock) {
    checks.push({
      title: effLenBlock.title,
      codeRef: effLenBlock.codeRef,
      steps: effLenBlock.traceSteps || [],
      statCards: effLenBlock.statCards || [],
      verdict: { status: null, demand: 0, cap: 0, dcr: null, label: "Effective length determination" },
    });
  }

  if (weld && faceLen) {
    const faceSymbol = selectedFaceDim === "B" ? "B_b" : "H_b";
    const L_eff = faceLen ? faceLen.length : selectedFaceNominal;
    const pFaceStep = solicitation === "moment" ? {
      eq: `P_face = [M·12 / d_couple] · [L_eff / (L_eff + d_couple/3)] = [${appliedMoment.toFixed(2)}·12 / ${dCouple.toFixed(2)}] · [${L_eff.toFixed(3)} / (${L_eff.toFixed(3)} + ${(dCouple/3).toFixed(3)})]`,
      codeRef: "AISC Table K5.1 elastic moment share distribution", value: `${pFace.toFixed(2)} kips`
    } : solicitation === "tension" ? {
      eq: `P_face = P·[${faceSymbol} / 2(B_b+H_b)] = ${appliedLoad.toFixed(2)}·[${selectedFaceNominal} / ${2 * (branch.B + branch.H)}]`,
      codeRef: "Tension force perimeter distribution", value: `${pFace.toFixed(2)} kips`
    } : {
      eq: `P_face = P·[${faceSymbol} / 2(B_b+H_b)] = ${appliedLoad.toFixed(2)}·[${selectedFaceNominal} / ${2 * (branch.B + branch.H)}]`,
      codeRef: "Weld force perimeter distribution", value: `${pFace.toFixed(2)} kips`
    };

    const steps = [
      pFaceStep,
      { eq: "te = 0.707·w", codeRef: "AISC 360-16 §J2.2a", value: `${weld.te.toFixed(4)} in` },
      { eq: `Awe = te·L_eff = ${weld.te.toFixed(4)}·${faceLen.length.toFixed(3)}`,
        codeRef: "AISC 360-16 §J2.4 effective area", value: `${weld.Awe.toFixed(3)} in²` },
      { eq: fnwEq, codeRef: fnwRef, value: `${weld.Fnw.toFixed(2)} ksi` },
    ];
    if (weld.beta < 1.0) {
      steps.push(
        { eq: "β = 1.2 − 0.002·(L/w)",
          codeRef: `AISC §J2.2b Eq. J2-1 long weld reduction (L/w = ${(faceLen.length / legSize).toFixed(1)} > 100)`,
          value: weld.beta.toFixed(3) },
        { eq: "Rn = β·Fnw·Awe", codeRef: "AISC 360-16 §J2.4 nominal capacity (reduced)", value: `${weld.Rn.toFixed(2)} kips` }
      );
    } else {
      steps.push({ eq: "Rn = Fnw·Awe", codeRef: "AISC 360-16 §J2.4 nominal capacity", value: `${weld.Rn.toFixed(2)} kips` });
    }
    steps.push({ eq: designEq, codeRef: designRef, value: `${weld.cap.toFixed(2)} kips` });

    checks.push({
      title: solicitation === "shear" ? "Check 1 — Weld metal shear rupture" : "Check 1 — Weld metal tension rupture",
      codeRef: "AISC 360-16 §J2.4",
      steps,
      statCards: [
        { label: "Nominal Rn", value: `${weld.Rn.toFixed(2)} kips` },
        { label: "φRn (LRFD)", value: `${weld.cap.toFixed(2)} kips` },
        { label: "DCR", value: weld.dcr !== null ? weld.dcr.toFixed(3) : "—" },
      ],
      verdict: weld.status ? {
        status: weld.status, demand: pFace, cap: weld.cap, dcr: weld.dcr,
        label: weld.status === "OK" ? (solicitation === "shear" ? "Weld metal adequate" : "Weld metal tension adequate") : (solicitation === "shear" ? "Weld metal inadequate" : "Weld metal tension inadequate"),
      } : { status: null, demand: 0, cap: weld.cap, dcr: null, label: "No demand entered" },
    });
  }

  if (base && faceLen) {
    const faceSymbol = selectedFaceDim === "B" ? "B_b" : "H_b";
    const L_eff = faceLen ? faceLen.length : selectedFaceNominal;
    const pFaceStep = solicitation === "moment" ? {
      eq: `P_face = [M·12 / d_couple] · [L_eff / (L_eff + d_couple/3)] = [${appliedMoment.toFixed(2)}·12 / ${dCouple.toFixed(2)}] · [${L_eff.toFixed(3)} / (${L_eff.toFixed(3)} + ${(dCouple/3).toFixed(3)})]`,
      codeRef: "AISC Table K5.1 elastic moment share distribution", value: `${pFace.toFixed(2)} kips`
    } : solicitation === "tension" ? {
      eq: `P_face = P·[${faceSymbol} / 2(B_b+H_b)] = ${appliedLoad.toFixed(2)}·[${selectedFaceNominal} / ${2 * (branch.B + branch.H)}]`,
      codeRef: "Tension force perimeter distribution", value: `${pFace.toFixed(2)} kips`
    } : {
      eq: `P_face = P·[${faceSymbol} / 2(B_b+H_b)] = ${appliedLoad.toFixed(2)}·[${selectedFaceNominal} / ${2 * (branch.B + branch.H)}]`,
      codeRef: "Weld force perimeter distribution", value: `${pFace.toFixed(2)} kips`
    };

    checks.push({
      title: solicitation === "shear" ? `Check 2 — Base metal shear (${baseLabel})` : `Check 2 — Base metal tension (${baseLabel})`,
      codeRef: "AISC 360-16 §J4.2",
      steps: [
        pFaceStep,
        { eq: `A = t·L_eff = ${baseT.toFixed(4)}·${faceLen.length.toFixed(3)}`,
          codeRef: solicitation === "shear" ? "AISC 360-16 base shear critical area" : "AISC 360-16 base critical area", value: `${base.A.toFixed(3)} in²` },
        { eq: `Yielding: Rn = 0.60·Fy·A = 0.60·${baseFy}·${base.A.toFixed(3)}`,
          codeRef: "AISC 360-16 Eq. J4-3", value: `${base.RnYield.toFixed(2)} kips` },
        { eq: "φRn (yield) = 1.00·Rn", codeRef: "φ = 1.00", value: `${base.capYield.toFixed(2)} kips` },
        { eq: `Rupture: Rn = 0.60·Fu·A = 0.60·${baseFu}·${base.A.toFixed(3)}`,
          codeRef: "AISC 360-16 Eq. J4-4", value: `${base.RnRupture.toFixed(2)} kips` },
        { eq: "φRn (rupture) = 0.75·Rn", codeRef: "φ = 0.75", value: `${base.capRupture.toFixed(2)} kips` },
        { eq: `Governing: ${base.governs} (lower limit)`,
          codeRef: "min(yield cap, rupture cap)", value: `${base.cap.toFixed(2)} kips` },
      ],
      statCards: [
        { label: `${baseLabel} Fy / Fu`, value: `${baseFy}/${baseFu} ksi` },
        { label: `Governs: ${base.governs}`, value: `${base.cap.toFixed(2)} kips` },
        { label: "DCR", value: base.dcr !== null ? base.dcr.toFixed(3) : "—" },
      ],
      verdict: base.status ? {
        status: base.status, demand: pFace, cap: base.cap, dcr: base.dcr,
        label: base.status === "OK" ? "Base metal adequate" : "Base metal inadequate",
      } : { status: null, demand: 0, cap: base.cap, dcr: null, label: "No demand entered" },
    });
  }

  if (size) {
    checks.push({
      title: "Check 3 — Weld size limits",
      codeRef: "AISC 360-16 §J2.2b, Table J2.4",
      steps: [
        { eq: `Provided: w = ${toFraction(legSize)}`, codeRef: "User selected leg size", value: to16ths(legSize) },
        { eq: `Min for t = ${toFraction(baseT)}: w_min = ${size.minLabel}`,
          codeRef: "AISC 360-16 Table J2.4", value: size.minOk ? "OK" : "NG" },
        { eq: `Max for t = ${toFraction(baseT)}: w_max = ${size.maxLabel}`,
          codeRef: "AISC 360-16 §J2.2b thickness boundary", value: size.maxOk ? "OK" : "NG" },
      ],
      statCards: [
        { label: "Min weld size", value: toFraction(size.minSize) },
        { label: "Max weld size", value: toFraction(size.maxSize) },
        { label: "Provided", value: toFraction(legSize) },
      ],
      verdict: {
        status: size.status, demand: 0, cap: 0, dcr: null,
        label: size.status === "OK"
          ? "Weld size within limits"
          : (!size.minOk ? "Below minimum size limit" : "Exceeds maximum allowable size"),
      },
    });
  }

  const warnings = [];
  if (loa && loa.withinLOA === false && Array.isArray(loa.violations)) {
    for (const v of loa.violations) warnings.push(`LOA: ${v}`);
  }

  const references = [
    "AISC 360-22 §J2.4 — Fillet weld strength; Eq. J2-5 directional strength increase.",
    "AISC 360-22 §J2.2b — Fillet weld size limits and long-weld reduction (Eq. J2-1).",
    "AISC 360-22 §J4.2 — Shear strength of connecting elements: yielding (Eq. J4-3) and rupture (Eq. J4-4).",
    "AISC 360-22 §K5 — HSS-to-HSS connections; effective width Be (Eq. K1-1, Table K5.1).",
    "AISC 360-22 §K5 commentary — kds = 1.0 for HSS branch welds (non-uniform chord-wall stiffness).",
    "AISC 360-22 Table J2.4 — Minimum fillet weld size based on connected part thickness.",
  ];
  const notes = [
    "LRFD basis. The governing check is the minimum of weld-metal and base-metal capacities for the selected face only.",
    "For HSS-to-HSS connections, the directional strength increase (Eq. J2-5) is suppressed per §K5 commentary.",
    "K5 effective width (Be) reduces the weld length on the transverse face when the branch is narrower than the chord.",
    "Limits-of-applicability (LOA) flags are advisory; review the connection geometry against §K5 Table K5.1 limits.",
  ];

  return {
    title: connType === "hss2hss" ? "HSS-to-HSS Connection — Weld Check" : "HSS-to-Plate Connection — Weld Check",
    subtitle: "AISC 360-22 LRFD",
    generatedAt: new Date(),
    meta,
    diagramSvgString,
    inputs,
    results,
    checks,
    warnings,
    references,
    notes,
  };
}
