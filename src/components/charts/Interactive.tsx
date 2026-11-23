import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { pct, type Slice } from './Charts';

export const palette = ['var(--ai-purple)', 'var(--ai-orange)', 'var(--ai-blue)', 'var(--ai-green)', 'var(--ai-magenta)'];

export interface Tab<T extends string> { id: T; label: string; icon: LucideIcon; count?: number }

/** Roving-tabindex tablist used as a page sub-navigation. */
export function DashTabs<T extends string>({ tabs, value, onChange, label }: { tabs: Tab<T>[]; value: T; onChange: (t: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const n = (i + d + tabs.length) % tabs.length;
    onChange(tabs[n].id);
    refs.current[n]?.focus();
  };
  return (
    <nav className="dash-tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button key={t.id} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`dash-tab-${t.id}`}
          aria-selected={value === t.id} aria-controls="dash-panel" tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)}>
          <t.icon size={15} />
          <span>{t.label}</span>
          {t.count !== undefined && <em>{t.count}</em>}
        </button>
      ))}
    </nav>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return <div className="stack" role="tabpanel" id="dash-panel" aria-labelledby={`dash-tab-${id}`}>{children}</div>;
}

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

export interface Tile { label: string; value: string; icon: LucideIcon; tone: string; meter?: number; active?: boolean; onClick?: () => void }

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
        return t.onClick
          ? <button key={t.label} type="button" className="ix-kpi" aria-pressed={!!t.active} onClick={t.onClick}>{body}</button>
          : <div key={t.label} className="ix-kpi">{body}</div>;
      })}
    </div>
  );
}
