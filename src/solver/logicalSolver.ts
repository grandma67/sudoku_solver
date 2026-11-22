import { bit } from '../engine/bitset';
import { computeCandidates } from '../engine/grid';
import type { Geometry } from '../engine/geometry';
import { TECHNIQUES, TECHNIQUE_BY_ID } from './techniques';
import type { SolveState, Step } from './types';

export interface SolveOptions {
  maxLevel?: number;
  solution?: ArrayLike<number>;
  maxSteps?: number;
  /** Stop right after the first step that places a value (used for hints). */
  untilPlacement?: boolean;
}

export interface SolveResult {
  steps: Step[];
  solved: boolean;
  /** True if a contradiction was found (a cell with no candidates). */
  invalid: boolean;
  maxLevel: number;
  values: Uint8Array;
}

export function createState(geo: Geometry, values: ArrayLike<number>): SolveState {
  const v = Uint8Array.from(values as ArrayLike<number>);
  return { geo, values: v, cands: computeCandidates(geo, v) };
}

export function cloneState(s: SolveState): SolveState {
  return { geo: s.geo, values: s.values.slice(), cands: s.cands.slice() };
}

export function applyStep(s: SolveState, step: Step): void {
  for (const e of step.eliminations) s.cands[e.cell] &= ~bit(e.value);
  for (const p of step.placements) {
    s.values[p.cell] = p.value;
    s.cands[p.cell] = 0;
    for (const peer of s.geo.peers[p.cell]) s.cands[peer] &= ~bit(p.value);
  }
}

function hasContradiction(s: SolveState): boolean {
  for (let c = 0; c < s.geo.cellCount; c++) if (!s.values[c] && !s.cands[c]) return true;
  return false;
}

export function solveLogically(geo: Geometry, values: ArrayLike<number>, opts: SolveOptions = {}): SolveResult {
  const maxLevel = opts.maxLevel ?? 4;
  const maxSteps = opts.maxSteps ?? 5000;
  const techniques = TECHNIQUES.filter((t) => t.level <= maxLevel);
  const state = createState(geo, values);
  const steps: Step[] = [];
  let usedLevel = 0;

  for (;;) {
    if (state.values.every((v) => v !== 0)) return { steps, solved: true, invalid: false, maxLevel: usedLevel, values: state.values };
    if (hasContradiction(state) || steps.length >= maxSteps)
      return { steps, solved: false, invalid: hasContradiction(state), maxLevel: usedLevel, values: state.values };
    let step: Step | null = null;
    for (const t of techniques) {
      step = t.find(state, { solution: opts.solution });
      if (step) break;
    }
    if (!step) return { steps, solved: false, invalid: false, maxLevel: usedLevel, values: state.values };
    usedLevel = Math.max(usedLevel, TECHNIQUE_BY_ID[step.technique].level);
    applyStep(state, step);
    steps.push(step);
    if (opts.untilPlacement && step.placements.length) {
      return { steps, solved: state.values.every((v) => v !== 0), invalid: false, maxLevel: usedLevel, values: state.values };
    }
  }
}
