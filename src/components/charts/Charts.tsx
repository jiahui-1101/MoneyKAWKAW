import type { ReactNode } from 'react';

export interface Slice {
  label: string;
  value: number;
  tone: string;
}

export const pct = (v: number, t: number) => (t > 0 ? Math.max(0, (v / t) * 100) : 0);

/** Card wrapper used by every chart so dashboards read as one system. */
export function ChartCard({ title, hint, children, wide }: { title: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`viz-card${wide ? ' viz-wide' : ''}`}>
      <header>
        <h3>{title}</h3>
        {hint && <p>{hint}</p>}
      </header>
      {children}
    </section>
  );
}

/** Ring chart with a centre total and an accessible legend. */
export function Donut({ slices, centre, caption, format }: { slices: Slice[]; centre: string; caption: string; format: (n: number) => string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = 15.9155;
  let offset = 25;
  return (
    <div className="viz-donut">
      <svg viewBox="0 0 42 42" role="img" aria-label={`${caption}: ${slices.map((s) => `${s.label} ${format(s.value)}`).join(', ')}`}>
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        {total > 0 &&
          slices.map((s) => {
            const p = pct(s.value, total);
            const el = (
              <circle key={s.label} cx="21" cy="21" r={r} fill="none" stroke={s.tone} strokeWidth="5" strokeDasharray={`${p} ${100 - p}`} strokeDashoffset={offset} />
            );
            offset -= p;
            return el;
          })}
        <text x="21" y="21" className="viz-donut-value">{centre}</text>
        <text x="21" y="26" className="viz-donut-caption">{caption}</text>
      </svg>
      <ul className="viz-legend">
        {slices.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.tone }} />
            <span>{s.label}</span>
            <strong className="money">{format(s.value)}</strong>
            <em>{pct(s.value, total).toFixed(0)}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Half-circle gauge for a single utilisation ratio; turns red past 100%. */
export function Gauge({ value, label, warnAt = 80 }: { value: number; label: string; warnAt?: number }) {
  const v = Math.min(Math.max(value, 0), 100);
  const tone = value > 100 ? 'var(--danger)' : value >= warnAt ? 'var(--gold)' : 'var(--green)';
  return (
    <div className="viz-gauge">
      <svg viewBox="0 0 120 70" role="img" aria-label={`${label} ${value.toFixed(1)}%`}>
        <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="var(--line)" strokeWidth="12" strokeLinecap="round" pathLength={100} />
        <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke={tone} strokeWidth="12" strokeLinecap="round" pathLength={100} strokeDasharray={`${v} 100`} />
        <text x="60" y="55" className="viz-gauge-value">{value.toFixed(0)}%</text>
      </svg>
      <span>{label}</span>
    </div>
  );
}

export interface StackRow {
  id: string;
  label: string;
  total: number;
  parts: Slice[];
  href?: string;
}

/** Horizontal stacked bars: each row's parts against its total (e.g. paid / pending / committed vs allocation). */
export function StackedBars({ rows, format, empty = 'Nothing to show yet.' }: { rows: StackRow[]; format: (n: number) => string; empty?: string }) {
  if (!rows.length) return <p className="viz-empty">{empty}</p>;
  const max = Math.max(...rows.map((r) => Math.max(r.total, r.parts.reduce((s, p) => s + p.value, 0))), 1);
  return (
    <ul className="viz-stack">
      {rows.map((r) => {
        const used = r.parts.reduce((s, p) => s + p.value, 0);
        const over = used > r.total;
        return (
          <li key={r.id}>
            <div className="viz-stack-head">
              <span>{r.label}</span>
              <strong className={`money${over ? ' viz-over' : ''}`}>
                {format(used)} <em>/ {format(r.total)}</em>
              </strong>
            </div>
            <div className="viz-stack-track" role="img" aria-label={`${r.label}: ${r.parts.map((p) => `${p.label} ${format(p.value)}`).join(', ')} of ${format(r.total)}`}>
              <span className="viz-stack-limit" style={{ width: `${pct(r.total, max)}%` }} />
              {r.parts.map((p) => (
                <span key={p.label} className="viz-stack-seg" style={{ width: `${pct(p.value, max)}%`, background: p.tone }} />
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Legend row shared by stacked charts. */
export function Legend({ items }: { items: Omit<Slice, 'value'>[] }) {
  return (
    <ul className="viz-keys">
      {items.map((i) => (
        <li key={i.label}><i style={{ background: i.tone }} />{i.label}</li>
      ))}
    </ul>
  );
}
