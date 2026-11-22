import type { Gray, Point } from './image';

/** 3×3 homography as a flat array (row-major, h[8] = 1). */
export type Homography = number[];

/** Solves for H such that H·src_i ∝ dst_i for four point pairs. */
export function homography(src: Point[], dst: Point[]): Homography {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  // Gaussian elimination with partial pivoting on the 8×9 augmented matrix.
  for (let col = 0; col < 8; col++) {
    let piv = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[col], A[piv]] = [A[piv], A[col]];
    const d = A[col][col];
    if (Math.abs(d) < 1e-12) throw new Error('Degenerate corners');
    for (let c = col; c < 9; c++) A[col][c] /= d;
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = A[r][col];
      if (f) for (let c = col; c < 9; c++) A[r][c] -= f * A[col][c];
    }
  }
  return [...A.map((row) => row[8]), 1];
}

export function project(h: Homography, x: number, y: number): Point {
  const w = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}

/**
 * Warps the quadrilateral `corners` (TL, TR, BR, BL) of `src` into a size×size square,
 * sampling with bilinear interpolation.
 */
export function warpSquare(src: Gray, corners: Point[], size: number): Gray {
  const square = [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ];
  const h = homography(square, corners); // maps output → source
  const out = new Uint8Array(size * size);
  const { width: w, height: hh, data } = src;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = project(h, x + 0.5, y + 0.5);
      const sx = p.x - 0.5, sy = p.y - 0.5;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const fx = sx - x0, fy = sy - y0;
      const at = (xx: number, yy: number) =>
        data[Math.min(hh - 1, Math.max(0, yy)) * w + Math.min(w - 1, Math.max(0, xx))];
      const v =
        at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
      out[y * size + x] = Math.round(v);
    }
  }
  return { width: size, height: size, data: out };
}
