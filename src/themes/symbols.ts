export interface SymbolDef {
  glyph: string;
  /** When set, the symbol is drawn as a colored token instead of text. */
  color?: string;
}

export interface SymbolSet {
  id: string;
  name: string;
  preview: string;
  symbols: SymbolDef[];
  /** Keyboard key for each value (index 0 = value 1). */
  keys: string;
  /** Emoji render a bit smaller so they fit the cell. */
  scale?: number;
}

const DEFAULT_KEYS = '123456789abcdefg';
const text = (s: string[]): SymbolDef[] => s.map((glyph) => ({ glyph }));

export const SYMBOL_SETS: SymbolSet[] = [
  {
    id: 'numbers',
    name: 'Numbers',
    preview: '1 2 3',
    symbols: text(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16']),
    keys: DEFAULT_KEYS,
  },
  {
    id: 'hex',
    name: 'Alphanumeric',
    preview: '9 A B',
    symbols: text('123456789ABCDEFG'.split('')),
    keys: DEFAULT_KEYS,
  },
  {
    id: 'letters',
    name: 'Letters',
    preview: 'A B C',
    symbols: text('ABCDEFGHIJKLMNOP'.split('')),
    keys: 'abcdefghijklmnop',
  },
  {
    id: 'greek',
    name: 'Greek',
    preview: 'α β γ',
    symbols: text('αβγδεζηθικλμνξπσ'.split('')),
    keys: DEFAULT_KEYS,
  },
  {
    id: 'fruit',
    name: 'Fruit',
    preview: '🍎🍋🍇',
    symbols: text(['🍎', '🍊', '🍋', '🍉', '🍇', '🍓', '🍒', '🍑', '🥝', '🍍', '🥥', '🍌', '🍐', '🫐', '🥭', '🍈']),
    keys: DEFAULT_KEYS,
    scale: 0.8,
  },
  {
    id: 'animals',
    name: 'Animals',
    preview: '🐶🐱🦊',
    symbols: text(['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔']),
    keys: DEFAULT_KEYS,
    scale: 0.8,
  },
  {
    id: 'space',
    name: 'Space',
    preview: '🪐🚀⭐',
    symbols: text(['🌍', '🌙', '⭐', '☀️', '🪐', '☄️', '🚀', '🛸', '👽', '🌌', '🔭', '🛰️', '🌠', '🌑', '🌈', '💫']),
    keys: DEFAULT_KEYS,
    scale: 0.8,
  },
  {
    id: 'colors',
    name: 'Colors',
    preview: '🔴🟢🔵',
    symbols: [
      '#ef4444', '#f97316', '#facc15', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
      '#6366f1', '#a855f7', '#ec4899', '#78350f', '#64748b', '#f5f5f4', '#171717', '#fda4af',
    ].map((color, i) => ({ glyph: String(i + 1), color })),
    keys: DEFAULT_KEYS,
  },
];

export const getSymbolSet = (id: string): SymbolSet => SYMBOL_SETS.find((s) => s.id === id) ?? SYMBOL_SETS[0];
