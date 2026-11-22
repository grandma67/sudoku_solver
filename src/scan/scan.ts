import { searchSolutions } from '../engine/bruteforce';
import { findConflicts } from '../engine/validate';
import { getGeometry, SIZE_PRESETS, type BoardSpec } from '../engine/geometry';
import { CLASSES, extractGlyphs, type CellGlyphs } from './glyph';
import { detectSize, findGridCorners } from './grid';
import { normalizePolarity, toGray, type Gray, type Point, type RGBAImage } from './image';
import { getModel, predict } from './model';
import { warpSquare } from './perspective';

export const CELL_PX = 48;

export interface ScanOptions {
  /** Cells per side, or undefined for auto-detection. */
  size?: number;
  /** Manual grid corners (TL, TR, BR, BL) in source image pixels. */
  corners?: Point[];
}

export interface ScanResult {
  spec: BoardSpec;
  values: number[];
  /** Recognition confidence per cell, 0–1 (1 for confident blanks). */
  confidence: number[];
  /** Cells the user should double-check. */
  uncertain: number[];
  /** Cells whose first reading was replaced using the puzzle's own logic. */
  corrected: number[];
  /** Grid corners in source image pixels. */
  corners: Point[];
  /** Perspective-corrected grid (grayscale) for display next to the result. */
  warped: Gray;
}

export class ScanError extends Error {}

interface Candidate {
  value: number;
  p: number;
}

/**
 * Ranked value candidates for one cell. On boards above 9×9 a wide glyph may be a printed
 * two-digit number, so both readings compete on probability.
 */
function classify(cell: CellGlyphs, n: number): Candidate[] {
  const model = getModel();
  const out: Candidate[] = [];
  if (cell.glyphs.length) {
    const p = predict(model, cell.glyphs[0]);
    // Class index k: '1'–'9' → 1–9, 'A'–'G' → 10–16.
    for (let k = 1; k < CLASSES.length && k <= n; k++) out.push({ value: k, p: p[k] });
  }
  if (cell.splits && n > 9) {
    // Use the split that best explains the cell as "1" followed by a digit 0–6.
    let best: number[] | null = null, bestScore = -1;
    for (const split of cell.splits) {
      const [a, b] = split.map((g) => predict(model, g));
      const probs = Array.from({ length: n - 9 }, (_, d) => a[1] * b[d]);
      const score = Math.max(...probs);
      if (score > bestScore) {
        bestScore = score;
        best = probs;
      }
    }
    best?.forEach((p, d) => out.push({ value: 10 + d, p }));
  }
  const best = new Map<number, number>();
  for (const c of out) best.set(c.value, Math.max(best.get(c.value) ?? 0, c.p));
  const merged = [...best.entries()].map(([value, p]) => ({ value, p }));
  const total = merged.reduce((s, c) => s + c.p, 0) || 1;
  return merged.map((c) => ({ ...c, p: c.p / total })).sort((x, y) => y.p - x.p);
}

export function scanImage(img: RGBAImage, opts: ScanOptions = {}): ScanResult {
  const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
  const gray = normalizePolarity(toGray(img, 1200));
  let corners = opts.corners?.map((p) => ({ x: p.x * scale, y: p.y * scale })) ?? null;
  if (!corners) corners = findGridCorners(gray);
  if (!corners) throw new ScanError('Could not find a sudoku grid in the image.');

  let n = opts.size;
  if (!n) n = detectSize(warpSquare(gray, corners, 576)).size;
  const spec = SIZE_PRESETS.find((p) => p.spec.boxRows * p.spec.boxCols === n)?.spec;
  if (!spec) throw new ScanError(`Unsupported board size ${n}.`);

  const S = n * CELL_PX;
  const warped = normalizePolarity(warpSquare(gray, corners, S));
  const values: number[] = [];
  const confidence: number[] = [];
  const ranked: Candidate[][] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const cell = new Uint8Array(CELL_PX * CELL_PX);
      for (let y = 0; y < CELL_PX; y++)
        for (let x = 0; x < CELL_PX; x++) cell[y * CELL_PX + x] = warped.data[(r * CELL_PX + y) * S + c * CELL_PX + x];
      const cands = classify(extractGlyphs({ width: CELL_PX, height: CELL_PX, data: cell }, n > 9), n);
      ranked.push(cands);
      values.push(cands[0]?.value ?? 0);
      confidence.push(cands[0]?.p ?? 1);
    }

  // Resolve rule conflicts by swapping the least confident cell to its next-best value.
  const geo = getGeometry(spec);
  for (let pass = 0; pass < 3; pass++) {
    const conflicts = [...findConflicts(geo, values)].sort((a, b) => confidence[a] - confidence[b]);
    if (!conflicts.length) break;
    const cell = conflicts[0];
    const used = new Set(geo.peers[cell].map((p) => values[p]));
    const alt = ranked[cell].find((cand) => cand.value !== values[cell] && !used.has(cand.value));
    if (alt) {
      values[cell] = alt.value;
      confidence[cell] = Math.min(confidence[cell], alt.p);
    } else {
      values[cell] = 0;
      confidence[cell] = 0;
    }
  }

  let uncertain = confidence.map((p, i) => (p < 0.9 ? i : -1)).filter((i) => i >= 0);

  // Let the puzzle check itself: each doubtful cell surely holds a symbol, just an uncertain one.
  // Restrict it to the values the recognizer found plausible; if exactly one grid fits, use it.
  const corrected: number[] = [];
  if (uncertain.length) {
    const doubtful = new Set(uncertain);
    const trimmed = values.map((v, i) => (doubtful.has(i) ? 0 : v));
    const domains = new Uint16Array(geo.cellCount);
    for (const i of uncertain) for (const c of ranked[i]) if (c.p >= 0.03) domains[i] |= 1 << (c.value - 1);
    const allHaveDomain = uncertain.every((i) => domains[i] !== 0);
    if (allHaveDomain && !findConflicts(geo, trimmed).size) {
      const res = searchSolutions(geo, trimmed, 2, { nodeBudget: 2_000_000, domains });
      if (res.count === 1 && !res.aborted && res.solution) {
        for (const i of uncertain) {
          if (values[i] !== res.solution[i]) corrected.push(i);
          values[i] = res.solution[i];
          confidence[i] = 1;
        }
        uncertain = [];
      }
    }
  }

  return {
    spec,
    values,
    confidence,
    uncertain,
    corrected,
    corners: corners.map((p) => ({ x: p.x / scale, y: p.y / scale })),
    warped,
  };
}
