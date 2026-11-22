import { describe, expect, it } from 'vitest';
import { checkUniqueness } from '../src/engine/bruteforce';
import { generatePuzzle } from '../src/engine/generator';
import { getGeometry, SIZE_PRESETS } from '../src/engine/geometry';
import { decodePuzzle } from '../src/engine/serialize';
import { solveLogically } from '../src/solver/logicalSolver';
import { DIFFICULTIES } from '../src/solver/grader';
import type { Step } from '../src/solver/types';

function assertConsistent(steps: Step[], solution: ArrayLike<number>) {
  for (const s of steps) {
    for (const p of s.placements) expect(p.value, s.title).toBe(solution[p.cell]);
    for (const e of s.eliminations) expect(e.value, s.title).not.toBe(solution[e.cell]);
  }
}

describe('logical solver', () => {
  it('solves a famously hard puzzle with trials and stays consistent', () => {
    const geo = getGeometry({ boxRows: 3, boxCols: 3 });
    const p = decodePuzzle(geo.spec, '8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..');
    const { solution } = checkUniqueness(geo, p);
    const res = solveLogically(geo, p, { solution: solution! });
    expect(res.solved).toBe(true);
    assertConsistent(res.steps, solution!);
  });

  it('solves without a known solution (trial falls back to search)', () => {
    const geo = getGeometry({ boxRows: 3, boxCols: 3 });
    const p = decodePuzzle(geo.spec, '4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......');
    const res = solveLogically(geo, p);
    expect(res.solved).toBe(true);
  });
});

describe.each(SIZE_PRESETS)('generator $label', ({ spec }) => {
  const geo = getGeometry(spec);
  const diffs = geo.size >= 12 ? DIFFICULTIES.slice(0, 2) : DIFFICULTIES;
  it.each(diffs)('$label puzzles are unique and solve consistently', ({ id }) => {
    for (let i = 0; i < (geo.size <= 9 ? 3 : 1); i++) {
      const g = generatePuzzle(spec, id, 1000 + i, geo.size <= 9 ? 800 : 3000);
      const u = checkUniqueness(geo, g.puzzle);
      expect(u.status).toBe('unique');
      expect([...u.solution!]).toEqual(g.solution);
      const res = solveLogically(geo, g.puzzle, { solution: g.solution });
      expect(res.solved).toBe(true);
      assertConsistent(res.steps, g.solution);
    }
  });
});
