export type ThemeEffect = 'none' | 'grain' | 'blobs' | 'synthgrid' | 'stars' | 'scanlines' | 'bubbles';

export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  effect: ThemeEffect;
  /** Symbol set that fits the theme; used when the user picks "theme default". */
  suggestedSymbols?: string;
  vars: Record<string, string>;
}

/** Shared defaults; each theme overrides what it needs. */
const base: Record<string, string> = {
  '--font': "'Inter', system-ui, sans-serif",
  '--digit-font': "'Inter', system-ui, sans-serif",
  '--radius': '14px',
  '--cell-radius': '4px',
  '--glow': 'none',
  '--shadow': '0 20px 50px -20px rgba(0,0,0,.35)',
};

export const THEMES: Theme[] = [
  {
    id: 'paper',
    name: 'Classic Paper',
    dark: false,
    effect: 'grain',
    vars: {
      ...base,
      '--bg': 'radial-gradient(circle at 20% 10%, #fffaf0, #f1e7d3)',
      '--surface': '#fffdf7',
      '--surface-2': '#f4ecdc',
      '--text': '#2b2417',
      '--muted': '#8a7c63',
      '--accent': '#b4532a',
      '--accent-2': '#2f5d8a',
      '--board-border': '#3b3222',
      '--cell-line': '#d8ccb4',
      '--cell-bg': '#fffdf7',
      '--given': '#2b2417',
      '--entry': '#2f5d8a',
      '--note': '#7d705a',
      '--sel-bg': '#f6d9a8',
      '--peer-bg': '#f5eddd',
      '--same-bg': '#ecd9b3',
      '--digit-font': "'Patrick Hand', cursive",
      '--cell-radius': '0px',
      '--radius': '6px',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    dark: true,
    effect: 'blobs',
    vars: {
      ...base,
      '--bg': 'linear-gradient(160deg, #0b1020, #141b34 60%, #1d1540)',
      '--surface': 'rgba(23, 30, 58, .75)',
      '--surface-2': 'rgba(42, 52, 92, .65)',
      '--text': '#e7ebff',
      '--muted': '#8f98c4',
      '--accent': '#8b7cff',
      '--accent-2': '#4dd0e1',
      '--board-border': '#5a5f9e',
      '--cell-line': '#2a3160',
      '--cell-bg': '#151b36',
      '--given': '#f2f4ff',
      '--entry': '#a99dff',
      '--note': '#8f98c4',
      '--sel-bg': '#3b3790',
      '--peer-bg': '#1d2448',
      '--same-bg': '#2c2a6e',
    },
  },
  {
    id: 'synthwave',
    name: 'Neon Synthwave',
    dark: true,
    effect: 'synthgrid',
    vars: {
      ...base,
      '--bg': 'linear-gradient(180deg, #120024 0%, #2b0a3d 55%, #ff2a6d33 100%)',
      '--surface': 'rgba(26, 4, 46, .8)',
      '--surface-2': 'rgba(60, 14, 90, .7)',
      '--text': '#fbe9ff',
      '--muted': '#c08bd6',
      '--accent': '#ff2a6d',
      '--accent-2': '#05d9e8',
      '--board-border': '#ff2a6d',
      '--cell-line': '#4a1468',
      '--cell-bg': '#1a042e',
      '--given': '#05d9e8',
      '--entry': '#ff71ce',
      '--note': '#b98ad0',
      '--sel-bg': '#5c1a7a',
      '--peer-bg': '#26083f',
      '--same-bg': '#46156a',
      '--digit-font': "'Orbitron', sans-serif",
      '--font': "'Orbitron', sans-serif",
      '--glow': '0 0 6px currentColor, 0 0 14px currentColor',
      '--shadow': '0 0 40px #ff2a6d55, 0 0 80px #05d9e833',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    dark: false,
    effect: 'blobs',
    suggestedSymbols: 'animals',
    vars: {
      ...base,
      '--bg': 'linear-gradient(150deg, #e3eed9, #c4d9b4)',
      '--surface': '#f5f9ef',
      '--surface-2': '#e2ecd6',
      '--text': '#1f3a24',
      '--muted': '#5e7a5f',
      '--accent': '#2f7a43',
      '--accent-2': '#b5762e',
      '--board-border': '#2b4d31',
      '--cell-line': '#c3d6b5',
      '--cell-bg': '#fbfdf7',
      '--given': '#1f3a24',
      '--entry': '#2f7a43',
      '--note': '#6b8a68',
      '--sel-bg': '#bfe0a6',
      '--peer-bg': '#eaf3e0',
      '--same-bg': '#d3e8bd',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    dark: true,
    effect: 'bubbles',
    vars: {
      ...base,
      '--bg': 'linear-gradient(180deg, #03324d, #021c2e 70%, #01121e)',
      '--surface': 'rgba(4, 52, 79, .7)',
      '--surface-2': 'rgba(9, 82, 118, .6)',
      '--text': '#dff6ff',
      '--muted': '#7fb8cf',
      '--accent': '#2ad3c5',
      '--accent-2': '#ffb84d',
      '--board-border': '#2ad3c5',
      '--cell-line': '#0b4766',
      '--cell-bg': '#052a40',
      '--given': '#e6faff',
      '--entry': '#5ef1e1',
      '--note': '#7fb8cf',
      '--sel-bg': '#0d6b84',
      '--peer-bg': '#06354f',
      '--same-bg': '#0a5270',
      '--radius': '20px',
      '--cell-radius': '8px',
    },
  },
  {
    id: 'candy',
    name: 'Candy',
    dark: false,
    effect: 'bubbles',
    suggestedSymbols: 'fruit',
    vars: {
      ...base,
      '--bg': 'linear-gradient(135deg, #ffd6e8, #e0d4ff 50%, #c9f1ff)',
      '--surface': 'rgba(255,255,255,.75)',
      '--surface-2': 'rgba(255,240,248,.9)',
      '--text': '#5a2a52',
      '--muted': '#a57aa0',
      '--accent': '#ff5fa2',
      '--accent-2': '#7c5cff',
      '--board-border': '#ff9cc8',
      '--cell-line': '#ffe0ef',
      '--cell-bg': '#fffafd',
      '--given': '#5a2a52',
      '--entry': '#7c5cff',
      '--note': '#b48aae',
      '--sel-bg': '#ffd0e6',
      '--peer-bg': '#fff0f7',
      '--same-bg': '#ffe2f0',
      '--font': "'Fredoka', sans-serif",
      '--digit-font': "'Fredoka', sans-serif",
      '--radius': '24px',
      '--cell-radius': '10px',
    },
  },
  {
    id: 'terminal',
    name: 'Terminal',
    dark: true,
    effect: 'scanlines',
    vars: {
      ...base,
      '--bg': '#030a03',
      '--surface': '#071207',
      '--surface-2': '#0c1f0c',
      '--text': '#7cff7c',
      '--muted': '#3f9a3f',
      '--accent': '#39ff14',
      '--accent-2': '#ffd23f',
      '--board-border': '#39ff14',
      '--cell-line': '#123512',
      '--cell-bg': '#041004',
      '--given': '#b6ffb6',
      '--entry': '#39ff14',
      '--note': '#3f9a3f',
      '--sel-bg': '#145214',
      '--peer-bg': '#081a08',
      '--same-bg': '#0f3a0f',
      '--font': "'JetBrains Mono', monospace",
      '--digit-font': "'JetBrains Mono', monospace",
      '--radius': '2px',
      '--cell-radius': '0px',
      '--glow': '0 0 4px currentColor',
    },
  },
  {
    id: 'contrast',
    name: 'High Contrast',
    dark: true,
    effect: 'none',
    vars: {
      ...base,
      '--bg': '#000',
      '--surface': '#000',
      '--surface-2': '#1a1a1a',
      '--text': '#fff',
      '--muted': '#d0d0d0',
      '--accent': '#ffd400',
      '--accent-2': '#00e5ff',
      '--board-border': '#fff',
      '--cell-line': '#777',
      '--cell-bg': '#000',
      '--given': '#fff',
      '--entry': '#ffd400',
      '--note': '#e0e0e0',
      '--sel-bg': '#0044aa',
      '--peer-bg': '#1c1c1c',
      '--same-bg': '#553f00',
      '--cell-radius': '0px',
    },
  },
];

/** Solver highlight colors derived per light/dark so every theme gets readable highlights. */
export function highlightVars(dark: boolean): Record<string, string> {
  return dark
    ? {
        '--hl-place': '#22c55e',
        '--hl-elim': '#f43f5e',
        '--hl-cause': '#fbbf24',
        '--hl-unit': 'rgba(96, 165, 250, .16)',
        '--hl-pattern': 'rgba(251, 191, 36, .28)',
        '--hl-target': 'rgba(34, 197, 94, .32)',
        '--hl-peer': 'rgba(96, 165, 250, .34)',
        '--conflict': '#ff5c7a',
      }
    : {
        '--hl-place': '#15803d',
        '--hl-elim': '#dc2626',
        '--hl-cause': '#b45309',
        '--hl-unit': 'rgba(59, 130, 246, .12)',
        '--hl-pattern': 'rgba(245, 158, 11, .30)',
        '--hl-target': 'rgba(34, 197, 94, .30)',
        '--hl-peer': 'rgba(59, 130, 246, .25)',
        '--conflict': '#dc2626',
      };
}

export const getTheme = (id: string): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0];

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  root.dataset.effect = theme.effect;
  root.style.colorScheme = theme.dark ? 'dark' : 'light';
  for (const [k, v] of Object.entries({ ...theme.vars, ...highlightVars(theme.dark) })) root.style.setProperty(k, v);
  const meta = document.querySelector('meta[name="theme-color"]') ?? document.head.appendChild(document.createElement('meta'));
  meta.setAttribute('name', 'theme-color');
  meta.setAttribute('content', theme.vars['--cell-bg']);
}
