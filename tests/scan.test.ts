import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { encodePuzzle } from '../src/engine/serialize';
import { scanImage } from '../src/scan/scan';

const dir = new URL('./fixtures/', import.meta.url);
const expected: Record<string, { size: number; puzzle: string }> = JSON.parse(readFileSync(new URL('expected.json', dir), 'utf8'));

async function load(file: string) {
  const img = await loadImage(readFileSync(new URL(file, dir)));
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

const diff = (a: string, b: string) => [...a].filter((ch, i) => ch !== b[i]).length;

describe('scanner', () => {
  it.each(Object.entries(expected))('%s: detects the grid, size and digits', async (file, exp) => {
    const res = scanImage(await load(file));
    const n = res.spec.boxRows * res.spec.boxCols;
    expect(n).toBe(exp.size);
    const got = encodePuzzle(res.values);
    if (got !== exp.puzzle) console.log(file, '\n got', got, '\n exp', exp.puzzle, '\n uncertain', res.uncertain);
    expect(diff(got, exp.puzzle)).toBe(0);
  });

  it('uses manual corners and a forced size', async () => {
    const file = 'paper-9-flat.png';
    const img = await load(file);
    const auto = scanImage(img);
    const res = scanImage(img, { corners: auto.corners, size: 9 });
    expect(encodePuzzle(res.values)).toBe(expected[file].puzzle);
  });
});
