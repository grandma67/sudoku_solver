import confetti from 'canvas-confetti';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { getGeometry, SIZE_PRESETS, specKey, type BoardSpec } from '../engine/geometry';
import { randomSeed } from '../engine/rng';
import { decodePuzzle, hashToPuzzle, puzzleToHash } from '../engine/serialize';
import { findConflicts } from '../engine/validate';
import { DIFFICULTIES, difficultyForLevel, type Difficulty } from '../solver/grader';
import { applyStep, createState } from '../solver/logicalSolver';
import type { Step } from '../solver/types';
import { gameReducer, initialGameState, newGame } from '../state/gameReducer';
import { loadGame, loadSettings, saveGame, saveSettings } from '../state/persistence';
import type { Settings } from '../state/settings';
import { getSymbolSet } from '../themes/symbols';
import { applyTheme, getTheme } from '../themes/themes';
import { callEngine } from '../workers/client';
import type { Responses } from '../workers/protocol';
import { Background } from './Background';
import { Board } from './Board';
import { CustomPanel } from './CustomPanel';
import { HintCard, type HintState } from './HintCard';
import {
  IconBrain,
  IconBulb,
  IconClock,
  IconEdit,
  IconErase,
  IconGear,
  IconPause,
  IconPencil,
  IconPlay,
  IconPlus,
  IconRedo,
  IconRestart,
  IconShare,
  IconUndo,
  IconWand,
} from './icons';
import { NewGameDialog } from './NewGameDialog';
import { NumberPad } from './NumberPad';
import { SettingsDialog } from './SettingsDialog';
import { SolverPanel } from './SolverPanel';
import { buildFrames, type Frame } from './walkthrough';
import { formatTime, WinDialog } from './WinDialog';

type Mode = 'play' | 'solve' | 'custom';

interface Walkthrough {
  spec: BoardSpec;
  given: boolean[];
  steps: Step[];
  frames: Frame[];
  index: number;
  source: 'game' | 'custom';
}

interface CustomState {
  spec: BoardSpec;
  values: number[];
  selected: number | null;
  analysis: Responses['analyze'] | null;
}

