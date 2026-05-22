import React, { useState } from "react";
import HSSTab from "./components/tabs/HSSTab";
import StandardShapesTab from "./components/tabs/StandardShapesTab";
import PlateRigidityTab from "./components/tabs/PlateRigidityTab";
import LegendModal from "./components/modals/LegendModal";

const TABS = [
  { id: "hss",      label: "HSS connections (per-face, 3-mode)" },
  { id: "standard", label: "Standard shapes" },
  { id: "rigidity", label: "Base plate rigidity" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("hss");
  const [legendOpen, setLegendOpen] = useState(false);

  return (
    <div className="app-container">
      {/* Upper header segment */}
      <header className="app-header">
        <div className="header-title-area">
          <h1>
            Weld Capacity Calculator
            <span className="version-badge">v2.5</span>
          </h1>
          <div className="header-subtitle">
            AISC 360-22 / 360-16 + DG1 — §J2.2, §J2.4, §J4.2, §K5, §DG1 §3.4 (3-mode L_eff + plate rigidity, code-grounded only)
          </div>
        </div>
        <button
          onClick={() => setLegendOpen(true)}
          className="btn-legend-trigger"
          type="button"
        >
          📖 Symbol Legend
        </button>
      </header>

      {/* Tab bar selection */}
      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`tab-nav-btn ${activeTab === t.id ? "active" : ""}`}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Main Tab Panels */}
      <main className="tab-viewport">
        {activeTab === "hss" && <HSSTab />}
        {activeTab === "standard" && <StandardShapesTab />}
        {activeTab === "rigidity" && <PlateRigidityTab />}
      </main>

      {/* Global References Panel */}
      <section className="card references-card mt-4">
        <div className="card-section-label">References — codes, standards, and research</div>
        <ul className="refs-list">
          <li>
            <strong>AISC 360-22 / AISC 360-16</strong> — <em>Specification for Structural Steel Buildings</em>
            <ul className="refs-list mt-2">
              <li>§J2.2a — Effective area of fillet welds (te = 0.707 · w)</li>
              <li>§J2.2b &amp; Table J2.4 — Min/max fillet weld size based on thickness of thinner part joined</li>
              <li>§J2.4 &amp; Eq. J2-5 — Strength of fillet welds; directional strength increase (1 + 0.5 · sin^1.5 θ); φ = 0.75, Ω = 2.00</li>
              <li>§J2.4 Commentary (360-22) — kds = 1.0 for fillet welds at ends of rectangular HSS branches in tension</li>
              <li>§J4.2 &amp; Eqs. J4-3 / J4-4 — Shear yielding and rupture of connecting elements</li>
              <li>§K1.2.2a (360-22) / §K5 (360-16) &amp; Eq. K1-1 — Effective width Be = (10/(B/t)) · (Fy · t / (Fyb · tb)) · Bb ≤ Bb for plates and branches to HSS</li>
              <li>§K5 Table K5.1 — Effective weld properties; longitudinal portions fully effective, transverse reduced to Be per face</li>
              <li>§K5 Commentary — kds factor omitted for HSS branch welds due to non-uniform stiffness of the chord face</li>
              <li>Table K3.1A — Limits of Applicability (LOA) for branch-to-rectangular-HSS connections</li>
            </ul>
          </li>
          <li>
            <strong>AISC Design Guide 24</strong>, 2nd Ed. (Packer, Sherman, Lecce) — <em>Hollow Structural Section Connections</em>. Explicit worked K5 examples; confirms kds = 1.0 limit for fillet welds to ends of rectangular HSS branches.
          </li>
          <li>
            <strong>Tousignant, K., and Packer, J.A.</strong> (2015) — research quantifying why kds = 1.0 is required for fillet welds to rectangular HSS branches welded to rigid plates to satisfy structural target reliability index.
          </li>
          <li>
            <strong>Olson, K.</strong> (2020) — "Know Your HSS Welds," <em>STRUCTURE Magazine</em> — practitioner-facing summary of the kds = 1.0 lock requirements.
          </li>
          <li>
            <strong>IDEA StatiCa / Hilti Profis</strong> — Theoretical Background for component-based finite element method (CBFEM) steel-connection weld audits. Matches peak stress element checks.
          </li>
          <li>
            <strong>AISC Design Guide 1</strong>, 2nd Ed. (Fisher &amp; Kloiber, 2006) — <em>Base Plate and Anchor Rod Design</em>, §3.4 elastic/plastic thickness check formulas.
          </li>
        </ul>
      </section>

      {/* Global Scope Summary */}
      <section className="card scope-summary-card">
        <div className="card-section-label">Scope &amp; Engineering Assumptions</div>
        <ul className="notes-list">
          <li><strong>v2.5: Rule-of-Thumb pre-screen REMOVED</strong> — The heuristic t ≥ √(M / (Fy · B)) introduced in v2.4 had no published code source (it relied on hardcoded cantilever/bearing presets). Base Plate Rigidity checks are now exclusively anchored to two code-grounded tests: Method B (elastic local plate bending stress limit σ ≤ Fy) and DG1 §3.4 (plastic cantilever with LRFD φ = 0.9).</li>
          <li><strong>Base Plate Rigidity Verdict</strong> — Verifies whether the rigid-plate kinematical assumption (planar base plate action) holds in service. If the verdict is NOT RIGID, anchor tension reactions from a standard rigid hand calculation are unconservative — a CBFEM solver, thicker plates, or stiffeners must be introduced.</li>
          <li><strong>Three selectable effective length modes:</strong> Strict code nominal per face (AISC), engineering judgment plate-as-chord K5 reduction (K5 Be), or peak element FE matching (CBFEM Lc).</li>
          <li><strong>Pure branch axial load only.</strong> Combined loads (axial + IPB + OPB + torsion) are not supported. Welds are equal-leg fillet welds only (effective throat = 0.707 · w). ERW HSS design wall thickness uses tdes = 0.93 · tnom per code. Round HSS/pipes are out of scope.</li>
        </ul>
      </section>

      {/* Overlay Modal for lookup dictionary */}
      {legendOpen && <LegendModal onClose={() => setLegendOpen(false)} />}
    </div>
  );
}
