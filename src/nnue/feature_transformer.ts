import { Color } from './features';

export class FeatureTransformer {
  static transform(
    ft: any,
    ka_w: number[], ka_b: number[],
    th_w: number[], th_b: number[],
    bucket: number, stm: Color
  ) {
    // 1. Initialize Accumulators with biases
    const acc_w = new Int32Array(1024);
    const acc_b = new Int32Array(1024);
    for (let i = 0; i < 1024; i++) {
      acc_w[i] = ft.biases[i];
      acc_b[i] = ft.biases[i];
    }

    const threat_acc_w = new Int32Array(1024);
    const threat_acc_b = new Int32Array(1024);

    // 2. Add Weights from active HalfKA indices
    for (const idx of ka_w) {
      const offset = idx * 1024;
      for (let j = 0; j < 1024; j++) acc_w[j] += ft.weights[offset + j];
    }
    for (const idx of ka_b) {
      const offset = idx * 1024;
      for (let j = 0; j < 1024; j++) acc_b[j] += ft.weights[offset + j];
    }

    // 3. Add Weights from active FullThreats indices
    for (const idx of th_w) {
      const offset = idx * 1024;
      for (let j = 0; j < 1024; j++) threat_acc_w[j] += ft.threatWeights[offset + j];
    }
    for (const idx of th_b) {
      const offset = idx * 1024;
      for (let j = 0; j < 1024; j++) threat_acc_b[j] += ft.threatWeights[offset + j];
    }

    // 4. Calculate the base PSQT (Material) score
    let psqt_w = 0, psqt_b = 0;
    let t_psqt_w = 0, t_psqt_b = 0;

    for (const idx of ka_w) psqt_w += ft.psqtWeights[idx * 8 + bucket];
    for (const idx of ka_b) psqt_b += ft.psqtWeights[idx * 8 + bucket];
    for (const idx of th_w) t_psqt_w += ft.threatPsqtWeights[idx * 8 + bucket];
    for (const idx of th_b) t_psqt_b += ft.threatPsqtWeights[idx * 8 + bucket];

    const psqt_stm = stm === Color.WHITE ? psqt_w : psqt_b;
    const psqt_nstm = stm === Color.WHITE ? psqt_b : psqt_w;
    const t_psqt_stm = stm === Color.WHITE ? t_psqt_w : t_psqt_b;
    const t_psqt_nstm = stm === Color.WHITE ? t_psqt_b : t_psqt_w;

    const materialist = Math.trunc((psqt_stm - psqt_nstm + t_psqt_stm - t_psqt_nstm) / 2);

    // 5. Apply Pairwise SCReLU Activation
    const transformedFeatures = new Uint8Array(1024);
    
    // Assign "perspective 0" to Side-To-Move, "perspective 1" to Not-Side-To-Move
    const perspectives = stm === Color.WHITE ?
      { stm: acc_w, stm_t: threat_acc_w, nstm: acc_b, nstm_t: threat_acc_b } :
      { stm: acc_b, stm_t: threat_acc_b, nstm: acc_w, nstm_t: threat_acc_w };

    for (let p = 0; p < 2; p++) {
      const acc = p === 0 ? perspectives.stm : perspectives.nstm;
      const t_acc = p === 0 ? perspectives.stm_t : perspectives.nstm_t;
      const out_offset = p === 0 ? 0 : 512;

      for (let j = 0; j < 512; j++) {
        let sum0 = acc[j] + t_acc[j];
        let sum1 = acc[j + 512] + t_acc[j + 512];
        
        // clamp(x, 0, 255)
        sum0 = Math.max(0, Math.min(255, sum0));
        sum1 = Math.max(0, Math.min(255, sum1));
        
        transformedFeatures[out_offset + j] = Math.trunc((sum0 * sum1) / 512);
      }
    }

    return { transformedFeatures, materialist };
  }
}