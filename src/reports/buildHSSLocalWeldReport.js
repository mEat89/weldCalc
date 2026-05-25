import { toFraction, to16ths } from "../math/weldMath";

function assertReportInputs({ state, calcs }) {
  if (!state || typeof state !== "object") {
    throw new Error("buildHSSLocalWeldReport: `state` is missing or not an object.");
  }
  if (!calcs || typeof calcs !== "object") {
    throw new Error("buildHSSLocalWeldReport: `calcs` is missing or not an object.");
  }
  const requiredStateKeys = [
    "branch", "branchGrade", "plateT", "plateGrade", "legSize", "fexx",
    "appliedShear", "appliedTension", "appliedMip", "analysisMode",
  ];
  const missingState = requiredStateKeys.filter((key) => state[key] === undefined);
  if (missingState.length > 0) {
    throw new Error(`buildHSSLocalWeldReport: state missing required key(s): ${missingState.join(", ")}`);
  }
}

function pct(dcr) {
  return `${(dcr * 100).toFixed(1)}%`;
}

function localLimitStateLabel(limitState) {
  switch (limitState) {
    case "weld-metal":
      return "Weld metal, AISC Section J2.4";
    case "base-tension":
      return "Base metal tension, AISC Section J4.1";
    case "base-shear":
      return "Base metal shear, AISC Section J4.2";
    default:
      return limitState || "—";
  }
}

