import type { Point } from '../scan/image';
import type { ScanResult } from '../scan/scan';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: ScanResult) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./scan.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: ScanResult; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok && e.data.result) p.resolve(e.data.result);
    else p.reject(new Error(e.data.error ?? 'Scan failed'));
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'Scanner crashed'));
    pending.clear();
    worker = null;
  };
  return worker;
}

/** Scans an image off the main thread. */
export function scanInWorker(image: ImageData, opts: { size?: number; corners?: Point[] } = {}): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, image: { width: image.width, height: image.height, data: image.data }, ...opts });
  });
}
