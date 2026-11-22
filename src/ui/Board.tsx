import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { bit } from '../engine/bitset';
import { cellName, sees, type Geometry } from '../engine/geometry';
import type { CandRole, CellRole, Highlights } from '../solver/types';
import type { SymbolSet } from '../themes/symbols';
import { Glyph } from './Glyph';

export interface BoardProps {
  geo: Geometry;
  values: number[];
  /** true for puzzle givens */
  given: boolean[];
  notes: number[];
  symbols: SymbolSet;
  selected: number | null;
  onSelect?: (cell: number) => void;
  highlights?: Highlights | null;
  conflicts?: Set<number>;
  wrong?: Set<number>;
  highlightPeers?: boolean;
  highlightSame?: boolean;
  celebrate?: boolean;
  hidden?: boolean;
}

interface CellProps {
  cell: number;
  name: string;
  value: number;
  notes: number;
  given: boolean;
  n: number;
  noteCols: number;
  symbols: SymbolSet;
  flags: string;
  role?: CellRole;
  candRoles?: Map<number, CandRole>;
  sameValue: number;
  wave: number;
  onSelect?: (cell: number) => void;
}

const Cell = memo(function Cell(p: CellProps) {
  const cls = ['cell', p.given ? 'given' : 'entry', p.flags, p.role ? `hl-${p.role}` : ''].join(' ');
  const showNotes = !p.value && p.notes !== 0;
  return (
    <div
      className={cls}
      data-cell={p.cell}
      role="gridcell"
      aria-label={`${p.name}${p.value ? `, ${p.symbols.symbols[p.value - 1]?.glyph}` : ', empty'}${p.given ? ', given' : ''}`}
      style={{ '--wave': p.wave } as CSSProperties}
      onPointerDown={(e) => {
        e.preventDefault();
        p.onSelect?.(p.cell);
      }}
    >
      {p.value ? (
        <span key={p.value} className={p.given ? 'val' : 'val pop'}>
          <Glyph value={p.value} set={p.symbols} />
        </span>
      ) : showNotes ? (
        <div className="notes" style={{ gridTemplateColumns: `repeat(${p.noteCols}, 1fr)` }}>
          {Array.from({ length: p.n }, (_, i) => {
            const v = i + 1;
            const has = (p.notes & bit(v)) !== 0;
            const role = has ? p.candRoles?.get(v) : undefined;
            const same = has && v === p.sameValue;
            return (
              <span key={v} className={`note${role ? ` c-${role}` : ''}${same ? ' same' : ''}`}>
                {has ? <Glyph value={v} set={p.symbols} /> : null}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});

function LinksOverlay({ links, boardRef }: { links: Highlights['links']; boardRef: React.RefObject<HTMLDivElement | null> }) {
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const center = (cell: number) => {
        const c = el.querySelector(`[data-cell="${cell}"]`)?.getBoundingClientRect();
        return c ? { x: c.left - box.left + c.width / 2, y: c.top - box.top + c.height / 2 } : { x: 0, y: 0 };
      };
      setSize({ w: box.width, h: box.height });
      setLines(
        links.map((l) => {
          const a = center(l.from), b = center(l.to);
          return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
        }),
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [links, boardRef]);
  if (!links.length) return null;
  return (
    <svg className="links" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill="var(--hl-cause)" />
        </marker>
      </defs>
      {lines.map((l, i) => (
        <line key={i} {...l} markerEnd="url(#arrow)" />
      ))}
    </svg>
  );
}

export function Board(props: BoardProps) {
  const { geo, values, notes, given, symbols, selected, highlights } = props;
  const n = geo.size;
  const { boxRows, boxCols } = geo.spec;
  const boardRef = useRef<HTMLDivElement>(null);

  const hl = useMemo(() => {
    const roles = new Map<number, CellRole>();
    const unitCells = new Set<number>();
    const cands = new Map<number, Map<number, CandRole>>();
    if (highlights) {
      for (const u of highlights.units) for (const c of geo.units[u]) unitCells.add(c);
      for (const { cell, role } of highlights.cells) if (!roles.has(cell) || role === 'target') roles.set(cell, role);
      for (const { cell, value, role } of highlights.candidates) {
        if (!cands.has(cell)) cands.set(cell, new Map());
        cands.get(cell)!.set(value, role);
      }
    }
    return { roles, unitCells, cands };
  }, [highlights, geo]);

  const selValue = selected !== null ? values[selected] : 0;

  const renderCell = (cell: number) => {
    const flags: string[] = [];
    if (cell === selected) flags.push('selected');
    else if (!highlights) {
      if (props.highlightPeers && selected !== null && sees(geo, selected, cell)) flags.push('peer');
      if (props.highlightSame && selValue && values[cell] === selValue) flags.push('same');
    }
    if (hl.unitCells.has(cell)) flags.push('in-unit');
    if (props.conflicts?.has(cell)) flags.push('conflict');
    if (props.wrong?.has(cell)) flags.push('wrong');
    return (
      <Cell
        key={cell}
        cell={cell}
        name={cellName(geo, cell)}
        value={values[cell]}
        notes={notes[cell]}
        given={given[cell]}
        n={n}
        noteCols={boxCols}
        symbols={symbols}
        flags={flags.join(' ')}
        role={hl.roles.get(cell)}
        candRoles={hl.cands.get(cell)}
        sameValue={props.highlightSame && !highlights ? selValue : 0}
        wave={geo.rowOf[cell] + geo.colOf[cell]}
        onSelect={props.onSelect}
      />
    );
  };

  return (
    <div
      ref={boardRef}
      className={`board size-${n}${props.celebrate ? ' celebrate' : ''}${props.hidden ? ' hidden' : ''}`}
      role="grid"
      aria-label={`${n} by ${n} sudoku board`}
      style={
        {
          '--n': n,
          '--br': boxRows,
          '--bc': boxCols,
          '--sym-scale': symbols.scale ?? 1,
          gridTemplateColumns: `repeat(${n / boxCols}, 1fr)`,
        } as CSSProperties
      }
    >
      {Array.from({ length: n }, (_, b) => (
        <div key={b} className="box" style={{ gridTemplateColumns: `repeat(${boxCols}, 1fr)` }}>
          {geo.units[2 * n + b].map(renderCell)}
        </div>
      ))}
      {highlights?.links.length ? <LinksOverlay links={highlights.links} boardRef={boardRef} /> : null}
    </div>
  );
}
