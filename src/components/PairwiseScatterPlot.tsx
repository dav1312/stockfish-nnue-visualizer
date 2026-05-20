import React, { useMemo } from 'react';
import { Star } from 'lucide-react';

interface PairwiseScatterPlotProps {
  stmRaw: Int32Array;
  nstmRaw: Int32Array;
  fixedPerspective: boolean;
  turn: 'w' | 'b';
  title?: string;
  dominantPoint?: any;
}

export const PairwiseScatterPlot: React.FC<PairwiseScatterPlotProps> = ({
  stmRaw,
  nstmRaw,
  fixedPerspective,
  turn,
  title = "Pairwise Pre-SCReLU Scatter",
  dominantPoint
}) => {
  const { stmPoints, nstmPoints, stmColor, nstmColor, stmLabel, nstmLabel, bounds } = useMemo(() => {
    const stm = [];
    const nstm = [];
    
    let minVal = -50;
    let maxVal = 300;

    for (let i = 0; i < 512; i++) {
      const sx = stmRaw[i], sy = stmRaw[i + 512];
      const nx = nstmRaw[i], ny = nstmRaw[i + 512];
      stm.push({ x: sx, y: sy });
      nstm.push({ x: nx, y: ny });
      
      minVal = Math.min(minVal, sx, sy, nx, ny);
      maxVal = Math.max(maxVal, sx, sy, nx, ny);
    }
    
    // Add margin for the axes
    minVal -= 25;
    maxVal += 25;
    const range = maxVal - minVal;
    
    let stmColor = "#10b981"; // Emerald
    let nstmColor = "#3b82f6"; // Blue
    let stmLabel = "Side to Move";
    let nstmLabel = "Not Side to Move";
    
    if (fixedPerspective) {
      if (turn === 'w') {
        // STM = White, NSTM = Black
        stmColor = "#10b981"; // Emerald for White
        nstmColor = "#f43f5e"; // Rose for Black
        stmLabel = "White (STM)";
        nstmLabel = "Black (NSTM)";
      } else {
        // STM = Black, NSTM = White
        stmColor = "#f43f5e"; // Rose for Black
        nstmColor = "#10b981"; // Emerald for White
        stmLabel = "Black (STM)";
        nstmLabel = "White (NSTM)";
      }
    }
    
    return {
      stmPoints: stm,
      nstmPoints: nstm,
      stmColor, nstmColor, stmLabel, nstmLabel,
      bounds: { minVal, maxVal, range }
    };
  }, [stmRaw, nstmRaw, fixedPerspective, turn]);

  // Map values to percentages for the SVG view. SVG Y-axis goes from top to bottom.
  const getX = (val: number) => ((val - bounds.minVal) / bounds.range) * 100;
  const getY = (val: number) => (1 - (val - bounds.minVal) / bounds.range) * 100;

  return (
    <div className="flex flex-col gap-2 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-end mb-1">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="text-xs font-mono text-slate-400">1024 Pairs</span>
      </div>
      
      <div className="relative aspect-square w-full bg-slate-50 border border-slate-200 rounded overflow-hidden cursor-crosshair">
        <svg width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
          
          {/* Active Quadrant Highlight (Top Right) */}
          <rect
            x={`${getX(0)}%`}
            y="0%"
            width={`${100 - getX(0)}%`}
            height={`${getY(0)}%`}
            fill="rgba(16, 185, 129, 0.02)" // Very subtle background for active quadrant
          />

          {/* Active Clipping Region Box [0, 255] */}
          <rect
            x={`${getX(0)}%`}
            y={`${getY(255)}%`} // Top-left of the valid region in inverted Y
            width={`${(255 / bounds.range) * 100}%`}
            height={`${(255 / bounds.range) * 100}%`}
            fill="rgba(16, 185, 129, 0.05)"
            stroke="rgba(16, 185, 129, 0.4)"
            strokeWidth="1"
            strokeDasharray="4"
          />
          
          {/* Axes */}
          <line x1="0%" y1={`${getY(0)}%`} x2="100%" y2={`${getY(0)}%`} stroke="#94a3b8" strokeWidth="1" />
          <line x1={`${getX(0)}%`} y1="0%" x2={`${getX(0)}%`} y2="100%" stroke="#94a3b8" strokeWidth="1" />
          
          {/* Scatter Points (Render NSTM first so STM renders on top) */}
          {nstmPoints.map((p, i) => {
            const isActive = p.x > 0 && p.y > 0;
            return (
              <circle key={`nstm-${i}`} cx={`${getX(p.x)}%`} cy={`${getY(p.y)}%`} r={isActive ? "2.5" : "1.5"} fill={nstmColor} fillOpacity={isActive ? 0.8 : 0.15}>
                <title>NSTM Idx: {i} | Acc[j]: {p.x} | Acc[j+512]: {p.y} {isActive ? "(Active)" : "(Dead = 0)"}</title>
              </circle>
            );
          })}
          {stmPoints.map((p, i) => {
            const isActive = p.x > 0 && p.y > 0;
            return (
              <circle key={`stm-${i}`} cx={`${getX(p.x)}%`} cy={`${getY(p.y)}%`} r={isActive ? "2.5" : "1.5"} fill={stmColor} fillOpacity={isActive ? 0.8 : 0.15}>
                <title>STM Idx: {i} | Acc[j]: {p.x} | Acc[j+512]: {p.y} {isActive ? "(Active)" : "(Dead = 0)"}</title>
              </circle>
            );
          })}

          {/* Dominant Point Marker */}
          {dominantPoint && (
            <circle
              cx={`${getX(dominantPoint.xVal)}%`}
              cy={`${getY(dominantPoint.yVal)}%`}
              r="3"
              fill="#eab308"
            />
          )}
        </svg>

        {/* Labels Overlay */}
        <div className="absolute bottom-1 right-2 text-[10px] font-mono text-slate-400">Acc[j]</div>
        <div className="absolute top-1 left-2 text-[10px] font-mono text-slate-400">Acc[j+512]</div>
        <div className="absolute top-1 right-2 text-[10px] font-mono text-emerald-600 font-bold bg-white/80 px-1 rounded">
          [0, 255] Unclipped Region
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex gap-4 justify-center mt-1">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stmColor, opacity: 0.8 }}></div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stmLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nstmColor, opacity: 0.8 }}></div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{nstmLabel}</span>
        </div>
      </div>

      {/* Dominant Point Attribution Panel */}
      {dominantPoint && (
        <div className="mt-2 pt-3 border-t border-slate-200">
          <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
            <Star size={14} className="text-yellow-500 fill-yellow-500" />
            Dominant Point Attribution (Idx: {dominantPoint.j} / {dominantPoint.isStm ? 'STM' : 'NSTM'})
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-2 rounded border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1 border-b border-slate-200 pb-1">Top X-Axis Drivers</div>
              <ul className="space-y-1">
                {dominantPoint.xTop.map((f: any, i: number) => (
                  <li key={i} className="text-[10px] flex justify-between">
                    <span className="text-slate-700 truncate pr-2" title={f.desc}>{f.desc}</span>
                    <span className="font-mono text-emerald-600">+{f.weight}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-50 p-2 rounded border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1 border-b border-slate-200 pb-1">Top Y-Axis Drivers</div>
              <ul className="space-y-1">
                {dominantPoint.yTop.map((f: any, i: number) => (
                  <li key={i} className="text-[10px] flex justify-between">
                    <span className="text-slate-700 truncate pr-2" title={f.desc}>{f.desc}</span>
                    <span className="font-mono text-emerald-600">+{f.weight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};