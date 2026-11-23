import { useState } from 'react';
import { pct, type Slice } from './Charts';

export interface BarRow { id: string; label: string; parts: Slice[]; limit?: number }

/** Horizontal stacked bars; hover shows a breakdown, click selects a row. */
export function BarList({ rows, format, selected, onSelect, empty = 'Nothing to show yet.' }: { rows: BarRow[]; format: (n: number) => string; selected?: string | null; onSelect?: (id: string | null) => void; empty?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  if (!rows.length) return <p className="viz-empty">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.limit ?? 0, r.parts.reduce((s, p) => s + p.value, 0))));
  return (
    <ul className="ix-bars">
      {rows.map((r) => {
        const used = r.parts.reduce((s, p) => s + p.value, 0);
        const over = r.limit !== undefined && used > r.limit;
        const dim = (selected && selected !== r.id) || (hover && hover !== r.id);
        return (
          <li key={r.id} className={dim ? 'dim' : ''}>
            <button type="button" aria-pressed={selected === r.id} onClick={() => onSelect?.(selected === r.id ? null : r.id)}
              onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)}>
              <span className="ix-bar-head">
                <span>{r.label}</span>
                <strong className={`money${over ? ' viz-over' : ''}`}>{format(used)}{r.limit !== undefined && <em> / {format(r.limit)} · {pct(used, r.limit).toFixed(0)}%</em>}</strong>
              </span>
              <span className="viz-stack-track">
                {r.limit !== undefined && <span className="viz-stack-limit" style={{ width: `${pct(r.limit, max)}%` }} />}
                {r.parts.map((p) => <span key={p.label} className="viz-stack-seg" style={{ width: `${pct(p.value, max)}%`, background: p.tone }} />)}
              </span>
              {hover === r.id && (
                <span className="ix-bar-tip">{r.parts.map((p) => <span key={p.label}><i style={{ background: p.tone }} />{p.label} {format(p.value)}</span>)}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export interface Column { label: string; value: number }

/** Vertical columns (e.g. spend per month); hover or focus shows the exact value. */
export function ColumnChart({ columns, format, empty = 'Nothing to show yet.' }: { columns: Column[]; format: (n: number) => string; empty?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!columns.length) return <p className="viz-empty">{empty}</p>;
  const max = Math.max(1, ...columns.map((c) => c.value));
  return (
    <ol className="ix-cols">
      {columns.map((c, i) => (
        <li key={c.label} className={hover !== null && hover !== i ? 'dim' : ''}>
          <span className="ix-col-v">{hover === i || columns.length <= 6 ? format(c.value) : ''}</span>
          <button type="button" aria-label={`${c.label} ${format(c.value)}`} className="ix-col-track"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
            <span style={{ height: `${pct(c.value, max)}%` }} />
          </button>
          <em>{c.label}</em>
        </li>
      ))}
    </ol>
  );
}

/** Horizontal count bars (label · bar · count), e.g. claims per status. */
export function CountBars({ rows }: { rows: { label: string; count: number; tone: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="ix-counts">
      {rows.map((r) => (
        <li key={r.label} className={r.count ? '' : 'dim'}>
          <span>{r.label}</span>
          <span className="ix-count-track"><span style={{ width: `${pct(r.count, max)}%`, background: r.tone }} /></span>
          <strong>{r.count}</strong>
        </li>
      ))}
    </ul>
  );
}

export interface Step { label: string; value: number; tone: string }

/** Waterfall: a starting total, then each step taken off it, ending with what is left. */
export function Waterfall({ total, totalLabel, steps, endLabel, format }: { total: number; totalLabel: string; steps: Step[]; endLabel: string; format: (n: number) => string }) {
  const used = steps.reduce((s, x) => s + x.value, 0);
  const left = total - used;
  const max = Math.max(1, total, used);
  let top = total;
  const bars = [
    { label: totalLabel, value: total, from: 0, to: total, tone: 'var(--ink)', sign: '' },
    ...steps.map((s) => { const b = { label: s.label, value: s.value, from: top - s.value, to: top, tone: s.tone, sign: '−' }; top -= s.value; return b; }),
    { label: endLabel, value: left, from: Math.min(0, left), to: Math.max(0, left), tone: left < 0 ? 'var(--ai-magenta)' : 'var(--line-strong)', sign: '' },
  ];
  return (
    <ol className="ix-wf">
      {bars.map((b) => (
        <li key={b.label}>
          <span className="ix-wf-track">
            <span className="ix-wf-bar" style={{ bottom: `${pct(Math.max(0, b.from), max)}%`, height: `${Math.max(1.5, pct(b.to - Math.max(0, b.from), max))}%`, background: b.tone }} />
          </span>
          <em>{b.label}</em>
          <b className={b.value < 0 ? 'viz-over' : ''}>{b.sign}{format(Math.abs(b.value))}</b>
        </li>
      ))}
    </ol>
  );
}
