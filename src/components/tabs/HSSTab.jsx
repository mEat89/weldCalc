import { useState, useRef } from "react";
import {
  LEG_SIZES,
  FEXX_OPTIONS,
} from "../../constants/steelData";
import { toFraction, to16ths } from "../../math/weldMath";
import { useHSSCalculation } from "./useHSSCalculation";
import { Field, PlateThicknessSelect, HssMemberSelect, SteelGradeSelect, NonNegativeNumberInput } from "../shared/FormElements";
import { CheckBlock, WarningBanner, InfoTooltip, CombinedLoadingCard, GroupCapacityCard } from "../shared/CheckResults";
import HssSvgDiagram from "../shared/HssSvgDiagram";
import ReportActions from "../shared/ReportActions";
import { buildHSSReport } from "../../reports/buildHSSReport";

const TOOLTIP_DATA = {
  aiscMode: [
    { text: "Checks the HSS weld group using the full transverse group width, Be = Bb. This is the direct full-length group path for the current V, N, and M_ip workflow." },
    { label: "AISC Reference", text: "AISC 360 Section J2.4." }
  ],
  k5Mode: [
    { text: "Applies the Chapter K effective width reduction, Be (Eq. K1-1), to the transverse group width used by §K5-5 and §K5-6. This reduces group capacity where chord/plate flexibility concentrates force near the sidewalls." },
    { label: "HSS-to-plate", text: "Applying Eq. K1-1 with the plate treated as the chord is beyond strict §K5 scope (Eq. K1-1 is defined for HSS chord faces only). This is offered as conservative engineering judgment — it under-reports L_eff and biases the DCR conservative." },
    { label: "AISC Reference", text: "AISC 360 Section K5 & Table K5.1 (Eq. K1-1)." }
  ],
  effLength: [
    { text: "Determines the total effective weld-group length used by AISC §K5 Eq. K5-5: le = 2·Hb/sinθ + 2·Be. This single group length drives the V, N, and M_ip checks." },
    { label: "AISC Reference", text: "AISC 360 Table K5.1 and Eq. K5-5." }
  ],
  weldMetal: [
    { text: "Checks the full HSS weld group. Axial loads use §K5-1 / §K5-5 (Pn = Fnw·tw·le). In-plane moment uses §K5-2 / §K5-6 (Mn-ip = Fnw·Sip). k_ds is locked to 1.0 for this HSS group workflow." },
    { label: "Group workflow", text: "The entered V, N, and M_ip are global connection actions applied to the full weld group." },
    { label: "Torsion scope", text: "The moment input is weld-group bending represented by a tension/compression couple across the weld group. Torsion about the HSS longitudinal axis is not checked." },
    { label: "AISC Reference", text: "AISC 360 §J2.4, §K5 Eq. K5-2 / K5-6, Table K5.1." }
  ],
  baseMetal: [
    { text: "Verifies the connected thinner base material (branch wall, chord face, or plate) does not fail local to the weld. The check routes between §J4.1 (tensile yielding/rupture, no 0.6 factor, φ = 0.90/0.75) for tension and moment-couple demand, and §J4.2 (shear yielding/rupture, 0.6 factor, φ = 1.00/0.75) for shear. Previously the app applied the §J4.2 shear formulas to all solicitations — that was a code-compliance bug, since tension and moment-couple demand are axial, not shear." },
    { label: "Tension vs shear", text: "§J4.1 tensile yielding: φRn = 0.90·Fy·A. §J4.2 shear yielding: φRn = 1.00·0.60·Fy·A. The tension cap is ~1.5× the shear cap for the same geometry." },
    { label: "AISC Reference", text: "AISC 360 §J4.1 (tension) and §J4.2 (shear)." }
  ],
  weldSize: [
    { text: "Ensures the selected fillet weld leg size is within code limits to guarantee joint structural integrity. The leg size is checked against minimum size requirements (based on thicker parts to prevent rapid cooling cracks) and maximum size limits (based on thinner parts to prevent weld throat wash-away)." },
    { label: "AISC Reference", text: "AISC 360 Section J2.2b & Table J2.4." }
  ]
};

