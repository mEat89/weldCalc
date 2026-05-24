import React, { useState, useRef } from "react";
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
import { Field, PlateThicknessSelect, HssMemberSelect, SteelGradeSelect } from "../shared/FormElements";
import { CheckBlock, WarningBanner, InfoTooltip } from "../shared/CheckResults";
import HssSvgDiagram from "../shared/HssSvgDiagram";
import ReportActions from "../shared/ReportActions";
import { buildHSSReport } from "../../reports/buildHSSReport";

const TOOLTIP_DATA = {
  aiscMode: [
    { text: "Assumes the weld line is fully effective along its entire physical length. It considers the effective length equal to the nominal face dimension (Bb or Hb), assuming infinite chord wall stiffness and rigid plate behavior without local shear lag or out-of-plane flexing." },
    { label: "AISC Reference", text: "AISC 360 Section J2.4." }
  ],
  k5Mode: [
    { text: "Applies the Chapter K effective width reduction to account for out-of-plane flexing of the chord face. The effective length is reduced to Be (from Eq. K1-1) for transverse weld lines because stress concentrates near the stiff vertical HSS sidewalls while the flexible face center transfers negligible load." },
    { label: "AISC Reference", text: "AISC 360 Section K5 & Table K5.1 (Eq. K1-1)." }
  ],
  effLength: [
    { text: "Determines the design effective length of the weld line being checked by applying either the fully effective nominal length or the K5 Be chord-flexibility reduction. This accounts for stress distribution variations between stiff sidewalls and flexible transverse faces." },
    { label: "AISC Reference", text: "AISC 360 Table K5.1." }
  ],
  weldMetal: [
    { text: "Checks shear rupture of the fillet weld throat under acting load. The design strength is calculated as φRn = φ·Fnw·Awe, where Awe = 0.707·w·Leff and Fnw = 0.6·FEXX. Fillet weld shear stress is assumed uniform over the throat area, and the directional strength factor is suppressed for HSS branch welds per Chapter K commentary." },
    { label: "AISC Reference", text: "AISC 360 Section J2.4." }
  ],
  baseMetal: [
    { text: "Verifies the connected thinner base material does not fail in shear yielding or rupture. The design strength is governed by the minimum of yielding capacity (φRn = 1.0·0.6·Fy·t·Leff) and rupture capacity (φRn = 0.75·0.6·Fu·t·Leff), assuming a uniform shear stress distribution through the material thickness." },
    { label: "AISC Reference", text: "AISC 360 Section J4.2." }
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
  const [solicitation, setSolicitation] = useState("shear"); // "shear" | "tension" | "moment"
  const [appliedLoad, setAppliedLoad] = useState(0);
  const [appliedMoment, setAppliedMoment] = useState(0);
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

  const dCouple = selectedFaceDim === "B" ? branch.H : branch.B;
  const faceSymbol = selectedFaceDim === "B" ? "B_b" : "H_b";

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
        chordT: branch.tDes,
        chordFy: branchGrade.fy,
        branchB: selectedFaceNominal,
        branchT: plateT,
        branchFy: plateGrade.fy,
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

  const L_eff = faceLen ? faceLen.length : selectedFaceNominal;
  const momentShareFactor = L_eff / (L_eff + dCouple / 3);
  const pFace = solicitation === "moment"
    ? ((appliedMoment * 12) / dCouple) * momentShareFactor
    : appliedLoad * (selectedFaceNominal / (2 * (branch.B + branch.H)));

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
    solicitation === "tension" ||
    solicitation === "moment" ||
    connType === "hss2hss" ||
    (connType === "hss2plate" && lengthMode === "k5");
  const lockReason =
    solicitation === "tension"
      ? "per AISC 360-22 Table K5.1 user note (directional increase factor cannot exceed 1.0 in fillet welds to the end of rectangular HSS)"
      : solicitation === "moment"
        ? "per AISC 360-22 Table K5.1 user note (directional increase factor cannot exceed 1.0 for moment connection weld tension chords)"
        : connType === "hss2hss"
          ? "per AISC 360-22 §K5 commentary (kds factor omitted for HSS branch welds — non-uniform chord wall stiffness)"
          : "per K5 mode engineering judgment (kds suppressed alongside K5 Be reduction on HSS-to-plate)";
  const effectiveUseDirectional = lockDirectional ? false : useDirectional;

  // Primary Capacity Calculations
  let weld = null, base = null, size = null, calcError = null;
  if (faceLen && faceLen.length > 0) {
    try {
      weld = calcWeldMetal({
        legSize, length: faceLen.length, fexx, thetaDeg, nLines: 1,
        method: "lrfd", useDirectional: effectiveUseDirectional, appliedLoad: pFace,
      });
      base = calcBaseMetal({
        baseT, fy: baseFy, fu: baseFu, length: faceLen.length, nLines: 1,
        method: "lrfd", appliedLoad: pFace,
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
    : (solicitation === "tension"
        ? "AISC 360-22 Table K5.1 user note — kds=1.0 for out-of-plane tension welds"
        : solicitation === "moment"
          ? "AISC 360-22 Table K5.1 user note — kds=1.0 for out-of-plane moment pulling welds"
          : (connType === "hss2hss"
              ? "AISC 360-22 §K5 commentary — kds=1.0 for HSS branch welds (non-uniform chord stiffness)"
              : (lengthMode === "k5"
                  ? "kds=1.0 in K5 Be mode — engineering judgment consistent with the conservative effective-width extension"
                  : "AISC 360-22 §J2.4 — directional increase available but user has it disabled (conservative)")));

  const designEq = "φRn = 0.75·Rn";
  const designRef = "AISC 360-16 §J2.4 — LRFD resistance factor";
  const capLabel = "φRn (LRFD)";

  const faceDescription = (() => {
    const dimLabel = `length = ${selectedFaceDim} = ${selectedFaceNominal}"`;
    if (lengthMode === "k5") {
      return `Face along ${selectedFaceDim} (${dimLabel}) — K5 Be reduction applied`;
    }
    return `Face along ${selectedFaceDim} (${dimLabel}) — full nominal length per AISC`;
  })();

  const activeLengthMethods = LENGTH_METHODS.filter((m) => m.id !== "cbfem");

  // Build the effective-length CheckBlock data once so it can be shown in the
  // UI AND included in the exported report without duplicating the logic.
  let effLenBlockForReport = null;
  if (faceLen) {
    let traceSteps = [];
    let codeRef = "";
    if (lengthMode === "k5" && connType === "hss2plate") {
      codeRef = "AISC 360 §K5 Eq. K1-1 — plate-to-HSS connection";
      if (k5) {
        traceSteps = [
          { eq: `Chord B (HSS face) = ${selectedFaceNominal}"`, codeRef: "HSS face dimension acting as chord face", value: `${selectedFaceNominal} in` },
          { eq: `B/t (HSS chord) = ${selectedFaceNominal} / ${branch.tDes.toFixed(4)} = ${k5.Bt.toFixed(2)}`, codeRef: "HSS chord slenderness ratio (face width / HSS thickness)", value: k5.Bt.toFixed(2) },
          { eq: `Be_raw = (10/(B/t))·(Fy·t / (Fyp·tp))·Bb`, codeRef: "AISC 360 §K5 Eq. K1-1", value: `${k5.beRaw.toFixed(3)} in` },
          { eq: `     = (10/${k5.Bt.toFixed(2)})·(${branchGrade.fy}·${branch.tDes.toFixed(4)} / (${plateGrade.fy}·${plateT.toFixed(4)}))·${selectedFaceNominal}`, codeRef: "Substituted metrics", value: `${k5.beRaw.toFixed(3)} in` },
          { eq: `Be = min(Be_raw, Bb) = min(${k5.beRaw.toFixed(3)}, ${selectedFaceNominal})`, codeRef: k5.capped ? "Capped at Bb" : "Be < Bb — reduction governs", value: `${k5.be.toFixed(3)} in` },
          { eq: `L_eff (this face) = Be`, codeRef: "K5 reduction width applied to selected face", value: `${k5.be.toFixed(3)} in` },
        ];
      }
    } else if (lengthMode === "k5" && connType === "hss2hss" && k5) {
      codeRef = "AISC 360 §K5 Eq. K1-1, Table K5.1";
      traceSteps = [
        { eq: `β = Bb / B = ${selectedFaceNominal} / ${chord.B} = ${k5.beta.toFixed(3)}`, codeRef: "Width ratio checking (§K1)", value: k5.beta > 1.0 ? "β > 1 — invalid" : "OK" },
        { eq: `B/t = ${chord.B} / ${chord.tDes.toFixed(4)} = ${k5.Bt.toFixed(2)}`, codeRef: "Chord member wall slenderness", value: k5.Bt.toFixed(2) },
        { eq: `Be_raw = (10/(B/t))·(Fy·t / (Fyb·tb))·Bb`, codeRef: "AISC 360 §K5 Eq. K1-1", value: `${k5.beRaw.toFixed(3)} in` },
        { eq: `     = (10/${k5.Bt.toFixed(2)})·(${chordGrade.fy}·${chord.tDes.toFixed(4)} / (${branchGrade.fy}·${branch.tDes.toFixed(4)}))·${selectedFaceNominal}`, codeRef: "Substituted properties", value: `${k5.beRaw.toFixed(3)} in` },
        { eq: `Be = min(Be_raw, Bb) = min(${k5.beRaw.toFixed(3)}, ${selectedFaceNominal})`, codeRef: k5.capped ? "Capped at Bb (§K5 limit)" : "Be < Bb — reduction governs", value: `${k5.be.toFixed(3)} in` },
        { eq: `L_eff (this face) = Be`, codeRef: "Weld effective length with K5 reduction", value: `${k5.be.toFixed(3)} in` },
      ];
    } else {
      codeRef = "AISC 360-22 §J2.4 — full nominal length";
      traceSteps = [
        { eq: `Selected face dimension = ${selectedFaceDim} = ${selectedFaceNominal}"`, codeRef: "From catalog dimensions", value: `${selectedFaceNominal} in` },
        { eq: `L_eff = ${faceLen.length.toFixed(3)}" (full nominal)`, codeRef: "Rigid plate supports uniform stress", value: `${faceLen.length.toFixed(3)} in` },
      ];
    }
    effLenBlockForReport = {
      title: `Effective length [${LENGTH_METHODS.find((m) => m.id === lengthMode)?.short}]`,
      codeRef,
      traceSteps,
      statCards: [
        { label: "Mode", value: LENGTH_METHODS.find((m) => m.id === lengthMode)?.short ?? "" },
        { label: "Nominal", value: `${selectedFaceNominal} in` },
        { label: "L_eff", value: `${faceLen.length.toFixed(3)} in` },
      ],
    };
  }

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
                  connType, lengthMode, solicitation,
                  branch, branchGrade, chord, chordGrade,
                  plateT, plateGrade,
                  branchTransverseDim, selectedFaceDim,
                  loadCase, angleDeg, legSize, fexx,
                  appliedLoad, appliedMoment, pFace, useDirectional, overrideLength, customLength,
                },
                calcs: {
                  weld, base, size, governing, faceLen, k5, loa, dCouple,
                  effLenBlock: effLenBlockForReport,
                  fnwEq, fnwRef, designEq, designRef,
                  baseT, baseFy, baseFu, baseLabel,
                  thetaDeg, effectiveUseDirectional, lockDirectional, lockReason,
                  selectedFaceNominal, faceDescription,
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
              {t.id === "hss" ? "HSS Weld" : t.id === "standard" ? "Standard Shape Weld" : "Plate Rigidity"}
            </button>
          ))}
        </nav>

        {/* Solicitation Selector */}
        <div className="card compact shadow-sm border-0">
          <div className="card-section-label">Solicitation type</div>
          <div className="toggle-btn-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
            <button
              onClick={() => setSolicitation("shear")}
              className={`toggle-option-btn compact ${solicitation === "shear" ? "active" : ""}`}
              type="button"
              style={{ padding: "6px 2px", fontSize: "10px" }}
            >
              <div className="btn-main-label" style={{ fontSize: "10px", fontWeight: "700" }}>Shear</div>
            </button>
            <button
              onClick={() => setSolicitation("tension")}
              className={`toggle-option-btn compact ${solicitation === "tension" ? "active" : ""}`}
              type="button"
              style={{ padding: "6px 2px", fontSize: "10px" }}
            >
              <div className="btn-main-label" style={{ fontSize: "10px", fontWeight: "700" }}>Tension</div>
            </button>
            <button
              onClick={() => setSolicitation("moment")}
              className={`toggle-option-btn compact ${solicitation === "moment" ? "active" : ""}`}
              type="button"
              style={{ padding: "6px 2px", fontSize: "10px" }}
            >
              <div className="btn-main-label" style={{ fontSize: "10px", fontWeight: "700" }}>Moment</div>
            </button>
          </div>
        </div>

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
                    fontSize: "11px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    width: "100%",
                  }}
                >
                  <span className="btn-main-label" style={{ fontSize: "11px", fontWeight: "700" }}>{m.short}</span>
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
              <span>Override weld Effective Length</span>
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
          {/* Column 1: Interactive SVG Diagram (Standalone Card, matches other tabs) */}
          <div ref={diagramRef} style={{ display: "contents" }}>
            <HssSvgDiagram
              selectedFaceDim={selectedFaceDim}
              branch={branch}
              loadCase={loadCase}
              angleDeg={angleDeg}
              solicitation={solicitation}
            />
          </div>
          
          <div className="card compact top-grid-card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div className="card-section-label" style={{ margin: 0, paddingLeft: "6px", fontSize: "10px" }}>Weld Line to Analyze (analyzes single line at a time)</div>
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
                      style={{ padding: "5px 8px", fontSize: "10px", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    >
                      <span style={{ fontWeight: "700" }}>Face {f.id} ({lengthStr})</span>
                      <span style={{ opacity: 0.85, fontSize: "9.5px" }}>— {subLabel}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: "9.5px", color: "var(--text-muted)", marginTop: "3px", lineHeight: "1.2", fontStyle: "italic", paddingLeft: "6px" }}>
                ℹ️ The calculator analyzes a single weld line at a time. The effective length (Leff) and capacities are unitary and are not multiplied by 2.
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
                    <div className="btn-main-label" style={{ fontSize: "9.5px", fontWeight: "700" }}>Branch Width (B) perpendicular to chord axis</div>
                  </button>
                  <button
                    onClick={() => setBranchTransverseDim("H")}
                    className={`toggle-option-btn compact ${branchTransverseDim === "H" ? "active" : ""}`}
                    type="button"
                    style={{ padding: "6px 8px", fontSize: "9.5px", borderRadius: "var(--radius-sm)", textAlign: "center" }}
                  >
                    <div className="btn-main-label" style={{ fontSize: "9.5px", fontWeight: "700" }}>Branch Height (H) perpendicular to chord axis</div>
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Column 2: Load case / direction (Compacted) */}
          <div className="card compact top-grid-card" style={{ display: "flex", flexDirection: "column", gap: "6px", opacity: solicitation === "shear" ? 1 : 0.65 }}>
            <div className="card-section-label">Load Case &amp; Direction</div>
            {solicitation === "shear" ? (
              <>
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
                    {lockDirectional ? (
                      <span style={{ color: "inherit", fontWeight: "600", fontSize: "10px" }}>
                        kds = 1.0 Locked: {connType === "hss2hss" ? "HSS branch weld non-uniformity" : "K5 Be mode"}
                      </span>
                    ) : (
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "10px", color: "inherit" }}>
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
              </>
            ) : (
              <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "12px", color: "var(--text-muted)", fontSize: "11px", lineHeight: "1.4" }}>
                <span>🔒 Directional parameters inactive</span>
                <span style={{ fontSize: "10px", marginTop: "6px" }}>
                  {solicitation === "tension"
                    ? "Tension acts perpendicular (normal) to the base plate. Arrow orientation is fixed out-of-plane."
                    : "Moment couple tension acts normal to the checked flange weld chord. Load orientation is fixed."}
                </span>
              </div>
            )}
            <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed var(--border-color)" }}>
              {solicitation === "moment" ? (
                <>
                  <label htmlFor="demand-moment-input" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-dark)", display: "block", marginBottom: "4px", whiteSpace: "nowrap" }}>
                    Acting Bending Moment, M (Ultimate) (ft-kips)
                  </label>
                  <input
                    id="demand-moment-input"
                    type="number"
                    min="0"
                    step="0.5"
                    value={appliedMoment}
                    onChange={(e) => setAppliedMoment(parseFloat(e.target.value) || 0)}
                    className="form-input"
                    style={{ fontSize: "13.5px", fontWeight: "700", padding: "6px 10px", borderColor: "var(--primary)", backgroundColor: "var(--primary-light)" }}
                  />
                </>
              ) : (
                <>
                  <label htmlFor="demand-input" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-dark)", display: "block", marginBottom: "4px", whiteSpace: "nowrap" }}>
                    Acting Axial Load, P (Ultimate) (kips)
                  </label>
                  <input
                    id="demand-input"
                    type="number"
                    min="0"
                    step="0.5"
                    value={appliedLoad}
                    onChange={(e) => setAppliedLoad(parseFloat(e.target.value) || 0)}
                    className="form-input"
                    style={{ fontSize: "13.5px", fontWeight: "700", padding: "6px 10px", borderColor: "var(--primary)", backgroundColor: "var(--primary-light)" }}
                  />
                </>
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
        {(calcError || k5Error || faceLenError) && (
          <div className="error-alert">
            <strong>Calculation error:</strong> {calcError || k5Error || faceLenError}
          </div>
        )}

        {/* Checks grid (2 columns side-by-side) */}
        <div className="checks-grid">
          {/* Effective Length Trace (Collapsible) */}
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

        {/* Check 1: Weld metal (Collapsible) */}
        {weld && (
          <CheckBlock
            title={solicitation === "shear" ? "Check 1: Weld metal shear rupture" : "Check 1: Weld metal tension rupture"}
            codeRef="AISC 360-16 §J2.4"
            tooltipSections={TOOLTIP_DATA.weldMetal}
            traceSteps={[
              solicitation === "moment" ? {
                eq: `P_face = (M·12/d)·SF = (${appliedMoment.toFixed(2)}·12/${dCouple.toFixed(2)})·${momentShareFactor.toFixed(3)}`,
                codeRef: "AISC Table K5.1 elastic share (SF = Le/(Le+d/3))",
                value: `${pFace.toFixed(2)} kips`
              } : solicitation === "tension" ? {
                eq: `P_face = P·[${faceSymbol} / 2(B_b+H_b)] = ${appliedLoad.toFixed(2)}·[${selectedFaceNominal} / ${2 * (branch.B + branch.H)}]`,
                codeRef: "Tension force perimeter distribution",
                value: `${pFace.toFixed(2)} kips`
              } : {
                eq: `P_face = P·[${faceSymbol} / 2(B_b+H_b)] = ${appliedLoad.toFixed(2)}·[${selectedFaceNominal} / ${2 * (branch.B + branch.H)}]`,
                codeRef: "Weld force perimeter distribution",
                value: `${pFace.toFixed(2)} kips`
              },
              { eq: "te = 0.707·w", codeRef: "AISC 360-16 §J2.2a", value: `${weld.te.toFixed(4)} in` },
              { eq: `Awe = te·L_eff = ${weld.te.toFixed(4)}·${faceLen.length.toFixed(3)}`,
                codeRef: "AISC 360-16 §J2.4 effective area", value: `${weld.Awe.toFixed(3)} in²` },
              { eq: fnwEq, codeRef: fnwRef, value: `${weld.Fnw.toFixed(2)} ksi` },
              ...(weld.beta < 1.0 ? [
                { eq: "β = 1.2 - 0.002·(L/w)", codeRef: `AISC §J2.2b Eq. J2-1 long weld reduction (L/w = ${(faceLen.length / legSize).toFixed(1)} > 100)`, value: weld.beta.toFixed(3) },
                { eq: "Rn = β·Fnw·Awe", codeRef: "AISC 360-16 §J2.4 nominal capacity (reduced)", value: `${weld.Rn.toFixed(2)} kips` }
              ] : [
                { eq: "Rn = Fnw·Awe", codeRef: "AISC 360-16 §J2.4 nominal capacity", value: `${weld.Rn.toFixed(2)} kips` }
              ]),
              { eq: designEq, codeRef: designRef, value: `${weld.cap.toFixed(2)} kips` },
            ]}
            statCards={[
              { label: "Nominal Rn", value: `${weld.Rn.toFixed(2)} kips` },
              { label: capLabel, value: `${weld.cap.toFixed(2)} kips` },
              { label: "DCR", value: weld.dcr !== null ? weld.dcr.toFixed(3) : "—" },
            ]}
            checkProps={weld.status ? {
              status: weld.status, demand: pFace, cap: weld.cap, dcr: weld.dcr,
              label: weld.status === "OK" ? (solicitation === "shear" ? "Weld metal shear adequate" : "Weld metal tension adequate") : (solicitation === "shear" ? "Weld metal shear inadequate" : "Weld metal tension inadequate"),
            } : null}
          />
        )}

        {/* Check 2: Base metal (Collapsible) */}
        {base && (
          <CheckBlock
            title={solicitation === "shear" ? `Check 2: Base metal shear (${baseLabel})` : `Check 2: Base metal tension (${baseLabel})`}
            codeRef="AISC 360-16 §J4.2"
            tooltipSections={TOOLTIP_DATA.baseMetal}
            traceSteps={[
              solicitation === "moment" ? {
                eq: `P_face = (M·12/d)·SF = (${appliedMoment.toFixed(2)}·12/${dCouple.toFixed(2)})·${momentShareFactor.toFixed(3)}`,
                codeRef: "AISC Table K5.1 elastic share (SF = Le/(Le+d/3))",
                value: `${pFace.toFixed(2)} kips`
              } : solicitation === "tension" ? {
                eq: `P_face = P·[${faceSymbol} / 2(B_b+H_b)] = ${appliedLoad.toFixed(2)}·[${selectedFaceNominal} / ${2 * (branch.B + branch.H)}]`,
                codeRef: "Tension force perimeter distribution",
                value: `${pFace.toFixed(2)} kips`
              } : {
                eq: `P_face = P·[${faceSymbol} / 2(B_b+H_b)] = ${appliedLoad.toFixed(2)}·[${selectedFaceNominal} / ${2 * (branch.B + branch.H)}]`,
                codeRef: "Weld force perimeter distribution",
                value: `${pFace.toFixed(2)} kips`
              },
              { eq: `A = t·L_eff = ${baseT.toFixed(4)}·${faceLen.length.toFixed(3)}`,
                codeRef: "AISC 360-16 base critical area", value: `${base.A.toFixed(3)} in²` },
              { eq: `Yielding: Rn = 0.60·Fy·A = 0.60·${baseFy}·${base.A.toFixed(3)}`,
                codeRef: "AISC 360-16 Eq. J4-3", value: `${base.RnYield.toFixed(2)} kips` },
              { eq: "φRn (yield) = 1.00·Rn",
                codeRef: "φ = 1.00", value: `${base.capYield.toFixed(2)} kips` },
              { eq: `Rupture: Rn = 0.60·Fu·A = 0.60·${baseFu}·${base.A.toFixed(3)}`,
                codeRef: "AISC 360-16 Eq. J4-4", value: `${base.RnRupture.toFixed(2)} kips` },
              { eq: "φRn (rupture) = 0.75·Rn",
                codeRef: "φ = 0.75", value: `${base.capRupture.toFixed(2)} kips` },
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
              label: base.status === "OK" ? (solicitation === "shear" ? "Base metal shear adequate" : "Base metal tension adequate") : (solicitation === "shear" ? "Base metal shear inadequate" : "Base metal tension inadequate"),
            } : null}
          />
        )}

        {/* Check 3: Weld size limits (Collapsible) */}
        {size && (
          <CheckBlock
            title="Check 3: Weld size limits"
            codeRef="AISC 360-16 §J2.2b, Table J2.4"
            tooltipSections={TOOLTIP_DATA.weldSize}
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
        </div>

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
