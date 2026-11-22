import { popcount, valuesOf } from '../../engine/bitset';
import { searchSolutions } from '../../engine/bruteforce';
import { cellName } from '../../engine/geometry';
import { emptyHighlights, type Technique } from '../types';
import { listValues, V } from '../util';

/**
 * Fallback when no logical technique applies: pick the cell with the fewest candidates,
 * and use search to show which candidate survives (the others lead to contradictions).
 */
export const trial: Technique = {
  id: 'trial',
  name: 'Trial & Error',
  level: 4,
  summary: 'No pattern applies; test the candidates of one cell and keep the one that does not lead to a contradiction.',
  find({ geo, values, cands }, ctx) {
    let best = -1, bestCount = 99;
    for (let c = 0; c < geo.cellCount; c++) {
      if (values[c]) continue;
      const p = popcount(cands[c]);
      if (p > 0 && p < bestCount) {
        best = c;
        bestCount = p;
      }
    }
    if (best < 0) return null;
    let solution = ctx.solution;
    if (!solution) {
      const res = searchSolutions(geo, values, 1, { nodeBudget: 5_000_000 });
      if (!res.solution) return null;
      solution = res.solution;
    }
    const v = solution[best];
    if (!(cands[best] & (1 << (v - 1)))) return null;
    const others = valuesOf(cands[best]).filter((x) => x !== v);
    const h = emptyHighlights();
    h.cells.push({ cell: best, role: 'target' });
    h.candidates.push({ cell: best, value: v, role: 'place' });
    for (const o of others) h.candidates.push({ cell: best, value: o, role: 'eliminate' });
    const name = cellName(geo, best);
    return {
      technique: 'trial',
      title: `Trial at ${name}`,
      placements: [{ cell: best, value: v }],
      eliminations: [],
      highlights: h,
      explanation:
        `None of the logical patterns make progress here, so we test a cell. ${name} has only ${bestCount} candidates (${listValues(valuesOf(cands[best]))}). ` +
        (others.length
          ? `Assuming ${listValues(others)} quickly leads to a contradiction (some cell ends up with no candidates), while ${V(v)} leads to a valid solution. So ${name} = ${V(v)}.`
          : `So ${name} = ${V(v)}.`),
    };
  },
};
