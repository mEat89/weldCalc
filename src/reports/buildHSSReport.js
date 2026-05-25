import { toFraction, to16ths } from "../math/weldMath";

/**
 * Boundary validator for the report builder.
 *
 * Hard-fails if the tab passes a malformed `calcs` payload. Keeps the PDF
 * from silently rendering `undefined` cells when an upstream refactor forgets
 * to wire a field.
 */
function assertReportInputs({ state, calcs }) {
  if (!state || typeof state !== "object") {
    throw new Error("buildHSSReport: `state` is missing or not an object.");
  }
  if (!calcs || typeof calcs !== "object") {
    throw new Error("buildHSSReport: `calcs` is missing or not an object.");
  }
  const requiredStateKeys = [
    "connType", "lengthMode",
    "branch", "branchGrade", "chord", "chordGrade",
    "branchTransverseDim", "legSize", "fexx",
    "appliedShear", "appliedTension", "appliedMip",
  ];
  const missingState = requiredStateKeys.filter((k) => state[k] === undefined);
  if (missingState.length > 0) {
    throw new Error(`buildHSSReport: state missing required key(s): ${missingState.join(", ")}`);
  }
  if (!calcs.shared) {
    throw new Error("buildHSSReport: calcs.shared is required.");
  }
}

/**
 * Build the report model for the HSS Connections tab.
 *
 * Layout mirrors the new UI:
 *   1. Inputs (connection, materials, weld parameters, applied loads)
 *   2. Final §K4-9 design verdict (auto-aggregated from current loads)
 *   3. Group effective length trace + weld size limits
 *   4. One group-capacity block per non-zero global load
 */
