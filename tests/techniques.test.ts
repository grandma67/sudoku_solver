import { describe, expect, it } from 'vitest';
import { bit } from '../src/engine/bitset';
import { getGeometry } from '../src/engine/geometry';
import type { SolveState } from '../src/solver/types';
import { hiddenSingle, nakedSingle } from '../src/solver/techniques/singles';
import { hiddenPair, nakedPair } from '../src/solver/techniques/subsets';
import { claiming, pointing } from '../src/solver/techniques/intersections';
import { swordfish, xWing } from '../src/solver/techniques/fish';
import { xyWing, xyzWing } from '../src/solver/techniques/wings';

const geo = getGeometry({ boxRows: 3, boxCols: 3 });
const at = (r: number, c: number) => r * 9 + c;

/** Empty board where every cell has every candidate; tests then carve candidates by hand. */
function blank(): SolveState {
  return { geo, values: new Uint8Array(81), cands: new Uint16Array(81).fill(geo.full) };
}
const remove = (s: SolveState, cell: number, ...vals: number[]) => {
  for (const v of vals) s.cands[cell] &= ~bit(v);
};
const elimSet = (step: { eliminations: { cell: number; value: number }[] } | null) =>
  new Set(step?.eliminations.map((e) => `${e.cell}:${e.value}`));

describe('techniques', () => {
  it('naked single', () => {
    const s = blank();
    s.cands[at(4, 4)] = bit(7);
    const step = nakedSingle.find(s, {});
    expect(step?.placements).toEqual([{ cell: at(4, 4), value: 7 }]);
  });

  it('hidden single', () => {
    const s = blank();
    for (const c of geo.units[18]) if (c !== at(1, 1)) remove(s, c, 5); // box 1
    const step = hiddenSingle.find(s, {});
    expect(step?.placements).toEqual([{ cell: at(1, 1), value: 5 }]);
  });

  it('naked pair', () => {
    const s = blank();
    s.cands[at(0, 0)] = bit(1) | bit(2);
    s.cands[at(0, 5)] = bit(1) | bit(2);
    const step = nakedPair.find(s, {});
    expect(step).not.toBeNull();
    const e = elimSet(step);
    expect(e.has(`${at(0, 8)}:1`)).toBe(true);
    expect(e.has(`${at(0, 0)}:1`)).toBe(false);
  });

  it('hidden pair', () => {
    const s = blank();
    for (let c = 0; c < 9; c++) if (c !== 2 && c !== 6) remove(s, at(3, c), 4, 8);
    const step = hiddenPair.find(s, {});
    expect(step).not.toBeNull();
    const e = elimSet(step);
    expect(e.has(`${at(3, 2)}:1`)).toBe(true);
    expect(e.has(`${at(3, 2)}:4`)).toBe(false);
  });

  it('pointing', () => {
    const s = blank();
    // In box 1, 3 only in row 0.
    for (const c of geo.units[18]) if (geo.rowOf[c] !== 0) remove(s, c, 3);
    const step = pointing.find(s, {});
    expect(step?.technique).toBe('pointing');
    expect(elimSet(step).has(`${at(0, 7)}:3`)).toBe(true);
  });

  it('claiming', () => {
    const s = blank();
    // In row 4, 6 only in columns 0-2 (box 4)
    for (let c = 3; c < 9; c++) remove(s, at(4, c), 6);
    // make sure pointing does not fire first: keep 6 in multiple rows of every box
    const step = claiming.find(s, {});
    expect(step?.technique).toBe('claiming');
    expect(elimSet(step).has(`${at(3, 1)}:6`)).toBe(true);
  });

  it('x-wing', () => {
    const s = blank();
    for (const r of [1, 5]) for (let c = 0; c < 9; c++) if (c !== 2 && c !== 7) remove(s, at(r, c), 9);
    const step = xWing.find(s, {});
    expect(step?.technique).toBe('x-wing');
    const e = elimSet(step);
    expect(e.has(`${at(0, 2)}:9`)).toBe(true);
    expect(e.has(`${at(8, 7)}:9`)).toBe(true);
    expect(e.has(`${at(1, 2)}:9`)).toBe(false);
  });

  it('swordfish', () => {
    const s = blank();
    const cols: Record<number, number[]> = { 0: [0, 4], 3: [4, 8], 6: [0, 8] };
    for (const r of [0, 3, 6]) for (let c = 0; c < 9; c++) if (!cols[r].includes(c)) remove(s, at(r, c), 2);
    const step = swordfish.find(s, {});
    expect(step?.technique).toBe('swordfish');
    expect(elimSet(step).has(`${at(1, 4)}:2`)).toBe(true);
  });

  it('xy-wing', () => {
    const s = blank();
    s.cands[at(0, 0)] = bit(1) | bit(2); // pivot
    s.cands[at(0, 6)] = bit(1) | bit(3); // pincer (row)
    s.cands[at(4, 0)] = bit(2) | bit(3); // pincer (column)
    const step = xyWing.find(s, {});
    expect(step?.technique).toBe('xy-wing');
    expect(elimSet(step).has(`${at(4, 6)}:3`)).toBe(true);
  });

  it('xyz-wing', () => {
    const s = blank();
    s.cands[at(0, 0)] = bit(1) | bit(2) | bit(3); // pivot
    s.cands[at(1, 1)] = bit(1) | bit(3); // in box
    s.cands[at(0, 6)] = bit(2) | bit(3); // in row
    const step = xyzWing.find(s, {});
    expect(step?.technique).toBe('xyz-wing');
    const e = elimSet(step);
    expect(e.has(`${at(0, 1)}:3`)).toBe(true);
    expect(e.has(`${at(0, 7)}:3`)).toBe(false);
  });
});
