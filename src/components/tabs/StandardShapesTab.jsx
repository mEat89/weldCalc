import React, { useState } from "react";
import { STEEL_GRADES, LEG_SIZES, FEXX_OPTIONS, SHAPE_PRESETS } from "../../constants/steelData";
import { calcWeldMetal, calcBaseMetal, calcWeldSize, toFraction, to16ths } from "../../math/weldMath";
import { Field, InchInput, LoadCaseSelector } from "../shared/FormElements";
import { CheckBlock } from "../shared/CheckResults";

export default function StandardShapesTab() {
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
  } catch (e) { calcError = e.message; }

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
    <div className="tab-pane">
      {/* Shape preset connection type */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-section-label">Connection type</div>
        <div className="preset-toggle-grid">
          {SHAPE_PRESETS.map((s, i) => {
            const active = shapeIdx === i;
            return (
              <button
                key={s.id}
                onClick={() => setShapeIdx(i)}
                className={`toggle-option-btn ${active ? "active" : ""}`}
                type="button"
              >
                <div className="btn-main-label">{s.label}</div>
                <div className="btn-sub-label">{s.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Load Case Selector */}
      <LoadCaseSelector
        loadCase={loadCase}
        setLoadCase={setLoadCase}
        useDirectional={useDirectional}
        setUseDirectional={setUseDirectional}
        lockDirectional={false}
      />

      {/* Thicknesses & Materials */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-section-label">Member & connected plate</div>
        <div className="grade-display-row">
          <InchInput label="Member element thickness" value={memberT} onChange={setMemberT} id="member-thickness" />
          <Field label="Member grade" id="member-grade">
            <select
              id="member-grade"
              value={memberGradeIdx}
              onChange={(e) => setMemberGradeIdx(parseInt(e.target.value))}
              className="form-select"
            >
              {STEEL_GRADES.map((g, i) => (
                <option key={i} value={i}>{g.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Member: Fy / Fu">
            <input value={`${memberGrade.fy} / ${memberGrade.fu} ksi`} disabled className="form-input disabled" />
          </Field>
        </div>
        <div className="grade-display-row mt-3">
          <InchInput label="Plate thickness, tp" value={plateT} onChange={setPlateT} id="plate-thickness" />
          <Field label="Plate grade" id="plate-grade">
            <select
              id="plate-grade"
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
          <Field label="Plate: Fy / Fu">
            <input value={`${plateGrade.fy} / ${plateGrade.fu} ksi`} disabled className="form-input disabled" />
          </Field>
        </div>
        <div className="length-mode-description mt-3">
          <strong>Governing base metal:</strong> {baseLabel}, t = {toFraction(baseT)},
          Fy = {baseFy} ksi, Fu = {baseFu} ksi
        </div>
      </div>

      {/* Weld Details */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-section-label">Weld parameters</div>
        <div className="form-input-grid">
          <Field label="Weld leg size, w" id="weld-leg">
            <select
              id="weld-leg"
              value={legSize}
              onChange={(e) => setLegSize(parseFloat(e.target.value))}
              className="form-select"
            >
              {LEG_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>

          <Field label="Length per line, L (in)">
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={length}
              onChange={(e) => setLength(parseFloat(e.target.value) || 0)}
              className="form-input"
            />
          </Field>

          <Field label="Number of weld lines, n" id="weld-lines">
            <select
              id="weld-lines"
              value={nLines}
              onChange={(e) => setNLines(parseInt(e.target.value))}
              className="form-select"
            >
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>

          <Field label="Electrode FEXX (ksi)" id="electrode-fexx">
            <select
              id="electrode-fexx"
              value={fexx}
              onChange={(e) => setFexx(parseFloat(e.target.value))}
              className="form-select"
            >
              {FEXX_OPTIONS.map((f) => <option key={f} value={f}>E{f}</option>)}
            </select>
          </Field>

          <Field label="Design method" id="method-select">
            <select
              id="method-select"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="form-select"
            >
              <option value="lrfd">LRFD (φ = 0.75)</option>
              <option value="asd">ASD (Ω = 2.00)</option>
            </select>
          </Field>

          <Field label="Applied load, P (kips)">
            <input
              type="number"
              min="0"
              step="0.1"
              value={appliedLoad}
              onChange={(e) => setAppliedLoad(parseFloat(e.target.value) || 0)}
              className="form-input"
            />
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

      {calcError && (
        <div className="error-alert mb-4">
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
              codeRef: "AISC 360-16 §J4.2 base shear failure plane area", value: `${base.A.toFixed(3)} in²` },
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
        <div className={`governing-summary-card ${governing.status === "OK" ? "pass" : "fail"}`}>
          <div className="summary-title">Governing strength check: {governing.which}</div>
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
