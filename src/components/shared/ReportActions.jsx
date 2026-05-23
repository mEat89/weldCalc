import React, { useState } from "react";
import ReportMetaModal from "../modals/ReportMetaModal";
import { renderPdf } from "../../reports/pdfRenderer";
import { renderDocx } from "../../reports/docxRenderer";
import { serializeSvg } from "../../reports/svgToPng";

/**
 * Compact two-button group: Export PDF / Export Word. On first click in the
 * session the modal collects project metadata; subsequent clicks reuse the
 * saved values (the modal still opens, pre-filled, so the user can tweak).
 *
 * Props:
 *   - reportMeta        — { project, engineer, jobNumber, date } | null
 *   - setReportMeta     — setter for session-persisted meta
 *   - buildModel(meta, diagramSvgString) — returns a fully-populated report model
 *   - diagramRef        — React ref to the tab's <svg> (or its container)
 */
export default function ReportActions({ reportMeta, setReportMeta, buildModel, diagramRef }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState(null); // "pdf" | "docx" | null
  const [busy, setBusy] = useState(false);

  const startExport = (format) => {
    if (!busy) {
      setPendingFormat(format);
      setDropdownOpen(false);
    }
  };

  const captureSvg = () => {
    const node = diagramRef && diagramRef.current;
    if (!node) return null;
    // If the ref points to a container, find the first <svg> inside.
    const svgEl = node.tagName === "svg" ? node : node.querySelector && node.querySelector("svg");
    return serializeSvg(svgEl);
  };

  const handleSubmit = async (meta) => {
    setReportMeta(meta);
    const format = pendingFormat;
    setPendingFormat(null);
    setBusy(true);
    try {
      const svgString = captureSvg();
      const model = buildModel(meta, svgString);
      if (format === "pdf") await renderPdf(model);
      else await renderDocx(model);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Report export failed:", err);
      alert("Report export failed — see console for details.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="report-actions" style={{ position: "relative", display: "block", width: "100%" }}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          disabled={busy}
          className="btn-legend-trigger theme-toggle-btn"
          style={{
            padding: "4px 4px",
            fontSize: "11px",
            fontWeight: 700,
            height: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            cursor: "pointer",
            width: "100%"
          }}
          title="Print calculation report in PDF or Word format"
        >
          {busy ? "Working…" : "🖨️ Print"}
          <span style={{ fontSize: "7px", display: "inline-block", transition: "transform 0.2s", transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
        </button>

        {dropdownOpen && (
          <>
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 998,
                background: "transparent"
              }}
              onClick={() => setDropdownOpen(false)}
            />
            <div
              style={{
                position: "absolute",
                top: "28px",
                right: 0,
                backgroundColor: "var(--card-bg, #ffffff)",
                border: "1px solid var(--border-color, #e5e7eb)",
                borderRadius: "6px",
                boxShadow: "var(--shadow-md, 0 4px 12px rgba(0,0,0,0.15))",
                zIndex: 999,
                minWidth: "125px",
                padding: "4px 0",
                display: "flex",
                flexDirection: "column"
              }}
            >
              <button
                type="button"
                onClick={() => startExport("pdf")}
                style={{
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  color: "var(--text-main, #374151)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
                className="dropdown-item"
              >
                📄 PDF file
              </button>
              <button
                type="button"
                onClick={() => startExport("docx")}
                style={{
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  color: "var(--text-main, #374151)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
                className="dropdown-item"
              >
                📝 Word file
              </button>
            </div>
          </>
        )}
      </div>
      {pendingFormat && (
        <ReportMetaModal
          format={pendingFormat}
          initialMeta={reportMeta}
          onSubmit={handleSubmit}
          onClose={() => setPendingFormat(null)}
        />
      )}
    </>
  );
}
