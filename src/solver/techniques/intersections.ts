import { bit } from '../../engine/bitset';
import { unitName } from '../../engine/geometry';
import { emptyHighlights, type Step, type Technique } from '../types';
import { addElims, eliminationsFor, listCells, V } from '../util';

function intersectionStep(
  s: Parameters<Technique['find']>[0],
  source: number,
  target: number,
  v: number,
  cells: number[],
  technique: 'pointing' | 'claiming',
): Step | null {
  const { geo, values, cands } = s;
  const targets = geo.units[target].filter((c) => !values[c] && !geo.units[source].includes(c));
  const elims = eliminationsFor(cands, targets, bit(v));
  if (!elims.length) return null;
  const h = emptyHighlights();
  h.units.push(source, target);
  for (const c of cells) {
    h.cells.push({ cell: c, role: 'pattern' });
    h.candidates.push({ cell: c, value: v, role: 'cause' });
  }
  addElims(h, elims);
  const src = unitName(geo, source);
  const dst = unitName(geo, target);
  return {
    technique,
    title: `${technique === 'pointing' ? 'Pointing' : 'Claiming'} ${V(v)}: ${src} → ${dst}`,
    placements: [],
    eliminations: elims,
    highlights: h,
    explanation:
      `In ${src}, ${V(v)} can only go in ${listCells(geo, cells)}, which all lie in ${dst}. ` +
      `So the ${V(v)} of ${dst} must come from ${src}, and ${V(v)} can be removed from the rest of ${dst}.`,
  };
}

/** Box → line: a value confined to one row/column within a box. */
export const pointing: Technique = {
  id: 'pointing',
  name: 'Pointing',
  level: 2,
  summary: 'A value inside a box is confined to one row or column, so it is removed from the rest of that line.',
  find(s) {
    const { geo, values, cands } = s;
    const n = geo.size;
    for (let b = 0; b < n; b++) {
      const u = 2 * n + b;
      for (let v = 1; v <= n; v++) {
        const cells = geo.units[u].filter((c) => !values[c] && cands[c] & bit(v));
        if (cells.length < 2) continue;
        for (const lineOf of [geo.rowOf, geo.colOf]) {
          const line = lineOf[cells[0]];
          if (!cells.every((c) => lineOf[c] === line)) continue;
          const target = lineOf === geo.rowOf ? line : n + line;
          const step = intersectionStep(s, u, target, v, cells, 'pointing');
          if (step) return step;
        }
      }
    }
    return null;
  },
};

/** Line → box: a value confined to one box within a row/column. */
export const claiming: Technique = {
  id: 'claiming',
  name: 'Claiming (Box/Line)',
  level: 2,
  summary: 'A value in a row or column is confined to one box, so it is removed from the rest of that box.',
  find(s) {
    const { geo, values, cands } = s;
    const n = geo.size;
    for (let u = 0; u < 2 * n; u++) {
      for (let v = 1; v <= n; v++) {
        const cells = geo.units[u].filter((c) => !values[c] && cands[c] & bit(v));
        if (cells.length < 2) continue;
        const box = geo.boxOf[cells[0]];
        if (!cells.every((c) => geo.boxOf[c] === box)) continue;
        const step = intersectionStep(s, u, 2 * n + box, v, cells, 'claiming');
        if (step) return step;
      }
    }
    return null;
  },
};
