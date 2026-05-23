/**
 * Browser-only utility: take an <svg> DOM node (or its serialized string)
 * and return a PNG data URL plus the rasterized dimensions.
 * Used by both the docx and pdf renderers to embed the tab's geometry sketch.
 */
export async function svgToPng(svgNodeOrString, { scale = 2 } = {}) {
  const svgString = typeof svgNodeOrString === "string"
    ? svgNodeOrString
    : new XMLSerializer().serializeToString(svgNodeOrString);

  // Determine intrinsic size from the source SVG when available.
  let width = 400, height = 200;
  if (typeof svgNodeOrString !== "string" && svgNodeOrString instanceof Element) {
    const wAttr = svgNodeOrString.getAttribute("width");
    const hAttr = svgNodeOrString.getAttribute("height");
    if (wAttr) width = parseFloat(wAttr) || width;
    if (hAttr) height = parseFloat(hAttr) || height;
    const vb = svgNodeOrString.getAttribute("viewBox");
    if (vb) {
      const parts = vb.split(/\s+/).map(Number);
      if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
        width = parts[2]; height = parts[3];
      }
    }
  }

  // Make sure the SVG carries an explicit namespace; some hand-rolled
  // diagrams omit it which breaks Image decoding.
  const namespaced = /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svgString)
    ? svgString
    : svgString.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');

  const blob = new Blob([namespaced], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    return { dataUrl, widthPx: canvas.width, heightPx: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Convenience: serialize an svg element to a clean string, suitable for
 * stashing in the report model and later feeding to svgToPng.
 */
export function serializeSvg(svgNode) {
  if (!svgNode) return null;
  try { return new XMLSerializer().serializeToString(svgNode); } catch { return null; }
}
