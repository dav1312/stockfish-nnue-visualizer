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

  const { transformedFeatures, materialist } = FeatureTransformer.transform(
    network.featureTransformer, ka_w, ka_b, th_w, th_b, bucket, sideToMove
  );

  const activations = NNUENetwork.propagate(transformedFeatures, network.buckets[bucket]);
  
  const psqtInternal = Math.trunc(materialist / 16);
  const posInternal = Math.trunc(activations.outputValue / 16);
  const totalInternalUnits = psqtInternal + posInternal;

  return { 
    board,
    bucket, 
    psqtInternal, 
    posInternal, 
    totalInternalUnits, 
    pieceCount, 
    features: { ka_w, ka_b, th_w, th_b },
    transformedFeatures,
    activations
  };
}