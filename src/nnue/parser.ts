export class NNUEParser {
  private view: DataView;
  private offset: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  public parse() {
    // 1. Global Header
    const version = this.readUint32();
    if (version !== 0x7AF32F20) throw new Error(`Invalid version: ${version}`);

    const hashValue = this.readUint32();
    const descLength = this.readUint32();
    
    const descBytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, descLength);
    const description = new TextDecoder().decode(descBytes);
    this.offset += descLength;

    // 2. Feature Transformer
    const ftHash = this.readUint32();
    const ftBiases = this.readLEB128(1024, false); // int16
    
    // threatWeights are raw little-endian int8
    const threatWeightsSize = 60720 * 1024;
    const ftThreatWeights = this.readRawInt8(threatWeightsSize);

    const ftWeights = this.readLEB128(22528 * 1024, false); // int16
    
    // threatPsqtWeights and psqtWeights share the same LEB128 block
    const ftThreatPsqtWeights = new Int32Array(60720 * 8);
    const ftPsqtWeights = new Int32Array(22528 * 8);
    this.readLEB128Multiple([ftThreatPsqtWeights, ftPsqtWeights], true); // int32

    // 3. Network Architecture (8 Buckets)
    const buckets = [];
    for (let i = 0; i < 8; i++) {
      buckets.push(this.parseBucket());
    }

    return {
      version,
      hashValue,
      description,
      featureTransformer: {
        hash: ftHash,
        biases: ftBiases,
        threatWeights: ftThreatWeights,
        weights: ftWeights,
        threatPsqtWeights: ftThreatPsqtWeights,
        psqtWeights: ftPsqtWeights
      },
      buckets
    };
  }

  private parseBucket() {
    const hash = this.readUint32();
    
    // fc_0: AffineTransformSparseInput<1024, 32>
    const fc0_biases = this.readRawInt32(32);
    const fc0_weights = this.readRawInt8(32 * 1024);

    // fc_1: AffineTransform<62, 32>
    const fc1_biases = this.readRawInt32(32);
    const fc1_weights = this.readRawInt8(32 * 64); // PaddedInputDimensions = 64

    // fc_2: AffineTransform<32, 1>
    const fc2_biases = this.readRawInt32(1);
    const fc2_weights = this.readRawInt8(1 * 32);

    return { hash, fc0_biases, fc0_weights, fc1_biases, fc1_weights, fc2_biases, fc2_weights };
  }

  // --- Helpers ---

  private readUint32() {
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  private readRawInt32(count: number) {
    const arr = new Int32Array(count);
    for (let i = 0; i < count; i++) {
      arr[i] = this.view.getInt32(this.offset, true);
      this.offset += 4;
    }
    return arr;
  }

  private readRawInt8(count: number) {
    const arr = new Int8Array(this.view.buffer, this.view.byteOffset + this.offset, count);
    this.offset += count;
    return arr;
  }

  private readLEB128(count: number, isInt32: boolean) {
    const arr = isInt32 ? new Int32Array(count) : new Int16Array(count);
    this.readLEB128Multiple([arr], isInt32);
    return arr;
  }

  private readLEB128Multiple(arrays: (Int16Array | Int32Array)[], isInt32: boolean) {
    const magic = "COMPRESSED_LEB128";
    for (let i = 0; i < magic.length; i++) {
      if (this.view.getUint8(this.offset++) !== magic.charCodeAt(i)) {
        throw new Error("Missing LEB128 magic string");
      }
    }

    const bytesLeft = this.readUint32();
    const expectedEnd = this.offset + bytesLeft;

    for (const arr of arrays) {
      for (let i = 0; i < arr.length; i++) {
        let result = 0;
        let shift = 0;
        let byte: number;
        
        // 1. Extract bytes
        do {
          byte = this.view.getUint8(this.offset++);
          result |= (byte & 0x7f) << shift;
          shift += 7;
        } while ((byte & 0x80) !== 0);

        // 2. PROPER LEB128 SIGN EXTENSION
        // If the sign bit (0x40) of the final byte is set, pad the remaining upper bits with 1s
        if (shift < 32 && (byte & 0x40) !== 0) {
          result |= (~0 << shift);
        }
        
        arr[i] = result;
      }
    }

    if (this.offset !== expectedEnd) {
      throw new Error(`LEB128 read error: offset ${this.offset} does not match expected end ${expectedEnd}`);
    }
  }
}