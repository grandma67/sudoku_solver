/**
 * Board geometry for any sudoku built from rectangular boxes.
 * size = boxRows * boxCols; there are `size` rows, columns and boxes.
 * Unit indices: rows [0, n), columns [n, 2n), boxes [2n, 3n).
 */
export interface BoardSpec {
  boxRows: number;
  boxCols: number;
}

export type UnitKind = 'row' | 'col' | 'box';

export interface Geometry {
  spec: BoardSpec;
  key: string;
  size: number;
  cellCount: number;
  full: number;
  rowOf: number[];
  colOf: number[];
  boxOf: number[];
  units: number[][];
  unitKind: UnitKind[];
  /** For each cell: [rowUnit, colUnit, boxUnit] */
  unitsOf: [number, number, number][];
  peers: number[][];
  /** peerMatrix[a * cellCount + b] === 1 when a and b share a unit (a !== b). */
  peerMatrix: Uint8Array;
}

export interface SizePreset {
  id: string;
  label: string;
  spec: BoardSpec;
}

export const SIZE_PRESETS: SizePreset[] = [
  { id: '4', label: '4×4', spec: { boxRows: 2, boxCols: 2 } },
  { id: '6', label: '6×6', spec: { boxRows: 2, boxCols: 3 } },
  { id: '8', label: '8×8', spec: { boxRows: 2, boxCols: 4 } },
  { id: '9', label: '9×9', spec: { boxRows: 3, boxCols: 3 } },
  { id: '12', label: '12×12', spec: { boxRows: 3, boxCols: 4 } },
  { id: '16', label: '16×16', spec: { boxRows: 4, boxCols: 4 } },
];

export const specKey = (s: BoardSpec): string => `${s.boxRows}x${s.boxCols}`;

const cache = new Map<string, Geometry>();

export function getGeometry(spec: BoardSpec): Geometry {
  const key = specKey(spec);
  const hit = cache.get(key);
  if (hit) return hit;

  const { boxRows, boxCols } = spec;
  const size = boxRows * boxCols;
  if (size < 4 || size > 16) throw new Error(`Unsupported board size ${size}`);
  const cellCount = size * size;
  const boxesPerRow = size / boxCols;

  const rowOf: number[] = [];
  const colOf: number[] = [];
  const boxOf: number[] = [];
  const units: number[][] = Array.from({ length: size * 3 }, () => []);
  const unitKind: UnitKind[] = [];
  for (let i = 0; i < size; i++) unitKind[i] = 'row';
  for (let i = 0; i < size; i++) unitKind[size + i] = 'col';
  for (let i = 0; i < size; i++) unitKind[2 * size + i] = 'box';

  const unitsOf: [number, number, number][] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    const r = Math.floor(cell / size);
    const c = cell % size;
    const b = Math.floor(r / boxRows) * boxesPerRow + Math.floor(c / boxCols);
    rowOf.push(r);
    colOf.push(c);
    boxOf.push(b);
    units[r].push(cell);
    units[size + c].push(cell);
    units[2 * size + b].push(cell);
    unitsOf.push([r, size + c, 2 * size + b]);
  }

  const peerMatrix = new Uint8Array(cellCount * cellCount);
  const peers: number[][] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    const set = new Set<number>();
    for (const u of unitsOf[cell]) for (const p of units[u]) if (p !== cell) set.add(p);
    const list = [...set].sort((a, b) => a - b);
    peers.push(list);
    for (const p of list) peerMatrix[cell * cellCount + p] = 1;
  }

  const geo: Geometry = {
    spec,
    key,
    size,
    cellCount,
    full: (1 << size) - 1,
    rowOf,
    colOf,
    boxOf,
    units,
    unitKind,
    unitsOf,
    peers,
    peerMatrix,
  };
  cache.set(key, geo);
  return geo;
}

export const sees = (geo: Geometry, a: number, b: number): boolean =>
  geo.peerMatrix[a * geo.cellCount + b] === 1;

export const cellName = (geo: Geometry, cell: number): string =>
  `R${geo.rowOf[cell] + 1}C${geo.colOf[cell] + 1}`;

export function unitName(geo: Geometry, unit: number): string {
  const kind = geo.unitKind[unit];
  const idx = (unit % geo.size) + 1;
  return kind === 'row' ? `row ${idx}` : kind === 'col' ? `column ${idx}` : `box ${idx}`;
}

export const kindName = (kind: UnitKind): string =>
  kind === 'row' ? 'row' : kind === 'col' ? 'column' : 'box';
