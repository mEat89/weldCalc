/**
 * Shared report-model schema and helpers used by both the docx and pdf renderers.
 *
 * A report model is a plain object — the same shape regardless of tab:
 * {
 *   title, subtitle, generatedAt, meta,
 *   diagramSvgString,
 *   inputs:   [ { group, rows: [{label, value, units?}] } ],
 *   results:  [ { label, value, status?: "pass"|"fail" } ],
 *   checks:   [ { title, codeRef, steps:[{eq,codeRef,value}], statCards:[{label,value}],
 *                 verdict:{ status:"OK"|"NG"|null, demand, cap, dcr, label } } ],
 *   warnings: [ string ],
 *   references: [ string ],
 *   notes: [ string ]
 * }
 */

export const FAIL_COLOR_HEX = "C00000";

/** Returns a sanitized filename slug for the report download. */
export function reportFileSlug({ title, meta }) {
  const date = (meta && meta.date) || new Date().toISOString().slice(0, 10);
  const proj = (meta && meta.project ? meta.project.trim() : "") || "report";
  const safe = (s) => s.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  const titlePart = safe((title || "report").split(/[—-]/)[0].trim()).slice(0, 32);
  const projPart = safe(proj).slice(0, 32);
  return `${projPart}_${titlePart}_${date}`;
}

/** Format helpers tolerated by both renderers (work on plain strings). */
export function fmtNum(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (typeof v !== "number") return String(v);
  return v.toFixed(digits);
}

export function metaLine(meta) {
  if (!meta) return "";
  const parts = [];
  if (meta.project) parts.push(`Project: ${meta.project}`);
  if (meta.engineer) parts.push(`Engineer: ${meta.engineer}`);
  if (meta.jobNumber) parts.push(`Job #: ${meta.jobNumber}`);
  if (meta.date) parts.push(`Date: ${meta.date}`);
  return parts.join("   |   ");
}

/** True if any check or rigidity verdict in the model indicates failure. */
export function modelHasFailure(model) {
  if (!model || !Array.isArray(model.checks)) return false;
  return model.checks.some((c) => c && c.verdict && c.verdict.status === "NG");
}
