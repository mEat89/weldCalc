import React from "react";

export default function ReferencesModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "800px" }}>
        <div className="modal-header">
          <h2 className="modal-title">📖 Reference Codes &amp; Engineering Standards</h2>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-description">
          A list of the primary governing building codes, design standards, and research publications used throughout the calculator.
          Click outside this panel or press the &times; button to return.
        </div>
        <div className="modal-scroll-area" style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: "8px" }}>
          <section className="card references-card border-0" style={{ boxShadow: "none", padding: 0 }}>
            <ul className="refs-list" style={{ display: "flex", flexDirection: "column", gap: "16px", paddingLeft: "0", listStyle: "none" }}>
              <li style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
                <strong style={{ fontSize: "14px", color: "var(--primary-dark)", display: "block", marginBottom: "4px" }}>
                  AISC 360-22 / AISC 360-16
                </strong>
                <em style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Specification for Structural Steel Buildings
                </em>
                <ul className="refs-list mt-1" style={{ paddingLeft: "16px", fontSize: "13px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <li>§J2.2a — Effective throat of fillet welds (te = 0.707 * w).</li>
                  <li>§J2.2b &amp; Table J2.4 — Minimum and maximum fillet weld sizes based on thickness of the thinner part joined.</li>
                  <li>§J2.4 &amp; Eq. J2-5 — Fillet weld metal shear strength; 1.5× directional strength increase factor kds = 1 + 0.5 * sin^1.5(θ) LRFD φ = 0.75, ASD Ω = 2.00.</li>
                  <li>§J2.4 Commentary (360-22) — kds = 1.0 limit lock for rectangular HSS branch member welds (non-uniform stiffness).</li>
                  <li>§J4.2 &amp; Eqs. J4-3 / J4-4 — Base metal shear yielding (φ = 1.00) and base metal shear rupture (φ = 0.75) limits.</li>
                  <li>§K1.2.2a (360-22) / §K5 (360-16) &amp; Eq. K1-1 — Chord face local yielding uneven stress distribution effective width Be = (10 / (B/t)) * (Fy * t / (Fyb * tb)) * Bb &le; Bb.</li>
                  <li>§K5 Table K5.1 — Effective weld properties; parallel welds fully effective, transverse welds reduced to Be per face.</li>
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
                  Provides comprehensive worked design examples of §K5 effective width calculations, and confirms the requirement to use kds = 1.0 for HSS branch perimeter welds due to chord wall stiffness variations.
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

              <li style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
                <strong style={{ fontSize: "14px", color: "var(--primary-dark)", display: "block", marginBottom: "4px" }}>
                  Tousignant, K., and Packer, J.A. (2015)
                </strong>
                <em style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  "Numerical Investigation of Fillet Welds to Rectangular HSS Branch Members under Tension", Journal of Structural Engineering
                </em>
                <span style={{ fontSize: "13px", display: "block", lineHeight: "1.4" }}>
                  Provides the physical research backing the lock of kds = 1.0 for fillet welds of rectangular HSS branch members welded to thick rigid plates to guarantee necessary structural target safety indexes.
                </span>
              </li>

              <li>
                <strong style={{ fontSize: "14px", color: "var(--primary-dark)", display: "block", marginBottom: "4px" }}>
                  Olson, K. (2020)
                </strong>
                <em style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  "Know Your HSS Welds", STRUCTURE Magazine
                </em>
                <span style={{ fontSize: "13px", display: "block", lineHeight: "1.4" }}>
                  A practitioner-focused technical guide summarizing standard code limitations, load path variations, and base metal shear design checks.
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
