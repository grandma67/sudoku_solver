import { TECHNIQUE_BY_ID } from '../solver/techniques';
import type { Step } from '../solver/types';
import type { SymbolSet } from '../themes/symbols';
import { RichText } from './Glyph';
import { IconClose } from './icons';

export type HintState =
  | { kind: 'mistakes'; cells: number[] }
  | { kind: 'step'; steps: Step[]; tier: 1 | 2; cands: number[] };

interface Props {
  hint: HintState;
  symbols: SymbolSet;
  onReveal: () => void;
  onApply: () => void;
  onRemoveMistakes: () => void;
  onClose: () => void;
}

export function HintCard({ hint, symbols, onReveal, onApply, onRemoveMistakes, onClose }: Props) {
  if (hint.kind === 'mistakes') {
    return (
      <div className="card hint-card warn" role="status">
        <button className="icon-btn close" onClick={onClose} aria-label="Close hint">
          <IconClose />
        </button>
        <h3>Something is off</h3>
        <p>
          {hint.cells.length === 1 ? 'One entry does' : `${hint.cells.length} entries do`} not match the solution. They are
          marked on the board.
        </p>
        <button className="btn primary" onClick={onRemoveMistakes}>
          Remove mistakes
        </button>
      </div>
    );
  }
  const last = hint.steps[hint.steps.length - 1];
  const tech = TECHNIQUE_BY_ID[last.technique];
  const prior = hint.steps.slice(0, -1);
  return (
    <div className="card hint-card" role="status">
      <button className="icon-btn close" onClick={onClose} aria-label="Close hint">
        <IconClose />
      </button>
      <div className={`level-tag l${tech.level}`}>{tech.name}</div>
      {hint.tier === 1 ? (
        <>
          <p className="muted">{tech.summary}</p>
          {prior.length ? (
            <p className="muted small">
              It becomes visible after {prior.length} candidate elimination{prior.length > 1 ? 's' : ''} (
              {[...new Set(prior.map((s) => TECHNIQUE_BY_ID[s.technique].name))].join(', ')}).
            </p>
          ) : null}
          <button className="btn primary" onClick={onReveal}>
            Show me where
          </button>
        </>
      ) : (
        <>
          {prior.length ? (
            <details className="prior">
              <summary>
                First, {prior.length} elimination step{prior.length > 1 ? 's' : ''}
              </summary>
              <ol>
                {prior.map((s, i) => (
                  <li key={i}>
                    <RichText text={s.explanation} set={symbols} />
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
          <p>
            <RichText text={last.explanation} set={symbols} />
          </p>
          <button className="btn primary" onClick={onApply}>
            Apply this step
          </button>
        </>
      )}
    </div>
  );
}
