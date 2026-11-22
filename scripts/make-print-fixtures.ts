/**
 * Dev tool: draws "printed newspaper" sudoku photos with fonts the recognizer never trained on,
 * independent of the app's rendering. Writes into tests/fixtures and updates expected.json.
 * Usage: npx tsx scripts/make-print-fixtures.ts   (macOS fonts)
 */
import { createCanvas } from '@napi-rs/canvas';
import { readFileSync, writeFileSync } from 'node:fs';
import { generatePuzzle } from '../src/engine/generator';
import { encodePuzzle } from '../src/engine/serialize';
import { mulberry32 } from '../src/engine/rng';

interface Spec {
  file: string;
  boxRows: number;
  boxCols: number;
  font: string;
  rotate: number;
  shear: number;
  seed: number;
  dark?: boolean;
}

const SPECS: Spec[] = [
  { file: 'print-9-bodoni.jpg', boxRows: 3, boxCols: 3, font: 'Bodoni 72', rotate: -9, shear: 0.08, seed: 5 },
  { file: 'print-6-marion.jpg', boxRows: 2, boxCols: 3, font: 'Marion', rotate: 6, shear: -0.05, seed: 6 },
  { file: 'print-9-stix-chalk.jpg', boxRows: 3, boxCols: 3, font: 'STIX Two Text', rotate: 3, shear: 0.04, seed: 7, dark: true },
  { file: 'print-12-narrow.jpg', boxRows: 3, boxCols: 4, font: 'Arial Narrow', rotate: -4, shear: 0.03, seed: 8 },
];

const fixtures = new URL('../tests/fixtures/', import.meta.url);
const expected = JSON.parse(readFileSync(new URL('expected.json', fixtures), 'utf8'));
const LABELS = '123456789ABCDEFG';

for (const s of SPECS) {
  const n = s.boxRows * s.boxCols;
  const { puzzle } = generatePuzzle({ boxRows: s.boxRows, boxCols: s.boxCols }, 'easy', s.seed, 1000);
  const rng = mulberry32(s.seed);
  const W = 1100, H = 900;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  // desk
  const desk = ctx.createLinearGradient(0, 0, W, H);
  desk.addColorStop(0, s.dark ? '#3a3a3a' : '#c9b48f');
  desk.addColorStop(1, s.dark ? '#1c1c1c' : '#a48a62');
  ctx.fillStyle = desk;
  ctx.fillRect(0, 0, W, H);

  const size = 620;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((s.rotate * Math.PI) / 180);
  ctx.transform(1, 0, s.shear, 1, 0, 0);
  // paper (newsprint) or chalkboard
  ctx.fillStyle = s.dark ? '#1f2a24' : '#efeadf';
  ctx.fillRect(-size / 2 - 60, -size / 2 - 80, size + 120, size + 160);
  ctx.fillStyle = s.dark ? '#d8d8d0' : '#2a2a2a';
  ctx.font = `bold 22px "${s.font}"`;
  ctx.fillText(`SUDOKU No. ${s.seed * 117}`, -size / 2, -size / 2 - 30);
  const ink = s.dark ? '#e6e6dc' : '#1b1b1b';
  const cell = size / n;
  ctx.strokeStyle = ink;
  for (let k = 0; k <= n; k++) {
    const thick = k % s.boxCols === 0;
    ctx.lineWidth = thick ? 4 : 1.2;
    ctx.beginPath();
    ctx.moveTo(-size / 2 + k * cell, -size / 2);
    ctx.lineTo(-size / 2 + k * cell, size / 2);
    ctx.stroke();
  }
  for (let k = 0; k <= n; k++) {
    ctx.lineWidth = k % s.boxRows === 0 ? 4 : 1.2;
    ctx.beginPath();
    ctx.moveTo(-size / 2, -size / 2 + k * cell);
    ctx.lineTo(size / 2, -size / 2 + k * cell);
    ctx.stroke();
  }
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${cell * 0.62}px "${s.font}"`;
  puzzle.forEach((v, i) => {
    if (!v) return;
    const r = Math.floor(i / n), c = i % n;
    ctx.fillText(LABELS[v - 1], -size / 2 + (c + 0.5) * cell, -size / 2 + (r + 0.52) * cell);
  });
  ctx.restore();

  // uneven lighting + sensor noise
  const light = ctx.createRadialGradient(W * 0.3, H * 0.2, 50, W * 0.5, H * 0.5, W * 0.8);
  light.addColorStop(0, 'rgba(255,255,255,0.12)');
  light.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const noise = (rng() - 0.5) * 30;
    for (let k = 0; k < 3; k++) img.data[i + k] = Math.max(0, Math.min(255, img.data[i + k] + noise));
  }
  ctx.putImageData(img, 0, 0);
  writeFileSync(new URL(s.file, fixtures), canvas.toBuffer('image/jpeg', 82));
  expected[s.file] = { size: n, puzzle: encodePuzzle(puzzle) };
  console.log('wrote', s.file);
}
writeFileSync(new URL('expected.json', fixtures), JSON.stringify(expected, null, 2) + '\n');
