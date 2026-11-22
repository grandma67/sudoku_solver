import { getGeometry, SIZE_PRESETS, specKey, type BoardSpec } from './geometry';

const ALPHABET = '123456789ABCDEFG';

export function encodePuzzle(values: ArrayLike<number>): string {
  let s = '';
  for (let i = 0; i < values.length; i++) s += values[i] ? ALPHABET[values[i] - 1] : '.';
  return s;
}

/** Parses a puzzle string; '.', '0', '-', '_' and '*' are empty. Whitespace and | + separators are ignored. */
export function decodePuzzle(spec: BoardSpec, text: string): number[] {
  const geo = getGeometry(spec);
  const n = geo.size;
  const cleaned = text.toUpperCase().replace(/[\s|+]/g, '');
  const out: number[] = [];
  for (const ch of cleaned) {
    if ('.0-_*'.includes(ch)) out.push(0);
    else {
      const v = ALPHABET.indexOf(ch) + 1;
      if (v < 1 || v > n) throw new Error(`Invalid symbol "${ch}" for a ${n}×${n} board`);
      out.push(v);
    }
  }
  if (out.length !== geo.cellCount) {
    throw new Error(`Expected ${geo.cellCount} cells for ${n}×${n}, got ${out.length}`);
  }
  return out;
}

export function puzzleToHash(spec: BoardSpec, values: ArrayLike<number>): string {
  return `#p=${specKey(spec)}.${encodePuzzle(values)}`;
}

export function hashToPuzzle(hash: string): { spec: BoardSpec; values: number[] } | null {
  const m = /^#p=(\d+)x(\d+)\.([1-9A-G.]+)$/i.exec(hash);
  if (!m) return null;
  const spec = { boxRows: +m[1], boxCols: +m[2] };
  if (!SIZE_PRESETS.some((p) => specKey(p.spec) === specKey(spec))) return null;
  try {
    return { spec, values: decodePuzzle(spec, m[3]) };
  } catch {
    return null;
  }
}
