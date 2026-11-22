/**
 * Dev tool: runs the scanner on images and writes the perspective-corrected grid next to them.
 * Usage: npx tsx scripts/debug-scan.ts <outDir> <image...>
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { encodePuzzle } from '../src/engine/serialize';
import { detectSize, findGridCorners } from '../src/scan/grid';
import { normalizePolarity, toGray } from '../src/scan/image';
import { warpSquare } from '../src/scan/perspective';
import { scanImage } from '../src/scan/scan';

const [outDir, ...files] = process.argv.slice(2);
for (const file of files) {
  const img = await loadImage(readFileSync(file));
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height);
  const gray = normalizePolarity(toGray(data));
  const corners = findGridCorners(gray);
  console.log(`\n${basename(file)} gray ${gray.width}x${gray.height} corners`, corners?.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' '));
  if (!corners) continue;
  const w = normalizePolarity(warpSquare(gray, corners, 576));
  const { size, scores } = detectSize(w);
  console.log('size', size, Object.entries(scores).map(([k, v]) => `${k}:${v.toFixed(2)}`).join(' '));
  try {
    const res = scanImage(data);
    console.log('values', encodePuzzle(res.values));
    const out = createCanvas(res.warped.width, res.warped.height);
    const octx = out.getContext('2d');
    const id = octx.createImageData(res.warped.width, res.warped.height);
    res.warped.data.forEach((v, i) => {
      id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v;
      id.data[i * 4 + 3] = 255;
    });
    octx.putImageData(id, 0, 0);
    writeFileSync(`${outDir}/warped-${basename(file)}.png`, out.toBuffer('image/png'));
  } catch (e) {
    console.log('scan error', (e as Error).message);
  }
}
