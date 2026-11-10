import { Link } from 'react-router-dom';
import { Badge } from '../ui';
import { factLabels, factValue } from '../../domain/assistant-answer';
import type { AssistantMessage } from './useAssistant';
import { roleHome } from '../../domain/session';
export function AssistantAnswers({ messages, sourcePath }: { messages: AssistantMessage[]; sourcePath: string }) {
  return <div className="assistant-messages" aria-label="Assistant conversation">
    {messages.map((m, index) => <article className="assistant-answer" key={index}>
      <p><strong>You:</strong> {m.question}</p>
      <Badge tone={m.model ? 'green' : 'gold'}>{m.method}</Badge>
      <p className="assistant-prose">{m.text}</p>
      {m.model && <p className="field-hint">{m.model.version} · {m.model.device} · {m.model.tokens} generated tokens · {(m.model.milliseconds / 1000).toFixed(1)} s model job</p>}
      {m.context && <>
        <details>
          <summary>Authoritative financial facts and source</summary>
          <dl className="treasury-facts">{Object.entries(m.context.values).map(([key,value]) =>
            <div key={key}><dt>{factLabels[key] ?? key}</dt><dd>{factValue(key,value)}</dd></div>)}</dl>
          {m.context.details?.reason && <p>Stored rejection reason (source text): {m.context.details.reason}</p>}
          {m.context.details?.tasks?.map((t) => <p key={t.id}>{t.item} · {t.status} · due {t.due}</p>)}
          {m.context.ml && <p className="data-note">Saved LightGBM: {(m.context.ml.score * 100).toFixed(1)} / 100 · {m.context.ml.version}.
            Experimental, simulation-trained, client-reported advice. Not calibrated on real outcomes; cannot override SQL rules.</p>}
          <p className="field-hint">Source: {m.context.kind === 'HELP' ? 'MoneyKAWKAW workflow guide' : `${m.context.kind} · ${m.context.recordId}`} · retrieved {new Date(m.context.asOf).toLocaleString()}</p>
          <Link className="text-link" to={m.context.kind === 'HELP' ? roleHome(m.context.role) : sourcePath}>Open permitted source page</Link>
        </details>
      </>}
    </article>)}
  </div>;
}
