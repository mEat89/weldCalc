import React, { useState } from "react";

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
