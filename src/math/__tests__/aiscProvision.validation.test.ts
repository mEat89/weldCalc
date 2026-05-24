import { describe, expect, it } from "vitest";
import {
  calcBaseMetal,
  calcK5EffectiveWidth,
  calcK5GroupCapacity,
  calcWeldMetal,
} from "../weldMath";
import { calcK4Unity } from "../combinedLoading";
import { HSS_SHAPES, STEEL_GRADES } from "../../constants/steelData";
import { useHSSCalculation } from "../../components/tabs/useHSSCalculation";
import { buildHSSReport } from "../../reports/buildHSSReport";

const TOL = 1e-6;

function close(actual: number, expected: number, digits = 6) {
  expect(actual).toBeCloseTo(expected, digits);
}

function hssIndex(name: string) {
  const idx = HSS_SHAPES.findIndex((shape) => shape.name === name);
  if (idx < 0) throw new Error(`Missing HSS shape ${name}`);
  return idx;
}

function gradeIndex(shortLabel: string) {
  const idx = STEEL_GRADES.findIndex((grade) => grade.shortLabel === shortLabel);
  if (idx < 0) throw new Error(`Missing steel grade ${shortLabel}`);
  return idx;
}

function handWeldMetal({
  legSize,
  length,
  fexx,
  nLines,
  appliedLoad,
}: {
  legSize: number;
  length: number;
  fexx: number;
  nLines: number;
  appliedLoad: number;
}) {
  const te = 0.707 * legSize;
  const Awe = te * length * nLines;
  const Fnw = 0.6 * fexx;
  const Rn = Fnw * Awe;
  const cap = 0.75 * Rn;
  return { te, Awe, Fnw, Rn, cap, dcr: appliedLoad / cap };
}

function handBaseMetal({
  baseT,
  fy,
  fu,
  length,
  nLines,
  appliedLoad,
  solicitation,
}: {
  baseT: number;
  fy: number;
  fu: number;
  length: number;
  nLines: number;
  appliedLoad: number;
  solicitation: "shear" | "tension";
}) {
  const A = baseT * length * nLines;
  const k = solicitation === "shear" ? 0.6 : 1.0;
  const phiYield = solicitation === "shear" ? 1.0 : 0.9;
  const capYield = phiYield * k * fy * A;
  const capRupture = 0.75 * k * fu * A;
  const cap = Math.min(capYield, capRupture);
  return { A, capYield, capRupture, cap, dcr: appliedLoad / cap };
}

function handK5({
  Hb,
  Bb,
  Be,
  legSize,
  fexx,
}: {
  Hb: number;
  Bb: number;
  Be: number;
  legSize: number;
  fexx: number;
}) {
  const tw = 0.707 * legSize;
  const le = 2 * Hb + 2 * Be;
  const webTerm = tw * Hb * Hb / 3;
  const flangeTerm = tw * Be * Hb;
  const Sip = webTerm + flangeTerm;
  const Fnw = 0.6 * fexx;
  const Pn_axial = Fnw * tw * le;
  const Mn_ip = Fnw * Sip;
  return {
    Bb,
    Be,
    Hb,
    tw,
    le,
    webTerm,
    flangeTerm,
    Sip,
    Fnw,
    Pn_axial,
    cap_axial: 0.75 * Pn_axial,
    Mn_ip,
    cap_ip: 0.75 * Mn_ip,
  };
}

function summarize(label: string, values: Record<string, string | number>) {
  const summary = Object.entries(values)
    .map(([key, value]) => `${key}=${typeof value === "number" ? value.toFixed(4) : value}`)
    .join("  ");
  console.log(`[validation] ${label}: ${summary}`);
}

