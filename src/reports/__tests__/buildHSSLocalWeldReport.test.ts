import { describe, expect, it } from "vitest";
import { calcHssToPlateLocalWeldCheck } from "../../math/hssLocalWeld";
import { buildHSSLocalWeldReport } from "../buildHSSLocalWeldReport";

const branch = {
  name: "HSS8x2x1/8",
  B: 2.0,
  H: 8.0,
  tDes: 0.116,
  tNom: 0.125,
};
const branchGrade = { fy: 46, fu: 58, shortLabel: "A500 Gr B" };
const plateGrade = { fy: 36, fu: 58, shortLabel: "A36" };

describe("buildHSSLocalWeldReport", () => {
  it("carries governing local segment, read-only mesh, and CBFEM limitation notes into the report model", () => {
    const local = calcHssToPlateLocalWeldCheck({
      branch,
      branchGrade,
      plateT: 0.5,
      plateGrade,
      legSize: 0.348,
      fexx: 70,
      appliedTension: 10,
      method: "lrfd",
    });

    const model = buildHSSLocalWeldReport({
      state: {
        branch,
        branchGrade,
        plateT: 0.5,
        plateGrade,
        legSize: 0.348,
        fexx: 70,
        appliedShear: 0,
        appliedTension: 10,
        appliedMip: 0,
        analysisMode: "local",
      },
      calcs: {
        local,
        localError: null,
        group: null,
      },
      meta: { project: "Unit Test", engineer: "", jobNumber: "", date: "2026-05-24" },
      diagramSvgString: null,
    });

    expect(model.title).toContain("HSS-to-Plate Local Weld");
    expect(model.results.some((row) => row.label.includes("Governing local segment"))).toBe(true);
    expect(model.checks.some((check) => check.title.includes("AISC Manual Part 8"))).toBe(true);
    expect(model.inputs.some((group) =>
      group.rows.some((row) => row.label === "Element mesh" && String(row.value).includes("read-only"))
    )).toBe(true);
    expect(model.notes.some((note) => note.includes("not by user judgment"))).toBe(true);
    expect(model.warnings.some((warning) => warning.includes("not a finite-element solver"))).toBe(true);
  });

  it("hard-fails malformed report inputs instead of rendering undefined cells", () => {
    expect(() => buildHSSLocalWeldReport({
      state: { branch },
      calcs: {},
      meta: {},
      diagramSvgString: null,
    })).toThrow(/missing required key/);
  });
});
