import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";
import { reportFileSlug, FAIL_COLOR_HEX } from "./reportModel";
import { svgToPng } from "./svgToPng";

const SANS = "Calibri";
const MONO = "Consolas";

const thinBorders = (() => {
  const b = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
})();

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: opts.spacing || { before: 60, after: 60 },
    children: [new TextRun({
      text: text || "",
      bold: !!opts.bold,
      italics: !!opts.italics,
      color: opts.color || "000000",
      font: opts.font || SANS,
      size: opts.size || 20, // half-points, 20 = 10pt
    })],
  });
}

function heading(text, level = 2) {
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : (level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3),
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, font: SANS, size: level === 1 ? 32 : level === 2 ? 26 : 22, color: "000000" })],
  });
}

function cell(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: undefined,
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({
        text: text || "",
        bold: !!opts.bold,
        color: opts.color || "000000",
        font: opts.font || SANS,
        size: opts.size || 18, // 9pt
      })],
    })],
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

function makeInputsTable(group) {
  const head = new TableRow({
    children: [
      cell(group.group, { bold: true, width: 30 }),
      cell("Value",      { bold: true, width: 25 }),
      cell("Notes",      { bold: true, width: 45 }),
    ],
    tableHeader: true,
  });
  const rows = (group.rows || []).map((r) => new TableRow({
    children: [cell(r.label), cell(r.value), cell(r.extra || "")],
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorders,
    rows: [head, ...rows],
  });
}

function makeResultsTable(results) {
  const head = new TableRow({
    children: [
      cell("Check",   { bold: true, width: 35 }),
      cell("Outcome", { bold: true, width: 50 }),
      cell("Status",  { bold: true, width: 15, align: AlignmentType.CENTER }),
    ],
    tableHeader: true,
  });
  const rows = results.map((r) => {
    const isFail = r.status === "fail";
    const statusText = isFail ? "FAIL" : (r.status === "pass" ? "OK" : "—");
    return new TableRow({
      children: [
        cell(r.label),
        cell(r.value),
        cell(statusText, {
          bold: isFail,
          color: isFail ? FAIL_COLOR_HEX : "000000",
          align: AlignmentType.CENTER,
        }),
      ],
    });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorders,
    rows: [head, ...rows],
  });
}

function makeTraceTable(steps) {
  const head = new TableRow({
    children: [
      cell("Step / equation", { bold: true, width: 50 }),
      cell("Reference",        { bold: true, width: 35 }),
      cell("Value",            { bold: true, width: 15, align: AlignmentType.RIGHT }),
    ],
    tableHeader: true,
  });
  const rows = (steps || []).map((s) => new TableRow({
    children: [
      cell(s.eq, { font: MONO, size: 17 }),
      cell(s.codeRef),
      cell(s.value, { align: AlignmentType.RIGHT }),
    ],
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorders,
    rows: [head, ...rows],
  });
}

function statCardsParagraph(cards) {
  if (!cards || !cards.length) return null;
  const runs = [];
  cards.forEach((s, i) => {
    if (i > 0) runs.push(new TextRun({ text: "   |   ", color: "888888", font: SANS, size: 18 }));
    runs.push(new TextRun({ text: `${s.label}: `, bold: true, font: SANS, size: 18 }));
    runs.push(new TextRun({ text: s.value, font: SANS, size: 18 }));
  });
  return new Paragraph({ spacing: { before: 80, after: 60 }, children: runs });
}

function verdictParagraph(v) {
  if (!v || !v.status) return null;
  const isFail = v.status === "NG";
  const color = isFail ? FAIL_COLOR_HEX : "000000";
  const dcrPart = (v.dcr !== null && v.dcr !== undefined)
    ? `   DCR = ${typeof v.demand === "number" ? v.demand.toFixed(2) : v.demand} / ${typeof v.cap === "number" ? v.cap.toFixed(2) : v.cap} = ${v.dcr.toFixed(3)}`
    : "";
  return new Paragraph({
    spacing: { before: 80, after: 120 },
    children: [
      new TextRun({ text: `Status: ${v.status}`, bold: true, color, font: SANS, size: 22 }),
      new TextRun({ text: `   —   ${v.label}${dcrPart}`, bold: isFail, color, font: SANS, size: 20 }),
    ],
  });
}

function bulletList(items) {
  return items.map((it) => new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text: it, font: SANS, size: 19 })],
  }));
}

