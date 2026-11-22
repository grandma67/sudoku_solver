import type { Geometry } from '../engine/geometry';
import { applyStep, cloneState, createState } from '../solver/logicalSolver';
import type { Step } from '../solver/types';

export interface Frame {
  values: number[];
  cands: number[];
}

/** frames[i] is the board before step i; frames[steps.length] is the final board. */
export function buildFrames(geo: Geometry, start: ArrayLike<number>, steps: Step[]): Frame[] {
  let s = createState(geo, start);
  const frames: Frame[] = [{ values: Array.from(s.values), cands: Array.from(s.cands) }];
  for (const step of steps) {
    s = cloneState(s);
    applyStep(s, step);
    frames.push({ values: Array.from(s.values), cands: Array.from(s.cands) });
  }
  return frames;
}
