/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { toFraction, to16ths } from "../../math/weldMath";
import { COMMON_PLATE_T, LOAD_CASES, HSS_SHAPES, STEEL_GRADES } from "../../constants/steelData";

/**
 * Parse a user-entered numeric string. Empty / NaN → 0. Negative values are
 * surfaced to callers so they can render a visible warning (we coerce to 0
 * for the actual calculation but the raw value is preserved on the field).
 */
export function parseNonNegative(v) {
  const parsed = parseFloat(v);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

/**
 * Numeric input that enforces non-negativity for engineering demand values
 * (loads, moments). Renders a visible inline warning when the user types a
 * negative number — the calculation receives 0 instead of silently treating
 * the negative as a sign flip.
 */
export function NonNegativeNumberInput({
  id,
  value,
  onChange,
  step = "any",
  placeholder,
  className = "form-input compact",
  style,
  disabled = false,
  title,
}) {
  const [rawDisplay, setRawDisplay] = React.useState(String(value ?? 0));
  React.useEffect(() => {
    // Re-sync the displayed text only when the external value is NOT what
    // parseNonNegative would produce from the current raw text. This lets the
    // user keep "-5" visible (with the warning) while the coerced value (0)
    // flows into the calculation underneath — without overwriting the user's
    // raw input on every onChange round-trip.
    const coerced = parseNonNegative(rawDisplay);
    if (coerced !== value) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRawDisplay(String(value ?? 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const parsed = parseFloat(rawDisplay);
  const isNegative = Number.isFinite(parsed) && parsed < 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px", ...style }}>
      <input
        id={id}
        type="number"
        step={step}
        value={rawDisplay}
        placeholder={placeholder}
        disabled={disabled}
        title={title}
        onChange={(e) => {
          if (disabled) return;
          setRawDisplay(e.target.value);
          onChange(parseNonNegative(e.target.value));
        }}
        className={className}
      />
      {isNegative && (
        <span style={{ color: "var(--danger)", fontSize: "10.5px", lineHeight: "1.2" }}>
          ⚠ Negative input ignored — using 0. Enter the magnitude; sign is determined by solicitation type.
        </span>
      )}
    </div>
  );
}

/**
 * Standard wrapper for labels, inputs, and descriptions
 */
export function Field({ label, children, helper, id }) {
  return (
    <div className="form-field">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      {children}
      {helper && <span className="form-helper">{helper}</span>}
    </div>
  );
}

/**
 * Numeric input specifically for dimensions, featuring automatic fraction/16ths badge overlays
 */
export function InchInput({ label, value, onChange, min = 0.01, step = 0.0625, id, suppress16ths = false }) {
  const fractionLabel = value > 0
    ? (suppress16ths ? `≈ ${toFraction(value)}` : `≈ ${toFraction(value)} (${to16ths(value)})`)
    : "";
  return (
    <Field label={label} helper={fractionLabel} id={id}>
      <input
        id={id}
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="form-input"
      />
    </Field>
  );
}

/**
 * Standard plate-thickness dropdown built from COMMON_PLATE_T.
 * Label format is fractional inch only (e.g. 1/2") — the 16ths display
 * is reserved for the weld leg-size dropdown.
 */
export function PlateThicknessSelect({ label, value, onChange, id }) {
  return (
    <Field label={label} id={id}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="form-select compact"
      >
        {COMMON_PLATE_T.map((t) => (
          <option key={t} value={t}>
            {toFraction(t)}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * Quick-pick selection grid for standard steel plate thicknesses
 */
export function PlateQuickPick({ value, onChange }) {
  return (
    <div className="quick-pick-grid">
      {COMMON_PLATE_T.map((t) => {
        const isActive = Math.abs(value - t) < 1e-6;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`quick-pick-btn ${isActive ? "active" : ""}`}
            type="button"
          >
            {toFraction(t)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Load case panel showing weld orientation selectors with visual tooltips and descriptions
 */
export function LoadCaseSelector({
  loadCase,
  setLoadCase,
  useDirectional,
  setUseDirectional,
  lockDirectional,
  lockReason,
}) {
  const currentCase = LOAD_CASES.find((c) => c.id === loadCase);

  return (
    <div className="card load-case-card">
      <div className="card-section-label">
        Load case (angle θ between load and weld longitudinal axis)
      </div>
      <div className="load-case-btn-grid">
        {LOAD_CASES.map((c) => {
          const isActive = loadCase === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setLoadCase(c.id)}
              className={`load-case-btn ${isActive ? "active" : ""}`}
              type="button"
            >
              <div className="btn-title">{c.label}</div>
              <div className="btn-sub">{c.angle}</div>
            </button>
          );
        })}
      </div>
      <div className="load-case-description">
        <strong>{currentCase.label}:</strong> {currentCase.description}
      </div>

      {loadCase === "trans" && (
        <div className="directional-panel">
          <div className="callout callout-info">
            Per AISC 360-16 §J2.4, transverse loading allows a 1.5× directional
            strength increase (Eq. J2-5), giving Fnw = 0.90·FEXX.
            {lockDirectional && (
              <span>
                {" "}
                <strong>This increase is suppressed</strong> {lockReason}.
              </span>
            )}
          </div>
          {!lockDirectional && (
            <label className="conservative-checkbox-row">
              <input
                type="checkbox"
                checked={!useDirectional}
                onChange={(e) => setUseDirectional(!e.target.checked)}
                className="checkbox-input"
              />
              <span className="checkbox-text">
                Use conservative calculation (suppress 1.5× directional increase → Fnw = 0.60·FEXX)
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Reusable selection dropdown for the entire HSS shapes catalog
 */
export function HssMemberSelect({ label, value, onChange, id }) {
  return (
    <Field label={label} id={id}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="form-select compact"
      >
        {HSS_SHAPES.map((s, i) => (
          <option key={i} value={i}>
            {s.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * Reusable selection dropdown for steel grades (filtered by category like "hss" or "plate")
 */
export function SteelGradeSelect({ label, value, onChange, id, category }) {
  const grades = category
    ? STEEL_GRADES.filter((g) => g.category === category)
    : STEEL_GRADES;

  return (
    <Field label={label} id={id}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="form-select compact"
      >
        {grades.map((g) => {
          const idx = STEEL_GRADES.indexOf(g);
          return (
            <option key={idx} value={idx}>
              {g.shortLabel}
            </option>
          );
        })}
      </select>
    </Field>
  );
}