export async function renderDocx(model) {
  const children = [];

  // Title block
  children.push(new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: model.title, bold: true, font: SANS, size: 36, color: "000000" })],
  }));
  if (model.subtitle) {
    children.push(new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: model.subtitle, italics: true, color: "555555", font: SANS, size: 20 })],
    }));
  }

  // Meta line
  const m = model.meta || {};
  const metaParts = [
    m.project ? `Project: ${m.project}` : null,
    m.engineer ? `Engineer: ${m.engineer}` : null,
    m.jobNumber ? `Job #: ${m.jobNumber}` : null,
    m.date ? `Date: ${m.date}` : null,
  ].filter(Boolean);
  if (metaParts.length) {
    children.push(new Paragraph({
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: metaParts.join("    |    "), font: SANS, size: 18, color: "333333" })],
    }));
  }

  // Diagram
  if (model.diagramSvgString) {
    try {
      const { dataUrl, widthPx, heightPx } = await svgToPng(model.diagramSvgString, { scale: 2 });
      const base64 = dataUrl.split(",")[1];
      const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
      const ratio = heightPx / widthPx;
      const drawW = 320; // px in docx render — comfortable on Letter page
      const drawH = Math.round(drawW * ratio);
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 200 },
        children: [new ImageRun({ data: bytes, transformation: { width: drawW, height: drawH } })],
      }));
    } catch (err) {
      console.warn("Diagram capture failed:", err);
    }
  }

  // Inputs
  children.push(heading("Inputs", 2));
  for (const group of (model.inputs || [])) {
    children.push(makeInputsTable(group));
    children.push(p("", { spacing: { before: 40, after: 80 } }));
  }

  // Results
  if (model.results && model.results.length) {
    children.push(heading("Results Summary", 2));
    children.push(makeResultsTable(model.results));
    children.push(p("", { spacing: { before: 40, after: 100 } }));
  }

  // Detailed calculations
  if (model.checks && model.checks.length) {
    children.push(heading("Detailed Calculations", 2));
    for (const c of model.checks) {
      children.push(heading(c.title, 3));
      if (c.codeRef) {
        children.push(p(c.codeRef, { italics: true, color: "555555", size: 18, spacing: { before: 0, after: 80 } }));
      }
      children.push(makeTraceTable(c.steps));
      const sc = statCardsParagraph(c.statCards);
      if (sc) children.push(sc);
      const vp = verdictParagraph(c.verdict);
      if (vp) children.push(vp);
    }
  }

  // Warnings
  if (model.warnings && model.warnings.length) {
    children.push(heading("Warnings", 2));
    for (const par of bulletList(model.warnings)) children.push(par);
  }

  // References + Notes
  if ((model.references && model.references.length) || (model.notes && model.notes.length)) {
    children.push(heading("Code References & Notes", 2));
    if (model.references && model.references.length) {
      children.push(heading("References", 3));
      for (const par of bulletList(model.references)) children.push(par);
    }
    if (model.notes && model.notes.length) {
      children.push(heading("Notes & assumptions", 3));
      for (const par of bulletList(model.notes)) children.push(par);
    }
  }

  const doc = new Document({
    creator: "Weld & Plate Rigidity Check",
    title: model.title || "Calculation Report",
    styles: {
      default: { document: { run: { font: SANS, size: 20, color: "000000" } } },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 }, // ~0.75" (twips)
          size: { width: 12240, height: 15840, orientation: undefined }, // US Letter twips
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Page ", font: SANS, size: 16, color: "777777" }),
              new TextRun({ children: [PageNumber.CURRENT], font: SANS, size: 16, color: "777777" }),
              new TextRun({ text: " of ", font: SANS, size: 16, color: "777777" }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: SANS, size: 16, color: "777777" }),
              new TextRun({ text: "   |   Generated by Weld & Plate Rigidity Check", font: SANS, size: 16, italics: true, color: "999999" }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${reportFileSlug(model)}.docx`);
}
