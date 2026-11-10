import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '../../context/session-context';
import { roleHome } from '../../domain/session';
import { Modal } from '../ui';
import { Field } from '../Field';
import { assistantChoices, type AssistantChoice } from '../../services/assistant-context';
import { workflowHelp } from '../../domain/assistant-answer';
import { useAssistant } from './useAssistant';
import { AssistantAnswers } from './AssistantAnswers';
export default function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { actor: sessionActor } = useSession(), location = useLocation();
  const actor = useMemo(() => ({ ...sessionActor }), [sessionActor]);
  const [choices, setChoices] = useState<AssistantChoice[]>([]), [selected, setSelected] = useState('');
  const [question, setQuestion] = useState(''), [error, setError] = useState('');
  const choice = choices.find((c) => c.id === selected);
  const assistant = useAssistant(actor, selected, choice?.type ?? '');
  useEffect(() => {
    const control = new AbortController();
    assistantChoices(actor, control.signal).then((data) => {
      if (!control.signal.aborted) { setChoices(data); setSelected(data.find((c) => location.pathname.includes(c.id))?.id ?? ''); }
    }).catch(() => { if (!control.signal.aborted) setError('Authorized record list unavailable. Workflow help remains available.'); });
    return () => control.abort();
  }, [actor, location.pathname]);
  const questions = actor.role === 'Director' ? ['What is the activity budget?', 'How much has been paid?'] :
    actor.role === 'Treasurer' ? ['What is the status of this claim?', 'Why is this claim High Risk?', 'Explain LightGBM disagreement'] :
    actor.role === 'HOD' ? ['Which tasks are pending in my department?', 'How much purchasing budget is available?'] :
    ['What is the status of my claim?', 'Why is it pending?', 'How do I submit a receipt?'];
  const submit = (event: FormEvent) => { event.preventDefault(); if (question.trim()) { void assistant.send(question.trim()); setQuestion(''); } };
  let sourcePath = roleHome(actor.role);
  if (choice?.type === 'CLAIM') sourcePath += `/claims/${choice.id}`;
  else if (choice?.type === 'ACTIVITY') sourcePath += `/activities/${choice.id}`;
  else if (choice?.activityId) sourcePath += `/activities/${choice.activityId}/departments/${choice.id}`;
  return <Modal title={`${actor.role} · Financial assistant`} onClose={onClose}>
    <div className="stack assistant-panel">
      <p className="data-note">Read-only help. Figures and decisions come from the club records. Qwen cannot approve, pay or confirm receipt.</p>
      <Field label="Authorized record" id="assistant-record"><select id="assistant-record" value={selected} disabled={assistant.busy}
        onChange={(e) => setSelected(e.target.value)}><option value="">Choose a record for financial questions</option>
        {choices.map((c) => <option key={c.id} value={c.id}>{c.type} · {c.label}</option>)}</select></Field>
      {(error || assistant.notice) && <p role="status" className="data-note">{assistant.notice || error}</p>}
      <div className="row wrap">{questions.map((q) => <button className="btn" key={q} disabled={assistant.busy} onClick={() => setQuestion(q)}>{q}</button>)}</div>
      <label className="member-check-field"><input type="checkbox" checked={assistant.enabled} disabled={assistant.busy}
        onChange={(e) => { assistant.setEnabled(e.target.checked); if (!e.target.checked) assistant.cancel(); }} />
        Enable experimental local Qwen · approximately 580 MB first download; substantial device memory. No prompt is sent to a hosted AI service.</label>
      {assistant.enabled && <Field label="Local model runtime" id="assistant-device"><select id="assistant-device" value={assistant.device} disabled={assistant.busy}
        onChange={(e) => assistant.setDevice(e.target.value as 'wasm' | 'webgpu')}><option value="wasm">CPU / WASM · may be slow</option><option value="webgpu">WebGPU · requires a compatible device</option></select></Field>}
      <AssistantAnswers messages={assistant.messages} sourcePath={sourcePath} />
      {assistant.busy && <p role="status">{assistant.progress}</p>}
      <form className="stack" onSubmit={submit}>
        <Field label="Your question" id="assistant-question"><textarea id="assistant-question" maxLength={500} rows={2}
          value={question} onChange={(e) => setQuestion(e.target.value)} disabled={assistant.busy} /></Field>
        <div className="row wrap"><button className="btn primary" disabled={assistant.busy || !question.trim()}>Send question</button>
          {assistant.busy && <button type="button" className="btn" onClick={assistant.cancel}>Cancel generation</button>}
          <button type="button" className="btn" onClick={assistant.clear}>Clear conversation</button></div>
      </form>
      <details><summary>Deterministic workflow help · always available</summary><p>{workflowHelp}</p></details>
      <p className="field-hint">Conversations stay in memory for this screen only. Sources are checked for every answer and on focus;
        while open, current facts are rechecked every 30 seconds. Up to five recent exchanges are retained. Generated prose may still be wrong.</p>
    </div>
  </Modal>;
}
