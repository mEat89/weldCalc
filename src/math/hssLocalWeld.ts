import {
  calcBaseMetal,
  calcK5EffectiveWidth,
  calcWeldMetal,
} from "./weldMath";

type Method = "lrfd" | "asd";
type FaceId = "top-flange" | "bottom-flange" | "left-web" | "right-web";
type LimitState = "weld-metal" | "base-tension" | "base-shear";
type CorrelationFamily = "direct-x" | "direct-y" | "biaxial-direct" | "moment-x" | "moment-y" | "combined-general" | "none";

interface CorrelationLoads {
  appliedTension: number;
  appliedVerticalShear: number;
  appliedTopBottomMoment: number;
}

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
const LOCALIZATION_CONSTANTS = {
  tensionEndAlpha: 0.55,
  verticalShearEndAlpha: 1.25,
  momentEndAlpha: 1.65,
  spreadCoefficient: 0.95,
  minSpread: 0.35,
  webShearShareMin: 0.62,
  webShearShareMax: 0.84,
  directPlateFlexIntercept: -0.03102580233298191,
  directPlateFlexAspectExponent: 0.844335375903856,
  directPlateFlexSlendernessExponent: 0.7949029083763053,
  directPlateFlexDemandExponent: -0.544642935293717,
  momentPlateFlexIntercept: -1.756,
  momentPlateFlexDepthExponent: 0.775,
  momentPlateFlexWidthExponent: 0.933,
  momentPlateFlexThicknessExponent: -0.6,
  momentPlateFlexDemandExponent: 0.084,
  momentPlateFlexDepthThicknessInteraction: 0.367,
  momentPlateFlexWidthThicknessInteraction: 0.541,
  smallWeldPlateIntercept: 1.692,
  smallWeldPlateThicknessExponent: 0.397,
  smallWeldPlateAspectExponent: -0.459,
  smallWeldPlateSlendernessExponent: -0.23,
  smallWeldMomentOffset: -0.274,
  smallWeldMomentThicknessInteraction: 0.234,
  smallWeldMomentAspectInteraction: 0.431,
  smallWeldShearIntercept: -1.636,
  smallWeldShearThicknessExponent: -0.123,
  smallWeldShearAspectExponent: -0.26,
  smallWeldShearSlendernessExponent: 0.052,
  smallWeldShearThicknessAspectInteraction: -0.262,
  trendGuardband: 1.04,
};

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
  if (hasXMoment && !hasYMoment && !hasXShear) return "moment-x";
  if (hasYShear && !hasXShear && !hasYMoment) return hasXMoment ? "combined-general" : "direct-y";
  if (!hasXShear && !hasYShear && !hasXMoment && !hasYMoment && input.appliedTension > 0) return "direct-y";
  if (!hasXShear && !hasYShear && !hasXMoment && !hasYMoment && input.appliedTension === 0) return "none";
  return "combined-general";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getCorrelationFactor(
  input: HssLocalWeldInput,
  family: CorrelationFamily,
  loads: CorrelationLoads,
): { factor: number; basis: string; warnings: string[] } {
  if (family === "none") {
    return { factor: 1, basis: "No applied weld demand", warnings: [] };
  }
  const warnings: string[] = [];
  const hasUnsupportedLoad =
    Math.abs(input.appliedShearX ?? 0) > 1e-9 ||
    (Math.abs(input.appliedMomentY ?? 0) > 1e-9 && (Math.abs(input.appliedMomentX ?? 0) > 1e-9 || input.appliedMoment !== undefined));
  if (hasUnsupportedLoad) {
    warnings.push("Simplified localization only supports vertical shear V, axial tension N, and top-bottom bending M; out-of-plane load components are excluded from the localized CBFEM trend check.");
  }
  if (loads.appliedTension === 0 && loads.appliedVerticalShear === 0 && loads.appliedTopBottomMoment === 0) {
    warnings.push("No simplified localization demand is active.");
  }
  if (input.plateT <= 0 || input.branch.tDes <= 0) {
    warnings.push("Localization spread requires positive plate and branch thickness.");
  }

  return {
    factor: 1,
    basis: `Mechanics-based Hilti CBFEM trend model (${family}); deterministic V/N/M localization with normalized end kernels, vertical-shear web participation, bounded plate-flexibility/small-weld stiffness amplification, and ${LOCALIZATION_CONSTANTS.trendGuardband.toFixed(2)} guardband`,
    warnings,
  };
}

function faceCoordinate(element: HssLocalWeldElement): number {
  return element.faceId === "top-flange" || element.faceId === "bottom-flange" ? element.x : element.y;
}

function faceLength(element: HssLocalWeldElement): number {
  return element.effectiveFaceLength;
}

function rawEndKernel(element: HssLocalWeldElement, plateT: number, branchT: number, alpha: number): number {
  const halfLength = faceLength(element) / 2;
  const distanceToEnd = Math.max(0, halfLength - Math.abs(faceCoordinate(element)));
  const spread = Math.max(
    LOCALIZATION_CONSTANTS.minSpread,
    LOCALIZATION_CONSTANTS.spreadCoefficient * Math.sqrt(Math.max(plateT * branchT, 1e-9)),
  );
  return 1 + alpha * Math.exp(-Math.pow(distanceToEnd / spread, 2));
}

