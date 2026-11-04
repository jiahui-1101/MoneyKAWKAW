import type { LucideIcon } from 'lucide-react';
export interface MetricItem { label: string; value: string; icon: LucideIcon; note: string; tone?: string }
export function MetricCards({ items }: { items: MetricItem[] }) {
  return <div className="metrics">{items.map(({ label, value, icon: Icon, note, tone = 'brand' }) => <section className={`metric metric-${tone}`} key={label}><div className="row between"><span>{label}</span><span className="metric-icon"><Icon size={17} /></span></div><strong className="metric-value money">{value}</strong><p><span className="metric-mini-dot" />{note}</p></section>)}</div>;
}
