import type { Settings } from '../state/settings';
import { SYMBOL_SETS } from '../themes/symbols';
import { THEMES } from '../themes/themes';
import { Modal } from './Modal';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

const TOGGLES: { key: keyof Settings; label: string }[] = [
  { key: 'highlightPeers', label: 'Highlight row, column and box of the selected cell' },
  { key: 'highlightSame', label: 'Highlight matching values' },
  { key: 'showMistakes', label: 'Show mistakes immediately' },
  { key: 'autoRemoveNotes', label: 'Remove notes automatically when placing a value' },
  { key: 'showTimer', label: 'Show timer' },
];

export function SettingsDialog({ settings, onChange, onClose }: Props) {
  return (
    <Modal title="Settings" onClose={onClose} className="settings">
      <h3 className="section-label">Theme</h3>
      <div className="theme-grid">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={`theme-card${t.id === settings.themeId ? ' active' : ''}`}
            onClick={() => onChange({ themeId: t.id })}
            style={{ background: t.vars['--bg'], color: t.vars['--text'], fontFamily: t.vars['--font'] }}
          >
            <span className="swatches">
              {['--cell-bg', '--given', '--entry', '--accent', '--board-border'].map((k) => (
                <i key={k} style={{ background: t.vars[k] }} />
              ))}
            </span>
            <span>{t.name}</span>
          </button>
        ))}
      </div>
      <h3 className="section-label">Symbols</h3>
      <div className="chip-row">
        <button className={`chip${settings.symbolSetId === 'auto' ? ' active' : ''}`} onClick={() => onChange({ symbolSetId: 'auto' })}>
          Theme default
        </button>
        {SYMBOL_SETS.map((s) => (
          <button key={s.id} className={`chip${settings.symbolSetId === s.id ? ' active' : ''}`} onClick={() => onChange({ symbolSetId: s.id })}>
            <span className="chip-preview">{s.preview}</span> {s.name}
          </button>
        ))}
      </div>
      <h3 className="section-label">Assists</h3>
      <div className="toggles">
        {TOGGLES.map(({ key, label }) => (
          <label key={key} className="toggle">
            <input type="checkbox" checked={Boolean(settings[key])} onChange={(e) => onChange({ [key]: e.target.checked })} />
            <span className="switch" />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <h3 className="section-label">Keyboard</h3>
      <ul className="keys small muted">
        <li><kbd>←↑→↓</kbd> move · <kbd>1–9</kbd> / <kbd>A–G</kbd> enter · <kbd>Shift</kbd>+key note</li>
        <li><kbd>Space</kbd> notes mode · <kbd>Backspace</kbd> erase · <kbd>⌘/Ctrl Z</kbd> undo · <kbd>⇧⌘Z</kbd> redo</li>
        <li>Solver: <kbd>←</kbd>/<kbd>→</kbd> step · <kbd>Space</kbd> play/pause</li>
      </ul>
    </Modal>
  );
}
