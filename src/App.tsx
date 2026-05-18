import React, { useEffect, useState, useMemo } from 'react';
import { Upload, Cpu, Info, Activity, Hash, Layers } from 'lucide-react';
import { NNUEParser } from './nnue/parser';
import { evaluateFen } from './lib/evaluate';
import { Heatmap } from './components/Heatmap';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const PIECE_UNICODE: Record<number, string> = {
  1: '♙', 2: '♘', 3: '♗', 4: '♖', 5: '♕', 6: '♔', // White
  9: '♟', 10: '♞', 11: '♝', 12: '♜', 13: '♛', 14: '♚' // Black
};

function App() {
  const [threatTables, setThreatTables] = useState<any>(null);
  const [network, setNetwork] = useState<any>(null);
  const [fen, setFen] = useState<string>(START_FEN);
  const [loadingMsg, setLoadingMsg] = useState<string | null>("Loading Threat Tables...");

  // Fetch threat tables on load
  useEffect(() => {
    fetch('/threat_tables.json')
      .then(res => res.json())
      .then(data => {
        setThreatTables(data);
        setLoadingMsg(null);
      })
      .catch(err => setLoadingMsg("Error loading threat tables. Please check /public/threat_tables.json"));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingMsg("Parsing .nnue file (this may take a moment)...");
    
    // We use a slight delay so the browser can paint the loading message
    setTimeout(async () => {
      try {
        const buffer = await file.arrayBuffer();
        const parser = new NNUEParser(buffer);
        const parsedNet = parser.parse();
        setNetwork(parsedNet);
        setLoadingMsg(null);
      } catch (err: any) {
        setLoadingMsg(`Error parsing file: ${err.message}`);
      }
    }, 100);
  };

  const evalResult = useMemo(() => {
    if (!network || !threatTables || !fen) return null;
    try {
      return evaluateFen(fen, network, threatTables);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [network, threatTables, fen]);

  if (!threatTables) {
    return <div className="h-screen flex items-center justify-center font-mono text-slate-500">{loadingMsg}</div>;
  }

  return (
    <div className="min-h-screen pb-12">
      {/* HEADER */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cpu className="text-emerald-400" />
            <h1 className="font-bold text-lg tracking-tight">Stockfish NNUE Visualizer <span className="text-emerald-400/80 font-mono text-sm font-normal bg-white/10 px-2 py-0.5 rounded ml-2">SFNNv13</span></h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 space-y-6">
        
        {/* NETWORK UPLOAD & INFO */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {!network ? (
            <div className="p-12 text-center">
              {loadingMsg ? (
                <div className="animate-pulse text-emerald-600 font-medium">{loadingMsg}</div>
              ) : (
                <label className="flex flex-col items-center cursor-pointer group">
                  <div className="h-20 w-20 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                    <Upload size={32} />
                  </div>
                  <h3 className="mt-4 font-semibold text-slate-700 text-lg">Upload Network File</h3>
                  <p className="text-slate-400 text-sm mt-1">Drag & drop or click to select a .nnue file (e.g. nn-83a0d6daf7e5.nnue)</p>
                  <input type="file" accept=".nnue" className="hidden" onChange={handleFileUpload} />
                </label>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-wrap gap-6 items-center text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Info size={16} className="text-slate-400" />
                <span className="font-mono text-xs">{network.description}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Hash size={16} className="text-slate-400" />
                <span className="font-mono text-xs">0x{network.hashValue.toString(16).toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Layers size={16} className="text-slate-400" />
                <span className="font-mono text-xs">{network.buckets.length} Buckets</span>
              </div>
              <button 
                onClick={() => setNetwork(null)}
                className="ml-auto text-xs font-semibold text-rose-500 hover:text-rose-600 px-3 py-1 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
              >
                Unload Network
              </button>
            </div>
          )}
        </section>

        {/* MAIN DASHBOARD */}
        {network && evalResult && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN: Input & Board */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">FEN Position</label>
                <input 
                  type="text" 
                  value={fen} 
                  onChange={(e) => setFen(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                
                {/* Visual Board */}
                <div className="mt-6 aspect-square w-full max-w-[280px] mx-auto grid grid-cols-8 grid-rows-8 border-2 border-slate-800 rounded shadow-md overflow-hidden">
                  {Array.from({length: 64}).map((_, i) => {
                    const r = 7 - Math.floor(i / 8); // top rank is 7 in FEN string visually
                    const c = i % 8;
                    const sq = r * 8 + c;
                    const p = evalResult.board.pieces[sq];
                    const isDark = (r + c) % 2 === 1;
                    return (
                      <div key={sq} className={`flex items-center justify-center text-2xl ${isDark ? 'bg-emerald-600/30' : 'bg-amber-50'}`}>
                        {p && <span className="drop-shadow-md">{PIECE_UNICODE[(p.color === 1 ? 8 : 0) + p.piece]}</span>}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 space-y-2 text-sm">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-slate-500">Active Bucket:</span>
                    <span className="font-mono font-semibold">{evalResult.bucket} (Pieces: {evalResult.pieceCount})</span>
                  </div>
                  <div className="flex flex-col border-b pb-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">PSQ Features:</span>
                      <span className="font-mono font-semibold text-blue-600">
                        {evalResult.features.ka_w.length + evalResult.features.ka_b.length} Total
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 text-right font-mono">
                      ({evalResult.features.ka_w.length} W + {evalResult.features.ka_b.length} B)
                    </span>
                  </div>
                  <div className="flex flex-col border-b pb-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Threat Features:</span>
                      <span className="font-mono font-semibold text-rose-600">
                        {evalResult.features.th_w.length + evalResult.features.th_b.length} Total
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 text-right font-mono">
                      ({evalResult.features.th_w.length} W + {evalResult.features.th_b.length} B)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Network Activations */}
            <div className="lg:col-span-8 space-y-4">
              {/* <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                Network Activations Visualization
              </h2>
              <p className="text-sm text-slate-500">Hover over the grids to see specific tensor values at runtime.</p> */}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* L1: Transformed Features (1024 dims) -> render as 32x32 */}
                <Heatmap 
                  title="Feature Transformer (L1)" 
                  data={evalResult.transformedFeatures} 
                  width={32} height={32} maxVal={127} 
                  isSplit={true}
                />
                
                <div className="flex flex-col gap-4">
                  {/* L2: FC_0 -> SCReLU + CReLU (31 sqr + 31 linear = 62 active dims) */}
                  <div className="flex flex-col gap-1">
                    <Heatmap 
                      title="Hidden Layer 0 (SqrClipped & Clipped)" 
                      data={evalResult.activations.ac_sqr_0_out} 
                      width={31} height={2} maxVal={127} 
                    />
                    <div className="flex justify-between px-1 text-[10px] text-slate-400 font-mono uppercase">
                      <span>Row 1: Squared Activation</span>
                      <span>Row 2: Linear Activation</span>
                    </div>
                  </div>
                  
                  {/* L3: FC_1 -> CReLU (32 dims) */}
                  <Heatmap 
                    title="Hidden Layer 1 (ClippedReLU)" 
                    data={evalResult.activations.ac_1_out} 
                    width={32} height={1} maxVal={127} 
                  />

                  {/* Visualizing skip connection contribution */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mt-auto">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Final Layer Computation</h3>
                    <div className="bg-slate-50 rounded p-3 text-xs font-mono grid grid-cols-2 gap-2 text-slate-600">
                      <div>FC2 Accumulation:</div>
                      <div className="text-right text-slate-800">{evalResult.activations.fc2_out}</div>
                      <div>Skip Connection:</div>
                      <div className="text-right text-slate-800">{evalResult.activations.fwdOut}</div>
                      <div className="col-span-2 border-t mt-1 pt-1 font-bold text-emerald-600 grid grid-cols-2">
                        <div>Sum (Raw Output):</div>
                        <div className="text-right">{evalResult.activations.outputValue}</div>
                      </div>
                    </div>
                  </div>

                  {/* EVALUATION SCORES */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                      <Activity size={16} className="text-emerald-500" /> Internal Scores
                    </h3>
                    <div className="bg-slate-50 rounded p-3 text-xs font-mono grid grid-cols-2 gap-2 text-slate-600">
                      <div>PSQT Base:</div>
                      <div className="text-right text-slate-800">{evalResult.psqtInternal}</div>
                      <div>Positional:</div>
                      <div className="text-right text-slate-800">{evalResult.posInternal}</div>
                      <div className="col-span-2 border-t mt-1 pt-1 font-bold text-emerald-600 grid grid-cols-2">
                        <div>Total Output:</div>
                        <div className="text-right">{evalResult.totalInternalUnits}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

export default App;