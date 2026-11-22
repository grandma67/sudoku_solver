import { useState } from 'react';
import { SIZE_PRESETS } from '../engine/geometry';
import { DIFFICULTIES, type Difficulty } from '../solver/grader';
import { Modal } from './Modal';

interface Props {
  sizeId: string;
  difficulty: Difficulty;
  onStart: (sizeId: string, difficulty: Difficulty) => void;
  onClose: () => void;
}

function MiniGrid({ boxRows, boxCols }: { boxRows: number; boxCols: number }) {
  const n = boxRows * boxCols;
  return (
    <div className="mini-grid" style={{ gridTemplateColumns: `repeat(${n / boxCols}, 1fr)` }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="mini-box" style={{ gridTemplateColumns: `repeat(${boxCols}, 1fr)` }}>
          {Array.from({ length: n }, (_, j) => (
            <i key={j} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function NewGameDialog(p: Props) {
  const [sizeId, setSizeId] = useState(p.sizeId);
  const [difficulty, setDifficulty] = useState(p.difficulty);
  const size = Number(sizeId);
  return (
    <Modal title="New game" onClose={p.onClose}>
      <h3 className="section-label">Board size</h3>
      <div className="size-grid">
        {SIZE_PRESETS.map((s) => (
          <button key={s.id} className={`size-card${s.id === sizeId ? ' active' : ''}`} onClick={() => setSizeId(s.id)}>
            <MiniGrid {...s.spec} />
            <span>{s.label}</span>
            <span className="muted small">
              {s.spec.boxRows}×{s.spec.boxCols} boxes
            </span>
          </button>
        ))}
      </div>
      <h3 className="section-label">Difficulty</h3>
      <div className="segmented">
        {DIFFICULTIES.map((d) => (
          <button key={d.id} className={d.id === difficulty ? 'active' : ''} onClick={() => setDifficulty(d.id)}>
            {d.label}
          </button>
        ))}
      </div>
      {size <= 6 && difficulty !== 'easy' ? (
        <p className="muted small">Small boards rarely need advanced techniques, so the puzzle may come out easier than requested.</p>
      ) : null}
      {size >= 12 ? <p className="muted small">Giant boards take a few seconds to generate.</p> : null}
      <button className="btn primary wide" onClick={() => p.onStart(sizeId, difficulty)}>
        Start
      </button>
    </Modal>
  );
}
