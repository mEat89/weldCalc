import React, { useState, useRef } from "react";
import { HSS_SHAPES, STEEL_GRADES } from "../../constants/steelData";
import { toFraction } from "../../math/weldMath";
import { calcAnchorTensionAuto, calcMethodB, calcDG1, calcRigidityVerdict } from "../../math/plateMath";
import { Field, InchInput, PlateThicknessSelect } from "../shared/FormElements";
import { CheckBlock } from "../shared/CheckResults";
import RigiditySvgDiagram from "../shared/RigiditySvgDiagram";
import ReportActions from "../shared/ReportActions";
import { buildRigidityReport } from "../../reports/buildRigidityReport";

export default function PlateRigidityTab({ activeTab, setActiveTab, tabs, setLegendOpen, setRefsOpen, darkMode, toggleDarkMode, reportMeta, setReportMeta }) {
  const diagramRef = useRef(null);
  // Column (HSS) state
  const [columnIdx, setColumnIdx] = useState(61); // HSS 12x8x5/8 default
  const [columnOrientation, setColumnOrientation] = useState("H_along_M"); // H_along_M or B_along_M

  // Plate geometry
  const [Nplate, setNplate] = useState(36);
  const [Bplate, setBplate] = useState(24);
  const [tp, setTp] = useState(1.25);
  const [plateGradeIdx, setPlateGradeIdx] = useState(0); // A36 default

  // Applied loads
  const [Mu_ftkip, setMu_ftkip] = useState(125);
  const [Pu, setPu] = useState(1.6);
  const [Vu, setVu] = useState(15.0);

  // Anchor geometry
  const [anchorOffsetY, setAnchorOffsetY] = useState(10);
  const [beff, setBeff] = useState(24);
  const [beffAuto, setBeffAuto] = useState(true);

  // Tension source
  const [tuMode, setTuMode] = useState("auto");
  const [tuManual, setTuManual] = useState(0);

  // Derived metrics
  const Mu = Mu_ftkip * 12; // convert to kip·in
  const plateGrade = STEEL_GRADES[plateGradeIdx] || STEEL_GRADES[0];
  const column = HSS_SHAPES[columnIdx] || HSS_SHAPES[0];
  const colDimAlongM = columnOrientation === "H_along_M" ? column.H : column.B;
  const x = Math.max(anchorOffsetY - colDimAlongM / 2, 0);

  // Auto-estimate anchor tension Tu
  let tAuto = null, tAutoError = null;
  try {
    tAuto = calcAnchorTensionAuto({
      Mu, Pu, anchorOffsetY, Nplate,
    });
  } catch (e) { tAutoError = e instanceof Error ? e.message : String(e); }

  const Tu = tuMode === "manual" ? tuManual : (tAuto ? tAuto.Tu : 0);
  const beffUsed = beffAuto ? Bplate : beff;

  // Run checks
  let mB = null, dg1 = null, errors = [];
  try {
    mB = calcMethodB({ Tu, x, beff: beffUsed, Fyp: plateGrade.fy, tp });
  } catch (e) { errors.push("Method B: " + (e instanceof Error ? e.message : String(e))); }

  try {
    dg1 = calcDG1({ Tu, x, beff: beffUsed, Fyp: plateGrade.fy, tp, phi: 0.9 });
  } catch (e) { errors.push("DG1: " + (e instanceof Error ? e.message : String(e))); }

  const verdict = (mB && dg1) ? calcRigidityVerdict(mB, dg1) : null;

  return (
    <div className="app-layout">
      {/* 1. Left Sidebar Inputs (Compact) */}
      <aside className="app-sidebar compact">
        <div className="app-sidebar-header">
          <h1>
            Weld Capacity
            <span className="version-badge">v2.5</span>
          </h1>
          <div className="header-subtitle">
            AISC DG1 — Base plate rigidity check
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
              buildModel={(meta, diagramSvgString) => buildRigidityReport({
                state: {
                  column, columnOrientation,
                  Nplate, Bplate, tp, plateGrade,
                  Mu_ftkip, Pu, Vu,
                  anchorOffsetY, beff, beffAuto,
                  tuMode, tuManual,
                },
                calcs: { tAuto, mB, dg1, verdict, Mu, Tu, x, beffUsed, colDimAlongM },
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

        {/* Tab selection buttons (Horizontal Grid) */}
        <nav className="tab-bar-horizontal">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`tab-nav-btn-horizontal ${activeTab === t.id ? "active" : ""}`}
              type="button"
            >
              {t.id === "hss" ? "HSS" : t.id === "standard" ? "Standard" : "Rigidity"}
            </button>
          ))}
        </nav>

        {/* Column HSS selector card */}
        <div className="card compact shadow-sm border-0">
          <div className="card-section-label">Column (HSS)</div>
          
          <div className="sidebar-two-col-grid">
            <Field label="Shape" id="column-shape">
              <select
                id="column-shape"
                value={columnIdx}
                onChange={(e) => setColumnIdx(+e.target.value)}
                className="form-select compact"
              >
                {HSS_SHAPES.map((s, i) => (
                  <option key={i} value={i}>{s.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Orientation" id="column-orientation">
              <select
                id="column-orientation"
                value={columnOrientation}
                onChange={(e) => setColumnOrientation(e.target.value)}
                className="form-select compact"
              >
                <option value="H_along_M">H={column.H}" along M</option>
                <option value="B_along_M">B={column.B}" along M</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Plate geometry card */}
        <div className="card compact shadow-sm border-0">
          <div className="card-section-label">Plate geometry &amp; material</div>
          
          <div className="sidebar-two-col-grid">
            <InchInput label="N (length along M)" value={Nplate} onChange={setNplate} min={1} step={0.5} id="plate-n" suppress16ths={true} />
            <InchInput
              label="B (width perp to M)"
              value={Bplate}
              onChange={(v) => { setBplate(v); if (beffAuto) setBeff(v); }}
              min={1}
              step={0.5}
              id="plate-b"
              suppress16ths={true}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
            <div className="sidebar-two-col-grid">
              <Field label="Plate material" id="plate-material">
                <select
                  id="plate-material"
                  value={plateGradeIdx}
                  onChange={(e) => setPlateGradeIdx(+e.target.value)}
                  className="form-select compact"
                >
                  {STEEL_GRADES.filter((g) => g.category === "plate").map((g) => {
                    const idx = STEEL_GRADES.indexOf(g);
                    return <option key={idx} value={idx}>{g.shortLabel}</option>;
                  })}
                </select>
              </Field>
              <PlateThicknessSelect label="tp (thickness)" value={tp} onChange={setTp} id="plate-tp-select" />
            </div>
          </div>
        </div>

      </aside>

      {/* 2. Right Main Panel */}
      <main className="app-main-content">

        {/* TOP 3-COLUMN CONTROL PANEL GRID */}
        <div className="top-controls-grid">
          {/* Column 1: Interactive SVG Diagram */}
          <div ref={diagramRef} style={{ display: "contents" }}>
            <RigiditySvgDiagram tp={tp} Nplate={Nplate} column={column} x={x} Tu={Tu} />
          </div>

          {/* Column 2: Applied Loads & Anchor Tension Override */}
          <div className="card compact top-grid-card" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div className="card-section-label">Applied Loads &amp; Demand</div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
              <Field label="Moment, Mu">
                <input
                  type="number"
                  value={Mu_ftkip}
                  onChange={(e) => setMu_ftkip(+e.target.value)}
                  className="form-input compact"
                  step="1"
                  style={{ padding: "4px 6px" }}
                />
              </Field>
              <Field label="Axial load, Pu">
                <input
                  type="number"
                  value={Pu}
                  onChange={(e) => setPu(+e.target.value)}
                  className="form-input compact"
                  step="0.5"
                  style={{ padding: "4px 6px" }}
                />
              </Field>
              <Field label="Shear, Vu">
                <input
                  type="number"
                  value={Vu}
                  onChange={(e) => setVu(+e.target.value)}
                  className="form-input compact"
                  step="1"
                  style={{ padding: "4px 6px" }}
                />
              </Field>
            </div>

            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "4px", marginTop: "2px" }}>
              <div className="toggle-btn-grid" style={{ gridTemplateColumns: "1fr 1.1fr", gap: "4px" }}>
                <button
                  onClick={() => setTuMode("auto")}
                  className={`toggle-option-btn compact ${tuMode === "auto" ? "active" : ""}`}
                  type="button"
                  style={{ padding: "4px", fontSize: "10px" }}
                >
                  <div className="btn-main-label" style={{ fontSize: "10px", fontWeight: "700" }}>Auto Demand</div>
                </button>
                <button
                  onClick={() => setTuMode("manual")}
                  className={`toggle-option-btn compact ${tuMode === "manual" ? "active" : ""}`}
                  type="button"
                  style={{ padding: "4px", fontSize: "10px" }}
                >
                  <div className="btn-main-label" style={{ fontSize: "10px", fontWeight: "700" }}>Manual Override</div>
                </button>
              </div>

              {tuMode === "manual" ? (
                <div style={{ marginTop: "6px" }}>
                  <Field label="Tension Force, Tu (kips)">
                    <input
                      type="number"
                      value={tuManual}
                      onChange={(e) => setTuManual(+e.target.value)}
                      className="form-input compact"
                      step="0.5"
                      style={{ padding: "4px 6px" }}
                    />
                  </Field>
                </div>
              ) : (
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", lineHeight: "1.3" }}>
                  Rigid-plate d_lever = <strong>{(tAuto ? tAuto.dLever : 0).toFixed(2)} in</strong><br />
                  Estimated Tu = <strong>{Tu.toFixed(2)} kip</strong>
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Anchor Row & Cantilever Geometry */}
          <div className="card compact top-grid-card" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div className="card-section-label">Cantilever &amp; Bending Width</div>
            
            <div className="sidebar-two-col-grid">
              <InchInput
                label="Anchor offset, y"
                value={anchorOffsetY}
                onChange={setAnchorOffsetY}
                min={0.25}
                step={0.25}
                id="anchor-y"
                suppress16ths={true}
              />
              <Field label="Cantilever, x">
                <input value={`${x.toFixed(2)} in`} disabled className="form-input compact disabled" style={{ padding: "4px 6px" }} />
              </Field>
            </div>

            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "6px", marginTop: "2px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span>Bending width, beff:</span>
                <strong>{beffUsed.toFixed(1)} in</strong>
              </div>

              <div className="beff-input-row compact">
                <input
                  type="number"
                  value={beffAuto ? Bplate : beff}
                  disabled={beffAuto}
                  onChange={(e) => setBeff(+e.target.value)}
                  className={`form-input compact ${beffAuto ? "disabled" : ""}`}
                  step="0.5"
                />
                <button onClick={() => setBeffAuto(!beffAuto)} className="btn-auto-manual" type="button">
                  {beffAuto ? "Auto" : "Manual"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Applied Moment / Eccentricity Context Card (Compact) */}
        <div className="length-mode-description" style={{ padding: "8px 12px", fontSize: "12px", margin: "0" }}>
          Mu = {Mu_ftkip} ft·kip = <strong>{Mu.toFixed(0)} kip·in</strong>. Eccentricity e = M/P ={" "}
          {Pu > 0.001 ? (Mu / Pu).toFixed(1) : "→ ∞"} in. Kern limit N/6 = {(Nplate / 6).toFixed(2)} in.
        </div>

        {tAutoError && <div className="error-alert"><strong>Tension error:</strong> {tAutoError}</div>}
        {errors.length > 0 && errors.map((e, i) => <div key={i} className="error-alert">{e}</div>)}

        {/* Checks grid (2 columns side-by-side) */}
        <div className="checks-grid">
          {/* Check 1: Method B (elastic plate bending) (Collapsible) */}
          {mB && (
          <CheckBlock
            title="Check 1 — Method B: Elastic Plate Bending"
            codeRef="σmax = 6·Tu·x / (beff·t²) ≤ Fy"
            traceSteps={mB.trivial ? [
              { eq: "T_u = 0 → no tension demand",
                codeRef: "Skipped — no anchor tension",
                value: "trivially OK" },
            ] : [
              { eq: `σ_max = 6 · T_u · x / (b_eff · t_p²)`,
                codeRef: "Elastic bending stress at column face boundary",
                value: `${mB.sigmaMax.toFixed(2)} ksi` },
              { eq: `     = 6 · ${Tu.toFixed(2)} · ${x.toFixed(2)} / (${beffUsed} · ${tp}²)`,
                codeRef: "Substituted metrics",
                value: `${mB.sigmaMax.toFixed(2)} ksi` },
              { eq: `vs F_yp = ${plateGrade.fy} ksi`,
                codeRef: "Plate material yield strength",
                value: `DCR = ${mB.DCR.toFixed(3)}` },
              { eq: `t_req (elastic) = √(6·Tu·x / (beff·Fy))`,
                codeRef: "Solving stress equation for thickness",
                value: `${mB.tReq.toFixed(3)} in` },
            ]}
            statCards={[
              { label: "σ_max", value: mB.trivial ? "—" : `${mB.sigmaMax.toFixed(1)} ksi` },
              { label: "F_yp", value: `${plateGrade.fy} ksi` },
              { label: "DCR (σ/Fy)", value: mB.trivial ? "—" : mB.DCR.toFixed(3) },
            ]}
            checkProps={{
              status: mB.pass ? "OK" : "NG",
              demand: mB.sigmaMax,
              cap: plateGrade.fy,
              dcr: mB.DCR,
              label: mB.pass
                ? "Plate stays elastic under Tu — supports rigid-plate kinematic assumption"
                : "Plate yields locally under Tu — rigid-plate assumption violated",
            }}
          />
        )}

        {/* Check 2: DG1 §3.4 (Collapsible) */}
        {dg1 && (
          <CheckBlock
            title="Check 2 — AISC DG1 §3.4 Plastic Cantilever"
            codeRef="AISC Eq. 3.4.7 form: t ≥ √(4·Tu·x / (φ·Fy·beff))"
            traceSteps={dg1.trivial ? [
              { eq: "T_u = 0 → no tension demand",
                codeRef: "Skipped — no anchor tension",
                value: "trivially OK" },
            ] : [
              { eq: `t_req = √(4 · T_u · x / (φ · F_yp · b_eff))`,
                codeRef: "DG1 §3.4 plastic moment unit width, φ=0.9",
                value: `${dg1.tReq.toFixed(3)} in` },
              { eq: `     = √(4 · ${Tu.toFixed(2)} · ${x.toFixed(2)} / (0.9 · ${plateGrade.fy} · ${beffUsed}))`,
                codeRef: "Substituted design metrics",
                value: `${dg1.tReq.toFixed(3)} in` },
              { eq: `t_provided = ${tp} in`,
                codeRef: "Provided plate thickness",
                value: `${tp} in` },
            ]}
            statCards={[
              { label: "t_req (DG1)", value: dg1.trivial ? "—" : `${dg1.tReq.toFixed(3)} in` },
              { label: "t_provided", value: `${tp} in` },
              { label: "DCR", value: dg1.trivial ? "—" : dg1.DCR.toFixed(3) },
            ]}
            checkProps={{
              status: dg1.pass ? "OK" : "NG",
              demand: dg1.tReq,
              cap: tp,
              dcr: dg1.DCR,
              label: dg1.pass
                ? "Plate adequate per DG1 §3.4 limits"
                : "Plate fails DG1 §3.4 — base plate yields plastically, not rigid",
            }}
          />
        )}
        </div>

        {/* Rigidity Verdict Panel */}
        {verdict && (
          <div className={`verdict-summary-card ${verdict.color === "ok" ? "pass" : "fail"}`} style={{ marginTop: "12px", padding: "10px 14px" }}>
            <div className="verdict-title" style={{ fontSize: "14px" }}>
              Rigidity verdict: <strong style={{ color: verdict.color === "ok" ? "var(--success)" : "var(--danger)" }}>{verdict.verdict}</strong>
              <span className="verdict-details" style={{ fontSize: "11px", marginLeft: "10px", color: "var(--text-muted)" }}>
                Method B {mB.pass ? "✓" : "✗"}  ·  DG1 {dg1.pass ? "✓" : "✗"}
              </span>
            </div>
            <div className="verdict-note" style={{ fontSize: "11px", marginTop: "4px", lineHeight: "1.4" }}>{verdict.note}</div>
          </div>
        )}

        {/* Engineering Footnote Card (Collapsible) */}
        <div className="card compact shadow-sm border-0" style={{ padding: "10px 12px" }}>
          <div className="card-section-label" style={{ fontSize: "10px", marginBottom: "6px" }}>Notes on rigidity checks</div>
          <ul className="notes-list" style={{ fontSize: "11px", gap: "3px" }}>
            <li>Method B asks for ~16% more thickness than plastic DG1 design limits.</li>
            <li>If Method B yields, rigid reactions under hand calculations are unconservative — use stiffeners or thicker base plate.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
