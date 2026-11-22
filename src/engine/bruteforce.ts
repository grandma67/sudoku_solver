import { bit, popcount } from './bitset';
import type { Geometry } from './geometry';
import type { Rng } from './rng';

export interface SearchResult {
  count: number;
  solution: Uint8Array | null;
  /** True when the node budget ran out before the search finished. */
  aborted: boolean;
}

/**
 * Bitmask backtracking with the minimum-remaining-values heuristic.
 * Counts solutions up to `limit`. Optional rng randomizes value order (used for filling grids).
 * Optional `domains` restrict empty cells to a candidate mask (0 = unrestricted).
 */
export function searchSolutions(
  geo: Geometry,
  values: ArrayLike<number>,
  limit = 2,
  opts: { rng?: Rng; nodeBudget?: number; domains?: Uint16Array } = {},
): SearchResult {
  const n = geo.size;
  const { rowOf, colOf, boxOf, full } = geo;
  const grid = Uint8Array.from(values as ArrayLike<number>);
  const rowM = new Uint16Array(n);
  const colM = new Uint16Array(n);
  const boxM = new Uint16Array(n);
  const empties: number[] = [];

  for (let cell = 0; cell < geo.cellCount; cell++) {
    const v = grid[cell];
    if (!v) {
      empties.push(cell);
      continue;
    }
    const b = bit(v);
    const r = rowOf[cell], c = colOf[cell], x = boxOf[cell];
    if ((rowM[r] | colM[c] | boxM[x]) & b) return { count: 0, solution: null, aborted: false };
    rowM[r] |= b;
    colM[c] |= b;
    boxM[x] |= b;
  }

  const budget = opts.nodeBudget ?? Infinity;
  const rng = opts.rng;
  const domains = opts.domains;
  let nodes = 0;
  let count = 0;
  let solution: Uint8Array | null = null;
  let aborted = false;

  const rec = (): boolean => {
    if (++nodes > budget) {
      aborted = true;
      return true;
    }
    let best = -1, bestMask = 0, bestCount = 99;
    for (let i = 0; i < empties.length; i++) {
      const cell = empties[i];
      if (grid[cell]) continue;
      let m = full & ~(rowM[rowOf[cell]] | colM[colOf[cell]] | boxM[boxOf[cell]]);
      if (domains && domains[cell]) m &= domains[cell];
      const k = popcount(m);
      if (k === 0) return false;
      if (k < bestCount) {
        best = cell;
        bestMask = m;
        bestCount = k;
        if (k === 1) break;
      }
    }
    if (best === -1) {
      count++;
      if (!solution) solution = grid.slice();
      return count >= limit;
    }
    const r = rowOf[best], c = colOf[best], x = boxOf[best];
    const options: number[] = [];
    for (let v = 1, m = bestMask; m; v++, m >>>= 1) if (m & 1) options.push(v);
    if (rng) {
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
    }
    for (const v of options) {
      const b = bit(v);
      grid[best] = v;
      rowM[r] |= b;
      colM[c] |= b;
      boxM[x] |= b;
      if (rec()) return true;
      grid[best] = 0;
      rowM[r] &= ~b;
      colM[c] &= ~b;
      boxM[x] &= ~b;
    }
    return false;
  };

  rec();
  return { count, solution, aborted };
}

export type Uniqueness = 'none' | 'unique' | 'multiple' | 'unknown';

export function checkUniqueness(
  geo: Geometry,
  values: ArrayLike<number>,
  nodeBudget = 2_000_000,
): { status: Uniqueness; solution: Uint8Array | null } {
  const res = searchSolutions(geo, values, 2, { nodeBudget });
  if (res.aborted) return { status: res.count >= 1 ? 'unknown' : 'unknown', solution: res.solution };
  if (res.count === 0) return { status: 'none', solution: null };
  return { status: res.count === 1 ? 'unique' : 'multiple', solution: res.solution };
}
