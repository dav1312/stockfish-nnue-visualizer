export enum Color { WHITE = 0, BLACK = 1 }
export enum PieceType { PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6 }

export class Board {
  pieces: Array<{ piece: PieceType, color: Color } | null> = new Array(64).fill(null);
  whiteKing: number = -1;
  blackKing: number = -1;

  constructor(fen: string) {
    const [boardPart] = fen.split(' ');
    let sq = 56;
    for (const char of boardPart) {
      if (char === '/') {
        sq -= 16;
      } else if (/\d/.test(char)) {
        sq += parseInt(char, 10);
      } else {
        const color = char === char.toUpperCase() ? Color.WHITE : Color.BLACK;
        const pt = 'PNBRQK'.indexOf(char.toUpperCase()) + 1 as PieceType;
        this.pieces[sq] = { piece: pt, color };
        if (pt === PieceType.KING) {
          if (color === Color.WHITE) this.whiteKing = sq;
          else this.blackKing = sq;
        }
        sq++;
      }
    }
  }

  static makePiece(color: Color, pt: PieceType) {
    return (color === Color.BLACK ? 8 : 0) + pt;
  }
}

export class FeatureExtractor {
  // HalfKA uses 7 for A-D, 0 for E-H
  static OrientTBL_HalfKA = [
    7, 7, 7, 7, 0, 0, 0, 0,
    7, 7, 7, 7, 0, 0, 0, 0,
    7, 7, 7, 7, 0, 0, 0, 0,
    7, 7, 7, 7, 0, 0, 0, 0,
    7, 7, 7, 7, 0, 0, 0, 0,
    7, 7, 7, 7, 0, 0, 0, 0,
    7, 7, 7, 7, 0, 0, 0, 0,
    7, 7, 7, 7, 0, 0, 0, 0
  ];

  // FullThreats uses 0 for A-D, 7 for E-H
  static OrientTBL_Threats = [
    0, 0, 0, 0, 7, 7, 7, 7,
    0, 0, 0, 0, 7, 7, 7, 7,
    0, 0, 0, 0, 7, 7, 7, 7,
    0, 0, 0, 0, 7, 7, 7, 7,
    0, 0, 0, 0, 7, 7, 7, 7,
    0, 0, 0, 0, 7, 7, 7, 7,
    0, 0, 0, 0, 7, 7, 7, 7,
    0, 0, 0, 0, 7, 7, 7, 7
  ];

  static PieceSquareIndex = [
    [0, 0, 128, 256, 384, 512, 640, 0, 0, 64, 192, 320, 448, 576, 640, 0],
    [0, 64, 192, 320, 448, 576, 640, 0, 0, 0, 128, 256, 384, 512, 640, 0]
  ];

  static KingBuckets = [
    19712, 20416, 21120, 21824, 21824, 21120, 20416, 19712,
    16896, 17600, 18304, 19008, 19008, 18304, 17600, 16896,
    14080, 14784, 15488, 16192, 16192, 15488, 14784, 14080,
    11264, 11968, 12672, 13376, 13376, 12672, 11968, 11264,
     8448,  9152,  9856, 10560, 10560,  9856,  9152,  8448,
     5632,  6336,  7040,  7744,  7744,  7040,  6336,  5632,
     2816,  3520,  4224,  4928,  4928,  4224,  3520,  2816,
        0,   704,  1408,  2112,  2112,  1408,   704,     0
  ];

  static getHalfKAv2Indices(board: Board, perspective: Color): number[] {
    const active: number[] = [];
    const ksq = perspective === Color.WHITE ? board.whiteKing : board.blackKing;
    const flip = perspective === Color.BLACK ? 56 : 0;

    for (let s = 0; s < 64; s++) {
      const p = board.pieces[s];
      if (p) {
        const pc = Board.makePiece(p.color, p.piece);
        const index = (s ^ FeatureExtractor.OrientTBL_HalfKA[ksq] ^ flip) 
                    + FeatureExtractor.PieceSquareIndex[perspective][pc] 
                    + FeatureExtractor.KingBuckets[ksq ^ flip];
        active.push(index);
      }
    }
    return active;
  }

