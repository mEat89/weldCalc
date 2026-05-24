import { useState } from "react";

/**
 * Renders a single math equation trace line with its corresponding code reference
 */
export function TraceStep({ eq, codeRef, value, last }) {
  return (
    <div className={`trace-step ${last ? "last-step" : ""}`}>
      <div className="trace-row">
        <span className="trace-eq">{eq}</span>
        <span className="trace-val">{value}</span>
      </div>
      <div className="trace-ref">{codeRef}</div>
    </div>
  );
}

/**
 * Standard widget for displaying single key metrics
 */
export function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

/**
 * Renders the result panel with large OK/NG status, descriptive details, and DCR math
 */
export function CheckBox({ status, demand, cap, dcr, label }) {
  const isOk = status === "OK";
  const stateClass = isOk ? "status-ok" : "status-ng";

  return (
    <div className={`check-box-panel ${stateClass}`}>
      <div className="check-box-status">{status}</div>
      <div className="check-box-label">
        {label || (isOk ? "Adequate" : "Inadequate")}
      </div>
      {dcr !== null && dcr !== undefined && (
        <div className="check-box-math">
          DCR = {demand.toFixed(2)} / {cap.toFixed(2)} = {dcr.toFixed(3)}
          {!isOk && <span className="dcr-pct-excess"> (+{((dcr - 1) * 100).toFixed(0)}%)</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Renders a full validation card grouping math trace steps, metrics, and checking status
 */
export function CheckBlock({ title, codeRef, traceSteps, statCards, checkProps, tooltipSections }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="card check-block-card">
      <div
        className="check-block-header collapsible"
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: "pointer" }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setIsOpen(!isOpen); e.preventDefault(); } }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="header-title">{title}</span>
          </div>
          <span className="header-ref">{codeRef}</span>
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
          onClick={(e) => {
            // If the click happened on the info icon or tooltip, do not collapse the card
            if (e.target.closest(".info-tooltip-wrapper")) {
              e.stopPropagation();
            }
          }}
        >
          {tooltipSections && (
            <InfoTooltip title={`${title} — Details`} sections={tooltipSections} align="right" />
          )}
          {checkProps && checkProps.status && (
            <span className={`status-badge-mini ${checkProps.status === "OK" ? "pass" : "fail"}`}>
              {checkProps.status}
            </span>
          )}
          <span
            style={{
              display: "inline-block",
              transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              fontSize: "10px",
              color: "var(--text-muted)",
            }}
          >
            ▶
          </span>
        </div>
      </div>
      {isOpen && (
        <div className="check-block-content" style={{ marginTop: "6px", borderTop: "1px solid var(--border-color)", paddingTop: "6px" }}>
          <div className="trace-steps-container">
            {traceSteps.map((step, i) => (
              <TraceStep
                key={i}
                eq={step.eq}
                codeRef={step.codeRef}
                value={step.value}
                last={i === traceSteps.length - 1}
              />
            ))}
          </div>
          <div className="metrics-and-status-container">
            <div className="stat-cards-vertical">
              {statCards.map((s, i) => (
                <StatCard key={i} label={s.label} value={s.value} />
              ))}
            </div>
            {checkProps && checkProps.status && <CheckBox {...checkProps} />}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * AISC 360-22 §K4-9 Combined-Loading Unity card.
 *
 * Accepts the current governing DCRs for axial and in-plane moment and renders
 * the final §K4-9 unity check. The HSS tab computes these terms automatically
 * from the current load inputs — there is no manual capture workflow.
 */
export function CombinedLoadingCard({ terms, unity, status, hasAnyTerm, connType = "hss2hss" }) {
  const momentTermLabel = connType === "hss2plate" ? "Bending moment term: Mr/Mc" : "In-plane moment term: Mr,ip/Mc,ip";
  const momentCodeRef = connType === "hss2plate"
    ? "Current flexural weld-group bending DCR (Mu·12 / φMn)"
    : "Current in-plane moment weld-group DCR (Mu·12 / φMn-ip)";
  if (!hasAnyTerm) {
    return (
      <div className="card check-block-card">
        <div className="check-block-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span className="header-title">Final design verdict — Combined loading (§K4-9)</span>
            <span className="header-ref">AISC 360-22 §K4 — Pr/Pc + Mr,ip/Mc,ip ≤ 1.0</span>
          </div>
          <span className="status-badge-mini" style={{ background: "var(--surface-subtle)", color: "var(--text-muted)" }}>—</span>
        </div>
        <div style={{ padding: "8px 12px", fontSize: "11.5px", color: "var(--text-muted)", lineHeight: "1.45" }}>
          Enter at least one non-zero load (V, N, or M_ip) above. Zero loads
          are ignored, and this final verdict updates automatically from the
          current inputs — no capture step.
        </div>
      </div>
    );
  }
  const isOk = status === "OK";
  return (
    <div className="card check-block-card">
      <div className="check-block-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span className="header-title">Final design verdict — Combined loading (§K4-9)</span>
          <span className="header-ref">AISC 360-22 §K4 — Pr/Pc + Mr,ip/Mc,ip ≤ 1.0 (auto-aggregated)</span>
        </div>
        <span className={`status-badge-mini ${isOk ? "pass" : "fail"}`}>{status}</span>
      </div>
      <div className="check-block-content" style={{ marginTop: "6px", borderTop: "1px solid var(--border-color)", paddingTop: "6px" }}>
        <div className="trace-steps-container">
          <TraceStep eq={`Axial term: Pr/Pc = ${terms.axial.toFixed(3)}`} codeRef="Worse active group DCR from current shear/tension inputs" value={terms.axial.toFixed(3)} />
          <TraceStep eq={`${momentTermLabel} = ${terms.ipMoment.toFixed(3)}`} codeRef={momentCodeRef} value={terms.ipMoment.toFixed(3)} last />
        </div>
        <div className="metrics-and-status-container">
          <div className="stat-cards-vertical">
            <StatCard label="Unity sum" value={unity.toFixed(3)} />
            <StatCard label="Limit" value="1.000" />
            <StatCard label="Margin" value={(1.0 - unity).toFixed(3)} />
          </div>
          <CheckBox
            status={status}
            demand={unity}
            cap={1.0}
            dcr={unity}
            label={isOk ? "Final connection check adequate" : "Final connection check exceeds unity (§K4-9)"}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * AISC §K5-1 + K5-5/K5-6 Total Group Capacity card (Check 5).
 *
 * Shows the connection-level weld-group capacity that matches Hilti CBFEM's
 * headline utilization %. For axial solicitation (shear/tension) it uses
 * Eq. K5-1 (Pn = Fnw·tw·le), for in-plane moment it uses Eq. K5-2
 * (Mn-ip = Fnw·Sip).
 *
 * Renders as a standard collapsible CheckBlock so group result cards are
 * visually consistent with the rest of the app.
 */
export function GroupCapacityCard({ groupCap, solicitation, appliedLoad, appliedMoment, fexx, error, connType = "hss2hss" }) {
  if (error) {
    return (
      <div className="card check-block-card">
        <div className="check-block-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span className="header-title">Total group capacity (§K5)</span>
            <span className="header-ref">AISC 360-22 §K5 Eq. K5-1 / K5-5 (axial) and K5-2 / K5-6 (moment)</span>
          </div>
          <span className="status-badge-mini" style={{ background: "var(--surface-subtle)", color: "var(--text-muted)" }}>—</span>
        </div>
        <div style={{ padding: "8px 12px", fontSize: "11.5px", color: "var(--danger)" }}>
          Could not compute group capacity: {error}
        </div>
      </div>
    );
  }
  if (!groupCap) return null;

  const isMoment = solicitation === "moment";
  const demand = isMoment ? appliedMoment * 12 : appliedLoad;
  const demandUnit = isMoment ? "kip-in" : "kips";
  const nominal = isMoment ? groupCap.Mn_ip : groupCap.Pn_axial;
  const cap = isMoment ? groupCap.cap_ip : groupCap.cap_axial;
  const dcr = demand > 0 && cap > 0 ? demand / cap : null;
  const status = dcr === null ? null : dcr <= 1.0 ? "OK" : "NG";

  const title = isMoment
    ? (connType === "hss2plate" ? "Total group capacity, bending moment (§K5-2 / K5-6)" : "Total group capacity, in-plane moment (§K5-2 / K5-6)")
    : "Total group capacity, axial (§K5-1 / K5-5)";
  const codeRef = "Full weld-group check — matches Hilti CBFEM headline % aggregation";

  const traceSteps = isMoment ? [
    { eq: `Sip = tw·[Hb²/(3·sin²θ) + Be·Hb/sinθ]`, codeRef: "AISC §K5 Eq. K5-6 — effective elastic section modulus", value: `${groupCap.Sip.toFixed(4)} in³` },
    { eq: `  web term  = tw·Hb²/(3·sin²θ)`, codeRef: "Both webs (parallel longitudinal welds, strong-axis bending)", value: `${groupCap.terms.webTerm.toFixed(4)} in³` },
    { eq: `  flange term = tw·Be·Hb/sinθ`, codeRef: "Both flanges (transverse welds, Be effective width)", value: `${groupCap.terms.flangeTerm.toFixed(4)} in³` },
    { eq: `Fnw = 0.60·FEXX = 0.60·${fexx}`, codeRef: "AISC §K5: kds = 1.0 for HSS branch welds in bending", value: `${groupCap.Fnw.toFixed(2)} ksi` },
    { eq: `Mn-ip = Fnw · Sip`, codeRef: "AISC §K5 Eq. K5-2 (nominal in-plane moment capacity)", value: `${groupCap.Mn_ip.toFixed(2)} kip-in` },
    { eq: `φMn-ip = 0.75 · Mn-ip`, codeRef: "LRFD φ = 0.75 per §K5(a)", value: `${groupCap.cap_ip.toFixed(2)} kip-in` },
  ] : [
    { eq: `le = 2·Hb/sinθ + 2·Be`, codeRef: "AISC §K5 Eq. K5-5 — total effective weld length around perimeter", value: `${groupCap.le.toFixed(3)} in` },
    { eq: `Fnw = 0.60·FEXX = 0.60·${fexx}`, codeRef: "AISC §K5: kds = 1.0 for HSS branch welds", value: `${groupCap.Fnw.toFixed(2)} ksi` },
    { eq: `Pn = Fnw · tw · le`, codeRef: "AISC §K5 Eq. K5-1 (nominal axial capacity)", value: `${groupCap.Pn_axial.toFixed(2)} kips` },
    { eq: `φPn = 0.75 · Pn`, codeRef: "LRFD φ = 0.75 per §K5(a)", value: `${groupCap.cap_axial.toFixed(2)} kips` },
  ];

  const statCards = isMoment ? [
    { label: "Mn-ip nominal", value: `${nominal.toFixed(2)} ${demandUnit}` },
    { label: "φMn-ip (LRFD)", value: `${cap.toFixed(2)} ${demandUnit}` },
    { label: "Group DCR", value: dcr !== null ? dcr.toFixed(3) : "—" },
  ] : [
    { label: "Pn nominal", value: `${nominal.toFixed(2)} ${demandUnit}` },
    { label: "φPn (LRFD)", value: `${cap.toFixed(2)} ${demandUnit}` },
    { label: "Group DCR", value: dcr !== null ? dcr.toFixed(3) : "—" },
  ];

  const checkProps = status ? {
    status,
    demand,
    cap,
    dcr,
    label: status === "OK"
      ? "Total group capacity adequate"
      : "Total group capacity exceeded",
  } : null;

  return (
    <CheckBlock
      title={title}
      codeRef={codeRef}
      traceSteps={traceSteps}
      statCards={statCards}
      checkProps={checkProps}
    />
  );
}

/**
 * Click-to-expand card widget (primarily used for the load distribution guide)
 */
export function Collapsible({ title, subtitle, open, onToggle, children }) {
  return (
    <div className="card collapsible-card">
      <div className="collapsible-header" onClick={onToggle} role="button" tabIndex={0}>
        <div className="collapsible-header-text">
          <div className="collapsible-title">{title}</div>
          {subtitle && <div className="collapsible-subtitle">{subtitle}</div>}
        </div>
        <div className={`collapsible-chevron ${open ? "expanded" : ""}`}>▶</div>
      </div>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

/**
 * Renders structural alerts for limit state geometry advisory flags
 */
export function WarningBanner({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="warning-banner-container">
      <div className="warning-banner-title">⚠ {title}</div>
      <ul className="warning-banner-list">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * SOLID-compliant interactive tooltip with try-catch-finally block error resilience
 */
export function InfoTooltip({ title, sections, align = "right" }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleMouseEnter = () => {
    try {
      setIsOpen(true);
    } catch (err) {
      console.error("Failed to show tooltip on hover", err);
    } finally {
      // Safe execution
    }
  };

  const handleMouseLeave = () => {
    try {
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to hide tooltip on mouse leave", err);
    } finally {
      // Safe execution
    }
  };

  const getBoxStyle = () => {
    try {
      switch (align) {
        case "left":
          return { left: 0, right: "auto" };
        case "center":
          return { left: "-133px", right: "auto" };
        case "right":
        default:
          return { right: 0, left: "auto" };
      }
    } catch (err) {
      console.error("Failed to compute box style", err);
      return { right: 0, left: "auto" };
    }
  };

  return (
    <div
      className="info-tooltip-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="info-btn"
        title="Hover for engineering assumptions and references"
        onClick={(e) => e.stopPropagation()}
      >
        i
      </button>
      {isOpen && (
        <div className="info-tooltip-box" style={getBoxStyle()}>
          <div className="info-tooltip-header">
            <span className="info-tooltip-title">{title}</span>
          </div>
          <div className="info-tooltip-content">
            {sections && sections.map((sec, i) => (
              <div key={i} className="info-tooltip-section">
                {sec.label && (
                  <span className="info-tooltip-sec-title">{sec.label}</span>
                )}
                <p className="info-tooltip-text">{sec.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
