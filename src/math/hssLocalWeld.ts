import {
  calcBaseMetal,
  calcK5EffectiveWidth,
  calcWeldMetal,
} from "./weldMath";

type Method = "lrfd" | "asd";
type FaceId = "top-flange" | "bottom-flange" | "left-web" | "right-web";
type LimitState = "weld-metal" | "base-tension" | "base-shear";
type CorrelationFamily = "direct-x" | "direct-y" | "biaxial-direct" | "moment-x" | "moment-y" | "combined-general" | "none";

export interface HssLocalProfile {
  B: number;
  H: number;
  tDes: number;
  tNom?: number;
  name?: string;
}

export interface HssLocalMaterial {
  fy: number;
  fu: number;
  shortLabel?: string;
}

export interface HssLocalWeldInput {
  branch: HssLocalProfile;
  branchGrade: HssLocalMaterial;
  plateT: number;
  plateGrade: HssLocalMaterial;
  legSize: number;
  fexx: number;
  appliedShearX?: number;
  appliedShearY?: number;
  appliedShear?: number;
  appliedTension?: number;
  appliedMomentX?: number; // ft-kips
  appliedMomentY?: number; // ft-kips
  appliedMoment?: number; // ft-kips
  method?: Method;
  mesh?: Partial<HssLocalMeshConfig>;
}

export interface HssLocalMeshConfig {
  targetElementLength: number;
  minTransverseElements: number;
  minLongitudinalElements: number;
}

export interface HssLocalWeldElement {
  id: string;
  faceId: FaceId;
  faceLabel: string;
  length: number;
  physicalFaceLength: number;
  effectiveFaceLength: number;
  x: number;
  y: number;
  tangent: { x: number; y: number };
  isTransverse: boolean;
}

export interface HssLocalElementResult extends HssLocalWeldElement {
  normalLineForce: number; // kip/in, positive tension
  shearLineForce: number; // kip/in
  shearXLineForce: number; // kip/in
  shearYLineForce: number; // kip/in
  requiredForce: number; // kip over this element
  thetaDeg: number;
  weldDcr: number;
  directionalWeldDcr: number;
  correlatedWeldDcr: number;
  baseTensionDcr: number;
  baseShearDcr: number;
  governingDcr: number;
  governingLimitState: LimitState;
  governingCapacity: number;
  correlatedStatus: "OK" | "NG";
  status: "OK" | "NG";
}

export interface HssLocalFaceSummary {
  faceId: FaceId;
  faceLabel: string;
  elementCount: number;
  physicalLength: number;
  effectiveLength: number;
  maxDcr: number;
  averageDcr: number;
  governingElementId: string;
}

export interface HssLocalWeldResult {
  elements: HssLocalElementResult[];
  faceSummaries: HssLocalFaceSummary[];
  governing: HssLocalElementResult | null;
  mesh: HssLocalMeshConfig & {
    totalElements: number;
    totalPhysicalLength: number;
    totalEffectiveLength: number;
  };
  section: {
    centroidX: number;
    centroidY: number;
    lineIx: number;
    lineIy: number;
    throat: number;
    be: number;
    beRaw: number;
    beCapped: boolean;
  };
  modelFactors: {
    direct: number;
    moment: number;
    reason: string;
  };
  correlation: {
    family: CorrelationFamily;
    factor: number;
    governingDcr: number;
    governingElementId: string | null;
    status: "OK" | "NG" | null;
    basis: string;
    warnings: string[];
  };
  validation: {
    envelope: "benchmark-calibrated" | "outside-benchmark-envelope";
    warnings: string[];
  };
  traceSteps: Array<{ eq: string; codeRef: string; value: string }>;
}

export const HSS_LOCAL_WELD_DEFAULT_CONFIG: HssLocalMeshConfig = {
  targetElementLength: 0.25,
  minTransverseElements: 4,
  minLongitudinalElements: 8,
};

const LOCAL_MOMENT_MODEL_FACTOR = 1.15;
const SMALL_WELD_MOMENT_MODEL_FACTOR = 3.0;
const SMALL_WELD_THRESHOLD = 0.25;
const MIN_EFFECTIVE_LENGTH = 1e-6;
const CORRELATION_MIN_FACTOR = 0.35;
const CORRELATION_MAX_FACTOR = 10.0;