export function buildHSSReport({ state, calcs, meta, diagramSvgString }) {
  assertReportInputs({ state, calcs });
  const {
    connType, lengthMode,
    branch, branchGrade, chord, chordGrade,
    plateT, plateGrade,
    legSize, fexx,
    appliedShear, appliedTension, appliedMip,
  } = state;
  const { shared, shear, tension, ipMoment, k4Unity } = calcs;
  const {
    size, loa,
    effLenBlock,
    baseT, baseFy, baseFu, baseLabel, baseTNominal,
    thetaDeg,
    transverseLen, parallelLen, groupCap,
  } = shared;

  // ----- INPUTS -----
  const inputs = [
    {
      group: "Connection geometry",
      rows: [
        { label: "Connection type", value: connType === "hss2hss" ? "HSS-to-HSS" : "HSS-to-Plate" },
        { label: "Branch HSS", value: branch.name,
          extra: `B = ${branch.B}", H = ${branch.H}", t_des = ${branch.tDes.toFixed(4)}"` },
        ...(connType === "hss2hss" ? [
          { label: "Chord HSS", value: chord.name,
            extra: `B = ${chord.B}", H = ${chord.H}", t_des = ${chord.tDes.toFixed(4)}"` },
        ] : [
          { label: "Plate thickness, tp", value: toFraction(plateT) },
        ]),
        { label: "Weld group dimensions", value: "Automatic AISC mapping",
          extra: `B maps to Be/Bb = ${transverseLen.toFixed(3)} in; H maps to Hb = ${parallelLen.toFixed(3)} in` },
        { label: "Effective length method", value: lengthMode === "k5" ? "K5 effective width" : "AISC nominal" },
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
        { label: "HSS group kds", value: "1.0 (no directional selector)" },
        { label: "Branch angle, θ", value: `${thetaDeg}°` },
      ],
    },
    {
      group: "Applied loads",
      rows: [
        { label: "Shear, V_u",            value: appliedShear   > 0 ? `${appliedShear.toFixed(2)} kips`    : "0 (no demand)" },
        { label: "Tension, N_u",          value: appliedTension > 0 ? `${appliedTension.toFixed(2)} kips`  : "0 (no demand)" },
        { label: connType === "hss2plate" ? "Bending moment, M_u" : "In-plane moment, M_ip", value: appliedMip > 0 ? `${appliedMip.toFixed(2)} ft-kips` : "0 (no demand)" },
      ],
    },
  ];

  // ----- TOP-LEVEL RESULT BULLETS -----
  const results = [];
  if (groupCap) results.push({
    label: "Effective weld-group length",
    value: `le = ${groupCap.le.toFixed(3)} in (Be = ${shared.Be_for_sip.toFixed(3)} in)`,
  });
  for (const [sol, label, unit] of [
    [shear, "Shear (V)", "kips"],
    [tension, "Tension (N)", "kips"],
    [ipMoment, connType === "hss2plate" ? "Bending moment (M)" : "In-plane moment (M_ip)", "kip-in"],
  ]) {
    if (sol && sol.controlling) {
      results.push({
        label: `Group check — ${label}: ${sol.controlling.which}`,
        value: `φ capacity = ${sol.controlling.cap.toFixed(2)} ${unit}, DCR = ${sol.controlling.dcr !== null ? sol.controlling.dcr.toFixed(3) : "—"}`,
        status: sol.controlling.status === "OK" ? "pass" : "fail",
      });
    }
  }
  if (size) results.push({
    label: "Weld size limits (§J2.2b, Table J2.4)",
    value: `min ${size.minLabel} ≤ w = ${toFraction(legSize)} ≤ max ${size.maxLabel}`,
    status: size.status === "OK" ? "pass" : "fail",
  });
  if (k4Unity && k4Unity.hasAnyTerm) {
    results.push({
      label: "Combined loading §K4-9 (auto-aggregated)",
      value: `Unity = ${k4Unity.unity.toFixed(3)} ≤ 1.000 → ${k4Unity.status}`,
      status: k4Unity.status === "OK" ? "pass" : "fail",
    });
  }

  // ----- CHECK BLOCKS -----
  const checks = [];

  // Effective length (once)
  if (effLenBlock) {
    checks.push({
      title: effLenBlock.title,
      codeRef: effLenBlock.codeRef,
      steps: effLenBlock.traceSteps || [],
      statCards: effLenBlock.statCards || [],
      verdict: { status: null, demand: 0, cap: 0, dcr: null, label: "Effective length determination" },
    });
  }

  // Check 3 — weld size limits (shared)
  if (size) {
    checks.push({
      title: "Check 3 — Weld size limits",
      codeRef: "AISC 360-16 §J2.2b, Table J2.4",
      steps: [
        { eq: `Provided: w = ${toFraction(legSize)}`, codeRef: "User selected leg size", value: to16ths(legSize) },
        { eq: `w ≥ w_min (min = ${size.minLabel})`, codeRef: `AISC Table J2.4 (t_nom = ${toFraction(baseTNominal)})`, value: size.minOk ? "OK" : "NG" },
        { eq: `w ≤ w_max (max = ${size.maxLabel})`, codeRef: `AISC §J2.2b (t_nom = ${toFraction(baseTNominal)})`, value: size.maxOk ? "OK" : "NG" },
      ],
      statCards: [
        { label: "Min weld size", value: toFraction(size.minSize) },
        { label: "Max weld size", value: toFraction(size.maxSize) },
        { label: "Provided", value: toFraction(legSize) },
      ],
      verdict: {
        status: size.status, demand: 0, cap: 0, dcr: null,
        label: size.status === "OK" ? "Weld size within limits" : (!size.minOk ? "Below minimum size limit" : "Exceeds maximum allowable size"),
      },
    });
  }

  // Group solicitation block emitter
  function emitForSolicitation(result, solLabel) {
    if (!result) return;
    const { solicitation, load } = result;
    const isMoment = solicitation === "moment";
    if (groupCap) {
      const Pu_or_Mu_kip = isMoment ? load * 12 : load;
      const cap = isMoment ? groupCap.cap_ip : groupCap.cap_axial;
      const nominal = isMoment ? groupCap.Mn_ip : groupCap.Pn_axial;
      const dcr = Pu_or_Mu_kip > 0 && cap > 0 ? Pu_or_Mu_kip / cap : null;
      const statusG = dcr === null ? null : dcr <= 1.0 ? "OK" : "NG";
      checks.push({
        title: isMoment
          ? `${solLabel} — Total group capacity, ${connType === "hss2plate" ? "bending moment" : "in-plane moment"} (§K5-2 / K5-6)`
          : `${solLabel} — Total group capacity, axial (§K5-1 / K5-5)`,
        codeRef: isMoment
          ? "AISC 360-22 §K5 Eq. K5-2: Mn-ip = Fnw · Sip ; Eq. K5-6"
          : "AISC 360-22 §K5 Eq. K5-1: Pn = Fnw · tw · le ; Eq. K5-5",
        steps: isMoment ? [
          { eq: `Sip = tw·[Hb²/(3·sin²θ) + Be·Hb/sinθ]`, codeRef: "AISC §K5 Eq. K5-6 (effective elastic section modulus)", value: `${groupCap.Sip.toFixed(4)} in³` },
          { eq: `  webTerm = tw·Hb²/(3·sin²θ)`, codeRef: "Both webs (parallel longitudinal welds)", value: `${groupCap.terms.webTerm.toFixed(4)} in³` },
          { eq: `  flangeTerm = tw·Be·Hb/sinθ`, codeRef: "Both flanges (transverse welds with Be effective width)", value: `${groupCap.terms.flangeTerm.toFixed(4)} in³` },
          { eq: `Fnw = 0.60·FEXX = 0.60·${fexx}`, codeRef: "AISC §K5: kds = 1.0 for HSS branch welds", value: `${groupCap.Fnw.toFixed(2)} ksi` },
          { eq: `Mn-ip = Fnw · Sip`, codeRef: "AISC §K5 Eq. K5-2", value: `${groupCap.Mn_ip.toFixed(2)} kip-in` },
          { eq: `φMn-ip = 0.75 · Mn-ip`, codeRef: "LRFD φ = 0.75 per §K5(a)", value: `${groupCap.cap_ip.toFixed(2)} kip-in` },
        ] : [
          { eq: `le = 2·Hb/sinθ + 2·Be`, codeRef: "AISC §K5 Eq. K5-5 (total effective weld length around perimeter)", value: `${groupCap.le.toFixed(3)} in` },
          { eq: `Fnw = 0.60·FEXX = 0.60·${fexx}`, codeRef: "AISC §K5: kds = 1.0 for HSS branch welds", value: `${groupCap.Fnw.toFixed(2)} ksi` },
          { eq: `Pn = Fnw · tw · le`, codeRef: "AISC §K5 Eq. K5-1", value: `${groupCap.Pn_axial.toFixed(2)} kips` },
          { eq: `φPn = 0.75 · Pn`, codeRef: "LRFD φ = 0.75 per §K5(a)", value: `${groupCap.cap_axial.toFixed(2)} kips` },
        ],
        statCards: isMoment ? [
          { label: "Mn-ip nominal", value: `${nominal.toFixed(2)} kip-in` },
          { label: "φMn-ip (LRFD)", value: `${cap.toFixed(2)} kip-in` },
          { label: "Demand", value: `${Pu_or_Mu_kip.toFixed(2)} kip-in` },
          { label: "Group DCR", value: dcr !== null ? dcr.toFixed(3) : "—" },
        ] : [
          { label: "Pn nominal", value: `${nominal.toFixed(2)} kips` },
          { label: "φPn (LRFD)", value: `${cap.toFixed(2)} kips` },
          { label: "Demand", value: `${Pu_or_Mu_kip.toFixed(2)} kips` },
          { label: "Group DCR", value: dcr !== null ? dcr.toFixed(3) : "—" },
        ],
        verdict: statusG ? {
          status: statusG, demand: Pu_or_Mu_kip, cap, dcr,
          label: statusG === "OK" ? "Total group capacity adequate" : "Total group capacity exceeded",
        } : { status: null, demand: 0, cap, dcr: null, label: "No demand entered" },
      });
    }
  }

  emitForSolicitation(shear,    "Shear (V)");
  emitForSolicitation(tension,  "Tension (N)");
  emitForSolicitation(ipMoment, connType === "hss2plate" ? "Bending moment (M)" : "In-plane moment (M_ip)");

  // ----- Final §K4-9 unity (auto-aggregated) -----
  if (k4Unity && k4Unity.hasAnyTerm) {
    checks.push({
      title: "Unity Check",
      codeRef: "AISC 360-22 §K4 — Pr/Pc + Mr,ip/Mc,ip ≤ 1.0 (auto-aggregated)",
      steps: [
        {
          eq: connType === "hss2plate"
            ? "Unity = max(Vu/φPn, Nu/φPn) + Mu/φMn"
            : "Unity = max(Vu/φPn, Nu/φPn) + Mip,u/φMn-ip",
          codeRef: "AISC §K4-9 interaction equation",
          value: `${k4Unity.unity.toFixed(3)} ≤ 1.000`,
        },
        { eq: "Axial / shear term: Pr/Pc", codeRef: "Worse active group DCR from current shear/tension inputs", value: k4Unity.terms.axial.toFixed(3) },
        { eq: "In-plane moment term: Mr,ip/Mc,ip", codeRef: "Current in-plane moment group DCR (Mu·12 / φMn-ip)", value: k4Unity.terms.ipMoment.toFixed(3) },
        { eq: "Unity = Σ terms", codeRef: "AISC §K4-9 interaction equation (≤ 1.0)", value: k4Unity.unity.toFixed(3) },
      ],
      statCards: [
        { label: "Unity sum", value: k4Unity.unity.toFixed(3) },
        { label: "Limit", value: "1.000" },
        { label: "Margin", value: (1.0 - k4Unity.unity).toFixed(3) },
      ],
      verdict: {
        status: k4Unity.status, demand: k4Unity.unity, cap: 1.0, dcr: k4Unity.unity,
        label: k4Unity.status === "OK" ? "Final connection check adequate" : "Final connection check exceeds unity (§K4-9)",
      },
    });
  }

  // ----- Warnings + references -----
  const warnings = [];
  if (loa && loa.withinLOA === false && Array.isArray(loa.violations)) {
    for (const v of loa.violations) warnings.push(`LOA: ${v}`);
  }

  const references = [
    "AISC 360-22 §J2.4 — Fillet weld strength.",
    "AISC 360-22 §J2.2b — Fillet weld size limits and long-weld reduction (Eq. J2-1).",
    "AISC 360-22 §J4.1 — Tensile strength of connecting elements: yielding (J4-1) and rupture (J4-2).",
    "AISC 360-22 §J4.2 — Shear strength of connecting elements: yielding (J4-3) and rupture (J4-4).",
    "AISC 360-22 §K5 — HSS-to-HSS connections; Be (Eq. K1-1), le (Eq. K5-5), Sip (Eq. K5-6), Pn (K5-1), Mn-ip (K5-2).",
    "AISC 360-22 §K4 — Interaction Eq. K4-9 (auto-aggregated here).",
    "AISC 360-22 Table J2.4 — Minimum fillet weld size based on connected part thickness.",
  ];
  const notes = [
    "LRFD basis. Each non-zero load runs one total weld-group capacity check; the final §K4-9 verdict aggregates active group DCRs automatically.",
    "kds = 1.0 (no directional selector) is locked for this HSS group workflow per §K5 commentary / Table K5.1 user notes.",
    "K5 effective width (Be) reduces the transverse group width used by the total weld group when K5 mode is selected.",
    "For HSS-to-plate, V, N, and M are interpreted as resultants at the weld group, not member-span end loads. Moment demand is treated as flexural weld-group bending; torsion about the HSS longitudinal axis is not checked.",
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
