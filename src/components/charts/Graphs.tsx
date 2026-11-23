import { useId, useState } from 'react';
import { pct, type Slice } from './Charts';

export interface Series { label: string; tone: string; values: number[]; dashed?: boolean }

/** Multi-series line chart with a hover crosshair tooltip and toggleable series. */
export function LineChart({ labels, series, format, label }: { labels: string[]; series: Series[]; format: (n: number) => string; label: string }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [idx, setIdx] = useState<number | null>(null);
  const gid = useId().replace(/:/g, '');
  if (labels.length < 2) return <p className="viz-empty">Not enough dated records yet.</p>;
  const w = 320, h = 150, px = 6, py = 10;
  const shown = series.filter((s) => !hidden.has(s.label));
  const max = Math.max(1, ...shown.flatMap((s) => s.values));
  const x = (i: number) => px + (i * (w - 2 * px)) / (labels.length - 1);
  const y = (v: number) => h - py - (v / max) * (h - 2 * py);
  const path = (v: number[]) => v.map((n, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(n).toFixed(1)}`).join(' ');
  const move = (e: React.MouseEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - b.left) / b.width) * w;
    setIdx(Math.max(0, Math.min(labels.length - 1, Math.round(((rel - px) / (w - 2 * px)) * (labels.length - 1)))));
  };
  return (
    <figure className="ix-line">
      <ul className="viz-keys">
        {series.map((s) => (
          <li key={s.label}>
            <button type="button" aria-pressed={!hidden.has(s.label)} onClick={() => setHidden((p) => { const n = new Set(p); if (n.has(s.label)) n.delete(s.label); else n.add(s.label); return n; })}>
              <i style={{ background: s.tone }} />{s.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="ix-plot">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label={label} onMouseMove={move} onMouseLeave={() => setIdx(null)}>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={shown[0]?.tone ?? 'var(--brand)'} stopOpacity="0.28" />
              <stop offset="1" stopColor={shown[0]?.tone ?? 'var(--brand)'} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={px} x2={w - px} y1={y(max * g)} y2={y(max * g)} className="ix-grid" />)}
          {shown[0] && !shown[0].dashed && <path d={`${path(shown[0].values)} L${x(labels.length - 1)} ${h - py} L${x(0)} ${h - py} Z`} fill={`url(#${gid})`} />}
          {shown.map((s) => <path key={s.label} d={path(s.values)} fill="none" stroke={s.tone} strokeWidth="2.2" strokeDasharray={s.dashed ? '5 4' : undefined} vectorEffect="non-scaling-stroke" />)}
          {idx !== null && <line x1={x(idx)} x2={x(idx)} y1={py} y2={h - py} className="ix-cross" />}
        </svg>
        {idx !== null && (
          <div className="ix-tip" style={{ left: `${(x(idx) / w) * 100}%` }}>
            <b>{labels[idx]}</b>
            {shown.map((s) => <span key={s.label}><i style={{ background: s.tone }} />{format(s.values[idx])}</span>)}
          </div>
        )}
      </div>
      <figcaption>{labels.map((l, i) => <span key={i}>{l}</span>)}</figcaption>
    </figure>
  );
}

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
                <strong className={`money${over ? ' viz-over' : ''}`}>{format(used)}{r.limit !== undefined && <em> / {format(r.limit)}</em>}</strong>
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

export interface HeatCell { value: number; label: string }

/** Rows × columns heatmap (e.g. activity × department utilisation %). */
export function Heatmap({ rows, cols, cells, onSelect }: { rows: string[]; cols: string[]; cells: (HeatCell | null)[][]; onSelect?: (r: number, c: number) => void }) {
  const [hover, setHover] = useState<[number, number] | null>(null);
  if (!rows.length || !cols.length) return <p className="viz-empty">Nothing to show yet.</p>;
  const tone = (v: number) => (v > 100 ? 'var(--ai-magenta)' : v >= 80 ? 'var(--ai-orange)' : 'var(--ai-purple)');
  return (
    <div className="ix-heat" role="region" aria-label="Utilisation heatmap" tabIndex={0}>
      <table>
        <thead><tr><th><span className="sr-only">Activity</span></th>{cols.map((c, j) => <th key={c} className={hover?.[1] === j ? 'on' : ''}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r}>
              <th className={hover?.[0] === i ? 'on' : ''}>{r}</th>
              {cols.map((c, j) => {
                const cell = cells[i][j];
                return (
                  <td key={c}>
                    {cell ? (
                      <button type="button" title={cell.label} style={{ background: tone(cell.value), opacity: 0.25 + Math.min(cell.value, 120) / 160 }}
                        onMouseEnter={() => setHover([i, j])} onMouseLeave={() => setHover(null)} onClick={() => onSelect?.(i, j)}>
                        {cell.value.toFixed(0)}%
                      </button>
                    ) : <span className="ix-heat-none">–</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface FlowNode { id: string; label: string; value: number; col: number; tone: string }
export interface FlowLink { from: string; to: string; value: number }

/** Column flow diagram (sankey-like). Click a node to highlight its links. */
export function FlowGraph({ nodes, links, format }: { nodes: FlowNode[]; links: FlowLink[]; format: (n: number) => string }) {
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const focus = hover ?? sel;
  if (!nodes.length) return <p className="viz-empty">Nothing to show yet.</p>;
  const cols = Math.max(...nodes.map((n) => n.col)) + 1;
  const w = 720, gap = 8, nodeW = 12;
  const colTotals = Array.from({ length: cols }, (_, c) => nodes.filter((n) => n.col === c).reduce((s, n) => s + n.value, 0));
  const counts = Array.from({ length: cols }, (_, c) => nodes.filter((n) => n.col === c).length);
  const h = Math.max(220, Math.max(...counts) * 34);
  const scale = Math.min(...colTotals.map((t, c) => (t ? (h - gap * (counts[c] - 1)) / t : Infinity)));
  const pos = new Map<string, { x: number; y: number; hgt: number; outY: number; inY: number }>();
  for (let c = 0; c < cols; c++) {
    let yy = 0;
    for (const n of nodes.filter((nn) => nn.col === c)) {
      const hgt = Math.max(3, n.value * scale);
      pos.set(n.id, { x: (c * (w - nodeW)) / Math.max(1, cols - 1), y: yy, hgt, outY: yy, inY: yy });
      yy += hgt + gap;
    }
  }
  const related = (l: FlowLink) => !focus || l.from === focus || l.to === focus;
  const linkEls = links.filter((l) => l.value > 0 && pos.has(l.from) && pos.has(l.to)).map((l, i) => {
    const a = pos.get(l.from)!, b = pos.get(l.to)!;
    const t = Math.max(1, l.value * scale);
    const y1 = a.outY + t / 2, y2 = b.inY + t / 2;
    a.outY += t; b.inY += t;
    const x1 = a.x + nodeW, x2 = b.x, mx = (x1 + x2) / 2;
    const tone = nodes.find((n) => n.id === l.to)!.tone;
    return (
      <path key={i} d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} fill="none" stroke={tone} strokeWidth={t}
        opacity={related(l) ? 0.42 : 0.06} className="ix-link"><title>{`${format(l.value)}`}</title></path>
    );
  });
  const isLinked = (id: string) => !focus || id === focus || links.some((l) => (l.from === focus && l.to === id) || (l.to === focus && l.from === id));
  return (
    <div className="ix-flow">
      <svg viewBox={`-4 -4 ${w + 8} ${h + 8}`} role="img" aria-label="Budget flow">
        {linkEls}
        {nodes.map((n) => {
          const p = pos.get(n.id)!;
          const right = n.col === cols - 1;
          return (
            <g key={n.id} className="ix-node" opacity={isLinked(n.id) ? 1 : 0.3} tabIndex={0} role="button" aria-pressed={sel === n.id}
              aria-label={`${n.label} ${format(n.value)}`}
              onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
              onClick={() => setSel(sel === n.id ? null : n.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(sel === n.id ? null : n.id); } }}>
              <rect x={p.x} y={p.y} width={nodeW} height={p.hgt} rx="3" fill={n.tone} />
              <text x={right ? p.x - 6 : p.x + nodeW + 6} y={p.y + p.hgt / 2} textAnchor={right ? 'end' : 'start'} dominantBaseline="middle">
                {n.label} <tspan className="ix-node-v">{format(n.value)}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

