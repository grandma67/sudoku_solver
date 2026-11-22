import type { CSSProperties } from 'react';
import type { SymbolSet } from '../themes/symbols';
import { Glyph } from './Glyph';

interface Props {
  size: number;
  boxCols: number;
  symbols: SymbolSet;
  /** How many of each value are already placed (index = value). */
  counts?: number[];
  notesMode?: boolean;
  onInput: (value: number) => void;
}

export function NumberPad({ size, boxCols, symbols, counts, notesMode, onInput }: Props) {
  return (
    <div
      className={`numpad${notesMode ? ' notes-mode' : ''}`}
      style={{ '--pad-cols': size <= 4 ? size : boxCols, '--pad-cols-m': size <= 9 ? size : 8 } as CSSProperties}
    >
      {Array.from({ length: size }, (_, i) => {
        const v = i + 1;
        const left = counts ? size - counts[v] : undefined;
        const done = left !== undefined && left <= 0;
        return (
          <button
            key={v}
            className={`pad-btn${done ? ' done' : ''}`}
            onClick={() => onInput(v)}
            disabled={done && !notesMode}
            aria-label={`Enter ${symbols.symbols[i].glyph}`}
          >
            <span className="pad-glyph">
              <Glyph value={v} set={symbols} />
            </span>
            {left !== undefined && !done ? <span className="pad-count">{left}</span> : null}
            {size > 9 || symbols.keys !== '123456789abcdefg' ? (
              <kbd className="pad-key">{symbols.keys[i].toUpperCase()}</kbd>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
