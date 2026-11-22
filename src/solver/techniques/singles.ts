import { bit, firstValue, popcount } from '../../engine/bitset';
import { cellName, kindName, unitName } from '../../engine/geometry';
import { emptyHighlights, type Technique } from '../types';
import { V } from '../util';

export const hiddenSingle: Technique = {
  id: 'hidden-single',
  name: 'Hidden Single',
  level: 1,
  summary: 'A value that fits in only one cell of a row, column or box.',
  find({ geo, values, cands }) {
    const n = geo.size;
    // Boxes first: they are the easiest for people to spot.
    const order = [...Array(n).keys()].map((i) => 2 * n + i).concat([...Array(2 * n).keys()]);
    for (const u of order) {
      const cells = geo.units[u];
      let placed = 0;
      for (const c of cells) if (values[c]) placed |= bit(values[c]);
      for (let v = 1; v <= n; v++) {
        const b = bit(v);
        if (placed & b) continue;
        let where = -1, count = 0;
        for (const c of cells) {
          if (!values[c] && cands[c] & b) {
            where = c;
            if (++count > 1) break;
          }
        }
        if (count !== 1) continue;

        const h = emptyHighlights();
        h.units.push(u);
        h.cells.push({ cell: where, role: 'target' });
        h.candidates.push({ cell: where, value: v, role: 'place' });
        // Show which placed values block the other empty cells.
        const blockers = new Set<number>();
        let allBlockedByValues = true;
        for (const c of cells) {
          if (c === where || values[c]) continue;
          const blocker = geo.peers[c].find((p) => values[p] === v);
          if (blocker === undefined) allBlockedByValues = false;
          else blockers.add(blocker);
        }
        for (const b2 of blockers) h.cells.push({ cell: b2, role: 'peer' });
        const kind = kindName(geo.unitKind[u]);
        return {
          technique: 'hidden-single',
          title: `Hidden Single in ${unitName(geo, u)}`,
          placements: [{ cell: where, value: v }],
          eliminations: [],
          highlights: h,
          explanation:
            `In ${unitName(geo, u)}, ${V(v)} can only go in ${cellName(geo, where)}. ` +
            (allBlockedByValues
              ? `Every other empty cell in this ${kind} already sees a ${V(v)} in its row, column or box.`
              : `Every other empty cell in this ${kind} is either blocked by a ${V(v)} or was ruled out by an earlier step.`),
        };
      }
    }
    return null;
  },
};

export const nakedSingle: Technique = {
  id: 'naked-single',
  name: 'Naked Single',
  level: 1,
  summary: 'A cell with only one remaining candidate.',
  find({ geo, values, cands }) {
    for (let cell = 0; cell < geo.cellCount; cell++) {
      if (values[cell] || popcount(cands[cell]) !== 1) continue;
      const v = firstValue(cands[cell]);
      const h = emptyHighlights();
      h.units.push(...geo.unitsOf[cell]);
      h.cells.push({ cell, role: 'target' });
      h.candidates.push({ cell, value: v, role: 'place' });
      let fresh = geo.full;
      const shown = new Set<number>();
      for (const p of geo.peers[cell]) {
        const pv = values[p];
        if (!pv) continue;
        fresh &= ~bit(pv);
        if (pv !== v && !shown.has(pv)) {
          shown.add(pv);
          h.cells.push({ cell: p, role: 'peer' });
        }
      }
      const byValues = popcount(fresh) === 1;
      return {
        technique: 'naked-single',
        title: `Naked Single at ${cellName(geo, cell)}`,
        placements: [{ cell, value: v }],
        eliminations: [],
        highlights: h,
        explanation:
          `${cellName(geo, cell)} has only one candidate left: ${V(v)}. ` +
          (byValues
            ? 'Every other value already appears in its row, column or box.'
            : 'The other values are either already in its row, column or box, or were eliminated by earlier steps.'),
      };
    }
    return null;
  },
};
