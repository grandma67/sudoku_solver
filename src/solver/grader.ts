export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const DIFFICULTIES: { id: Difficulty; label: string; level: number }[] = [
  { id: 'easy', label: 'Easy', level: 1 },
  { id: 'medium', label: 'Medium', level: 2 },
  { id: 'hard', label: 'Hard', level: 3 },
  { id: 'expert', label: 'Expert', level: 4 },
];

export const difficultyForLevel = (level: number): Difficulty =>
  DIFFICULTIES.find((d) => d.level === Math.max(1, Math.min(4, level)))!.id;

export const levelOf = (d: Difficulty): number => DIFFICULTIES.find((x) => x.id === d)!.level;
