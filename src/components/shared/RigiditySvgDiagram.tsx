interface RigiditySvgDiagramProps {
  tp: number;
  Nplate: number;
  column: { H: number; B: number };
  x: number;
  Tu: number;
}

export default function RigiditySvgDiagram({ tp, Nplate, x, Tu }: RigiditySvgDiagramProps) {
  return (
    <div className="svg-diagram-container">
      <div className="svg-diagram-title">Interactive Base Plate Bending & Anchor Tension</div>
      <svg className="technical-drawing" width="360" height="200" viewBox="0 0 400 200">
        {/* Concrete background block */}
        <rect x="20" y="140" width="360" height="50" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" rx="2" />
        <text x="370" y="180" textAnchor="end" className="drawing-dim-text" style={{ fill: "#64748b", fontSize: "9px" }}>Concrete Foundation</text>

        {/* Base plate */}
        <rect x="40" y="110" width="320" height="30" fill="#cbd5e1" stroke="#334155" strokeWidth="2.5" rx="1" />
        <text x="350" y="130" textAnchor="end" className="drawing-dim-text" style={{ fill: "#1e293b", fontWeight: "700" }}>tp = {tp.toFixed(3)}"</text>

        {/* Column HSS side view */}
        <rect x="150" y="20" width="100" height="90" fill="#f1f5f9" stroke="#1e293b" strokeWidth="3" />
        <line x1="156" y1="20" x2="156" y2="110" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="244" y1="20" x2="244" y2="110" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
        <text x="200" y="65" textAnchor="middle" className="drawing-dim-text" style={{ fontSize: "12px", fill: "#0f172a" }}>Column</text>

        {/* Anchor bolt row - left side (Tension side) */}
        <rect x="86" y="85" width="8" height="75" fill="#64748b" stroke="#1e293b" strokeWidth="1" />
        <rect x="80" y="102" width="20" height="8" rx="1" fill="#475569" stroke="#1e293b" strokeWidth="1" />

        {/* Cantilever bending zone highlighted */}
        <rect x="40" y="110" width="110" height="30" fill="#bfdbfe" opacity="0.4" />
        
        {/* Cantilever x dimension line */}
        <line x1="90" y1="15" x2="150" y2="15" className="drawing-dim-line" />
        <line x1="90" y1="11" x2="90" y2="19" className="drawing-dim-line" />
        <line x1="150" y1="11" x2="150" y2="19" className="drawing-dim-line" />
        <text x="120" y="30" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#1e3a8a", fontWeight: "700" }}>
          x = {x.toFixed(2)}"
        </text>

        {/* Tension Force Arrow Tu */}
        {Tu > 0.01 ? (
          <>
            <path d="M 90 80 V 30" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrow)" />
            <text x="90" y="20" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#ef4444", fontWeight: "800" }}>
              Tu = {Tu.toFixed(1)} kips
            </text>
          </>
        ) : (
          <text x="90" y="45" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#22c55e", fontWeight: "700" }}>
            No Tension
          </text>
        )}

        {/* Compression zone under HSS column (bearing block) */}
        <rect x="150" y="140" width="140" height="10" fill="#fecaca" opacity="0.6" stroke="#ef4444" strokeWidth="1" />
        <text x="220" y="162" textAnchor="middle" className="drawing-dim-text" style={{ fill: "#b91c1c", fontSize: "9px" }}>
          Bearing block
        </text>

        {/* Dimension of plate N length */}
        <line x1="40" y1="180" x2="360" y2="180" className="drawing-dim-line" />
        <line x1="40" y1="176" x2="40" y2="184" className="drawing-dim-line" />
        <line x1="360" y1="176" x2="360" y2="184" className="drawing-dim-line" />
        <text x="200" y="194" textAnchor="middle" className="drawing-dim-text">N = {Nplate.toFixed(1)}"</text>

        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
