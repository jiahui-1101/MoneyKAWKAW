import type { Understanding } from '../../domain/receipt-understanding';
import { Badge, Panel } from '../ui';
export function ReceiptSemantics({ understanding }: { understanding?: Understanding }) {
  if (!understanding) return null;
  return <Panel title="Receipt line suggestions" subtitle={understanding.message}>
    <div className="member-content stack">
      <div className="row wrap">
        <Badge tone={understanding.status === 'ready' ? 'gold' : 'neutral'}>
          {understanding.status === 'ready' ? 'Experimental model ran' : 'Using OCR + rules'}
        </Badge>
        <small>{understanding.model} · {(understanding.milliseconds / 1000).toFixed(1)}s</small>
      </div>
      {understanding.status === 'ready' && <>
        <p>These labels suggest what text means. They do not verify prices, decide eligibility, or exclude personal purchases. Low scores are marked uncertain; scores are not calibrated probabilities.</p>
        <details><summary>Review detected line labels ({understanding.predictions.length})</summary>
          <ul>{understanding.predictions.map((p, i) => <li key={i}>
            <strong>{p.label.toLowerCase().replaceAll('_', ' ')}</strong>{p.score < .85 ? ' · uncertain' : ' · suggested'}: {p.text}
          </li>)}</ul>
        </details>
      </>}
    </div>
  </Panel>;
}
