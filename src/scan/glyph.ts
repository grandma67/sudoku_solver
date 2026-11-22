import { components, otsu, type Gray } from './image';

export const FEATURE_SIDE = 20;
export const FEATURE_SIZE = FEATURE_SIDE * FEATURE_SIDE + 1;
/** Classes the recognizer knows. 0 is needed for two-digit values such as "10". */
export const CLASSES = '0123456789ABCDEFG';

export interface CellGlyphs {
  /** The whole cell content as one glyph; empty array = blank cell. */
  glyphs: Float32Array[];
  /** Candidate readings as two side-by-side glyphs (printed "10"–"16"), one per split column. */
  splits?: [Float32Array, Float32Array][];
  /** True when the cell holds two glyphs (separated by a gap, or too wide for one glyph). */
  splitIsClean?: boolean;
}

/**
 * Turns a cell image (ink dark on light) into normalized glyph feature vectors.
 * The same function is used for training, so recognition sees exactly what the model learned.
 */
export function extractGlyphs(cell: Gray, allowSplit: boolean): CellGlyphs {
  const C = cell.width;
  const m = Math.round(C * 0.1);
  const S = C - 2 * m;
  const crop = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) crop[y * S + x] = cell.data[(y + m) * C + x + m];

  const [t] = otsu(crop);
  let inkSum = 0, inkN = 0, bgSum = 0, bgN = 0;
  for (const v of crop) {
    if (v <= t) {
      inkSum += v;
      inkN++;
    } else {
      bgSum += v;
      bgN++;
    }
  }
  if (!inkN || !bgN) return { glyphs: [] };
  const contrast = bgSum / bgN - inkSum / inkN;
  if (contrast < 45) return { glyphs: [] };

  // Threshold halfway between paper and ink so thin strokes survive.
  const cut = (bgSum / bgN + inkSum / inkN) / 2;
  const mask = new Uint8Array(S * S);
  for (let i = 0; i < crop.length; i++) mask[i] = crop[i] < cut ? 1 : 0;

  const { labels, comps } = components(mask, S, S);
  const minArea = Math.max(4, S * S * 0.004);
  let kept = comps.filter((c) => {
    if (c.area < minArea) return false;
    const bw = c.maxX - c.minX + 1, bh = c.maxY - c.minY + 1;
    const touches = c.minX === 0 || c.minY === 0 || c.maxX === S - 1 || c.maxY === S - 1;
    // Remnants of grid lines: thin, long and touching the crop border.
    if (touches && Math.min(bw, bh) < S * 0.2 && Math.max(bw, bh) > S * 0.3) return false;
    const cx = (c.minX + c.maxX) / 2 / S, cy = (c.minY + c.maxY) / 2 / S;
    return cx > 0.15 && cx < 0.85 && cy > 0.15 && cy < 0.85;
  });
  if (!kept.length) return { glyphs: [] };
  const biggest = Math.max(...kept.map((c) => c.area));
  kept = kept.filter((c) => c.area >= biggest * 0.08);
  const keep = new Set(kept.map((c) => c.label));

  let minX = S, minY = S, maxX = -1, maxY = -1;
  for (const c of kept) {
    minX = Math.min(minX, c.minX);
    minY = Math.min(minY, c.minY);
    maxX = Math.max(maxX, c.maxX);
    maxY = Math.max(maxY, c.maxY);
  }
  const ink = (x: number, y: number) => keep.has(labels[y * S + x]);
  if (maxY - minY + 1 < S * 0.18) return { glyphs: [] }; // dots and specks

  const whole = features(ink, { minX, minY, maxX, maxY });
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  if (allowSplit && bw >= bh * 0.75) {
    // Wider than ~0.95× its height means two glyphs (no single digit or A–G is that wide).
    const wide = bw >= bh * 0.95;
    // Column ink profile; an empty column is a clean gap between two glyphs.
    const colInk: number[] = [];
    for (let x = minX; x <= maxX; x++) {
      let count = 0;
      for (let y = minY; y <= maxY; y++) if (ink(x, y)) count++;
      colInk.push(count);
    }
    const gapCols = colInk.map((c, i) => (c === 0 && i > 0 && i < bw - 1 ? i : -1)).filter((i) => i >= 0);
    // With a gap, split there; otherwise offer every plausible split and let the model choose.
    const cuts = gapCols.length ? [gapCols[Math.floor(gapCols.length / 2)]] : range(Math.floor(bw * 0.15), Math.ceil(bw * 0.65));
    const splits: [Float32Array, Float32Array][] = [];
    for (const cut of cuts) {
      const left = bbox(ink, minX, minY, minX + cut - 1, maxY);
      const right = bbox(ink, minX + cut + 1, minY, maxX, maxY);
      if (!left || !right) continue;
      if (left.maxY - left.minY + 1 < bh * 0.6 || right.maxY - right.minY + 1 < bh * 0.6) continue;
      splits.push([features(ink, left), features(ink, right)]);
    }
    if (splits.length && (wide || gapCols.length)) return { glyphs: [], splits, splitIsClean: true };
  }
  return { glyphs: [whole] };
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

function bbox(ink: (x: number, y: number) => boolean, x0: number, y0: number, x1: number, y1: number): Box | null {
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (ink(x, y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

/** Scales the glyph so its longest side spans 16px, centered in a 20×20 box (MNIST style). */
function features(ink: (x: number, y: number) => boolean, b: Box): Float32Array {
  const bw = b.maxX - b.minX + 1, bh = b.maxY - b.minY + 1;
  const scale = 16 / Math.max(bw, bh);
  const offX = (FEATURE_SIDE - bw * scale) / 2;
  const offY = (FEATURE_SIDE - bh * scale) / 2;
  const f = new Float32Array(FEATURE_SIZE);
  const SS = 4;
  for (let ty = 0; ty < FEATURE_SIDE; ty++)
    for (let tx = 0; tx < FEATURE_SIDE; tx++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const x = Math.floor((tx + (sx + 0.5) / SS - offX) / scale) + b.minX;
          const y = Math.floor((ty + (sy + 0.5) / SS - offY) / scale) + b.minY;
          if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && ink(x, y)) hit++;
        }
      f[ty * FEATURE_SIDE + tx] = hit / (SS * SS);
    }
  f[FEATURE_SIZE - 1] = Math.min(2, bw / bh) / 2;
  return f;
}
