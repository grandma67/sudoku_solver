import type { Difficulty } from '../solver/grader';

export interface Settings {
  themeId: string;
  /** 'auto' = use the theme's suggestion, falling back to numbers. */
  symbolSetId: string;
  sizeId: string;
  difficulty: Difficulty;
  highlightPeers: boolean;
  highlightSame: boolean;
  showMistakes: boolean;
  autoRemoveNotes: boolean;
  showTimer: boolean;
}

export const defaultSettings = (): Settings => ({
  themeId: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'midnight' : 'paper',
  symbolSetId: 'auto',
  sizeId: '9',
  difficulty: 'medium',
  highlightPeers: true,
  highlightSame: true,
  showMistakes: true,
  autoRemoveNotes: true,
  showTimer: true,
});
