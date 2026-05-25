import { useRef, useState } from "react";
import {
  FEXX_OPTIONS,
  HSS_SHAPES,
  LEG_SIZES,
  STEEL_GRADES,
} from "../../constants/steelData";
import { calcWeldSize, toFraction, to16ths } from "../../math/weldMath";
import { calcHssToPlateLocalWeldCheck } from "../../math/hssLocalWeld";
import { useHSSCalculation } from "./useHSSCalculation";
import { Field, HssMemberSelect, NonNegativeNumberInput, PlateThicknessSelect, SteelGradeSelect } from "../shared/FormElements";
import { CheckBlock, CombinedLoadingCard, GroupCapacityCard, StatCard, WarningBanner } from "../shared/CheckResults";
import HssSvgDiagram from "../shared/HssSvgDiagram";
import ReportActions from "../shared/ReportActions";
import { buildHSSLocalWeldReport } from "../../reports/buildHSSLocalWeldReport";

const MODE_GROUP = "group";
const MODE_LOCAL = "local";

function defaultHssIndex(name) {
  const idx = HSS_SHAPES.findIndex((shape) => shape.name === name);
  return idx >= 0 ? idx : 0;
}

function limitStateLabel(limitState) {
  switch (limitState) {
    case "weld-metal":
      return "Weld metal, Section J2.4";
    case "base-tension":
      return "Base metal tension, Section J4.1";
    case "base-shear":
      return "Base metal shear, Section J4.2";
    default:
      return limitState || "—";
  }
}

function dcrStatus(dcr) {
  return dcr <= 1 ? "OK" : "NG";
}

function LocalGoverningCard({ local }) {
  if (!local || !local.governing) return null;
  const gov = local.governing;
  return (
    <CheckBlock
      title="AISC Manual Part 8 local weld discretization — governing segment"
      codeRef="Elastic local weld-element demand with AISC Sections J2.4 and J4 strength"
      traceSteps={[
        ...local.traceSteps,
        {
          eq: `Governing segment = ${gov.id} (${gov.faceLabel})`,
          codeRef: limitStateLabel(gov.governingLimitState),
          value: `DCR ${gov.governingDcr.toFixed(3)}`,
        },
        {
          eq: `q_normal = ${gov.normalLineForce.toFixed(3)} kip/in; q_shear = ${gov.shearLineForce.toFixed(3)} kip/in`,
          codeRef: "Local resultant demand at weld element center",
          value: `${gov.requiredForce.toFixed(3)} kip`,
        },
      ]}
      statCards={[
        { label: "Face", value: gov.faceLabel },
        { label: "Element", value: gov.id },
        { label: "Limit state", value: limitStateLabel(gov.governingLimitState) },
        { label: "Local DCR", value: gov.governingDcr.toFixed(3) },
        { label: "CBFEM-correlated weld", value: local.correlation.governingDcr.toFixed(3) },
      ]}
      checkProps={{
        status: gov.status,
        demand: gov.governingDcr * gov.governingCapacity,
        cap: gov.governingCapacity,
        dcr: gov.governingDcr,
        label: gov.status === "OK" ? "Governing local segment adequate" : "Governing local segment exceeds capacity",
      }}
    />
  );
}

function FaceSummaryGrid({ local }) {
  if (!local) return null;
  return (
    <div className="checks-grid" style={{ marginTop: "8px" }}>
      {local.faceSummaries.map((face) => (
        <div key={face.faceId} className="card check-block-card">
          <div className="check-block-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span className="header-title">{face.faceLabel}</span>
              <span className="header-ref">Read-only local weld elements</span>
            </div>
            <span className={`status-badge-mini ${face.maxDcr <= 1 ? "pass" : "fail"}`}>
              {dcrStatus(face.maxDcr)}
            </span>
          </div>
          <div className="metrics-and-status-container" style={{ marginTop: "8px" }}>
            <div className="stat-cards-vertical">
              <StatCard label="Elements" value={String(face.elementCount)} />
              <StatCard label="Physical L" value={`${face.physicalLength.toFixed(3)} in`} />
              <StatCard label="Effective L" value={`${face.effectiveLength.toFixed(3)} in`} />
              <StatCard label="Max DCR" value={face.maxDcr.toFixed(3)} />
            </div>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px" }}>
            Governing element: <strong>{face.governingElementId}</strong>. Average face DCR: {face.averageDcr.toFixed(3)}.
          </div>
        </div>
      ))}
    </div>
  );
}

