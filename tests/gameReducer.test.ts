import { describe, expect, it } from 'vitest';
import { gameReducer, initialGameState, newGame, type GameState } from '../src/state/gameReducer';

const spec = { boxRows: 2, boxCols: 2 };
const solution = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
const givens = solution.map((v, i) => (i < 2 ? 0 : v));
const start = (): GameState => gameReducer(initialGameState, { type: 'load', game: newGame(spec, givens, solution, 'easy') });

describe('game reducer', () => {
  it('places values, counts mistakes, supports undo/redo and detects a win', () => {
    let s = start();
    s = gameReducer(s, { type: 'select', cell: 0 });
    s = gameReducer(s, { type: 'input', value: 2, autoRemoveNotes: true });
    expect(s.game!.mistakes).toBe(1);
    s = gameReducer(s, { type: 'undo' });
    expect(s.game!.values[0]).toBe(0);
    s = gameReducer(s, { type: 'redo' });
    expect(s.game!.values[0]).toBe(2);
    s = gameReducer(s, { type: 'input', value: 1, autoRemoveNotes: true });
    s = gameReducer(s, { type: 'select', cell: 1 });
    s = gameReducer(s, { type: 'input', value: 2, autoRemoveNotes: true });
    expect(s.game!.won).toBe(true);
  });

  it('ignores edits to givens and toggles notes', () => {
    let s = start();
    s = gameReducer(s, { type: 'select', cell: 5 });
    s = gameReducer(s, { type: 'input', value: 1, autoRemoveNotes: true });
    expect(s.game!.values[5]).toBe(4);
    s = gameReducer(s, { type: 'select', cell: 1 });
    s = gameReducer(s, { type: 'input', value: 3, asNote: true, autoRemoveNotes: true });
    expect(s.game!.notes[1]).toBe(0b100);
    s = gameReducer(s, { type: 'select', cell: 0 });
    s = gameReducer(s, { type: 'input', value: 3, autoRemoveNotes: true });
    expect(s.game!.notes[1]).toBe(0); // auto-removed from peer
  });
});