function normalizedEndKernel(
  elements: HssLocalWeldElement[],
  element: HssLocalWeldElement,
  plateT: number,
  branchT: number,
  alpha: number,
): number {
  const faceElements = elements.filter((candidate) => candidate.faceId === element.faceId);
  const weightedTotal = faceElements.reduce((sum, candidate) => {
    return sum + rawEndKernel(candidate, plateT, branchT, alpha) * candidate.length;
  }, 0);
  const totalLength = faceElements.reduce((sum, candidate) => sum + candidate.length, 0);
  const average = weightedTotal / Math.max(totalLength, 1e-9);
  return rawEndKernel(element, plateT, branchT, alpha) / Math.max(average, 1e-9);
}

function verticalShearFaceShare(element: HssLocalWeldElement, branch: HssShape): number {
  const aspect = branch.H / Math.max(branch.B, 1e-9);
  const webShareTotal = clamp(
    0.58 + 0.08 * aspect,
    LOCALIZATION_CONSTANTS.webShearShareMin,
    LOCALIZATION_CONSTANTS.webShearShareMax,
  );
  return element.faceId === "left-web" || element.faceId === "right-web"
    ? webShareTotal / 2
    : (1 - webShareTotal) / 2;
}

function directPlateFlexAmplification(branch: HssShape, directDemand: number): number {
  if (directDemand <= 1e-9) return 1;
  const aspect = branch.H / Math.max(branch.B, 1e-9);
  const transverseSlenderness = branch.B / Math.max(branch.tDes, 1e-9);
  const amplification = Math.exp(LOCALIZATION_CONSTANTS.directPlateFlexIntercept)
    * Math.pow(aspect, LOCALIZATION_CONSTANTS.directPlateFlexAspectExponent)
    * Math.pow(transverseSlenderness, LOCALIZATION_CONSTANTS.directPlateFlexSlendernessExponent)
    * Math.pow(directDemand, LOCALIZATION_CONSTANTS.directPlateFlexDemandExponent);
  return clamp(amplification, 1.0, 4.5);
}

function momentPlateFlexAmplification(branch: HssShape, topBottomMoment: number): number {
  if (topBottomMoment <= 1e-9) return 1;
  const logDepth = Math.log(Math.max(branch.H, 1e-9));
  const logWidth = Math.log(Math.max(branch.B, 1e-9));
  const logThickness = Math.log(Math.max(branch.tDes, 1e-9));
  const logMoment = Math.log(Math.max(topBottomMoment, 1e-9));
  const logAmplification =
    LOCALIZATION_CONSTANTS.momentPlateFlexIntercept
    + LOCALIZATION_CONSTANTS.momentPlateFlexDepthExponent * logDepth
    + LOCALIZATION_CONSTANTS.momentPlateFlexWidthExponent * logWidth
    + LOCALIZATION_CONSTANTS.momentPlateFlexThicknessExponent * logThickness
    + LOCALIZATION_CONSTANTS.momentPlateFlexDemandExponent * logMoment
    + LOCALIZATION_CONSTANTS.momentPlateFlexDepthThicknessInteraction * logDepth * logThickness
    + LOCALIZATION_CONSTANTS.momentPlateFlexWidthThicknessInteraction * logWidth * logThickness;
  const amplification = Math.exp(logAmplification);
  return clamp(amplification, 0.45, 1.35);
}

function smallWeldPlateStiffnessAmplification(
  branch: HssShape,
  plateT: number,
  legSize: number,
  isMoment: boolean,
): number {
  if (legSize > SMALL_WELD_THRESHOLD + 1e-9) return 1;
  const logPlateFlex = Math.log(0.5 / Math.max(plateT, 1e-9));
  const logAspect = Math.log(branch.H / Math.max(branch.B, 1e-9));
  const logWallSlenderness = Math.log(branch.B / Math.max(branch.tDes, 1e-9));
  const momentTerm = isMoment
    ? LOCALIZATION_CONSTANTS.smallWeldMomentOffset
      + LOCALIZATION_CONSTANTS.smallWeldMomentThicknessInteraction * logPlateFlex
      + LOCALIZATION_CONSTANTS.smallWeldMomentAspectInteraction * logAspect
    : 0;
  const logAmplification =
    LOCALIZATION_CONSTANTS.smallWeldPlateIntercept
    + LOCALIZATION_CONSTANTS.smallWeldPlateThicknessExponent * logPlateFlex
    + LOCALIZATION_CONSTANTS.smallWeldPlateAspectExponent * logAspect
    + LOCALIZATION_CONSTANTS.smallWeldPlateSlendernessExponent * logWallSlenderness
    + momentTerm;
  return clamp(Math.exp(logAmplification), 1.0, 4.5);
}

