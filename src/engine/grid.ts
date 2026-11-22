import { bit } from './bitset';
import type { Geometry } from './geometry';

/** Values grid: 0 = empty, 1..size = filled. */
export type Values = Uint8Array;

/** Fresh candidates derived only from placed values (0 for filled cells). */
export function computeCandidates(geo: Geometry, values: ArrayLike<number>): Uint16Array {
  const cands = new Uint16Array(geo.cellCount);
  for (let cell = 0; cell < geo.cellCount; cell++) {
    if (values[cell]) continue;
    let m = geo.full;
    for (const p of geo.peers[cell]) if (values[p]) m &= ~bit(values[p]);
    cands[cell] = m;
  }
  return cands;
}

export const countFilled = (values: ArrayLike<number>): number => {
  let n = 0;
  for (let i = 0; i < values.length; i++) if (values[i]) n++;
  return n;
};
