import { describe, expect, it } from 'vitest';
import { getGeometry, SIZE_PRESETS } from '../src/engine/geometry';
import { checkUniqueness, searchSolutions } from '../src/engine/bruteforce';
import { fillGrid } from '../src/engine/generator';
import { findConflicts } from '../src/engine/validate';
import { mulberry32 } from '../src/engine/rng';
import { decodePuzzle, encodePuzzle, hashToPuzzle, puzzleToHash } from '../src/engine/serialize';
import { bit, forEachCombination, popcount, valuesOf } from '../src/engine/bitset';

describe('bitset', () => {
  it('counts and lists bits', () => {
    expect(popcount(0b1011)).toBe(3);
    expect(valuesOf(bit(1) | bit(16))).toEqual([1, 16]);
  });
  it('enumerates combinations', () => {
    let count = 0;
    forEachCombination(6, 3, () => void count++);
    expect(count).toBe(20);
  });
});

describe.each(SIZE_PRESETS)('geometry $label', ({ spec }) => {
  const geo = getGeometry(spec);
  const n = geo.size;
  it('has n rows, cols and boxes of n cells', () => {
    expect(geo.units).toHaveLength(3 * n);
    for (const u of geo.units) expect(u).toHaveLength(n);
  });
  it('every cell has the right number of peers', () => {
    const expected = 3 * (n - 1) - (spec.boxRows - 1) - (spec.boxCols - 1);
    for (const p of geo.peers) expect(p).toHaveLength(expected);
  });
  it('fills a valid random grid', () => {
    const g = fillGrid(geo, mulberry32(42));
    expect(g.every((v) => v >= 1 && v <= n)).toBe(true);
    expect(findConflicts(geo, g).size).toBe(0);
  });
});

describe('brute force', () => {
  const geo = getGeometry({ boxRows: 3, boxCols: 3 });
  const puzzle = decodePuzzle(
    geo.spec,
    '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79',
  );
  it('solves a classic puzzle uniquely', () => {
    const res = checkUniqueness(geo, puzzle);
    expect(res.status).toBe('unique');
    expect(encodePuzzle(res.solution!)).toBe(
      '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
    );
  });
  it('detects multiple solutions and no solution', () => {
    expect(checkUniqueness(geo, new Array(81).fill(0)).status).toBe('multiple');
    const bad = [...puzzle];
    bad[2] = 5; // duplicate 5 in row 1
    expect(searchSolutions(geo, bad).count).toBe(0);
  });
});

describe('serialize', () => {
  it('round-trips through the URL hash', () => {
    const spec = { boxRows: 4, boxCols: 4 };
    const values = Array.from({ length: 256 }, (_, i) => (i % 17 === 0 ? 0 : (i % 16) + 1));
    const parsed = hashToPuzzle(puzzleToHash(spec, values));
    expect(parsed?.spec).toEqual(spec);
    expect(parsed?.values).toEqual(values);
  });
  it('rejects bad input', () => {
    expect(() => decodePuzzle({ boxRows: 2, boxCols: 2 }, '1234')).toThrow();
    expect(() => decodePuzzle({ boxRows: 2, boxCols: 2 }, '5...............')).toThrow();
    expect(hashToPuzzle('#nope')).toBeNull();
  });
});
