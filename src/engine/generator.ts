import { searchSolutions } from './bruteforce';
import { getGeometry, type BoardSpec, type Geometry } from './geometry';
import { mulberry32, shuffle, type Rng } from './rng';
import { solveLogically } from '../solver/logicalSolver';
import { difficultyForLevel, levelOf, type Difficulty } from '../solver/grader';

export interface GeneratedPuzzle {
  spec: BoardSpec;
  puzzle: number[];
  solution: number[];
  difficulty: Difficulty;
  level: number;
  seed: number;
}

/** Valid "pattern" grid, used as a fallback when random filling runs out of budget. */
function patternGrid(geo: Geometry): Uint8Array {
  const { boxRows, boxCols } = geo.spec;
  const n = geo.size;
  const g = new Uint8Array(geo.cellCount);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) g[r * n + c] = (((r % boxRows) * boxCols + Math.floor(r / boxRows) + c) % n) + 1;
  return g;
}

/** Validity-preserving shuffle: symbols, rows within bands, bands, columns within stacks, stacks. */
function shuffleGrid(geo: Geometry, g: Uint8Array, rng: Rng): Uint8Array {
  const n = geo.size;
  const { boxRows, boxCols } = geo.spec;
  const sym = shuffle([...Array(n).keys()].map((i) => i + 1), rng);
  const bands = shuffle([...Array(n / boxRows).keys()], rng);
  const rows = bands.flatMap((b) => shuffle([...Array(boxRows).keys()].map((i) => b * boxRows + i), rng));
  const stacks = shuffle([...Array(n / boxCols).keys()], rng);
  const cols = stacks.flatMap((s) => shuffle([...Array(boxCols).keys()].map((i) => s * boxCols + i), rng));
  const out = new Uint8Array(geo.cellCount);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out[r * n + c] = sym[g[rows[r] * n + cols[c]] - 1];
  return out;
}

export function fillGrid(geo: Geometry, rng: Rng): Uint8Array {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = searchSolutions(geo, new Uint8Array(geo.cellCount), 1, { rng, nodeBudget: 50_000 });
    if (res.solution) return res.solution;
  }
  return shuffleGrid(geo, patternGrid(geo), rng);
}

/** Minimum fraction of cells kept as givens, so easier puzzles feel easier. */
const GIVENS_FLOOR: Record<Difficulty, number> = { easy: 0.5, medium: 0.38, hard: 0, expert: 0 };

function carve(geo: Geometry, full: Uint8Array, difficulty: Difficulty, rng: Rng, deadline: number): Uint8Array {
  const cap = levelOf(difficulty);
  const puzzle = full.slice();
  const N = geo.cellCount;
  const floor = Math.ceil(N * GIVENS_FLOOR[difficulty]);
  let givens = N;
  const order = shuffle([...Array(Math.ceil(N / 2)).keys()], rng);
  for (const a of order) {
    if (Date.now() > deadline) break;
    const b = N - 1 - a; // 180° rotational symmetry
    const pair = a === b ? [a] : [a, b];
    if (givens - pair.length < floor) continue;
    for (const c of pair) puzzle[c] = 0;
    let ok: boolean;
    if (cap < 4) {
      // Solvable by the allowed techniques ⇒ unique (all techniques are sound deductions).
      ok = solveLogically(geo, puzzle, { maxLevel: cap }).solved;
    } else {
      const res = searchSolutions(geo, puzzle, 2, { nodeBudget: 200_000 });
      ok = res.count === 1 && !res.aborted;
    }
    if (ok) givens -= pair.length;
    else for (const c of pair) puzzle[c] = full[c];
  }
  return puzzle;
}

export function generatePuzzle(spec: BoardSpec, difficulty: Difficulty, seed: number, timeLimitMs?: number): GeneratedPuzzle {
  const geo = getGeometry(spec);
  const rng = mulberry32(seed);
  const target = levelOf(difficulty);
  const limit = timeLimitMs ?? (geo.size <= 9 ? 2500 : 4000);
  const start = Date.now();
  const deadline = start + limit;
  let best: { puzzle: Uint8Array; solution: Uint8Array; level: number; dist: number; givens: number } | null = null;

  // Small boards cannot produce hard patterns; accept what they can do.
  const maxReachable = geo.size <= 4 ? 1 : geo.size <= 6 ? Math.min(target, 3) : target;

  for (;;) {
    const full = fillGrid(geo, rng);
    // Give each attempt a slice of the budget so big boards still finish.
    const attemptDeadline = Math.min(deadline, Date.now() + Math.max(400, limit * 0.6));
    const puzzle = carve(geo, full, difficulty, rng, attemptDeadline);
    const graded = solveLogically(geo, puzzle, { solution: full });
    const level = graded.solved ? graded.maxLevel : 4;
    const givens = puzzle.reduce((n, v) => n + (v ? 1 : 0), 0);
    const dist = Math.abs(level - target);
    if (!best || dist < best.dist || (dist === best.dist && givens < best.givens)) {
      best = { puzzle, solution: full, level, dist, givens };
    }
    if (level >= maxReachable && level <= target) break;
    if (Date.now() > deadline) break;
  }

  return {
    spec,
    puzzle: [...best!.puzzle],
    solution: [...best!.solution],
    level: best!.level,
    difficulty: difficultyForLevel(best!.level),
    seed,
  };
}