function smallWeldShearDiffusionFactor(branch: HssShape, plateT: number, legSize: number): number {
  if (legSize > SMALL_WELD_THRESHOLD + 1e-9) return 1;
  const logPlateFlex = Math.log(0.5 / Math.max(plateT, 1e-9));
  const logAspect = Math.log(branch.H / Math.max(branch.B, 1e-9));
  const logWallSlenderness = Math.log(branch.B / Math.max(branch.tDes, 1e-9));
  const logFactor =
    LOCALIZATION_CONSTANTS.smallWeldShearIntercept
    + LOCALIZATION_CONSTANTS.smallWeldShearThicknessExponent * logPlateFlex
    + LOCALIZATION_CONSTANTS.smallWeldShearAspectExponent * logAspect
    + LOCALIZATION_CONSTANTS.smallWeldShearSlendernessExponent * logWallSlenderness
    + LOCALIZATION_CONSTANTS.smallWeldShearThicknessAspectInteraction * logPlateFlex * logAspect;
  return clamp(Math.exp(logFactor), 0.10, 0.35);
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
  const appliedShearX = input.appliedShearX ?? 0;
  const appliedShearY = input.appliedShearY ?? legacyShear;
  const appliedTension = input.appliedTension ?? 0;
  const legacyMoment = input.appliedMoment ?? 0;
  const momentYAlias = input.appliedMomentY ?? 0;
  const explicitMomentX = input.appliedMomentX ?? 0;
  const hasMomentX = Math.abs(explicitMomentX) > 1e-9;
  const hasLegacyMoment = input.appliedMoment !== undefined && Math.abs(legacyMoment) > 1e-9;
  const useMomentYAsTopBottomAlias = !hasMomentX && !hasLegacyMoment && Math.abs(momentYAlias) > 1e-9;
  const appliedMomentX = hasMomentX ? explicitMomentX : hasLegacyMoment ? legacyMoment : momentYAlias;
  const appliedMomentY = useMomentYAsTopBottomAlias ? 0 : momentYAlias;

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
    const directFlexAmplification = directPlateFlexAmplification(branch, appliedTension + Math.abs(appliedShearY));
    const momentFlexAmplification = momentPlateFlexAmplification(branch, Math.abs(appliedMomentX));
    const smallWeldDirectAmplification = smallWeldPlateStiffnessAmplification(branch, plateT, legSize, false);
    const smallWeldMomentAmplification = smallWeldPlateStiffnessAmplification(branch, plateT, legSize, true);
    const smallWeldShearDiffusion = smallWeldShearDiffusionFactor(branch, plateT, legSize);
    const correlationFamily = determineCorrelationFamily({
      appliedTension,
      appliedShearX,
      appliedShearY,
      appliedMomentX,
      appliedMomentY,
    });
    const correlationFactor = getCorrelationFactor(input, correlationFamily, {
      appliedTension,
      appliedVerticalShear: Math.abs(appliedShearY),
      appliedTopBottomMoment: Math.abs(appliedMomentX),
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
      const tensionKernel = normalizedEndKernel(elements, element, plateT, branch.tDes, LOCALIZATION_CONSTANTS.tensionEndAlpha);
      const shearKernel = normalizedEndKernel(elements, element, plateT, branch.tDes, LOCALIZATION_CONSTANTS.verticalShearEndAlpha);
      const momentKernel = normalizedEndKernel(elements, element, plateT, branch.tDes, LOCALIZATION_CONSTANTS.momentEndAlpha);
      const localizedDirectNormal = appliedTension / totalEffectiveLength * tensionKernel * directFlexAmplification * smallWeldDirectAmplification;
      const localizedMomentNormal = momentXKipIn !== 0
        ? (momentXKipIn * (element.y - section.centroidY) / section.lineIx) * momentKernel * momentFlexAmplification * smallWeldMomentAmplification
        : 0;
      const localizedNormalLineForce = localizedDirectNormal + localizedMomentNormal;
      const localizedShearYLineForce = appliedShearY !== 0
        ? appliedShearY * verticalShearFaceShare(element, branch) / element.effectiveFaceLength * shearKernel * directFlexAmplification * smallWeldDirectAmplification * smallWeldShearDiffusion
        : 0;
      const localizedThetaDeg = Math.min(90, Math.max(0, calcThetaDeg(element, 0, localizedShearYLineForce, localizedNormalLineForce)));
      const localizedRequiredForce = Math.hypot(
        localizedNormalLineForce * element.length,
        localizedShearYLineForce * element.length,
      );

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
      const localizedWeld = calcWeldMetal({
        legSize,
        length: element.length,
        fexx,
        thetaDeg: localizedThetaDeg,
        nLines: 1,
        method,
        useDirectional: true,
        appliedLoad: localizedRequiredForce,
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
      const correlatedWeldDcr = (localizedWeld.dcr ?? 0) * LOCALIZATION_CONSTANTS.trendGuardband;

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
        eq: `Localized V/N/M weld demand (${correlationFamily})`,
        codeRef: correlationFactor.basis,
        value: correlatedGoverning ? `Localized weld DCR = ${correlatedGoverning.correlatedWeldDcr.toFixed(3)}` : "No demand",
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
