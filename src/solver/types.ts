import type { Geometry } from '../engine/geometry';

export type TechniqueId =
  | 'hidden-single'
  | 'naked-single'
  | 'pointing'
  | 'claiming'
  | 'naked-pair'
  | 'hidden-pair'
  | 'naked-triple'
  | 'hidden-triple'
  | 'naked-quad'
  | 'x-wing'
  | 'swordfish'
  | 'jellyfish'
  | 'xy-wing'
  | 'xyz-wing'
  | 'trial';

export interface CellValue {
  cell: number;
  value: number;
}

export type CellRole = 'target' | 'pattern' | 'peer';
export type CandRole = 'cause' | 'eliminate' | 'place';

export interface Highlights {
  cells: { cell: number; role: CellRole }[];
  units: number[];
  candidates: { cell: number; value: number; role: CandRole }[];
  links: { from: number; to: number }[];
}

/**
 * One deduction. `explanation` uses `{v}` tokens for values so the UI can render
 * them with the active symbol set (digits, letters, emoji…).
 */
export interface Step {
  technique: TechniqueId;
  title: string;
  placements: CellValue[];
  eliminations: CellValue[];
  highlights: Highlights;
  explanation: string;
}

export interface SolveState {
  geo: Geometry;
  values: Uint8Array;
  cands: Uint16Array;
}

export interface SolveContext {
  /** Known solution — required for the 'trial' fallback. */
  solution?: ArrayLike<number>;
}

export interface Technique {
  id: TechniqueId;
  name: string;
  level: 1 | 2 | 3 | 4;
  summary: string;
  find(s: SolveState, ctx: SolveContext): Step | null;
}

export const emptyHighlights = (): Highlights => ({ cells: [], units: [], candidates: [], links: [] });
