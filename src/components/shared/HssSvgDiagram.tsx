interface HssSvgDiagramProps {
  selectedFaceDim: "B" | "H";
  branch: { B: number; H: number };
  loadCase: "long" | "trans" | "angle";
  angleDeg: number;
}

export default function HssSvgDiagram({
  selectedFaceDim,
  branch,
  loadCase,
}: HssSvgDiagramProps) {
  const isBActive = selectedFaceDim === "B";
  const B_val = branch.B;
  const H_val = branch.H;

  const wBox = 160;
  const hBox = 100;
  const xBox = 120;
  const yBox = 50;

  const activeColor = "#2563eb";
  const inactiveColor = "#9ca3af";

  return (
    <div className="svg-diagram-container">
      <div className="svg-diagram-title">Interactive Connection Interface (Top-Down View)</div>
      <svg className="technical-drawing" width="360" height="200" viewBox="0 0 400 200">
        {/* Background area */}
        <rect x="30" y="20" width="340" height="160" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" rx="4" />

        {/* Dotted axis */}
        <line x1="200" y1="10" x2="200" y2="190" className="drawing-axis" />
        <line x1="10" y1="100" x2="390" y2="100" className="drawing-axis" />

        {/* Branch HSS profile */}
        <rect
          x={xBox}
          y={yBox}
          width={wBox}
          height={hBox}
          fill="none"
          stroke="#1e293b"
          strokeWidth="3"
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

        {/* Weld lines Face B */}
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

        {/* Weld lines Face H */}
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
        <line x1={xBox} y1="165" x2={xBox + wBox} y2="165" className="drawing-dim-line" />
        <line x1={xBox} y1="161" x2={xBox} y2="169" className="drawing-dim-line" />
        <line x1={xBox + wBox} y1="161" x2={xBox + wBox} y2="169" className="drawing-dim-line" />
        <text x={xBox + wBox / 2} y="180" textAnchor="middle" className="drawing-dim-text">
          B = {B_val.toFixed(2)}"
        </text>

        <line x1="300" y1={yBox} x2="300" y2={yBox + hBox} className="drawing-dim-line" />
        <line x1="296" y1={yBox} x2="304" y2={yBox} className="drawing-dim-line" />
        <line x1="296" y1={yBox + hBox} x2="304" y2={yBox + hBox} className="drawing-dim-line" />
        <text x="315" y={yBox + hBox / 2 + 4} textAnchor="start" className="drawing-dim-text">
          H = {H_val.toFixed(2)}"
        </text>

        {/* Forces overlay */}
        {loadCase === "long" && (
          <>
            {isBActive ? (
              <>
                <path d={`M ${xBox + 20} ${yBox - 15} L ${xBox + wBox - 20} ${yBox - 15}`} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrow)" />
                <path d={`M ${xBox + wBox - 20} ${yBox + hBox + 15} L ${xBox + 20} ${yBox + hBox + 15}`} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrow)" />
              </>
            ) : (
              <>
                <path d={`M ${xBox - 15} ${yBox + hBox - 15} L ${xBox - 15} ${yBox + 15}`} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrow)" />
                <path d={`M ${xBox + wBox + 15} ${yBox + 15} L ${xBox + wBox + 15} ${yBox + hBox - 15}`} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrow)" />
              </>
            )}
          </>
        )}

        {loadCase === "trans" && (
          <>
            {isBActive ? (
              <>
                <path d={`M ${xBox + wBox / 2} ${yBox - 25} L ${xBox + wBox / 2} ${yBox - 5}`} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrow)" />
                <path d={`M ${xBox + wBox / 2} ${yBox + hBox + 25} L ${xBox + wBox / 2} ${yBox + hBox + 5}`} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrow)" />
              </>
            ) : (
              <>
                <path d={`M ${xBox - 25} ${yBox + hBox / 2} L ${xBox - 5} ${yBox + hBox / 2}`} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrow)" />
                <path d={`M ${xBox + wBox + 25} ${yBox + hBox / 2} L ${xBox + wBox + 5} ${yBox + hBox / 2}`} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrow)" />
              </>
            )}
          </>
        )}

        {loadCase === "angle" && (
          <>
            {isBActive ? (
              <>
                <path d={`M ${xBox + 15} ${yBox - 25} L ${xBox + 40} ${yBox - 5}`} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrow)" />
                <path d={`M ${xBox + wBox - 15} ${yBox + hBox + 25} L ${xBox + wBox - 40} ${yBox + hBox + 5}`} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrow)" />
              </>
            ) : (
              <>
                <path d={`M ${xBox - 25} ${yBox + 15} L ${xBox - 5} ${yBox + 35}`} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrow)" />
                <path d={`M ${xBox + wBox + 25} ${yBox + hBox - 15} L ${xBox + wBox + 5} ${yBox + hBox - 35}`} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrow)" />
              </>
            )}
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
