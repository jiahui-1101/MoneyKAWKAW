import { useState } from 'react';
import { Link } from 'react-router-dom';
import { summarize } from '../../domain/budget';
import type { Activity, Expense, Payment, Store } from '../../domain/models';
import { statusLabel, useFormat } from '../ui';
import { Legend } from './Charts';
import { tones } from './Insights';

type Kind = 'dept' | 'task' | 'claim' | 'pay';
export interface MapNode { id: string; kind: Kind; label: string; sub: string; tone: string; status: string; to?: string }
interface Edge { from: string; to: string }

export function mapNodeNeedsAction(node: MapNode) {
  if (node.kind === 'dept') return node.status === 'Over budget';
  if (node.kind === 'task') return ['Not Started', 'In Progress', 'Purchased'].includes(node.status);
  if (node.kind === 'claim') return ['Pending', 'Under Review', 'Approved', 'Payment Pending', 'Rejected'].includes(node.status);
  return node.status === 'Awaiting member';
}

const columns: { kind: Kind; title: string }[] = [
  { kind: 'dept', title: 'Department' },
  { kind: 'task', title: 'Purchase task' },
  { kind: 'claim', title: 'Claim' },
  { kind: 'pay', title: 'Payment' },
];
const statusTone = { ok: tones.paid, wait: tones.pending, approved: tones.committed, bad: tones.declined, idle: 'var(--line-strong)' };

/** Claim stage derived from the claim record and its payment (same rules as claimStages). */
function claimStatus(e: Expense, payments: Payment[]) {
  const p = payments.find((x) => x.expenseId === e.id);
  const stage = e.lifecycle ?? (p ? (p.manual?.receivedConfirmedAt ? 'Received' : 'Paid') : e.state === 'Pending review' ? 'Pending' : e.state === 'In review' ? 'Under Review' : e.state === 'Declined' ? 'Rejected' : 'Approved');
  const tone = ['Paid', 'Received'].includes(stage) ? statusTone.ok : stage === 'Rejected' ? statusTone.bad : ['Approved', 'Payment Pending'].includes(stage) ? statusTone.approved : statusTone.wait;
  return { stage, tone };
}

function build(store: Store, a: Activity, money: (n: number) => string, claimHref?: (id: string) => string) {
  const nodes: MapNode[] = [];
  const edges: Edge[] = [];
  for (const d of a.departments) {
    const s = summarize(store, a.id, d.id);
    const used = s.paid + s.pending + s.committed;
    nodes.push({ id: d.id, kind: 'dept', label: d.name, sub: `${money(used)} / ${money(d.allocation)}`, status: used > d.allocation ? 'Over budget' : 'Within budget', tone: used > d.allocation ? statusTone.bad : 'var(--ink)' });
  }
  const tasks = store.assignments.filter((t) => t.activityId === a.id && t.purchasing && t.purchasing.status !== 'Cancelled');
  for (const t of tasks) {
    const st = t.purchasing!.status;
    nodes.push({ id: t.id, kind: 'task', label: t.purchasing!.name, sub: money(t.budget), status: st, tone: st === 'Completed' || st === 'Claim Submitted' ? statusTone.ok : st === 'Purchased' ? statusTone.approved : st === 'In Progress' ? statusTone.wait : statusTone.idle });
    edges.push({ from: t.departmentId, to: t.id });
  }
  for (const e of store.expenses.filter((x) => x.activityId === a.id)) {
    const { stage, tone } = claimStatus(e, store.payments);
    nodes.push({ id: e.id, kind: 'claim', label: e.description, sub: money(e.amount), status: stage, tone, to: claimHref?.(e.id) });
    const task = tasks.find((t) => t.expenseId === e.id);
    edges.push({ from: task ? task.id : e.departmentId, to: e.id });
    for (const p of store.payments.filter((x) => x.expenseId === e.id)) {
      const ok = !!p.manual?.receivedConfirmedAt;
      nodes.push({ id: p.id, kind: 'pay', label: money(p.amount), sub: p.date, status: ok ? 'Member confirmed' : 'Awaiting member', tone: ok ? statusTone.ok : statusTone.approved });
      edges.push({ from: e.id, to: p.id });
    }
  }
  return { nodes, edges };
}

/** Every node reachable upstream or downstream from `id`. */
function chain(id: string, edges: Edge[]) {
  const seen = new Set([id]);
  const walk = (cur: string, dir: 'up' | 'down') => {
    for (const e of edges) {
      const next = dir === 'down' ? (e.from === cur ? e.to : null) : e.to === cur ? e.from : null;
      if (next && !seen.has(next)) { seen.add(next); walk(next, dir); }
    }
  };
  walk(id, 'up');
  walk(id, 'down');
  return seen;
}

const COL_W = 230, NODE_W = 190, NODE_H = 52, GAP = 12, TOP = 30;

