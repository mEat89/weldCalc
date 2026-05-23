import React, { useState } from "react";
import {
  HSS_SHAPES,
  STEEL_GRADES,
  LEG_SIZES,
  FEXX_OPTIONS,
  FACE_TYPES,
  LENGTH_METHODS,
  LOAD_CASES,
} from "../../constants/steelData";
import {
  calcWeldMetal,
  calcBaseMetal,
  calcWeldSize,
  calcK5EffectiveWidth,
  calcK5LOA,
  calcFaceEffectiveLength,
  toFraction,
  to16ths,
} from "../../math/weldMath";
import { Field, InchInput, PlateQuickPick } from "../shared/FormElements";
import { CheckBlock, WarningBanner } from "../shared/CheckResults";
import HssSvgDiagram from "../shared/HssSvgDiagram";

export default function HSSTab({ activeTab, setActiveTab, tabs, setLegendOpen, setRefsOpen, darkMode, toggleDarkMode }) {
  // Connection sub-type
  const [connType, setConnType] = useState("hss2hss"); // hss2plate | hss2hss

  // Effective length method (CBFEM is removed, only 'aisc' | 'k5')
  const [lengthMode, setLengthMode] = useState("aisc");

  // Geometry state indexes
  const [branchIdx, setBranchIdx] = useState(11); // HSS6x6x1/4 default
  const [branchGradeIdx, setBranchGradeIdx] = useState(6); // A500 Gr C Rect default
  const [chordIdx, setChordIdx] = useState(26); // HSS10x10x3/8 default
  const [chordGradeIdx, setChordGradeIdx] = useState(6);
  const [plateT, setPlateT] = useState(0.5);
  const [plateGradeIdx, setPlateGradeIdx] = useState(0);

  // Branch orientation
  const [branchTransverseDim, setBranchTransverseDim] = useState("B");

  // Selected weld face
  const [selectedFaceDim, setSelectedFaceDim] = useState("B");

  // Weld parameters
  const [loadCase, setLoadCase] = useState("trans");
  const [angleDeg, setAngleDeg] = useState(90);
  const [legSize, setLegSize] = useState(0.25);
  const [fexx, setFexx] = useState(70);
  const [method, setMethod] = useState("lrfd");
  const [pFace, setPFace] = useState(0);
  const [useDirectional, setUseDirectional] = useState(false);
  const [overrideLength, setOverrideLength] = useState(false);
  const [customLength, setCustomLength] = useState(0);

  // Derived members & grades
  const branch = HSS_SHAPES[branchIdx] || HSS_SHAPES[0];
  const chord = HSS_SHAPES[chordIdx] || HSS_SHAPES[0];
  const branchGrade = STEEL_GRADES[branchGradeIdx] || STEEL_GRADES[0];
  const chordGrade = STEEL_GRADES[chordGradeIdx] || STEEL_GRADES[0];
  const plateGrade = STEEL_GRADES[plateGradeIdx] || STEEL_GRADES[0];

  // Identify whether the selected face is transverse
  const isTransverseFace = lengthMode === "k5";

  const transverseLen = branchTransverseDim === "B" ? branch.B : branch.H;
  const parallelLen   = branchTransverseDim === "B" ? branch.H : branch.B;
  const selectedFaceNominal = selectedFaceDim === "B" ? branch.B : branch.H;

  const thetaDeg = loadCase === "long" ? 0 : loadCase === "trans" ? 90 : angleDeg;

  let k5 = null, k5Error = null;
  if (connType === "hss2hss") {
    try {
      k5 = calcK5EffectiveWidth({
        chordB: chord.B,
        chordT: chord.tDes,
        chordFy: chordGrade.fy,
        branchB: selectedFaceNominal,
        branchT: branch.tDes,
        branchFy: branchGrade.fy,
      });
    } catch (e) { k5Error = e instanceof Error ? e.message : String(e); }
  } else if (connType === "hss2plate" && lengthMode === "k5") {
    try {
      k5 = calcK5EffectiveWidth({
        chordB: selectedFaceNominal,
        chordT: plateT,
        chordFy: plateGrade.fy,
        branchB: selectedFaceNominal,
        branchT: branch.tDes,
        branchFy: branchGrade.fy,
      });
    } catch (e) { k5Error = e instanceof Error ? e.message : String(e); }
  }

  // LOA Warnings
  let loa = null;
  if (connType === "hss2hss") {
    try {
      loa = calcK5LOA({ chord, branch, chordFy: chordGrade.fy, branchFy: branchGrade.fy });
    } catch (e) { /* ignore — LOA is advisory */ }
  }

  // Effective length calculations
  let faceLen = null, faceLenError = null;
  try {
    const dispatched = calcFaceEffectiveLength({
      mode: lengthMode === "cbfem" ? "aisc" : lengthMode, // CBFEM stripped, fallback to aisc
      faceLength: selectedFaceNominal,
      isTransverse: isTransverseFace,
      connType,
      k5,
    });
    faceLen = overrideLength
      ? { ...dispatched, length: customLength, ref: dispatched.ref + " (overridden by user)" }
      : dispatched;
  } catch (e) { faceLenError = e instanceof Error ? e.message : String(e); }

  // Base metal determination
  let baseT, baseFy, baseFu, baseLabel;
  if (connType === "hss2plate") {
    if (plateT <= branch.tDes) {
      baseT = plateT; baseFy = plateGrade.fy; baseFu = plateGrade.fu;
      baseLabel = "Plate (thinner)";
    } else {
      baseT = branch.tDes; baseFy = branchGrade.fy; baseFu = branchGrade.fu;
      baseLabel = "HSS wall (thinner)";
    }
  } else {
    baseT = chord.tDes; baseFy = chordGrade.fy; baseFu = chordGrade.fu;
    baseLabel = "Chord wall";
  }

  // Directional strength increase (kds) lock policies
  const lockDirectional =
    connType === "hss2hss" ||
    (connType === "hss2plate" && lengthMode === "k5");
  const lockReason =
    connType === "hss2hss"
      ? "per AISC 360-22 §K5 commentary (kds factor omitted for HSS branch welds — non-uniform chord wall stiffness)"
      : "per K5 mode engineering judgment (kds suppressed alongside K5 Be reduction on HSS-to-plate)";
  const effectiveUseDirectional = lockDirectional ? false : useDirectional;

  // Primary Capacity Calculations
  let weld = null, base = null, size = null, calcError = null;
  if (faceLen && faceLen.length > 0) {
    try {
      weld = calcWeldMetal({
        legSize, length: faceLen.length, fexx, thetaDeg, nLines: 1,
        method, useDirectional: effectiveUseDirectional, appliedLoad: pFace,
      });
      base = calcBaseMetal({
        baseT, fy: baseFy, fu: baseFu, length: faceLen.length, nLines: 1,
        method, appliedLoad: pFace,
      });
      size = calcWeldSize({ legSize, baseT });
    } catch (e) { calcError = e instanceof Error ? e.message : String(e); }
  }

  // Governing Check
  let governing = null;
  if (weld && base) {
    const govCap = Math.min(weld.cap, base.cap);
    const which = weld.cap <= base.cap ? "Weld metal (§J2.4)" : `Base metal — ${baseLabel} (§J4.2)`;
    const govDcr = pFace > 0 ? pFace / govCap : null;
    const govStatus = govDcr === null ? null : govDcr <= 1.0 ? "OK" : "NG";
    governing = { which, cap: govCap, dcr: govDcr, status: govStatus };
  }

  // UI Strings
  const fnwEq = effectiveUseDirectional
    ? "Fnw = 0.60·FEXX·(1 + 0.5·sin^1.5 θ)" : "Fnw = 0.60·FEXX";
  const fnwRef = effectiveUseDirectional
    ? `AISC 360-22 §J2.4, Eq. J2-5 (θ = ${thetaDeg}°)`
    : (connType === "hss2hss"
        ? "AISC 360-22 §K5 commentary — kds=1.0 for HSS branch welds (non-uniform chord stiffness)"
        : (lengthMode === "k5"
            ? "kds=1.0 in K5 Be mode — engineering judgment consistent with the conservative effective-width extension"
            : "AISC 360-22 §J2.4 — directional increase available but user has it disabled (conservative)"));

  const designEq = method === "lrfd" ? "φRn = 0.75·Rn" : "Rn/Ω = Rn / 2.00";
  const designRef = method === "lrfd" ? "AISC 360-16 §J2.4 — LRFD resistance factor" : "AISC 360-16 §J2.4 — ASD safety factor";
  const capLabel = method === "lrfd" ? "φRn (LRFD)" : "Rn/Ω (ASD)";

  const faceDescription = (() => {
    const dimLabel = `length = ${selectedFaceDim} = ${selectedFaceNominal}"`;
    if (connType === "hss2plate") {
      if (lengthMode === "k5") {
        return `Face along ${selectedFaceDim} (${dimLabel}) — K5 Be reduction applied (engineering judgment)`;
      }
      return `Face along ${selectedFaceDim} (${dimLabel}) — full nominal length per AISC`;
    }
    return isTransverseFace
      ? `Face along ${selectedFaceDim} — TRANSVERSE to chord (${dimLabel}) — K5 reduction applies`
      : `Face along ${selectedFaceDim} — PARALLEL to chord (${dimLabel}) — fully effective`;
  })();

  const activeLengthMethods = LENGTH_METHODS.filter((m) => m.id !== "cbfem");

  return (
    <div className="app-layout">
      {/* 1. Left Sidebar menu Panel (Extremely Compact) */}
      <aside className="app-sidebar compact">
        <div className="app-sidebar-header">
          <h1>
            Weld Capacity
            <span className="version-badge">v2.5</span>
          </h1>
          <div className="header-subtitle">
            AISC 360-22 / 360-16 + DG1 — Rect HSS welds
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

        {/* Navigation Tabs List (Horizontal Grid) */}
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

        {/* Connection Type Selection */}
        <div className="card compact shadow-sm border-0">
          <div className="card-section-label">Connection type</div>
          <div className="toggle-btn-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <button
              onClick={() => { setConnType("hss2plate"); if (lengthMode === "aisc") setSelectedFaceDim("B"); }}
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
            <Field label={connType === "hss2plate" ? "HSS member" : "Branch HSS"} id="hss-member-select">
              <select
                id="hss-member-select"
                value={branchIdx}
                onChange={(e) => setBranchIdx(parseInt(e.target.value))}
                className="form-select compact"
              >
                {HSS_SHAPES.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={connType === "hss2plate" ? "HSS grade" : "Branch grade"} id="branch-grade-select">
              <select
                id="branch-grade-select"
                value={branchGradeIdx}
                onChange={(e) => setBranchGradeIdx(parseInt(e.target.value))}
                className="form-select compact"
              >
                {STEEL_GRADES.filter((g) => g.category === "hss").map((g) => {
                  const idx = STEEL_GRADES.indexOf(g);
                  return <option key={idx} value={idx}>{g.shortLabel}</option>;
                })}
              </select>
            </Field>
          </div>

          {connType === "hss2plate" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
              <div className="sidebar-two-col-grid">
                <Field label="Plate grade" id="plate-grade-select">
                  <select
                    id="plate-grade-select"
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
                <InchInput label="Plate tp" value={plateT} onChange={setPlateT} id="plate-thickness" />
              </div>
              <div>
                <PlateQuickPick value={plateT} onChange={setPlateT} />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
              <div className="sidebar-two-col-grid">
                <Field label="Chord HSS" id="chord-hss-select">
                  <select
                    id="chord-hss-select"
                    value={chordIdx}
                    onChange={(e) => setChordIdx(parseInt(e.target.value))}
                    className="form-select compact"
                  >
                    {HSS_SHAPES.map((s, i) => (
                      <option key={i} value={i}>{s.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Chord grade" id="chord-grade-select">
                  <select
                    id="chord-grade-select"
                    value={chordGradeIdx}
                    onChange={(e) => setChordGradeIdx(parseInt(e.target.value))}
                    className="form-select compact"
                  >
                    {STEEL_GRADES.filter((g) => g.category === "hss").map((g) => {
                      const idx = STEEL_GRADES.indexOf(g);
                      return <option key={idx} value={idx}>{g.shortLabel}</option>;
                    })}
                  </select>
                </Field>
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
        </div>

        {/* Effective Length Method Selection */}
        <div className="card compact shadow-sm border-0">
          <div className="card-section-label">Effective length method</div>
          <div className="toggle-btn-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {activeLengthMethods.map((m) => {
              const active = lengthMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setLengthMode(m.id)}
                  className={`toggle-option-btn compact ${active ? "active" : ""}`}
                  type="button"
                  style={{ padding: "6px", fontSize: "11px" }}
                >
                  <div className="btn-main-label" style={{ fontSize: "11px", fontWeight: "700" }}>{m.short}</div>
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
                {LEG_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label.split(" ")[0]}</option>)}
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

          <div className="sidebar-two-col-grid mt-1">
            <Field label="Force P_face (kips)">
              <input
                type="number"
                min="0"
                step="0.1"
                value={pFace}
                onChange={(e) => setPFace(parseFloat(e.target.value) || 0)}
                className="form-input compact"
              />
            </Field>

            <Field label="Method" id="design-method-select">
              <select
                id="design-method-select"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="form-select compact"
              >
                <option value="lrfd">LRFD</option>
                <option value="asd">ASD</option>
              </select>
            </Field>
          </div>

          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "4px", display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <span>L_eff:</span>
              <strong>{overrideLength ? `${customLength} in` : (faceLen ? `${faceLen.length.toFixed(3)} in` : "—")}</strong>
            </div>
            
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", cursor: "pointer", marginTop: "2px" }}>
              <input
                type="checkbox"
                checked={overrideLength}
                onChange={(e) => {
                  setOverrideLength(e.target.checked);
                  if (e.target.checked && faceLen) setCustomLength(parseFloat(faceLen.length.toFixed(3)));
                }}
                style={{ cursor: "pointer" }}
              />
              <span>Override length</span>
            </label>

            {overrideLength && (
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={customLength}
                onChange={(e) => setCustomLength(parseFloat(e.target.value) || 0)}
                className="form-input compact"
                style={{ padding: "3px 6px", fontSize: "11px", marginTop: "2px" }}
              />
            )}
          </div>
        </div>

      </aside>

      {/* 2. Right Main Panel */}
      <main className="app-main-content">
        {/* TOP 2-COLUMN CONTROL PANEL GRID (Compacted) */}
        <div className="top-controls-grid hss-top-grid">
          {/* Column 1: Interactive SVG Diagram & Face Analysis (Side-by-Side) */}
          <div className="card compact top-grid-card diagram-controls-card-side" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "16px", alignItems: "center" }}>
            <HssSvgDiagram
              selectedFaceDim={selectedFaceDim}
              branch={branch}
              loadCase={loadCase}
              angleDeg={angleDeg}
            />
            
            {/* Weld Face Selection & Branch Orientation inline to the side of the diagram */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", height: "100%", justifyContent: "center" }}>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div className="card-section-label" style={{ margin: 0, paddingLeft: "6px", fontSize: "10px" }}>Weld Face to Analyze</div>
                <div className="toggle-btn-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "6px" }}>
                  {FACE_TYPES.map((f) => {
                    const active = selectedFaceDim === f.id;
                    const k5ReductionApplies = lengthMode === "k5";
                    const lengthStr = f.id === "B" ? `${branch.B}"` : `${branch.H}"`;
                    const subLabel = k5ReductionApplies ? "K5 Reduced" : "Fully Effective";

                    return (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFaceDim(f.id)}
                        className={`toggle-option-btn compact ${active ? "active" : ""}`}
                        type="button"
                        style={{ padding: "6px 8px", fontSize: "10px", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
                      >
                        <div className="btn-main-label" style={{ fontSize: "10px", fontWeight: "700" }}>Face {f.id} ({lengthStr})</div>
                        <div className="btn-sub-label" style={{ fontSize: "8.5px", margin: "2px 0 0 0", opacity: 0.8 }}>{subLabel}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(connType === "hss2hss" || (connType === "hss2plate" && lengthMode === "k5")) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", borderTop: "1px dashed var(--border-color)", paddingTop: "8px" }}>
                  <div className="card-section-label" style={{ margin: 0, paddingLeft: "6px", fontSize: "10px" }}>Branch Orientation</div>
                  <div className="toggle-btn-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "6px" }}>
                    <button
                      onClick={() => setBranchTransverseDim("B")}
                      className={`toggle-option-btn compact ${branchTransverseDim === "B" ? "active" : ""}`}
                      type="button"
                      style={{ padding: "6px 8px", fontSize: "9.5px", borderRadius: "var(--radius-sm)", textAlign: "center" }}
                    >
                      <div className="btn-main-label" style={{ fontSize: "9.5px", fontWeight: "700" }}>Branch B Transverse</div>
                    </button>
                    <button
                      onClick={() => setBranchTransverseDim("H")}
                      className={`toggle-option-btn compact ${branchTransverseDim === "H" ? "active" : ""}`}
                      type="button"
                      style={{ padding: "6px 8px", fontSize: "9.5px", borderRadius: "var(--radius-sm)", textAlign: "center" }}
                    >
                      <div className="btn-main-label" style={{ fontSize: "9.5px", fontWeight: "700" }}>Branch H Transverse</div>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Column 2: Load case / direction (Compacted) */}
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
              <div style={{ marginTop: "4px", fontSize: "11px", backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", padding: "4px 6px", borderRadius: "var(--radius-sm)" }}>
                {lockDirectional ? (
                  <span style={{ color: "var(--primary-dark)", fontWeight: "600", fontSize: "10px" }}>
                    kds = 1.0 Locked: {connType === "hss2hss" ? "HSS branch weld non-uniformity" : "K5 Be mode"}
                  </span>
                ) : (
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "10px" }}>
                    <input
                      type="checkbox"
                      checked={!useDirectional}
                      onChange={(e) => setUseDirectional(!e.target.checked)}
                      style={{ cursor: "pointer" }}
                    />
                    <span>Suppress 1.5× directional increase</span>
                  </label>
                )}
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
        </div>

        {/* Advisory LOA limits banner */}
        {connType === "hss2hss" && loa && !loa.withinLOA && (
          <WarningBanner
            title="Outside §K5 Limits of Applicability — equations are advisory only"
            items={loa.violations}
          />
        )}

        {/* Computational errors display */}
        {(calcError || k5Error || faceLenError) && (
          <div className="error-alert">
            <strong>Calculation error:</strong> {calcError || k5Error || faceLenError}
          </div>
        )}

        {/* Effective Length Trace (Collapsible) */}
        {faceLen && (() => {
          let traceSteps = [];
          let codeRef = "";

          if (lengthMode === "k5" && connType === "hss2plate") {
            codeRef = "AISC 360 §K5 Eq. K1-1 (engineering judgment — plate as chord)";
            if (isTransverseFace && k5) {
              traceSteps = [
                { eq: `Chord B (HSS face dim) = ${selectedFaceNominal}"`,
                  codeRef: "HSS face dimension used as plate chord proxy",
                  value: `${selectedFaceNominal} in` },
                { eq: `B/t (plate) = ${selectedFaceNominal} / ${plateT.toFixed(4)} = ${k5.Bt.toFixed(2)}`,
                  codeRef: "Plate slenderness ratio (face dim / plate thickness)",
                  value: k5.Bt.toFixed(2) },
                { eq: `Be_raw = (10/(B/t))·(Fyp·tp / (Fyb·tb))·Bb`,
                  codeRef: "K5 Eq. K1-1 applied to plate-as-chord",
                  value: `${k5.beRaw.toFixed(3)} in` },
                { eq: `     = (10/${k5.Bt.toFixed(2)})·(${plateGrade.fy}·${plateT.toFixed(4)} / (${branchGrade.fy}·${branch.tDes.toFixed(4)}))·${selectedFaceNominal}`,
                  codeRef: "Substituted metrics",
                  value: `${k5.beRaw.toFixed(3)} in` },
                { eq: `Be = min(Be_raw, Bb) = min(${k5.beRaw.toFixed(3)}, ${selectedFaceNominal})`,
                  codeRef: k5.capped ? "Capped at Bb" : "Be < Bb — reduction governs",
                  value: `${k5.be.toFixed(3)} in` },
                { eq: `L_eff (this face) = Be`,
                  codeRef: "K5 reduction width applied to selected face",
                  value: `${k5.be.toFixed(3)} in` },
              ];
            } else {
              traceSteps = [
                { eq: `Face is parallel to bending axis`,
                  codeRef: "K5 mode: K5 applies only to transverse welds",
                  value: "—" },
                { eq: `L_eff (this face) = ${selectedFaceNominal}" (nominal)`,
                  codeRef: "Longitudinal welds fully effective",
                  value: `${selectedFaceNominal} in` },
              ];
            }
          } else if (connType === "hss2hss" && k5) {
            codeRef = "AISC 360 §K5 Eq. K1-1, Table K5.1";
            traceSteps = isTransverseFace ? [
              { eq: `β = Bb / B = ${transverseLen} / ${chord.B} = ${k5.beta.toFixed(3)}`,
                codeRef: "Width ratio checking (§K1)",
                value: k5.beta > 1.0 ? "β > 1 — invalid" : "OK" },
              { eq: `B/t = ${chord.B} / ${chord.tDes.toFixed(4)} = ${k5.Bt.toFixed(2)}`,
                codeRef: "Chord member wall slenderness", value: k5.Bt.toFixed(2) },
              { eq: `Be_raw = (10/(B/t))·(Fy·t / (Fyb·tb))·Bb`,
                codeRef: "AISC 360 §K5 Eq. K1-1",
                value: `${k5.beRaw.toFixed(3)} in` },
              { eq: `     = (10/${k5.Bt.toFixed(2)})·(${chordGrade.fy}·${chord.tDes.toFixed(4)} / (${branchGrade.fy}·${branch.tDes.toFixed(4)}))·${transverseLen}`,
                codeRef: "Substituted properties",
                value: `${k5.beRaw.toFixed(3)} in` },
              { eq: `Be = min(Be_raw, Bb) = min(${k5.beRaw.toFixed(3)}, ${transverseLen})`,
                codeRef: k5.capped ? "Capped at Bb (§K5 limit)" : "Be < Bb — reduction governs",
                value: `${k5.be.toFixed(3)} in` },
              { eq: `L_eff (this face) = Be`,
                codeRef: "Transverse face weld effective length",
                value: `${k5.be.toFixed(3)} in` },
            ] : [
              { eq: `Selected face is PARALLEL to chord axis`,
                codeRef: "AISC 360 §K5 Table K5.1",
                value: "—" },
              { eq: `L_eff (this face) = ${parallelLen}" (nominal)`,
                codeRef: "Longitudinal weld lines fully effective",
                value: `${parallelLen} in` },
            ];
          } else {
            codeRef = "AISC 360-22 §J2.4 — full nominal length";
            traceSteps = [
              { eq: `Selected face dimension = ${selectedFaceDim} = ${selectedFaceNominal}"`,
                codeRef: "From catalog dimensions",
                value: `${selectedFaceNominal} in` },
              { eq: `L_eff = ${faceLen.length.toFixed(3)}" (full nominal)`,
                codeRef: "Rigid plate supports uniform stress",
                value: `${faceLen.length.toFixed(3)} in` },
            ];
          }

          return (
            <CheckBlock
              title={`Effective length [${LENGTH_METHODS.find((m) => m.id === lengthMode)?.short}]`}
              codeRef={codeRef}
              traceSteps={traceSteps}
              statCards={[
                { label: "Mode", value: LENGTH_METHODS.find((m) => m.id === lengthMode)?.short ?? "" },
                { label: "Nominal", value: `${selectedFaceNominal} in` },
                { label: "L_eff", value: `${faceLen.length.toFixed(3)} in` },
              ]}
              checkProps={null}
            />
          );
        })()}

        {/* Check 1: Weld metal (Collapsible) */}
        {weld && (
          <CheckBlock
            title="Check 1: Weld metal shear rupture"
            codeRef="AISC 360-16 §J2.4"
            traceSteps={[
              { eq: "te = 0.707·w", codeRef: "AISC 360-16 §J2.2a", value: `${weld.te.toFixed(4)} in` },
              { eq: `Awe = te·L_eff = ${weld.te.toFixed(4)}·${faceLen.length.toFixed(3)}`,
                codeRef: "AISC 360-16 §J2.4 effective area", value: `${weld.Awe.toFixed(3)} in²` },
              { eq: fnwEq, codeRef: fnwRef, value: `${weld.Fnw.toFixed(2)} ksi` },
              { eq: "Rn = Fnw·Awe", codeRef: "AISC 360-16 §J2.4 nominal capacity", value: `${weld.Rn.toFixed(2)} kips` },
              { eq: designEq, codeRef: designRef, value: `${weld.cap.toFixed(2)} kips` },
            ]}
            statCards={[
              { label: "Nominal Rn", value: `${weld.Rn.toFixed(2)} kips` },
              { label: capLabel, value: `${weld.cap.toFixed(2)} kips` },
              { label: "DCR", value: weld.dcr !== null ? weld.dcr.toFixed(3) : "—" },
            ]}
            checkProps={weld.status ? {
              status: weld.status, demand: pFace, cap: weld.cap, dcr: weld.dcr,
              label: weld.status === "OK" ? "Weld metal adequate" : "Weld metal inadequate",
            } : null}
          />
        )}

        {/* Check 2: Base metal (Collapsible) */}
        {base && (
          <CheckBlock
            title={`Check 2: Base metal shear (${baseLabel})`}
            codeRef="AISC 360-16 §J4.2"
            traceSteps={[
              { eq: `A = t·L_eff = ${baseT.toFixed(4)}·${faceLen.length.toFixed(3)}`,
                codeRef: "AISC 360-16 base shear critical area", value: `${base.A.toFixed(3)} in²` },
              { eq: `Yielding: Rn = 0.60·Fy·A = 0.60·${baseFy}·${base.A.toFixed(3)}`,
                codeRef: "AISC 360-16 Eq. J4-3", value: `${base.RnYield.toFixed(2)} kips` },
              { eq: method === "lrfd" ? "φRn (yield) = 1.00·Rn" : "Rn/Ω (yield) = Rn / 1.50",
                codeRef: method === "lrfd" ? "φ = 1.00" : "Ω = 1.50", value: `${base.capYield.toFixed(2)} kips` },
              { eq: `Rupture: Rn = 0.60·Fu·A = 0.60·${baseFu}·${base.A.toFixed(3)}`,
                codeRef: "AISC 360-16 Eq. J4-4", value: `${base.RnRupture.toFixed(2)} kips` },
              { eq: method === "lrfd" ? "φRn (rupture) = 0.75·Rn" : "Rn/Ω (rupture) = Rn / 2.00",
                codeRef: method === "lrfd" ? "φ = 0.75" : "Ω = 2.00", value: `${base.capRupture.toFixed(2)} kips` },
              { eq: `Governing: ${base.governs} (lower limit)`,
                codeRef: "min(yield cap, rupture cap)", value: `${base.cap.toFixed(2)} kips` },
            ]}
            statCards={[
              { label: `${baseLabel} Fy / Fu`, value: `${baseFy}/${baseFu} ksi` },
              { label: `Governs: ${base.governs}`, value: `${base.cap.toFixed(2)} kips` },
              { label: "DCR", value: base.dcr !== null ? base.dcr.toFixed(3) : "—" },
            ]}
            checkProps={base.status ? {
              status: base.status, demand: pFace, cap: base.cap, dcr: base.dcr,
              label: base.status === "OK" ? "Base metal adequate" : "Base metal inadequate",
            } : null}
          />
        )}

        {/* Check 3: Weld size limits (Collapsible) */}
        {size && (
          <CheckBlock
            title="Check 3: Weld size limits"
            codeRef="AISC 360-16 §J2.2b, Table J2.4"
            traceSteps={[
              { eq: `Provided: w = ${toFraction(legSize)}`, codeRef: "User selected leg size", value: to16ths(legSize) },
              { eq: `Min for t = ${toFraction(baseT)}: w_min = ${size.minLabel}`,
                codeRef: "AISC 360-16 Table J2.4", value: size.minOk ? "OK" : "NG" },
              { eq: `Max for t = ${toFraction(baseT)}: w_max = ${size.maxLabel}`,
                codeRef: "AISC 360-16 §J2.2b thickness boundary", value: size.maxOk ? "OK" : "NG" },
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
                : (!size.minOk ? "Below minimum size limit" : "Exceeds maximum allowable size"),
            }}
          />
        )}

        {/* Governing limit DCR box */}
        {governing && governing.status && (
          <div className={`governing-summary-card ${governing.status === "OK" ? "pass" : "fail"}`} style={{ marginTop: "12px", padding: "10px 14px" }}>
            <div className="summary-title" style={{ fontSize: "12px" }}>Governing strength check (this face only): {governing.which}</div>
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
