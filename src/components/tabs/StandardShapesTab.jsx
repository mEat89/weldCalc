import React, { useState } from "react";
import { STEEL_GRADES, LEG_SIZES, FEXX_OPTIONS, SHAPE_PRESETS, LOAD_CASES } from "../../constants/steelData";
import { calcWeldMetal, calcBaseMetal, calcWeldSize, toFraction, to16ths } from "../../math/weldMath";
import { Field, InchInput } from "../shared/FormElements";
import { CheckBlock } from "../shared/CheckResults";
import ShapesSvgDiagram from "../shared/ShapesSvgDiagram";

export default function StandardShapesTab({ activeTab, setActiveTab, tabs, setLegendOpen, setRefsOpen, darkMode, toggleDarkMode }) {
  const [shapeIdx, setShapeIdx] = useState(0);
  const [loadCase, setLoadCase] = useState("long");
  const [legSize, setLegSize] = useState(0.25);
  const [length, setLength] = useState(8);
  const [nLines, setNLines] = useState(2);
  const [angleDeg, setAngleDeg] = useState(45);
  const [fexx, setFexx] = useState(70);
  const [method, setMethod] = useState("lrfd");
  const [appliedLoad, setAppliedLoad] = useState(0);
  const [useDirectional, setUseDirectional] = useState(true);

  const [memberT, setMemberT] = useState(0.5);
  const [memberGradeIdx, setMemberGradeIdx] = useState(2);
  const [plateT, setPlateT] = useState(0.5);
  const [plateGradeIdx, setPlateGradeIdx] = useState(0);

  const memberGrade = STEEL_GRADES[memberGradeIdx] || STEEL_GRADES[0];
  const plateGrade = STEEL_GRADES[plateGradeIdx] || STEEL_GRADES[0];
  const shape = SHAPE_PRESETS[shapeIdx] || SHAPE_PRESETS[0];

  const thetaDeg = loadCase === "long" ? 0 : loadCase === "trans" ? 90 : angleDeg;

  const baseT = Math.min(memberT, plateT);
  const baseFu = memberT <= plateT ? memberGrade.fu : plateGrade.fu;
  const baseFy = memberT <= plateT ? memberGrade.fy : plateGrade.fy;
  const baseLabel = memberT <= plateT ? "Member (thinner)" : "Plate (thinner)";

  let weld = null, base = null, size = null, calcError = null;
  try {
    weld = calcWeldMetal({
      legSize, length, fexx, thetaDeg, nLines, method, useDirectional, appliedLoad,
    });
    base = calcBaseMetal({ baseT, fy: baseFy, fu: baseFu, length, nLines, method, appliedLoad });
    size = calcWeldSize({ legSize, baseT });
  } catch (e) { calcError = e instanceof Error ? e.message : String(e); }

  let governing = null;
  if (weld && base) {
    const govCap = Math.min(weld.cap, base.cap);
    const which = weld.cap <= base.cap ? "Weld metal (§J2.4)" : `Base metal — ${baseLabel} (§J4.2)`;
    const govDcr = appliedLoad > 0 ? appliedLoad / govCap : null;
    const govStatus = govDcr === null ? null : govDcr <= 1.0 ? "OK" : "NG";
    governing = { which, cap: govCap, dcr: govDcr, status: govStatus };
  }

  const fnwEq = useDirectional
    ? "Fnw = 0.60·FEXX·(1 + 0.5·sin^1.5 θ)" : "Fnw = 0.60·FEXX";
  const fnwRef = useDirectional
    ? `AISC 360-16 §J2.4, Eq. J2-5 (θ = ${thetaDeg}°)`
    : "AISC 360-16 §J2.4 (directional increase suppressed)";
  const designEq = method === "lrfd" ? "φRn = 0.75·Rn" : "Rn/Ω = Rn / 2.00";
  const designRef = method === "lrfd" ? "AISC 360-16 §J2.4 — LRFD resistance factor" : "AISC 360-16 §J2.4 — ASD safety factor";
  const capLabel = method === "lrfd" ? "φRn (LRFD)" : "Rn/Ω (ASD)";

  return (
    <div className="app-layout">
      {/* 1. Left Sidebar menu Panel (Compact) */}
      <aside className="app-sidebar compact">
        <div className="app-sidebar-header">
          <h1>
            Weld Capacity
            <span className="version-badge">v2.5</span>
          </h1>
          <div className="header-subtitle">
            AISC 360-16 — Standard shapes weldments
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr 0.6fr", gap: "6px", width: "100%", alignItems: "center" }} className="mt-1">
            <button
              onClick={() => setLegendOpen(true)}
              className="btn-legend-trigger"
              type="button"
              style={{ padding: "4px 6px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", width: "100%", height: "26px" }}
            >
              📖 Legend
            </button>
            <button
              onClick={() => setRefsOpen(true)}
              className="btn-legend-trigger"
              type="button"
              style={{ padding: "4px 6px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", width: "100%", height: "26px" }}
            >
              📚 References
            </button>
            <button
              onClick={toggleDarkMode}
              className="btn-legend-trigger theme-toggle-btn"
              type="button"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              style={{ padding: "4px 6px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "26px" }}
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

        {/* Shape preset connection type */}
        <div className="card compact shadow-sm border-0">
          <div className="card-section-label">Connection preset</div>
          <div className="toggle-btn-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {SHAPE_PRESETS.map((s, i) => {
              const active = shapeIdx === i;
              return (
                <button
                  key={s.id}
                  onClick={() => setShapeIdx(i)}
                  className={`toggle-option-btn compact ${active ? "active" : ""}`}
                  type="button"
                  style={{ padding: "6px", fontSize: "11px" }}
                >
                  <div className="btn-main-label" style={{ fontSize: "11px", fontWeight: "700" }}>{s.label.split(" to ")[0]}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Thicknesses & Materials */}
        <div className="card compact shadow-sm border-0">
          <div className="card-section-label">Member &amp; connected plate</div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div className="sidebar-two-col-grid">
              <InchInput label="Member thickness" value={memberT} onChange={setMemberT} id="member-thickness" />
              <Field label="Member grade" id="member-grade">
                <select
                  id="member-grade"
                  value={memberGradeIdx}
                  onChange={(e) => setMemberGradeIdx(parseInt(e.target.value))}
                  className="form-select compact"
                >
                  {STEEL_GRADES.map((g, i) => (
                    <option key={i} value={i}>{g.shortLabel}</option>
                  ))}
                </select>
              </Field>
            </div>
            
            <div className="sidebar-two-col-grid">
              <InchInput label="Plate thickness, tp" value={plateT} onChange={setPlateT} id="plate-thickness" />
              <Field label="Plate grade" id="plate-grade">
                <select
                  id="plate-grade"
                  value={plateGradeIdx}
                  onChange={(e) => setPlateGradeIdx(parseInt(e.target.value))}
                  className="form-select compact"
                >
                  {STEEL_GRADES.filter((g) => g.category === "plate").map((g) => {
                    const idx = STEEL_GRADES.indexOf(g);
                    return <option key={idx} value={idx}>{g.shortLabel}</option>;
                  })}
                </select>
              </Field>
            </div>

            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "6px", fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
              <strong>Governing base metal:</strong> {baseLabel}, t = {toFraction(baseT)}, Fy = {baseFy} ksi
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Right Main Panel */}
      <main className="app-main-content">
        {/* TOP 3-COLUMN CONTROL PANEL GRID */}
        <div className="top-controls-grid">
          {/* Column 1: Interactive SVG Diagram */}
          <ShapesSvgDiagram shape={shape} loadCase={loadCase} angleDeg={angleDeg} />

          {/* Column 2: Load case / direction */}
          <div className="card compact top-grid-card" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div className="card-section-label">Load Case &amp; Direction</div>
            <div className="load-case-btn-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "4px" }}>
              {LOAD_CASES.map((c) => {
                const isActive = loadCase === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setLoadCase(c.id)}
                    className={`load-case-btn compact ${isActive ? "active" : ""}`}
                    type="button"
                    style={{
                      padding: "5px 8px",
                      fontSize: "11px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      border: isActive ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: isActive ? "var(--primary-light)" : "var(--card-bg)",
                      color: isActive ? "var(--primary-dark)" : "var(--text-main)",
                      cursor: "pointer"
                    }}
                  >
                    <span style={{ fontWeight: "700" }}>{c.label}</span>
                    <span style={{ fontSize: "10px", opacity: 0.8 }}>{c.angle}</span>
                  </button>
                );
              })}
            </div>
            
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", lineHeight: "1.3" }}>
              {LOAD_CASES.find((c) => c.id === loadCase)?.description}
            </div>

            {loadCase === "trans" && (
              <div style={{ marginTop: "4px", fontSize: "11px", backgroundColor: "var(--primary-light)", border: "1px solid var(--border-color)", color: "var(--primary-dark)", padding: "4px 6px", borderRadius: "var(--radius-sm)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "10px", color: "inherit" }}>
                  <input
                    type="checkbox"
                    checked={!useDirectional}
                    onChange={(e) => setUseDirectional(!e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>Suppress 1.5× directional increase</span>
                </label>
              </div>
            )}
            
            {loadCase === "angle" && (
              <div style={{ marginTop: "4px" }}>
                <label className="form-label" style={{ fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                  <span>Load angle:</span>
                  <strong>{angleDeg}°</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="1"
                  value={angleDeg}
                  onChange={(e) => setAngleDeg(parseInt(e.target.value, 10))}
                  style={{ width: "100%", marginTop: "2px" }}
                />
              </div>
            )}
          </div>

          {/* Column 3: Weld Parameters (Compacted) */}
          <div className="card compact top-grid-card" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div className="card-section-label">Weld Parameters</div>
            
            <div className="sidebar-two-col-grid">
              <Field label="Leg Size, w" id="weld-leg">
                <select
                  id="weld-leg"
                  value={legSize}
                  onChange={(e) => setLegSize(parseFloat(e.target.value))}
                  className="form-select compact"
                  style={{ padding: "4px 6px" }}
                >
                  {LEG_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label.split(" ")[0]}</option>)}
                </select>
              </Field>

              <Field label="Electrode" id="electrode-fexx">
                <select
                  id="electrode-fexx"
                  value={fexx}
                  onChange={(e) => setFexx(parseFloat(e.target.value))}
                  className="form-select compact"
                  style={{ padding: "4px 6px" }}
                >
                  {FEXX_OPTIONS.map((f) => <option key={f} value={f}>E{f}</option>)}
                </select>
              </Field>
            </div>

            <div className="sidebar-two-col-grid" style={{ marginTop: "2px" }}>
              <Field label="Length per line">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={length}
                  onChange={(e) => setLength(parseFloat(e.target.value) || 0)}
                  className="form-input compact"
                  style={{ padding: "4px 6px" }}
                />
              </Field>

              <Field label="Weld lines, n" id="weld-lines">
                <select
                  id="weld-lines"
                  value={nLines}
                  onChange={(e) => setNLines(parseInt(e.target.value))}
                  className="form-select compact"
                  style={{ padding: "4px 6px" }}
                >
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
            </div>

            <div className="sidebar-two-col-grid" style={{ marginTop: "2px", borderTop: "1px solid var(--border-color)", paddingTop: "4px" }}>
              <Field label="Demand, P (kips)">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={appliedLoad}
                  onChange={(e) => setAppliedLoad(parseFloat(e.target.value) || 0)}
                  className="form-input compact"
                  style={{ padding: "4px 6px" }}
                />
              </Field>

              <Field label="Method" id="method-select">
                <select
                  id="method-select"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="form-select compact"
                  style={{ padding: "4px 6px" }}
                >
                  <option value="lrfd">LRFD</option>
                  <option value="asd">ASD</option>
                </select>
              </Field>
            </div>
          </div>
        </div>

        {calcError && (
          <div className="error-alert">
            <strong>Input error:</strong> {calcError}
          </div>
        )}

        {/* Check 1: Weld Metal */}
        {weld && (
          <CheckBlock
            title="Check 1: Weld metal shear rupture"
            codeRef="AISC 360-16 §J2.4"
            traceSteps={[
              { eq: "te = 0.707·w", codeRef: "AISC 360-16 §J2.2a throat definition", value: `${weld.te.toFixed(4)} in` },
              { eq: `Awe = te·L·n = ${weld.te.toFixed(4)}·${length}·${nLines}`,
                codeRef: "AISC 360-16 §J2.4(a) weld total area", value: `${weld.Awe.toFixed(3)} in²` },
              { eq: fnwEq, codeRef: fnwRef, value: `${weld.Fnw.toFixed(2)} ksi` },
              { eq: "Rn = Fnw·Awe", codeRef: "AISC 360-16 §J2.4 nominal strength", value: `${weld.Rn.toFixed(2)} kips` },
              { eq: designEq, codeRef: designRef, value: `${weld.cap.toFixed(2)} kips` },
            ]}
            statCards={[
              { label: "Nominal Rn", value: `${weld.Rn.toFixed(2)} kips` },
              { label: capLabel, value: `${weld.cap.toFixed(2)} kips` },
              { label: "DCR", value: weld.dcr !== null ? weld.dcr.toFixed(3) : "—" },
            ]}
            checkProps={weld.status ? {
              status: weld.status, demand: appliedLoad, cap: weld.cap, dcr: weld.dcr,
              label: weld.status === "OK" ? "Weld metal adequate" : "Weld metal inadequate",
            } : null}
          />
        )}

        {/* Check 2: Base Metal */}
        {base && (
          <CheckBlock
            title={`Check 2: Base metal shear (${baseLabel})`}
            codeRef="AISC 360-16 §J4.2"
            traceSteps={[
              { eq: `A = t·L·n = ${baseT.toFixed(4)}·${length}·${nLines}`,
                codeRef: "AISC 360-16 §J4.2 base shear critical area", value: `${base.A.toFixed(3)} in²` },
              { eq: `Yielding: Rn = 0.60·Fy·A = 0.60·${baseFy}·${base.A.toFixed(3)}`,
                codeRef: "AISC 360-16 §J4.2(a) Eq. J4-3", value: `${base.RnYield.toFixed(2)} kips` },
              { eq: method === "lrfd" ? "φRn (yield) = 1.00·Rn" : "Rn/Ω (yield) = Rn / 1.50",
                codeRef: method === "lrfd" ? "φ = 1.00" : "Ω = 1.50", value: `${base.capYield.toFixed(2)} kips` },
              { eq: `Rupture: Rn = 0.60·Fu·A = 0.60·${baseFu}·${base.A.toFixed(3)}`,
                codeRef: "AISC 360-16 §J4.2(b) Eq. J4-4", value: `${base.RnRupture.toFixed(2)} kips` },
              { eq: method === "lrfd" ? "φRn (rupture) = 0.75·Rn" : "Rn/Ω (rupture) = Rn / 2.00",
                codeRef: method === "lrfd" ? "φ = 0.75" : "Ω = 2.00", value: `${base.capRupture.toFixed(2)} kips` },
              { eq: `Governing: ${base.governs} (lower strength)`,
                codeRef: "min(yield cap, rupture cap)", value: `${base.cap.toFixed(2)} kips` },
            ]}
            statCards={[
              { label: `${baseLabel} Fy / Fu`, value: `${baseFy} / ${baseFu} ksi` },
              { label: `Governs: ${base.governs}`, value: `${base.cap.toFixed(2)} kips` },
              { label: "DCR", value: base.dcr !== null ? base.dcr.toFixed(3) : "—" },
            ]}
            checkProps={base.status ? {
              status: base.status, demand: appliedLoad, cap: base.cap, dcr: base.dcr,
              label: base.status === "OK" ? "Base metal adequate" : "Base metal inadequate",
            } : null}
          />
        )}

        {/* Check 3: Weld Size limits */}
        {size && (
          <CheckBlock
            title="Check 3: Weld size limits"
            codeRef="AISC 360-16 §J2.2b, Table J2.4"
            traceSteps={[
              { eq: `Provided: w = ${toFraction(legSize)}`, codeRef: "Selected fillet weld size", value: to16ths(legSize) },
              { eq: `Min for t = ${toFraction(baseT)}: w_min = ${size.minLabel}`,
                codeRef: "AISC 360-16 Table J2.4 bounds", value: size.minOk ? "OK" : "NG" },
              { eq: `Max for t = ${toFraction(baseT)}: w_max = ${size.maxLabel}`,
                codeRef: "AISC 360-16 §J2.2b geometry limit", value: size.maxOk ? "OK" : "NG" },
            ]}
            statCards={[
              { label: "Min weld size", value: toFraction(size.minSize) },
              { label: "Max weld size", value: toFraction(size.maxSize) },
              { label: "Provided", value: toFraction(legSize) },
            ]}
            checkProps={{
              status: size.status, demand: 0, cap: 0, dcr: null,
              label: size.status === "OK"
                ? "Weld size within limits"
                : (!size.minOk ? "Below minimum size" : "Exceeds maximum size"),
            }}
          />
        )}

        {/* Governing limit state */}
        {governing && governing.status && (
          <div className={`governing-summary-card ${governing.status === "OK" ? "pass" : "fail"}`} style={{ marginTop: "12px", padding: "10px 14px" }}>
            <div className="summary-title" style={{ fontSize: "12px" }}>Governing strength check: {governing.which}</div>
            <div className="summary-body" style={{ fontSize: "14px", marginTop: "4px" }}>
              {capLabel} = <strong>{governing.cap.toFixed(2)} kips</strong>,&nbsp;
              DCR = <strong>{governing.dcr.toFixed(3)}</strong>,&nbsp;
              Status: <span style={{ color: governing.status === "OK" ? "var(--success)" : "var(--danger)", fontWeight: "800" }}>{governing.status}</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
