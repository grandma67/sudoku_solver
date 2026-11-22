/**
 * Trains the scanner's digit recognizer from synthetic cells rendered with system fonts.
 * Usage: npm run train:ocr   (macOS recommended; writes src/scan/model.json)
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { CLASSES, extractGlyphs, FEATURE_SIZE } from '../src/scan/glyph';
import { pack, predict, type Mlp } from '../src/scan/model';
import { mulberry32 } from '../src/engine/rng';

const WANTED = [
  'Helvetica', 'Helvetica Neue', 'Arial', 'Arial Black', 'Arial Rounded MT Bold', 'Times New Roman', 'Georgia',
  'Courier New', 'Courier', 'Verdana', 'Trebuchet MS', 'Futura', 'Avenir', 'Avenir Next', 'Gill Sans', 'Menlo',
  'Monaco', 'Andale Mono', 'PT Mono', 'American Typewriter', 'Baskerville', 'Didot', 'Optima', 'Palatino',
  'Rockwell', 'Impact', 'Tahoma', 'Charter', 'Cochin', 'Hoefler Text', 'Skia', 'PT Sans', 'PT Serif', 'Big Caslon',
  'Copperplate', 'DIN Alternate', 'DIN Condensed', 'Seravek', 'Lucida Grande', 'Iowan Old Style', 'Superclarendon',
  'Athelas', 'Galvji', 'Silom', 'Krungthep', 'Kohinoor Devanagari', 'Sukhumvit Set', 'Phosphate', 'Luminari',
  'Chalkboard', 'Chalkduster', 'Marker Felt', 'Bradley Hand', 'Noteworthy', 'Comic Sans MS', 'SignPainter',
];
const HOLDOUT = ['Georgia', 'Verdana', 'Noteworthy', 'Gill Sans', 'Menlo', 'Kalam'];

// Extra OFL fonts (the app's own fonts plus handwriting styles) downloaded into scripts/.fonts.
const fontDir = new URL('./.fonts/', import.meta.url);
if (existsSync(fontDir)) {
  for (const file of readdirSync(fontDir).filter((f) => f.endsWith('.ttf'))) {
    const alias = file.replace('.ttf', '');
    GlobalFonts.registerFromPath(new URL(file, fontDir).pathname, alias);
    WANTED.push(alias);
  }
} else {
  console.warn('scripts/.fonts not found — training on system fonts only (see README).');
}

const available = new Set(GlobalFonts.families.map((f) => f.family));
const fonts = WANTED.filter((f) => available.has(f));
const finalRun = process.argv.includes('--final');
const trainFonts = finalRun ? fonts : fonts.filter((f) => !HOLDOUT.includes(f));
const testFonts = fonts.filter((f) => HOLDOUT.includes(f));
console.log(`${fonts.length} fonts available; training on ${trainFonts.length}${finalRun ? ' (final)' : ''}`);

const C = 48;
const rng = mulberry32(1234);
const rand = (a: number, b: number) => a + (b - a) * rng();
const gauss = () => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());

function renderCell(ch: string, font: string): Float32Array | null {
  const f = rand(0.35, 1); // render resolution factor → blur / pixelation
  const R = Math.max(14, Math.round(C * f));
  const canvas = createCanvas(R, R);
  const ctx = canvas.getContext('2d');
  const bg = rand(170, 255);
  const ink = rand(0, Math.max(0, bg - 100));
  ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
  ctx.fillRect(0, 0, R, R);
  // grid line remnants near the borders
  const line = Math.round(ink + rand(0, 60));
  ctx.fillStyle = `rgb(${line},${line},${line})`;
  for (let side = 0; side < 4; side++) {
    if (rng() < 0.25) continue;
    const w = Math.max(1, rand(0.02, 0.09) * R);
    const off = rand(-0.04, 0.09) * R;
    if (side === 0) ctx.fillRect(0, off - w / 2, R, w);
    if (side === 1) ctx.fillRect(0, R - off - w / 2, R, w);
    if (side === 2) ctx.fillRect(off - w / 2, 0, w, R);
    if (side === 3) ctx.fillRect(R - off - w / 2, 0, w, R);
  }
  ctx.save();
  ctx.translate(R / 2 + rand(-0.07, 0.07) * R, R / 2 + rand(-0.07, 0.07) * R);
  ctx.rotate(rand(-7, 7) * (Math.PI / 180));
  ctx.transform(rand(0.85, 1.15), 0, rand(-0.12, 0.12), 1, 0, 0);
  const size = rand(0.45, 0.8) * R;
  ctx.font = `${rng() < 0.35 ? 'bold ' : ''}${size.toFixed(1)}px "${font}"`;
  ctx.fillStyle = `rgb(${ink},${ink},${ink})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const m = ctx.measureText(ch);
  const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
  ctx.fillText(ch, 0, (asc - desc) / 2);
  ctx.restore();

  const up = createCanvas(C, C);
  const uctx = up.getContext('2d');
  uctx.imageSmoothingEnabled = true;
  uctx.drawImage(canvas, 0, 0, C, C);
  const rgba = uctx.getImageData(0, 0, C, C).data;
  const sigma = rand(0, 14);
  const data = new Uint8Array(C * C);
  for (let i = 0; i < C * C; i++) data[i] = Math.max(0, Math.min(255, Math.round(rgba[i * 4] + gauss() * sigma)));
  const { glyphs } = extractGlyphs({ width: C, height: C, data }, false);
  return glyphs.length === 1 ? glyphs[0] : null;
}

function dataset(fontList: string[], perCombo: number) {
  const xs: Float32Array[] = [];
  const ys: number[] = [];
  let failed = 0;
  for (const font of fontList)
    for (let k = 0; k < CLASSES.length; k++)
      for (let i = 0; i < perCombo; i++) {
        const x = renderCell(CLASSES[k], font);
        if (x) {
          xs.push(x);
          ys.push(k);
        } else failed++;
      }
  return { xs, ys, failed };
}

function train(xs: Float32Array[], ys: number[], hidden: number, epochs: number): Mlp {
  const I = FEATURE_SIZE, H = hidden, K = CLASSES.length;
  const m: Mlp = {
    inputs: I,
    hidden: H,
    classes: K,
    w1: Float32Array.from({ length: H * I }, () => gauss() * Math.sqrt(2 / I)),
    b1: new Float32Array(H),
    w2: Float32Array.from({ length: K * H }, () => gauss() * Math.sqrt(2 / H)),
    b2: new Float32Array(K),
  };
  const params = [m.w1, m.b1, m.w2, m.b2];
  const grads = params.map((p) => new Float32Array(p.length));
  const mom = params.map((p) => new Float32Array(p.length));
  const vel = params.map((p) => new Float32Array(p.length));
  const [b1m, b2m, eps] = [0.9, 0.999, 1e-8];
  let step = 0;
  const order = xs.map((_, i) => i);
  const h = new Float32Array(H), o = new Float32Array(K), dh = new Float32Array(H);
  const batch = 64;
  for (let ep = 0; ep < epochs; ep++) {
    const lr = 0.002 * Math.pow(0.8, ep);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let loss = 0;
    for (let s = 0; s < order.length; s += batch) {
      grads.forEach((g) => g.fill(0));
      const end = Math.min(order.length, s + batch);
      for (let b = s; b < end; b++) {
        const x = xs[order[b]], y = ys[order[b]];
        for (let u = 0; u < H; u++) {
          let a = m.b1[u];
          const off = u * I;
          for (let q = 0; q < I; q++) a += m.w1[off + q] * x[q];
          h[u] = a > 0 ? a : 0;
        }
        let max = -Infinity;
        for (let k = 0; k < K; k++) {
          let a = m.b2[k];
          for (let u = 0; u < H; u++) a += m.w2[k * H + u] * h[u];
          o[k] = a;
          if (a > max) max = a;
        }
        let sum = 0;
        for (let k = 0; k < K; k++) sum += o[k] = Math.exp(o[k] - max);
        for (let k = 0; k < K; k++) o[k] /= sum;
        loss -= Math.log(o[y] + 1e-9);
        dh.fill(0);
        for (let k = 0; k < K; k++) {
          const d = o[k] - (k === y ? 1 : 0);
          grads[3][k] += d;
          for (let u = 0; u < H; u++) {
            grads[2][k * H + u] += d * h[u];
            dh[u] += d * m.w2[k * H + u];
          }
        }
        for (let u = 0; u < H; u++) {
          if (h[u] <= 0) continue;
          const d = dh[u];
          grads[1][u] += d;
          const off = u * I;
          for (let q = 0; q < I; q++) if (x[q]) grads[0][off + q] += d * x[q];
        }
      }
      step++;
      const n = end - s;
      for (let p = 0; p < params.length; p++) {
        const P = params[p], G = grads[p], M = mom[p], V = vel[p];
        for (let i = 0; i < P.length; i++) {
          const g = G[i] / n + (p % 2 === 0 ? 1e-4 * P[i] : 0);
          M[i] = b1m * M[i] + (1 - b1m) * g;
          V[i] = b2m * V[i] + (1 - b2m) * g * g;
          P[i] -= (lr * (M[i] / (1 - b1m ** step))) / (Math.sqrt(V[i] / (1 - b2m ** step)) + eps);
        }
      }
    }
    console.log(`epoch ${ep + 1}/${epochs} loss ${(loss / order.length).toFixed(4)}`);
  }
  return m;
}

function accuracy(m: Mlp, xs: Float32Array[], ys: number[], digitsOnly = false) {
  let ok = 0, total = 0;
  const confusion = new Map<string, number>();
  for (let i = 0; i < xs.length; i++) {
    if (digitsOnly && (ys[i] < 1 || ys[i] > 9)) continue;
    const p = predict(m, xs[i]);
    let best = digitsOnly ? 1 : 0;
    for (let k = 0; k < p.length; k++) {
      if (digitsOnly && (k < 1 || k > 9)) continue;
      if (p[k] > p[best]) best = k;
    }
    total++;
    if (best === ys[i]) ok++;
    else {
      const key = `${CLASSES[ys[i]]}→${CLASSES[best]}`;
      confusion.set(key, (confusion.get(key) ?? 0) + 1);
    }
  }
  const worst = [...confusion.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  return { acc: ok / total, worst };
}

const t0 = Date.now();
const per = Number(process.env.PER ?? 45);
const trainSet = dataset(trainFonts, per);
console.log(`train samples ${trainSet.xs.length} (extraction failed ${trainSet.failed}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const model = train(trainSet.xs, trainSet.ys, 96, Number(process.env.EPOCHS ?? 12));
console.log('train acc', accuracy(model, trainSet.xs, trainSet.ys).acc.toFixed(4));
if (testFonts.length && !finalRun) {
  const test = dataset(testFonts, 20);
  const all = accuracy(model, test.xs, test.ys);
  const digits = accuracy(model, test.xs, test.ys, true);
  console.log(`held-out fonts (${testFonts.join(', ')}): all classes ${all.acc.toFixed(4)}, digits 1–9 only ${digits.acc.toFixed(4)}`);
  console.log('most confused:', all.worst.map(([k, v]) => `${k}×${v}`).join(' '));
}
writeFileSync(new URL('../src/scan/model.json', import.meta.url), JSON.stringify(pack(model)));
console.log(`wrote src/scan/model.json in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
