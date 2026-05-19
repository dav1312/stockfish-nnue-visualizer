import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Upload, Info, Activity, Hash, Layers, RotateCcw } from 'lucide-react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { NNUEParser } from './nnue/parser';
import { evaluateFen } from './lib/evaluate';
import { Heatmap } from './components/Heatmap';
import { PairwiseScatterPlot } from './components/PairwiseScatterPlot';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function App() {
  const [threatTables, setThreatTables] = useState<any>(null);
  const [network, setNetwork] = useState<any>(null);
  const [loadingMsg, setLoadingMsg] = useState<string | null>("Loading resources...");
  const [fixedPerspective, setFixedPerspective] = useState(false);
  const [l1ViewMode, setL1ViewMode] = useState<'heatmap' | 'scatter'>('heatmap');
  
  // Ref to prevent double-fetching in React 18 StrictMode
  const hasFetched = useRef(false);

  // Game state for logical moves and FEN sync
  const [game, setGame] = useState(new Chess(START_FEN));
  const [fenText, setFenText] = useState(START_FEN);

  // Fetch Threat Tables & Default NNUE on mount
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    async function loadInitialData() {
      try {
        setLoadingMsg("Loading Threat Tables...");
        const threatsRes = await fetch(`${import.meta.env.BASE_URL}threat_tables.json`);
        if (!threatsRes.ok) throw new Error("Could not load threat tables.");
        setThreatTables(await threatsRes.json());

        setLoadingMsg("Loading Default Neural Network...");
        try {
          // Adjust this filename to match the network you put in /public
          const nnueRes = await fetch(`${import.meta.env.BASE_URL}nn-83a0d6daf7e5.nnue`);
          if (nnueRes.ok) {
            const buffer = await nnueRes.arrayBuffer();
            const parser = new NNUEParser(buffer);
            setNetwork(parser.parse());
          }
        } catch (e) {
          console.warn("Default NNUE not found or failed to parse. User can upload manually.");
        }
        
        setLoadingMsg(null);
      } catch (err: any) {
        setLoadingMsg(err.message);
      }
    }
    loadInitialData();
  }, []);

  // Handle Manual File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingMsg("Parsing .nnue file (this may take a moment)...");
    setTimeout(async () => {
      try {
        const buffer = await file.arrayBuffer();
        const parser = new NNUEParser(buffer);
        setNetwork(parser.parse());
        setLoadingMsg(null);
      } catch (err: any) {
        setLoadingMsg(`Error parsing file: ${err.message}`);
      }
    }, 100);
  };

  // Chess logic: Handle Drag and Drop move 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onDrop = ({ sourceSquare, targetSquare, piece: _piece }: any) => {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // Always promote to queen for simplicity
      });

      // If invalid move, snap back
      if (move === null) return false;

      // Update states if valid
      const newFen = game.fen();
      setGame(new Chess(newFen));
      setFenText(newFen);
      return true;
    } catch (e) {
      return false; // Invalid move
    }
  };

  // Chess logic: Handle text input FEN change
  const handleFenTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFen = e.target.value;
    setFenText(newFen);
    try {
      // Validate FEN by loading it into chess.js
      const newGame = new Chess(newFen);
      setGame(newGame);
    } catch (e) {
      // Invalid FEN typed (user is halfway through typing), don't update board yet
    }
  };

  const handleReset = () => {
    const newGame = new Chess(START_FEN);
    setGame(newGame);
    setFenText(START_FEN);
  };

  const evalResult = useMemo(() => {
    if (!network || !threatTables || !game.fen()) return null;
    try {
      return evaluateFen(game.fen(), network, threatTables);
    } catch (e) {
      return null;
    }
  }, [network, threatTables, game.fen()]);

  if (!threatTables) {
    return <div className="h-screen flex items-center justify-center font-mono text-slate-500">{loadingMsg}</div>;
  }

  return (
    <div className="min-h-screen pb-12">
      {/* HEADER */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="Logo" className="h-8 w-8" />
            <h1 className="font-bold text-lg tracking-tight inline-flex items-center gap-2">
              Stockfish NNUE Visualizer 
              <span className="text-emerald-400/80 font-mono text-sm font-normal bg-white/10 px-2 py-0.5 rounded">SFNNv14</span>
            </h1>
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
                  <p className="text-slate-400 text-sm mt-1">Drag & drop or click to select a .nnue file.</p>
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
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={fenText} 
                    onChange={handleFenTextChange}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <button
                    onClick={handleReset}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md border border-slate-200 transition-colors"
                    title="Reset to starting position"
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
                
                {/* Interactive Visual Board (Updated for v5 'options' prop) */}
                <div className="mt-6 w-full max-w-[320px] mx-auto rounded shadow-md overflow-hidden">
                  <Chessboard 
                    options={{
                      position: game.fen(),
                      onPieceDrop: onDrop
                    }}
                  />
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    Network Activations Visualization
                  </h2>
                  <p className="text-sm text-slate-500">Play a move on the board to see how the hidden layers react.</p>
                </div>
                <div className="flex items-center gap-3 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Perspective:</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={fixedPerspective}
                      onChange={() => setFixedPerspective(!fixedPerspective)}
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    <span className="ml-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider">{fixedPerspective ? "Fixed (B/W)" : "Relative (STM)"}</span>
                  </label>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left side of Activations (L1 Dual View) */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-end">
                    <div className="flex bg-slate-200/60 p-0.5 rounded-lg border border-slate-200/50 shadow-inner">
                      <button
                        onClick={() => setL1ViewMode('heatmap')}
                        className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all ${
                          l1ViewMode === 'heatmap' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Heatmap
                      </button>
                      <button
                        onClick={() => setL1ViewMode('scatter')}
                        className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all ${
                          l1ViewMode === 'scatter' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Scatter Plot
                      </button>
                    </div>
                  </div>

                  {l1ViewMode === 'heatmap' ? (
                    <Heatmap 
                      title="Feature Transformer (L1)" 
                      data={evalResult.transformedFeatures} 
                      width={32} height={32} maxVal={127} 
                      isSplit={true}
                      fixedPerspective={fixedPerspective}
                      turn={game.turn()}
                    />
                  ) : (
                    <PairwiseScatterPlot
                      stmRaw={evalResult.rawAccumulators.stm}
                      nstmRaw={evalResult.rawAccumulators.nstm}
                      fixedPerspective={fixedPerspective}
                      turn={game.turn()}
                    />
                  )}
                </div>
                
                {/* Right side of Activations (Deeper layers and scores) */}
                <div className="flex flex-col gap-4">
                  {/* L2: FC_0 -> SCReLU + CReLU (31 sqr + 31 linear = 62 active dims) */}
                  <div className="flex flex-col gap-1 mt-[34px]"> {/* Match height of the toggle above */}
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