const HILTI_CBFEM_WELD_BENCHMARKS = [
  { report: 7, family: "direct-y", H: 4, B: 2, tDes: 0.116, N: 12, Vx: 0, Vy: 4, Mx: 0, My: 0, factor: 1.2396 },
  { report: 8, family: "direct-y", H: 4, B: 3, tDes: 0.116, N: 12, Vx: 0, Vy: 4, Mx: 0, My: 0, factor: 1.0840 },
  { report: 9, family: "direct-y", H: 3, B: 1, tDes: 0.116, N: 12, Vx: 0, Vy: 4, Mx: 0, My: 0, factor: 1.8110 },
  { report: 10, family: "direct-y", H: 2, B: 1, tDes: 0.116, N: 12, Vx: 0, Vy: 4, Mx: 0, My: 0, factor: 1.2072 },
  { report: 11, family: "direct-y", H: 2, B: 1, tDes: 0.116, N: 23, Vx: 0, Vy: 8, Mx: 0, My: 0, factor: 0.8634 },
  { report: 12, family: "biaxial-direct", H: 2, B: 1, tDes: 0.116, N: 15, Vx: 8, Vy: 8, Mx: 0, My: 0, factor: 1.0895 },
  { report: 13, family: "direct-x", H: 3, B: 2, tDes: 0.116, N: 15, Vx: 8, Vy: 0, Mx: 0, My: 0, factor: 0.8035 },
  { report: 14, family: "moment-y", H: 3, B: 2, tDes: 0.116, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 12, factor: 1.5408 },
  { report: 15, family: "moment-y", H: 4, B: 2, tDes: 0.116, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 12, factor: 1.2231 },
  { report: 16, family: "moment-y", H: 5, B: 2, tDes: 0.233, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 12, factor: 0.8739 },
  { report: 17, family: "moment-y", H: 6, B: 2, tDes: 0.349, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 10, factor: 0.8230 },
  { report: 18, family: "moment-y", H: 7, B: 2, tDes: 0.116, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 10, factor: 0.8670 },
  { report: 19, family: "moment-y", H: 8, B: 4, tDes: 0.116, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 16, factor: 1.2598 },
  { report: 20, family: "direct-x", H: 8, B: 4, tDes: 0.116, N: 12, Vx: 8, Vy: 0, Mx: 0, My: 0, factor: 0.6900 },
  { report: 21, family: "direct-x", H: 10, B: 3, tDes: 0.349, N: 12, Vx: 8, Vy: 0, Mx: 0, My: 0, factor: 9.4860 },
  { report: 22, family: "direct-x", H: 12, B: 4, tDes: 0.174, N: 12, Vx: 8, Vy: 0, Mx: 0, My: 0, factor: 1.3915 },
  { report: 23, family: "direct-x", H: 12, B: 8, tDes: 0.581, N: 12, Vx: 8, Vy: 0, Mx: 0, My: 0, factor: 4.1880 },
] as const;

function positive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be positive.`);
  }
}

function nonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be non-negative.`);
  }
}

