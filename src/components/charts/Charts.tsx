import type { ReactNode } from 'react';
import { InteractiveDonut } from './Interactive';
import { BarList } from './Graphs';

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

/** Ring chart with a centre total and an interactive legend. */
export function Donut(props: { slices: Slice[]; centre: string; caption: string; format: (n: number) => string }) {
  return <InteractiveDonut {...props} />;
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

/** Horizontal stacked bars with hover breakdown (row parts against its total). */
export function StackedBars({ rows, format, empty }: { rows: StackRow[]; format: (n: number) => string; empty?: string }) {
  return <BarList rows={rows.map((r) => ({ id: r.id, label: r.label, parts: r.parts, limit: r.total }))} format={format} empty={empty} />;
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
