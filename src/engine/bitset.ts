/** Candidate masks: value v (1-based) is stored in bit (v-1). Board sizes up to 16 fit in 16 bits. */
export const bit = (v: number): number => 1 << (v - 1);

export function popcount(m: number): number {
  m = m - ((m >>> 1) & 0x55555555);
  m = (m & 0x33333333) + ((m >>> 2) & 0x33333333);
  return (((m + (m >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export function valuesOf(m: number): number[] {
  const out: number[] = [];
  let v = 1;
  while (m) {
    if (m & 1) out.push(v);
    m >>>= 1;
    v++;
  }
  return out;
}

/** Lowest value present in mask (1-based), or 0 for an empty mask. */
export function firstValue(m: number): number {
  if (!m) return 0;
  return 32 - Math.clz32(m & -m);
}

/**
 * Calls cb with every k-combination of indices [0, n). Stops early when cb returns true.
 * Returns true if stopped early.
 */
export function forEachCombination(n: number, k: number, cb: (idx: number[]) => boolean | void): boolean {
  if (k > n || k <= 0) return false;
  const idx = Array.from({ length: k }, (_, i) => i);
  for (;;) {
    if (cb(idx)) return true;
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return false;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}
