import { DIFFICULTIES } from '../solver/grader';
import type { Game } from '../state/gameReducer';
import { Modal } from './Modal';

export const formatTime = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

export function WinDialog({ game, onNew, onClose }: { game: Game; onNew: () => void; onClose: () => void }) {
  const n = game.spec.boxRows * game.spec.boxCols;
  return (
    <Modal title="Puzzle solved!" onClose={onClose} className="win">
      <div className="win-trophy" aria-hidden="true">🏆</div>
      <div className="stats">
        <div><span className="stat">{formatTime(game.elapsed)}</span><span className="muted small">time</span></div>
        <div><span className="stat">{game.mistakes}</span><span className="muted small">mistakes</span></div>
        <div><span className="stat">{game.hintsUsed}</span><span className="muted small">hints</span></div>
        <div>
          <span className="stat">{DIFFICULTIES.find((d) => d.id === game.difficulty)?.label}</span>
          <span className="muted small">{n}×{n}</span>
        </div>
      </div>
      {game.usedSolver ? <p className="muted small center">Solved with help from the solver.</p> : null}
      <button className="btn primary wide" onClick={onNew}>
        New game
      </button>
    </Modal>
  );
}
