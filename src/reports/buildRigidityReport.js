import { toFraction } from "../math/weldMath";

/**
 * Build the report model for the Plate Rigidity tab.
 */
export function buildRigidityReport({ state, calcs, meta, diagramSvgString }) {
  const {
    column, columnOrientation,
    Nplate, Bplate, tp, plateGrade,
    Mu_ftkip, Pu, Vu,
    anchorOffsetY, beff, beffAuto,
    tuMode, tuManual,
  } = state;
  const { tAuto, mB, dg1, verdict, Mu, Tu, x, beffUsed, colDimAlongM } = calcs;

  const inputs = [
    {
      group: "Column (HSS)",
      rows: [
        { label: "Shape", value: column.name,
          extra: `H = ${column.H}", B = ${column.B}", t_des = ${column.tDes.toFixed(4)}"` },
        { label: "Orientation", value: columnOrientation === "H_along_M" ? "H along M" : "B along M",
          extra: `Column dim along M = ${colDimAlongM}"` },
      ],
    },
    {
      group: "Plate geometry & material",
      rows: [
        { label: "Plate length along M, N", value: `${Nplate} in` },
        { label: "Plate width ⊥ to M, B", value: `${Bplate} in` },
        { label: "Plate thickness, tp", value: toFraction(tp) },
        { label: "Plate grade", value: plateGrade.shortLabel,
          extra: `Fy = ${plateGrade.fy} ksi, Fu = ${plateGrade.fu} ksi` },
      ],
    },
    {
      group: "Applied loads",
      rows: [
        { label: "Moment, Mu", value: `${Mu_ftkip.toFixed(2)} ft·kip`, extra: `= ${Mu.toFixed(2)} kip·in` },
        { label: "Axial, Pu", value: `${Pu.toFixed(2)} kip` },
        { label: "Shear, Vu", value: `${Vu.toFixed(2)} kip`, extra: "Informational; not in rigidity check" },
      ],
    },
    {
      group: "Anchor & cantilever",
      rows: [
        { label: "Anchor offset, y", value: `${anchorOffsetY} in` },
        { label: "Cantilever lever, x", value: `${x.toFixed(2)} in`,
          extra: `max(anchorOffsetY − colDim/2, 0) = max(${anchorOffsetY} − ${colDimAlongM}/2, 0)` },
        { label: "Effective bending width, beff", value: `${beffUsed} in`,
          extra: beffAuto ? "Auto-linked to plate B" : "User override" },
      ],
    },
    {
      group: "Anchor tension source",
      rows: [
        { label: "Mode", value: tuMode === "manual" ? "Manual" : "Auto-estimate" },
        { label: "Tu used", value: `${Tu.toFixed(2)} kip`,
          extra: tuMode === "auto" && tAuto
            ? `From Mu/Pu equilibrium; bearing inset = ${tAuto.bearingInset.toFixed(2)} in, lever d = ${tAuto.dLever.toFixed(2)} in${tAuto.noTension ? "; net compression (Tu clipped to 0)" : ""}`
            : (tuMode === "manual" ? `User-supplied = ${tuManual.toFixed(2)} kip` : "") },
      ],
    },
  ];

  const results = [];
  if (mB) results.push({
    label: "Method B — Elastic plate bending",
    value: mB.trivial
      ? "T_u = 0 → trivially OK"
      : `σ_max = ${mB.sigmaMax.toFixed(2)} ksi vs Fy = ${plateGrade.fy} ksi, DCR = ${mB.DCR.toFixed(3)}`,
    status: mB.pass ? "pass" : "fail",
  });
  if (dg1) results.push({
    label: "DG1 §3.4 — Plastic cantilever",
    value: dg1.trivial
      ? "T_u = 0 → trivially OK"
      : `t_req = ${dg1.tReq.toFixed(3)} in vs t_provided = ${tp} in, DCR = ${dg1.DCR.toFixed(3)}`,
    status: dg1.pass ? "pass" : "fail",
  });
  if (verdict) results.push({
    label: "Rigidity verdict",
    value: verdict.verdict,
    // Only NOT RIGID is treated as fail/red. REVIEW stays bold black.
    status: verdict.verdict === "NOT RIGID" ? "fail" : undefined,
  });

  const checks = [];

  if (mB) {
    const steps = mB.trivial ? [
      { eq: "T_u = 0 → no tension demand", codeRef: "Skipped — no anchor tension", value: "trivially OK" },
    ] : [
      { eq: "σ_max = 6 · T_u · x / (b_eff · t_p²)",
        codeRef: "Elastic bending stress at column face boundary",
        value: `${mB.sigmaMax.toFixed(2)} ksi` },
      { eq: `     = 6 · ${Tu.toFixed(2)} · ${x.toFixed(2)} / (${beffUsed} · ${tp}²)`,
        codeRef: "Substituted metrics",
        value: `${mB.sigmaMax.toFixed(2)} ksi` },
      { eq: `vs F_yp = ${plateGrade.fy} ksi`, codeRef: "Plate material yield strength",
        value: `DCR = ${mB.DCR.toFixed(3)}` },
      { eq: "t_req (elastic) = √(6·Tu·x / (beff·Fy))", codeRef: "Solving stress equation for thickness",
        value: `${mB.tReq.toFixed(3)} in` },
    ];
    checks.push({
      title: "Check 1 — Method B: Elastic Plate Bending",
      codeRef: "σ_max = 6·Tu·x / (b_eff·t²) ≤ Fy",
      steps,
      statCards: [
        { label: "σ_max", value: mB.trivial ? "—" : `${mB.sigmaMax.toFixed(1)} ksi` },
        { label: "F_yp", value: `${plateGrade.fy} ksi` },
        { label: "DCR (σ/Fy)", value: mB.trivial ? "—" : mB.DCR.toFixed(3) },
      ],
      verdict: {
        status: mB.pass ? "OK" : "NG",
        demand: mB.sigmaMax,
        cap: plateGrade.fy,
        dcr: mB.DCR,
        label: mB.pass
          ? "Plate stays elastic under Tu — supports rigid-plate kinematic assumption"
          : "Plate yields locally under Tu — rigid-plate assumption violated",
      },
    });
  }

  if (dg1) {
    const steps = dg1.trivial ? [
      { eq: "T_u = 0 → no tension demand", codeRef: "Skipped — no anchor tension", value: "trivially OK" },
    ] : [
      { eq: "t_req = √(4 · T_u · x / (φ · F_yp · b_eff))",
        codeRef: "DG1 §3.4 plastic moment unit width, φ=0.9",
        value: `${dg1.tReq.toFixed(3)} in` },
      { eq: `     = √(4 · ${Tu.toFixed(2)} · ${x.toFixed(2)} / (0.9 · ${plateGrade.fy} · ${beffUsed}))`,
        codeRef: "Substituted design metrics",
        value: `${dg1.tReq.toFixed(3)} in` },
      { eq: `t_provided = ${tp} in`, codeRef: "Provided plate thickness", value: `${tp} in` },
    ];
    checks.push({
      title: "Check 2 — AISC DG1 §3.4 Plastic Cantilever",
      codeRef: "AISC Eq. 3.4.7 form: t ≥ √(4·Tu·x / (φ·Fy·beff))",
      steps,
      statCards: [
        { label: "t_req (DG1)", value: dg1.trivial ? "—" : `${dg1.tReq.toFixed(3)} in` },
        { label: "t_provided", value: `${tp} in` },
        { label: "DCR", value: dg1.trivial ? "—" : dg1.DCR.toFixed(3) },
      ],
      verdict: {
        status: dg1.pass ? "OK" : "NG",
        demand: dg1.tReq,
        cap: tp,
        dcr: dg1.DCR,
        label: dg1.pass
          ? "Plate adequate per DG1 §3.4 limits"
          : "Plate fails DG1 §3.4 — base plate yields plastically, not rigid",
      },
    });
  }

  const warnings = [];
  if (verdict && verdict.verdict === "REVIEW") {
    warnings.push(`Rigidity verdict: REVIEW — ${verdict.note}`);
  }

  const references = [
    "AISC Design Guide 1 (DG1) §3.4 — Base plate design for moment connections; plastic cantilever model.",
    "Method B — Elastic plate bending check: σ_max = 6·Tu·x / (b_eff·t²) ≤ Fy.",
    "AISC 360 §F11 — Rectangular plate bending (background for elastic / plastic moment derivations).",
  ];
  const notes = [
    "Method B (elastic check) asks for ~16% more thickness than DG1's plastic design limit.",
    "If Method B yields, rigid-base-plate reactions assumed in hand calculations are unconservative — use stiffeners or a thicker plate.",
    "Tu is taken from the auto-estimate (Mu/Pu equilibrium) unless the user provides a manual override.",
    "Shear Vu is shown for completeness; it does not enter the rigidity check.",
  ];

  return {
    title: "Base Plate Rigidity Check",
    subtitle: "AISC Design Guide 1 + elastic plate bending",
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
