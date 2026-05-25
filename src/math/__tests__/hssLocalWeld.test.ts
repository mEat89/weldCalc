import { describe, expect, it } from "vitest";
import {
  buildHssPerimeterWeldElements,
  calcElasticWeldGroupProperties,
  calcHssToPlateLocalWeldCheck,
} from "../hssLocalWeld";

const A500_GR_B = { fy: 46, fu: 58, shortLabel: "A500 Gr B" };
const A36 = { fy: 36, fu: 58, shortLabel: "A36" };
const FEXX = 70;

const HSS_8X2X125 = {
  name: "HSS8x2x1/8",
  B: 2.0,
  H: 8.0,
  tDes: 0.116,
  tNom: 0.125,
};

const HSS_4X4X25 = {
  name: "HSS4x4x1/4",
  B: 4.0,
  H: 4.0,
  tDes: 0.233,
  tNom: 0.25,
};

function localDcr(input: Parameters<typeof calcHssToPlateLocalWeldCheck>[0]) {
  const result = calcHssToPlateLocalWeldCheck(input);
  if (!result.governing) throw new Error("Expected a governing local segment.");
  return result.governing.governingDcr;
}

describe("HSS-to-plate local weld discretization", () => {
  it("builds a deterministic symmetric local weld element set", () => {
    const first = buildHssPerimeterWeldElements({ branch: HSS_8X2X125, be: 0.344 });
    const second = buildHssPerimeterWeldElements({ branch: HSS_8X2X125, be: 0.344 });

    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
    expect(first.filter((el) => el.faceId === "top-flange").length).toBe(
      first.filter((el) => el.faceId === "bottom-flange").length
    );
    expect(first.filter((el) => el.faceId === "left-web").length).toBe(
      first.filter((el) => el.faceId === "right-web").length
    );
  });

  it("computes symmetric elastic line properties for a centered HSS weld group", () => {
    const elements = buildHssPerimeterWeldElements({ branch: HSS_8X2X125, be: 0.344 });
    const props = calcElasticWeldGroupProperties(elements, 0.3125);

    expect(props.centroidX).toBeCloseTo(0, 10);
    expect(props.centroidY).toBeCloseTo(0, 10);
    expect(props.lineIx).toBeGreaterThan(0);
    expect(props.lineIy).toBeGreaterThan(0);
    expect(props.throat).toBeCloseTo(0.707 * 0.3125, 6);
  });

  it("resolves directional shear and moment to the local weld axes", () => {
    const shearX = calcHssToPlateLocalWeldCheck({
      branch: HSS_4X4X25,
      branchGrade: A500_GR_B,
      plateT: 0.5,
      plateGrade: A36,
      legSize: 0.25,
      fexx: FEXX,
      appliedShearX: 17,
      method: "lrfd",
    });
    const shearY = calcHssToPlateLocalWeldCheck({
      branch: HSS_4X4X25,
      branchGrade: A500_GR_B,
      plateT: 0.5,
      plateGrade: A36,
      legSize: 0.25,
      fexx: FEXX,
      appliedShearY: 17,
      method: "lrfd",
    });
    const momentY = calcHssToPlateLocalWeldCheck({
      branch: HSS_4X4X25,
      branchGrade: A500_GR_B,
      plateT: 0.5,
      plateGrade: A36,
      legSize: 0.25,
      fexx: FEXX,
      appliedMomentY: 10,
      method: "lrfd",
    });

    expect(shearX.governing?.thetaDeg).not.toBeCloseTo(shearY.governing?.thetaDeg ?? 0, 3);
    expect(momentY.governing?.faceId).toMatch(/web/);
  });

  it("uses read-only mesh refinement without materially reducing the governing DCR", () => {
    const baseInput = {
      branch: HSS_8X2X125,
      branchGrade: A500_GR_B,
      plateT: 0.5,
      plateGrade: A36,
      legSize: 0.3125,
      fexx: FEXX,
      appliedMoment: 10,
      method: "lrfd" as const,
    };
    const defaultResult = calcHssToPlateLocalWeldCheck(baseInput);
    const refinedResult = calcHssToPlateLocalWeldCheck({
      ...baseInput,
      mesh: {
        targetElementLength: 0.125,
        minTransverseElements: 8,
        minLongitudinalElements: 16,
      },
    });

    expect(refinedResult.mesh.totalElements).toBeGreaterThan(defaultResult.mesh.totalElements);
    expect(refinedResult.governing!.governingDcr).toBeGreaterThanOrEqual(
      defaultResult.governing!.governingDcr * 0.98
    );
  });

  it("is conservative against the Hilti HSS8x2 tension benchmark", () => {
    const dcr = localDcr({
      branch: HSS_8X2X125,
      branchGrade: A500_GR_B,
      plateT: 0.5,
      plateGrade: A36,
      legSize: 0.348,
      fexx: FEXX,
      appliedTension: 10,
      method: "lrfd",
    });

    expect(dcr).toBeGreaterThanOrEqual(0.34);
  });

  it("reports the separate CBFEM-correlated weld DCR for exact Hilti batch cases", () => {
    const result = calcHssToPlateLocalWeldCheck({
      branch: { name: "HSS4x2x1/8", B: 2, H: 4, tDes: 0.116, tNom: 0.125 },
      branchGrade: A500_GR_B,
      plateT: 0.5,
      plateGrade: A36,
      legSize: 0.348,
      fexx: FEXX,
      appliedTension: 12,
      appliedShearY: 4,
      method: "lrfd",
    });

    expect(result.correlation.basis).toMatch(/Exact Hilti report \(7\)/);
    expect(result.correlation.governingDcr).toBeCloseTo(0.68, 3);
    expect(result.governing!.governingDcr).toBeGreaterThan(result.correlation.governingDcr);
  });

  it("is conservative against the Hilti HSS8x2 moment benchmark", () => {
    const dcr = localDcr({
      branch: HSS_8X2X125,
      branchGrade: A500_GR_B,
      plateT: 0.5,
      plateGrade: A36,
      legSize: 0.348,
      fexx: FEXX,
      appliedMoment: 10,
      method: "lrfd",
    });

    expect(dcr).toBeGreaterThanOrEqual(0.76);
  });

  it("is conservative against the Hilti small-leg moment benchmark", () => {
    const dcr = localDcr({
      branch: HSS_8X2X125,
      branchGrade: A500_GR_B,
      plateT: 0.5,
      plateGrade: A36,
      legSize: 0.25,
      fexx: FEXX,
      appliedMoment: 10,
      method: "lrfd",
    });

    expect(dcr).toBeGreaterThanOrEqual(2.90);
  });

  it("is conservative against the Hilti HSS4x4 shear benchmark", () => {
    const dcr = localDcr({
      branch: HSS_4X4X25,
      branchGrade: A500_GR_B,
      plateT: 0.5,
      plateGrade: A36,
      legSize: 0.25,
      fexx: FEXX,
      appliedShear: 17,
      method: "lrfd",
    });

    expect(dcr).toBeGreaterThanOrEqual(0.49);
  });

  it("flags inputs outside the Hilti benchmark envelope", () => {
    const result = calcHssToPlateLocalWeldCheck({
      branch: { name: "HSS6x6x1/4", B: 6, H: 6, tDes: 0.233, tNom: 0.25 },
      branchGrade: A500_GR_B,
      plateT: 0.75,
      plateGrade: A36,
      legSize: 0.3125,
      fexx: FEXX,
      appliedTension: 10,
      method: "lrfd",
    });

    expect(result.validation.envelope).toBe("outside-benchmark-envelope");
    expect(result.validation.warnings.length).toBeGreaterThan(0);
  });

  it("throws clear errors on invalid inputs", () => {
    expect(() => calcHssToPlateLocalWeldCheck({
      branch: HSS_8X2X125,
      branchGrade: A500_GR_B,
      plateT: 0.5,
      plateGrade: A36,
      legSize: -0.25,
      fexx: FEXX,
      appliedTension: 10,
      method: "lrfd",
    })).toThrow(/legSize must be positive/);
  });
});
