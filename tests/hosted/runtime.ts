import { supabaseClient } from '../../src/services/supabase/client';

const endpoint = 'https://mqklyfboywbxcexdttrl.supabase.co';
const protectedIds = ['64ae397c-a1b0-45a6-9dfe-558a4954d01f', '0e90e217-9fbc-4ae4-b7f0-acfc01b80f9f',
  'b064d8da-261d-4ee9-9302-b52e5b0bc17c', '6e016c63-716b-42fd-9a5d-89cad1d42f09',
  'd61180de-a9f8-4954-a04f-9b26a990ad49', '478d55a7-f7b5-423c-bda7-7025729d7591',
  '8b7127bf-d137-4455-9107-e73f07157e90', '3eae4985-67d6-42ba-99de-37bf88b88599',
  'a195d99f-5389-477f-a049-7ce30481c2b7', '469d49dc-b6e9-46d1-a332-18ffe7d61222'];
const readRpcs = new Set(['current_club_session', 'get_my_payment_account', 'list_my_payment_accounts',
  'my_claim_destination', 'financial_summaries', 'activity_closing_report', 'assistant_context']);
export const identities: Record<string, string> = {
  '35dfb4ee-68d4-4641-8a16-df5a3232bc90': 'Director',
  '64246ce8-dd75-47da-9d15-bb9477ccf48a': 'Treasurer',
  'b1602d6f-74b0-493f-83ec-78b5baa55049': 'HOD',
  '68e63a0f-5075-465e-be73-e7be028d3809': 'Member A',
  '3c315d49-f6ea-49bb-a031-5239b4d1bf66': 'Member B',
};
export type Request = { label: string; path: string; method?: string; body?: unknown;
  expectStatus: number[]; expectCount?: number; expectCode?: string; expectNoData?: boolean; bytesBase64?: string; mime?: string; saveAs?: string };
