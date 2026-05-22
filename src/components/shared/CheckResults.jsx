import React from "react";

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
export function CheckBlock({ title, codeRef, traceSteps, statCards, checkProps }) {
  return (
    <div className="card check-block-card">
      <div className="check-block-header">
        <span className="header-title">{title}</span>
        <span className="header-ref">{codeRef}</span>
      </div>
      <div className="check-block-content">
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