  static getFullThreatsIndices(board: Board, perspective: Color, threatTables: any): number[] {
    const active: number[] = [];
    const ksq = perspective === Color.WHITE ? board.whiteKing : board.blackKing;

    const makeIndex = (attacker: number, from: number, to: number, attacked: number) => {
      const orientation = FeatureExtractor.OrientTBL_Threats[ksq] ^ (perspective === Color.BLACK ? 56 : 0);
      const from_oriented = from ^ orientation;
      const to_oriented = to ^ orientation;
      const swap = perspective === Color.BLACK ? 8 : 0;
      
      const attkr_ori = attacker ^ swap;
      const attkd_ori = attacked ^ swap;

      // Notice the ? 1 : 0 here to match C++ true -> 1 cast!
      return threatTables.index_lut1[attkr_ori][attkd_ori][from_oriented < to_oriented ? 1 : 0]
           + threatTables.offsets[attkr_ori][from_oriented]
           + threatTables.index_lut2[attkr_ori][from_oriented][to_oriented];
    };

    for (const c of [Color.WHITE, Color.BLACK]) {
      const attackColor = perspective === Color.WHITE ? c : (1 - c);
      const attackerPawn = Board.makePiece(attackColor, PieceType.PAWN);

      for (let s = 0; s < 64; s++) {
        const p = board.pieces[s];
        if (p && p.color === attackColor && p.piece === PieceType.PAWN) {
          const dir = attackColor === Color.WHITE ? 8 : -8;
          const leftCap = attackColor === Color.WHITE ? 7 : -9;
          const rightCap = attackColor === Color.WHITE ? 9 : -7;
          
          for (const capDir of [leftCap, rightCap]) {
            const to = s + capDir;
            if (to >= 0 && to < 64 && Math.abs((s % 8) - (to % 8)) === 1) {
              const target = board.pieces[to];
              if (target) {
                const idx = makeIndex(attackerPawn, s, to, Board.makePiece(target.color, target.piece));
                if (idx < 60720) active.push(idx);
              }
            }
          }

          const toPush = s + dir;
          if (toPush >= 0 && toPush < 64) {
            const target = board.pieces[toPush];
            if (target && target.piece === PieceType.PAWN) {
              const idx = makeIndex(attackerPawn, s, toPush, Board.makePiece(target.color, target.piece));
              if (idx < 60720) active.push(idx);
            }
          }
        }
      }

      const dx = [-1, 1, 0, 0, -1, 1, -1, 1, -1, 1, -2, 2, -2, 2, -1, 1];
      const dy = [0, 0, -1, 1, -1, -1, 1, 1, -2, -2, -1, -1, 1, 1, 2, 2];
      
      for (let s = 0; s < 64; s++) {
        const p = board.pieces[s];
        if (p && p.color === attackColor && p.piece > PieceType.PAWN && p.piece < PieceType.KING) {
          const attackerPiece = Board.makePiece(attackColor, p.piece);
          
          let startDir = 0, endDir = 0, multi = true;
          if (p.piece === PieceType.KNIGHT) { startDir = 8; endDir = 16; multi = false; }
          else if (p.piece === PieceType.BISHOP) { startDir = 4; endDir = 8; }
          else if (p.piece === PieceType.ROOK) { startDir = 0; endDir = 4; }
          else if (p.piece === PieceType.QUEEN) { startDir = 0; endDir = 8; }

          for (let d = startDir; d < endDir; d++) {
            let cx = s % 8;
            let cy = Math.floor(s / 8);
            while (true) {
              cx += dx[d];
              cy += dy[d];
              if (cx < 0 || cx > 7 || cy < 0 || cy > 7) break;
              const to = cy * 8 + cx;
              const target = board.pieces[to];
              
              if (target) {
                const idx = makeIndex(attackerPiece, s, to, Board.makePiece(target.color, target.piece));
                if (idx < 60720) active.push(idx);
                break;
              }
              if (!multi) break;
            }
          }
        }
      }
    }
    return active.sort((a, b) => a - b);
  }
}