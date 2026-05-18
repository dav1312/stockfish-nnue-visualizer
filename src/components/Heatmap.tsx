import React, { useMemo } from 'react';

interface HeatmapProps {
  data: Uint8Array | Int32Array;
  width: number;
  height: number;
  title: string;
  maxVal?: number;
  isSplit?: boolean; 
  fixedPerspective?: boolean;
  turn?: 'w' | 'b';
}

export const Heatmap: React.FC<HeatmapProps> = ({ 
  data, 
  width, 
  height, 
  title, 
  maxVal = 255, 
  isSplit = false,
  fixedPerspective = false,
  turn = 'w'
}) => {
  
  // Calculate symmetry metrics and active feature density
  const stats = useMemo(() => {
    const totalDims = data.length;
    
    // Count active features (non-zero values) across the whole dataset
    let activeCount = 0;
    for (let i = 0; i < totalDims; i++) {
      if (data[i] !== 0) {
        activeCount++;
      }
    }

    // Calculate symmetry if this is a split perspective L1 layer
    let symmetryStats = null;
    if (isSplit && totalDims >= 1024) {
      let matches = 0;
      for (let i = 0; i < 512; i++) {
        if (data[i] === data[i + 512]) {
          matches++;
        }
      }
      symmetryStats = {
        matches,
        percentage: ((matches / 512) * 100).toFixed(1)
      };
    }
    
    return {
      symmetry: symmetryStats,
      active: {
        count: activeCount,
        percentage: ((activeCount / totalDims) * 100).toFixed(1)
      },
      totalDims
    };
  }, [data, isSplit]);

  const renderGrid = (sliceStart: number, sliceEnd: number) => (
    <div 
      className="grid gap-[1px] bg-slate-200 p-[1px] rounded"
      style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
    >
      {Array.from(data).slice(sliceStart, sliceEnd).map((val, i) => {
        const absVal = Math.abs(val);
        const opacity = Math.min(1, Math.max(0, absVal / maxVal));
        const isPositive = val >= 0;
        
        return (
          <div 
            key={i} 
            className="aspect-square w-full rounded-sm group relative"
            style={{
              backgroundColor: opacity === 0 ? '#f8fafc' : 
                               isPositive ? `rgba(16, 185, 129, ${opacity})` : 
                                            `rgba(244, 63, 94, ${opacity})`
            }}
          >
            <div className="absolute opacity-0 group-hover:opacity-100 z-10 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-[10px] font-mono text-white bg-slate-800 rounded pointer-events-none whitespace-nowrap">
              Idx: {sliceStart + i} | Val: {val}
            </div>
          </div>
        );
      })}
    </div>
  );

  const splitConfig = useMemo(() => {
    if (!isSplit) return null;

    let topLabel = "Side to Move";
    let bottomLabel = "Not Side to Move";
    let topRange: [number, number] = [0, 512];
    let bottomRange: [number, number] = [512, 1024];

    if (fixedPerspective) {
      topLabel = "Black Perspective";
      bottomLabel = "White Perspective";

      if (turn === 'w') {
        // White is STM (0-512), Black is NSTM (512-1024)
        topRange = [512, 1024]; // Black Top
        bottomRange = [0, 512]; // White Bottom
      } else {
        // Black is STM (0-512), White is NSTM (512-1024)
        topRange = [0, 512];    // Black Top
        bottomRange = [512, 1024]; // White Bottom
      }
    }

    return { topLabel, bottomLabel, topRange, bottomRange };
  }, [isSplit, fixedPerspective, turn]);

  return (
    <div className="flex flex-col gap-2 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-end mb-1">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <div className="flex items-center gap-3">
          {stats.symmetry && (
            <span 
              className="text-xs font-mono text-slate-400 cursor-help"
              title={`${stats.symmetry.matches} out of 512 pairs match perfectly`}
            >
              {stats.symmetry.percentage}% Sym.
            </span>
          )}
          
          {/* Active Features Metric */}
          <span 
            className="text-xs font-mono text-slate-400 cursor-help"
            title={`${stats.active.count} / ${stats.totalDims} active features`}
          >
            {stats.active.percentage}% Active
          </span>

          <span className="text-xs font-mono text-slate-400">{stats.totalDims} Dims</span>
        </div>
      </div>
      
      {isSplit && splitConfig ? (
        <div className="flex flex-col gap-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{splitConfig.topLabel} - 512</div>
          {renderGrid(splitConfig.topRange[0], splitConfig.topRange[1])}
          
          <div className="h-px bg-slate-300 w-full my-2 relative">
             <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white px-2 text-[10px] text-slate-300 font-mono">PERSPECTIVE SPLIT</span>
          </div>
          
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{splitConfig.bottomLabel} - 512</div>
          {renderGrid(splitConfig.bottomRange[0], splitConfig.bottomRange[1])}
        </div>
      ) : (
        renderGrid(0, width * height)
      )}
    </div>
  );
};