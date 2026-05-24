import { toFraction, to16ths } from "../math/weldMath";

/**
 * Build the report model for the Standard Shapes tab.
 * `state` carries the raw inputs; `calcs` carries the already-computed
 * weld / base / size / governing objects plus a few derived strings the tab
 * already shows (fnwEq, fnwRef, designEq, designRef, baseLabel, baseT,
 * baseFy, baseFu, thetaDeg).
 */
export function buildStandardShapesReport({ state, calcs, meta, diagramSvgString }) {
  const {
    shape, loadCase, legSize, length, nLines, fexx, appliedLoad,
    useDirectional, memberT, memberGrade, plateT, plateGrade,
  } = state;
  const {
    weld, base, size, governing,
    fnwEq, fnwRef, designEq, designRef,
    baseLabel, baseT, baseFy, baseFu, thetaDeg,
  } = calcs;

  const inputs = [
    {
      group: "Geometry & connection",
      rows: [
        { label: "Connection preset", value: shape && shape.label ? shape.label : "—" },
        { label: "Member thickness", value: toFraction(memberT) },
        { label: "Plate thickness, tp", value: toFraction(plateT) },
      ],
    },
    {
      group: "Materials",
      rows: [
        { label: "Member grade", value: memberGrade ? memberGrade.shortLabel : "—",
          extra: memberGrade ? `Fy = ${memberGrade.fy} ksi, Fu = ${memberGrade.fu} ksi` : "" },
        { label: "Plate grade", value: plateGrade ? plateGrade.shortLabel : "—",
          extra: plateGrade ? `Fy = ${plateGrade.fy} ksi, Fu = ${plateGrade.fu} ksi` : "" },
        { label: "Governing base metal", value: `${baseLabel}, t = ${toFraction(baseT)}`,
          extra: `Fy = ${baseFy} ksi, Fu = ${baseFu} ksi` },
      ],
    },
    {
      group: "Weld parameters",
      rows: [
        { label: "Leg size, w", value: toFraction(legSize), extra: to16ths(legSize) },
        { label: "Electrode", value: `E${fexx}` },
        { label: "Length per line, L", value: `${length} in` },
        { label: "Number of weld lines, n", value: String(nLines) },
        { label: "Load case", value: loadCase, extra: `θ = ${thetaDeg}°` },
        { label: "Directional increase", value: useDirectional ? "Allowed (1.5×)" : "Suppressed" },
      ],
    },
    {
      group: "Applied loads",
      rows: [
        { label: "Demand, P", value: appliedLoad > 0 ? `${appliedLoad.toFixed(2)} kips` : "0 (no demand)" },
      ],
    },
  ];

  const results = [];
  if (weld) results.push({
    label: "Weld metal (§J2.4)",
    value: `φRn = ${weld.cap.toFixed(2)} kips, DCR = ${weld.dcr !== null ? weld.dcr.toFixed(3) : "—"}`,
    status: weld.status ? (weld.status === "OK" ? "pass" : "fail") : undefined,
  });
  if (base) results.push({
    label: `Base metal — ${baseLabel} (§J4.2)`,
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

  if (weld) {
    const steps = [
      { eq: "te = 0.707·w", codeRef: "AISC 360-16 §J2.2a throat definition", value: `${weld.te.toFixed(4)} in` },
      { eq: `Awe = te·L·n = ${weld.te.toFixed(4)}·${length}·${nLines}`,
        codeRef: "AISC 360-16 §J2.4(a) weld total area", value: `${weld.Awe.toFixed(3)} in²` },
      { eq: fnwEq, codeRef: fnwRef, value: `${weld.Fnw.toFixed(2)} ksi` },
    ];
    if (weld.beta < 1.0) {
      steps.push(
        { eq: "β = 1.2 − 0.002·(L/w)",
          codeRef: `AISC §J2.2b Eq. J2-1 long weld reduction (L/w = ${(length / legSize).toFixed(1)} > 100)`,
          value: weld.beta.toFixed(3) },
        { eq: "Rn = β·Fnw·Awe", codeRef: "AISC 360-16 §J2.4 nominal strength (reduced)", value: `${weld.Rn.toFixed(2)} kips` }
      );
    } else {
      steps.push({ eq: "Rn = Fnw·Awe", codeRef: "AISC 360-16 §J2.4 nominal strength", value: `${weld.Rn.toFixed(2)} kips` });
    }
    steps.push({ eq: designEq, codeRef: designRef, value: `${weld.cap.toFixed(2)} kips` });

    checks.push({
      title: "Check 1 — Weld metal shear rupture",
      codeRef: "AISC 360-16 §J2.4",
      steps,
      statCards: [
        { label: "Nominal Rn", value: `${weld.Rn.toFixed(2)} kips` },
        { label: "φRn (LRFD)", value: `${weld.cap.toFixed(2)} kips` },
        { label: "DCR", value: weld.dcr !== null ? weld.dcr.toFixed(3) : "—" },
      ],
      verdict: weld.status ? {
        status: weld.status, demand: appliedLoad, cap: weld.cap, dcr: weld.dcr,
        label: weld.status === "OK" ? "Weld metal adequate" : "Weld metal inadequate",
      } : { status: null, demand: 0, cap: weld.cap, dcr: null, label: "No demand entered" },
    });
  }

  if (base) {
    checks.push({
      title: `Check 2 — Base metal shear (${baseLabel})`,
      codeRef: "AISC 360-16 §J4.2",
      steps: [
        { eq: `A = t·L·n = ${baseT.toFixed(4)}·${length}·${nLines}`,
          codeRef: "AISC 360-16 §J4.2 base shear critical area", value: `${base.A.toFixed(3)} in²` },
        { eq: `Yielding: Rn = 0.60·Fy·A = 0.60·${baseFy}·${base.A.toFixed(3)}`,
          codeRef: "AISC 360-16 §J4.2(a) Eq. J4-3", value: `${base.RnYield.toFixed(2)} kips` },
        { eq: "φRn (yield) = 1.00·Rn", codeRef: "φ = 1.00", value: `${base.capYield.toFixed(2)} kips` },
        { eq: `Rupture: Rn = 0.60·Fu·A = 0.60·${baseFu}·${base.A.toFixed(3)}`,
          codeRef: "AISC 360-16 Eq. J4-4", value: `${base.RnRupture.toFixed(2)} kips` },
        { eq: "φRn (rupture) = 0.75·Rn", codeRef: "φ = 0.75", value: `${base.capRupture.toFixed(2)} kips` },
        { eq: `Governing: ${base.governs} (lower strength)`,
          codeRef: "min(yield cap, rupture cap)", value: `${base.cap.toFixed(2)} kips` },
      ],
      statCards: [
        { label: `${baseLabel} Fy / Fu`, value: `${baseFy} / ${baseFu} ksi` },
        { label: `Governs: ${base.governs}`, value: `${base.cap.toFixed(2)} kips` },
        { label: "DCR", value: base.dcr !== null ? base.dcr.toFixed(3) : "—" },
      ],
      verdict: base.status ? {
        status: base.status, demand: appliedLoad, cap: base.cap, dcr: base.dcr,
        label: base.status === "OK" ? "Base metal adequate" : "Base metal inadequate",
      } : { status: null, demand: 0, cap: base.cap, dcr: null, label: "No demand entered" },
    });
  }

  if (size) {
    checks.push({
      title: "Check 3 — Weld size limits",
      codeRef: "AISC 360-16 §J2.2b, Table J2.4",
      steps: [
        { eq: `Provided: w = ${toFraction(legSize)}`, codeRef: "Selected fillet weld size", value: to16ths(legSize) },
        { eq: `w ≥ w_min (min = ${size.minLabel})`,
          codeRef: `AISC Table J2.4 (t_nom = ${toFraction(baseT)})`, value: size.minOk ? "OK" : "NG" },
        { eq: `w ≤ w_max (max = ${size.maxLabel})`,
          codeRef: `AISC §J2.2b (t_nom = ${toFraction(baseT)})`, value: size.maxOk ? "OK" : "NG" },
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
          : (!size.minOk ? "Below minimum size" : "Exceeds maximum size"),
      },
    });
  }

  const references = [
    "AISC 360-16 §J2.4 — Fillet weld strength; Eq. J2-5 directional strength increase.",
    "AISC 360-16 §J2.2b — Fillet weld size limits and long-weld reduction (Eq. J2-1).",
    "AISC 360-16 §J2.2a — Effective throat of fillet welds (te = 0.707·w).",
    "AISC 360-16 §J4.2 — Strength of elements in shear: yielding (Eq. J4-3) and rupture (Eq. J4-4).",
    "AISC 360-16 Table J2.4 — Minimum fillet weld size based on connected part thickness.",
  ];
  const notes = [
    "LRFD basis. Governing check is the minimum of the weld-metal and base-metal capacities.",
    "Long-weld reduction (β) is applied automatically when L/w > 100.",
    "Directional strength increase per Eq. J2-5 is shown only when the load case is transverse and not suppressed by the user.",
  ];

  return {
    title: "Standard Shapes — Fillet Weld Check",
    subtitle: "AISC 360-16 LRFD",
    generatedAt: new Date(),
    meta,
    diagramSvgString,
    inputs,
    results,
    checks,
    warnings: [],
    references,
    notes,
  };
}
