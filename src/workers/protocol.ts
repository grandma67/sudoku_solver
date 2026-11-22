import type { BoardSpec } from '../engine/geometry';
import type { Uniqueness } from '../engine/bruteforce';
import type { GeneratedPuzzle } from '../engine/generator';
import type { Difficulty } from '../solver/grader';
import type { Step } from '../solver/types';

export interface Requests {
  generate: { spec: BoardSpec; difficulty: Difficulty; seed: number };
  analyze: { spec: BoardSpec; values: number[] };
  solve: { spec: BoardSpec; values: number[]; solution?: number[]; untilPlacement?: boolean };
}

export interface Responses {
  generate: GeneratedPuzzle;
  analyze: { status: Uniqueness | 'conflict'; solution: number[] | null; level: number };
  solve: { steps: Step[]; solved: boolean; level: number };
}

export type RequestType = keyof Requests;

export interface WorkerRequest<T extends RequestType = RequestType> {
  id: number;
  type: T;
  payload: Requests[T];
}

export type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };
