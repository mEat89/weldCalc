import React, { useEffect, useRef, useState } from "react";

/**
 * Modal collecting project metadata (project / engineer / job # / date) before
 * exporting a calculation report. Fields are pre-filled from `initialMeta`
 * so subsequent exports in the same session don't ask twice.
 *
 * onSubmit(meta) is called with the final values; onClose is called on cancel.
 */
export default function ReportMetaModal({ format, initialMeta, onSubmit, onClose }) {
  const [project, setProject] = useState((initialMeta && initialMeta.project) || "");
  const [engineer, setEngineer] = useState((initialMeta && initialMeta.engineer) || "");
  const [jobNumber, setJobNumber] = useState((initialMeta && initialMeta.jobNumber) || "");
  const [date, setDate] = useState((initialMeta && initialMeta.date) || new Date().toISOString().slice(0, 10));
  const firstInputRef = useRef(null);

  useEffect(() => { if (firstInputRef.current) firstInputRef.current.focus(); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ project: project.trim(), engineer: engineer.trim(), jobNumber: jobNumber.trim(), date });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "440px" }}
      >
        <div className="modal-header">
          <h2 className="modal-title">Export {format === "pdf" ? "PDF" : "Word"} report</h2>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-description">
          Provide project information for the report header. Values are kept for the rest of this session.
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div className="form-field">
            <label className="form-label" htmlFor="report-meta-project">Project name</label>
            <input
              ref={firstInputRef}
              id="report-meta-project"
              type="text"
              className="form-input"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="(optional)"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="report-meta-engineer">Engineer</label>
            <input
              id="report-meta-engineer"
              type="text"
              className="form-input"
              value={engineer}
              onChange={(e) => setEngineer(e.target.value)}
              placeholder="(optional)"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div className="form-field">
              <label className="form-label" htmlFor="report-meta-job">Job #</label>
              <input
                id="report-meta-job"
                type="text"
                className="form-input"
                value={jobNumber}
                onChange={(e) => setJobNumber(e.target.value)}
                placeholder="(optional)"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="report-meta-date">Date</label>
              <input
                id="report-meta-date"
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }}>
            <button type="button" onClick={onClose} className="btn-legend-trigger" style={{ padding: "6px 12px", fontSize: "12px" }}>
              Cancel
            </button>
            <button type="submit" className="btn-legend-trigger" style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 700 }}>
              Export {format === "pdf" ? "PDF" : "Word"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
