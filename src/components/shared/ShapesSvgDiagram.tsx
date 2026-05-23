interface ShapesSvgDiagramProps {
  shape: { id: string };
  loadCase: "long" | "trans" | "angle";
  angleDeg: number;
}

export default function ShapesSvgDiagram({ shape, loadCase, angleDeg }: ShapesSvgDiagramProps) {
  const activePreset = shape.id;
  const highlightColor = "#2563eb";

  return (
    <div className="svg-diagram-container">
      <div className="svg-diagram-title">Interactive Configuration & Weld Path</div>
      <svg className="technical-drawing" width="360" height="200" viewBox="0 0 400 200">
        <rect x="20" y="15" width="360" height="170" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" rx="4" />

        {activePreset === "i2plate" && (
          <>
            <rect x="50" y="140" width="300" height="20" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
            <rect x="194" y="30" width="12" height="70" fill="#f1f5f9" stroke="#334155" strokeWidth="2" />
            <rect x="130" y="20" width="140" height="10" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />
            <rect x="130" y="100" width="140" height="12" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />

            <polygon points="120,140 130,140 130,128" fill={highlightColor} className="drawing-weld-line highlighted" />
            <line x1="125" y1="140" x2="125" y2="128" stroke={highlightColor} strokeWidth="2.5" />
            <polygon points="280,140 270,140 270,128" fill={highlightColor} className="drawing-weld-line highlighted" />
            <line x1="275" y1="140" x2="275" y2="128" stroke={highlightColor} strokeWidth="2.5" />

            <text x="200" y="15" textAnchor="middle" className="drawing-dim-text" style={{ fontSize: "10px" }}>
              I-shape Flange (Double-Fillet Joint)
            </text>
          </>
        )}

        {activePreset === "l2plate" && (
          <>
            <rect x="60" y="130" width="280" height="30" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
            <rect x="130" y="115" width="120" height="15" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />
            <rect x="130" y="30" width="15" height="85" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />

            <polygon points="258,130 250,130 250,120" fill={highlightColor} className="drawing-weld-line highlighted" />
            <polygon points="145,115 145,130 155,130" fill={highlightColor} className="drawing-weld-line highlighted" />

            <text x="200" y="15" textAnchor="middle" className="drawing-dim-text" style={{ fontSize: "10px" }}>
              L-Angle welded to plate (Heel &amp; Toe welds)
            </text>
          </>
        )}

        {activePreset === "c2plate" && (
          <>
            <rect x="50" y="140" width="300" height="20" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
            <rect x="130" y="30" width="14" height="110" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />
            <rect x="144" y="30" width="90" height="12" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />
            <rect x="144" y="128" width="90" height="12" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />

            <polygon points="120,140 130,140 130,128" fill={highlightColor} className="drawing-weld-line highlighted" />
            <polygon points="244,140 234,140 234,128" fill={highlightColor} className="drawing-weld-line highlighted" />

            <text x="200" y="15" textAnchor="middle" className="drawing-dim-text" style={{ fontSize: "10px" }}>
              Channel flange/web connection
            </text>
          </>
        )}

        {activePreset === "p2p" && (
          <>
            <rect x="50" y="110" width="280" height="20" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
            <rect x="130" y="60" width="200" height="20" rx="2" fill="#f1f5f9" stroke="#334155" strokeWidth="2" />

            <polygon points="130,110 130,80 115,110" fill={highlightColor} className="drawing-weld-line highlighted" />
            <polygon points="330,110 330,80 345,110" fill={highlightColor} className="drawing-weld-line highlighted" />

            <text x="200" y="15" textAnchor="middle" className="drawing-dim-text" style={{ fontSize: "10px" }}>
              Lap Joint (Plate to Plate)
            </text>
          </>
        )}

        <rect x="130" y="155" width="140" height="16" rx="3" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
        <text x="200" y="167" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#1d4ed8", fontSize: "10px" }}>
          Blue triangles = Fillet Welds
        </text>

        {loadCase === "long" && (
          <>
            <path d="M 50 80 H 120" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow)" />
            <text x="40" y="75" className="drawing-dim-text" style={{ fill: "#b91c1c" }}>Longitudinal Force</text>
          </>
        )}
        {loadCase === "trans" && (
          <>
            <path d="M 200 175 V 150" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow)" />
            <text x="200" y="187" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#b91c1c" }}>Transverse Force</text>
          </>
        )}
        {loadCase === "angle" && (
          <>
            <path d="M 60 40 L 110 70" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow)" />
            <text x="50" y="32" className="drawing-dim-text" style={{ fill: "#b91c1c" }}>Angled Force ({angleDeg}°)</text>
          </>
        )}

        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
