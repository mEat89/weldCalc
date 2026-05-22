import React, { useState } from "react";
import {
  HSS_SHAPES,
  STEEL_GRADES,
  LEG_SIZES,
  FEXX_OPTIONS,
  FACE_TYPES,
  LENGTH_METHODS,
} from "../../constants/steelData";
import {
  calcWeldMetal,
  calcBaseMetal,
  calcWeldSize,
  calcK5EffectiveWidth,
  calcK5LOA,
  calcFaceEffectiveLength,
  calcLoadDistribution,
  toFraction,
  to16ths,
} from "../../math/weldMath";
import { Field, InchInput, PlateQuickPick, LoadCaseSelector } from "../shared/FormElements";
import { CheckBlock, Collapsible, WarningBanner } from "../shared/CheckResults";

export default function HSSTab() {
  // Connection sub-type
  const [connType, setConnType] = useState("hss2hss"); // hss2plate | hss2hss

  // Effective length method
  const [lengthMode, setLengthMode] = useState("aisc"); // 'aisc' | 'k5' | 'cbfem'

  // Geometry state indexes
  const [branchIdx, setBranchIdx] = useState(11); // HSS6x6x1/4 default
  const [branchGradeIdx, setBranchGradeIdx] = useState(4); // A500 Gr C Rect default
  const [chordIdx, setChordIdx] = useState(26); // HSS10x10x3/8 default
  const [chordGradeIdx, setChordGradeIdx] = useState(4);
  const [plateT, setPlateT] = useState(0.5);
  const [plateGradeIdx, setPlateGradeIdx] = useState(0);

  // Plate dimensions override
  const [plateBOverride, setPlateBOverride] = useState(0);

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

  // CBFEM Lc input
  const [cbfemLc, setCbfemLc] = useState(1.5);

  // Load distribution helper state
  const [helperOpen, setHelperOpen] = useState(false);
  const [pTotal, setPTotal] = useState(0);

  // Derived members & grades
  const branch = HSS_SHAPES[branchIdx] || HSS_SHAPES[0];
  const chord = HSS_SHAPES[chordIdx] || HSS_SHAPES[0];
  const branchGrade = STEEL_GRADES[branchGradeIdx] || STEEL_GRADES[0];
  const chordGrade = STEEL_GRADES[chordGradeIdx] || STEEL_GRADES[0];
  const plateGrade = STEEL_GRADES[plateGradeIdx] || STEEL_GRADES[0];

  // Identify whether the selected face is transverse
  const isTransverseFace =
    (connType === "hss2hss" && selectedFaceDim === branchTransverseDim) ||
    (connType === "hss2plate" && lengthMode === "k5");

  const transverseLen = branchTransverseDim === "B" ? branch.B : branch.H;
  const parallelLen   = branchTransverseDim === "B" ? branch.H : branch.B;
  const selectedFaceNominal = selectedFaceDim === "B" ? branch.B : branch.H;

  const thetaDeg = loadCase === "long" ? 0 : loadCase === "trans" ? 90 : angleDeg;

  const effectivePlateB = plateBOverride > 0
    ? plateBOverride
    : 2 * selectedFaceNominal;

  let k5 = null, k5Error = null;
  if (connType === "hss2hss") {
    try {
      k5 = calcK5EffectiveWidth({
        chordB: chord.B,
        chordT: chord.tDes,
        chordFy: chordGrade.fy,
        branchB: transverseLen,
        branchT: branch.tDes,
        branchFy: branchGrade.fy,
      });
    } catch (e) { k5Error = e.message; }
  } else if (connType === "hss2plate" && lengthMode === "k5") {
    try {
      k5 = calcK5EffectiveWidth({
        chordB: effectivePlateB,
        chordT: plateT,
        chordFy: plateGrade.fy,
        branchB: selectedFaceNominal,
        branchT: branch.tDes,
        branchFy: branchGrade.fy,
      });
    } catch (e) { k5Error = e.message; }
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
      mode: lengthMode,
      faceLength: selectedFaceNominal,
      isTransverse: isTransverseFace,
      connType,
      k5,
      cbfemLc,
    });
    faceLen = overrideLength
      ? { ...dispatched, length: customLength, ref: dispatched.ref + " (overridden by user)" }
      : dispatched;
  } catch (e) { faceLenError = e.message; }

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
    } catch (e) { calcError = e.message; }
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

  // Per-face effective lengths for load distribution helper
  let faceBEffForDist, faceHEffForDist;
  try {
    if (lengthMode === "cbfem") {
      faceBEffForDist = cbfemLc;
      faceHEffForDist = cbfemLc;
    } else if (connType === "hss2hss" && k5) {
      const k5face = branchTransverseDim === "B" ? k5.be : branch.B;
      const otherFace = branchTransverseDim === "B" ? branch.H : k5.be;
      faceBEffForDist = k5face;
      faceHEffForDist = otherFace;
    } else if (connType === "hss2plate" && lengthMode === "k5") {
      const k5B = calcK5EffectiveWidth({
        chordB: plateBOverride > 0 ? plateBOverride : 2 * branch.B,
        chordT: plateT, chordFy: plateGrade.fy,
        branchB: branch.B, branchT: branch.tDes, branchFy: branchGrade.fy,
      });
      const k5H = calcK5EffectiveWidth({
        chordB: plateBOverride > 0 ? plateBOverride : 2 * branch.H,
        chordT: plateT, chordFy: plateGrade.fy,
        branchB: branch.H, branchT: branch.tDes, branchFy: branchGrade.fy,
      });
      faceBEffForDist = k5B.be;
      faceHEffForDist = k5H.be;
    } else {
      faceBEffForDist = branch.B;
      faceHEffForDist = branch.H;
    }
  } catch (e) {
    faceBEffForDist = branch.B;
    faceHEffForDist = branch.H;
  }

  // Distribution helper output
  let loadDist = null, loadDistError = null;
  if (helperOpen && pTotal > 0) {
    try {
      loadDist = calcLoadDistribution({
        pTotal,
        faceBEff: faceBEffForDist,
        faceHEff: faceHEffForDist,
      });
    } catch (e) { loadDistError = e.message; }
  }

  // UI Strings
  const fnwEq = effectiveUseDirectional
    ? "Fnw = 0.60·FEXX·(1 + 0.5·sin^1.5 θ)" : "Fnw = 0.60·FEXX";
  const fnwRef = effectiveUseDirectional
    ? `AISC 360-22 §J2.4, Eq. J2-5 (θ = ${thetaDeg}°)` +
      (lengthMode === "cbfem" ? " — Θ should match the value reported by Profis for the critical element" : "")
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
    if (lengthMode === "cbfem") {
      return `Face along ${selectedFaceDim} (${dimLabel}) — using Lc = ${cbfemLc}" (CBFEM mode)`;
    }
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

  return (
    <div className="tab-pane">
      {/* Connection type selection */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-section-label">Connection type</div>
        <div className="toggle-btn-grid">
          <button
            onClick={() => { setConnType("hss2plate"); if (lengthMode === "aisc") setSelectedFaceDim("B"); }}
            className={`toggle-option-btn ${connType === "hss2plate" ? "active" : ""}`}
            type="button"
          >
            <div className="btn-main-label">HSS to Plate</div>
            <div className="btn-sub-label">HSS welded to base/embed/cap plate — no K5 reduction</div>
          </button>
          <button
            onClick={() => setConnType("hss2hss")}
            className={`toggle-option-btn ${connType === "hss2hss" ? "active" : ""}`}
            type="button"
          >
            <div className="btn-main-label">HSS to HSS (branch)</div>
            <div className="btn-sub-label">Branch HSS welded to chord HSS face — §K5 applies</div>
          </button>
        </div>
      </div>

      {/* Geometry selection */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-section-label">
          {connType === "hss2plate" ? "Member & plate" : "Branch & chord members"}
        </div>
        <div className="form-input-grid">
          <Field label={connType === "hss2plate" ? "HSS member" : "Branch HSS"} id="hss-member-select">
            <select
              id="hss-member-select"
              value={branchIdx}
              onChange={(e) => setBranchIdx(parseInt(e.target.value))}
              className="form-select"
            >
              {HSS_SHAPES.map((s, i) => (
                <option key={i} value={i}>
                  {s.name} (H={s.H}", B={s.B}")
                </option>
              ))}
            </select>
          </Field>

          <Field label={connType === "hss2plate" ? "HSS grade" : "Branch grade"} id="branch-grade-select">
            <select
              id="branch-grade-select"
              value={branchGradeIdx}
              onChange={(e) => setBranchGradeIdx(parseInt(e.target.value))}
              className="form-select"
            >
              {STEEL_GRADES.filter((g) => g.category === "hss").map((g) => {
                const idx = STEEL_GRADES.indexOf(g);
                return <option key={idx} value={idx}>{g.label}</option>;
              })}
            </select>
          </Field>

          {connType === "hss2plate" ? (
            <Field label="Plate grade" id="plate-grade-select">
              <select
                id="plate-grade-select"
                value={plateGradeIdx}
                onChange={(e) => setPlateGradeIdx(parseInt(e.target.value))}
                className="form-select"
              >
                {STEEL_GRADES.filter((g) => g.category === "plate").map((g) => {
                  const idx = STEEL_GRADES.indexOf(g);
                  return <option key={idx} value={idx}>{g.label}</option>;
                })}
              </select>
            </Field>
          ) : (
            <Field label="Chord HSS" id="chord-hss-select">
              <select
                id="chord-hss-select"
                value={chordIdx}
                onChange={(e) => setChordIdx(parseInt(e.target.value))}
                className="form-select"
              >
                {HSS_SHAPES.map((s, i) => (
                  <option key={i} value={i}>{s.name}</option>
                ))}
              </select>
            </Field>
          )}
        </div>

        {connType === "hss2plate" ? (
          <div className="form-input-grid mt-3">
            <InchInput label="Plate thickness, tp" value={plateT} onChange={setPlateT} id="plate-thickness" />
            <div className="grid-span-2">
              <div className="form-label-small">Common plate thicknesses</div>
              <PlateQuickPick value={plateT} onChange={setPlateT} />
            </div>
          </div>
        ) : (
          <div className="grade-display-row mt-3">
            <Field label="Chord t_des" helper={`Catalog: ${toFraction(chord.tNom)} nominal`}>
              <input value={`${chord.tDes.toFixed(4)} in`} disabled className="form-input disabled" />
            </Field>
            <Field label="Chord grade" id="chord-grade-select">
              <select
                id="chord-grade-select"
                value={chordGradeIdx}
                onChange={(e) => setChordGradeIdx(parseInt(e.target.value))}
                className="form-select"
              >
                {STEEL_GRADES.filter((g) => g.category === "hss").map((g) => {
                  const idx = STEEL_GRADES.indexOf(g);
                  return <option key={idx} value={idx}>{g.label}</option>;
                })}
              </select>
            </Field>
            <Field label="Chord: Fy / Fu">
              <input value={`${chordGrade.fy} / ${chordGrade.fu} ksi`} disabled className="form-input disabled" />
            </Field>
          </div>
        )}
      </div>

      {/* Effective length method */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-section-label">Effective length method</div>
        <div className="length-mode-grid">
          {LENGTH_METHODS.map((m) => {
            const active = lengthMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setLengthMode(m.id)}
                className={`toggle-option-btn ${active ? "active" : ""}`}
                type="button"
              >
                <div className="btn-main-label">{m.label}</div>
                <div className="btn-sub-label">{m.short}</div>
              </button>
            );
          })}
        </div>
        <div className="length-mode-description">
          <strong>{LENGTH_METHODS.find((m) => m.id === lengthMode).label}:</strong>{" "}
          {LENGTH_METHODS.find((m) => m.id === lengthMode).description}
        </div>

        {/* Mode-specific configuration inputs */}
        {lengthMode === "k5" && connType === "hss2plate" && (
          <div className="form-input-grid mt-3">
            <InchInput
              label="Plate B parallel to weld (0 = auto 2×face)"
              value={plateBOverride}
              onChange={setPlateBOverride}
              min={0}
              step={0.25}
              id="plate-b-override"
            />
            <Field label="Auto-computed plate B (when override = 0)" helper="Default = 2 × face length (cantilever baseplate)">
              <input
                value={`${(plateBOverride > 0 ? plateBOverride : 2 * transverseLen).toFixed(2)} in`}
                disabled
                className="form-input disabled"
              />
            </Field>
          </div>
        )}

        {lengthMode === "cbfem" && (
          <div className="form-input-grid mt-3">
            <InchInput
              label="Lc — critical element length (from Profis)"
              value={cbfemLc}
              onChange={setCbfemLc}
              min={0.1}
              step={0.1}
              id="cbfem-lc-input"
            />
            <Field label="Selected face nominal length" helper="Lc must not exceed this value">
              <input value={`${selectedFaceNominal} in`} disabled className="form-input disabled" />
            </Field>
            <Field label="Lc / nominal (utilization of face)" helper="Typical Profis: 10–20% on transverse face">
              <input
                value={`${((cbfemLc / selectedFaceNominal) * 100).toFixed(1)}%`}
                disabled
                className="form-input disabled"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Advisory LOA limits banner */}
      {connType === "hss2hss" && loa && !loa.withinLOA && (
        <WarningBanner
          title="Outside §K5 / Table K3.1A Limits of Applicability — equations are advisory only"
          items={loa.violations}
        />
      )}

      {/* Branch orientation relative to chord (HSS-to-HSS only) */}
      {connType === "hss2hss" && (
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-section-label">Branch orientation relative to chord</div>
          <div className="toggle-btn-grid">
            <button
              onClick={() => setBranchTransverseDim("B")}
              className={`toggle-option-btn ${branchTransverseDim === "B" ? "active" : ""}`}
              type="button"
            >
              <div className="btn-main-label">Branch B is transverse to chord</div>
              <div className="btn-sub-label">
                K5 applies to {branch.B}"-long welds; {branch.H}"-long welds fully effective
              </div>
            </button>
            <button
              onClick={() => setBranchTransverseDim("H")}
              className={`toggle-option-btn ${branchTransverseDim === "H" ? "active" : ""}`}
              type="button"
            >
              <div className="btn-main-label">Branch H is transverse to chord</div>
              <div className="btn-sub-label">
                K5 applies to {branch.H}"-long welds; {branch.B}"-long welds fully effective
              </div>
            </button>
          </div>
          <div className="length-mode-description">
            Per AISC 360-16 §K5 Table K5.1, only the branch face whose weld runs
            transverse to the chord axis is reduced by the effective width Be.
            Parallel face welds are fully effective.
          </div>
        </div>
      )}

      {/* Face Selection */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-section-label">Select weld face to analyze</div>
        <div className="toggle-btn-grid">
          {FACE_TYPES.map((f) => {
            const active = selectedFaceDim === f.id;
            const isTransThisFace = connType === "hss2hss" && f.id === branchTransverseDim;
            const k5ReductionApplies =
              (connType === "hss2hss" && isTransThisFace) ||
              (connType === "hss2plate" && lengthMode === "k5" && f.id === branchTransverseDim);
            const lengthStr = f.id === "B" ? `${branch.B}"` : `${branch.H}"`;

            let subLabel;
            if (lengthMode === "cbfem") {
              subLabel = "Lc applies (CBFEM mode)";
            } else if (connType === "hss2hss") {
              subLabel = isTransThisFace ? "Transverse to chord — K5 reduced" : "Parallel to chord — fully effective";
            } else {
              subLabel = lengthMode === "k5"
                ? (k5ReductionApplies ? "K5 reduced (plate as chord)" : "Fully effective (parallel face)")
                : "Fully effective (no K5 reduction)";
            }

            return (
              <button
                key={f.id}
                onClick={() => setSelectedFaceDim(f.id)}
                className={`toggle-option-btn ${active ? "active" : ""}`}
                type="button"
              >
                <div className="btn-main-label">Face along {f.id} ({lengthStr})</div>
                <div className="btn-sub-label">{subLabel}</div>
              </button>
            );
          })}
        </div>
        <div className="length-mode-description">
          <strong>Selected:</strong> {faceDescription}
        </div>
      </div>

      {/* Effective Length Trace */}
      {faceLen && (() => {
        let traceSteps = [];
        let codeRef = "";

        if (lengthMode === "cbfem") {
          codeRef = "CBFEM peak-element method (Hilti Profis / IDEA StatiCa)";
          traceSteps = [
            { eq: `Selected face nominal length = ${selectedFaceDim} = ${selectedFaceNominal}"`,
              codeRef: "From branch HSS shape catalog",
              value: `${selectedFaceNominal} in` },
            { eq: `Engineer-input Lc = ${cbfemLc} in`,
              codeRef: "Critical FE element mesh length, read from Profis output",
              value: `${cbfemLc.toFixed(3)} in` },
            { eq: `Lc / nominal = ${((cbfemLc / selectedFaceNominal) * 100).toFixed(1)}%`,
              codeRef: "Effective length ratio (mesh element coverage)",
              value: faceLen.reduced ? "Reduction applied" : "Full length" },
            { eq: `L_eff (this face) = Lc = ${cbfemLc} in`,
              codeRef: "Forces treated as concentrated at critical elements",
              value: `${faceLen.length.toFixed(3)} in` },
          ];
        } else if (lengthMode === "k5" && connType === "hss2plate") {
          codeRef = "AISC 360 §K5 Eq. K1-1 (engineering judgment — plate as chord)";
          if (isTransverseFace && k5) {
            traceSteps = [
              { eq: `Plate B (parallel to weld) = ${effectivePlateB.toFixed(2)}"`,
                codeRef: plateBOverride > 0 ? "User input" : "Auto: 2 × selected face dim",
                value: `${effectivePlateB.toFixed(2)} in` },
              { eq: `B/t (plate) = ${effectivePlateB.toFixed(2)} / ${plateT.toFixed(4)} = ${k5.Bt.toFixed(2)}`,
                codeRef: "Plate wall slenderness — proxy for chord slenderness",
                value: k5.Bt.toFixed(2) },
              { eq: `Be_raw = (10/(B/t))·(Fyp·tp / (Fyb·tb))·Bb`,
                codeRef: "K5 Eq. K1-1 applied to plate-as-chord",
                value: `${k5.beRaw.toFixed(3)} in` },
              { eq: `     = (10/${k5.Bt.toFixed(2)})·(${plateGrade.fy}·${plateT.toFixed(4)} / (${branchGrade.fy}·${branch.tDes.toFixed(4)}))·${selectedFaceNominal}`,
                codeRef: "Substituted engineering metrics",
                value: `${k5.beRaw.toFixed(3)} in` },
              { eq: `Be = min(Be_raw, Bb) = min(${k5.beRaw.toFixed(3)}, ${selectedFaceNominal})`,
                codeRef: k5.capped ? "Capped at Bb (rigid plate behavior — no reduction)" : "Be < Bb — reduction governs",
                value: `${k5.be.toFixed(3)} in` },
              { eq: `L_eff (this face) = Be`,
                codeRef: "K5 reduction width applied to selected face",
                value: `${k5.be.toFixed(3)} in` },
            ];
          } else {
            traceSteps = [
              { eq: `Face is parallel to bending axis or K5 reduction skipped`,
                codeRef: "K5 mode hss2plate: K5 applies only to transverse welds",
                value: "—" },
              { eq: `L_eff (this face) = ${selectedFaceNominal}" (nominal)`,
                codeRef: "Longitudinal perimeter welds fully effective",
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
              codeRef: "Substituted section properties",
              value: `${k5.beRaw.toFixed(3)} in` },
            { eq: `Be = min(Be_raw, Bb) = min(${k5.beRaw.toFixed(3)}, ${transverseLen})`,
              codeRef: k5.capped ? "Capped at Bb (§K5 upper limit)" : "Be < Bb — reduction governs",
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
          codeRef = "AISC 360-22 §J2.4 — full nominal (Tousignant & Packer 2015)";
          traceSteps = [
            { eq: `Selected face dimension = ${selectedFaceDim} = ${selectedFaceNominal}"`,
              codeRef: "From catalog dimensions",
              value: `${selectedFaceNominal} in` },
            { eq: `L_eff = ${faceLen.length.toFixed(3)}" (full nominal)`,
              codeRef: "Rigid plate supports uniform stress along this boundary",
              value: `${faceLen.length.toFixed(3)} in` },
          ];
        }

        return (
          <CheckBlock
            title={`Effective length of selected face [${LENGTH_METHODS.find((m) => m.id === lengthMode).short}]`}
            codeRef={codeRef}
            traceSteps={traceSteps}
            statCards={[
              { label: "Mode", value: LENGTH_METHODS.find((m) => m.id === lengthMode).short },
              { label: "Nominal", value: `${selectedFaceNominal} in` },
              { label: "L_eff (used)", value: `${faceLen.length.toFixed(3)} in` },
            ]}
            checkProps={null}
          />
        );
      })()}

      {/* Load distribution helper */}
      <Collapsible
        title="Load Distribution Helper (optional)"
        subtitle="Suggest P_face from total branch axial P_total — uniform stress, effective-area-proportional split"
        open={helperOpen}
        onToggle={() => setHelperOpen(!helperOpen)}
      >
        <div className="form-input-grid">
          <Field label="Total branch axial force P_total (kips)" helper="Axial load at branch centroid (+ = magnitude)">
            <input
              type="number"
              min="0"
              step="0.1"
              value={pTotal}
              onChange={(e) => setPTotal(parseFloat(e.target.value) || 0)}
              className="form-input"
            />
          </Field>
        </div>

        {loadDistError && <div className="error-alert mt-2"><strong>Input error:</strong> {loadDistError}</div>}

        {loadDist && (
          <div className="table-responsive mt-3">
            <table className="helper-table-data">
              <thead>
                <tr>
                  <th>Face</th>
                  <th>L_eff (per face)</th>
                  <th>Share of P_total</th>
                  <th>P per face</th>
                  <th>Use</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    Face B ({branch.B}" nominal)
                    {faceBEffForDist < branch.B - 1e-9 && " — reduced"}
                  </td>
                  <td>{loadDist.faceBEff.toFixed(3)} in</td>
                  <td>{loadDist.PBPct.toFixed(1)}%</td>
                  <td>{loadDist.PB.toFixed(2)} kips</td>
                  <td>
                    <button onClick={() => setPFace(loadDist.PB)} className="btn-copy-val" type="button">
                      → P_face
                    </button>
                  </td>
                </tr>
                <tr>
                  <td>
                    Face H ({branch.H}" nominal)
                    {faceHEffForDist < branch.H - 1e-9 && " — reduced"}
                  </td>
                  <td>{loadDist.faceHEff.toFixed(3)} in</td>
                  <td>{loadDist.PHPct.toFixed(1)}%</td>
                  <td>{loadDist.PH.toFixed(2)} kips</td>
                  <td>
                    <button onClick={() => setPFace(loadDist.PH)} className="btn-copy-val" type="button">
                      → P_face
                    </button>
                  </td>
                </tr>
                <tr className="summary-row">
                  <td>Total perimeter (2 each)</td>
                  <td>{loadDist.Ltotal.toFixed(3)} in</td>
                  <td>100.0%</td>
                  <td>{(2 * loadDist.PB + 2 * loadDist.PH).toFixed(2)} kips</td>
                  <td>—</td>
                </tr>
              </tbody>
            </table>
            <div className="helper-footnote mt-2">
              <strong>Method:</strong> P_face = P_total × L_eff,face / L_eff,total. Assumes pure axial load
              and uniform stress along the effective perimeter. Not valid for combined moments.
            </div>
          </div>
        )}
      </Collapsible>

      {/* Load Case Selector Component */}
      <LoadCaseSelector
        loadCase={loadCase}
        setLoadCase={setLoadCase}
        useDirectional={useDirectional}
        setUseDirectional={setUseDirectional}
        lockDirectional={lockDirectional}
        lockReason={lockReason}
      />

      {/* Weld details selection */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-section-label">Weld parameters</div>
        <div className="form-input-grid">
          <Field label="Weld leg size, w" id="weld-leg-select">
            <select
              id="weld-leg-select"
              value={legSize}
              onChange={(e) => setLegSize(parseFloat(e.target.value))}
              className="form-select"
            >
              {LEG_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>

          <Field label="Electrode FEXX (ksi)" id="fexx-select">
            <select
              id="fexx-select"
              value={fexx}
              onChange={(e) => setFexx(parseFloat(e.target.value))}
              className="form-select"
            >
              {FEXX_OPTIONS.map((f) => <option key={f} value={f}>E{f}</option>)}
            </select>
          </Field>

          <Field label="Design method" id="design-method-select">
            <select
              id="design-method-select"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="form-select"
            >
              <option value="lrfd">LRFD (φ = 0.75)</option>
              <option value="asd">ASD (Ω = 2.00)</option>
            </select>
          </Field>

          <Field label="Force on this face, P_face (kips)" helper="Per-face axial shear force demand">
            <input
              type="number"
              min="0"
              step="0.1"
              value={pFace}
              onChange={(e) => setPFace(parseFloat(e.target.value) || 0)}
              className="form-input"
            />
          </Field>

          <Field
            label={`Effective length, L_eff ${overrideLength ? "" : "(auto)"}`}
            helper={overrideLength ? "" : (faceLen ? `Auto: ${faceLen.length.toFixed(3)} in` : "—")}
          >
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={overrideLength ? customLength : (faceLen?.length.toFixed(3) ?? 0)}
              disabled={!overrideLength}
              onChange={(e) => setCustomLength(parseFloat(e.target.value) || 0)}
              className={`form-input ${overrideLength ? "" : "disabled"}`}
            />
          </Field>

          <Field label="Length override">
            <label className="conservative-checkbox-row mt-1">
              <input
                type="checkbox"
                checked={overrideLength}
                onChange={(e) => {
                  setOverrideLength(e.target.checked);
                  if (e.target.checked && faceLen) setCustomLength(faceLen.length);
                }}
                className="checkbox-input"
              />
              <span className="checkbox-text">Override auto length</span>
            </label>
          </Field>

          {loadCase === "angle" && (
            <Field label={`Load angle θ = ${angleDeg}°`}>
              <div className="slider-container">
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="1"
                  value={angleDeg}
                  onChange={(e) => setAngleDeg(parseInt(e.target.value, 10))}
                  className="form-slider"
                />
              </div>
            </Field>
          )}
        </div>
      </div>

      {/* Computational errors display */}
      {(calcError || k5Error || faceLenError) && (
        <div className="error-alert mb-4">
          <strong>Calculation error:</strong> {calcError || k5Error || faceLenError}
        </div>
      )}

      {/* Check 1: Weld metal */}
      {weld && (
        <CheckBlock
          title="Check 1: Weld metal shear rupture"
          codeRef="AISC 360-16 §J2.4"
          traceSteps={[
            { eq: "te = 0.707·w", codeRef: "AISC 360-16 §J2.2a", value: `${weld.te.toFixed(4)} in` },
            { eq: `Awe = te·L_eff = ${weld.te.toFixed(4)}·${faceLen.length.toFixed(3)}`,
              codeRef: "AISC 360-16 §J2.4(a) effective weld area", value: `${weld.Awe.toFixed(3)} in²` },
            { eq: fnwEq, codeRef: fnwRef, value: `${weld.Fnw.toFixed(2)} ksi` },
            { eq: "Rn = Fnw·Awe", codeRef: "AISC 360-16 §J2.4 nominal shear capacity", value: `${weld.Rn.toFixed(2)} kips` },
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

      {/* Check 2: Base metal */}
      {base && (
        <CheckBlock
          title={`Check 2: Base metal shear (${baseLabel})`}
          codeRef="AISC 360-16 §J4.2"
          traceSteps={[
            { eq: `A = t·L_eff = ${baseT.toFixed(4)}·${faceLen.length.toFixed(3)}`,
              codeRef: "AISC 360-16 §J4.2 base shear critical area", value: `${base.A.toFixed(3)} in²` },
            { eq: `Yielding: Rn = 0.60·Fy·A = 0.60·${baseFy}·${base.A.toFixed(3)}`,
              codeRef: "AISC 360-16 §J4.2(a) Eq. J4-3", value: `${base.RnYield.toFixed(2)} kips` },
            { eq: method === "lrfd" ? "φRn (yield) = 1.00·Rn" : "Rn/Ω (yield) = Rn / 1.50",
              codeRef: method === "lrfd" ? "φ = 1.00" : "Ω = 1.50", value: `${base.capYield.toFixed(2)} kips` },
            { eq: `Rupture: Rn = 0.60·Fu·A = 0.60·${baseFu}·${base.A.toFixed(3)}`,
              codeRef: "AISC 360-16 §J4.2(b) Eq. J4-4", value: `${base.RnRupture.toFixed(2)} kips` },
            { eq: method === "lrfd" ? "φRn (rupture) = 0.75·Rn" : "Rn/Ω (rupture) = Rn / 2.00",
              codeRef: method === "lrfd" ? "φ = 0.75" : "Ω = 2.00", value: `${base.capRupture.toFixed(2)} kips` },
            { eq: `Governing: ${base.governs} (lower limit)`,
              codeRef: "min(yield cap, rupture cap)", value: `${base.cap.toFixed(2)} kips` },
          ]}
          statCards={[
            { label: `${baseLabel} Fy / Fu`, value: `${baseFy} / ${baseFu} ksi` },
            { label: `Governs: ${base.governs}`, value: `${base.cap.toFixed(2)} kips` },
            { label: "DCR", value: base.dcr !== null ? base.dcr.toFixed(3) : "—" },
          ]}
          checkProps={base.status ? {
            status: base.status, demand: pFace, cap: base.cap, dcr: base.dcr,
            label: base.status === "OK" ? "Base metal adequate" : "Base metal inadequate",
          } : null}
        />
      )}

      {/* Check 3: Weld size limits */}
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
        <div className={`governing-summary-card ${governing.status === "OK" ? "pass" : "fail"}`}>
          <div className="summary-title">Governing strength check (this face only): {governing.which}</div>
          <div className="summary-body">
            {capLabel} = {governing.cap.toFixed(2)} kips,&nbsp;
            DCR = {governing.dcr.toFixed(3)},&nbsp;
            Status: <strong>{governing.status}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
