import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from './ui';

export interface QueueItem { title: string; detail: string; to: string; action: string }

/** Overview "Action queue": numbered things that need this person, or an all-clear. */
export function ActionQueue({ items, clear }: { items: QueueItem[]; clear: string }) {
  return (
    <section className="panel action-queue" aria-labelledby="action-queue-title">
      <div className="row between wrap">
        <h2 id="action-queue-title">Action queue</h2>
        {items.length ? <Badge tone="gold">{items.length} to do</Badge> : <Badge tone="green">All clear</Badge>}
      </div>
      {items.length ? (
        <ol className="action-queue-list">
          {items.map((item, i) => (
            <li key={item.title}>
              <span className="claim-next-num" aria-hidden>{i + 1}</span>
              <div>
                <strong>{item.title}</strong>
                <p className="muted">{item.detail}</p>
              </div>
              <Link className="btn primary" to={item.to}>{item.action}<ChevronRight size={15} /></Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="claim-next">
          <CheckCircle2 size={20} aria-hidden />
          <div><strong>No action needed</strong><p className="muted">{clear}</p></div>
        </div>
      )}
    </section>
  );
}