describe("AISC provision validation examples", () => {
  it("Chapter J example: fillet weld strength matches an independent hand calculation", () => {
    // AISC Design Examples Chapter K.10 style weld check:
    // four 3/16 in fillet welds, each 7 in long, E70 electrode, LRFD demand 80 kips.
    const input = {
      legSize: 3 / 16,
      length: 7,
      fexx: 70,
      thetaDeg: 0,
      nLines: 4,
      method: "lrfd" as const,
      useDirectional: false,
      appliedLoad: 80,
    };
    const actual = calcWeldMetal(input);
    const expected = handWeldMetal(input);

    close(actual.te, expected.te);
    close(actual.Awe, expected.Awe);
    close(actual.Fnw, expected.Fnw);
    close(actual.cap, expected.cap);
    close(actual.dcr ?? 0, expected.dcr);
    expect(actual.status).toBe("OK");

    // The published example rounds this available strength to 117 kips.
    expect(actual.cap).toBeCloseTo(117, 0);
    summarize("J2.4 weld, K.10 style", {
      phiRn_kips: actual.cap,
      dcr_pct: (actual.dcr ?? 0) * 100,
      published_phiRn_kips: 117,
    });
  });

  it("Chapter J example: base-metal shear and tension route to the correct J4 limit states", () => {
    const shearInput = {
      baseT: 0.25,
      fy: 36,
      fu: 58,
      length: 6,
      nLines: 2,
      method: "lrfd" as const,
      appliedLoad: 30,
      solicitation: "shear" as const,
    };
    const tensionInput = {
      ...shearInput,
      appliedLoad: 80,
      solicitation: "tension" as const,
    };

    const shear = calcBaseMetal(shearInput);
    const expectedShear = handBaseMetal(shearInput);
    close(shear.A, expectedShear.A);
    close(shear.capYield, expectedShear.capYield);
    close(shear.capRupture, expectedShear.capRupture);
    close(shear.cap, expectedShear.cap);
    close(shear.dcr ?? 0, expectedShear.dcr);
    expect(shear.governs).toBe("yielding");

    const tension = calcBaseMetal(tensionInput);
    const expectedTension = handBaseMetal(tensionInput);
    close(tension.A, expectedTension.A);
    close(tension.capYield, expectedTension.capYield);
    close(tension.capRupture, expectedTension.capRupture);
    close(tension.cap, expectedTension.cap);
    close(tension.dcr ?? 0, expectedTension.dcr);
    expect(tension.governs).toBe("yielding");

    summarize("J4 base metal made-up pair", {
      shear_phiRn_kips: shear.cap,
      shear_dcr_pct: (shear.dcr ?? 0) * 100,
      tension_phiRn_kips: tension.cap,
      tension_dcr_pct: (tension.dcr ?? 0) * 100,
    });
  });

  it("Chapter K example: hand §K5 group equations match math helper, hook output, and report model", () => {
    const branchIdx = hssIndex("HSS8x4x1/4");
    const chordIdx = hssIndex("HSS10x10x3/8");
    const branchGradeIdx = gradeIndex("A500 Gr C (50/62)");
    const chordGradeIdx = gradeIndex("A500 Gr C (50/62)");
    const plateGradeIdx = gradeIndex("A36");

    const state = {
      connType: "hss2hss",
      lengthMode: "k5",
      branchIdx,
      branchGradeIdx,
      chordIdx,
      chordGradeIdx,
      plateT: 0.5,
      plateGradeIdx,
      branchTransverseDim: "B",
      legSize: 0.25,
      fexx: 70,
      appliedShear: 20,
      appliedTension: 12,
      appliedMip: 8,
    };

    const branch = HSS_SHAPES[branchIdx];
    const chord = HSS_SHAPES[chordIdx];
    const branchGrade = STEEL_GRADES[branchGradeIdx];
    const chordGrade = STEEL_GRADES[chordGradeIdx];
    const plateGrade = STEEL_GRADES[plateGradeIdx];

    const k5 = calcK5EffectiveWidth({
      chordB: chord.B,
      chordT: chord.tDes,
      chordFy: chordGrade.fy,
      branchB: branch.B,
      branchT: branch.tDes,
      branchFy: branchGrade.fy,
    });
    const expected = handK5({
      Hb: branch.H,
      Bb: branch.B,
      Be: k5.be,
      legSize: state.legSize,
      fexx: state.fexx,
    });

    const helper = calcK5GroupCapacity({
      Hb: expected.Hb,
      Bb: expected.Bb,
      Be: expected.Be,
      tw: expected.tw,
      fexx: state.fexx,
      thetaDeg: 90,
      method: "lrfd",
    });

    close(helper.le, expected.le);
    close(helper.Sip, expected.Sip);
    close(helper.Pn_axial, expected.Pn_axial);
    close(helper.cap_axial, expected.cap_axial);
    close(helper.Mn_ip, expected.Mn_ip);
    close(helper.cap_ip, expected.cap_ip);

    const calcs = useHSSCalculation(state);
    close(calcs.shared.Be_for_sip, expected.Be);
    close(calcs.shared.groupCap?.le ?? 0, expected.le);
    close(calcs.shared.groupCap?.cap_axial ?? 0, expected.cap_axial);
    close(calcs.shared.groupCap?.cap_ip ?? 0, expected.cap_ip);

    const shearDcr = state.appliedShear / expected.cap_axial;
    const tensionDcr = state.appliedTension / expected.cap_axial;
    const mipDcr = state.appliedMip * 12 / expected.cap_ip;
    const k4Expected = calcK4Unity({
      axialDCR: Math.max(shearDcr, tensionDcr),
      ipMomentDCR: mipDcr,
    });

    close(calcs.shear?.controlling.dcr ?? 0, shearDcr);
    close(calcs.tension?.controlling.dcr ?? 0, tensionDcr);
    close(calcs.ipMoment?.controlling.dcr ?? 0, mipDcr);
    close(calcs.k4Unity.unity, k4Expected.unity);

    const report = buildHSSReport({
      state: {
        ...state,
        branch,
        branchGrade,
        chord,
        chordGrade,
        plateGrade,
      },
      calcs,
      meta: null,
      diagramSvgString: null,
    });

    const reportShear = report.checks.find((check) => check.title.startsWith("Shear (V)"));
    const reportTension = report.checks.find((check) => check.title.startsWith("Tension (N)"));
    const reportMip = report.checks.find((check) => check.title.startsWith("In-plane moment"));
    const reportK4 = report.checks.find((check) => check.title.startsWith("Final design verdict"));

    close(reportShear?.verdict.dcr ?? 0, shearDcr);
    close(reportTension?.verdict.dcr ?? 0, tensionDcr);
    close(reportMip?.verdict.dcr ?? 0, mipDcr);
    close(reportK4?.verdict.dcr ?? 0, k4Expected.unity);

    summarize("K5 group hook/report parity", {
      Be_in: expected.Be,
      le_in: expected.le,
      phiPn_kips: expected.cap_axial,
      phiMn_kip_in: expected.cap_ip,
      shear_dcr_pct: shearDcr * 100,
      tension_dcr_pct: tensionDcr * 100,
      Mip_dcr_pct: mipDcr * 100,
      K4_unity: k4Expected.unity,
    });
  });
});
