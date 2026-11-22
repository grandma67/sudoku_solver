import { useCallback, useEffect, useRef, useState } from 'react';
import { SIZE_PRESETS } from '../engine/geometry';
import type { Point } from '../scan/image';
import type { ScanResult } from '../scan/scan';
import { scanInWorker } from '../workers/scanClient';
import { IconCamera, IconImage } from './icons';
import { Modal } from './Modal';

/** A captured photo, downscaled for processing, plus a URL to show it. */
export interface Photo {
  image: ImageData;
  url: string;
}

export interface ScanOutcome {
  result: ScanResult;
  photo: Photo;
  /** Size the user forced, or undefined for auto. */
  size?: number;
}

const MAX_SIDE = 1600;

function canvasToPhoto(canvas: HTMLCanvasElement): Photo {
  const ctx = canvas.getContext('2d')!;
  return { image: ctx.getImageData(0, 0, canvas.width, canvas.height), url: canvas.toDataURL('image/jpeg', 0.85) };
}

function drawScaled(source: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function photoFromBlob(blob: Blob): Promise<Photo> {
  const bitmap = await createImageBitmap(blob); // honours EXIF orientation
  const photo = canvasToPhoto(drawScaled(bitmap, bitmap.width, bitmap.height));
  bitmap.close();
  return photo;
}

type Stage = 'choose' | 'camera' | 'processing' | 'adjust';

interface Props {
  /** Re-open on an existing photo to adjust corners. */
  initial?: { photo: Photo; corners: Point[]; size?: number };
  /** Image to process right away (e.g. pasted). */
  blob?: Blob;
  onResult: (outcome: ScanOutcome) => void;
  onClose: () => void;
}

export function ScanDialog({ initial, blob, onResult, onClose }: Props) {
  const [stage, setStage] = useState<Stage>(initial ? 'adjust' : 'choose');
  const [photo, setPhoto] = useState<Photo | null>(initial?.photo ?? null);
  const [corners, setCorners] = useState<Point[] | null>(initial?.corners ?? null);
  const [size, setSize] = useState<number | undefined>(initial?.size);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = useCallback(
    async (p: Photo, manual?: Point[]) => {
      setPhoto(p);
      setError(null);
      setStage('processing');
      try {
        const result = await scanInWorker(p.image, { size, corners: manual });
        onResult({ result, photo: p, size });
      } catch (err) {
        setError(
          `${(err as Error).message} Drag the four corners onto the outer corners of the grid, then scan again.`,
        );
        const { width: w, height: h } = p.image;
        setCorners(
          manual ?? [
            { x: w * 0.15, y: h * 0.15 },
            { x: w * 0.85, y: h * 0.15 },
            { x: w * 0.85, y: h * 0.85 },
            { x: w * 0.15, y: h * 0.85 },
          ],
        );
        setStage('adjust');
      }
    },
    [onResult, size],
  );

  const fromBlob = useCallback(
    async (blob: Blob) => {
      try {
        await run(await photoFromBlob(blob));
      } catch {
        setError('That file could not be read as an image.');
        setStage('choose');
      }
    },
    [run],
  );

  // Process an image handed in by the caller (e.g. pasted outside the dialog).
  const started = useRef(false);
  useEffect(() => {
    if (blob && !started.current) {
      started.current = true;
      fromBlob(blob);
    }
  }, [blob, fromBlob]);

  // Paste an image from the clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        fromBlob(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [fromBlob]);

  return (
    <Modal title="Scan a puzzle" onClose={onClose} className="scan-dialog">
      {stage === 'choose' ? (
        <>
          <div
            className={`dropzone${dragOver ? ' over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
              if (file) fromBlob(file);
            }}
          >
            <div className="scan-art" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <p>Take a photo of a sudoku from a newspaper, book or screen, and it becomes a playable board.</p>
            <div className="row">
              {'mediaDevices' in navigator ? (
                <button className="btn primary" onClick={() => setStage('camera')}>
                  <IconCamera /> Use camera
                </button>
              ) : null}
              <button className="btn" onClick={() => fileRef.current?.click()}>
                <IconImage /> Choose photo
              </button>
            </div>
            <p className="muted small">…or drop an image here, or paste one with ⌘V / Ctrl+V.</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) fromBlob(f);
                e.target.value = '';
              }}
            />
          </div>
          <SizePicker size={size} onChange={setSize} />
          {error ? <p className="error small">{error}</p> : null}
          <ul className="tips small muted">
            <li>Fill most of the frame with the grid and keep all four corners visible.</li>
            <li>Even light without glare works best; a slight angle is fine.</li>
            <li>Printed digits work best. Pencil marks inside cells may be misread.</li>
          </ul>
        </>
      ) : null}

      {stage === 'camera' ? (
        <Camera
          onCapture={(p) => run(p)}
          onCancel={() => setStage('choose')}
          onError={(msg) => {
            setError(msg);
            setStage('choose');
          }}
        />
      ) : null}

      {stage === 'processing' ? (
        <div className="scan-processing">
          {photo ? <img src={photo.url} alt="" /> : null}
          <div className="scan-beam" />
          <div className="overlay busy" role="status">
            <div className="spinner" />
            <span>Reading the puzzle…</span>
          </div>
        </div>
      ) : null}

      {stage === 'adjust' && photo && corners ? (
        <>
          {error ? <p className="error small">{error}</p> : <p className="muted small">Drag the four handles onto the outer corners of the grid.</p>}
          <CornerEditor photo={photo} corners={corners} onChange={setCorners} />
          <SizePicker size={size} onChange={setSize} />
          <div className="row">
            <button className="btn" onClick={() => setStage('choose')}>
              Use another photo
            </button>
            <button className="btn primary" onClick={() => run(photo, corners)}>
              Scan with these corners
            </button>
          </div>
        </>
      ) : null}
    </Modal>
  );
}

function SizePicker({ size, onChange }: { size?: number; onChange: (s?: number) => void }) {
  return (
    <div className="size-picker">
      <span className="muted small">Board size</span>
      <div className="segmented">
        <button className={size === undefined ? 'active' : ''} onClick={() => onChange(undefined)}>
          Auto
        </button>
        {SIZE_PRESETS.map((p) => {
          const n = p.spec.boxRows * p.spec.boxCols;
          return (
            <button key={p.id} className={size === n ? 'active' : ''} onClick={() => onChange(n)}>
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Camera({ onCapture, onCancel, onError }: { onCapture: (p: Photo) => void; onCancel: () => void; onError: (m: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const v = videoRef.current!;
        v.srcObject = s;
        v.onloadedmetadata = () => {
          v.play();
          setReady(true);
        };
      })
      .catch((err: Error) =>
        onError(
          err.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow it in your browser settings, or choose a photo instead.'
            : 'No camera is available. Choose a photo instead.',
        ),
      );
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onError]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    onCapture(canvasToPhoto(drawScaled(v, v.videoWidth, v.videoHeight)));
  };

  return (
    <div className="camera">
      <div className="camera-view">
        <video ref={videoRef} playsInline muted />
        <div className="camera-guide" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        {!ready ? (
          <div className="overlay busy">
            <div className="spinner" />
            <span>Starting camera…</span>
          </div>
        ) : null}
      </div>
      <p className="muted small center">Line the grid up with the frame, then capture.</p>
      <div className="row">
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" onClick={capture} disabled={!ready}>
          <IconCamera /> Capture
        </button>
      </div>
    </div>
  );
}

/** Photo with four draggable corner handles (TL, TR, BR, BL) in image pixel coordinates. */
function CornerEditor({ photo, corners, onChange }: { photo: Photo; corners: Point[]; onChange: (c: Point[]) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const { width: W, height: H } = photo.image;

  const toImage = (e: React.PointerEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(W, ((e.clientX - r.left) / r.width) * W)),
      y: Math.max(0, Math.min(H, ((e.clientY - r.top) / r.height) * H)),
    };
  };

  return (
    <div
      ref={wrapRef}
      className="corner-editor"
      style={{ aspectRatio: `${W} / ${H}` }}
      onPointerMove={(e) => {
        if (drag.current === null) return;
        const next = [...corners];
        next[drag.current] = toImage(e);
        onChange(next);
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
    >
      <img src={photo.url} alt="Captured puzzle" draggable={false} />
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <polygon points={corners.map((p) => `${p.x},${p.y}`).join(' ')} />
      </svg>
      {corners.map((p, i) => (
        <button
          key={i}
          className="handle"
          style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
          aria-label={['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'][i] + ' corner'}
          onPointerDown={(e) => {
            e.preventDefault();
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            drag.current = i;
          }}
        />
      ))}
    </div>
  );
}
