import React from "react";

export default function ReferencesModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "850px" }}>
        <div className="modal-header">
          <h2 className="modal-title">📖 Reference Codes, Standards &amp; Cursory Review</h2>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-description">
          This panel documents the primary governing specifications, design standards, and base metal calculations. It incorporates the comprehensive technical conclusions from our J and K Chapter compliance review.
          Click outside this panel or press the &times; button to return.
        </div>
        <div className="modal-scroll-area" style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: "8px" }}>
          
          {/* CURSORY REVIEW CONCLUSIONS */}
          <section className="card compact border-0" style={{ boxShadow: "none", padding: 0, marginBottom: "20px" }}>
            <div className="card-section-label" style={{ fontSize: "12px", borderLeftColor: "var(--danger)" }}>
              AISC 360-22 Chapters J &amp; K Compliance Audit Conclusions
            </div>
            <div style={{ backgroundColor: "var(--surface-subtle)", border: "1px dashed var(--border-color)", borderRadius: "var(--radius-md)", padding: "12px", fontSize: "12.5px", lineHeight: "1.5", display: "flex", flexDirection: "column", gap: "10px" }}>
              <p>
                A rigorous, cursor-level alignment audit was performed against the <strong>AISC 360-22 Specification for Structural Steel Buildings (Chapter J: Design of Connections, and Chapter K: Design of HSS and Box Member Connections)</strong>. The conclusions and implementation choices are outlined below:
              </p>
              
              <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <li>
                  <strong>Locking k_ds = 1.0 for HSS Branch Perimeter Welds:</strong> Under transverse loading, AISC 360-22 §J2.4 (Eq. J2-5) permits a 1.5× directional strength increase factor (k_ds = 1.0 + 0.5 · sin^1.5(θ)). However, the Chapter K Commentary and extensive experimental research (Tousignant &amp; Packer, 2015) confirm that out-of-plane load transfer in HSS truss or branch connections creates highly non-uniform stress distributions due to flexible chord wall bending. Stress concentrates at the rigid corners, violating the assumption of uniform deformation. Thus, <strong>k_ds is strictly locked to 1.0</strong> for all HSS branch welds to maintain a safe target reliability index.
                </li>
                <li>
                  <strong>Effective Weld Width B_e (Eq. K1-1 / Table K5.1):</strong> Under out-of-plane branch loads (tension or moment), the branch transverse faces cannot develop full yield strength due to localized bending/distortion of the chord face. AISC 360 §K1.2.2a (Eq. K1-1) limits the effective width to:
                  <div style={{ fontFamily: "monospace", margin: "4px 0", fontSize: "11.5px", textAlign: "center", padding: "6px", backgroundColor: "var(--surface-muted)", borderRadius: "4px" }}>
                    Be = (10 / (B/t)) · (Fy·t / (Fyb·tb)) · Bb &le; Bb
                  </div>
                  This effective width B_e is strictly enforced for transverse branch weld lines. Parallel welds remain fully effective.
                </li>
                <li>
                  <strong>Base Metal Shear Limitations (§J4.2):</strong> Base metal failure often governs over weld rupture when connecting elements are thin or yield strengths differ. The base metal is checked for:
                  <ul style={{ paddingLeft: "16px", marginTop: "4px", listStyleType: "circle" }}>
                    <li><strong>Shear Yielding:</strong> φRn = 1.00 · (0.60 · Fy · Agv) [AISC Eq. J4-3]</li>
                    <li><strong>Shear Rupture:</strong> φRn = 0.75 · (0.60 · Fu · Anv) [AISC Eq. J4-4]</li>
                  </ul>
                  The governing capacity is taken as the minimum of the weld metal rupture and the thinner base metal limit state, protecting against premature base metal tearing.
                </li>
                <li>
                  <strong>Weld Sizing Rules (§J2.2b):</strong> Deposits must satisfy minimum sizing (Table J2.4) to avoid rapid quenching, and maximum sizing (§J2.2b) to prevent burning away the edges of the thinner connected parts (t - 1/16" for parts &ge; 1/4").
                </li>
                <li>
                  <strong>Longitudinal Weld Length Reduction factor β (§J2.2b / Eq. J2-1):</strong> Under longitudinal shear, very long welds experience non-uniform stress (concentrated at loaded ends). For L/w &gt; 100, the nominal strength is multiplied by β = 1.2 - 0.002·(L/w) ≤ 1.0, and capped at a maximum reduction of 0.60 for L/w &gt; 300. Our calculator now strictly applies this reduction to both standard and HSS tabs to guarantee compliance.
                </li>
              </ul>
            </div>
          </section>

          {/* CODE SPECIFICATIONS */}
          <section className="card references-card border-0" style={{ boxShadow: "none", padding: 0 }}>
            <ul className="refs-list" style={{ display: "flex", flexDirection: "column", gap: "16px", paddingLeft: "0", listStyle: "none" }}>
              <li style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
                <strong style={{ fontSize: "14px", color: "var(--primary-dark)", display: "block", marginBottom: "4px" }}>
                  AISC 360-22 / AISC 360-16 Specification
                </strong>
                <em style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Specification for Structural Steel Buildings (LRFD Only)
                </em>
                <ul className="refs-list mt-1" style={{ paddingLeft: "16px", fontSize: "13px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <li>§J2.2a — Fillet weld effective throat (te = 0.707 · w).</li>
                  <li>§J2.2b &amp; Table J2.4 — Minimum and maximum fillet weld leg sizes based on thinner joined part thickness.</li>
                  <li>§J2.2b &amp; Eq. J2-1 — Longitudinal fillet weld length reduction factor β = 1.2 - 0.002·(L/w) &le; 1.0 (when ratio exceeds 100). Capped at 0.60 for ratio &gt; 300.</li>
                  <li>§J2.4 &amp; Eq. J2-5 — Fillet weld metal shear strength; LRFD φ = 0.75. Directional factor k_ds locked to 1.0 for HSS connections per commentary.</li>
                  <li>§J4.2 &amp; Eqs. J4-3 / J4-4 — Base metal shear yielding (φ = 1.00) and base metal shear rupture (φ = 0.75) limits.</li>
                  <li>§K1.2.2a &amp; Eq. K1-1 — Hollow Structural Section connection uneven stress effective width B_e calculation for transverse walls.</li>
                  <li>§K5 Table K5.1 — Standardized effective weld lengths; parallel welds fully effective, transverse welds reduced to B_e.</li>
                </ul>
              </li>

              <li style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
                <strong style={{ fontSize: "14px", color: "var(--primary-dark)", display: "block", marginBottom: "4px" }}>
                  AISC Design Guide 24, 2nd Edition (2010)
                </strong>
                <em style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Hollow Structural Section Connections (Packer, Sherman, Lecce)
                </em>
                <span style={{ fontSize: "13px", display: "block", lineHeight: "1.4" }}>
                  Detailed structural examples of Chapter K effective weld lengths and face flexibility checks, validating the exclusion of k_ds directional factors in branch connections.
                </span>
              </li>

              <li style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
                <strong style={{ fontSize: "14px", color: "var(--primary-dark)", display: "block", marginBottom: "4px" }}>
                  AISC Design Guide 1, 2nd Edition (2006)
                </strong>
                <em style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Base Plate and Anchor Rod Design (Fisher &amp; Kloiber)
                </em>
                <span style={{ fontSize: "13px", display: "block", lineHeight: "1.4" }}>
                  Section 3.4 outlines base plate thickness design checks under moment + axial loads, specifying plastic section bending capacity checks with LRFD φ = 0.90 strength reduction.
                </span>
              </li>

              <li>
                <strong style={{ fontSize: "14px", color: "var(--primary-dark)", display: "block", marginBottom: "4px" }}>
                  Tousignant, K., and Packer, J.A. (2015)
                </strong>
                <em style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  "Numerical Investigation of Fillet Welds to Rectangular HSS Branch Members under Tension", Journal of Structural Engineering
                </em>
                <span style={{ fontSize: "13px", display: "block", lineHeight: "1.4" }}>
                  Provides the physical research backing the lock of k_ds = 1.0 for fillet welds of rectangular HSS branch members to guarantee necessary structural target safety indexes.
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
