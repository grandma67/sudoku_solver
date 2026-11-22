import type { Geometry } from './geometry';

/** Cells whose value is duplicated within one of their units. */
export function findConflicts(geo: Geometry, values: ArrayLike<number>): Set<number> {
  const out = new Set<number>();
  for (const unit of geo.units) {
    const seen = new Map<number, number>();
    for (const cell of unit) {
      const v = values[cell];
      if (!v) continue;
      const prev = seen.get(v);
      if (prev !== undefined) {
        out.add(prev);
        out.add(cell);
      } else seen.set(v, cell);
    }
  }
  return out;
}

export function matchesSolution(values: ArrayLike<number>, solution: ArrayLike<number>): boolean {
  for (let i = 0; i < solution.length; i++) if (values[i] !== solution[i]) return false;
  return true;
}
