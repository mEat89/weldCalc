interface HssSvgDiagramProps {
  selectedFaceDim: "B" | "H";
  branch: { B: number; H: number };
  loadCase: "long" | "trans" | "angle";
  angleDeg: number;
  solicitation?: "shear" | "tension" | "moment";
  connType?: "hss2plate" | "hss2hss";
}

export default function HssSvgDiagram({
  selectedFaceDim,
  branch,
  loadCase,
  angleDeg,
  solicitation = "shear",
  connType = "hss2plate",
}: HssSvgDiagramProps) {
  const isBActive = selectedFaceDim === "B";
  const B_val = branch.B;
  const H_val = branch.H;

  const activeColor = "#2563eb";
  const inactiveColor = "#9ca3af";

  // Render Horizontal Chord and perpendicular vertical Branch HSS for HSS-to-HSS connections
  if (connType === "hss2hss") {
    return (
      <div className="svg-diagram-container">
        <div className="svg-diagram-title">Connection Elevation &amp; Weld Joints</div>
        <svg className="technical-drawing" width="360" height="175" viewBox="0 0 400 190">
          {/* Background Area Grid */}
          <rect x="20" y="5" width="360" height="180" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" rx="4" />

          {/* Dotted axis */}
          <line x1="200" y1="5" x2="200" y2="185" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />

          {/* Horizontal Chord HSS at the bottom */}
          <rect x="50" y="125" width="300" height="40" rx="3" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
          {/* Chord wall thickness dashed line */}
          <rect x="50" y="130" width="300" height="30" fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
          <text x="60" y="149" className="drawing-dim-text" style={{ fill: "#475569", fontSize: "9px", fontWeight: "700" }}>Chord HSS</text>

          {/* Vertical Branch HSS extending from chord top */}
          <rect x="150" y="35" width="100" height="90" fill="#f1f5f9" stroke="#1e293b" strokeWidth="3" rx="4" />
          {/* Branch wall thickness dashed line */}
          <rect x="156" y="35" width="88" height="90" fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" />
          <text x="200" y="85" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#64748b", fontSize: "9px" }}>Branch</text>

          {/* Fillet welds (blue triangles) at branch bottom corners - Face B Transverse Welds */}
          <polygon points="140,125 150,125 150,115" fill={isBActive ? activeColor : inactiveColor} className={`drawing-weld-line ${isBActive ? "highlighted" : ""}`} />
          <polygon points="260,125 250,125 250,115" fill={isBActive ? activeColor : inactiveColor} className={`drawing-weld-line ${isBActive ? "highlighted" : ""}`} />

          {/* Horizontal Weld line at branch bottom edge - Face H Longitudinal Weld */}
          <line x1="150" y1="123" x2="250" y2="123" stroke={!isBActive ? activeColor : inactiveColor} strokeWidth="3.5" className={`drawing-weld-line ${!isBActive ? "highlighted" : ""}`} />

          <text x="35" y="24" textAnchor="start" className="drawing-dim-text" style={{ fontSize: "10px", fill: "#475569" }}>
            HSS-to-HSS Side-Elevation View
          </text>

          {/* Legend indicator */}
          <rect x="130" y="170" width="140" height="12" rx="2" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
          <text x="200" y="179" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#1d4ed8", fontSize: "8px" }}>
            Blue triangles = Fillet Welds
          </text>

          {/* Tension load case */}
          {solicitation === "tension" && (
            <g>
              <line x1="200" y1="35" x2="200" y2="10" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
              <text x="208" y="22" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P (Tension)</text>
            </g>
          )}

          {/* Moment load case */}
          {solicitation === "moment" && (
            <g>
              <path d="M 175 75 A 25 25 0 0 1 225 75" fill="none" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
              <text x="200" y="60" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Moment Mu</text>
            </g>
          )}

          {/* Shear load cases */}
          {solicitation === "shear" && (
            isBActive ? (
              /* Checked face B: weld runs out-of-page */
              loadCase === "long" ? (
                /* Longitudinal load acts parallel to weld = out-of-page */
                <g>
                  <circle cx="200" cy="22" r="7" fill="none" stroke="#ef4444" strokeWidth="2" />
                  <circle cx="200" cy="22" r="2" fill="#ef4444" />
                  <text x="212" y="26" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P (Longitudinal Out-of-Page)</text>
                </g>
              ) : loadCase === "trans" ? (
                /* Transverse load acts perpendicular to weld = horizontal pushing */
                <g>
                  <line x1="200" y1="35" x2="250" y2="35" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
                  <text x="205" y="25" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P (Transverse)</text>
                </g>
              ) : (
                /* Angled */
                <g>
                  <line x1="200" y1="35" x2="235" y2="15" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
                  <text x="195" y="10" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P ({angleDeg}°)</text>
                </g>
              )
            ) : (
              /* Checked face H: weld runs horizontally */
              loadCase === "long" ? (
                /* Longitudinal load acts parallel to weld = horizontal pushing */
                <g>
                  <line x1="200" y1="35" x2="250" y2="35" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
                  <text x="205" y="25" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P (Longitudinal)</text>
                </g>
              ) : loadCase === "trans" ? (
                /* Transverse load acts perpendicular to weld = out-of-page */
                <g>
                  <circle cx="200" cy="22" r="7" fill="none" stroke="#ef4444" strokeWidth="2" />
                  <circle cx="200" cy="22" r="2" fill="#ef4444" />
                  <text x="212" y="26" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P (Transverse Out-of-Page)</text>
                </g>
              ) : (
                /* Angled */
                <g>
                  <line x1="200" y1="35" x2="235" y2="15" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
                  <text x="195" y="10" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P ({angleDeg}°)</text>
                </g>
              )
            )
          )}

          <defs>
            <marker id="arrow-hss" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
            </marker>
          </defs>
        </svg>
      </div>
    );
  }

  // Render Elevation Side-View for tension and bending moment (HSS-to-Plate case)
  if (solicitation === "tension" || solicitation === "moment") {
    return (
      <div className="svg-diagram-container">
        <div className="svg-diagram-title">Connection Elevation &amp; Weld Joints</div>
        <svg className="technical-drawing" width="360" height="175" viewBox="0 0 400 190">
          {/* Background Area Grid */}
          <rect x="20" y="5" width="360" height="180" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" rx="4" />

          {/* Base Plate at bottom */}
          <rect x="50" y="145" width="300" height="20" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
          <text x="60" y="157" className="drawing-dim-text" style={{ fill: "#475569", fontSize: "9px" }}>Plate</text>

          {/* Vertical HSS column profile in side view */}
          <rect x="145" y="35" width="110" height="110" fill="#f1f5f9" stroke="#1e293b" strokeWidth="3" rx="4" />
          
          {/* Wall thickness dashed lines */}
          <rect x="151" y="35" width="98" height="110" fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" />

          {/* Fillet welds on both sides - Face B Transverse Welds */}
          <polygon points="135,145 145,145 145,135" fill={isBActive ? activeColor : inactiveColor} className={`drawing-weld-line ${isBActive ? "highlighted" : ""}`} />
          <polygon points="265,145 255,145 255,135" fill={isBActive ? activeColor : inactiveColor} className={`drawing-weld-line ${isBActive ? "highlighted" : ""}`} />

          {/* Horizontal Weld line at bottom - Face H Longitudinal Weld */}
          <line x1="145" y1="143" x2="255" y2="143" stroke={!isBActive ? activeColor : inactiveColor} strokeWidth="3.5" className={`drawing-weld-line ${!isBActive ? "highlighted" : ""}`} />

          <text x="35" y="28" textAnchor="start" className="drawing-dim-text" style={{ fontSize: "10px", fill: "#475569" }}>
            HSS Side-Elevation View
          </text>

          {/* Blue triangles indicator */}
          <rect x="130" y="170" width="140" height="12" rx="2" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
          <text x="200" y="179" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#1d4ed8", fontSize: "8px" }}>
            Blue triangles = Fillet Welds
          </text>

          {/* Tension load case */}
          {solicitation === "tension" && (
            <g>
              <line x1="200" y1="35" x2="200" y2="12" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
              <text x="208" y="24" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P (Tension)</text>
            </g>
          )}

          {/* Moment load case */}
          {solicitation === "moment" && (
            <g>
              <path d="M 175 75 A 25 25 0 0 1 225 75" fill="none" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
              <text x="200" y="60" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Moment Mu</text>
            </g>
          )}

          <defs>
            <marker id="arrow-hss" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
            </marker>
          </defs>
        </svg>
      </div>
    );
  }

  // Render Top-Down View for shear (HSS-to-Plate case)
  const wBox = 110;
  const hBox = 125;
  const xBox = 145;
  const yBox = 35;

  return (
    <div className="svg-diagram-container">
      <div className="svg-diagram-title">Interactive Connection Interface (Top-Down View)</div>
      <svg className="technical-drawing" width="360" height="175" viewBox="0 0 400 190">
        {/* Background Area Grid */}
        <rect x="20" y="5" width="360" height="180" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" rx="4" />

        {/* Base Plate (gray rectangle behind HSS branch) */}
        <rect x="90" y="25" width="220" height="140" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" rx="6" />
        <text x="100" y="40" className="drawing-dim-text" style={{ fill: "#475569", fontSize: "9px" }}>Plate</text>

        {/* Dotted axis */}
        <line x1="200" y1="5" x2="200" y2="185" className="drawing-axis" />
        <line x1="20" y1="97" x2="380" y2="97" className="drawing-axis" />

        {/* Branch HSS profile (vertical rect) */}
        <rect
          x={xBox}
          y={yBox}
          width={wBox}
          height={hBox}
          fill="none"
          stroke="#1e293b"
          strokeWidth="3.5"
          rx="8"
        />

        {/* Wall thickness inner line */}
        <rect
          x={xBox + 6}
          y={yBox + 6}
          width={wBox - 12}
          height={hBox - 12}
          fill="none"
          stroke="#64748b"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          rx="6"
        />

        {/* Weld lines Face B (Top & Bottom horizontal welds) */}
        <line
          x1={xBox - 5} y1={yBox - 5} x2={xBox + wBox + 5} y2={yBox - 5}
          className={`drawing-weld-line ${isBActive ? "highlighted" : ""}`}
          stroke={isBActive ? activeColor : inactiveColor}
          strokeWidth={isBActive ? "4" : "2"}
        />
        <line
          x1={xBox - 5} y1={yBox + hBox + 5} x2={xBox + wBox + 5} y2={yBox + hBox + 5}
          className={`drawing-weld-line ${isBActive ? "highlighted" : ""}`}
          stroke={isBActive ? activeColor : inactiveColor}
          strokeWidth={isBActive ? "4" : "2"}
        />

        {/* Weld lines Face H (Left & Right vertical welds) */}
        <line
          x1={xBox - 5} y1={yBox - 5} x2={xBox - 5} y2={yBox + hBox + 5}
          className={`drawing-weld-line ${!isBActive ? "highlighted" : ""}`}
          stroke={!isBActive ? activeColor : inactiveColor}
          strokeWidth={!isBActive ? "4" : "2"}
        />
        <line
          x1={xBox + wBox + 5} y1={yBox - 5} x2={xBox + wBox + 5} y2={yBox + hBox + 5}
          className={`drawing-weld-line ${!isBActive ? "highlighted" : ""}`}
          stroke={!isBActive ? activeColor : inactiveColor}
          strokeWidth={!isBActive ? "4" : "2"}
        />

        {/* Dimensions */}
        <line x1={xBox} y1="168" x2={xBox + wBox} y2="168" className="drawing-dim-line" />
        <line x1={xBox} y1="164" x2={xBox} y2="172" className="drawing-dim-line" />
        <line x1={xBox + wBox} y1="164" x2={xBox + wBox} y2="172" className="drawing-dim-line" />
        <text x={xBox + wBox / 2} y="180" textAnchor="middle" className="drawing-dim-text" style={{ fontSize: "10px" }}>
          B = {B_val.toFixed(2)}"
        </text>

        <line x1="275" y1={yBox} x2="275" y2={yBox + hBox} className="drawing-dim-line" />
        <line x1="271" y1={yBox} x2="279" y2={yBox} className="drawing-dim-line" />
        <line x1="271" y1={yBox + hBox} x2="279" y2={yBox + hBox} className="drawing-dim-line" />
        <text x="288" y={yBox + hBox / 2 + 4} textAnchor="start" className="drawing-dim-text" style={{ fontSize: "10px" }}>
          H = {H_val.toFixed(2)}"
        </text>

        {/* Single Red Load Arrow & Label representation */}
        {loadCase === "trans" && (
          isBActive ? (
            /* Transverse on Face B (vertical loads) */
            <g>
              <line x1={xBox + wBox / 2} y1={yBox - 28} x2={xBox + wBox / 2} y2={yBox - 6} stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
              <text x={xBox + wBox / 2 + 6} y={yBox - 17} className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P</text>
            </g>
          ) : (
            /* Transverse on Face H (horizontal loads) */
            <g>
              <line x1={xBox - 32} y1={yBox + hBox / 2} x2={xBox - 6} y2={yBox + hBox / 2} stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
              <text x={xBox - 20} y={yBox + hBox / 2 - 6} textAnchor="middle" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P</text>
            </g>
          )
        )}

        {loadCase === "long" && (
          isBActive ? (
            /* Longitudinal on Face B (horizontal loads) */
            <g>
              <line x1={xBox - 32} y1={yBox + hBox / 2} x2={xBox - 6} y2={yBox + hBox / 2} stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
              <text x={xBox - 20} y={yBox + hBox / 2 - 6} textAnchor="middle" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P</text>
            </g>
          ) : (
            /* Longitudinal on Face H (vertical loads) */
            <g>
              <line x1={xBox + wBox / 2} y1={yBox - 28} x2={xBox + wBox / 2} y2={yBox - 6} stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
              <text x={xBox + wBox / 2 + 6} y={yBox - 17} className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P</text>
            </g>
          )
        )}

        {loadCase === "angle" && (
          <g>
            <line x1={xBox - 25} y1={yBox - 25} x2={xBox - 5} y2={yBox - 5} stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
            <text x={xBox - 24} y={yBox - 27} className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>Load P ({angleDeg}°)</text>
          </g>
        )}

        <defs>
          <marker id="arrow-hss" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
