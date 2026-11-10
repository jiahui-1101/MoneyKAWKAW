import { useCallback, useEffect, useRef, useState } from 'react';
import type { DemoActor } from '../../domain/session';
import { assistantLanguage, routeAssistant, type AssistantContext, type AssistantIntent } from '../../domain/assistant';
import { deterministicAnswer, qwenPrompt, validateQwenAnswer } from '../../domain/assistant-answer';
import { assistantContext } from '../../services/assistant-context';
import { QwenSession, type QwenResult } from '../../services/qwen';
export interface AssistantMessage { question: string; text: string; method: string; context?: AssistantContext; model?: QwenResult }
export function useAssistant(actor: DemoActor, selected: string, selectedType: string) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]), [facts, setFacts] = useState<AssistantContext>();
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [progress, setProgress] = useState('');
  const [enabled, setEnabled] = useState(false), [device, setDevice] = useState<'wasm' | 'webgpu'>('wasm');
  const model = useRef(new QwenSession()), active = useRef<AbortController | null>(null);
  const previous = useRef<AssistantIntent | undefined>(undefined);
  const stop = useCallback(() => { active.current?.abort(); model.current.cancel(); }, []);
  const clear = useCallback(() => {
    stop(); previous.current = undefined;
    setMessages([]); setFacts(undefined); setBusy(false);
  }, [stop]);
  useEffect(() => {
    clear();
    return stop;
    // Identity and route are keyed by the host; scope changes clear private state.
  }, [selected, clear, stop]);
  useEffect(() => {
    if (!facts) return;
    const control = new AbortController();
    const check = async () => {
      try {
        const fresh = await assistantContext(actor, facts.kind, facts.recordId, control.signal);
        if (fresh.revision !== facts.revision) { clear(); setNotice('The record changed. Ask again for current facts.'); }
      } catch { if (!control.signal.aborted) { clear(); setNotice('Access changed. Private conversation cleared.'); } }
    };
    const timer = setInterval(() => void check(), 30000);
    window.addEventListener('focus', check);
    return () => { clearInterval(timer); control.abort(); window.removeEventListener('focus', check); };
  }, [facts, actor, clear]);
  const send = async (question: string) => {
    if (busy) return;
    const kind = routeAssistant(question, actor.role, previous.current);
    if (kind === 'UNKNOWN' || kind === 'REFUSE') {
      setMessages((m) => [...m.slice(-4), { question, method:'Deterministic guidance', text:kind === 'REFUSE'
        ? 'This assistant is read-only and cannot reveal private payment information or perform financial actions.'
        : 'Choose an authorized record and ask about its budget, tasks or claim status. Unsupported or ambiguous questions do not fetch broader data.' }]); return;
    }
    const expected = kind === 'ACTIVITY' ? 'ACTIVITY' : ['DEPARTMENT','TASKS'].includes(kind) ? 'DEPARTMENT' : 'CLAIM';
    if (kind !== 'HELP' && (!selected || selectedType !== expected)) { setNotice(`Select an authorized ${expected.toLowerCase()} first.`); return; }
    const control = new AbortController(); active.current = control;
    setBusy(true); setNotice(''); setProgress('Checking authorized context…');
    try {
      const context = await assistantContext(actor, kind, kind === 'HELP' ? null : selected, control.signal);
      if (control.signal.aborted) return;
      setFacts(context);
      let text = deterministicAnswer(context), method = 'Deterministic financial explanation', result: QwenResult | undefined;
      if (enabled) {
        try {
          const prompt = qwenPrompt(context, assistantLanguage(question));
          result = await model.current.generate({ ...prompt, device }, control.signal, setProgress);
          const validated = validateQwenAnswer(result.text, context);
          if (validated) { text = validated; method = 'Qwen-generated explanation · validated hybrid'; }
          else { method = 'Deterministic fallback · Qwen output rejected'; result = undefined; }
        } catch (error) {
          if (control.signal.aborted) return;
          method = 'Deterministic fallback · Qwen unavailable';
          setNotice(error instanceof Error ? error.message : 'Qwen unavailable.');
        }
      }
      const fresh = await assistantContext(actor, kind, context.recordId, control.signal);
      if (control.signal.aborted) return;
      if (fresh.revision !== context.revision) { clear(); setNotice('The financial record changed during generation. Ask again.'); return; }
      previous.current = kind;
      setMessages((m) => [...m.slice(-4), { question, text, method, context, model:result }]);
    } catch {
      if (!control.signal.aborted) { clear(); setNotice('Authorized context unavailable. Private conversation cleared; use the existing workspace.'); }
    } finally { if (!control.signal.aborted) { setBusy(false); setProgress(''); } }
  };
  return { messages, facts, busy, notice, progress, enabled, setEnabled, device, setDevice, send, clear,
    cancel: () => { active.current?.abort(); model.current.cancel(); setBusy(false); setProgress(''); setNotice('Generation cancelled. Financial workflows are unchanged.'); } };
}
