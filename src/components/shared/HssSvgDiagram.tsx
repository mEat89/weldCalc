interface HssSvgDiagramProps {
  branch: { B: number; H: number };
  appliedShear?: number;
  appliedTension?: number;
  appliedMip?: number;
  connType?: "hss2plate" | "hss2hss";
}

export default function HssSvgDiagram({
  branch,
  appliedShear = 0,
  appliedTension = 0,
  appliedMip = 0,
  connType = "hss2plate",
}: HssSvgDiagramProps) {
  const B_val = branch.B;
  const H_val = branch.H;
  const hasShear = appliedShear > 0;
  const hasTension = appliedTension > 0;
  const hasMoment = appliedMip > 0;

  const activeColor = "#2563eb";
  const loadColor = "#ef4444";

  if (connType === "hss2hss") {
    return (
      <div className="svg-diagram-container">
        <div className="svg-diagram-title">Group Weld Check — HSS-to-HSS</div>
        <svg className="technical-drawing" width="360" height="175" viewBox="0 0 400 190">
          <rect x="20" y="5" width="360" height="180" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" rx="4" />
          <line x1="200" y1="5" x2="200" y2="185" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />

          <rect x="50" y="125" width="300" height="40" rx="3" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
          <rect x="50" y="130" width="300" height="30" fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
          <text x="60" y="149" className="drawing-dim-text" style={{ fill: "#475569", fontSize: "9px", fontWeight: "700" }}>Chord HSS</text>

          <rect x="150" y="35" width="100" height="90" fill="#f1f5f9" stroke="#1e293b" strokeWidth="3" rx="4" />
          <rect x="156" y="35" width="88" height="90" fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" />
          <text x="200" y="85" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#64748b", fontSize: "9px" }}>Branch</text>

          {/* Entire branch weld group */}
          <path
            d="M 145 125 L 255 125 M 145 125 L 145 115 M 255 125 L 255 115"
            fill="none"
            stroke={activeColor}
            strokeWidth="4"
            strokeLinecap="round"
            className="drawing-weld-line highlighted"
          />

          <text x="35" y="24" textAnchor="start" className="drawing-dim-text" style={{ fontSize: "10px", fill: "#475569" }}>
            Full branch weld group checked
          </text>

          <rect x="120" y="170" width="160" height="12" rx="2" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
          <text x="200" y="179" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#1d4ed8", fontSize: "8px" }}>
            Blue = full weld group
          </text>

          {hasTension && (
            <g>
              <line x1="200" y1="35" x2="200" y2="10" stroke={loadColor} strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
              <text x="208" y="22" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>N</text>
            </g>
          )}

          {hasShear && (
            <g>
              <line x1="200" y1="55" x2="250" y2="55" stroke={loadColor} strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
              <text x="255" y="59" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>V</text>
            </g>
          )}

          {hasMoment && (
            <g>
              <path d="M 175 75 A 25 25 0 0 1 225 75" fill="none" stroke={loadColor} strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
              <text x="200" y="60" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "10px", fontWeight: "700" }}>M_ip</text>
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

  // HSS-to-plate: side/elevation slice at the plate face. Loads are shown as
  // resultants acting at the weld group, not at the end of a member span.
  const plateX = 70;
  const plateY = 55;
  const plateW = 35;
  const plateH = 140;
  const hssX = plateX + plateW;
  const hssY = 88;
  const hssW = 285;
  const hssH = 68;
  const freeEndX = hssX + hssW;
  const hssMidY = hssY + hssH / 2;

  return (
    <div className="svg-diagram-container">
      <div className="svg-diagram-title">Group Weld Check — HSS-to-Plate</div>
      <svg className="technical-drawing" width="520" height="245" viewBox="0 0 560 260">
        <rect x="20" y="10" width="520" height="230" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" rx="6" />

        <line x1="30" y1={hssMidY} x2="525" y2={hssMidY} className="drawing-axis" />

        <rect x={plateX} y={plateY} width={plateW} height={plateH} fill="#cbd5e1" stroke="#475569" strokeWidth="2" rx="3" />
        <rect x={plateX + 6} y={plateY + 8} width={plateW - 12} height={plateH - 16} fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
        <text x={plateX + plateW / 2} y={plateY - 12} textAnchor="middle" className="drawing-dim-text" style={{ fill: "#475569", fontSize: "10px", fontWeight: "700" }}>
          Plate
        </text>

        <rect x={hssX} y={hssY} width={hssW} height={hssH} fill="#f1f5f9" stroke="#1e293b" strokeWidth="3" rx="4" />
        <rect x={hssX + 6} y={hssY + 6} width={hssW - 12} height={hssH - 12} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" rx="3" />
        <text x={hssX + hssW / 2} y={hssMidY + 4} textAnchor="middle" className="drawing-dim-text" style={{ fill: "#64748b", fontSize: "11px", fontWeight: "700" }}>
          HSS member
        </text>

        {/* Weld group is around the HSS perimeter at the plate face. */}
        <line x1={hssX - 2} y1={hssY - 4} x2={hssX - 2} y2={hssY + hssH + 4} stroke={activeColor} strokeWidth="5" strokeLinecap="round" className="drawing-weld-line highlighted" />
        <line x1={hssX - 2} y1={hssY - 4} x2={hssX + 18} y2={hssY - 4} stroke={activeColor} strokeWidth="4" strokeLinecap="round" className="drawing-weld-line highlighted" />
        <line x1={hssX - 2} y1={hssY + hssH + 4} x2={hssX + 18} y2={hssY + hssH + 4} stroke={activeColor} strokeWidth="4" strokeLinecap="round" className="drawing-weld-line highlighted" />

        <text x="40" y="32" textAnchor="start" className="drawing-dim-text" style={{ fontSize: "11px", fill: "#475569", fontWeight: "700" }}>
          Side view slice at plate face
        </text>
        <text x={hssX + 33} y={hssY - 13} textAnchor="start" className="drawing-dim-text" style={{ fill: "#1d4ed8", fontSize: "9px", fontWeight: "700" }}>
          weld group
        </text>

        <line x1={hssX} y1="198" x2={freeEndX} y2="198" className="drawing-dim-line" />
        <line x1={hssX} y1="193" x2={hssX} y2="203" className="drawing-dim-line" />
        <line x1={freeEndX} y1="193" x2={freeEndX} y2="203" className="drawing-dim-line" />
        <text x={hssX + hssW / 2} y="214" textAnchor="middle" className="drawing-dim-text" style={{ fontSize: "10px" }}>
          local member segment shown for orientation
        </text>

        <line x1={hssX + hssW - 18} y1={hssY} x2={hssX + hssW - 18} y2={hssY + hssH} className="drawing-dim-line" />
        <line x1={hssX + hssW - 24} y1={hssY} x2={hssX + hssW - 12} y2={hssY} className="drawing-dim-line" />
        <line x1={hssX + hssW - 24} y1={hssY + hssH} x2={hssX + hssW - 12} y2={hssY + hssH} className="drawing-dim-line" />
        <text x={hssX + hssW - 30} y={hssMidY + 4} textAnchor="end" className="drawing-dim-text" style={{ fontSize: "10px" }}>
          H = {H_val.toFixed(2)}"
        </text>
        <text x={hssX + hssW / 2} y={hssY + hssH + 19} textAnchor="middle" className="drawing-dim-text" style={{ fontSize: "9px", fill: "#64748b" }}>
          B = {B_val.toFixed(2)}" out of view
        </text>

        {hasTension && (
          <g>
            <line x1={hssX - 43} y1={hssMidY} x2={hssX - 6} y2={hssMidY} stroke={loadColor} strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
            <text x={hssX - 55} y={hssMidY + 4} className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "11px", fontWeight: "700" }}>N</text>
          </g>
        )}

        {hasShear && (
          <g>
            <line x1={hssX + 28} y1={hssY - 42} x2={hssX + 28} y2={hssY - 8} stroke={loadColor} strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
            <text x={hssX + 14} y={hssY - 27} textAnchor="middle" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "11px", fontWeight: "700" }}>V</text>
          </g>
        )}

        {hasMoment && (
          <g>
            <path d={`M ${hssX + 42} ${hssMidY - 28} A 31 31 0 1 1 ${hssX + 42} ${hssMidY + 28}`} fill="none" stroke={loadColor} strokeWidth="2.5" markerEnd="url(#arrow-hss)" />
            <text x={hssX + 82} y={hssMidY - 2} textAnchor="start" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "11px", fontWeight: "700" }}>M</text>
            <text x={hssX + 82} y={hssMidY + 12} textAnchor="start" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "8px", fontWeight: "700" }}>bending</text>
          </g>
        )}

        <rect x="330" y="22" width="165" height="16" rx="2" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
        <text x="412" y="33" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#1d4ed8", fontSize: "9px" }}>
          Blue = weld group at plate
        </text>

        <defs>
          <marker id="arrow-hss" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
