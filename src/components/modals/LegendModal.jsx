import React from "react";

// Centralized definition of every symbol used in the calculator
const LEGEND_DATA = [
  {
    title: "Modes & Connection Types",
    rows: [
      ["HSS",       "—",   "Hollow Structural Section (rectangular or square in v2.x)"],
      ["hss2hss",   "—",   "HSS branch member welded to an HSS chord member (truss/branch connection)"],
      ["hss2plate", "_",   "HSS member welded to a plate (e.g., baseplate, cap plate)"],
      ["AISC mode", "—",   "Strict AISC 360 code compliance — full nominal L for hss2plate, K5 Be on transverse hss2hss face"],
      ["K5 Be mode","—",   "K5 Eq. K1-1 effective-width reduction applied to transverse face for BOTH connection types (engineering judgment for hss2plate)"],
      ["CBFEM mode","—",   "Component-Based FEM peak-element check; engineer enters Lc and Θ from Profis / IDEA StatiCa output"],
    ],
  },
  {
    title: "Design Methodology",
    rows: [
      ["LRFD", "—",   "Load and Resistance Factor Design — required Ru ≤ φRn"],
      ["ASD",  "—",   "Allowable Strength Design — required Ra ≤ Rn/Ω"],
      ["DCR",  "—",   "Demand-to-Capacity Ratio — Ru/φRn (LRFD) or Ra/(Rn/Ω) (ASD); pass when ≤ 1.0"],
      ["LOA",  "—",   "Limits of Applicability — geometric/material bounds for §K5 / Table K3.1A equations to be valid"],
      ["φ",    "—",   "Resistance factor (LRFD): φ=0.75 weld shear rupture & base-metal rupture; φ=1.00 base-metal yielding"],
      ["Ω",    "—",   "Safety factor (ASD): Ω=2.00 weld & base-metal rupture; Ω=1.50 base-metal yielding"],
    ],
  },
  {
    title: "Geometry — Chord / HSS Main Member",
    rows: [
      ["B",       "in.",   "Chord (or HSS) dimension perpendicular to its longitudinal axis"],
      ["H",       "in.",   "Chord (or HSS) dimension parallel to its longitudinal axis"],
      ["t",       "in.",   "Chord wall thickness; v2.x uses t_des in all checks"],
      ["t_nom",   "in.",   "Nominal HSS wall thickness from catalog"],
      ["t_des",   "in.",   "Design wall thickness = 0.93·t_nom for ERW HSS; = t_nom for SAW or A1085"],
      ["B/t",     "—",     "Chord wall slenderness ratio (governs flexibility, appears in K5 formula)"],
    ],
  },
  {
    title: "Geometry — Branch HSS",
    rows: [
      ["Bb",       "in.",   "Branch HSS dimension TRANSVERSE to chord axis (K5 applies to this face)"],
      ["Hb",       "in.",   "Branch HSS dimension PARALLEL to chord axis (fully effective in K5)"],
      ["tb",       "in.",   "Branch HSS wall thickness (design)"],
      ["β (beta)", "_",     "Width ratio = Bb / B (must be 0.25 ≤ β ≤ 1.0 per Table K3.1A)"],
      ["Bb/tb",    "—",     "Branch wall slenderness (must be ≤ 35 per Table K3.1A)"],
      ["Hb/Bb",    "—",     "Branch aspect ratio (must be 0.5 ≤ Hb/Bb ≤ 2.0 per Table K3.1A)"],
    ],
  },
  {
    title: "Geometry — Plate (hss2plate connections)",
    rows: [
      ["tp",         "in.",   "Plate thickness"],
      ["plate B",    "in.",   "Plate dimension parallel to the weld face being analyzed (used in K5 mode only)"],
      ["effectivePlateB", "in.", "K5 mode auto-default = 2 × selected face dim (typical baseplate cantilever) OR engineer-input value"],
    ],
  },
  {
    title: "Material Properties",
    rows: [
      ["Fy",     "ksi",   "Yield strength of chord HSS or chord plate"],
      ["Fyb",    "ksi",   "Yield strength of branch HSS"],
      ["Fyp",    "ksi",   "Yield strength of plate (when plate is the chord in K5 hss2plate mode)"],
      ["Fu",     "ksi",   "Tensile strength of chord material"],
      ["Fub",    "ksi",   "Tensile strength of branch material"],
      ["Fup",    "ksi",   "Tensile strength of plate material"],
      ["FEXX",   "ksi",   "Electrode classification (filler metal) tensile strength — E70xx = 70 ksi (most common)"],
    ],
  },
  {
    title: "Weld Parameters (§J2.2, §J2.4)",
    rows: [
      ["w",        "in.",   "Fillet weld leg size (equal-leg assumed). Profis label: Ls"],
      ["te",       "in.",   "Effective throat thickness = 0.707·w. Profis label: Th"],
      ["L",        "in.",   "Geometric (nominal) weld length along selected face"],
      ["Lc",       "in.",   "Critical-element length from CBFEM solver (engineer-input in CBFEM mode); typical Profis ≈ 1–2 in. at HSS corner"],
      ["L_eff",    "in.",   "Effective weld length used for capacity — depends on active mode (AISC nominal / K5 Be / CBFEM Lc)"],
      ["Aw",       "in²",   "Effective weld area = te × L_eff. Profis: Aw = Th × Lc"],
      ["Θ (theta)","°",     "Angle of loading measured from weld longitudinal axis (0° = parallel, 90° = perpendicular)"],
      ["kds",      "—",     "Directional strength increase = 1 + 0.5·sin¹·⁵(Θ); = 1.0 when locked (hss2hss per §K5 commentary; K5 mode hss2plate per engineering judgment)"],
      ["Fnw",      "ksi",   "Nominal weld metal shear stress = 0.60·FEXX·kds (AISC Eq. J2-5)"],
      ["w_min",    "in.",   "Minimum fillet weld size per Table J2.4 (function of thinner part joined)"],
      ["w_max",    "in.",   "Maximum fillet weld size along an HSS edge = t − 1/16 in. (when t ≥ 1/4 in.)"],
    ],
  },
  {
    title: "Strength Equations — Weld Metal (§J2.4)",
    rows: [
      ["Rn",     "kip",   "Nominal weld shear strength = Fnw × Aw"],
      ["φRn",    "kip",   "LRFD design strength = 0.75 × Rn"],
      ["Rn/Ω",   "kip",   "ASD allowable strength = Rn / 2.00"],
      ["Eq. J2-5","—",    "Fnw = 0.60·FEXX·(1 + 0.5·sin¹·⁵Θ) — fillet weld with directional increase"],
    ],
  },
  {
    title: "Strength Equations — Base Metal (§J4.2)",
    rows: [
      ["Eq. J4-3", "—",   "Shear yielding: Rn = 0.60·Fy·Agv;  φ=1.00 (LRFD), Ω=1.50 (ASD)"],
      ["Eq. J4-4", "—",   "Shear rupture: Rn = 0.60·Fu·Anv;   φ=0.75 (LRFD), Ω=2.00 (ASD)"],
      ["FBM",      "ksi", "Base metal nominal shear stress (= 0.60·Fy yield, or 0.60·Fu rupture)"],
    ],
  },
  {
    title: "K5 Effective Width (AISC 360-22 §K1.2.2a / §K5 Eq. K1-1)",
    rows: [
      ["Be (beoi)", "in.",   "Effective width of transverse branch face = (10/(B/t))·(Fy·t / (Fyb·tb))·Bb ≤ Bb"],
      ["Be_raw",    "in.",   "Be before applying the cap at Bb (informational — used to detect when chord governs)"],
      ["capped",    "—",     "True when Be_raw > Bb (chord is rigid relative to branch); Be is taken as Bb (no reduction)"],
      ["Eq. K1-1",  "—",     "Local yielding (uneven load distribution) effective width formula — same form across AISC 360-05/16/22"],
      ["Eq. K1-2",  "—",     "Punching-shear effective width Bep (not currently shown in v2.x display, but underlying logic same)"],
      ["Table K3.1A","—",    "LOA for HSS-to-HSS connections: β ≥ 0.25, B/t ≤ 35, Bb/tb ≤ 35, 0.5 ≤ Hb/Bb ≤ 2.0, Fy ≤ 52 ksi"],
    ],
  },
  {
    title: "Loads & Force Symbols",
    rows: [
      ["P_face",   "kip",   "Branch axial force ON the analyzed face (engineer-input; for CBFEM matching this = Fn from Profis)"],
      ["P_total",  "kip",   "Total branch axial force (used in Load Distribution Helper to split across faces)"],
      ["Pu",       "kip",   "Required strength, LRFD"],
      ["Pa",       "kip",   "Required strength, ASD"],
      ["Fn",       "kip",   "Force at weld critical element (Profis-reported value); equals P_face in CBFEM mode"],
      ["Fc",       "kip/in.", "Per-inch force at critical element = P_face / Lc (peak demand in CBFEM mode)"],
    ],
  },
  {
    title: "Base Plate Rigidity (v2.5 tab — two code-grounded checks)",
    rows: [
      ["M_u",            "kip·in",  "Applied moment at column base (LRFD). UI accepts ft·kip and converts."],
      ["P_u",            "kip",     "Applied axial force at column base; positive = compression"],
      ["V_u",            "kip",     "Applied shear at column base (informational only; not used in rigidity calc)"],
      ["N",              "in.",     "Plate dimension ALONG moment axis (the bending direction)"],
      ["B",              "in.",     "Plate dimension PERPENDICULAR to moment axis (acts as 'beam width' in plate bending)"],
      ["t_p",            "in.",     "Plate thickness"],
      ["F_yp",           "ksi",     "Plate yield strength (A36 = 36 ksi, A572 Gr 50 = 50 ksi)"],
      ["anchor_y",       "in.",     "Distance from plate center to tension-side anchor row, along N direction"],
      ["x",              "in.",     "Cantilever distance from HSS column face to tension anchor row (auto-computed)"],
      ["b_eff",          "in.",     "Effective plate width resisting Tu cantilever (default = B; user override allowed)"],
      ["T_u",            "kip",     "Anchor row tension demand. Auto-estimated from M, P, lever arm — or manual override from Profis"],
      ["d_lever",        "in.",     "Lever arm between compression resultant and tension anchor row = anchor_y + (N/2 − 0.05N)"],
      ["e = M/P",        "in.",     "Load eccentricity; if e > N/6 (kern), anchors take tension"],
      ["σ_max",          "ksi",     "Peak elastic bending stress in plate at column face = 6·Tu·x/(b_eff·t²)"],
      ["Method B",       "—",       "Check 1 — Elastic plate bending: σ_max ≤ Fy. No φ; pure stress check. Direct test of rigid-plate kinematic assumption."],
      ["DG1 §3.4",       "—",       "Check 2 — Plastic cantilever with φ=0.9: t ≥ √(4·Tu·x/(φ·Fy·beff)). AISC-blessed but self-referential (uses rigid-plate-derived Tu as input)."],
      ["Verdict: RIGID", "—",       "Both checks pass → rigid-plate DG1/ACI 318 hand-calc anchor analysis is valid"],
      ["Verdict: NOT RIGID","—",    "Method B and/or DG1 fail — rigid-plate assumption invalid; use CBFEM or thicken plate"],
    ],
  },
  {
    title: "Code References — Most-Used in v2.x",
    rows: [
      ["AISC 360-22 §J2.2a","—",   "Effective area of fillet welds (te = 0.707·w)"],
      ["AISC 360-22 §J2.2b","—",   "Min/max fillet weld size (Table J2.4)"],
      ["AISC 360-22 §J2.4", "—",   "Strength of fillet welds (Eq. J2-5)"],
      ["AISC 360-22 §J4.2", "—",   "Shear of connecting elements (yield Eq. J4-3, rupture Eq. J4-4)"],
      ["AISC 360-22 §K1.2", "—",   "Local yielding due to uneven load distribution (Be effective width); §K5 in AISC 360-16"],
      ["AISC 360-22 §K3",   "—",   "HSS-to-HSS truss connections (LOA Table K3.1A)"],
      ["AISC DG 1",         "—",   "Base Plate and Anchor Rod Design (Fisher & Kloiber, 2nd Ed. 2006), §3.4 for moment + axial"],
      ["AISC DG 24",        "—",   "Hollow Structural Section Connections (Packer, Sherman, Lecce, 1st Ed. 2010)"],
      ["ACI 318-19 Ch. 17", "—",   "Anchor design (Commentary R17.2 assumes rigid base plate behavior)"],
      ["FBC 2023 path",     "—",   "FBC 2023 → IBC 2021 §2205.1 → AISC 360 (Florida-applicable governing standard)"],
    ],
  },
];

export default function LegendModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">📖 Symbol Legend & Abbreviations</h2>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-description">
          Every symbol used anywhere in the calculator, organized by category.
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
