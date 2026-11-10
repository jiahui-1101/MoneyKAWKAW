import type { Role } from './access';
export const assistantIntents = ['HELP', 'ACTIVITY', 'DEPARTMENT', 'TASKS', 'CLAIM', 'RISK', 'LIGHTGBM', 'UNKNOWN', 'REFUSE'] as const;
export type AssistantIntent = typeof assistantIntents[number];
export interface AssistantContext {
  schema: 'assistant-v1'; role: Role; kind: AssistantIntent; recordId: string | null;
  asOf: string; revision: string;
  values: Record<string, number | string | null>;
  details?: { reason?: string; tasks?: { id: string; item: string; status: string; due: string }[] };
  ml?: { version: string; score: number; at: string; horizon: string; contributions: number[]; provenance: string } | null;
}
export function assistantLanguage(question: string): 'en' | 'ms' | 'zh' {
  return /[\u3400-\u9fff]/u.test(question) ? 'zh' : /\b(tuntutan|bayaran|bajet|kenapa|jabatan|saya|terangkan)\b/i.test(question) ? 'ms' : 'en';
}
export function routeAssistant(question: string, role: Role, previous?: AssistantIntent): AssistantIntent {
  if (question.length > 500 || !question.trim()) return 'UNKNOWN';
  if (/ignore|system prompt|secret|token|password|bank account|wallet identifier|another member|other member|reveal|忽略|密码|银行|账户|其他成员|akaun|rahsia/i.test(question)) return 'REFUSE';
  if (/\b(approve|reject|pay|transfer|confirm received)\s+(this|the|my|claim|now)|帮我批准|替我付款|luluskan.*sekarang/i.test(question)) return 'REFUSE';
  if (/^(why\??|why is it pending\??|kenapa\??|为什么[？?]?)$/i.test(question.trim())) return previous ?? 'UNKNOWN';
  if (/marketing|another department|other department|其他部门|jabatan lain/i.test(question)) return 'UNKNOWN';
  if (/lightgbm|model.*disagree|模型.*分歧|模型.*不一致/i.test(question)) return role === 'Treasurer' ? 'LIGHTGBM' : 'REFUSE';
  if (/risk|variance|over.?budget|exceed|风险|超支|lebihan/i.test(question)) return role === 'Treasurer' ? 'RISK' : 'HELP';
  if (/difference between|what does|explain.*mean|什么意思|如何|怎么|bagaimana/i.test(question)) return 'HELP';
  if (/task|purchase|overdue|tugas|采购|任务/i.test(question) && ['HOD','Member'].includes(role)) return 'TASKS';
  if (role === 'Director' && /paid|obligations|已付|bayaran/i.test(question) && !/claim|索赔|tuntutan/i.test(question)) return 'ACTIVITY';
  if (/claim|pending|paid|received|rejected|tuntutan|bayaran|索赔|报销|收款|审批/i.test(question)) return ['Member','Treasurer'].includes(role) ? 'CLAIM' : 'HELP';
  if (/task|purchase|overdue|tugas|采购|任务/i.test(question)) return ['HOD','Member'].includes(role) ? 'TASKS' : 'HELP';
  if (/budget|available|spending|allocation|bajet|预算|支出|余额/i.test(question)) return ['Director','Treasurer'].includes(role) ? 'ACTIVITY' : 'DEPARTMENT';
  if (/how|difference|apakah/i.test(question)) return 'HELP';
  return 'UNKNOWN';
}
export function validateAssistantContext(c: AssistantContext, role: Role, kind: AssistantIntent, id: string | null) {
  if (!c || c.schema !== 'assistant-v1' || c.role !== role || c.kind !== kind || c.recordId !== id ||
      !/^[a-f0-9]{64}$/.test(c.revision) || !Number.isFinite(Date.parse(c.asOf)) || !c.values ||
      Object.keys(c.values).length > 30 || Object.entries(c.values).some(([k,v]) =>
        !/^[a-z_]+$/.test(k) || /bank|account|token|password|identifier|url|holder/.test(k) ||
        !(v === null || (typeof v === 'string' && v.length <= 80) || (typeof v === 'number' && Number.isFinite(v))) ||
        (k.endsWith('_sen') && v !== null && !Number.isSafeInteger(v))))
    throw new Error('Incompatible or restricted assistant context.');
  if (JSON.stringify(c).length > 12000) throw new Error('Assistant context exceeds its limit.');
  if (c.details?.reason !== undefined && (typeof c.details.reason !== 'string' || c.details.reason.length > 300))
    throw new Error('Invalid source reason.');
  if (c.details?.tasks && (!Array.isArray(c.details.tasks) || c.details.tasks.length > 10 || c.details.tasks.some((t) =>
    typeof t.id !== 'string' || typeof t.item !== 'string' || t.item.length > 120 || typeof t.status !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.due))))
    throw new Error('Invalid task source.');
  if (c.ml && (c.ml.version !== 'pressure-v1:a711a680f94c' || !Number.isFinite(c.ml.score) || c.ml.score < 0 || c.ml.score > 1 ||
    c.ml.provenance !== 'unverified_client_advisory' || !Array.isArray(c.ml.contributions) || c.ml.contributions.length !== 14 ||
    !c.ml.contributions.every(Number.isFinite) || !Number.isFinite(Date.parse(c.ml.horizon))))
    throw new Error('Incompatible experimental model advice.');
  return c;
}
