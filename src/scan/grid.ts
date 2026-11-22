import { adaptiveThreshold, components, normalizePolarity, type Gray, type Point } from './image';
import { warpSquare } from './perspective';

export const SUPPORTED_SIZES = [4, 6, 8, 9, 12, 16];

/**
 * Line evidence for a warped, ink-dark, square grid image.
 * For every candidate line position we measure, row by row, how much darker the line band is
 * than the paper beside it, after smoothing along the line so noise averages out.
 * Returns the fraction of the line's length that is clearly drawn (0–1).
 */
class LineProbe {
  private vert: Float32Array; // smoothed vertically → good for vertical lines
  private horz: Float32Array; // smoothed horizontally → good for horizontal lines
  /** Minimum darkness (gray levels) for a line, adapted to the image noise. */
  readonly threshold: number;
  constructor(private g: Gray) {
    const S = g.width;
    const r = Math.max(2, Math.round(S / 100));
    this.vert = smooth(g, r, true);
    this.horz = smooth(g, r, false);
    // Robust noise estimate from neighbouring-pixel differences of the smoothed image.
    const diffs: number[] = [];
    for (let i = 0; i < 4000; i++) {
      const y = Math.floor(((i * 7919) % 997) / 997 * S);
      const x = Math.floor(((i * 104729) % 991) / 991 * (S - 1));
      diffs.push(Math.abs(this.vert[y * S + x] - this.vert[y * S + x + 1]));
    }
    diffs.sort((a, b) => a - b);
    const sigma = diffs[diffs.length >> 1] / 0.954;
    this.threshold = Math.max(10, 4 * sigma);
  }

  /**
   * Fraction of the length of a vertical (axis 0) or horizontal (axis 1) line at position p
   * that is darker than the paper beside it. `twoSided` requires paper on both sides
   * (inner lines); otherwise one side is enough (outer border).
   */
  coverage(axis: 0 | 1, p: number, band: number, gap: number, twoSided = true): number {
    const S = this.g.width;
    const img = axis === 0 ? this.vert : this.horz;
    const at = (along: number, across: number) => {
      const a = Math.min(S - 1, Math.max(0, across));
      return axis === 0 ? img[along * S + a] : img[a * S + along];
    };
    const margin = Math.round(S * 0.02);
    let hits = 0;
    for (let t = margin; t < S - margin; t++) {
      let lineMin = 255;
      for (let d = -band; d <= band; d++) lineMin = Math.min(lineMin, at(t, p + d));
      const lp = p - band - gap, rp = p + band + gap;
      const left = lp >= 0 ? (at(t, lp) + at(t, lp - 1) + at(t, lp - 2)) / 3 : NaN;
      const right = rp < S ? (at(t, rp) + at(t, rp + 1) + at(t, rp + 2)) / 3 : NaN;
      let paper: number;
      if (twoSided) {
        if (Number.isNaN(left) || Number.isNaN(right)) continue;
        paper = Math.min(left, right);
      } else paper = Math.max(Number.isNaN(left) ? -1 : left, Number.isNaN(right) ? -1 : right);
      if (paper - lineMin > this.threshold) hits++;
    }
    return hits / (S - 2 * margin);
  }

  /** Typical darkness of a two-sided line at p (60th percentile of contrast along its length). */
  strength(axis: 0 | 1, p: number, band: number, gap: number): number {
    const S = this.g.width;
    const img = axis === 0 ? this.vert : this.horz;
    const at = (along: number, across: number) => {
      const a = Math.min(S - 1, Math.max(0, across));
      return axis === 0 ? img[along * S + a] : img[a * S + along];
    };
    const margin = Math.round(S * 0.03);
    const vals: number[] = [];
    for (let t = margin; t < S - margin; t += 2) {
      let lineMin = 255;
      for (let d = -band; d <= band; d++) lineMin = Math.min(lineMin, at(t, p + d));
      const lp = p - band - gap, rp = p + band + gap;
      const left = (at(t, lp) + at(t, lp - 1) + at(t, lp - 2)) / 3;
      const right = (at(t, rp) + at(t, rp + 1) + at(t, rp + 2)) / 3;
      vals.push(Math.max(0, Math.min(left, right) - lineMin));
    }
    vals.sort((a, b) => a - b);
    return vals[Math.floor(vals.length * 0.6)];
  }
}

