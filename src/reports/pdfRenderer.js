import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { reportFileSlug } from "./reportModel";
import { svgToPng } from "./svgToPng";

const FAIL_RGB = [192, 0, 0]; // #C00000

const CHECK_DESCRIPTIONS = {
  "Weld metal shear rupture": "Evaluates the shear strength of the weld metal deposit per AISC 360 §J2.4. It computes the effective throat area of the fillet weld and applies the nominal weld stress (Fnw) with the LRFD resistance factor (φ = 0.75). Includes long weld reduction factor (β) and suppresses directional increase (kds = 1.0) where required.",
  "Base metal shear": "Checks the shear capacity of the connected base metal elements per AISC 360 §J4.2. It evaluates both the shear yielding limit state (AISC Eq. J4-3, φ = 1.00) and the shear rupture limit state (AISC Eq. J4-4, φ = 0.75) along the critical weld length, ensuring the base metal can support the weld reactions without tearing.",
  "Weld size limits": "Verifies that the provided fillet weld leg size (w) complies with the dimensional limits of AISC 360 §J2.2b and Table J2.4. It ensures the weld is large enough to prevent rapid cooling cracks (minimum size) and small enough to avoid melting away the edges of the thinner connected part (maximum size).",
  "Method B": "Evaluates the elastic bending stress in the base plate at the column face boundary per Method B. By requiring peak elastic stress to remain below the plate yield strength (σ_max ≤ Fy), it verifies the classic rigid-plate kinematic assumption used in conventional anchor rod force derivations.",
  "Plastic Cantilever": "Verifies the plastic moment capacity of the base plate cantilever under anchor tension per AISC Design Guide 1 §3.4. It calculates the minimum required plate thickness (t_req) using a plastic yield line model with LRFD resistance factor (φ = 0.90), ensuring the plate doesn't undergo excessive plastic deformation.",
  "Effective length": "Determines the design effective weld length on the selected branch face. AISC mode uses the full nominal length. K5 mode applies Be (Eq. K1-1) to the transverse branch face — for HSS-to-HSS this is the in-scope §K5 path, and for HSS-to-plate it is offered as conservative engineering judgment (under-reports L_eff). Longitudinal faces remain fully effective per Table K5.1 unless the user enables the optional force-K5 override."
};

const REPORT_LEGEND = [
  ["w", "in.", "Fillet weld nominal leg size"],
  ["te", "in.", "Effective throat thickness = 0.707 * w"],
  ["L_eff", "in.", "Effective weld length used for strength"],
  ["Aw", "in2", "Effective weld shear area = te * L_eff"],
  ["φRn", "kip", "LRFD design strength capacity (incorporates resistance factors)"],
  ["DCR", "-", "Demand-to-Capacity Ratio (required strength / design strength)"],
  ["tp", "in.", "Plate thickness"],
  ["Tu", "kip", "Anchor tension row demand force"],
  ["σ_max", "ksi", "Peak elastic plate bending stress = 6 * Tu * x / (b_eff * tp2)"],
  ["x", "in.", "Cantilever distance to tension anchor row"],
  ["b_eff", "in.", "Effective plate width resisting Tu cantilever bending"],
  ["Fy", "ksi", "Yield strength of steel main member or plate"],
  ["Fu", "ksi", "Tensile strength of steel main member or plate"],
];

function getCheckDescription(title) {
  if (!title) return "";
  for (const [key, desc] of Object.entries(CHECK_DESCRIPTIONS)) {
    if (title.toLowerCase().includes(key.toLowerCase())) {
      return desc;
    }
  }
  return "";
}

let cachedRegular = null;
let cachedBold = null;
let cachedItalic = null;

// Locally bundled Roboto TTFs (optional — see src/assets/fonts/README.md).
// If the user has dropped TTFs into src/assets/fonts/, Vite resolves these
// statically and ships them with the build. If the directory is empty (only
// the README is present), the glob result is empty and we fall back to the
// cdnjs runtime fetch path below, and finally to Helvetica + ASCII sanitization.
const LOCAL_FONT_URLS = import.meta.glob(
  "../assets/fonts/Roboto-*.ttf",
  { eager: true, query: "?url", import: "default" }
);