export function buildHSSLocalWeldReport({ state, calcs, meta, diagramSvgString }) {
  assertReportInputs({ state, calcs });
  const {
    branch, branchGrade, plateT, plateGrade, legSize, fexx,
    appliedShear, appliedShearX, appliedShearY, appliedTension,
    appliedMip, appliedMomentX, appliedMomentY, analysisMode,
  } = state;
  const { local, localError, group } = calcs;
  const governing = local?.governing ?? null;

  const inputs = [
    {
      group: "Connection geometry",
      rows: [
        { label: "Workflow", value: "HSS-to-Plate local weld check" },
        { label: "Selected analysis", value: analysisMode === "local" ? "AISC Manual Part 8 local weld discretization" : "Weld group check AISC Design Guide" },
        { label: "HSS member", value: branch.name || "HSS", extra: `B = ${branch.B}", H = ${branch.H}", t_des = ${branch.tDes.toFixed(4)}"` },
        { label: "Plate thickness, tp", value: toFraction(plateT) },
      ],
    },
    {
      group: "Materials",
      rows: [
        { label: "HSS grade", value: branchGrade.shortLabel || "HSS grade", extra: `Fy = ${branchGrade.fy} ksi, Fu = ${branchGrade.fu} ksi` },
        { label: "Plate grade", value: plateGrade.shortLabel || "Plate grade", extra: `Fy = ${plateGrade.fy} ksi, Fu = ${plateGrade.fu} ksi` },
      ],
    },
    {
      group: "Weld and local model",
      rows: [
        { label: "Leg size, w", value: toFraction(legSize), extra: to16ths(legSize) },
        { label: "Electrode", value: `E${fexx}` },
        { label: "Directional factor", value: "kds = 1.0 locked" },
        { label: "CBFEM-correlated weld factor", value: local ? `${local.correlation.factor.toFixed(3)} (${local.correlation.family})` : "Not computed" },
        { label: "Element mesh", value: local ? `${local.mesh.totalElements} read-only elements` : "Not computed" },
        { label: "Moment local model factor", value: local ? local.modelFactors.moment.toFixed(2) : "—" },
      ],
    },
    {
      group: "Applied loads",
      rows: [
        { label: "Shear resultant, Vu", value: appliedShear > 0 ? `${appliedShear.toFixed(2)} kips` : "0 (no demand)" },
        { label: "Directional shear", value: `Vx = ${(appliedShearX ?? appliedShear ?? 0).toFixed(2)} kips, Vy = ${(appliedShearY ?? 0).toFixed(2)} kips` },
        { label: "Tension, Nu", value: appliedTension > 0 ? `${appliedTension.toFixed(2)} kips` : "0 (no demand)" },
        { label: "Moment resultant, Mu", value: appliedMip > 0 ? `${appliedMip.toFixed(2)} ft-kips` : "0 (no demand)" },
        { label: "Directional moment", value: `Mx = ${(appliedMomentX ?? 0).toFixed(2)} ft-kips, My = ${(appliedMomentY ?? appliedMip ?? 0).toFixed(2)} ft-kips` },
      ],
    },
  ];

  const results = [];
  if (governing) {
    results.push({
      label: `Governing local segment — ${governing.faceLabel} / ${governing.id}`,
      value: `${pct(governing.governingDcr)} (${localLimitStateLabel(governing.governingLimitState)})`,
      status: governing.status === "OK" ? "pass" : "fail",
    });
    results.push({
      label: `CBFEM-correlated weld utilization — ${local.correlation.governingElementId || "n/a"}`,
      value: `${pct(local.correlation.governingDcr)} (${local.correlation.basis})`,
      status: local.correlation.status === "OK" ? "pass" : "fail",
    });
  }
  if (group?.shared?.groupCap) {
    const activeGroupDcrs = [group.shear, group.tension, group.ipMoment]
      .filter(Boolean)
      .map((r) => r.controlling?.dcr ?? 0);
    const groupDcr = activeGroupDcrs.length > 0 ? Math.max(...activeGroupDcrs) : 0;
    results.push({
      label: "Comparison only — global Section K5 group check",
      value: `Max group DCR = ${groupDcr.toFixed(3)}`,
      status: groupDcr <= 1 ? "pass" : "fail",
    });
  }

  const checks = [];
  if (localError) {
    checks.push({
      title: "Local weld calculation error",
      codeRef: "Input validation / deterministic local model",
      steps: [{ eq: "Calculation stopped", codeRef: "No silent errors", value: localError }],
      statCards: [],
      verdict: { status: "NG", demand: 1, cap: 0, dcr: 999, label: "Local weld check could not be completed" },
    });
  }
  if (local) {
    checks.push({
      title: "AISC Manual Part 8 Local Weld Discretization",
      codeRef: "Elastic local weld-group demand with AISC Sections J2.4 and J4 strength",
      steps: local.traceSteps,
      statCards: [
        { label: "Elements", value: String(local.mesh.totalElements) },
        { label: "Be local", value: `${local.section.be.toFixed(3)} in` },
        { label: "Effective perimeter", value: `${local.mesh.totalEffectiveLength.toFixed(3)} in` },
        { label: "Envelope", value: local.validation.envelope },
        { label: "CBFEM-corr. weld", value: local.correlation.governingDcr.toFixed(3) },
      ],
      verdict: governing ? {
        status: governing.status,
        demand: governing.governingDcr * governing.governingCapacity,
        cap: governing.governingCapacity,
        dcr: governing.governingDcr,
        label: governing.status === "OK" ? "Governing local segment adequate" : "Governing local segment exceeds capacity",
      } : { status: null, demand: 0, cap: 0, dcr: null, label: "No local demand" },
    });

    if (local.correlation.warnings.length > 0) {
      checks.push({
        title: "CBFEM Correlation Warning",
        codeRef: "Hilti benchmark interpolation guardrail",
        steps: local.correlation.warnings.map((warning) => ({ eq: "Correlation note", codeRef: local.correlation.basis, value: warning })),
        statCards: [
          { label: "Family", value: local.correlation.family },
          { label: "Factor", value: local.correlation.factor.toFixed(3) },
        ],
        verdict: { status: null, demand: 0, cap: 0, dcr: null, label: "Correlation is informational; code DCR remains governing" },
      });
    }

    for (const face of local.faceSummaries) {
      checks.push({
        title: `Face summary — ${face.faceLabel}`,
        codeRef: "Read-only deterministic local weld elements",
        steps: [
          { eq: "Physical face length", codeRef: "HSS sharp-corner perimeter approximation", value: `${face.physicalLength.toFixed(3)} in` },
          { eq: "Effective local face length", codeRef: face.faceId.includes("flange") ? "Transverse face concentrated to Be" : "Longitudinal face full effective length", value: `${face.effectiveLength.toFixed(3)} in` },
          { eq: "Governing element", codeRef: "Max segment DCR on face", value: face.governingElementId },
        ],
        statCards: [
          { label: "Elements", value: String(face.elementCount) },
          { label: "Max DCR", value: face.maxDcr.toFixed(3) },
          { label: "Average DCR", value: face.averageDcr.toFixed(3) },
        ],
        verdict: {
          status: face.maxDcr <= 1 ? "OK" : "NG",
          demand: face.maxDcr,
          cap: 1,
          dcr: face.maxDcr,
          label: face.maxDcr <= 1 ? "Face local segments adequate" : "Face contains overstressed local segment",
        },
      });
    }
  }

  const warnings = [
    ...(local?.validation?.warnings ?? []),
    ...(local?.correlation?.warnings ?? []),
    "Local weld discretization is a code-based engineering approximation, not a finite-element solver.",
    "The global Section K5 group result is shown for comparison and does not govern this local tab.",
  ];
  const references = [
    "AISC 360-22 Section J2.4 — Fillet weld metal strength; kds = 1.0 for rectangular HSS end tension.",
    "AISC 360-22 Section J4.1 — Base metal tensile yielding and rupture.",
    "AISC 360-22 Section J4.2 — Base metal shear yielding and rupture.",
    "AISC Manual Part 8 — Elastic weld-group mechanics for local/eccentric weld demand distribution.",
    "Steel Tube Institute / Tousignant and Packer research — directional strength increase reliability concerns for rectangular HSS fillet welds.",
  ];
  const notes = [
    "The element count is intentionally read-only. Mesh density is controlled by tested code constants, not by user judgment.",
    "One-sided Hilti benchmark checks are used to prevent validated scenarios from reporting less conservative local utilization than CBFEM.",
    "For geometry outside the benchmark envelope, the report states the limitation rather than claiming universal CBFEM conservatism.",
  ];

  return {
    title: "HSS-to-Plate Local Weld Check",
    subtitle: "AISC 360-22 LRFD + AISC Manual Part 8 local discretization",
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
