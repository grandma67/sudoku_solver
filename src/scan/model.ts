import { CLASSES, FEATURE_SIZE } from './glyph';
import modelJson from './model.json';

/** Weights are stored as int8 with one scale per output unit to keep the bundle small. */
export interface PackedModel {
  inputs: number;
  hidden: number;
  classes: number;
  w1: string;
  s1: number[];
  b1: number[];
  w2: string;
  s2: number[];
  b2: number[];
}

export interface Mlp {
  inputs: number;
  hidden: number;
  classes: number;
  w1: Float32Array;
  b1: Float32Array;
  w2: Float32Array;
  b2: Float32Array;
}

function decodeInt8(b64: string): Int8Array {
  const bin = atob(b64);
  const out = new Int8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = (bin.charCodeAt(i) << 24) >> 24;
  return out;
}

export function unpack(p: PackedModel): Mlp {
  const q1 = decodeInt8(p.w1), q2 = decodeInt8(p.w2);
  const w1 = new Float32Array(q1.length), w2 = new Float32Array(q2.length);
  for (let h = 0; h < p.hidden; h++) for (let i = 0; i < p.inputs; i++) w1[h * p.inputs + i] = q1[h * p.inputs + i] * p.s1[h];
  for (let k = 0; k < p.classes; k++) for (let h = 0; h < p.hidden; h++) w2[k * p.hidden + h] = q2[k * p.hidden + h] * p.s2[k];
  return { ...p, w1, w2, b1: Float32Array.from(p.b1), b2: Float32Array.from(p.b2) };
}

export function pack(m: Mlp): PackedModel {
  const quant = (w: Float32Array, rows: number, cols: number) => {
    const q = new Int8Array(w.length);
    const scales: number[] = [];
    for (let r = 0; r < rows; r++) {
      let max = 1e-8;
      for (let c = 0; c < cols; c++) max = Math.max(max, Math.abs(w[r * cols + c]));
      const s = max / 127;
      scales.push(+s.toPrecision(6));
      for (let c = 0; c < cols; c++) q[r * cols + c] = Math.round(w[r * cols + c] / s);
    }
    let bin = '';
    for (const v of q) bin += String.fromCharCode(v & 0xff);
    return { b64: btoa(bin), scales };
  };
  const a = quant(m.w1, m.hidden, m.inputs), b = quant(m.w2, m.classes, m.hidden);
  return {
    inputs: m.inputs,
    hidden: m.hidden,
    classes: m.classes,
    w1: a.b64,
    s1: a.scales,
    b1: Array.from(m.b1, (v) => +v.toPrecision(6)),
    w2: b.b64,
    s2: b.scales,
    b2: Array.from(m.b2, (v) => +v.toPrecision(6)),
  };
}

/** Softmax probabilities for each class in CLASSES. */
export function predict(m: Mlp, x: Float32Array): Float32Array {
  const hidden = new Float32Array(m.hidden);
  for (let h = 0; h < m.hidden; h++) {
    let s = m.b1[h];
    const off = h * m.inputs;
    for (let i = 0; i < m.inputs; i++) s += m.w1[off + i] * x[i];
    hidden[h] = s > 0 ? s : 0;
  }
  const out = new Float32Array(m.classes);
  let max = -Infinity;
  for (let k = 0; k < m.classes; k++) {
    let s = m.b2[k];
    const off = k * m.hidden;
    for (let h = 0; h < m.hidden; h++) s += m.w2[off + h] * hidden[h];
    out[k] = s;
    if (s > max) max = s;
  }
  let sum = 0;
  for (let k = 0; k < m.classes; k++) sum += out[k] = Math.exp(out[k] - max);
  for (let k = 0; k < m.classes; k++) out[k] /= sum;
  return out;
}

let cached: Mlp | null = null;
export function getModel(): Mlp {
  if (!cached) cached = unpack(modelJson as PackedModel);
  if (cached.inputs !== FEATURE_SIZE || cached.classes !== CLASSES.length) throw new Error('OCR model does not match features');
  return cached;
}
