import type { AssistantContext } from './assistant';
import { pressureSchema } from './pressure-features';
export const factLabels: Record<string, string> = {
  budget_sen: 'Budget', allocated_sen: 'Department allocations', available_sen: 'Available to plan',
  unclaimed_sen: 'Open task reservations', pending_sen: 'Pending claim exposure', liability_sen: 'Approved unpaid liability',
  paid_sen: 'Paid expenditure', claim_sen: 'Submitted claim', estimate_sen: 'Task estimate', approved_sen: 'Approved amount',
  variance_sen: 'Over-budget amount', variance_pct: 'Variance', status: 'Claim status', risk_band: 'Deterministic risk',
  department_available_sen: 'Department available', activity_available_sen: 'Activity available',
  open_tasks: 'Open purchasing tasks', overdue_tasks: 'Overdue tasks',
};
export function factValue(key: string, value: number | string | null) {
  if (value === null) return 'Not recorded';
  if (typeof value === 'number' && key.endsWith('_sen')) return `RM ${(value / 100).toFixed(2)}`;
  return `${value}${key.endsWith('_pct') ? '%' : ''}`;
}
export const workflowHelp = 'An HOD assigns a purchase. The Member uploads the original receipt, reviews OCR, excludes personal items with reasons and submits a claim. An over-budget purchase needs a justification. Only an independent Treasurer reviews and decides. Approval is not payment. A payment record does not independently verify bank settlement. Only the claimant confirms Received. Received adds no expense.';
const statusHelp: Record<string, string> = {
  Draft: 'This claim is still being prepared. Review the receipt and submit it when complete.',
  Pending: 'This submitted claim is waiting for Treasurer review. Approval and payment are separate steps.',
  'Under Review': 'An independent Treasurer has started reviewing this claim. No decision is implied.',
  Approved: 'Approval authorizes reimbursement. No payment has yet been recorded.',
  'Payment Pending': 'Approved instructions are being processed; an external payment record is still awaited.',
  Paid: 'A Treasurer recorded a payment and proof. This does not independently verify bank settlement. The claimant has not yet confirmed receipt.',
  Received: 'The claimant confirmed receipt of the recorded reimbursement. This confirmation does not add another expense.',
  Rejected: 'The Treasurer rejected this claim. The stored reason is shown separately; no further reason is inferred.',
};
export function deterministicAnswer(c: AssistantContext) {
  const facts = Object.entries(c.values).map(([k,v]) => `${factLabels[k] ?? k}: ${factValue(k,v)}.`).join(' ');
  if (c.kind === 'HELP') return workflowHelp;
  if (c.kind === 'CLAIM') return `${facts} ${statusHelp[String(c.values.status)] ?? 'Refresh the source record for its current status.'}`;
  if (c.kind === 'RISK' || c.kind === 'LIGHTGBM') return `${facts} The SQL rule assessment remains authoritative. Pending exposure already replaces the task reservation, so approval does not add it again. The Treasurer decides independently.${Number(c.values.department_available_sen)<0 || Number(c.values.activity_available_sen)<0 ? ' Approval is blocked while current budget headroom is negative.' : ''}${c.kind === 'LIGHTGBM' ? c.ml
    ? ` Saved LightGBM score: ${(c.ml.score * 100).toFixed(1)} / 100. Model ${c.ml.version}; recorded horizon ends ${c.ml.horizon}. It estimates future budget pressure; simulation-trained and not calibrated on real outcomes. Top learned associations: ${c.ml.contributions.map((value,index) => ({value,index})).sort((a,b) => Math.abs(b.value)-Math.abs(a.value)).slice(0,4).map(({value,index}) => `${pressureSchema.features[index]?.label ?? 'Unavailable feature'} ${value.toFixed(3)} log-odds`).join('; ')}. Contributions are associations, not causes. Saved output is unverified client-reported advice and cannot override financial constraints.`
    : ' No saved LightGBM advice is available; no score is invented.' : ''}`;
  return `${facts} Available to plan subtracts open reservations, pending claims, approved unpaid liabilities and paid expenditure once. Approval and payment remain separate; Received adds no expense.`;
}
export function qwenPrompt(c: AssistantContext, language: string) {
  // Neither raw user questions nor retrieved free text is sent to the model.
  return { system: 'You are a read-only financial explainer. Summarize only the VERIFIED explanation in at most 45 words. Do not add facts, decisions, reasons, calculations, confidence, tools, commands or citations. Never change a status or claim a transfer is bank-verified. Not recorded means unknown, never zero. Reply in the requested language. Return only the explanation.',
    user: `Language: ${{en:'English',ms:'Bahasa Melayu',zh:'Simplified Chinese'}[language] ?? 'English'}. VERIFIED explanation: ${deterministicAnswer(c)}` };
}
export function validateQwenAnswer(text: string, c: AssistantContext): string | null {
  // The deficit category keeps the complete deterministic warning until quality improves.
  if (Number(c.values.department_available_sen)<0 || Number(c.values.activity_available_sen)<0) return null;
  const clean = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  if (!clean || clean.length > 2000 || /<\/?think>|https?:|```|system prompt|password|bank account|\bOTP\b|service.role/i.test(clean)) return null;
  const reference = deterministicAnswer(c);
  const numbers = (s: string) => (s.replace(/(?<=\d),(?=\d)/g, '').match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const permitted = new Set(numbers(reference));
  if (numbers(clean).some((n) => !permitted.has(n))) return null;
  const plain = clean.replace(/\*\*/g, '');
  const bindings: [string, string][] = [['(?:task )?estimate|估算|anggaran','estimate_sen'],
    ['(?:submitted |claimed )?(?:claim amount|claim)|索赔金额|jumlah tuntutan','claim_sen'],
    ['approved amount|批准金额|jumlah diluluskan','approved_sen'],
    ['difference|over-budget amount|差额|超支金额','variance_sen'], ['paid amount|paid expenditure|已付款金额','paid_sen']];
  for (const [label, key] of bindings) {
    const expected = Number(c.values[key]) / 100;
    for (const regex of [new RegExp(`(?:${label})\\s*[:=-]?\\s*(?:is\\s+)?(?:RM|MYR)\\s*([\\d,.]+)`, 'ig'),
      new RegExp(`(?:RM|MYR)\\s*([\\d,.]+)\\s*[:=-]\\s*(?:${label})`, 'ig')]) {
      for (const match of plain.matchAll(regex)) if (typeof c.values[key] !== 'number' || Number(match[1].replace(/,/g,'').replace(/\.$/,'')) !== expected) return null;
    }
  }
  if (/has decided|has approved|has paid|already approved|automatically approve|bank has verified|payment succeeded|settlement confirmed|guaranteed|real.world accuracy|caused by|已经批准|已经付款|银行已核实|保证|telah diluluskan|bayaran berjaya/i.test(clean)) return null;
  if (c.kind !== 'HELP') {
    for (const status of Object.keys(statusHelp)) {
      if (clean.includes(status) && !reference.includes(status)) return null;
    }
    if (c.values.risk_band === 'High' && /risk (is |level is )?(low|medium)|风险.*(低|中)|risiko rendah/i.test(clean)) return null;
  }
  if (c.values.status === 'Rejected' && /because|due to|no further action|因为|kerana/i.test(clean)) return null;
  if (c.kind === 'HELP' && !/approval is not payment|批准.*不.*付款|kelulusan.*bukan.*bayaran/i.test(clean)) return null;
  if (/received adds (?:an? |another |additional )?expense|received.*creates.*expense|收到.*增加.*支出/i.test(clean)) return null;
  if (c.kind === 'RISK' && c.values.risk_band === 'High' && !/high|高|tinggi/i.test(clean)) return null;
  if (c.kind === 'TASKS' && (!/task|任务|tugas/i.test(clean) || !/open|pending|未完成|待|belum/i.test(clean))) return null;
  if (c.kind === 'LIGHTGBM' && c.ml && (!/simulation|模拟|simulasi/i.test(clean) ||
    !/authoritative|权威|berkuasa/i.test(clean) || !/future|未来|masa depan/i.test(clean))) return null;
  return clean;
}