/** Impact-style dependency map: department → task → claim → payment. Click a node to trace its chain. */
export function MoneyMap({ store, activity, claimHref }: { store: Store; activity: Activity; claimHref?: (id: string) => string }) {
  const { money } = useFormat();
  const [sel, setSel] = useState<string | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [asList, setAsList] = useState(false);
  const { nodes, edges } = build(store, activity, (n) => money(n, true), claimHref);
  const visible = onlyOpen ? new Set(nodes.filter(mapNodeNeedsAction).flatMap((n) => [...chain(n.id, edges)])) : null;
  const shown = nodes.filter((n) => !visible || visible.has(n.id));
  const pos = new Map<string, { x: number; y: number }>();
  const parentY = (id: string) => Math.min(Infinity, ...edges.filter((e) => e.to === id && pos.has(e.from)).map((e) => pos.get(e.from)!.y));
  columns.forEach((c, ci) => shown.filter((n) => n.kind === c.kind)
    .map((n, i) => ({ n, key: ci ? parentY(n.id) : i, i }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .forEach(({ n }, i) => pos.set(n.id, { x: ci * COL_W, y: TOP + i * (NODE_H + GAP) })));
  const height = TOP + Math.max(1, ...columns.map((c) => shown.filter((n) => n.kind === c.kind).length)) * (NODE_H + GAP);
  const lit = sel ? chain(sel, edges) : null;
  const current = nodes.find((n) => n.id === sel);
  if (!nodes.length) return <p className="viz-empty">No departments yet. Add them in the Departments tab.</p>;
  return (
    <div className="mm">
      <div className="row between wrap">
        <Legend items={[
          { label: 'Done', tone: statusTone.ok },
          { label: 'Waiting', tone: statusTone.wait },
          { label: 'Approved', tone: statusTone.approved },
          { label: 'Declined / over budget', tone: statusTone.bad },
        ]} />
        <div className="mm-seg" role="group" aria-label="Show">
          <button type="button" aria-pressed={!onlyOpen} onClick={() => setOnlyOpen(false)}>All</button>
          <button type="button" aria-pressed={onlyOpen} onClick={() => { setOnlyOpen(true); setSel(null); }}>Needs action</button>
        </div>
        <button type="button" className="btn" aria-pressed={asList} onClick={() => setAsList(!asList)}>{asList ? 'Show as map' : 'Show as list'}</button>
      </div>
      {asList ? (
        <div className="table-wrap" role="region" aria-label="Money map as a list" tabIndex={0}>
          <table className="mm-table">
            <thead><tr><th>Step</th><th>Name</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {columns.flatMap((c) => shown.filter((n) => n.kind === c.kind).map((n) => (
                <tr key={n.id}>
                  <td>{c.title}</td>
                  <td>{n.to ? <Link to={n.to}>{n.label}</Link> : n.label}</td>
                  <td className="money">{n.sub}</td>
                  <td><span className="mm-dot" style={{ background: n.tone }} />{statusLabel(n.status)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      ) : <>
      <div className="mm-scroll" role="region" aria-label="Money map" tabIndex={0}>
        <div className="mm-canvas" style={{ width: COL_W * 3 + NODE_W, height }}>
          {columns.map((c, i) => <span key={c.kind} className="mm-col" style={{ left: i * COL_W }}>{c.title}</span>)}
          <svg width={COL_W * 3 + NODE_W} height={height} aria-hidden="true">
            {edges.filter((e) => pos.has(e.from) && pos.has(e.to)).map((e) => {
              const a = pos.get(e.from)!, b = pos.get(e.to)!;
              const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2, mx = (x1 + x2) / 2;
              const on = !lit || (lit.has(e.from) && lit.has(e.to));
              return <path key={e.from + e.to} d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} className={`mm-edge${on && lit ? ' on' : ''}${on ? '' : ' off'}`} />;
            })}
          </svg>
          {shown.map((n) => {
            const p = pos.get(n.id)!;
            return (
              <button key={n.id} type="button" className={`mm-node${lit && !lit.has(n.id) ? ' off' : ''}`} aria-pressed={sel === n.id}
                style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }} onClick={() => setSel(sel === n.id ? null : n.id)}
                aria-label={`${n.label}, ${n.sub}, ${statusLabel(n.status)}`}>
                <i style={{ background: n.tone }} />
                <span>{n.label}</span>
                <small>{n.sub}</small>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mm-detail" role="status">
        {current ? <>
          <i style={{ background: current.tone }} />
          <strong>{current.label}</strong>
          <span>{statusLabel(current.status)}</span>
          <span className="money">{current.sub}</span>
          {current.to && <Link className="text-link" to={current.to}>Open claim</Link>}
        </> : <span className="muted">Nothing selected. Tap a box to see where its money comes from and goes.</span>}
      </div>
      </>}
    </div>
  );
}
