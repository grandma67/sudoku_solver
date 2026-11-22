import { bit, forEachCombination, popcount } from '../../engine/bitset';
import { emptyHighlights, type Step, type Technique, type TechniqueId } from '../types';
import { addElims, joinWords, V } from '../util';
import type { CellValue } from '../types';

const NAMES: Record<number, string> = { 2: 'X-Wing', 3: 'Swordfish', 4: 'Jellyfish' };

function fish(k: number, id: TechniqueId): Technique {
  return {
    id,
    name: NAMES[k],
    level: 3,
    summary: `A value confined to the same ${k} columns across ${k} rows (or vice versa).`,
    find({ geo, values, cands }) {
      const n = geo.size;
      for (const baseIsRow of [true, false]) {
        const cellAt = (base: number, cross: number) => (baseIsRow ? base * n + cross : cross * n + base);
        for (let v = 1; v <= n; v++) {
          const b = bit(v);
          const lines: number[] = [];
          const masks: number[] = [];
          for (let line = 0; line < n; line++) {
            let m = 0;
            for (let x = 0; x < n; x++) {
              const c = cellAt(line, x);
              if (!values[c] && cands[c] & b) m |= 1 << x;
            }
            const p = popcount(m);
            if (p >= 2 && p <= k) {
              lines.push(line);
              masks.push(m);
            }
          }
          let found: Step | null = null;
          forEachCombination(lines.length, k, (idx) => {
            let union = 0;
            for (const i of idx) union |= masks[i];
            if (popcount(union) !== k) return false;
            const baseLines = idx.map((i) => lines[i]);
            const crossLines = [...Array(n).keys()].filter((x) => union & (1 << x));
            const elims: CellValue[] = [];
            for (const x of crossLines)
              for (let line = 0; line < n; line++) {
                if (baseLines.includes(line)) continue;
                const c = cellAt(line, x);
                if (!values[c] && cands[c] & b) elims.push({ cell: c, value: v });
              }
            if (!elims.length) return false;
            const h = emptyHighlights();
            for (const line of baseLines) h.units.push(baseIsRow ? line : n + line);
            for (const x of crossLines) h.units.push(baseIsRow ? n + x : x);
            for (const line of baseLines)
              for (const x of crossLines) {
                const c = cellAt(line, x);
                if (!values[c] && cands[c] & b) {
                  h.cells.push({ cell: c, role: 'pattern' });
                  h.candidates.push({ cell: c, value: v, role: 'cause' });
                }
              }
            addElims(h, elims);
            const baseWord = baseIsRow ? 'rows' : 'columns';
            const crossWord = baseIsRow ? 'columns' : 'rows';
            const bl = joinWords(baseLines.map((x) => String(x + 1)));
            const cl = joinWords(crossLines.map((x) => String(x + 1)));
            found = {
              technique: id,
              title: `${NAMES[k]} on ${V(v)} (${baseWord} ${bl})`,
              placements: [],
              eliminations: elims,
              highlights: h,
              explanation:
                `In ${baseWord} ${bl}, ${V(v)} can only appear in ${crossWord} ${cl}. ` +
                `Each of those ${k} ${baseWord} needs a ${V(v)}, and they must use ${k} different ${crossWord}, ` +
                `so ${crossWord} ${cl} get their ${V(v)} from these ${baseWord}. ` +
                `${V(v)} can be removed from the rest of ${crossWord} ${cl}.`,
            };
            return true;
          });
          if (found) return found;
        }
      }
      return null;
    },
  };
}

export const xWing = fish(2, 'x-wing');
export const swordfish = fish(3, 'swordfish');
export const jellyfish = fish(4, 'jellyfish');
