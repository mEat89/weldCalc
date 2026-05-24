import React from "react";

// Centralized definition of every symbol used in the calculator, strictly LRFD aligned
const LEGEND_DATA = [
  {
    title: "Modes & Connection Types",
    rows: [
      ["HSS",       "—",   "Hollow Structural Section (rectangular or square profile)"],
      ["hss2hss",   "—",   "HSS branch member welded to an HSS chord member (truss connection)"],
      ["hss2plate", "—",   "HSS member welded to a plate (e.g., baseplate, cap plate)"],
      ["AISC mode", "—",   "Strict AISC 360 compliance — full nominal length for hss2plate, K5 Be on transverse hss2hss face"],
      ["K5 Be mode","—",   "Apply AISC §K5 Eq. K1-1 effective-width reduction to transverse face for BOTH connection types (extended engineering judgment for hss2plate)"],
    ],
  },
  {
    title: "Design Methodology (LRFD Only)",
    rows: [
      ["LRFD", "—",   "Load and Resistance Factor Design — required design strength Ru ≤ φRn"],
      ["DCR",  "—",   "Demand-to-Capacity Ratio — required strength / design strength (Ru / φRn); pass when ≤ 1.0"],
      ["LOA",  "—",   "Limits of Applicability — geometric/material bounds for §K5 Table K3.1A formulas to be valid"],
      ["φ (phi)", "—", "LRFD resistance factors: φ=0.75 weld shear rupture & base-metal rupture; φ=1.00 base-metal yielding; φ=0.90 plate bending"],
    ],
  },
  {
    title: "Geometry — Chord / HSS Main Member",
    rows: [
      ["B",       "in.",   "Chord (or HSS) dimension perpendicular to its longitudinal axis"],
      ["H",       "in.",   "Chord (or HSS) dimension parallel to its longitudinal axis"],
      ["t",       "in.",   "Chord wall design thickness (t_des) used in all capacity checks"],
      ["t_nom",   "in.",   "Nominal HSS wall thickness from AISC shape catalog"],
      ["t_des",   "in.",   "Design wall thickness = 0.93·t_nom for ERW HSS; = t_nom for SAW or ASTM A1085"],
      ["B/t",     "—",     "Chord wall slenderness ratio (governs localized chord face flexibility)"],
    ],
  },
  {
    title: "Geometry — Branch HSS",
    rows: [
      ["Bb",       "in.",   "Branch HSS dimension TRANSVERSE to chord axis (K5 reduction applies to this face)"],
      ["Hb",       "in.",   "Branch HSS dimension PARALLEL to chord axis (fully effective in K5 mode)"],
      ["tb",       "in.",   "Branch HSS design wall thickness"],
      ["β (beta)", "—",     "Width ratio = Bb / B (must satisfy 0.25 ≤ β ≤ 1.0 per Table K3.1A)"],
      ["Bb/tb",    "—",     "Branch wall slenderness (must satisfy ≤ 35 per Table K3.1A)"],
      ["Hb/Bb",    "—",     "Branch aspect ratio (must satisfy 0.5 ≤ Hb/Bb ≤ 2.0 per Table K3.1A)"],
    ],
  },
  {
    title: "Geometry — Plates & Anchor Rigidity",
    rows: [
      ["tp",         "in.",   "Plate thickness"],
      ["N",          "in.",   "Plate length dimension along the moment bending axis"],
      ["B",          "in.",   "Plate width dimension perpendicular to the moment axis (resists tension cantilever)"],
      ["anchor_y",   "in.",   "Distance from plate center to the tension-side anchor row"],
      ["x",          "in.",   "Cantilever distance from HSS column face to tension anchor row (auto-computed)"],
      ["b_eff",      "in.",   "Effective plate width resisting Tu cantilever bending (defaults to plate B)"],
    ],
  },
  {
    title: "Material Properties",
    rows: [
      ["Fy",     "ksi",   "Yield strength of HSS main member or chord element"],
      ["Fyb",    "ksi",   "Yield strength of branch HSS member"],
      ["Fyp",    "ksi",   "Yield strength of base plate (resisting cantilever bending)"],
      ["Fu",     "ksi",   "Tensile strength of HSS member material"],
      ["Fub",    "ksi",   "Tensile strength of branch HSS material"],
      ["Fup",    "ksi",   "Tensile strength of plate material"],
      ["FEXX",   "ksi",   "Electrode tensile strength classification — E70xx = 70 ksi (standard structural filler)"],
    ],
  },
  {
    title: "Weld Parameters (§J2.2, §J2.4)",
    rows: [
      ["w",        "in.",   "Fillet weld nominal leg size (equal-leg weld assumed)"],
      ["te",       "in.",   "Effective throat thickness = 0.707·w"],
      ["L",        "in.",   "Nominal geometric weld line length along the selected face"],
      ["L_eff",    "in.",   "Effective weld length used for strength — nominal length or reduced Be based on face flexibility"],
      ["Be (He)",  "in.",   "K5 reduced out-of-plane effective width of the branch face (AISC 360 Eq. K1-1)"],
      ["P_face",   "kip",   "Apportioned ultimate force demand on the checked face (either perimeter share or resolved moment share)"],
      ["SF",       "—",     "Moment Share Factor = Leff / (Leff + d_couple/3), elastically distributing flexural loads between flanges and webs"],
      ["d_couple", "in.",   "Bending moment couple force arm branch depth Hb or width Bb perpendicular to checked face"],
      ["Aw",       "in²",   "Effective weld shear area = te × L_eff"],
      ["Θ (theta)","°",     "Angle of loading measured from weld longitudinal axis (0° = parallel, 90° = perpendicular)"],
      ["kds",      "—",     "Directional factor = 1.0 + 0.5·sin¹.⁵(Θ); locked to 1.0 for HSS branch perimeter welds per §K5 commentary"],
      ["Fnw",      "ksi",   "Nominal weld shear stress = 0.60·FEXX·kds (AISC Eq. J2-5)"],
      ["w_min",    "in.",   "Minimum fillet weld size per Table J2.4 (prevents weld rapid cooling cracks)"],
      ["w_max",    "in.",   "Maximum fillet weld size along plate edge = t − 1/16 in. (for parts t ≥ 1/4 in.)"],
    ],
  },
  {
    title: "Strength Limit States — Weld & Base Metal",
    rows: [
      ["Rn",      "kip",   "Nominal shear strength of weld metal or base metal"],
      ["φRn",     "kip",   "LRFD design strength capacity (incorporates resistance factors)"],
      ["Eq. J2-5","—",    "Fnw = 0.60·FEXX·(1 + 0.5·sin¹·⁵Θ) — fillet weld with directional increase"],
      ["Eq. J4-3","—",    "Base metal shear yielding: Rn = 0.60·Fy·Agv; φ=1.00"],
      ["Eq. J4-4","—",    "Base metal shear rupture: Rn = 0.60·Fu·Anv; φ=0.75"],
    ],
  },
  {
    title: "Base Plate Rigidity Checks",
    rows: [
      ["Mu",             "ft·kip",  "Applied bending moment demand at column base (converted to kip·in internally)"],
      ["Pu",             "kip",     "Applied axial demand force; positive = compression demand, negative = net tension"],
      ["Tu",             "kip",     "Anchor tension row demand force. Auto-estimated via rigid-plate lever arm, or manually input"],
      ["d_lever",        "in.",     "Lever arm between concrete compression resultant and tension anchor row = anchor_y + (N/2 − 0.05N)"],
      ["e = M/P",        "in.",     "Load eccentricity; if e > N/6 (kern), anchors take tension"],
      ["σ_max",          "ksi",     "Peak elastic plate bending stress at column face boundary = 6·Tu·x/(b_eff·t²)"],
      ["Method B",       "—",       "Check 1 — Elastic plate bending limit: σ_max ≤ Fy. Benchmarks rigid-plate elastic assumption."],
      ["DG1 §3.4",       "—",       "Check 2 — Plastic cantilever bending check: t ≥ √(4·Tu·x/(φ·Fy·beff)) with φ=0.90."],
      ["Verdict: RIGID", "—",       "Both checks pass. Rigid-plate anchor analysis (DG1 / ACI 318) is fully valid."],
      ["Verdict: NOT RIGID","—",    "One or both checks fail. Rigid-plate assumption is invalid. Thicken plate or add stiffeners."],
    ],
  },
];

export default function LegendModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">📖 Symbol Legend &amp; Abbreviations</h2>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-description">
          Detailed catalog of every design symbol, variable, and capacity parameter utilized in calculations, organized by category.
          Click outside this panel or press the &times; button to return.
        </div>
        <div className="modal-scroll-area">
          {LEGEND_DATA.map((section) => (
            <div key={section.title} className="legend-section">
              <div className="legend-section-title">{section.title}</div>
              <table className="legend-table">
                <tbody>
                  {section.rows.map(([sym, unit, desc]) => (
                    <tr key={sym} className="legend-row">
                      <td className="legend-col-sym">{sym}</td>
                      <td className="legend-col-unit">{unit}</td>
                      <td className="legend-col-desc">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