const specFor = (sizeId: string): BoardSpec => (SIZE_PRESETS.find((p) => p.id === sizeId) ?? SIZE_PRESETS[3]).spec;
const sizeLabel = (spec: BoardSpec) => `${spec.boxRows * spec.boxCols}×${spec.boxRows * spec.boxCols}`;
const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [state, dispatch] = useReducer(gameReducer, initialGameState, (s) => ({ ...s, game: loadGame() }));
  const [mode, setMode] = useState<Mode>('play');
  const [busy, setBusy] = useState<string | null>(null);
  const [hint, setHint] = useState<HintState | null>(null);
  const [walk, setWalk] = useState<Walkthrough | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(900);
  const [custom, setCustom] = useState<CustomState | null>(null);
  const [dialog, setDialog] = useState<'new' | 'settings' | 'win' | null>(null);
  const [paused, setPaused] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const game = state.game;
  const theme = getTheme(settings.themeId);
  const symbols = getSymbolSet(settings.symbolSetId === 'auto' ? (theme.suggestedSymbols ?? 'numbers') : settings.symbolSetId);
  const patchSettings = useCallback((p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p })), []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }, []);

  // ---- persistence & theme -------------------------------------------------
  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveGame(game), [game]);

  // ---- game lifecycle ------------------------------------------------------
  const startNewGame = useCallback(
    async (sizeId: string, difficulty: Difficulty) => {
      const spec = specFor(sizeId);
      setDialog(null);
      setHint(null);
      setWalk(null);
      setPlaying(false);
      setPaused(false);
      setCelebrate(false);
      setBusy(`Generating ${sizeLabel(spec)} ${DIFFICULTIES.find((d) => d.id === difficulty)?.label} puzzle…`);
      try {
        const res = await callEngine('generate', { spec, difficulty, seed: randomSeed() });
        dispatch({ type: 'load', game: newGame(spec, res.puzzle, res.solution, res.difficulty) });
        setMode('play');
        if (res.difficulty !== difficulty) {
          showToast(`Best match for ${sizeLabel(spec)}: ${DIFFICULTIES.find((d) => d.id === res.difficulty)?.label}`);
        }
      } catch (err) {
        showToast(`Generation failed: ${(err as Error).message}`);
      } finally {
        setBusy(null);
      }
    },
    [showToast],
  );

  const loadShared = useCallback(
    async (spec: BoardSpec, values: number[]) => {
      setBusy('Loading shared puzzle…');
      try {
        const res = await callEngine('analyze', { spec, values });
        if (res.status !== 'unique' || !res.solution) {
          showToast('The shared puzzle is not valid.');
          return false;
        }
        dispatch({ type: 'load', game: newGame(spec, values, res.solution, difficultyForLevel(res.level), true) });
        setMode('play');
        return true;
      } finally {
        setBusy(null);
      }
    },
    [showToast],
  );

  // First load: shared link > saved game > new game.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const shared = hashToPuzzle(window.location.hash);
    if (shared) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      loadShared(shared.spec, shared.values).then((ok) => {
        if (!ok && !state.game) startNewGame(settings.sizeId, settings.difficulty);
      });
    } else if (!state.game) {
      startNewGame(settings.sizeId, settings.difficulty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer: ticks only while actively playing and visible.
  useEffect(() => {
    if (mode !== 'play' || !game || game.won || paused || busy || dialog) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') dispatch({ type: 'tick' });
    }, 1000);
    return () => window.clearInterval(id);
  }, [mode, game?.won, paused, busy, dialog, !!game]); // eslint-disable-line react-hooks/exhaustive-deps

  // Win detection.
  const wasWon = useRef(game?.won ?? false);
  useEffect(() => {
    const won = game?.won ?? false;
    if (won && !wasWon.current) {
      setCelebrate(true);
      setDialog('win');
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const colors = [theme.vars['--accent'], theme.vars['--accent-2'], theme.vars['--entry']];
        confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors });
        window.setTimeout(() => confetti({ particleCount: 90, angle: 60, spread: 60, origin: { x: 0 }, colors }), 250);
        window.setTimeout(() => confetti({ particleCount: 90, angle: 120, spread: 60, origin: { x: 1 }, colors }), 400);
      }
    }
    wasWon.current = won;
  }, [game?.won]); // eslint-disable-line react-hooks/exhaustive-deps

  // Any board change invalidates a pending hint.
  useEffect(() => setHint(null), [game?.values, game?.notes]);

  // ---- derived board data --------------------------------------------------
  const geo = useMemo(() => {
    if (mode === 'solve' && walk) return getGeometry(walk.spec);
    if (mode === 'custom' && custom) return getGeometry(custom.spec);
    return game ? getGeometry(game.spec) : getGeometry(specFor(settings.sizeId));
  }, [mode, walk, custom, game, settings.sizeId]);

  const conflicts = useMemo(() => {
    if (mode === 'custom' && custom) return findConflicts(geo, custom.values);
    if (mode === 'play' && game) return findConflicts(geo, game.values);
    return new Set<number>();
  }, [mode, custom, game, geo]);

  const wrong = useMemo(() => {
    if (mode !== 'play' || !game) return new Set<number>();
    const show = settings.showMistakes || hint?.kind === 'mistakes';
    if (!show) return new Set<number>();
    const s = new Set<number>();
    game.values.forEach((v, i) => v && !game.givens[i] && v !== game.solution[i] && s.add(i));
    return s;
  }, [mode, game, settings.showMistakes, hint]);

  const counts = useMemo(() => {
    const vals = mode === 'custom' ? custom?.values : game?.values;
    const c = new Array(geo.size + 1).fill(0);
    vals?.forEach((v) => v && c[v]++);
    return c;
  }, [mode, custom, game, geo]);

  // ---- actions -------------------------------------------------------------
  const input = useCallback(
    (value: number, asNote?: boolean) => {
      if (mode === 'custom') {
        setCustom((c) => {
          if (!c || c.selected === null) return c;
          const values = [...c.values];
          values[c.selected] = values[c.selected] === value ? 0 : value;
          return { ...c, values, analysis: null };
        });
      } else if (mode === 'play') {
        dispatch({ type: 'input', value, asNote, autoRemoveNotes: settings.autoRemoveNotes });
      }
    },
    [mode, settings.autoRemoveNotes],
  );

  const erase = useCallback(() => {
    if (mode === 'custom')
      setCustom((c) => {
        if (!c || c.selected === null) return c;
        const values = [...c.values];
        values[c.selected] = 0;
        return { ...c, values, analysis: null };
      });
    else if (mode === 'play') dispatch({ type: 'erase' });
  }, [mode]);

  const move = useCallback(
    (dr: number, dc: number) => {
      if (mode === 'custom')
        setCustom((c) => {
          if (!c) return c;
          const n = c.spec.boxRows * c.spec.boxCols;
          const cur = c.selected ?? 0;
          const r = (Math.floor(cur / n) + dr + n) % n;
          const col = ((cur % n) + dc + n) % n;
          return { ...c, selected: c.selected === null ? 0 : r * n + col };
        });
      else if (mode === 'play') dispatch({ type: 'move', dr, dc });
    },
    [mode],
  );

  const requestHint = useCallback(async () => {
    if (!game || game.won) return;
    const mistakes = game.values.map((v, i) => (v && v !== game.solution[i] ? i : -1)).filter((i) => i >= 0);
    if (mistakes.length) {
      setHint({ kind: 'mistakes', cells: mistakes });
      return;
    }
    const res = await callEngine('solve', { spec: game.spec, values: game.values, solution: game.solution, untilPlacement: true });
    if (!res.steps.length) return;
    const st = createState(getGeometry(game.spec), game.values);
    res.steps.slice(0, -1).forEach((s) => applyStep(st, s));
    setHint({ kind: 'step', steps: res.steps, tier: 1, cands: Array.from(st.cands) });
  }, [game]);

  const applyHint = useCallback(() => {
    if (hint?.kind !== 'step') return;
    const last = hint.steps[hint.steps.length - 1];
    const target = last.placements[0]?.cell ?? last.highlights.cells[0]?.cell ?? null;
    dispatch({ type: 'applyStep', placements: last.placements, eliminations: hint.steps.flatMap((s) => s.eliminations) });
    if (target !== null) dispatch({ type: 'select', cell: target });
    setHint(null);
  }, [hint]);

  const startWalkthrough = useCallback(
    async (source: 'game' | 'custom', fromProgress = false) => {
      let spec: BoardSpec, givens: number[], start: number[], solution: number[] | undefined;
      if (source === 'custom') {
        if (!custom?.analysis?.solution) return;
        spec = custom.spec;
        givens = custom.values;
        start = custom.values;
        solution = custom.analysis.solution;
      } else {
        if (!game) return;
        spec = game.spec;
        givens = game.givens;
        solution = game.solution;
        const clean = game.values.every((v, i) => !v || v === game.solution[i]);
        if (fromProgress && !clean) showToast('Your board has mistakes — starting from the original puzzle.');
        start = fromProgress && clean ? game.values : game.givens;
      }
      setBusy('Solving…');
      try {
        const res = await callEngine('solve', { spec, values: start, solution });
        const g = getGeometry(spec);
        setWalk({
          spec,
          given: givens.map((v) => v !== 0),
          steps: res.steps,
          frames: buildFrames(g, start, res.steps),
          index: 0,
          source,
        });
        setHint(null);
        setPlaying(false);
        setMode('solve');
      } finally {
        setBusy(null);
      }
    },
    [custom, game, showToast],
  );

  const setWalkIndex = useCallback((i: number) => setWalk((w) => (w ? { ...w, index: Math.max(0, Math.min(w.steps.length, i)) } : w)), []);

  const exitWalkthrough = useCallback(() => {
    setPlaying(false);
    setMode(walk?.source === 'custom' ? 'custom' : 'play');
    setWalk(null);
  }, [walk]);

  const continueFromWalk = useCallback(() => {
    if (!walk) return;
    dispatch({ type: 'setValues', values: walk.frames[walk.index].values, usedSolver: true });
    setPlaying(false);
    setWalk(null);
    setMode('play');
  }, [walk]);

  // Autoplay.
  useEffect(() => {
    if (!playing || !walk) return;
    if (walk.index >= walk.steps.length) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setWalkIndex(walk.index + 1), speed);
    return () => window.clearTimeout(id);
  }, [playing, walk, speed, setWalkIndex]);

  const openCustom = useCallback(() => {
    const spec = game?.spec ?? specFor(settings.sizeId);
    setCustom((c) =>
      c && specKey(c.spec) === specKey(spec) ? c : { spec, values: new Array(getGeometry(spec).cellCount).fill(0), selected: 0, analysis: null },
    );
    setHint(null);
    setMode('custom');
  }, [game, settings.sizeId]);

  const checkCustom = useCallback(async () => {
    if (!custom) return;
    setBusy('Checking puzzle…');
    try {
      const analysis = await callEngine('analyze', { spec: custom.spec, values: custom.values });
      setCustom((c) => (c ? { ...c, analysis } : c));
    } finally {
      setBusy(null);
    }
  }, [custom]);

  const share = useCallback(async () => {
    if (!game) return;
    const url = `${window.location.origin}${window.location.pathname}${puzzleToHash(game.spec, game.givens)}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Puzzle link copied to clipboard');
    } catch {
      window.prompt('Copy this link:', url);
    }
  }, [game, showToast]);

  // ---- keyboard ------------------------------------------------------------
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (isTyping(e) || dialog || busy) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mode === 'solve' && walk) {
      if (e.key === 'ArrowRight') setWalkIndex(walk.index + 1);
      else if (e.key === 'ArrowLeft') setWalkIndex(walk.index - 1);
      else if (e.key === ' ') setPlaying((p) => !p);
      else if (e.key === 'Escape') exitWalkthrough();
      else return;
      e.preventDefault();
      return;
    }
    if (mod && e.key.toLowerCase() === 'z') {
      dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      e.preventDefault();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      dispatch({ type: 'redo' });
      e.preventDefault();
      return;
    }
    if (mod || e.altKey) return;
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[e.key]) {
      move(...arrows[e.key]);
      e.preventDefault();
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      erase();
      e.preventDefault();
      return;
    }
    if (e.key === ' ' && mode === 'play') {
      dispatch({ type: 'toggleNotesMode' });
      e.preventDefault();
      return;
    }
    // e.code keeps Shift+digit working on any keyboard layout.
    const digit = /^Digit(\d)$/.exec(e.code)?.[1];
    const key = (e.shiftKey && digit ? digit : e.key).toLowerCase();
    const idx = symbols.keys.indexOf(key);
    if (idx >= 0 && idx < geo.size) {
      input(idx + 1, e.shiftKey ? true : undefined);
      e.preventDefault();
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // ---- board props per mode ------------------------------------------------
  let board: React.ReactNode = null;
  if (mode === 'solve' && walk) {
    const frame = walk.frames[walk.index];
    const step = walk.steps[walk.index] ?? null;
    board = (
      <Board
        geo={geo}
        values={frame.values}
        given={walk.given}
        notes={frame.cands}
        symbols={symbols}
        selected={null}
        highlights={step?.highlights ?? null}
        celebrate={walk.index === walk.steps.length}
      />
    );
  } else if (mode === 'custom' && custom) {
    board = (
      <Board
        geo={geo}
        values={custom.values}
        given={custom.values.map((v) => v !== 0)}
        notes={custom.values.map(() => 0)}
        symbols={symbols}
        selected={custom.selected}
        onSelect={(cell) => setCustom((c) => (c ? { ...c, selected: cell } : c))}
        conflicts={conflicts}
        highlightPeers={settings.highlightPeers}
        highlightSame={settings.highlightSame}
      />
    );
  } else if (game) {
    const hintStep = hint?.kind === 'step' && hint.tier === 2 ? hint.steps[hint.steps.length - 1] : null;
    board = (
      <Board
        geo={geo}
        values={game.values}
        given={game.givens.map((v) => v !== 0)}
        notes={hintStep && hint?.kind === 'step' ? hint.cands : game.notes}
        symbols={symbols}
        selected={hintStep ? null : state.selected}
        onSelect={(cell) => dispatch({ type: 'select', cell })}
        highlights={hintStep?.highlights ?? null}
        conflicts={conflicts}
        wrong={wrong}
        highlightPeers={settings.highlightPeers}
        highlightSame={settings.highlightSame}
        celebrate={celebrate && game.won}
        hidden={paused}
      />
    );
  }

  const difficultyLabel = game ? DIFFICULTIES.find((d) => d.id === game.difficulty)?.label : '';

  return (
    <div className={`app mode-${mode}`}>
      <Background />
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
          <h1>
            Sudoku<span>Studio</span>
          </h1>
        </div>
        <nav className="actions">
          <button className="btn primary" onClick={() => setDialog('new')}>
            <IconPlus /> <span className="label">New game</span>
          </button>
          <button className={`btn${mode === 'custom' ? ' active' : ''}`} onClick={openCustom} title="Enter your own puzzle">
            <IconEdit /> <span className="label">Custom</span>
          </button>
          <button className="icon-btn" onClick={share} title="Share puzzle link" aria-label="Share puzzle" disabled={!game}>
            <IconShare />
          </button>
          <button className="icon-btn" onClick={() => setDialog('settings')} title="Settings" aria-label="Settings">
            <IconGear />
          </button>
        </nav>
      </header>

      <main className="layout">
        <section className="board-area">
          <div className="statusbar">
            {mode === 'play' && game ? (
              <>
                <span className={`badge d-${game.difficulty}`}>
                  {sizeLabel(game.spec)} · {difficultyLabel}
                  {game.custom ? ' · custom' : ''}
                </span>
                <span className="muted">
                  Mistakes <strong>{game.mistakes}</strong>
                </span>
                {settings.showTimer ? (
                  <span className="timer">
                    <IconClock /> {formatTime(game.elapsed)}
                    <button
                      className="icon-btn tiny"
                      onClick={() => setPaused((p) => !p)}
                      aria-label={paused ? 'Resume' : 'Pause'}
                      disabled={game.won}
                    >
                      {paused ? <IconPlay /> : <IconPause />}
                    </button>
                  </span>
                ) : null}
              </>
            ) : mode === 'solve' ? (
              <span className="badge">Solver walkthrough</span>
            ) : mode === 'custom' && custom ? (
              <span className="badge">Editing custom {sizeLabel(custom.spec)}</span>
            ) : null}
          </div>
          <div className="board-wrap">
            {board}
            {paused && mode === 'play' ? (
              <button className="overlay" onClick={() => setPaused(false)}>
                <IconPlay />
                <span>Paused — tap to resume</span>
              </button>
            ) : null}
            {busy ? (
              <div className="overlay busy" role="status">
                <div className="spinner" />
                <span>{busy}</span>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="side">
          {mode === 'solve' && walk ? (
            <SolverPanel
              steps={walk.steps}
              index={walk.index}
              setIndex={setWalkIndex}
              playing={playing}
              setPlaying={setPlaying}
              speed={speed}
              setSpeed={setSpeed}
              symbols={symbols}
              canContinue={walk.source === 'game' && walk.index < walk.steps.length}
              onContinue={continueFromWalk}
              onExit={exitWalkthrough}
            />
          ) : mode === 'custom' && custom ? (
            <>
              <CustomPanel
                size={geo.size}
                analysis={custom.analysis}
                busy={!!busy}
                onPaste={(text) => {
                  try {
                    const values = decodePuzzle(custom.spec, text);
                    setCustom({ ...custom, values, analysis: null });
                    return null;
                  } catch (err) {
                    return (err as Error).message;
                  }
                }}
                onClear={() => setCustom({ ...custom, values: custom.values.map(() => 0), analysis: null })}
                onCheck={checkCustom}
                onPlay={() => {
                  if (!custom.analysis?.solution) return;
                  dispatch({
                    type: 'load',
                    game: newGame(custom.spec, custom.values, custom.analysis.solution, difficultyForLevel(custom.analysis.level), true),
                  });
                  setMode('play');
                }}
                onSolve={() => startWalkthrough('custom')}
                onExit={() => setMode('play')}
              />
              <div className="card size-switch">
                <span className="muted small">Board size</span>
                <div className="segmented">
                  {SIZE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      className={specKey(p.spec) === specKey(custom.spec) ? 'active' : ''}
                      onClick={() =>
                        setCustom({ spec: p.spec, values: new Array(getGeometry(p.spec).cellCount).fill(0), selected: 0, analysis: null })
                      }
                    >
                      {p.id}
                    </button>
                  ))}
                </div>
              </div>
              <NumberPad size={geo.size} boxCols={geo.spec.boxCols} symbols={symbols} onInput={(v) => input(v)} />
            </>
          ) : game ? (
            <>
              <div className="tools">
                <button className="tool" onClick={() => dispatch({ type: 'undo' })} disabled={!state.past.length}>
                  <IconUndo />
                  <span>Undo</span>
                </button>
                <button className="tool" onClick={() => dispatch({ type: 'redo' })} disabled={!state.future.length}>
                  <IconRedo />
                  <span>Redo</span>
                </button>
                <button className="tool" onClick={erase}>
                  <IconErase />
                  <span>Erase</span>
                </button>
                <button
                  className={`tool${state.notesMode ? ' on' : ''}`}
                  onClick={() => dispatch({ type: 'toggleNotesMode' })}
                  aria-pressed={state.notesMode}
                >
                  <IconPencil />
                  <span>Notes {state.notesMode ? 'on' : 'off'}</span>
                </button>
                <button className="tool" onClick={() => dispatch({ type: 'autoNotes' })} title="Fill in all candidates">
                  <IconWand />
                  <span>Auto notes</span>
                </button>
                <button className="tool accent" onClick={requestHint} disabled={game.won}>
                  <IconBulb />
                  <span>Hint</span>
                </button>
              </div>

              {hint ? (
                <HintCard
                  hint={hint}
                  symbols={symbols}
                  onReveal={() => setHint((h) => (h?.kind === 'step' ? { ...h, tier: 2 } : h))}
                  onApply={applyHint}
                  onRemoveMistakes={() => dispatch({ type: 'removeMistakes' })}
                  onClose={() => setHint(null)}
                />
              ) : null}

              <NumberPad
                size={geo.size}
                boxCols={geo.spec.boxCols}
                symbols={symbols}
                counts={counts}
                notesMode={state.notesMode}
                onInput={(v) => input(v)}
              />

              <div className="card solver-cta">
                <div>
                  <h3>
                    <IconBrain /> Step-by-step solver
                  </h3>
                  <p className="muted small">Watch the puzzle being solved with human techniques, each step explained.</p>
                </div>
                <div className="row">
                  <button className="btn primary" onClick={() => startWalkthrough('game')}>
                    From the start
                  </button>
                  <button className="btn" onClick={() => startWalkthrough('game', true)} disabled={game.won}>
                    From my progress
                  </button>
                </div>
              </div>
              <button className="btn ghost" onClick={() => dispatch({ type: 'restart' })}>
                <IconRestart /> Restart puzzle
              </button>
            </>
          ) : null}
        </aside>
      </main>

      <footer className="footer muted small">
        Sudoku Studio · {SIZE_PRESETS.length} board sizes · 14 solving techniques · works offline in your browser
      </footer>

      {dialog === 'new' ? (
        <NewGameDialog
          sizeId={game ? (SIZE_PRESETS.find((p) => specKey(p.spec) === specKey(game.spec))?.id ?? settings.sizeId) : settings.sizeId}
          difficulty={settings.difficulty}
          onStart={(sizeId, difficulty) => {
            patchSettings({ sizeId, difficulty });
            startNewGame(sizeId, difficulty);
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'settings' ? <SettingsDialog settings={settings} onChange={patchSettings} onClose={() => setDialog(null)} /> : null}
      {dialog === 'win' && game ? (
        <WinDialog game={game} onNew={() => setDialog('new')} onClose={() => setDialog(null)} />
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
