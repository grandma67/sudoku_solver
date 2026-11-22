import { bit } from '../engine/bitset';
import { getGeometry, type BoardSpec } from '../engine/geometry';
import { computeCandidates } from '../engine/grid';
import type { Difficulty } from '../solver/grader';
import type { CellValue } from '../solver/types';

export interface Game {
  spec: BoardSpec;
  givens: number[];
  solution: number[];
  values: number[];
  /** Pencil marks as candidate bitmasks. */
  notes: number[];
  difficulty: Difficulty;
  custom: boolean;
  mistakes: number;
  hintsUsed: number;
  /** Seconds played. */
  elapsed: number;
  won: boolean;
  usedSolver: boolean;
}

interface Snapshot {
  values: number[];
  notes: number[];
}

export interface GameState {
  game: Game | null;
  selected: number | null;
  notesMode: boolean;
  past: Snapshot[];
  future: Snapshot[];
}

export type GameAction =
  | { type: 'load'; game: Game }
  | { type: 'select'; cell: number | null }
  | { type: 'move'; dr: number; dc: number }
  | { type: 'input'; value: number; asNote?: boolean; autoRemoveNotes: boolean }
  | { type: 'erase' }
  | { type: 'toggleNotesMode' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'autoNotes' }
  | { type: 'clearNotes' }
  | { type: 'applyStep'; placements: CellValue[]; eliminations: CellValue[] }
  | { type: 'setValues'; values: number[]; usedSolver?: boolean }
  | { type: 'removeMistakes' }
  | { type: 'restart' }
  | { type: 'tick' };

const HISTORY_LIMIT = 300;

export const initialGameState: GameState = { game: null, selected: null, notesMode: false, past: [], future: [] };

export function newGame(
  spec: BoardSpec,
  givens: number[],
  solution: number[],
  difficulty: Difficulty,
  custom = false,
): Game {
  return {
    spec,
    givens: [...givens],
    solution: [...solution],
    values: [...givens],
    notes: new Array(givens.length).fill(0),
    difficulty,
    custom,
    mistakes: 0,
    hintsUsed: 0,
    elapsed: 0,
    won: false,
    usedSolver: false,
  };
}

const isWon = (g: Game) => g.values.every((v, i) => v === g.solution[i]);

/** Records history, applies `fn` to a copy of the game, and checks for a win. */
function commit(state: GameState, fn: (g: Game) => Game | null): GameState {
  const g = state.game;
  if (!g || g.won) return state;
  const next = fn({ ...g, values: [...g.values], notes: [...g.notes] });
  if (!next) return state;
  const past = [...state.past, { values: g.values, notes: g.notes }].slice(-HISTORY_LIMIT);
  next.won = isWon(next);
  return { ...state, game: next, past, future: [] };
}

function placeValue(g: Game, cell: number, value: number, autoRemoveNotes: boolean): void {
  g.values[cell] = value;
  g.notes[cell] = 0;
  if (autoRemoveNotes) for (const p of getGeometry(g.spec).peers[cell]) g.notes[p] &= ~bit(value);
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const g = state.game;
  switch (action.type) {
    case 'load':
      return { ...initialGameState, game: action.game, selected: null, notesMode: state.notesMode };
    case 'select':
      return { ...state, selected: action.cell };
    case 'move': {
      if (!g) return state;
      const n = getGeometry(g.spec).size;
      const cur = state.selected ?? 0;
      const r = (Math.floor(cur / n) + action.dr + n) % n;
      const c = ((cur % n) + action.dc + n) % n;
      return { ...state, selected: state.selected === null ? 0 : r * n + c };
    }
    case 'toggleNotesMode':
      return { ...state, notesMode: !state.notesMode };
    case 'input': {
      const cell = state.selected;
      if (!g || cell === null || g.givens[cell]) return state;
      const asNote = action.asNote ?? state.notesMode;
      return commit(state, (ng) => {
        if (asNote) {
          if (ng.values[cell]) return null;
          ng.notes[cell] ^= bit(action.value);
          return ng;
        }
        if (ng.values[cell] === action.value) {
          ng.values[cell] = 0;
          return ng;
        }
        if (action.value !== ng.solution[cell]) ng.mistakes++;
        placeValue(ng, cell, action.value, action.autoRemoveNotes);
        return ng;
      });
    }
    case 'erase': {
      const cell = state.selected;
      if (!g || cell === null || g.givens[cell]) return state;
      if (!g.values[cell] && !g.notes[cell]) return state;
      return commit(state, (ng) => {
        if (ng.values[cell]) ng.values[cell] = 0;
        else ng.notes[cell] = 0;
        return ng;
      });
    }
    case 'autoNotes':
      return commit(state, (ng) => {
        const cands = computeCandidates(getGeometry(ng.spec), ng.values);
        ng.notes = Array.from(cands);
        return ng;
      });
    case 'clearNotes':
      return commit(state, (ng) => {
        ng.notes = ng.notes.map(() => 0);
        return ng;
      });
    case 'applyStep':
      return commit(state, (ng) => {
        for (const e of action.eliminations) ng.notes[e.cell] &= ~bit(e.value);
        for (const p of action.placements) placeValue(ng, p.cell, p.value, true);
        ng.hintsUsed++;
        return ng;
      });
    case 'setValues':
      return commit(state, (ng) => {
        ng.values = [...action.values];
        ng.notes = ng.notes.map((m, i) => (ng.values[i] ? 0 : m));
        if (action.usedSolver) ng.usedSolver = true;
        return ng;
      });
    case 'removeMistakes':
      return commit(state, (ng) => {
        ng.values = ng.values.map((v, i) => (v && v !== ng.solution[i] ? 0 : v));
        return ng;
      });
    case 'restart':
      if (!g) return state;
      return { ...initialGameState, game: { ...newGame(g.spec, g.givens, g.solution, g.difficulty, g.custom), elapsed: 0 } };
    case 'undo': {
      if (!g || !state.past.length || g.won) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state,
        game: { ...g, values: prev.values, notes: prev.notes },
        past: state.past.slice(0, -1),
        future: [{ values: g.values, notes: g.notes }, ...state.future],
      };
    }
    case 'redo': {
      if (!g || !state.future.length) return state;
      const [next, ...rest] = state.future;
      const game = { ...g, values: next.values, notes: next.notes };
      game.won = isWon(game);
      return { ...state, game, past: [...state.past, { values: g.values, notes: g.notes }], future: rest };
    }
    case 'tick':
      if (!g || g.won) return state;
      return { ...state, game: { ...g, elapsed: g.elapsed + 1 } };
  }
}