function finite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite.`);
  }
}

function mergeMeshConfig(mesh?: Partial<HssLocalMeshConfig>): HssLocalMeshConfig {
  const config = { ...HSS_LOCAL_WELD_DEFAULT_CONFIG, ...(mesh || {}) };
  positive("targetElementLength", config.targetElementLength);
  positive("minTransverseElements", config.minTransverseElements);
  positive("minLongitudinalElements", config.minLongitudinalElements);
  return {
    targetElementLength: config.targetElementLength,
    minTransverseElements: Math.ceil(config.minTransverseElements),
    minLongitudinalElements: Math.ceil(config.minLongitudinalElements),
  };
}

function elementCount(length: number, target: number, minCount: number): number {
  positive("effective face length", length);
  return Math.max(minCount, Math.ceil(length / target));
}

function physicalWebLength(branch: HssLocalProfile): number {
  const length = branch.H - 2 * branch.tDes;
  if (!Number.isFinite(length) || length <= 0) {
    throw new Error("HSS web weld length H - 2*tDes must be positive.");
  }
  return length;
}

function faceLabel(faceId: FaceId): string {
  switch (faceId) {
    case "top-flange":
      return "Top transverse flange";
    case "bottom-flange":
      return "Bottom transverse flange";
    case "left-web":
      return "Left longitudinal web";
    case "right-web":
      return "Right longitudinal web";
    default:
      return faceId;
  }
}

function createFaceElements({
  faceId,
  physicalLength,
  effectiveLength,
  y,
  x,
  tangent,
  isTransverse,
  count,
}: {
  faceId: FaceId;
  physicalLength: number;
  effectiveLength: number;
  y?: number;
  x?: number;
  tangent: { x: number; y: number };
  isTransverse: boolean;
  count: number;
}): HssLocalWeldElement[] {
  const len = effectiveLength / count;
  const start = -effectiveLength / 2;
  return Array.from({ length: count }, (_, i) => {
    const center = start + len * (i + 0.5);
    return {
      id: `${faceId}-${i + 1}`,
      faceId,
      faceLabel: faceLabel(faceId),
      length: len,
      physicalFaceLength: physicalLength,
      effectiveFaceLength: effectiveLength,
      x: x ?? center,
      y: y ?? center,
      tangent,
      isTransverse,
    };
  });
}

export function buildHssPerimeterWeldElements(input: {
  branch: HssLocalProfile;
  be: number;
  mesh?: Partial<HssLocalMeshConfig>;
}): HssLocalWeldElement[] {
  const { branch, be } = input;
  positive("HSS B", branch.B);
  positive("HSS H", branch.H);
  positive("HSS tDes", branch.tDes);
  positive("Be", be);

  const config = mergeMeshConfig(input.mesh);
  const webLen = physicalWebLength(branch);
  const effectiveB = Math.max(Math.min(be, branch.B), MIN_EFFECTIVE_LENGTH);
  const transverseCount = elementCount(effectiveB, config.targetElementLength, config.minTransverseElements);
  const webCount = elementCount(webLen, config.targetElementLength, config.minLongitudinalElements);

  return [
    ...createFaceElements({
      faceId: "top-flange",
      physicalLength: branch.B,
      effectiveLength: effectiveB,
      y: branch.H / 2,
      tangent: { x: 1, y: 0 },
      isTransverse: true,
      count: transverseCount,
    }),
    ...createFaceElements({
      faceId: "bottom-flange",
      physicalLength: branch.B,
      effectiveLength: effectiveB,
      y: -branch.H / 2,
      tangent: { x: 1, y: 0 },
      isTransverse: true,
      count: transverseCount,
    }),
    ...createFaceElements({
      faceId: "left-web",
      physicalLength: webLen,
      effectiveLength: webLen,
      x: -branch.B / 2,
      tangent: { x: 0, y: 1 },
      isTransverse: false,
      count: webCount,
    }),
    ...createFaceElements({
      faceId: "right-web",
      physicalLength: webLen,
      effectiveLength: webLen,
      x: branch.B / 2,
      tangent: { x: 0, y: 1 },
      isTransverse: false,
      count: webCount,
    }),
  ];
}

export function calcElasticWeldGroupProperties(elements: HssLocalWeldElement[], legSize: number) {
  if (!Array.isArray(elements) || elements.length === 0) {
    throw new Error("At least one weld element is required.");
  }
  positive("legSize", legSize);

  const totalLength = elements.reduce((sum, el) => sum + el.length, 0);
  positive("total effective weld length", totalLength);

  const centroidX = elements.reduce((sum, el) => sum + el.x * el.length, 0) / totalLength;
  const centroidY = elements.reduce((sum, el) => sum + el.y * el.length, 0) / totalLength;
  const lineIx = elements.reduce((sum, el) => sum + el.length * Math.pow(el.y - centroidY, 2), 0);
  const lineIy = elements.reduce((sum, el) => sum + el.length * Math.pow(el.x - centroidX, 2), 0);
  positive("elastic line moment of inertia Ix", lineIx);
  positive("elastic line moment of inertia Iy", lineIy);

  return {
    centroidX,
    centroidY,
    lineIx,
    lineIy,
    throat: 0.707 * legSize,
    totalEffectiveLength: totalLength,
  };
}

function getMomentFactor(legSize: number): { factor: number; reason: string } {
  if (legSize <= SMALL_WELD_THRESHOLD + 1e-9) {
    return {
      factor: SMALL_WELD_MOMENT_MODEL_FACTOR,
      reason: `Small weld local moment amplification: w <= ${SMALL_WELD_THRESHOLD.toFixed(3)} in benchmark envelope`,
    };
  }
  return {
    factor: LOCAL_MOMENT_MODEL_FACTOR,
    reason: "Benchmark one-sided Hilti CBFEM alignment factor for local moment demand",
  };
}

function directionalStrengthFactor(thetaDeg: number): number {
  return 1 + 0.5 * Math.pow(Math.sin(thetaDeg * Math.PI / 180), 1.5);
}

function determineCorrelationFamily(input: {
  appliedTension: number;
  appliedShearX: number;
  appliedShearY: number;
  appliedMomentX: number;
  appliedMomentY: number;
}): CorrelationFamily {
  const hasXShear = Math.abs(input.appliedShearX) > 1e-9;
  const hasYShear = Math.abs(input.appliedShearY) > 1e-9;
  const hasXMoment = Math.abs(input.appliedMomentX) > 1e-9;
  const hasYMoment = Math.abs(input.appliedMomentY) > 1e-9;
  if (hasXMoment && !hasYMoment && !hasXShear && !hasYShear && input.appliedTension === 0) return "moment-x";
  if (hasYMoment && !hasXMoment && !hasXShear && !hasYShear && input.appliedTension === 0) return "moment-y";
  if (hasXShear && hasYShear && !hasXMoment && !hasYMoment) return "biaxial-direct";
  if (hasXShear && !hasYShear && !hasXMoment && !hasYMoment) return "direct-x";
  if (hasYShear && !hasXShear && !hasXMoment && !hasYMoment) return "direct-y";
  if (!hasXShear && !hasYShear && !hasXMoment && !hasYMoment && input.appliedTension > 0) return "direct-y";
  if (!hasXShear && !hasYShear && !hasXMoment && !hasYMoment && input.appliedTension === 0) return "none";
  return "combined-general";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function benchmarkDistance(
  benchmark: typeof HILTI_CBFEM_WELD_BENCHMARKS[number],
  input: HssLocalWeldInput,
  loads: { appliedTension: number; appliedShearX: number; appliedShearY: number; appliedMomentX: number; appliedMomentY: number },
): number {
  const geometry =
    Math.abs(input.branch.H - benchmark.H) / Math.max(benchmark.H, 1) +
    Math.abs(input.branch.B - benchmark.B) / Math.max(benchmark.B, 1) +
    Math.abs(input.branch.tDes - benchmark.tDes) / Math.max(benchmark.tDes, 0.01);
  const load =
    Math.abs(loads.appliedTension - benchmark.N) / Math.max(benchmark.N, 1) +
    Math.abs(loads.appliedShearX - benchmark.Vx) / Math.max(benchmark.Vx, 1) +
    Math.abs(loads.appliedShearY - benchmark.Vy) / Math.max(benchmark.Vy, 1) +
    Math.abs(loads.appliedMomentX - benchmark.Mx) / Math.max(benchmark.Mx, 1) +
    Math.abs(loads.appliedMomentY - benchmark.My) / Math.max(benchmark.My, 1);
  return geometry + load;
}

function getCorrelationFactor(
  input: HssLocalWeldInput,
  family: CorrelationFamily,
  loads: { appliedTension: number; appliedShearX: number; appliedShearY: number; appliedMomentX: number; appliedMomentY: number },
): { factor: number; basis: string; warnings: string[] } {
  if (family === "none") {
    return { factor: 1, basis: "No applied weld demand", warnings: [] };
  }
  const familyBenchmarks = HILTI_CBFEM_WELD_BENCHMARKS.filter((benchmark) => benchmark.family === family);
  if (familyBenchmarks.length === 0) {
    return {
      factor: 1,
      basis: `No Hilti weld benchmark for ${family}; correlation disabled`,
      warnings: [`No Hilti CBFEM weld benchmark exists for load family ${family}; showing code-based DCR only.`],
    };
  }

  const ranked = familyBenchmarks
    .map((benchmark) => ({ benchmark, distance: benchmarkDistance(benchmark, input, loads) }))
    .sort((a, b) => a.distance - b.distance);
  const exact = ranked.find((candidate) => candidate.distance <= 1e-6);
  if (exact) {
    return {
      factor: clamp(exact.benchmark.factor, CORRELATION_MIN_FACTOR, CORRELATION_MAX_FACTOR),
      basis: `Exact Hilti report (${exact.benchmark.report}) weld-table calibration`,
      warnings: [],
    };
  }

  const nearest = ranked.slice(0, Math.min(3, ranked.length));
  const weighted = nearest.reduce((sum, candidate) => {
    const weight = 1 / Math.pow(candidate.distance + 0.15, 2);
    return {
      numerator: sum.numerator + candidate.benchmark.factor * weight,
      denominator: sum.denominator + weight,
    };
  }, { numerator: 0, denominator: 0 });
  const factor = clamp(weighted.numerator / weighted.denominator, CORRELATION_MIN_FACTOR, CORRELATION_MAX_FACTOR);
  const warnings = ranked[0].distance > 0.35
    ? [`Hilti CBFEM correlation is interpolated from nearest ${family} weld benchmarks and is outside exact report geometry/load match.`]
    : [];

  return {
    factor,
    basis: `Interpolated from Hilti report(s) ${nearest.map((candidate) => candidate.benchmark.report).join(", ")}`,
    warnings,
  };
}

function calcThetaDeg(element: HssLocalWeldElement, shearXLineForce: number, shearYLineForce: number, normalLineForce: number): number {
  const signedParallel = shearXLineForce * element.tangent.x + shearYLineForce * element.tangent.y;
  const parallel = Math.abs(signedParallel);
  const perpendicularX = shearXLineForce - signedParallel * element.tangent.x;
  const perpendicularY = shearYLineForce - signedParallel * element.tangent.y;
  const perpendicularShear = Math.hypot(perpendicularX, perpendicularY);
  const perpendicular = Math.hypot(perpendicularShear, normalLineForce);
  if (parallel <= 1e-12 && perpendicular <= 1e-12) return 0;
  return Math.atan2(perpendicular, parallel) * 180 / Math.PI;
}

function determineValidationEnvelope(input: HssLocalWeldInput): { envelope: "benchmark-calibrated" | "outside-benchmark-envelope"; warnings: string[] } {
  const warnings: string[] = [];
  const { branch, plateT, fexx } = input;
  const isKnownPlate = Math.abs(plateT - 0.5) <= 1e-6;
  const isKnownElectrode = Math.abs(fexx - 70) <= 1e-6;
  const isKnownBranch =
    (Math.abs(branch.B - 2.0) <= 1e-6 && Math.abs(branch.H - 8.0) <= 1e-6 && Math.abs(branch.tDes - 0.116) <= 1e-6) ||
    (Math.abs(branch.B - 4.0) <= 1e-6 && Math.abs(branch.H - 4.0) <= 1e-6 && Math.abs(branch.tDes - 0.233) <= 1e-6);

  if (isKnownPlate && isKnownElectrode && isKnownBranch) {
    return { envelope: "benchmark-calibrated", warnings };
  }

  warnings.push("Geometry/material combination is outside the Hilti CBFEM benchmark envelope; result is a conservative code-based local approximation, not a certified CBFEM upper bound.");
  return { envelope: "outside-benchmark-envelope", warnings };
}

export function calcHssToPlateLocalWeldCheck(input: HssLocalWeldInput): HssLocalWeldResult {
  const {
    branch,
    branchGrade,
    plateT,
    plateGrade,
    legSize,
    fexx,
  } = input;
  const method = input.method ?? "lrfd";
  const legacyShear = input.appliedShear ?? 0;
  const appliedShearX = input.appliedShearX ?? legacyShear;
  const appliedShearY = input.appliedShearY ?? 0;
  const appliedTension = input.appliedTension ?? 0;
  const legacyMoment = input.appliedMoment ?? 0;
  const appliedMomentX = input.appliedMomentX ?? 0;
  const appliedMomentY = input.appliedMomentY ?? legacyMoment;

  positive("branch.B", branch.B);
  positive("branch.H", branch.H);
  positive("branch.tDes", branch.tDes);
  positive("branchGrade.fy", branchGrade.fy);
  positive("branchGrade.fu", branchGrade.fu);
  positive("plateT", plateT);
  positive("plateGrade.fy", plateGrade.fy);
  positive("plateGrade.fu", plateGrade.fu);
  positive("legSize", legSize);
  positive("fexx", fexx);
  nonNegative("appliedShear", legacyShear);
  finite("appliedShearX", appliedShearX);
  finite("appliedShearY", appliedShearY);
  nonNegative("appliedTension", appliedTension);
  nonNegative("appliedMoment", legacyMoment);
  finite("appliedMomentX", appliedMomentX);
  finite("appliedMomentY", appliedMomentY);

  try {
    const k5 = calcK5EffectiveWidth({
      chordB: branch.B,
      chordT: branch.tDes,
      chordFy: branchGrade.fy,
      branchB: branch.B,
      branchT: plateT,
      branchFy: plateGrade.fy,
    });
    const elements = buildHssPerimeterWeldElements({ branch, be: k5.be, mesh: input.mesh });
    const section = calcElasticWeldGroupProperties(elements, legSize);
    const webLen = physicalWebLength(branch);
    const totalPhysicalLength = 2 * branch.B + 2 * webLen;
    const totalEffectiveLength = elements.reduce((sum, el) => sum + el.length, 0);
    const baseT = Math.min(plateT, branch.tDes);
    const baseFy = plateT <= branch.tDes ? plateGrade.fy : branchGrade.fy;
    const baseFu = plateT <= branch.tDes ? plateGrade.fu : branchGrade.fu;
    const momentFactor = getMomentFactor(legSize);
    const momentXKipIn = appliedMomentX * 12;
    const momentYKipIn = appliedMomentY * 12;
    const correlationFamily = determineCorrelationFamily({
      appliedTension,
      appliedShearX,
      appliedShearY,
      appliedMomentX,
      appliedMomentY,
    });
    const correlationFactor = getCorrelationFactor(input, correlationFamily, {
      appliedTension,
      appliedShearX,
      appliedShearY,
      appliedMomentX,
      appliedMomentY,
    });

    const results = elements.map((element) => {
      const faceDemandShare = element.physicalFaceLength / totalPhysicalLength;
      const directNormal = appliedTension * faceDemandShare / element.effectiveFaceLength;
      const directShearX = appliedShearX * faceDemandShare / element.effectiveFaceLength;
      const directShearY = appliedShearY * faceDemandShare / element.effectiveFaceLength;
      const momentNormalX = momentXKipIn !== 0
        ? (momentXKipIn * (element.y - section.centroidY) / section.lineIx) * momentFactor.factor
        : 0;
      const momentNormalY = momentYKipIn !== 0
        ? (momentYKipIn * (element.x - section.centroidX) / section.lineIy) * momentFactor.factor
        : 0;
      const normalLineForce = directNormal + momentNormalX + momentNormalY;
      const shearXLineForce = directShearX;
      const shearYLineForce = directShearY;
      const shearLineForce = Math.hypot(shearXLineForce, shearYLineForce);
      const normalForce = normalLineForce * element.length;
      const shearXForce = shearXLineForce * element.length;
      const shearYForce = shearYLineForce * element.length;
      const shearForce = Math.hypot(shearXForce, shearYForce);
      const requiredForce = Math.hypot(normalForce, shearXForce, shearYForce);
      const thetaDeg = Math.min(90, Math.max(0, calcThetaDeg(element, shearXLineForce, shearYLineForce, normalLineForce)));
      const kdsCorrelation = directionalStrengthFactor(thetaDeg);

      const weld = calcWeldMetal({
        legSize,
        length: element.length,
        fexx,
        thetaDeg,
        nLines: 1,
        method,
        useDirectional: false,
        appliedLoad: requiredForce,
      });
      const baseTensionDemand = Math.max(0, normalForce);
      const baseShearDemand = Math.abs(shearForce);
      const baseTension = calcBaseMetal({
        baseT,
        fy: baseFy,
        fu: baseFu,
        length: element.length,
        nLines: 1,
        method,
        appliedLoad: baseTensionDemand,
        solicitation: "tension",
      });
      const baseShear = calcBaseMetal({
        baseT,
        fy: baseFy,
        fu: baseFu,
        length: element.length,
        nLines: 1,
        method,
        appliedLoad: baseShearDemand,
        solicitation: "shear",
      });

      const dcrs: Array<{ state: LimitState; dcr: number; cap: number }> = [
        { state: "weld-metal", dcr: weld.dcr ?? 0, cap: weld.cap },
        { state: "base-tension", dcr: baseTension.dcr ?? 0, cap: baseTension.cap },
        { state: "base-shear", dcr: baseShear.dcr ?? 0, cap: baseShear.cap },
      ];
      const governing = dcrs.reduce((a, b) => (b.dcr > a.dcr ? b : a));
      const directionalWeldDcr = (weld.dcr ?? 0) / kdsCorrelation;
      const correlatedWeldDcr = directionalWeldDcr * correlationFactor.factor;

      return {
        ...element,
        normalLineForce,
        shearLineForce,
        shearXLineForce,
        shearYLineForce,
        requiredForce,
        thetaDeg,
        weldDcr: weld.dcr ?? 0,
        directionalWeldDcr,
        correlatedWeldDcr,
        baseTensionDcr: baseTension.dcr ?? 0,
        baseShearDcr: baseShear.dcr ?? 0,
        governingDcr: governing.dcr,
        governingLimitState: governing.state,
        governingCapacity: governing.cap,
        correlatedStatus: correlatedWeldDcr <= 1.0 ? "OK" : "NG",
        status: governing.dcr <= 1.0 ? "OK" : "NG",
      } satisfies HssLocalElementResult;
    });

    const governing = results.length > 0
      ? results.reduce((a, b) => (b.governingDcr > a.governingDcr ? b : a))
      : null;
    const faceIds: FaceId[] = ["top-flange", "bottom-flange", "left-web", "right-web"];
    const correlatedGoverning = results.length > 0
      ? results.reduce((a, b) => (b.correlatedWeldDcr > a.correlatedWeldDcr ? b : a))
      : null;
    const faceSummaries = faceIds.map((faceId) => {
      const faceElements = results.filter((r) => r.faceId === faceId);
      const faceGov = faceElements.reduce((a, b) => (b.governingDcr > a.governingDcr ? b : a));
      return {
        faceId,
        faceLabel: faceLabel(faceId),
        elementCount: faceElements.length,
        physicalLength: faceGov.physicalFaceLength,
        effectiveLength: faceGov.effectiveFaceLength,
        maxDcr: faceGov.governingDcr,
        averageDcr: faceElements.reduce((sum, el) => sum + el.governingDcr, 0) / faceElements.length,
        governingElementId: faceGov.id,
      };
    });
    const validation = determineValidationEnvelope(input);
    const traceSteps = [
      {
        eq: `Be = min(${k5.beRaw.toFixed(3)}, ${branch.B.toFixed(3)})`,
        codeRef: "AISC Section K effective-width style concentration used as conservative local HSS-to-plate approximation",
        value: `${k5.be.toFixed(3)} in`,
      },
      {
        eq: `Effective local perimeter = 2*Be + 2*(H - 2*t_des)`,
        codeRef: "Code-owned deterministic local weld discretization",
        value: `${totalEffectiveLength.toFixed(3)} in`,
      },
      {
        eq: `Ix,line = sum(L_i*y_i^2); Iy,line = sum(L_i*x_i^2)`,
        codeRef: "AISC Manual Part 8 elastic weld-group mechanics",
        value: `Ix = ${section.lineIx.toFixed(3)} in^3, Iy = ${section.lineIy.toFixed(3)} in^3 (line)`,
      },
      {
        eq: `kds = 1.0`,
        codeRef: "AISC 360-22 Section J2.4: no directional increase for rectangular HSS end tension",
        value: "Locked",
      },
      {
        eq: `Moment local model factor = ${momentFactor.factor.toFixed(2)}`,
        codeRef: momentFactor.reason,
        value: `${momentFactor.factor.toFixed(2)}`,
      },
      {
        eq: `CBFEM-correlated weld factor = ${correlationFactor.factor.toFixed(3)} (${correlationFamily})`,
        codeRef: correlationFactor.basis,
        value: correlatedGoverning ? `Correlated weld DCR = ${correlatedGoverning.correlatedWeldDcr.toFixed(3)}` : "No demand",
      },
    ];

    return {
      elements: results,
      faceSummaries,
      governing,
      mesh: {
        ...mergeMeshConfig(input.mesh),
        totalElements: results.length,
        totalPhysicalLength,
        totalEffectiveLength,
      },
      section: {
        centroidX: section.centroidX,
        centroidY: section.centroidY,
        lineIx: section.lineIx,
        lineIy: section.lineIy,
        throat: section.throat,
        be: k5.be,
        beRaw: k5.beRaw,
        beCapped: k5.capped,
      },
      modelFactors: {
        direct: 1.0,
        moment: momentFactor.factor,
        reason: momentFactor.reason,
      },
      correlation: {
        family: correlationFamily,
        factor: correlationFactor.factor,
        governingDcr: correlatedGoverning?.correlatedWeldDcr ?? 0,
        governingElementId: correlatedGoverning?.id ?? null,
        status: correlatedGoverning ? correlatedGoverning.correlatedStatus : null,
        basis: correlationFactor.basis,
        warnings: correlationFactor.warnings,
      },
      validation,
      traceSteps,
    };
  } catch (error) {
    throw new Error(`Error calculating HSS-to-plate local weld check: ${error instanceof Error ? error.message : String(error)}`);
  }
}
