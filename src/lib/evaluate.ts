import { Board, FeatureExtractor, Color } from '../nnue/features';
import { FeatureTransformer } from '../nnue/feature_transformer';
import { NNUENetwork } from '../nnue/network';

export function evaluateFen(fen: string, network: any, threatTables: any) {
  const board = new Board(fen);
  const sideToMove = fen.split(' ')[1] === 'w' ? Color.WHITE : Color.BLACK;
  
  let pieceCount = 0;
  for (let i = 0; i < 64; i++) if (board.pieces[i] !== null) pieceCount++;
  const bucket = Math.floor((pieceCount - 1) / 4);

  const ka_w = FeatureExtractor.getHalfKAv2Indices(board, Color.WHITE);
  const ka_b = FeatureExtractor.getHalfKAv2Indices(board, Color.BLACK);
  const th_w = FeatureExtractor.getFullThreatsIndices(board, Color.WHITE, threatTables);
  const th_b = FeatureExtractor.getFullThreatsIndices(board, Color.BLACK, threatTables);

  const { transformedFeatures, materialist, rawAccumulators } = FeatureTransformer.transform(
    network.featureTransformer, ka_w.indices, ka_b.indices, th_w.indices, th_b.indices, bucket, sideToMove
  );

  const activations = NNUENetwork.propagate(transformedFeatures, network.buckets[bucket]);
  
  const psqtInternal = Math.trunc(materialist / 16);
  const posInternal = Math.trunc(activations.outputValue / 16);
  const totalInternalUnits = psqtInternal + posInternal;

  // --- Trace the Dominant Point ---
  let maxClippedVal = -1;
  let maxUnclippedVal = -1;
  let maxIdx = -1;

  for (let i = 0; i < 1024; i++) {
    // Determine which perspective array to look at
    const isStm = i < 512;
    const j = i % 512;
    const rawArr = isStm ? rawAccumulators.stm : rawAccumulators.nstm;
    
    const rawX = rawArr[j];
    const rawY = rawArr[j + 512];
    
    // 1. Get the actual network output after SCReLU clamping
    const clippedVal = transformedFeatures[i];

    // 2. Get the pre-clamp product (only if both are positive, otherwise it's 0)
    const unclippedProduct = (rawX > 0 && rawY > 0) ? (rawX * rawY) : 0;

    // Condition A: This node outputs a strictly stronger signal to the next layer
    if (clippedVal > maxClippedVal) {
      maxClippedVal = clippedVal;
      maxUnclippedVal = unclippedProduct;
      maxIdx = i;
    } 
    // Condition B: Both nodes output the same signal (e.g., both hit 127),
    // so we break the tie using the node that has the most raw pressure behind it.
    else if (clippedVal === maxClippedVal && clippedVal > 0) {
      if (unclippedProduct > maxUnclippedVal) {
        maxUnclippedVal = unclippedProduct;
        maxIdx = i;
      }
    }
  }

  let dominantPoint = null;
  if (maxIdx !== -1 && maxClippedVal > 0) {
    const isStm = maxIdx < 512;
    const j = maxIdx % 512;
    // Determine the board perspective for this half of the features
    const domPerspective = isStm ? sideToMove : (sideToMove === Color.WHITE ? Color.BLACK : Color.WHITE);
    
    const ka = domPerspective === Color.WHITE ? ka_w : ka_b;
    const th = domPerspective === Color.WHITE ? th_w : th_b;

    // Helper to find features contributing the highest positive weight
    const getTopFeatures = (accIndex: number) => {
      const list = [];
      for (let i = 0; i < ka.indices.length; i++) {
        const weight = network.featureTransformer.weights[ka.indices[i] * 1024 + accIndex];
        if (weight > 0) list.push({ desc: ka.descriptions[i], weight });
      }
      for (let i = 0; i < th.indices.length; i++) {
        const weight = network.featureTransformer.threatWeights[th.indices[i] * 1024 + accIndex];
        if (weight > 0) list.push({ desc: th.descriptions[i], weight });
      }
      return list.sort((a, b) => b.weight - a.weight).slice(0, 3);
    };

    dominantPoint = {
      j,
      isStm,
      xVal: rawAccumulators[isStm ? 'stm' : 'nstm'][j],
      yVal: rawAccumulators[isStm ? 'stm' : 'nstm'][j + 512],
      xTop: getTopFeatures(j),
      yTop: getTopFeatures(j + 512)
    };
  }

  return { 
    board,
    bucket, 
    psqtInternal, 
    posInternal, 
    totalInternalUnits, 
    pieceCount, 
    features: { ka_w, ka_b, th_w, th_b },
    transformedFeatures,
    rawAccumulators,
    activations,
    dominantPoint
  };
}