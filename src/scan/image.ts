/** Minimal grayscale image toolkit used by the scanner (runs in a worker or in Node tests). */
export interface Gray {
  width: number;
  height: number;
  /** 0 = black, 255 = white */
  data: Uint8Array;
}

export interface Point {
  x: number;
  y: number;
}

export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/** Luma conversion with area-averaged downscaling so the longest side is at most `maxSide`. */
export function toGray(img: RGBAImage, maxSide = 1200): Gray {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const sum = new Float64Array(w * h);
  const cnt = new Uint32Array(w * h);
  for (let y = 0; y < img.height; y++) {
    const ty = Math.min(h - 1, Math.floor(y * scale));
    for (let x = 0; x < img.width; x++) {
      const tx = Math.min(w - 1, Math.floor(x * scale));
      const i = (y * img.width + x) * 4;
      const a = img.data[i + 3] / 255;
      // Transparent pixels count as white paper.
      const l = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
      sum[ty * w + tx] += l * a + 255 * (1 - a);
      cnt[ty * w + tx]++;
    }
  }
  const data = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) data[i] = cnt[i] ? Math.round(sum[i] / cnt[i]) : 255;
  return { width: w, height: h, data };
}

export function median(g: Gray): number {
  const hist = new Uint32Array(256);
  for (const v of g.data) hist[v]++;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= g.data.length / 2) return v;
  }
  return 255;
}

/** Makes ink dark and paper light (handles dark-mode screenshots and chalkboards). */
export function normalizePolarity(g: Gray): Gray {
  if (median(g) >= 110) return g;
  return { ...g, data: g.data.map((v) => 255 - v) };
}

/** Mean-based adaptive threshold using an integral image. Returns 1 for ink. */
export function adaptiveThreshold(g: Gray, radius: number, offset: number): Uint8Array {
  const { width: w, height: h, data } = g;
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += data[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius), y1 = Math.min(h, y + radius + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius), x1 = Math.min(w, x + radius + 1);
      const s =
        integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const mean = s / ((x1 - x0) * (y1 - y0));
      out[y * w + x] = data[y * w + x] < mean - offset ? 1 : 0;
    }
  }
  return out;
}

export interface Component {
  label: number;
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 8-connected component labelling. `labels` holds component index + 1 (0 = background). */
export function components(mask: Uint8Array, w: number, h: number): { labels: Int32Array; comps: Component[] } {
  const labels = new Int32Array(w * h);
  const comps: Component[] = [];
  const stack = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || labels[start]) continue;
    const label = comps.length + 1;
    const c: Component = { label, area: 0, minX: w, minY: h, maxX: 0, maxY: 0 };
    let sp = 0;
    stack[sp++] = start;
    labels[start] = label;
    while (sp) {
      const p = stack[--sp];
      const x = p % w, y = (p - x) / w;
      c.area++;
      if (x < c.minX) c.minX = x;
      if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y;
      if (y > c.maxY) c.maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (mask[q] && !labels[q]) {
            labels[q] = label;
            stack[sp++] = q;
          }
        }
      }
    }
    comps.push(c);
  }
  return { labels, comps };
}

/** Otsu threshold over a set of gray values. Returns [threshold, between-class std dev]. */
export function otsu(values: ArrayLike<number>): [number, number] {
  const hist = new Float64Array(256);
  for (let i = 0; i < values.length; i++) hist[values[i]]++;
  const total = values.length;
  let sumAll = 0;
  for (let v = 0; v < 256; v++) sumAll += v * hist[v];
  let wB = 0, sumB = 0, best = 0, bestT = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      bestT = t;
    }
  }
  return [bestT, Math.sqrt(best) / total];
}