function smooth(g: Gray, r: number, vertical: boolean): Float32Array {
  const S = g.width;
  const out = new Float32Array(S * S);
  for (let a = 0; a < S; a++) {
    let acc = 0, count = 0;
    const px = (b: number) => (vertical ? g.data[b * S + a] : g.data[a * S + b]);
    for (let b = 0; b < Math.min(S, r); b++) {
      acc += px(b);
      count++;
    }
    for (let b = 0; b < S; b++) {
      if (b + r < S) {
        acc += px(b + r);
        count++;
      }
      if (b - r - 1 >= 0) {
        acc -= px(b - r - 1);
        count--;
      }
      out[vertical ? b * S + a : a * S + b] = acc / count;
    }
  }
  return out;
}

function sizeScores(probe: LineProbe, S: number) {
  const scores: Record<number, number> = {};
  for (const n of SUPPORTED_SIZES) {
    const cell = S / n;
    const band = Math.max(2, Math.round(cell * 0.05));
    const gap = Math.max(2, Math.round(cell * 0.1));
    let v = 0, h = 0;
    for (let k = 1; k < n; k++) {
      const p = Math.round(k * cell);
      v += probe.coverage(0, p, band, gap);
      h += probe.coverage(1, p, band, gap);
    }
    scores[n] = Math.min(v, h) / (n - 1);
  }
  return scores;
}

const BOX_SHAPES: Record<number, [number, number]> = { 4: [2, 2], 6: [2, 3], 8: [2, 4], 9: [3, 3], 12: [3, 4], 16: [4, 4] };

/**
 * Detects the number of cells per side of a warped grid image.
 * Every supported size has a distinct box layout, so each size is scored by how well the
 * measured line strengths match it: strong box lines where it expects them, weaker cell lines,
 * and no lines where it expects none. This works even when thin cell lines are invisible.
 */
export function detectSize(warped: Gray): { size: number; scores: Record<number, number> } {
  const g = normalizePolarity(warped);
  const S = g.width;
  const probe = new LineProbe(g);
  const band = Math.max(2, Math.round(S * 0.006));
  const gap = Math.max(3, Math.round(S * 0.012));
  // All line positions any supported size could have, as fractions of the side.
  const fracs = [...new Set(SUPPORTED_SIZES.flatMap((n) => Array.from({ length: n - 1 }, (_, k) => +((k + 1) / n).toFixed(4))))];
  const strength = [0, 1].map((axis) => new Map(fracs.map((f) => [f, probe.strength(axis as 0 | 1, Math.round(f * S), band, gap)])));
  const top = Math.max(1, ...strength.flatMap((m) => [...m.values()]));
  const mean = (xs: number[]) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0);

  const scores: Record<number, number> = {};
  for (const n of SUPPORTED_SIZES) {
    const [br, bc] = BOX_SHAPES[n];
    let score = 0;
    for (const axis of [0, 1] as const) {
      const step = axis === 0 ? bc : br; // vertical box lines every boxCols cells
      const lines = Array.from({ length: n - 1 }, (_, k) => k + 1);
      const s = (f: number) => strength[axis].get(+f.toFixed(4))! / top;
      const box = lines.filter((k) => k % step === 0).map((k) => s(k / n));
      const cell = lines.filter((k) => k % step !== 0).map((k) => s(k / n));
      const others = fracs
        .filter((f) => lines.every((k) => Math.abs(f - k / n) > 0.25 / n) && f > 0.3 / n && f < 1 - 0.3 / n)
        .map((f) => strength[axis].get(f)! / top)
        .sort((x, y) => y - x);
      const boxMin = box.length ? Math.min(...box) : 1;
      score +=
        mean(box) +
        0.3 * mean(cell) -
        mean(others.slice(0, 2)) -
        0.7 * Math.max(0, (cell.length ? Math.max(...cell) : 0) - 0.85 * boxMin);
    }
    scores[n] = score / 2;
  }
  const size = SUPPORTED_SIZES.reduce((bestN, n) => (scores[n] > scores[bestN] + 1e-9 ? n : bestN), SUPPORTED_SIZES[0]);
  return { size, scores };
}

