import { bit, forEachCombination, popcount, valuesOf } from '../../engine/bitset';
import { unitName } from '../../engine/geometry';
import { emptyHighlights, type CellValue, type Step, type Technique, type TechniqueId } from '../types';
import { addCands, addElims, commonUnits, eliminationsFor, joinWords, listCells, listValues } from '../util';

const NAMES = ['', '', 'Pair', 'Triple', 'Quad'];
const COUNT_WORDS = ['', '', 'two', 'three', 'four'];

function nakedSubset(k: number, id: TechniqueId, level: 2 | 3): Technique {
  return {
    id,
    name: `Naked ${NAMES[k]}`,
    level,
    summary: `${COUNT_WORDS[k]} cells in a unit that together hold only ${COUNT_WORDS[k]} candidates.`,
    find({ geo, values, cands }) {
      for (let u = 0; u < geo.units.length; u++) {
        const unit = geo.units[u];
        const empties = unit.filter((c) => !values[c]);
        if (empties.length <= k) continue;
        const pool = empties.filter((c) => {
          const p = popcount(cands[c]);
          return p >= 2 && p <= k;
        });
        let found: Step | null = null;
        forEachCombination(pool.length, k, (idx) => {
          const cells = idx.map((i) => pool[i]);
          let union = 0;
          for (const c of cells) union |= cands[c];
          if (popcount(union) !== k) return false;
          const units = commonUnits(geo, cells);
          const targets = new Set<number>();
          for (const cu of units) for (const c of geo.units[cu]) if (!values[c] && !cells.includes(c)) targets.add(c);
          const elims = eliminationsFor(cands, targets, union);
          if (!elims.length) return false;
          const h = emptyHighlights();
          h.units.push(...units);
          for (const c of cells) {
            h.cells.push({ cell: c, role: 'pattern' });
            addCands(h, c, cands[c], 'cause');
          }
          addElims(h, elims);
          const where = joinWords(units.map((x) => unitName(geo, x)));
          found = {
            technique: id,
            title: `Naked ${NAMES[k]} in ${unitName(geo, u)}`,
            placements: [],
            eliminations: elims,
            highlights: h,
            explanation:
              `${listCells(geo, cells)} (in ${where}) can only contain ${listValues(valuesOf(union))}. ` +
              `Those ${COUNT_WORDS[k]} values must fill these ${COUNT_WORDS[k]} cells, so they can be removed from every other cell in ${where}.`,
          };
          return true;
        });
        if (found) return found;
      }
      return null;
    },
  };
}

function hiddenSubset(k: number, id: TechniqueId, level: 2 | 3): Technique {
  return {
    id,
    name: `Hidden ${NAMES[k]}`,
    level,
    summary: `${COUNT_WORDS[k]} values that fit in only the same ${COUNT_WORDS[k]} cells of a unit.`,
    find({ geo, values, cands }) {
      const n = geo.size;
      for (let u = 0; u < geo.units.length; u++) {
        const unit = geo.units[u];
        const emptyCount = unit.filter((c) => !values[c]).length;
        if (emptyCount <= k) continue;
        // positions[v] = bitmask of indices (within the unit) where v is a candidate
        const vals: number[] = [];
        const pos: number[] = [];
        for (let v = 1; v <= n; v++) {
          let m = 0;
          unit.forEach((c, i) => {
            if (!values[c] && cands[c] & bit(v)) m |= 1 << i;
          });
          const p = popcount(m);
          if (p >= 1 && p <= k) {
            vals.push(v);
            pos.push(m);
          }
        }
        let found: Step | null = null;
        forEachCombination(vals.length, k, (idx) => {
          let union = 0, vmask = 0;
          for (const i of idx) {
            union |= pos[i];
            vmask |= bit(vals[i]);
          }
          if (popcount(union) !== k) return false;
          const cells = unit.filter((_, i) => union & (1 << i));
          const elims: CellValue[] = [];
          for (const c of cells) for (const v of valuesOf(cands[c] & ~vmask)) elims.push({ cell: c, value: v });
          if (!elims.length) return false;
          const chosen = idx.map((i) => vals[i]);
          const h = emptyHighlights();
          h.units.push(u);
          for (const c of cells) {
            h.cells.push({ cell: c, role: 'pattern' });
            addCands(h, c, cands[c] & vmask, 'cause');
          }
          addElims(h, elims);
          found = {
            technique: id,
            title: `Hidden ${NAMES[k]} in ${unitName(geo, u)}`,
            placements: [],
            eliminations: elims,
            highlights: h,
            explanation:
              `In ${unitName(geo, u)}, the values ${listValues(chosen)} can only go in ${listCells(geo, cells)}. ` +
              `These ${COUNT_WORDS[k]} cells must hold exactly these values, so every other candidate can be removed from them.`,
          };
          return true;
        });
        if (found) return found;
      }
      return null;
    },
  };
}

export const nakedPair = nakedSubset(2, 'naked-pair', 2);
export const nakedTriple = nakedSubset(3, 'naked-triple', 2);
export const nakedQuad = nakedSubset(4, 'naked-quad', 3);
export const hiddenPair = hiddenSubset(2, 'hidden-pair', 2);
export const hiddenTriple = hiddenSubset(3, 'hidden-triple', 3);
