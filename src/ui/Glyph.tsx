import { Fragment, type ReactNode } from 'react';
import type { SymbolSet } from '../themes/symbols';

export function Glyph({ value, set }: { value: number; set: SymbolSet }) {
  const s = set.symbols[value - 1];
  if (!s) return null;
  if (s.color) return <span className="dot" style={{ background: s.color }} aria-label={`color ${value}`} />;
  const cls = set.scale ? 'glyph emoji' : s.glyph.length > 1 ? 'glyph long' : 'glyph';
  return <span className={cls}>{s.glyph}</span>;
}

/** Renders solver text, swapping `{v}` tokens for symbols of the active set. */
export function RichText({ text, set }: { text: string; set: SymbolSet }): ReactNode {
  const parts = text.split(/\{(\d+)\}/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className="chip-glyph">
            <Glyph value={Number(p)} set={set} />
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
