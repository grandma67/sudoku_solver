import type { Game } from './gameReducer';
import { defaultSettings, type Settings } from './settings';

const SETTINGS_KEY = 'sudoku-studio.settings.v1';
const GAME_KEY = 'sudoku-studio.game.v1';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or disabled — ignore */
  }
}

export const loadSettings = (): Settings => ({ ...defaultSettings(), ...(read<Partial<Settings>>(SETTINGS_KEY) ?? {}) });
export const saveSettings = (s: Settings): void => write(SETTINGS_KEY, s);

export function loadGame(): Game | null {
  const g = read<Game>(GAME_KEY);
  if (!g || !Array.isArray(g.values) || !Array.isArray(g.solution) || g.values.length !== g.solution.length) return null;
  return g;
}
export const saveGame = (g: Game | null): void => (g ? write(GAME_KEY, g) : localStorage.removeItem(GAME_KEY));
