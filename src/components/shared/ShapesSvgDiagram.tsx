interface ShapesSvgDiagramProps {
  shape: { id: string };
  loadCase: "long" | "trans" | "angle";
  angleDeg: number;
  view?: "elevation" | "top";
  p2pType?: "tjoint" | "lapjoint";
}

export default function ShapesSvgDiagram({ shape, loadCase, angleDeg, view = "elevation", p2pType = "tjoint" }: ShapesSvgDiagramProps) {
  const activePreset = shape.id;
  const highlightColor = "#2563eb";

  if (view === "top") {
    // Render top-down view showing base/gusset plate, profile section, and load arrow rotation
    const rotAngle = loadCase === "long" ? 0 : loadCase === "trans" ? 90 : angleDeg;

    return (
      <div className="svg-diagram-container">
        <div className="svg-diagram-title">Connection Top-Down View &amp; Weld Lines</div>
        <svg className="technical-drawing" width="360" height="175" viewBox="0 0 400 190">
          {/* Main Base/Gusset Plate */}
          <rect x="70" y="20" width="260" height="140" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" rx="6" />
          <text x="80" y="35" className="drawing-dim-text" style={{ fill: "#64748b", fontSize: "9px" }}>Plate</text>

          {/* Preset Profile Cross Sections */}
          {activePreset === "i2plate" && (
            <>
              {/* I-shape Top View */}
              <rect x="140" y="55" width="120" height="8" fill="#f1f5f9" stroke="#334155" strokeWidth="1.5" />
              <rect x="140" y="117" width="120" height="8" fill="#f1f5f9" stroke="#334155" strokeWidth="1.5" />
              <rect x="196" y="63" width="8" height="54" fill="#f1f5f9" stroke="#334155" strokeWidth="1.5" />

              {/* Weld Lines along outer flanges */}
              <line x1="140" y1="50" x2="260" y2="50" stroke={highlightColor} strokeWidth="3.5" className="drawing-weld-line highlighted" />
              <line x1="140" y1="130" x2="260" y2="130" stroke={highlightColor} strokeWidth="3.5" className="drawing-weld-line highlighted" />
            </>
          )}

          {activePreset === "l2plate" && (
            <>
              {/* L-Angle Top View */}
              <rect x="140" y="86" width="120" height="8" fill="#f1f5f9" stroke="#334155" strokeWidth="1.5" />
              <rect x="140" y="50" width="8" height="36" fill="#f1f5f9" stroke="#334155" strokeWidth="1.5" />

              {/* Weld Lines along horizontal leg edges */}
              <line x1="140" y1="98" x2="260" y2="98" stroke={highlightColor} strokeWidth="3.5" className="drawing-weld-line highlighted" />
              <line x1="148" y1="80" x2="260" y2="80" stroke={highlightColor} strokeWidth="3.5" className="drawing-weld-line highlighted" />
            </>
          )}

          {activePreset === "c2plate" && (
            <>
              {/* Channel Top View */}
              <rect x="140" y="60" width="8" height="60" fill="#f1f5f9" stroke="#334155" strokeWidth="1.5" />
              <rect x="148" y="60" width="112" height="8" fill="#f1f5f9" stroke="#334155" strokeWidth="1.5" />
              <rect x="148" y="112" width="112" height="8" fill="#f1f5f9" stroke="#334155" strokeWidth="1.5" />

              {/* Weld Lines along outer flanges */}
              <line x1="148" y1="55" x2="260" y2="55" stroke={highlightColor} strokeWidth="3.5" className="drawing-weld-line highlighted" />
              <line x1="148" y1="125" x2="260" y2="125" stroke={highlightColor} strokeWidth="3.5" className="drawing-weld-line highlighted" />
            </>
          )}

          {activePreset === "p2p" && (
            p2pType === "tjoint" ? (
              <>
                {/* T-Joint (Perpendicular standing plate) Top View (Thin Cross Section) */}
                <rect x="150" y="86" width="100" height="8" fill="#f1f5f9" stroke="#334155" strokeWidth="1.5" />

                {/* Horizontal Weld Lines above and below the thin plate section */}
                <line x1="150" y1="81" x2="250" y2="81" stroke={highlightColor} strokeWidth="3.5" className="drawing-weld-line highlighted" />
                <line x1="150" y1="99" x2="250" y2="99" stroke={highlightColor} strokeWidth="3.5" className="drawing-weld-line highlighted" />
              </>
            ) : (
              <>
                {/* Lap joint flat overlapping plate Top View (Large Face Area) */}
                <rect x="150" y="50" width="100" height="80" fill="#f1f5f9" stroke="#334155" strokeWidth="1.5" />

                {/* Vertical Weld Lines along overlapping side edges */}
                <line x1="145" y1="50" x2="145" y2="130" stroke={highlightColor} strokeWidth="3.5" className="drawing-weld-line highlighted" />
                <line x1="255" y1="50" x2="255" y2="130" stroke={highlightColor} strokeWidth="3.5" className="drawing-weld-line highlighted" />
              </>
            )
          )}

          {/* Synchronized load arrow rotating relative to center of branch section */}
          <g transform={`rotate(${rotAngle}, 200, 90)`}>
            <line x1="200" y1="90" x2="265" y2="90" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-shapes-top)" />
            <text x="272" y="93" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P</text>
          </g>

          <defs>
            <marker id="arrow-shapes-top" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
            </marker>
          </defs>
        </svg>
      </div>
    );
  }

  // Render Elevation/Section View (default) with snapped elements (fixing flying profile gaps)
  return (
    <div className="svg-diagram-container">
      <div className="svg-diagram-title">Connection Elevation &amp; Weld Joints</div>
      <svg className="technical-drawing" width="360" height="175" viewBox="0 0 400 200">
        <rect x="20" y="5" width="360" height="190" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" rx="4" />

        {activePreset === "i2plate" && (
          <>
            {/* Connected Plate (snapped flat, no gap!) */}
            <rect x="50" y="155" width="300" height="20" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
            <text x="60" y="167" className="drawing-dim-text" style={{ fill: "#475569", fontSize: "9px" }}>Plate</text>

            {/* Snapped I-section Profile */}
            <rect x="194" y="70" width="12" height="75" fill="#f1f5f9" stroke="#334155" strokeWidth="2" />
            <rect x="130" y="60" width="140" height="10" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />
            <rect x="130" y="145" width="140" height="10" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />

            {/* Weld Fillets perfectly snapped onto plate surface */}
            <polygon points="120,155 130,155 130,145" fill={highlightColor} className="drawing-weld-line highlighted" />
            <line x1="125" y1="155" x2="125" y2="145" stroke={highlightColor} strokeWidth="2.5" />
            <polygon points="280,155 270,155 270,145" fill={highlightColor} className="drawing-weld-line highlighted" />
            <line x1="275" y1="155" x2="275" y2="145" stroke={highlightColor} strokeWidth="2.5" />

            <text x="35" y="32" textAnchor="start" className="drawing-dim-text" style={{ fontSize: "10px", fill: "#475569" }}>
              I-shape Flange (Double-Fillet Joint)
            </text>
          </>
        )}

        {activePreset === "l2plate" && (
          <>
            {/* Connected Plate */}
            <rect x="50" y="155" width="300" height="20" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
            <text x="60" y="167" className="drawing-dim-text" style={{ fill: "#475569", fontSize: "9px" }}>Plate</text>

            {/* Snapped L-Angle Profile */}
            <rect x="130" y="145" width="120" height="10" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />
            <rect x="130" y="70" width="15" height="75" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />

            {/* Welds */}
            <polygon points="260,155 250,155 250,145" fill={highlightColor} className="drawing-weld-line highlighted" />
            <polygon points="120,155 130,155 130,145" fill={highlightColor} className="drawing-weld-line highlighted" />

            <text x="35" y="32" textAnchor="start" className="drawing-dim-text" style={{ fontSize: "10px", fill: "#475569" }}>
              L-Angle (Lap/Gusset Joint)
            </text>
          </>
        )}

        {activePreset === "c2plate" && (
          <>
            {/* Connected Plate */}
            <rect x="50" y="155" width="300" height="20" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
            <text x="60" y="167" className="drawing-dim-text" style={{ fill: "#475569", fontSize: "9px" }}>Plate</text>

            {/* Snapped Channel Profile */}
            <rect x="130" y="145" width="140" height="10" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />
            <rect x="130" y="70" width="14" height="75" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />
            <rect x="256" y="70" width="14" height="75" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />

            {/* Welds */}
            <polygon points="120,155 130,155 130,145" fill={highlightColor} className="drawing-weld-line highlighted" />
            <polygon points="280,155 270,155 270,145" fill={highlightColor} className="drawing-weld-line highlighted" />

            <text x="35" y="32" textAnchor="start" className="drawing-dim-text" style={{ fontSize: "10px", fill: "#475569" }}>
              Channel base-plate connection
            </text>
          </>
        )}

        {activePreset === "p2p" && (
          p2pType === "tjoint" ? (
            <>
              {/* Bottom Plate */}
              <rect x="50" y="145" width="300" height="20" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
              <text x="60" y="157" className="drawing-dim-text" style={{ fill: "#475569", fontSize: "9px" }}>Plate</text>

              {/* Top Plate standing vertical */}
              <rect x="150" y="75" width="100" height="70" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />

              {/* Welds */}
              <polygon points="140,145 150,145 150,135" fill={highlightColor} className="drawing-weld-line highlighted" />
              <polygon points="260,145 250,145 250,135" fill={highlightColor} className="drawing-weld-line highlighted" />

              <text x="35" y="32" textAnchor="start" className="drawing-dim-text" style={{ fontSize: "10px", fill: "#475569" }}>
                T-Joint (Perpendicular Plate to Plate)
              </text>
            </>
          ) : (
            <>
              {/* Bottom Plate (Left Flat) */}
              <rect x="50" y="145" width="200" height="20" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
              <text x="60" y="157" className="drawing-dim-text" style={{ fill: "#475569", fontSize: "9px" }}>Plate</text>

              {/* Top Plate (Right Flat, Overlapping) */}
              <rect x="150" y="125" width="200" height="20" fill="#f1f5f9" stroke="#334155" strokeWidth="2" rx="1" />

              {/* Welds at both overlapping edges */}
              <polygon points="140,145 150,145 150,135" fill={highlightColor} className="drawing-weld-line highlighted" />
              <polygon points="250,145 260,145 250,155" fill={highlightColor} className="drawing-weld-line highlighted" />

              <text x="35" y="32" textAnchor="start" className="drawing-dim-text" style={{ fontSize: "10px", fill: "#475569" }}>
                Lap Joint (Flat Plate to Plate)
              </text>
            </>
          )
        )}

        <rect x="130" y="177" width="140" height="16" rx="3" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
        <text x="200" y="189" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#1d4ed8", fontSize: "9px" }}>
          Blue triangles = Fillet Welds
        </text>

        {/* Synchronized load arrow representing the force vector acting on the member */}
        {loadCase === "long" && (
          <g>
            <line x1="60" y1="105" x2="125" y2="105" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-shapes-elev)" />
            <text x="75" y="97" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P</text>
          </g>
        )}
        {loadCase === "trans" && (
          <g>
            <line x1="200" y1="12" x2="200" y2="52" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-shapes-elev)" />
            <text x="208" y="32" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P</text>
          </g>
        )}
        {loadCase === "angle" && (
          <g>
            <line x1="70" y1="65" x2="115" y2="90" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-shapes-elev)" />
            <text x="95" y="70" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P</text>
          </g>
        )}

        <defs>
          <marker id="arrow-shapes-elev" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