function findLocalFontUrl(suffix) {
  const match = Object.entries(LOCAL_FONT_URLS).find(([path]) => path.endsWith(suffix));
  return match ? match[1] : null;
}

async function fetchFontAsBase64(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const binary = new Uint8Array(arrayBuffer);
  let binaryStr = "";
  const len = binary.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    binaryStr += String.fromCharCode.apply(
      null,
      binary.subarray(i, Math.min(i + chunkSize, len))
    );
  }
  return btoa(binaryStr);
}

async function loadFontPreferLocal(localSuffix, cdnUrl) {
  const localUrl = findLocalFontUrl(localSuffix);
  if (localUrl) {
    return await fetchFontAsBase64(localUrl);
  }
  return await fetchFontAsBase64(cdnUrl);
}

/**
 * jsPDF's built-in Helvetica is WinAnsi-only. Strings that contain Greek
 * letters or math operators (σ, φ, β, θ, √, ≤, ≥, ², ³, ·, —, …) get
 * interpreted byte-by-byte as Latin-1 and render as garbage ("σ" → "Ã_").
 * If the custom Unicode font is active, we render the symbols natively.
 * If we fall back to Helvetica, we map everything to ASCII-safe engineering notation before writing.
 */
const UNICODE_MAP = [
  // Greek letters (lowercase)
  ["α", "alpha"], ["β", "beta"], ["γ", "gamma"], ["δ", "delta"],
  ["ε", "epsilon"], ["ζ", "zeta"], ["η", "eta"], ["θ", "theta"],
  ["λ", "lambda"], ["μ", "mu"], ["ν", "nu"], ["π", "pi"],
  ["ρ", "rho"], ["σ", "sigma"], ["τ", "tau"], ["φ", "phi"], ["ϕ", "phi"],
  ["χ", "chi"], ["ψ", "psi"], ["ω", "omega"],
  // Greek letters (uppercase)
  ["Α", "Alpha"], ["Β", "Beta"], ["Γ", "Gamma"], ["Δ", "Delta"],
  ["Θ", "Theta"], ["Λ", "Lambda"], ["Π", "Pi"], ["Σ", "Sum"],
  ["Φ", "Phi"], ["Ω", "Omega"],
  // Math operators / relations
  ["√", "sqrt"], ["∑", "sum"], ["∫", "int"], ["∞", "inf"],
  ["≤", "<="], ["≥", ">="], ["≠", "!="], ["≈", "~="],
  ["±", "+/-"], ["∓", "-/+"], ["×", "x"], ["÷", "/"],
  ["·", "*"], ["−", "-"],
  // Super/subscripts (most relevant ones)
  ["²", "^2"], ["³", "^3"], ["⁰", "^0"], ["¹", "^1"],
  ["⁴", "^4"], ["⁵", "^5"], ["⁶", "^6"], ["⁷", "^7"], ["⁸", "^8"], ["⁹", "^9"],
  ["₀", "_0"], ["₁", "_1"], ["₂", "_2"], ["₃", "_3"], ["₄", "_4"],
  // Punctuation / dashes / quotes
  ["—", "-"], ["–", "-"], ["…", "..."],
  ["“", '"'], ["”", '"'], ["‘", "'"], ["’", "'"],
  // Other
  ["→", "->"], ["←", "<-"], ["↑", "^"], ["↓", "v"],
  ["°", " deg"],
];

function sanitizeText(s, useUnicodeFont) {
  if (s === null || s === undefined) return "";
  let out = String(s);
  if (!useUnicodeFont) {
    for (const [u, r] of UNICODE_MAP) {
      if (out.indexOf(u) !== -1) out = out.split(u).join(r);
    }
    // Safety fallback: strip any remaining non-ASCII characters to guarantee WinAnsi-safe output.
    return Array.from(out).filter((ch) => ch.charCodeAt(0) <= 0x7F).join("");
  }
  return out;
}

