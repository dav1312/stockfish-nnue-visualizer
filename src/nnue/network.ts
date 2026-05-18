export class NNUENetwork {
  
  public static propagate(transformedFeatures: Uint8Array, bucket: any) {
    // 1. fc_0: AffineTransformSparseInput (1024 -> 32)
    const fc0_out = new Int32Array(32);
    
    // Copy biases first
    for (let j = 0; j < 32; j++) {
      fc0_out[j] = bucket.fc0_biases[j];
    }

    // Traverse inputs and sparsely multiply (Exactly matching Stockfish's C++ fallback)
    for (let i = 0; i < 1024; i++) {
      const in_val = transformedFeatures[i];
      if (in_val !== 0) {
        for (let j = 0; j < 32; j++) {
          // weights[input + output * 1024]
          fc0_out[j] += in_val * bucket.fc0_weights[i + j * 1024];
        }
      }
    }

    // 2. Activations: SqrClippedReLU & ClippedReLU 
    const ac_sqr_0_out = new Uint8Array(64); 
    const ac_0_out = new Uint8Array(31);

    for (let i = 0; i < 31; i++) {
      const val = fc0_out[i];
      ac_sqr_0_out[i] = Math.min(127, Number((BigInt(val) * BigInt(val)) >> 19n));
      ac_0_out[i] = Math.max(0, Math.min(127, val >> 6));
    }

    for (let i = 0; i < 31; i++) {
      ac_sqr_0_out[31 + i] = ac_0_out[i];
    }

    // 3. fc_1: AffineTransform (62 padded to 64 -> 32)
    const fc1_out = new Int32Array(32);
    for (let j = 0; j < 32; j++) {
      fc1_out[j] = bucket.fc1_biases[j];
    }

    for (let i = 0; i < 64; i++) {
      const in_val = ac_sqr_0_out[i];
      if (in_val !== 0) {
        for (let j = 0; j < 32; j++) {
          // weights[input + output * 64]
          fc1_out[j] += in_val * bucket.fc1_weights[i + j * 64];
        }
      }
    }

    // 4. ac_1: ClippedReLU (32 -> 32)
    const ac_1_out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      ac_1_out[i] = Math.max(0, Math.min(127, fc1_out[i] >> 6));
    }

    // 5. fc_2: AffineTransform (32 -> 1)
    let fc2_out = bucket.fc2_biases[0];
    for (let i = 0; i < 32; i++) {
      fc2_out += ac_1_out[i] * bucket.fc2_weights[i];
    }

    // 6. Skip connection (fwdOut) from fc_0_out[31]
    const skipVal = fc0_out[31];
    const fwdOut = Math.trunc((skipVal * 9600) / 8128); 
    
    const outputValue = fc2_out + fwdOut;

    return {
      fc0_out,
      ac_sqr_0_out,
      ac_0_out,
      fc1_out,
      ac_1_out,
      fc2_out,
      fwdOut,
      outputValue
    };
  }
}