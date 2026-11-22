import { firstValue, popcount, valuesOf } from '../../engine/bitset';
import { cellName, sees } from '../../engine/geometry';
import { emptyHighlights, type CellValue, type Technique } from '../types';
import { addCands, addElims, V } from '../util';

export const xyWing: Technique = {
  id: 'xy-wing',
  name: 'XY-Wing',
  level: 3,
  summary: 'A bivalue pivot with two bivalue pincers that share a third value.',
  find({ geo, values, cands }) {
    const bivalue: number[] = [];
    for (let c = 0; c < geo.cellCount; c++) if (!values[c] && popcount(cands[c]) === 2) bivalue.push(c);
    for (const pivot of bivalue) {
      const pm = cands[pivot];
      const wings = bivalue.filter((c) => c !== pivot && sees(geo, pivot, c));
      for (const p1 of wings) {
        const m1 = cands[p1];
        const shared = m1 & pm;
        if (popcount(shared) !== 1) continue;
        const z = m1 & ~pm;
        const need = (pm & ~shared) | z;
        for (const p2 of wings) {
          if (p2 === p1 || cands[p2] !== need) continue;
          const elims: CellValue[] = [];
          const zv = firstValue(z);
          for (const c of geo.peers[p1]) {
            if (c === pivot || c === p2 || values[c] || !(cands[c] & z)) continue;
            if (sees(geo, c, p2)) elims.push({ cell: c, value: zv });
          }
          if (!elims.length) continue;
          const [x, y] = valuesOf(pm);
          const xv = firstValue(shared);
          const yv = xv === x ? y : x;
          const h = emptyHighlights();
          h.cells.push({ cell: pivot, role: 'target' }, { cell: p1, role: 'pattern' }, { cell: p2, role: 'pattern' });
          addCands(h, pivot, pm, 'cause');
          addCands(h, p1, m1, 'cause');
          addCands(h, p2, cands[p2], 'cause');
          addElims(h, elims);
          h.links.push({ from: pivot, to: p1 }, { from: pivot, to: p2 });
          return {
            technique: 'xy-wing',
            title: `XY-Wing with pivot ${cellName(geo, pivot)}`,
            placements: [],
            eliminations: elims,
            highlights: h,
            explanation:
              `The pivot ${cellName(geo, pivot)} is either ${V(xv)} or ${V(yv)}. ` +
              `If it is ${V(xv)}, then ${cellName(geo, p1)} must be ${V(zv)}; if it is ${V(yv)}, then ${cellName(geo, p2)} must be ${V(zv)}. ` +
              `Either way one of the pincers is ${V(zv)}, so ${V(zv)} can be removed from every cell that sees both pincers.`,
          };
        }
      }
    }
    return null;
  },
};

export const xyzWing: Technique = {
  id: 'xyz-wing',
  name: 'XYZ-Wing',
  level: 3,
  summary: 'A three-candidate pivot with two bivalue pincers; the shared value is removed from cells seeing all three.',
  find({ geo, values, cands }) {
    for (let pivot = 0; pivot < geo.cellCount; pivot++) {
      if (values[pivot] || popcount(cands[pivot]) !== 3) continue;
      const pm = cands[pivot];
      const wings = geo.peers[pivot].filter(
        (c) => !values[c] && popcount(cands[c]) === 2 && (cands[c] & ~pm) === 0,
      );
      for (let i = 0; i < wings.length; i++)
        for (let j = i + 1; j < wings.length; j++) {
          const p1 = wings[i], p2 = wings[j];
          const m1 = cands[p1], m2 = cands[p2];
          if (m1 === m2 || (m1 | m2) !== pm) continue;
          const z = m1 & m2;
          const zv = firstValue(z);
          const elims: CellValue[] = [];
          for (const c of geo.peers[pivot]) {
            if (c === p1 || c === p2 || values[c] || !(cands[c] & z)) continue;
            if (sees(geo, c, p1) && sees(geo, c, p2)) elims.push({ cell: c, value: zv });
          }
          if (!elims.length) continue;
          const h = emptyHighlights();
          h.cells.push({ cell: pivot, role: 'target' }, { cell: p1, role: 'pattern' }, { cell: p2, role: 'pattern' });
          addCands(h, pivot, pm, 'cause');
          addCands(h, p1, m1, 'cause');
          addCands(h, p2, m2, 'cause');
          addElims(h, elims);
          h.links.push({ from: pivot, to: p1 }, { from: pivot, to: p2 });
          return {
            technique: 'xyz-wing',
            title: `XYZ-Wing with pivot ${cellName(geo, pivot)}`,
            placements: [],
            eliminations: elims,
            highlights: h,
            explanation:
              `The pivot ${cellName(geo, pivot)} holds ${valuesOf(pm).map(V).join(', ')}, and its pincers ${cellName(geo, p1)} and ${cellName(geo, p2)} ` +
              `each share ${V(zv)} with it. Whatever the pivot turns out to be, one of these three cells must be ${V(zv)}, ` +
              `so ${V(zv)} can be removed from any cell that sees all three.`,
          };
        }
    }
    return null;
  },
};