export type Plan = { label: string; groups: Request[][]; startAt?: string };
export function resolveRequest(r: Request, bindings: Map<string, unknown>): Request {
  const lookup = (reference: string) => {
    const [name, ...keys] = reference.split('.');
    let value = bindings.get(name);
    if (!bindings.has(name)) throw new Error('Missing reviewed response binding.');
    for (const key of keys) {
      if (['__proto__', 'constructor', 'prototype'].includes(key) || !value || typeof value !== 'object'
        || !Object.hasOwn(value, key)) throw new Error('Invalid response field binding.');
      value = (value as Record<string, unknown>)[key];
    }
    return value;
  };
  const body = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(body);
    if (v && typeof v === 'object') {
      const fields = v as Record<string, unknown>;
      if (Object.keys(fields).length === 1 && typeof fields.ref === 'string') return lookup(fields.ref);
      return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, body(value)]));
    }
    return v;
  };
  return { ...r, body: body(r.body), path: r.path.replace(/\{\{([\w.-]+)\}\}/g, (_match, ref: string) => {
    const value = lookup(ref);
    if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Invalid path binding.');
    return /^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpg|json\.gz)$/.test(String(value)) ? String(value) : encodeURIComponent(String(value));
  }) };
}
export function validatePlan(plan: Plan) {
  if (!plan.label?.startsWith('SYNTHETIC-09C') || !Array.isArray(plan.groups) || plan.groups.length > 80)
    throw new Error('A bounded, labeled synthetic plan is required.');
  if (plan.startAt && (!Number.isFinite(Date.parse(plan.startAt)) || Date.parse(plan.startAt) - Date.now() > 30_000
    || Date.now() - Date.parse(plan.startAt) > 5_000)) throw new Error('Coordinated start must be within thirty seconds.');
  for (const group of plan.groups) {
    if (!Array.isArray(group) || group.length < 1 || group.length > 2) throw new Error('Maximum concurrency is two.');
    for (const r of group) {
      const url = new URL(r.path, endpoint);
      if (!r.path.startsWith('/') || url.origin !== endpoint || !/^\/(rest|storage|functions)\/v1\//.test(url.pathname)
        || !['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method ?? 'GET')
        || !Array.isArray(r.expectStatus) || !r.expectStatus.length) throw new Error('Unreviewed request target.');
      const read = (r.method ?? 'GET') === 'GET' || (r.method === 'POST' && readRpcs.has(url.pathname.split('/').at(-1)!));
      if (!read && protectedIds.some(id => (decodeURIComponent(url.pathname + url.search) + JSON.stringify(r.body)).includes(id)))
        throw new Error('The archived reference cannot be mutated.');
      if (r.bytesBase64 && r.bytesBase64.length > 1_500_000) throw new Error('Upload exceeds QA bound.');
    }
  }
}
export async function captureIdentity() {
  const client = supabaseClient();
  const { data: { user }, error } = await client.auth.getUser();
  const { data: { session } } = await client.auth.getSession();
  if (error || !user || !session || !identities[user.id]) throw new Error('Use an approved Google QA identity.');
  // Retain this genuine bearer in this tab's memory only, never in DOM, files or report output.
  const token = session.access_token;
  const bindings = new Map<string, unknown>();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return { uid: user.id, role: identities[user.id], async run(plan: Plan) {
    validatePlan(plan);
    if (plan.startAt) await new Promise(resolve => setTimeout(resolve, Math.max(0, Date.parse(plan.startAt!) - Date.now())));
    const results = [];
    for (const group of plan.groups) results.push(...await Promise.all(group.map(async template => {
      const r = resolveRequest(template, bindings);
      // Recheck after resolving IDs; response references must never bypass the archive guard.
      validatePlan({ label: plan.label, groups: [[r]] });
      const startedAt = new Date().toISOString(), started = performance.now();
      const binary = r.bytesBase64 ? Uint8Array.from(atob(r.bytesBase64), c => c.charCodeAt(0)) : undefined;
      const response = await fetch(endpoint + r.path, { method: r.method ?? 'GET', redirect: 'error',
        headers: { apikey: key, Authorization: 'Bearer ' + token,
          ...(r.body !== undefined || binary ? { 'Content-Type': r.mime ?? 'application/json' } : {}) },
        body: binary ?? (r.body === undefined ? undefined : JSON.stringify(r.body)) });
      const bytes = new Uint8Array(await response.arrayBuffer());
      let value: unknown;
      try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { /* Binary response. */ }
      if (r.saveAs && response.ok) {
        if (!/^[a-zA-Z][\w-]{0,40}$/.test(r.saveAs)) throw new Error('Invalid response binding name.');
        bindings.set(r.saveAs, value);
      }
      const object = value && typeof value === 'object' ? value as Record<string, unknown> : {};
      const count = Array.isArray(value) ? value.length : value === null ? 0 : undefined;
      const code = typeof object.code === 'string' ? object.code : undefined;
      const message = typeof object.message === 'string' && /^(Authentication required|This financial operation is frozen during activity closing|Activity unavailable|Access denied|Claim unavailable|Request key already used)$/.test(object.message)
        ? object.message : undefined;
      const id = typeof value === 'string' ? value : object.id;
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
      return { label: r.label, uid: user.id, role: identities[user.id], method: r.method ?? 'GET', path: r.path,
        startedAt, finishedAt: new Date().toISOString(), milliseconds: Math.round(performance.now() - started),
        status: response.status, requestId: response.headers.get('sb-request-id') ?? response.headers.get('x-request-id'),
        code, message, count, responseBytes: bytes.length, responseSha256: hash,
        id: typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id) ? id : undefined,
        pass: r.expectStatus.includes(response.status) && (r.expectCount === undefined || count === r.expectCount)
          && (r.expectCode === undefined || code === r.expectCode)
          && (!r.expectNoData || !response.ok || count === 0 || value === null) };
    })));
    return { label: plan.label, identity: { uid: user.id, role: identities[user.id] }, results };
  } };
}
