import { pct } from './Charts';

/** Area + line trend over ordered buckets (e.g. monthly spend). */
export function TrendArea({ points, format, label }: { points: { label: string; value: number }[]; format: (n: number) => string; label: string }) {
  if (points.length < 2) return <p className="viz-empty">Not enough dated records to draw a trend.</p>;
  const w = 300, h = 120, pad = 8;
  const max = Math.max(...points.map((p) => p.value), 1);
  const xy = points.map((p, i) => [pad + (i * (w - 2 * pad)) / (points.length - 1), h - pad - (p.value / max) * (h - 2 * pad)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <figure className="viz-trend">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`${label}: ${points.map((p) => `${p.label} ${format(p.value)}`).join(', ')}`}>
        <defs>
          <linearGradient id="viz-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${xy[xy.length - 1][0]} ${h - pad} L${xy[0][0]} ${h - pad} Z`} fill="url(#viz-area)" />
        <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption>
        {points.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Pipeline funnel: count at each workflow stage as proportional columns. */
export function Pipeline({ stages }: { stages: { label: string; count: number; tone: string }[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <ol className="viz-pipeline">
      {stages.map((s) => (
        <li key={s.label}>
          <strong>{s.count}</strong>
          <span className="viz-pipe-bar"><span style={{ height: `${pct(s.count, max)}%`, background: s.tone }} /></span>
          <em>{s.label}</em>
        </li>
      ))}
    </ol>
  );
}
