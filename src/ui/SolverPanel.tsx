import { useEffect, useMemo, useRef } from 'react';
import { TECHNIQUE_BY_ID } from '../solver/techniques';
import type { Step } from '../solver/types';
import type { SymbolSet } from '../themes/symbols';
import { RichText } from './Glyph';
import { IconClose, IconFirst, IconLast, IconNext, IconPause, IconPlay, IconPrev } from './icons';

interface Props {
  steps: Step[];
  index: number;
  setIndex: (i: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  speed: number;
  setSpeed: (ms: number) => void;
  symbols: SymbolSet;
  canContinue: boolean;
  onContinue: () => void;
  onExit: () => void;
}

export function SolverPanel(p: Props) {
  const { steps, index, setIndex } = p;
  const total = steps.length;
  const step = index < total ? steps[index] : null;
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [index]);

  const stats = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of steps) m.set(s.technique, (m.get(s.technique) ?? 0) + 1);
    return [...m.entries()]
      .map(([id, count]) => ({ t: TECHNIQUE_BY_ID[id as Step['technique']], count }))
      .sort((a, b) => b.t.level - a.t.level || b.count - a.count);
  }, [steps]);

  return (
    <div className="card solver-panel">
      <header className="solver-head">
        <h2>Step-by-step solver</h2>
        <button className="icon-btn" onClick={p.onExit} aria-label="Exit solver">
          <IconClose />
        </button>
      </header>

      <div className="progress" aria-label={`Step ${index} of ${total}`}>
        <div className="progress-bar" style={{ width: `${total ? (index / total) * 100 : 100}%` }} />
      </div>

      <div className="step-now">
        {step ? (
          <>
            <div className="step-meta">
              <span className={`level-tag l${TECHNIQUE_BY_ID[step.technique].level}`}>
                {TECHNIQUE_BY_ID[step.technique].name}
              </span>
              <span className="muted small">
                Step {index + 1} / {total}
              </span>
            </div>
            <h3>
              <RichText text={step.title} set={p.symbols} />
            </h3>
            <p>
              <RichText text={step.explanation} set={p.symbols} />
            </p>
            <Legend />
          </>
        ) : (
          <div className="solved-msg">
            <h3>Solved! 🎉</h3>
            <p className="muted">
              {total} steps using {stats.length} technique{stats.length === 1 ? '' : 's'}.
            </p>
          </div>
        )}
      </div>

      <div className="transport">
        <button className="icon-btn" onClick={() => setIndex(0)} disabled={index === 0} aria-label="First step">
          <IconFirst />
        </button>
        <button className="icon-btn" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} aria-label="Previous step">
          <IconPrev />
        </button>
        <button
          className="icon-btn big primary"
          onClick={() => {
            if (index >= total) setIndex(0);
            p.setPlaying(!p.playing);
          }}
          aria-label={p.playing ? 'Pause' : 'Play'}
        >
          {p.playing ? <IconPause /> : <IconPlay />}
        </button>
        <button className="icon-btn" onClick={() => setIndex(Math.min(total, index + 1))} disabled={index >= total} aria-label="Next step">
          <IconNext />
        </button>
        <button className="icon-btn" onClick={() => setIndex(total)} disabled={index >= total} aria-label="Last step">
          <IconLast />
        </button>
      </div>
      <label className="speed">
        <span className="muted small">Speed</span>
        <input
          type="range"
          min={150}
          max={2500}
          step={50}
          value={2650 - p.speed}
          onChange={(e) => p.setSpeed(2650 - Number(e.target.value))}
        />
      </label>

      <div className="tech-stats">
        {stats.map(({ t, count }) => (
          <span key={t.id} className={`level-tag l${t.level}`} title={t.summary}>
            {t.name} × {count}
          </span>
        ))}
      </div>

      <ol className="step-list" ref={listRef}>
        {steps.map((s, i) => (
          <li key={i} className={i === index ? 'active' : i < index ? 'done' : ''}>
            <button onClick={() => setIndex(i)}>
              <span className={`dot-level l${TECHNIQUE_BY_ID[s.technique].level}`} />
              <span className="step-num">{i + 1}</span>
              <span className="step-title">
                <RichText text={s.title} set={p.symbols} />
              </span>
            </button>
          </li>
        ))}
      </ol>

      {p.canContinue ? (
        <button className="btn" onClick={p.onContinue}>
          Continue playing from this step
        </button>
      ) : null}
    </div>
  );
}

function Legend() {
  return (
    <div className="legend small">
      <span><i className="sw sw-place" /> placed</span>
      <span><i className="sw sw-elim" /> removed</span>
      <span><i className="sw sw-cause" /> reason</span>
      <span><i className="sw sw-unit" /> area</span>
    </div>
  );
}
