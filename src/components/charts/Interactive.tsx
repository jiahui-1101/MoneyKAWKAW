import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { pct, type Slice } from './Charts';

/** Donut whose segments and legend cross-highlight on hover/focus; click pins a slice. */
export function InteractiveDonut({ slices, centre, caption, format, onSelect }: { slices: Slice[]; centre: string; caption: string; format: (n: number) => string; onSelect?: (label: string | null) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = hover ?? pinned;
  const total = slices.reduce((s, x) => s + x.value, 0);
  const cur = slices.find((s) => s.label === active);
  const r = 15.9155;
  let offset = 25;
  const toggle = (l: string) => { const n = pinned === l ? null : l; setPinned(n); onSelect?.(n); };
  return (
    <div className="viz-donut ix">
      <svg viewBox="0 0 42 42" role="img" aria-label={`${caption}: ${slices.map((s) => `${s.label} ${format(s.value)}`).join(', ')}`}>
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        {total > 0 && slices.map((s) => {
          const p = pct(s.value, total);
          const el = (
            <circle key={s.label} cx="21" cy="21" r={r} fill="none" stroke={s.tone}
              strokeWidth={active === s.label ? 7 : 5} opacity={active && active !== s.label ? 0.25 : 1}
              strokeDasharray={`${p} ${100 - p}`} strokeDashoffset={offset} className="ix-seg"
              onMouseEnter={() => setHover(s.label)} onMouseLeave={() => setHover(null)} onClick={() => toggle(s.label)} />
          );
          offset -= p;
          return el;
        })}
        <text x="21" y="21" className="viz-donut-value">{cur ? format(cur.value) : centre}</text>
        <text x="21" y="26" className="viz-donut-caption">{cur ? `${pct(cur.value, total).toFixed(0)}% ${cur.label}` : caption}</text>
      </svg>
      <ul className="viz-legend">
        {slices.map((s) => (
          <li key={s.label}>
            <button type="button" aria-pressed={pinned === s.label} className={active && active !== s.label ? 'dim' : ''}
              onMouseEnter={() => setHover(s.label)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(s.label)} onBlur={() => setHover(null)} onClick={() => toggle(s.label)}>
              <i style={{ background: s.tone }} />
              <span>{s.label}</span>
              <strong className="money">{format(s.value)}</strong>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface Tile { label: string; value: string; icon: LucideIcon; tone: string; meter?: number; to?: string }

/** Compact KPI tiles with optional meter; clickable tiles act as filters/jumps. */
export function KpiTiles({ items }: { items: Tile[] }) {
  return (
    <div className="ix-kpis">
      {items.map((t) => {
        const body = (
          <>
            <span className="ix-kpi-icon" style={{ color: t.tone }}><t.icon size={17} /></span>
            <span className="ix-kpi-label">{t.label}</span>
            <strong>{t.value}</strong>
            {t.meter !== undefined && <span className="ix-meter"><span style={{ width: `${Math.min(100, Math.max(0, t.meter))}%`, background: t.tone }} /></span>}
          </>
        );
        return t.to
          ? <Link key={t.label} to={t.to} className="ix-kpi is-link">{body}</Link>
          : <div key={t.label} className="ix-kpi">{body}</div>;
      })}
    </div>
  );
}