function fmtDate(d) {
  if (!(d instanceof Date)) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function drawHeader(doc, model, pageW, fontFamily, useUnicodeFont) {
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(8);
  doc.setTextColor(60);
  const left = sanitizeText(`${model.title}${model.meta && model.meta.project ? "  -  " + model.meta.project : ""}`, useUnicodeFont);
  doc.text(left, 0.75, 0.5);
  doc.setFont(fontFamily, "normal");
  const page = doc.internal.getCurrentPageInfo().pageNumber;
  const total = doc.internal.getNumberOfPages();
  doc.text(`Page ${page} of ${total}`, pageW - 0.75, 0.5, { align: "right" });
  doc.setDrawColor(150);
  doc.setLineWidth(0.005);
  doc.line(0.75, 0.6, pageW - 0.75, 0.6);
  doc.setTextColor(0);
}

function drawFooter(doc, model, pageW, pageH, fontFamily, useUnicodeFont) {
  doc.setFont(fontFamily, "italic");
  doc.setFontSize(7);
  doc.setTextColor(110);
  const date = fmtDate(model.generatedAt || new Date());
  doc.text(sanitizeText(`Generated ${date} by Weld & Plate Rigidity Check`, useUnicodeFont), pageW / 2, pageH - 0.4, { align: "center" });
  doc.setTextColor(0);
  doc.setFont(fontFamily, "normal");
}

export async function renderPdf(model) {
  const doc = new jsPDF({ unit: "in", format: "letter", orientation: "portrait" });

  let useUnicodeFont = false;
  try {
    if (!cachedRegular) {
      cachedRegular = await loadFontPreferLocal("Roboto-Regular.ttf", "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.72/fonts/Roboto/Roboto-Regular.ttf");
    }
    if (!cachedBold) {
      cachedBold = await loadFontPreferLocal("Roboto-Medium.ttf", "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.72/fonts/Roboto/Roboto-Medium.ttf");
    }
    if (!cachedItalic) {
      cachedItalic = await loadFontPreferLocal("Roboto-Italic.ttf", "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.72/fonts/Roboto/Roboto-Italic.ttf");
    }

    doc.addFileToVFS("Roboto-Regular.ttf", cachedRegular);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");

    doc.addFileToVFS("Roboto-Medium.ttf", cachedBold);
    doc.addFont("Roboto-Medium.ttf", "Roboto", "bold");

    doc.addFileToVFS("Roboto-Italic.ttf", cachedItalic);
    doc.addFont("Roboto-Italic.ttf", "Roboto", "italic");

    useUnicodeFont = true;
  } catch (err) {
    console.warn("Failed to load Unicode font Roboto (local + CDN). Falling back to Helvetica + ASCII sanitization.", err);
  }

  const fontFamily = useUnicodeFont ? "Roboto" : "helvetica";
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 0.75;
  const right = pageW - 0.75;
  const contentW = right - left;

  let y = 0.85;

  // ── Title block ────────────────────────────────────────────────────────
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(16);
  doc.text(sanitizeText(model.title || "Calculation Report", useUnicodeFont), left, y);
  y += 0.28;
  if (model.subtitle) {
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(sanitizeText(model.subtitle, useUnicodeFont), left, y);
    doc.setTextColor(0);
    y += 0.22;
  }

  // Meta line(s)
  const m = model.meta || {};
  const metaParts = [
    m.project ? `Project: ${m.project}` : null,
    m.engineer ? `Engineer: ${m.engineer}` : null,
    m.jobNumber ? `Job #: ${m.jobNumber}` : null,
    m.date ? `Date: ${m.date}` : `Date: ${fmtDate(new Date())}`,
  ].filter(Boolean);
  doc.setFontSize(9);
  doc.text(sanitizeText(metaParts.join("    |    "), useUnicodeFont), left, y);
  y += 0.20;
  doc.setDrawColor(180);
  doc.setLineWidth(0.005);
  doc.line(left, y, right, y);
  y += 0.18;

  // ── Diagram ────────────────────────────────────────────────────────────
  if (model.diagramSvgString) {
    try {
      const { dataUrl, widthPx, heightPx } = await svgToPng(model.diagramSvgString, { scale: 2 });
      const maxW = contentW * 0.55;
      const ratio = heightPx / widthPx;
      const drawW = Math.min(maxW, 3.5);
      const drawH = drawW * ratio;
      const drawX = left + (contentW - drawW) / 2;
      doc.addImage(dataUrl, "PNG", drawX, y, drawW, drawH);
      y += drawH + 0.18;
    } catch (err) {
      // SVG capture is non-fatal — skip silently.
      console.warn("Diagram capture failed:", err);
    }
  }

  // ── Inputs ─────────────────────────────────────────────────────────────
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(12);
  doc.text("Inputs", left, y);
  y += 0.04;

  for (const group of model.inputs || []) {
    autoTable(doc, {
      startY: y + 0.06,
      head: [[sanitizeText(group.group, useUnicodeFont), "Value", "Notes"]],
      body: (group.rows || []).map((r) => [
        sanitizeText(r.label, useUnicodeFont),
        sanitizeText(r.value, useUnicodeFont),
        sanitizeText(r.extra || "", useUnicodeFont)
      ]),
      theme: "plain",
      styles: { font: fontFamily, fontSize: 9, cellPadding: 0.05, textColor: 0, lineColor: [180, 180, 180], lineWidth: 0.005, overflow: "linebreak", valign: "top" },
      headStyles: { font: fontFamily, fontStyle: "bold", fillColor: false, textColor: 0, lineWidth: 0.01 },
      columnStyles: { 0: { cellWidth: 1.9 }, 1: { cellWidth: 1.6 }, 2: { cellWidth: contentW - 3.5 } },
      margin: { left, right: 0.75 },
      tableWidth: contentW,
      pageBreak: "avoid",
    });
    y = doc.lastAutoTable.finalY + 0.10;
    if (y > pageH - 1.2) { doc.addPage(); y = 0.85; }
  }

  // ── Results summary ────────────────────────────────────────────────────
  if (model.results && model.results.length) {
    y += 0.35; // Push y down to prevent overlap with previous table
    if (y > pageH - 2.2) { doc.addPage(); y = 0.85; }
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(12);
    doc.text("Results Summary", left, y);
    autoTable(doc, {
      startY: y + 0.08,
      head: [["Check", "Outcome", "Status"]],
      body: model.results.map((r) => [
        sanitizeText(r.label, useUnicodeFont),
        sanitizeText(r.value, useUnicodeFont),
        r.status === "fail" ? "FAIL" : (r.status === "pass" ? "OK" : "-")
      ]),
      theme: "plain",
      styles: { font: fontFamily, fontSize: 9, cellPadding: 0.05, textColor: 0, lineColor: [180, 180, 180], lineWidth: 0.005, overflow: "linebreak", valign: "top" },
      headStyles: { font: fontFamily, fontStyle: "bold", fillColor: false, textColor: 0, lineWidth: 0.01 },
      columnStyles: { 0: { cellWidth: 2.2 }, 1: { cellWidth: contentW - 3.2 }, 2: { cellWidth: 1.0, halign: "center", fontStyle: "bold" } },
      margin: { left, right: 0.75 },
      tableWidth: contentW,
      pageBreak: "avoid",
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const row = model.results[data.row.index];
          if (row && row.status === "fail") {
            data.cell.styles.textColor = FAIL_RGB;
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
    y = doc.lastAutoTable.finalY + 0.14;
  }

  // ── Detailed calculations ──────────────────────────────────────────────
  if (model.checks && model.checks.length) {
    y += 0.35; // Push y down to prevent overlap with previous table
    if (y > pageH - 2.2) { doc.addPage(); y = 0.85; }
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(12);
    doc.text("Detailed Calculations", left, y);
    y += 0.05;

    for (const c of model.checks) {
      if (y > pageH - 3.2) { doc.addPage(); y = 0.85; }
      doc.setFont(fontFamily, "bold");
      doc.setFontSize(11);
      doc.text(sanitizeText(c.title || "", useUnicodeFont), left, y + 0.18);
      doc.setFont(fontFamily, "italic");
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(sanitizeText(c.codeRef || "", useUnicodeFont), left, y + 0.34);
      doc.setTextColor(0);
      y += 0.48; // Increased from 0.42 to 0.48 to prevent overlap

      // Render brief code description of the check
      const desc = getCheckDescription(c.title);
      if (desc) {
        doc.setFont(fontFamily, "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(90);
        const descLines = doc.splitTextToSize(sanitizeText(desc, useUnicodeFont), contentW);
        doc.text(descLines, left, y + 0.02); // Small baseline offset
        doc.setTextColor(0);
        y += descLines.length * 0.14 + 0.12; // Increased padding after description
      }

      autoTable(doc, {
        startY: y,
        head: [["Step / equation", "Reference", "Value"]],
        body: (c.steps || []).map((s) => [
          sanitizeText(s.eq, useUnicodeFont),
          sanitizeText(s.codeRef, useUnicodeFont),
          sanitizeText(s.value, useUnicodeFont)
        ]),
        theme: "plain",
        styles: { font: fontFamily, fontSize: 9, cellPadding: 0.05, textColor: 0, lineColor: [200, 200, 200], lineWidth: 0.004, overflow: "linebreak", valign: "top" },
        headStyles: { font: fontFamily, fontStyle: "bold", fillColor: false, textColor: 0, lineWidth: 0.008 },
        columnStyles: {
          0: { cellWidth: 3.2 },
          1: { cellWidth: 2.8 },
          2: { cellWidth: contentW - 6.0, halign: "right" },
        },
        margin: { left, right: 0.75 },
        tableWidth: contentW,
        pageBreak: "avoid",
      });
      y = doc.lastAutoTable.finalY + 0.08;

      if (c.statCards && c.statCards.length) {
        autoTable(doc, {
          startY: y,
          body: [c.statCards.map((s) => sanitizeText(`${s.label}: ${s.value}`, useUnicodeFont))],
          theme: "plain",
          styles: { font: fontFamily, fontSize: 9, cellPadding: 0.05, textColor: 0, lineColor: [220, 220, 220], lineWidth: 0.003, overflow: "linebreak", valign: "top" },
          columnStyles: {
            0: { cellWidth: 3.2 },
            1: { cellWidth: 2.8 },
            2: { cellWidth: contentW - 6.0 },
          },
          margin: { left, right: 0.75 },
          tableWidth: contentW,
          pageBreak: "avoid",
        });
        y = doc.lastAutoTable.finalY + 0.06;
      }

      if (c.verdict && c.verdict.status) {
        const isFail = c.verdict.status === "NG";
        doc.setFont(fontFamily, "bold");
        doc.setFontSize(10);
        if (isFail) doc.setTextColor(...FAIL_RGB); else doc.setTextColor(0);
        const dcrPart = (c.verdict.dcr !== null && c.verdict.dcr !== undefined)
          ? `   DCR = ${typeof c.verdict.demand === "number" ? c.verdict.demand.toFixed(2) : c.verdict.demand} / ${typeof c.verdict.cap === "number" ? c.verdict.cap.toFixed(2) : c.verdict.cap} = ${c.verdict.dcr.toFixed(3)}`
          : "";
        y += 0.22; // Push y down to prevent overlap with previous table
        doc.text(sanitizeText(`Status: ${c.verdict.status}   -   ${c.verdict.label}${dcrPart}`, useUnicodeFont), left, y);
        doc.setTextColor(0);
        y += 0.12;
      }
      y += 0.08;
    }
  }

  // ── Warnings ───────────────────────────────────────────────────────────
  if (model.warnings && model.warnings.length) {
    y += 0.35; // Push y down to prevent overlap with previous section
    if (y > pageH - 1.8) { doc.addPage(); y = 0.85; }
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(12);
    doc.text("Warnings", left, y);
    y += 0.20;
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9.5);
    for (const w of model.warnings) {
      const lines = doc.splitTextToSize(sanitizeText(`- ${w}`, useUnicodeFont), contentW);
      doc.text(lines, left, y);
      y += lines.length * 0.16 + 0.04;
      if (y > pageH - 1.0) { doc.addPage(); y = 0.85; }
    }
    y += 0.08;
  }

  // ── References & notes ────────────────────────────────────────────────
  if ((model.references && model.references.length) || (model.notes && model.notes.length)) {
    y += 0.35; // Push y down to prevent overlap with previous section
    if (y > pageH - 2.0) { doc.addPage(); y = 0.85; }
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(12);
    doc.text("Code References & Notes", left, y);
    y += 0.20;

    if (model.references && model.references.length) {
      doc.setFont(fontFamily, "bold");
      doc.setFontSize(10);
      doc.text("References", left, y);
      y += 0.16;
      doc.setFont(fontFamily, "normal");
      doc.setFontSize(9.5);
      for (const r of model.references) {
        const lines = doc.splitTextToSize(sanitizeText(`- ${r}`, useUnicodeFont), contentW);
        doc.text(lines, left, y);
        y += lines.length * 0.16 + 0.02;
        if (y > pageH - 1.0) { doc.addPage(); y = 0.85; }
      }
      y += 0.06;
    }

    if (model.notes && model.notes.length) {
      doc.setFont(fontFamily, "bold");
      doc.setFontSize(10);
      doc.text("Notes & assumptions", left, y);
      y += 0.16;
      doc.setFont(fontFamily, "normal");
      doc.setFontSize(9.5);
      for (const n of model.notes) {
        const lines = doc.splitTextToSize(sanitizeText(`- ${n}`, useUnicodeFont), contentW);
        doc.text(lines, left, y);
        y += lines.length * 0.16 + 0.02;
        if (y > pageH - 1.0) { doc.addPage(); y = 0.85; }
      }
    }
  }

  // ── Symbol Legend & Abbreviations ──────────────────────────────────────
  y += 0.35; // Push y down to prevent overlap with previous section
  if (y > pageH - 3.5) { doc.addPage(); y = 0.85; }
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(12);
  doc.text("Symbol Legend & Abbreviations", left, y);
  autoTable(doc, {
    startY: y + 0.08,
    head: [["Symbol", "Unit", "Description"]],
    body: REPORT_LEGEND.map(([sym, unit, desc]) => [
      sanitizeText(sym, useUnicodeFont),
      sanitizeText(unit, useUnicodeFont),
      sanitizeText(desc, useUnicodeFont)
    ]),
    theme: "plain",
    styles: { font: fontFamily, fontSize: 8.5, cellPadding: 0.04, textColor: 0, lineColor: [200, 200, 200], lineWidth: 0.003, overflow: "linebreak", valign: "top" },
    headStyles: { font: fontFamily, fontStyle: "bold", fillColor: false, textColor: 0, lineWidth: 0.006 },
    columnStyles: {
      0: { cellWidth: 1.0, fontStyle: "bold" },
      1: { cellWidth: 0.8 },
      2: { cellWidth: contentW - 1.8 },
    },
    margin: { left, right: 0.75 },
    tableWidth: contentW,
    pageBreak: "avoid",
  });

  // Apply header + footer to all pages
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    drawHeader(doc, model, pageW, fontFamily, useUnicodeFont);
    drawFooter(doc, model, pageW, pageH, fontFamily, useUnicodeFont);
  }

  const blob = doc.output("blob");
  saveAs(blob, `${reportFileSlug(model)}.pdf`);
}
