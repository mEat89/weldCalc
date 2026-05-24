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
          This panel documents the primary governing specifications, design standards, and base metal calculations. It incorporates the comprehensive technical conclusions from our J, K, and F Chapters compliance review.
          Click outside this panel or press the &times; button to return.
        </div>
        <div className="modal-scroll-area" style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: "8px" }}>
          
          {/* CURSORY REVIEW CONCLUSIONS */}
          <section className="card compact border-0" style={{ boxShadow: "none", padding: 0, marginBottom: "20px" }}>
            <div className="card-section-label" style={{ fontSize: "12px", borderLeftColor: "var(--danger)" }}>
              AISC 360-22 Chapters J, K, &amp; F Compliance Audit Conclusions
            </div>
            <div style={{ backgroundColor: "var(--surface-subtle)", border: "1px dashed var(--border-color)", borderRadius: "var(--radius-md)", padding: "14px", fontSize: "12.5px", lineHeight: "1.5", display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ margin: 0 }}>
                A rigorous engineering alignment audit was performed against the <strong>AISC 360-22 Specification for Structural Steel Buildings (Chapter J: Design of Connections, Chapter K: Design of HSS and Box Member Connections, and Chapter F: Design of Members for Flexure)</strong> and <strong>AISC Design Guide 1 (Base Plate and Anchor Rod Design)</strong>. The governing code provisions and mathematical behaviors for all three app modules are documented below:
              </p>
              
              {/* SECTION A: HSS WELD MODULE */}
              <div>
                <h4 style={{ margin: "0 0 6px 0", color: "var(--primary-dark)", fontSize: "13px", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "3px" }}>
                  1. HSS Branch Welds Module (AISC Chapter K &amp; §J2.4)
                </h4>
                <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px", margin: 0 }}>
                  <li>
                    <strong>Weld Force Perimeter Distribution (Tension &amp; Shear):</strong> Under global branch axial tension or shear (Pu), the load is elastically distributed over the entire branch weld perimeter (L_total = 2·B_b + 2·(H_b - 2·t_des)) using a sharp-cornered box model (no corner radius setbacks), matching Hilti PROFIS CBFEM. The demand force allocated to the checked face is:
                    <div style={{ fontFamily: "monospace", margin: "4px auto", fontSize: "11.5px", maxWidth: "450px", padding: "6px", backgroundColor: "var(--surface-muted)", borderRadius: "4px", border: "1px solid var(--border-color)", textAlign: "left" }}>
                      P_face = P_total · [Face_weld / L_total]
                    </div>
                    where Face_weld is B_b for Face B (flanges) and H_b - 2·t_des for Face H (webs). This provides a mathematically safe, conservative lower-bound check of each individual weld line against its respective tributary load share, rather than checking a single weld against the entire global branch load.
                  </li>
                  <li>
                    <strong>K5 Elastic Moment Share Method (Bending Moment):</strong> Bending moment (Mu, in-plane or out-of-plane) is resolved into a tension-compression flange force couple (F = Mu / d_couple). This force is elastically distributed between the flanges (Face B) and webs (Face H) using the AISC Table K5.1 Eq. K5-6 elastic contribution (section modulus share factor, SF):
                    <div style={{ fontFamily: "monospace", margin: "4px auto", fontSize: "11.5px", maxWidth: "450px", padding: "6px", backgroundColor: "var(--surface-muted)", borderRadius: "4px", border: "1px solid var(--border-color)", textAlign: "left" }}>
                      P_face = (Mu / d_couple) · SF<br />
                      SF = L_eff / (L_eff + d_couple / 3)
                    </div>
                    where d_couple is the branch dimension perpendicular to the checked face (Hb for Face B, Bb for Face H). This represents a highly sophisticated, mathematically rigorous elastic distribution that prevents over-conservative un-apportioned demand checking and correlates beautifully with 3D component-based finite element mesh (CBFEM) models.
                  </li>
                  <li>
                    <strong>Strict Locking of k_ds = 1.0:</strong> Under transverse shear, AISC §J2.4 Eq. J2-5 permits a 1.5× directional factor increase. However, due to out-of-plane branch flexing under tension, and out-of-plane moment pulling, <strong>k_ds is strictly locked to 1.0</strong> for HSS branch welds per AISC 360-22 Table K5.1 user notes to maintain appropriate structural reliability indices.
                  </li>
                  <li>
                    <strong>K5 Be Reduction Width (Eq. K1-1):</strong> Transverse branch welds pull on flexible plates/chord walls. In K5 mode, the effective width is computed as:
                    <div style={{ fontFamily: "monospace", margin: "4px auto", fontSize: "11.5px", maxWidth: "450px", textAlign: "center", padding: "6px", backgroundColor: "var(--surface-muted)", borderRadius: "4px", border: "1px solid var(--border-color)" }}>
                      Be = (10 / (B/t)) · (Fy·t / (Fyb·tb)) · Bb &le; Bb
                    </div>
                    This reduction width is applied directly to the nominal branch face dimension being checked, representing out-of-plane flexibility limits.
                  </li>
                  <li>
                    <strong>Unitary Weld Line Capacity Analysis:</strong> The calculator designs a single weld line at a time. The resulting effective throat ($t_e = 0.707 \cdot w$), nominal shear stress ($Fnw = 0.60 \cdot FEXX$), and base metal capacities (§J4.2) are calculated as unitary properties for the selected line and are not multiplied by 2.
                  </li>
                </ul>
              </div>

              {/* SECTION B: STANDARD SHAPE MODULE */}
              <div>
                <h4 style={{ margin: "0 0 6px 0", color: "var(--primary-dark)", fontSize: "13px", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "3px" }}>
                  2. Standard Shapes Welds Module (AISC §J2.4 &amp; §J4.2)
                </h4>
                <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px", margin: 0 }}>
                  <li>
                    <strong>Directional Strength Increase Factor (k_ds):</strong> Permitted under §J2.4 (Eq. J2-5) for welds connecting standard shapes (like Angles, Channels, or W-shapes) to rigid base elements. Because these thicker shapes distribute loads more uniformly, the fillet weld shear strength is calculated as:
                    <div style={{ fontFamily: "monospace", margin: "4px auto", fontSize: "11.5px", maxWidth: "450px", textAlign: "center", padding: "6px", backgroundColor: "var(--surface-muted)", borderRadius: "4px", border: "1px solid var(--border-color)" }}>
                      Fnw = 0.60 · FEXX · (1.0 + 0.5 · sin^1.5 θ)
                    </div>
                    The user can toggle this directional factor (theta = 0° for longitudinal shear up to theta = 90° for transverse tension where kds = 1.5) directly in the controls.
                  </li>
                  <li>
                    <strong>Base Metal Shear Yielding &amp; Rupture (§J4.2):</strong> Checked under shear yielding (φRn = 1.00 · 0.60 · Fy · Agv) and shear rupture (φRn = 0.75 · 0.60 · Fu · Anv) of the connected elements to protect against premature tearing of standard shapes.
                  </li>
                  <li>
                    <strong>Longitudinal Weld Length Reduction factor β (§J2.2b):</strong> For standard shapes where $L/w &gt; 100$, stress is non-uniform at the loaded ends. Nominal strength is reduced by:
                    <div style={{ fontFamily: "monospace", margin: "4px auto", fontSize: "11.5px", maxWidth: "450px", textAlign: "center", padding: "6px", backgroundColor: "var(--surface-muted)", borderRadius: "4px", border: "1px solid var(--border-color)" }}>
                      β = 1.2 - 0.002 · (L/w) &le; 1.0
                    </div>
                    Capped at a maximum reduction of 0.60 for $L/w &gt; 300$.
                  </li>
                </ul>
              </div>

              {/* SECTION C: PLATE RIGIDITY MODULE */}
              <div>
                <h4 style={{ margin: "0 0 6px 0", color: "var(--primary-dark)", fontSize: "13px", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "3px" }}>
                  3. Plate Rigidity &amp; Base Plate Flexure Module (AISC Chapter F &amp; DG 1)
                </h4>
                <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px", margin: 0 }}>
                  <li>
                    <strong>Yield Line Theory Bending Capacity:</strong> Relies on **AISC Design Guide 1** to model plate flexural bending under out-of-plane forces. The critical bending section of the plate is checked as a plastic flexural element per AISC Chapter F:
                    <div style={{ fontFamily: "monospace", margin: "4px auto", fontSize: "11.5px", maxWidth: "450px", textAlign: "center", padding: "6px", backgroundColor: "var(--surface-muted)", borderRadius: "4px", border: "1px solid var(--border-color)" }}>
                      φMn = φ · Fy · Zp = 0.90 · Fy · (bp · tp^2 / 4)
                    </div>
                    Where $\phi = 0.90$ is the LRFD strength reduction factor for plate flexural yielding.
                  </li>
                  <li>
                    <strong>Plate Rigidity Parameter (Stiffness Verification):</strong> Evaluates out-of-plane plate bending and stiffness. Insufficiently rigid plates lead to localized flexural yielding, non-uniform concrete bearing pressure, and excessive prying forces on anchoring systems. The calculator computes the minimum required thickness and deflection ratios to guarantee rigid behavior.
                  </li>
                </ul>
              </div>
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
                  <li>§J2.2a — Fillet weld effective throat ($t_e = 0.707 \cdot w$).</li>
                  <li>§J2.2b &amp; Table J2.4 — Minimum and maximum fillet weld leg sizes based on thinner joined part thickness.</li>
                  <li>§J2.2b &amp; Eq. J2-1 — Longitudinal fillet weld length reduction factor $\beta = 1.2 - 0.002 \cdot (L/w) \le 1.0$ (when ratio exceeds 100). Capped at 0.60 for ratio &gt; 300.</li>
                  <li>§J2.4 &amp; Eq. J2-5 — Fillet weld metal shear strength; LRFD φ = 0.75. Directional factor kds locked to 1.0 for HSS connections per Chapter K Commentary, but available (up to 1.5) for standard shapes.</li>
                  <li>§J4.2 &amp; Eqs. J4-3 / J4-4 — Base metal shear yielding ($\phi = 1.00$) and base metal shear rupture ($\phi = 0.75$) limits.</li>
                  <li>§K1.2.2a &amp; Eq. K1-1 — Hollow Structural Section connection uneven stress effective width $B_e$ calculation for transverse walls.</li>
                  <li>§K5 Table K5.1 — Standardized effective weld lengths; parallel welds fully effective, transverse welds reduced to $B_e$.</li>
                  <li>Chapter F — Flexural design of plate elements ($\phi = 0.90$) under flexural yielding.</li>
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
                  Detailed structural examples of Chapter K effective weld lengths and face flexibility checks, validating the exclusion of kds directional factors in branch connections.
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
                  Section 3.4 outlines base plate thickness design checks under moment + axial loads, specifying plastic section bending capacity checks with LRFD $\phi = 0.90$ strength reduction.
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
                  Provides the physical research backing the lock of kds = 1.0 for fillet welds of rectangular HSS branch members to guarantee necessary structural target safety indexes.
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
