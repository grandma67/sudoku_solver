/// <reference lib="webworker" />
import { checkUniqueness } from '../engine/bruteforce';
import { generatePuzzle } from '../engine/generator';
import { getGeometry } from '../engine/geometry';
import { findConflicts } from '../engine/validate';
import { solveLogically } from '../solver/logicalSolver';
import type { Requests, Responses, WorkerRequest, WorkerResponse } from './protocol';

const handlers: { [K in keyof Requests]: (p: Requests[K]) => Responses[K] } = {
  generate: ({ spec, difficulty, seed }) => generatePuzzle(spec, difficulty, seed),
  analyze: ({ spec, values }) => {
    const geo = getGeometry(spec);
    if (findConflicts(geo, values).size) return { status: 'conflict', solution: null, level: 0 };
    const res = checkUniqueness(geo, values, 20_000_000);
    let level = 0;
    if (res.status === 'unique' && res.solution) {
      level = solveLogically(geo, values, { solution: res.solution }).maxLevel;
    }
    return { status: res.status, solution: res.solution ? [...res.solution] : null, level };
  },
  solve: ({ spec, values, solution, untilPlacement }) => {
    const res = solveLogically(getGeometry(spec), values, { solution, untilPlacement });
    return { steps: res.steps, solved: res.solved, level: res.maxLevel };
  },
};

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = e.data;
  let msg: WorkerResponse;
  try {
    const result = (handlers[type] as (p: unknown) => unknown)(payload);
    msg = { id, ok: true, result };
  } catch (err) {
    msg = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);
};
