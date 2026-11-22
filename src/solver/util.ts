import { bit, valuesOf } from '../engine/bitset';
import { cellName, type Geometry } from '../engine/geometry';
import type { CandRole, CellValue, Highlights } from './types';

export const V = (v: number): string => `{${v}}`;

export const listValues = (vals: number[]): string => joinWords(vals.map(V));

export const listCells = (geo: Geometry, cells: number[]): string => joinWords(cells.map((c) => cellName(geo, c)));

export function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function addCands(h: Highlights, cell: number, mask: number, role: CandRole): void {
  for (const v of valuesOf(mask)) h.candidates.push({ cell, value: v, role });
}

export function addElims(h: Highlights, elims: CellValue[]): void {
  for (const e of elims) h.candidates.push({ cell: e.cell, value: e.value, role: 'eliminate' });
}

/** Units that contain every given cell. */
export function commonUnits(geo: Geometry, cells: number[]): number[] {
  return geo.unitsOf[cells[0]].filter((u) => cells.every((c) => geo.unitsOf[c].includes(u)));
}

/** Collects eliminations of the values in `mask` from `targets`. */
export function eliminationsFor(cands: Uint16Array, targets: Iterable<number>, mask: number): CellValue[] {
  const out: CellValue[] = [];
  for (const cell of targets) {
    const hit = cands[cell] & mask;
    if (hit) for (const v of valuesOf(hit)) out.push({ cell, value: v });
  }
  return out;
}

export const hasCand = (cands: Uint16Array, cell: number, v: number): boolean => (cands[cell] & bit(v)) !== 0;

export const uniqueCells = (elims: CellValue[]): number[] => [...new Set(elims.map((e) => e.cell))];
