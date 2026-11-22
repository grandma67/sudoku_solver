/// <reference lib="webworker" />
import type { Point } from '../scan/image';
import { scanImage, ScanError } from '../scan/scan';

export interface ScanRequest {
  id: number;
  image: { width: number; height: number; data: Uint8ClampedArray };
  size?: number;
  corners?: Point[];
}

self.onmessage = (e: MessageEvent<ScanRequest>) => {
  const { id, image, size, corners } = e.data;
  const post = (msg: unknown, transfer: Transferable[] = []) =>
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer);
  try {
    const result = scanImage(image, { size, corners });
    post({ id, ok: true, result }, [result.warped.data.buffer]);
  } catch (err) {
    post({ id, ok: false, error: err instanceof Error ? err.message : String(err), userError: err instanceof ScanError });
  }
};