function SegmentDetailTable({ local }) {
  if (!local) return null;
  const topSegments = [...local.elements]
    .sort((a, b) => b.governingDcr - a.governingDcr)
    .slice(0, 8);
  return (
    <div className="card" style={{ marginTop: "8px" }}>
      <div className="card-section-label">Critical local elements</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", textAlign: "left", borderBottom: "1px solid var(--border-color)" }}>
              <th style={{ padding: "6px" }}>Element</th>
              <th style={{ padding: "6px" }}>Face</th>
              <th style={{ padding: "6px" }}>Force</th>
              <th style={{ padding: "6px" }}>Theta</th>
              <th style={{ padding: "6px" }}>Weld</th>
              <th style={{ padding: "6px" }}>CBFEM-corr.</th>
              <th style={{ padding: "6px" }}>Base T</th>
              <th style={{ padding: "6px" }}>Base V</th>
              <th style={{ padding: "6px" }}>Gov</th>
            </tr>
          </thead>
          <tbody>
            {topSegments.map((el) => (
              <tr key={el.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                <td style={{ padding: "6px", fontWeight: 700 }}>{el.id}</td>
                <td style={{ padding: "6px" }}>{el.faceLabel}</td>
                <td style={{ padding: "6px" }}>{el.requiredForce.toFixed(3)} k</td>
                <td style={{ padding: "6px" }}>{el.thetaDeg.toFixed(1)} deg</td>
                <td style={{ padding: "6px" }}>{el.weldDcr.toFixed(3)}</td>
                <td style={{ padding: "6px" }}>{el.correlatedWeldDcr.toFixed(3)}</td>
                <td style={{ padding: "6px" }}>{el.baseTensionDcr.toFixed(3)}</td>
                <td style={{ padding: "6px" }}>{el.baseShearDcr.toFixed(3)}</td>
                <td style={{ padding: "6px", fontWeight: 800, color: el.governingDcr <= 1 ? "var(--success)" : "var(--danger)" }}>
                  {el.governingDcr.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HSSLocalWeldTab({
  activeTab,
  setActiveTab,
  tabs,
  setLegendOpen,
  setRefsOpen,
  darkMode,
  toggleDarkMode,
  reportMeta,
  setReportMeta,
}) {
  const diagramRef = useRef(null);
  const [analysisMode, setAnalysisMode] = useState(MODE_LOCAL);
  const [branchIdx, setBranchIdx] = useState(defaultHssIndex("HSS8x2x1/8"));
  const [branchGradeIdx, setBranchGradeIdx] = useState(5);
  const [plateT, setPlateT] = useState(0.5);
  const [plateGradeIdx, setPlateGradeIdx] = useState(0);
  const [legSize, setLegSize] = useState(0.3125);
  const [fexx, setFexx] = useState(70);
  const [appliedShearX, setAppliedShearX] = useState(0);
  const [appliedShearY, setAppliedShearY] = useState(0);
  const [appliedTension, setAppliedTension] = useState(10);
  const [appliedMomentX, setAppliedMomentX] = useState(0);
  const [appliedMomentY, setAppliedMomentY] = useState(0);

  const branch = HSS_SHAPES[branchIdx] || HSS_SHAPES[0];
  const branchGrade = STEEL_GRADES[branchGradeIdx] || STEEL_GRADES[0];
  const plateGrade = STEEL_GRADES[plateGradeIdx] || STEEL_GRADES[0];
  const branchTransverseDim = "B";
  const lengthMode = "k5";
  const appliedShear = Math.hypot(appliedShearX, appliedShearY);
  const appliedMip = Math.hypot(appliedMomentX, appliedMomentY);

  const groupCalcs = useHSSCalculation({
    connType: "hss2plate",
    lengthMode,
    branchIdx,
    branchGradeIdx,
    chordIdx: branchIdx,
    chordGradeIdx: branchGradeIdx,
    plateT,
    plateGradeIdx,
    branchTransverseDim,
    legSize,
    fexx,
      appliedShear,
    appliedTension,
    appliedMip,
  });
  const { shared, shear, tension, ipMoment, k4Unity } = groupCalcs;

  let local = null;
  let localError = null;
  let size = null;
  let sizeError = null;
  try {
    local = calcHssToPlateLocalWeldCheck({
      branch,
      branchGrade,
      plateT,
      plateGrade,
      legSize,
      fexx,
      appliedShearX,
      appliedShearY,
      appliedTension,
      appliedMomentX,
      appliedMomentY,
      method: "lrfd",
    });
  } catch (error) {
    localError = error instanceof Error ? error.message : String(error);
  }
  try {
    size = calcWeldSize({ legSize, baseT: Math.min(plateT, branch.tNom ?? branch.tDes) });
  } catch (error) {
    sizeError = error instanceof Error ? error.message : String(error);
  }

  const anyLoad = appliedShear > 0 || appliedTension > 0 || appliedMip > 0;
  const validationWarnings = [...(local?.validation?.warnings ?? []), ...(local?.correlation?.warnings ?? [])];

  return (
    <div className="app-layout">
      <aside className="app-sidebar compact">
        <div className="app-sidebar-header">
          <h1 style={{ fontSize: "13.5px", letterSpacing: "-0.01em", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <span>WeldCapacity &amp; Plate Rigidity Check</span>
            <span className="version-badge" style={{ fontSize: "9px", padding: "1px 5px" }}>v2.5</span>
          </h1>
          <div className="header-subtitle">
            AISC 360-22 + Manual Part 8 — HSS-to-plate local welds
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.1fr 0.6fr", gap: "6px", width: "100%", alignItems: "center" }} className="mt-1">
            <button
              onClick={() => setLegendOpen(true)}
              className="btn-legend-trigger"
              type="button"
              style={{ padding: "4px 4px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", width: "100%", height: "26px" }}
            >
              Legend
            </button>
            <button
              onClick={() => setRefsOpen(true)}
              className="btn-legend-trigger"
              type="button"
              style={{ padding: "4px 4px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", width: "100%", height: "26px" }}
            >
              Refs
            </button>
            <ReportActions
              reportMeta={reportMeta}
              setReportMeta={setReportMeta}
              diagramRef={diagramRef}
              buildModel={(meta, diagramSvgString) => buildHSSLocalWeldReport({
                state: {
                  branch,
                  branchGrade,
                  plateT,
                  plateGrade,
                  legSize,
                  fexx,
                  appliedShear,
                  appliedShearX,
                  appliedShearY,
                  appliedTension,
                  appliedMip,
                  appliedMomentX,
                  appliedMomentY,
                  analysisMode,
                },
                calcs: {
                  local,
                  localError,
                  group: groupCalcs,
                },
                meta,
                diagramSvgString,
              })}
            />
            <button
              onClick={toggleDarkMode}
              className="btn-legend-trigger theme-toggle-btn"
              type="button"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              style={{ padding: "4px 4px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "26px" }}
            >
              {darkMode ? "Light" : "Dark"}
            </button>
          </div>
        </div>

        <nav className="tab-bar-horizontal">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`tab-nav-btn-horizontal ${activeTab === t.id ? "active" : ""}`}
              type="button"
              style={{ height: "42px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", lineHeight: "1.2", whiteSpace: "normal", padding: "2px 4px", fontSize: "10px" }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="card compact shadow-sm border-0">
          <div className="card-section-label">HSS-to-plate geometry</div>
          <div className="sidebar-two-col-grid">
            <HssMemberSelect label="HSS member" value={branchIdx} onChange={setBranchIdx} id="local-hss-member" />
            <SteelGradeSelect label="HSS grade" value={branchGradeIdx} onChange={setBranchGradeIdx} id="local-hss-grade" category="hss" />
          </div>
          <div className="sidebar-two-col-grid" style={{ marginTop: "8px" }}>
            <PlateThicknessSelect label="Plate tp" value={plateT} onChange={setPlateT} id="local-plate-t" />
            <SteelGradeSelect label="Plate grade" value={plateGradeIdx} onChange={setPlateGradeIdx} id="local-plate-grade" category="plate" />
          </div>
          <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "8px", lineHeight: "1.35" }}>
            B is transverse to the plate weld group; H is the longitudinal/depth direction for local bending.
          </div>
        </div>

        <div className="card compact shadow-sm border-0">
          <div className="card-section-label">Weld parameters</div>
          <div className="sidebar-two-col-grid">
            <Field label="Leg size, w" id="local-leg-size">
              <select
                id="local-leg-size"
                value={legSize}
                onChange={(e) => setLegSize(parseFloat(e.target.value))}
                className="form-select compact"
              >
                {LEG_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Electrode" id="local-fexx">
              <select
                id="local-fexx"
                value={fexx}
                onChange={(e) => setFexx(parseFloat(e.target.value))}
                className="form-select compact"
              >
                {FEXX_OPTIONS.map((f) => <option key={f} value={f}>E{f}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "6px", marginTop: "6px", fontSize: "11px", lineHeight: "1.5" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Local elements:</span>
              <strong>{local ? local.mesh.totalElements : "—"} read-only</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Be local:</span>
              <strong>{local ? `${local.section.be.toFixed(3)} in` : "—"}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Model factor:</span>
              <strong>{local ? local.modelFactors.moment.toFixed(2) : "—"}</strong>
            </div>
          </div>
        </div>
      </aside>

      <main className="app-main-content">
        <div className="top-controls-grid hss-top-grid" style={{ gridTemplateColumns: "1fr 1.35fr" }}>
          <div ref={diagramRef} style={{ display: "contents" }}>
            <HssSvgDiagram
              branch={branch}
              appliedShear={appliedShear}
              appliedTension={appliedTension}
              appliedMip={appliedMip}
              connType="hss2plate"
            />
          </div>
          <div className="card compact top-grid-card" style={{ display: "flex", flexDirection: "column", gap: "10px", height: "100%", boxSizing: "border-box" }}>
            <div className="card-section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Applied HSS-to-Plate Loads (LRFD)</span>
              <span style={{ fontSize: "9.5px", fontWeight: "500", color: "var(--text-muted)", letterSpacing: 0 }}>
                Enter resultants at the weld group.
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
              <div>
                <label htmlFor="local-load-shear-x" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-dark)", display: "block", marginBottom: "3px" }}>
                  V<sub style={{ fontSize: "9px" }}>x</sub> (kips)
                </label>
                <NonNegativeNumberInput id="local-load-shear-x" value={appliedShearX} step="0.5" onChange={setAppliedShearX} className="form-input" />
              </div>
              <div>
                <label htmlFor="local-load-shear-y" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-dark)", display: "block", marginBottom: "3px" }}>
                  V<sub style={{ fontSize: "9px" }}>y</sub> (kips)
                </label>
                <NonNegativeNumberInput id="local-load-shear-y" value={appliedShearY} step="0.5" onChange={setAppliedShearY} className="form-input" />
              </div>
              <div>
                <label htmlFor="local-load-tension" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-dark)", display: "block", marginBottom: "3px" }}>
                  Tension, N<sub style={{ fontSize: "9px" }}>u</sub> (kips)
                </label>
                <NonNegativeNumberInput id="local-load-tension" value={appliedTension} step="0.5" onChange={setAppliedTension} className="form-input" />
              </div>
              <div>
                <label htmlFor="local-load-mx" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-dark)", display: "block", marginBottom: "3px" }}>
                  M<sub style={{ fontSize: "9px" }}>x</sub> (ft-kips)
                </label>
                <NonNegativeNumberInput id="local-load-mx" value={appliedMomentX} step="0.5" onChange={setAppliedMomentX} className="form-input" />
              </div>
              <div>
                <label htmlFor="local-load-my" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-dark)", display: "block", marginBottom: "3px" }}>
                  M<sub style={{ fontSize: "9px" }}>y</sub> (ft-kips)
                </label>
                <NonNegativeNumberInput id="local-load-my" value={appliedMomentY} step="0.5" onChange={setAppliedMomentY} className="form-input" />
              </div>
            </div>
            <div style={{ fontSize: "10.5px", color: "var(--text-muted)", lineHeight: "1.35", padding: "6px 8px", background: "var(--surface-subtle)", borderRadius: "var(--radius-sm)" }}>
              Local discretization uses read-only code constants. Directional loads are resolved to local weld axes; the global group comparison uses resultant shear and moment.
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: "10px", marginTop: "-8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setAnalysisMode(MODE_GROUP)}
              className={`toggle-option-btn compact ${analysisMode === MODE_GROUP ? "active" : ""}`}
              style={{ minHeight: "44px", fontWeight: 800, letterSpacing: "0.02em" }}
            >
              WELD GROUPD CHECK AISC DESIGN GUIDE
            </button>
            <button
              type="button"
              onClick={() => setAnalysisMode(MODE_LOCAL)}
              className={`toggle-option-btn compact ${analysisMode === MODE_LOCAL ? "active" : ""}`}
              style={{ minHeight: "44px", fontWeight: 800, letterSpacing: "0.02em" }}
            >
              AISC MANUAL PART 8 LOCAL WELD DISCRETIZATION
            </button>
          </div>
        </div>

        {localError && (
          <div className="error-alert">
            <strong>Local weld calculation error:</strong> {localError}
          </div>
        )}
        {sizeError && (
          <div className="error-alert">
            <strong>Weld size calculation error:</strong> {sizeError}
          </div>
        )}
        {validationWarnings.length > 0 && (
          <WarningBanner title="Local model validation envelope warning" items={validationWarnings} />
        )}

        {!anyLoad && (
          <div className="card" style={{ padding: "14px 18px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px", lineHeight: "1.5" }}>
            Enter at least one load to run the HSS-to-plate local weld check.
          </div>
        )}

        {analysisMode === MODE_GROUP && (
          <>
            <CombinedLoadingCard
              terms={k4Unity.terms}
              unity={k4Unity.unity}
              status={k4Unity.status}
              hasAnyTerm={k4Unity.hasAnyTerm}
              connType="hss2plate"
            />
            <div className="checks-grid" style={{ marginTop: "8px" }}>
              {shared.effLenBlock && (
                <CheckBlock
                  title={shared.effLenBlock.title}
                  codeRef={shared.effLenBlock.codeRef}
                  traceSteps={shared.effLenBlock.traceSteps}
                  statCards={shared.effLenBlock.statCards}
                  checkProps={null}
                />
              )}
              {size && (
                <CheckBlock
                  title="Weld size limits"
                  codeRef="AISC 360 Section J2.2b, Table J2.4"
                  traceSteps={[
                    { eq: `Provided: w = ${toFraction(legSize)}`, codeRef: "Selected fillet weld size", value: to16ths(legSize) },
                    { eq: `w >= w_min (${size.minLabel})`, codeRef: "AISC Table J2.4", value: size.minOk ? "OK" : "NG" },
                    { eq: `w <= w_max (${size.maxLabel})`, codeRef: "AISC Section J2.2b", value: size.maxOk ? "OK" : "NG" },
                  ]}
                  statCards={[
                    { label: "Min weld", value: toFraction(size.minSize) },
                    { label: "Max weld", value: toFraction(size.maxSize) },
                    { label: "Provided", value: toFraction(legSize) },
                  ]}
                  checkProps={{ status: size.status, demand: 0, cap: 0, dcr: null, label: size.status === "OK" ? "Weld size within limits" : "Weld size outside limits" }}
                />
              )}
            </div>
            {shear && <GroupCapacityCard groupCap={shared.groupCap} solicitation="shear" appliedLoad={appliedShear} appliedMoment={0} fexx={fexx} error={shared.groupCapError} connType="hss2plate" />}
            {tension && <GroupCapacityCard groupCap={shared.groupCap} solicitation="tension" appliedLoad={appliedTension} appliedMoment={0} fexx={fexx} error={shared.groupCapError} connType="hss2plate" />}
            {ipMoment && <GroupCapacityCard groupCap={shared.groupCap} solicitation="moment" appliedLoad={0} appliedMoment={appliedMip} fexx={fexx} error={shared.groupCapError} connType="hss2plate" />}
          </>
        )}

        {analysisMode === MODE_LOCAL && (
          <>
            <LocalGoverningCard local={local} />
            {local && (
              <div className="card" style={{ marginTop: "8px", fontSize: "11.5px", lineHeight: "1.45", color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--text-main)" }}>Assumptions:</strong> AISC Manual Part 8 elastic weld-group demand; AISC Section J2/J4 segment strengths; code DCR keeps kds locked to 1.0; CBFEM-correlated weld DCR applies the Hilti directional weld term and benchmark factor; transverse HSS faces concentrated to Be; mesh density is read-only and regression-tested.
              </div>
            )}
            <FaceSummaryGrid local={local} />
            <SegmentDetailTable local={local} />
          </>
        )}
      </main>
    </div>
  );
}