/** How much a warped quad looks like a sudoku grid (0–1). */
function gridness(warped: Gray): number {
  const g = normalizePolarity(warped);
  const S = g.width;
  const probe = new LineProbe(g);
  const scores = sizeScores(probe, S);
  const inner = Math.max(...Object.values(scores));
  const band = Math.max(2, Math.round(S * 0.02));
  const gap = Math.max(2, Math.round(S * 0.03));
  const border = [0, 1].map((axis) => {
    const a = probe.coverage(axis as 0 | 1, band, band, gap, false);
    const b = probe.coverage(axis as 0 | 1, S - 1 - band, band, gap, false);
    return (a + b) / 2;
  });
  return (inner * 2 + Math.min(...border)) / 3;
}

function quadArea(pts: Point[]): number {
  return Math.abs(
    pts.reduce((acc, p, i) => {
      const q = pts[(i + 1) % 4];
      return acc + p.x * q.y - q.x * p.y;
    }, 0) / 2,
  );
}

/**
 * Finds the sudoku grid. Candidates are large line-like blobs of dark ink or light ink
 * (for light-on-dark boards); each is warped and scored for grid lines.
 * Returns corners ordered TL, TR, BR, BL, or null.
 */
export function findGridCorners(g: Gray): Point[] | null {
  const { width: w, height: h } = g;
  const radius = Math.max(5, Math.round(Math.min(w, h) / 50));
  const inverted: Gray = { ...g, data: g.data.map((v) => 255 - v) };
  const minSide = Math.min(w, h) * 0.2;
  const candidates: Point[][] = [];

  for (const src of [g, inverted]) {
    const mask = adaptiveThreshold(src, radius, 8);
    const { labels, comps } = components(mask, w, h);
    const big = comps
      .filter((c) => {
        const bw = c.maxX - c.minX + 1, bh = c.maxY - c.minY + 1;
        const aspect = bw / bh;
        return bw >= minSide && bh >= minSide && aspect > 0.5 && aspect < 2 && c.area / (bw * bh) < 0.6;
      })
      .sort((a, b) => (b.maxX - b.minX) * (b.maxY - b.minY) - (a.maxX - a.minX) * (a.maxY - a.minY))
      .slice(0, 6);
    for (const c of big) {
      let tl = { x: 0, y: 0, s: Infinity }, br = { x: 0, y: 0, s: -Infinity };
      let tr = { x: 0, y: 0, s: -Infinity }, bl = { x: 0, y: 0, s: Infinity };
      for (let y = c.minY; y <= c.maxY; y++)
        for (let x = c.minX; x <= c.maxX; x++) {
          if (labels[y * w + x] !== c.label) continue;
          const sum = x + y, diff = x - y;
          if (sum < tl.s) tl = { x, y, s: sum };
          if (sum > br.s) br = { x, y, s: sum };
          if (diff > tr.s) tr = { x, y, s: diff };
          if (diff < bl.s) bl = { x, y, s: diff };
        }
      const pts = [tl, tr, br, bl].map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 }));
      if (quadArea(pts) >= minSide * minSide) candidates.push(pts);
    }
  }

  let best: Point[] | null = null;
  let bestScore = 0;
  for (const pts of candidates) {
    let score: number;
    try {
      score = gridness(warpSquare(g, pts, 288));
    } catch {
      continue;
    }
    const weighted = score * Math.pow(quadArea(pts) / (w * h), 0.15);
    if (score > 0.3 && weighted > bestScore) {
      bestScore = weighted;
      best = pts;
    }
  }
  return best;
}