export default function HSSTab({ activeTab, setActiveTab, tabs, setLegendOpen, setRefsOpen, darkMode, toggleDarkMode, reportMeta, setReportMeta }) {
  const diagramRef = useRef(null);
  // Connection sub-type
  const [connType, setConnType] = useState("hss2hss"); // hss2plate | hss2hss

  // Effective length method: 'aisc' | 'k5'
  const [lengthMode, setLengthMode] = useState("aisc");

  // Geometry state indexes
  const [branchIdx, setBranchIdx] = useState(11); // HSS6x6x1/4 default
  const [branchGradeIdx, setBranchGradeIdx] = useState(6); // A500 Gr C Rect default
  const [chordIdx, setChordIdx] = useState(26); // HSS10x10x3/8 default
  const [chordGradeIdx, setChordGradeIdx] = useState(6);
  const [plateT, setPlateT] = useState(0.5);
  const [plateGradeIdx, setPlateGradeIdx] = useState(0);

  // AISC rectangular HSS convention: B is the width across the weld group and
  // H is the longitudinal/depth dimension used for §K5 group bending.
  const branchTransverseDim = "B";

  // Weld parameters
  const [legSize, setLegSize] = useState(0.25);
  const [fexx, setFexx] = useState(70);
  // Independent load inputs — auto-computes whichever are non-zero.
  // No "solicitation toggle"; each load drives its own check panel and the
  // final K4-9 verdict auto-aggregates the controlling DCRs.
  const [appliedShear, setAppliedShear] = useState(0);
  const [appliedTension, setAppliedTension] = useState(0);
  const [appliedMip, setAppliedMip] = useState(0);

  const calcs = useHSSCalculation({
    connType, lengthMode,
    branchIdx, branchGradeIdx, chordIdx, chordGradeIdx,
    plateT, plateGradeIdx,
    branchTransverseDim, legSize, fexx,
    appliedShear, appliedTension, appliedMip,
  });
  const { shared, shear, tension, ipMoment, k4Unity } = calcs;
  const {
    branch, chord, branchGrade, chordGrade, plateGrade,
    thetaDeg,
    k5Error, loa,
    faceLenError,
    groupCap, groupCapError,
    baseTNominal,
    size,
    effLenBlock: effLenBlockForReport,
    activeLengthMethods,
  } = shared;
  // Derived: any solicitation active?
  const anySolicitationActive = !!(shear || tension || ipMoment);
  return (
    <div className="app-layout">
      {/* 1. Left Sidebar menu Panel (Extremely Compact) */}
      <aside className="app-sidebar compact">
        <div className="app-sidebar-header">
          <h1 style={{ fontSize: "13.5px", letterSpacing: "-0.01em", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <span>WeldCapacity &amp; Plate Rigidity Check</span>
            <span className="version-badge" style={{ fontSize: "9px", padding: "1px 5px" }}>v2.5</span>
          </h1>
          <div className="header-subtitle">
            AISC 360-22 / 360-16 + DG1 — Rect HSS welds
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.1fr 0.6fr", gap: "6px", width: "100%", alignItems: "center" }} className="mt-1">
            <button
              onClick={() => setLegendOpen(true)}
              className="btn-legend-trigger"
              type="button"
              style={{ padding: "4px 4px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", width: "100%", height: "26px" }}
            >
              📖 Legend
            </button>
            <button
              onClick={() => setRefsOpen(true)}
              className="btn-legend-trigger"
              type="button"
              style={{ padding: "4px 4px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", width: "100%", height: "26px" }}
            >
              📚 Refs
            </button>
            <ReportActions
              reportMeta={reportMeta}
              setReportMeta={setReportMeta}
              diagramRef={diagramRef}
              buildModel={(meta, diagramSvgString) => buildHSSReport({
                state: {
                  connType, lengthMode,
                  branch, branchGrade, chord, chordGrade,
                  plateT, plateGrade,
                  branchTransverseDim, legSize, fexx,
                  appliedShear, appliedTension, appliedMip,
                },
                calcs: {
                  shared, shear, tension, ipMoment, k4Unity,
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
              {darkMode ? "☀️" : "🌙"}
            </button>
          </div>
        </div>

        {/* Navigation Tabs List (Horizontal Grid) */}
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

        {/* Connection Type Selection */}
        <div className="card compact shadow-sm border-0">
          <div className="card-section-label">Connection type</div>
          <div className="toggle-btn-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <button
              onClick={() => setConnType("hss2plate")}
              className={`toggle-option-btn compact ${connType === "hss2plate" ? "active" : ""}`}
              type="button"
              style={{ padding: "6px", fontSize: "11px" }}
            >
              <div className="btn-main-label" style={{ fontSize: "11px", fontWeight: "700" }}>HSS to Plate</div>
            </button>
            <button
              onClick={() => setConnType("hss2hss")}
              className={`toggle-option-btn compact ${connType === "hss2hss" ? "active" : ""}`}
              type="button"
              style={{ padding: "6px", fontSize: "11px" }}
            >
              <div className="btn-main-label" style={{ fontSize: "11px", fontWeight: "700" }}>HSS to HSS</div>
            </button>
          </div>
        </div>

        {/* Geometry selection fields */}
        <div className="card compact shadow-sm border-0">
          <div className="card-section-label">
            {connType === "hss2plate" ? "Member & plate geometry" : "Branch & chord profiles"}
          </div>
          
          <div className="sidebar-two-col-grid">
            <HssMemberSelect
              label={connType === "hss2plate" ? "HSS member" : "Branch HSS"}
              value={branchIdx}
              onChange={setBranchIdx}
              id="hss-member-select"
            />
            <SteelGradeSelect
              label={connType === "hss2plate" ? "HSS grade" : "Branch grade"}
              value={branchGradeIdx}
              onChange={setBranchGradeIdx}
              id="branch-grade-select"
              category="hss"
            />
          </div>

          {connType === "hss2plate" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
              <div className="sidebar-two-col-grid">
                <SteelGradeSelect
                  label="Plate grade"
                  value={plateGradeIdx}
                  onChange={setPlateGradeIdx}
                  id="plate-grade-select"
                  category="plate"
                />
                <PlateThicknessSelect label="Plate tp" value={plateT} onChange={setPlateT} id="plate-thickness-select" />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
              <div className="sidebar-two-col-grid">
                <HssMemberSelect
                  label="Chord HSS"
                  value={chordIdx}
                  onChange={setChordIdx}
                  id="chord-hss-select"
                />
                <SteelGradeSelect
                  label="Chord grade"
                  value={chordGradeIdx}
                  onChange={setChordGradeIdx}
                  id="chord-grade-select"
                  category="hss"
                />
              </div>
              <div className="sidebar-two-col-grid">
                <Field label="Chord t_des">
                  <input value={`${chord.tDes.toFixed(3)}" (${toFraction(chord.tNom)})`} disabled className="form-input compact disabled" />
                </Field>
                <Field label="Chord Fy/Fu">
                  <input value={`${chordGrade.fy}/${chordGrade.fu}`} disabled className="form-input compact disabled" />
                </Field>
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", borderTop: "1px dashed var(--border-color)", paddingTop: "8px", marginTop: "8px" }}>
            <div className="card-section-label" style={{ margin: 0, paddingLeft: "6px", fontSize: "10px" }}>Weld group dimensions</div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", lineHeight: "1.35", padding: "6px 8px", background: "var(--surface-subtle)", borderRadius: "var(--radius-sm)" }}>
              Automatic AISC mapping: <strong>B = Be/Bb</strong> across the weld group, and <strong>H = Hb</strong> for bending depth and longitudinal weld length.
            </div>
          </div>
        </div>

        {/* Effective Length Method Selection */}
        <div className="card compact shadow-sm border-0">
          <div className="card-section-label">Effective length method</div>
          <div className="toggle-btn-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {activeLengthMethods.map((m) => {
              const active = lengthMode === m.id;
              const tooltipSecs = m.id === "k5" ? TOOLTIP_DATA.k5Mode : TOOLTIP_DATA.aiscMode;
              return (
                <button
                  key={m.id}
                  onClick={() => setLengthMode(m.id)}
                  className={`toggle-option-btn compact ${active ? "active" : ""}`}
                  type="button"
                  style={{
                    padding: "6px 24px 6px 6px",
                    fontSize: "10.5px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    width: "100%",
                    minHeight: "36px",
                  }}
                >
                  <span
                    className="btn-main-label"
                    style={{
                      fontSize: "10.5px",
                      fontWeight: "700",
                      textAlign: "center",
                      display: "block",
                      width: "100%",
                      lineHeight: "1.2"
                    }}
                  >
                    {m.short}
                  </span>
                  <div
                    className="info-tooltip-container"
                    style={{
                      position: "absolute",
                      right: "6px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      display: "flex",
                      alignItems: "center",
                    }}
                    onClick={(e) => {
                      // Prevent parent button action from triggering when clicking the tooltip!
                      e.stopPropagation();
                    }}
                  >
                    <InfoTooltip
                      title={`${m.short} — Method Details`}
                      sections={tooltipSecs}
                      align={m.id === "k5" ? "right" : "center"}
                    />
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", lineHeight: "1.4" }}>
            <strong>{activeLengthMethods.find((m) => m.id === lengthMode)?.short}:</strong>{" "}
            {activeLengthMethods.find((m) => m.id === lengthMode)?.description.split(".")[0]}.
          </div>
        </div>

        {/* Weld Parameters (Relocated to sidebar bottom) */}
        <div className="card compact shadow-sm border-0">
          <div className="card-section-label">Weld Parameters</div>
          
          <div className="sidebar-two-col-grid">
            <Field label="Leg Size, w" id="weld-leg-select">
              <select
                id="weld-leg-select"
                value={legSize}
                onChange={(e) => setLegSize(parseFloat(e.target.value))}
                className="form-select compact"
              >
                {LEG_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>

            <Field label="Electrode" id="fexx-select">
              <select
                id="fexx-select"
                value={fexx}
                onChange={(e) => setFexx(parseFloat(e.target.value))}
                className="form-select compact"
              >
                {FEXX_OPTIONS.map((f) => <option key={f} value={f}>E{f}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "4px", display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <span>Group le:</span>
              <strong>{groupCap ? `${groupCap.le.toFixed(3)} in` : "—"}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <span>θ:</span>
              <strong>{thetaDeg}° branch angle</strong>
            </div>
          </div>
        </div>

      </aside>

      {/* 2. Right Main Panel */}
      <main className="app-main-content">

        {/* Primary group-design workflow: diagram + global loads. */}
        <div className="top-controls-grid hss-top-grid" style={{ gridTemplateColumns: "1fr 1.35fr" }}>
          <div ref={diagramRef} style={{ display: "contents" }}>
            <HssSvgDiagram
              branch={branch}
              appliedShear={appliedShear}
              appliedTension={appliedTension}
              appliedMip={appliedMip}
              connType={connType}
            />
          </div>
          <div className="card compact top-grid-card" style={{ display: "flex", flexDirection: "column", gap: "10px", height: "100%", boxSizing: "border-box" }}>
            <div className="card-section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Applied Group Loads (LRFD)</span>
              <span style={{ fontSize: "9.5px", fontWeight: "500", color: "var(--text-muted)", letterSpacing: 0 }}>
                Enter global connection actions. Leave unused loads at 0.
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
            <div>
              <label htmlFor="load-shear" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-dark)", display: "block", marginBottom: "3px" }}>
                Shear, V<sub style={{ fontSize: "9px" }}>u</sub> (kips)
              </label>
              <NonNegativeNumberInput
                id="load-shear"
                value={appliedShear}
                step="0.5"
                onChange={setAppliedShear}
                className="form-input"
                style={{ fontSize: "13.5px", fontWeight: "700", padding: "6px 10px", borderColor: appliedShear > 0 ? "var(--primary)" : "var(--border-color)", backgroundColor: appliedShear > 0 ? "var(--primary-light)" : "var(--card-bg)", width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label htmlFor="load-tension" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-dark)", display: "block", marginBottom: "3px" }}>
                Tension, N<sub style={{ fontSize: "9px" }}>u</sub> (kips)
              </label>
              <NonNegativeNumberInput
                id="load-tension"
                value={appliedTension}
                step="0.5"
                onChange={setAppliedTension}
                className="form-input"
                style={{ fontSize: "13.5px", fontWeight: "700", padding: "6px 10px", borderColor: appliedTension > 0 ? "var(--primary)" : "var(--border-color)", backgroundColor: appliedTension > 0 ? "var(--primary-light)" : "var(--card-bg)", width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label htmlFor="load-mip" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-dark)", display: "block", marginBottom: "3px" }}>
                {connType === "hss2plate" ? (
                  <>Bending M<sub style={{ fontSize: "9px" }}>u</sub> (ft-kips)</>
                ) : (
                  <>In-plane M<sub style={{ fontSize: "9px" }}>ip,u</sub> (ft-kips)</>
                )}
              </label>
              <NonNegativeNumberInput
                id="load-mip"
                value={appliedMip}
                step="0.5"
                onChange={setAppliedMip}
                className="form-input"
                style={{ fontSize: "13.5px", fontWeight: "700", padding: "6px 10px", borderColor: appliedMip > 0 ? "var(--primary)" : "var(--border-color)", backgroundColor: appliedMip > 0 ? "var(--primary-light)" : "var(--card-bg)", width: "100%", boxSizing: "border-box" }}
              />
            </div>
            </div>
            <div style={{ fontSize: "10.5px", color: "var(--text-muted)", lineHeight: "1.35", padding: "6px 8px", background: "var(--surface-subtle)", borderRadius: "var(--radius-sm)" }}>
              {connType === "hss2plate" ? (
                <>The HSS-to-plate module checks V, N, and bending M as resultants at the weld group. These are not member-span end loads, and torsion about the HSS axis is not checked.</>
              ) : (
                <>The HSS module checks one global weld group for the current V, N, and M<sub>ip</sub> inputs.</>
              )}
            </div>
          </div>
        </div>

        {/* Advisory LOA limits banner */}
        {connType === "hss2hss" && loa && !loa.withinLOA && (
          <WarningBanner
            title="Outside §K5 Limits of Applicability — equations are advisory only"
            items={loa.violations}
          />
        )}

        {/* Computational errors display */}
        {(k5Error || faceLenError) && (
          <div className="error-alert">
            <strong>Calculation error:</strong> {k5Error || faceLenError}
          </div>
        )}

        {/* Final verdict first: users see the controlling connection result
            before the detailed cards that explain each term. */}
        <CombinedLoadingCard
          terms={k4Unity.terms}
          unity={k4Unity.unity}
          status={k4Unity.status}
          hasAnyTerm={k4Unity.hasAnyTerm}
          connType={connType}
        />

        {/* Shared upper checks: effective length + weld size limits (Check 3).
            Apply to every solicitation, so they live outside the per-solicitation
            panels and render once. */}
        <div className="checks-grid" style={{ marginTop: "8px" }}>
          {effLenBlockForReport && (
            <CheckBlock
              title={effLenBlockForReport.title}
              codeRef={effLenBlockForReport.codeRef}
              traceSteps={effLenBlockForReport.traceSteps}
              statCards={effLenBlockForReport.statCards}
              checkProps={null}
              tooltipSections={TOOLTIP_DATA.effLength}
            />
          )}
          {size && (
            <CheckBlock
              title="Check 3: Weld size limits"
              codeRef="AISC 360-16 §J2.2b, Table J2.4"
              tooltipSections={TOOLTIP_DATA.weldSize}
              traceSteps={[
                { eq: `Provided: w = ${toFraction(legSize)}`, codeRef: "User selected leg size", value: to16ths(legSize) },
                { eq: `w ≥ w_min (min = ${size.minLabel})`, codeRef: `AISC Table J2.4 (t_nom = ${toFraction(baseTNominal)})`, value: size.minOk ? "OK" : "NG" },
                { eq: `w ≤ w_max (max = ${size.maxLabel})`, codeRef: `AISC §J2.2b (t_nom = ${toFraction(baseTNominal)})`, value: size.maxOk ? "OK" : "NG" },
              ]}
              statCards={[
                { label: "Min weld size", value: toFraction(size.minSize) },
                { label: "Max weld size", value: toFraction(size.maxSize) },
                { label: "Provided", value: toFraction(legSize) },
              ]}
              checkProps={{
                status: size.status, demand: 0, cap: 0, dcr: null,
                label: size.status === "OK" ? "Weld size within limits" : (!size.minOk ? "Below minimum size limit" : "Exceeds maximum allowable size"),
              }}
            />
          )}
        </div>

        {/* Group-capacity detail panels — one per non-zero global load. */}
        {!anySolicitationActive && (
          <div className="card" style={{ marginTop: "12px", padding: "14px 18px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px", lineHeight: "1.5" }}>
            Enter at least one applied group load above (V, N, or M<sub>ip</sub>) to run the weld group checks.
            Zero loads are ignored; the final §K4-9 verdict aggregates active group DCRs automatically.
          </div>
        )}
        {shear && (
          <div style={{ marginTop: "12px" }}>
            <GroupCapacityCard
              groupCap={groupCap}
              solicitation="shear"
              appliedLoad={appliedShear}
              appliedMoment={0}
              fexx={fexx}
              error={groupCapError}
              connType={connType}
            />
          </div>
        )}
        {tension && (
          <div style={{ marginTop: "12px" }}>
            <GroupCapacityCard
              groupCap={groupCap}
              solicitation="tension"
              appliedLoad={appliedTension}
              appliedMoment={0}
              fexx={fexx}
              error={groupCapError}
              connType={connType}
            />
          </div>
        )}
        {ipMoment && (
          <div style={{ marginTop: "12px" }}>
            <GroupCapacityCard
              groupCap={groupCap}
              solicitation="moment"
              appliedLoad={0}
              appliedMoment={appliedMip}
              fexx={fexx}
              error={groupCapError}
              connType={connType}
            />
          </div>
        )}

      </main>
    </div>
  );
}
