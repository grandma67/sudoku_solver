import { useState } from 'react';
import type { Responses } from '../workers/protocol';
import { DIFFICULTIES, difficultyForLevel } from '../solver/grader';

type Analysis = Responses['analyze'];

interface ScanSummary {
  warpedUrl: string;
  givens: number;
  uncertain: number;
  corrected: number;
}

interface Props {
  size: number;
  scan?: ScanSummary;
  onScan: () => void;
  onAdjustScan: () => void;
  analysis: Analysis | null;
  busy: boolean;
  onPaste: (text: string) => string | null;
  onClear: () => void;
  onCheck: () => void;
  onPlay: () => void;
  onSolve: () => void;
  onExit: () => void;
}

const STATUS_TEXT: Record<Analysis['status'], string> = {
  unique: 'Valid puzzle with exactly one solution.',
  multiple: 'This puzzle has more than one solution. Add more givens.',
  none: 'This puzzle has no solution.',
  conflict: 'Some givens conflict with each other (marked in red).',
  unknown: 'Could not finish checking in time. Try adding more givens.',
};

export function CustomPanel(p: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ok = p.analysis?.status === 'unique';
  return (
    <div className="card custom-panel">
      <h2>Custom puzzle</h2>
      {p.scan ? (
        <div className="scan-summary">
          <img src={p.scan.warpedUrl} alt="Scanned grid" />
          <div>
            <p className="small">
              <strong>Scanned {p.scan.givens} givens.</strong>{' '}
              {p.scan.uncertain
                ? `${p.scan.uncertain} cell${p.scan.uncertain > 1 ? 's are' : ' is'} marked with a dashed ring — please check them against the photo.`
                : 'Compare with the photo, then check the puzzle.'}
              {p.scan.corrected ? ` ${p.scan.corrected} reading${p.scan.corrected > 1 ? 's were' : ' was'} fixed using sudoku rules.` : ''}
            </p>
            <div className="row">
              <button className="btn" onClick={p.onAdjustScan}>
                Adjust corners
              </button>
              <button className="btn" onClick={p.onScan}>
                Rescan
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button className="btn" onClick={p.onScan}>
          📷 Scan from a photo or camera
        </button>
      )}
      <p className="muted small">
        Select a cell and type to enter givens, or paste a puzzle string ({p.size * p.size} characters, use <code>.</code> or{' '}
        <code>0</code> for empty cells{p.size > 9 ? ', A–G for 10–16' : ''}).
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={p.size === 9 ? '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79' : 'Paste puzzle…'}
        rows={3}
        spellCheck={false}
      />
      {error ? <p className="error small">{error}</p> : null}
      <div className="row">
        <button className="btn" onClick={() => setError(p.onPaste(text))} disabled={!text.trim()}>
          Load text
        </button>
        <button className="btn" onClick={p.onClear}>
          Clear board
        </button>
      </div>
      <button className="btn primary" onClick={p.onCheck} disabled={p.busy}>
        {p.busy ? 'Checking…' : 'Check puzzle'}
      </button>
      {p.analysis ? (
        <div className={`analysis ${ok ? 'good' : 'bad'}`}>
          <p>{STATUS_TEXT[p.analysis.status]}</p>
          {ok ? (
            <p className="small">
              Difficulty: <strong>{DIFFICULTIES.find((d) => d.id === difficultyForLevel(p.analysis!.level))?.label}</strong>
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="row">
        <button className="btn primary" onClick={p.onPlay} disabled={!ok}>
          Play it
        </button>
        <button className="btn" onClick={p.onSolve} disabled={!ok}>
          Solve step by step
        </button>
      </div>
      <button className="btn ghost" onClick={p.onExit}>
        Back to game
      </button>
    </div>
  );
}
