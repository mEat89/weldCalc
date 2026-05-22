import React, { useState } from "react";
import { HSS_SHAPES, STEEL_GRADES } from "../../constants/steelData";
import { toFraction } from "../../math/weldMath";
import { calcAnchorTensionAuto, calcMethodB, calcDG1, calcRigidityVerdict } from "../../math/plateMath";
import { Field, InchInput, PlateQuickPick } from "../shared/FormElements";
import { CheckBlock } from "../shared/CheckResults";

export default function PlateRigidityTab() {
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

  // Method
  const [method, setMethod] = useState("lrfd");

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
  } catch (e) { tAutoError = e.message; }

  const Tu = tuMode === "manual" ? tuManual : (tAuto ? tAuto.Tu : 0);
  const beffUsed = beffAuto ? Bplate : beff;

  // Run checks
  let mB = null, dg1 = null, errors = [];
  try {
    mB = calcMethodB({ Tu, x, beff: beffUsed, Fyp: plateGrade.fy, tp });
  } catch (e) { errors.push("Method B: " + e.message); }

  try {
    dg1 = calcDG1({ Tu, x, beff: beffUsed, Fyp: plateGrade.fy, tp, phi: 0.9 });
  } catch (e) { errors.push("DG1: " + e.message); }

  const verdict = (mB && dg1) ? calcRigidityVerdict(mB, dg1) : null;

  return (
    <div className="tab-pane">
      {/* Column selector card */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-section-label">Column (HSS)</div>
        <div className="form-input-grid">
          <Field label="Shape" id="column-shape">
            <select
              id="column-shape"
              value={columnIdx}
              onChange={(e) => setColumnIdx(+e.target.value)}
              className="form-select"
            >
              {HSS_SHAPES.map((s, i) => (
                <option key={i} value={i}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Column dim ALONG moment axis" helper="Structural orientation layout" id="column-orientation">
            <select
              id="column-orientation"
              value={columnOrientation}
              onChange={(e) => setColumnOrientation(e.target.value)}
              className="form-select"
            >
              <option value="H_along_M">H = {column.H}" along M-axis</option>
              <option value="B_along_M">B = {column.B}" along M-axis</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Plate geometry card */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-section-label">Plate geometry &amp; material</div>
        <div className="form-input-grid">
          <InchInput label="N (plate dim along M-axis)" value={Nplate} onChange={setNplate} min={1} step={0.5} id="plate-n" />
          <InchInput
            label="B (plate dim perpendicular = beam width)"
            value={Bplate}
            onChange={(v) => { setBplate(v); if (beffAuto) setBeff(v); }}
            min={1}
            step={0.5}
            id="plate-b"
          />
          <InchInput label="t_p (plate thickness)" value={tp} onChange={setTp} min={0.25} step={0.0625} id="plate-tp" />
        </div>
        <div className="form-input-grid mt-3">
          <Field label="Plate material" id="plate-material">
            <select
              id="plate-material"
              value={plateGradeIdx}
              onChange={(e) => setPlateGradeIdx(+e.target.value)}
              className="form-select"
            >
              {STEEL_GRADES.filter((g) => g.category === "plate").map((g) => {
                const idx = STEEL_GRADES.indexOf(g);
                return <option key={idx} value={idx}>{g.label}</option>;
              })}
            </select>
          </Field>
          <Field label="Fy / Fu">
            <input value={`${plateGrade.fy} / ${plateGrade.fu} ksi`} disabled className="form-input disabled" />
          </Field>
        </div>
      </div>

      {/* Applied loads card */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-section-label">Applied loads on column at plate level</div>
        <div className="form-input-grid">
          <Field label="M_u (moment about chosen axis)" helper="ft·kip — auto-converted to kip·in">
            <input
              type="number"
              value={Mu_ftkip}
              onChange={(e) => setMu_ftkip(+e.target.value)}
              className="form-input"
              step="0.1"
            />
          </Field>
          <Field label="P_u (axial)" helper="kip; positive = compression">
            <input
              type="number"
              value={Pu}
              onChange={(e) => setPu(+e.target.value)}
              className="form-input"
              step="0.1"
            />
          </Field>
          <Field label="V_u (shear, informational)" helper="kip; not used in plate rigidity check">
            <input
              type="number"
              value={Vu}
              onChange={(e) => setVu(+e.target.value)}
              className="form-input"
              step="0.1"
            />
          </Field>
        </div>
        <div className="length-mode-description">
          M_u = {Mu_ftkip} ft·kip = <strong>{Mu.toFixed(0)} kip·in</strong>. Eccentricity e = M/P ={" "}
          {Pu > 0.001 ? (Mu / Pu).toFixed(1) : "→ ∞"} in. Kern boundary limit N/6 = {(Nplate / 6).toFixed(2)} in.
        </div>
      </div>

      {/* Anchor row geometry card */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-section-label">Anchor row geometry (tension side)</div>
        <div className="form-input-grid">
          <InchInput
            label="Anchor row offset y (from plate center along N)"
            value={anchorOffsetY}
            onChange={setAnchorOffsetY}
            min={0.25}
            step={0.25}
            id="anchor-y"
          />
          <Field label="Cantilever x (HSS face → anchor)">
            <input value={`${x.toFixed(2)} in`} disabled className="form-input disabled" />
          </Field>
          <Field label="b_eff (effective plate width)">
            <div className="beff-input-row">
              <input
                type="number"
                value={beffAuto ? Bplate : beff}
                disabled={beffAuto}
                onChange={(e) => setBeff(+e.target.value)}
                className={`form-input ${beffAuto ? "disabled" : ""}`}
                step="0.25"
              />
              <button onClick={() => setBeffAuto(!beffAuto)} className="btn-auto-manual" type="button">
                {beffAuto ? "Auto" : "Manual"}
              </button>
            </div>
          </Field>
        </div>
      </div>

      {/* Anchor row tension demand */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-section-label">Anchor row tension demand T_u</div>
        <div className="toggle-btn-grid">
          <button
            onClick={() => setTuMode("auto")}
            className={`toggle-option-btn ${tuMode === "auto" ? "active" : ""}`}
            type="button"
          >
            <div className="btn-main-label">Auto-estimate from M, P</div>
            <div className="btn-sub-label">Rigid-plate equilibrium (simplified)</div>
          </button>
          <button
            onClick={() => setTuMode("manual")}
            className={`toggle-option-btn ${tuMode === "manual" ? "active" : ""}`}
            type="button"
          >
            <div className="btn-main-label">Manual override</div>
            <div className="btn-sub-label">Enter T_u from Hilti Profis report or other solvers</div>
          </button>
        </div>

        {tuMode === "manual" && (
          <div className="form-input-grid mt-3">
            <Field label="T_u (anchor row tension)" helper="kip — sum on the tension-side anchor row">
              <input
                type="number"
                value={tuManual}
                onChange={(e) => setTuManual(+e.target.value)}
                className="form-input"
                step="0.1"
              />
            </Field>
          </div>
        )}

        {tuMode === "auto" && tAuto && (
          <div className="length-mode-description mt-3">
            d_lever = anchor_y + (N/2 − N·5%) = {anchorOffsetY} + ({Nplate/2} − {tAuto.bearingInset.toFixed(2)}) = <strong>{tAuto.dLever.toFixed(2)} in</strong><br />
            T_u_raw = M/d − P = {Mu.toFixed(0)}/{tAuto.dLever.toFixed(2)} − {Pu} = <strong>{tAuto.TuRaw.toFixed(2)} kip</strong>
            {tAuto.noTension && <span className="no-tension-indicator">  → no tension on anchors</span>}
            <br />
            <span className="tu-val-used">T_u used in checks = {tAuto.Tu.toFixed(2)} kip</span>
            <div className="estimate-note mt-1">
              Note: For higher-precision comparison, run a Profis rigid-plate analysis and input the actual anchor row tension sum via Manual override.
            </div>
          </div>
        )}
        {tAutoError && <div className="error-alert mt-2"><strong>Tension error:</strong> {tAutoError}</div>}
      </div>

      {/* Design method */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-section-label">Design method</div>
        <div className="toggle-btn-grid">
          <button
            onClick={() => setMethod("lrfd")}
            className={`toggle-option-btn ${method === "lrfd" ? "active" : ""}`}
            type="button"
          >
            <div className="btn-main-label">LRFD</div>
            <div className="btn-sub-label">DG1 uses φ = 0.90</div>
          </button>
          <button
            onClick={() => setMethod("asd")}
            className={`toggle-option-btn ${method === "asd" ? "active" : ""}`}
            type="button"
          >
            <div className="btn-main-label">ASD</div>
            <div className="btn-sub-label">(informational; DG1 typically LRFD)</div>
          </button>
        </div>
      </div>

      {errors.length > 0 && errors.map((e, i) => <div key={i} className="error-alert mb-3">{e}</div>)}

      {/* Check 1: Method B (elastic plate bending) */}
      {mB && (
        <CheckBlock
          title="Check 1 — Method B: Elastic Plate Bending"
          codeRef="σmax = 6·Tu·x / (beff·t²) ≤ Fy  (elastic stress limits)"
          traceSteps={mB.trivial ? [
            { eq: "T_u = 0 → no tension demand",
              codeRef: "Skipped — no anchor tension",
              value: "trivially OK" },
          ] : [
            { eq: `σ_max = 6 · T_u · x / (b_eff · t_p²)`,
              codeRef: "Elastic bending stress at column face boundary",
              value: `${mB.sigmaMax.toFixed(2)} ksi` },
            { eq: `     = 6 · ${Tu.toFixed(2)} · ${x.toFixed(2)} / (${beffUsed} · ${tp}²)`,
              codeRef: "Substituted engineering metrics",
              value: `${mB.sigmaMax.toFixed(2)} ksi` },
            { eq: `vs F_yp = ${plateGrade.fy} ksi`,
              codeRef: "Plate material yield strength",
              value: `DCR = ${mB.DCR.toFixed(3)}` },
            { eq: `t_req (elastic) = √(6·Tu·x / (beff·Fy))`,
              codeRef: "Solving stress equation for thickness",
              value: `${mB.tReq.toFixed(3)} in` },
          ]}
          statCards={[
            { label: "σ_max", value: mB.trivial ? "—" : `${mB.sigmaMax.toFixed(2)} ksi` },
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

      {/* Check 2: DG1 §3.4 */}
      {dg1 && (
        <CheckBlock
          title="Check 2 — AISC DG1 §3.4 Plastic Cantilever (with φ)"
          codeRef="AISC Design Guide 1, Eq. 3.4.7 form: t ≥ √(4·Tu·x / (φ·Fy·beff))"
          traceSteps={dg1.trivial ? [
            { eq: "T_u = 0 → no tension demand",
              codeRef: "Skipped — no anchor tension",
              value: "trivially OK" },
          ] : [
            { eq: `t_req = √(4 · T_u · x / (φ · F_yp · b_eff))`,
              codeRef: "DG1 §3.4 plastic moment per unit width with φ=0.9",
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
            { label: "DCR (req/prov)", value: dg1.trivial ? "—" : dg1.DCR.toFixed(3) },
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

      {/* Rigidity Verdict Panel */}
      {verdict && (
        <div className={`verdict-summary-card ${verdict.color === "ok" ? "pass" : "fail"}`}>
          <div className="verdict-title">
            Rigidity verdict: {verdict.verdict}
            <span className="verdict-details">
              Method B {mB.pass ? "✓" : "✗"}  ·  DG1 {dg1.pass ? "✓" : "✗"}
            </span>
          </div>
          <div className="verdict-note">{verdict.note}</div>
        </div>
      )}

      {/* Engineering Footnote Card */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-section-label">Notes on base plate rigidity analysis</div>
        <ul className="notes-list">
          <li><strong>Method B (elastic) is more stringent than DG1 (plastic with φ).</strong> Method B requires the plate to stay elastic under T_u (σ ≤ F_y). DG1 accepts plastic section modulus (Z = b·t²/4) and applies φ = 0.9, allowing some controlled yielding. The ratio between the two t_req values is √(6/(4/0.9)) ≈ 1.16 — Method B asks for ~16% more thickness.</li>
          <li><strong>Method B is the elastic-behavior test.</strong> If the plate yields locally under T_u, the rigid-plate kinematic assumption (planar plate motion) breaks down. CBFEM will then show anchor reactions different from the rigid-plate hand calc — sometimes by factors of 2–3x on the critical anchors.</li>
          <li><strong>DG1 alone passing is not sufficient evidence of rigidity.</strong> DG1 uses the rigid-plate-derived T_u as input to its own check — self-referential. It confirms the plate can carry the loads ASSUMED to be on it; it cannot confirm those loads are realistic. Method B (elastic) is the truer indicator of whether the rigid assumption holds.</li>
          <li><strong>T_u quality matters more than method choice.</strong> If your T_u is from a rigid-plate analysis but the plate isn't rigid, both checks may pass when the actual demand is much higher. For confirmation, run Profis CBFEM ("Anchor plate design" mode) and compare CBFEM T_u against the rigid-plate T_u — if they differ by more than ~10–15%, the rigid assumption is suspect.</li>
          <li><strong>If the verdict is NOT RIGID,</strong> the anchor reactions from a rigid-plate ACI 318 hand calc (or Profis "Anchor Design") will UNDERPREDICT the actual demand. Use CBFEM, thicken the plate, or add stiffeners until the verdict becomes RIGID.</li>
        </ul>
      </div>
    </div>
  );
}
