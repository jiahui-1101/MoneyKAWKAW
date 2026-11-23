import { expect, it } from 'vitest';
import { resolveRequest, validatePlan, type Plan } from './hosted/runtime';

const request = { label: 'own scoped read', path: '/rest/v1/claims?select=id', expectStatus: [200] };
const plan: Plan = { label: 'SYNTHETIC-09C-guard', groups: [[request, request]] };
it('permits bounded real HTTP pairs without accepting external destinations', () => {
  expect(() => validatePlan(plan)).not.toThrow();
  for (const path of ['https://example.com/rest/v1/claims', '//example.com/rest/v1/claims', '/auth/v1/admin/users'])
    expect(() => validatePlan({ ...plan, groups: [[{ ...request, path }]] })).toThrow();
  expect(() => validatePlan({ ...plan, groups: [[request, request, request]] })).toThrow();
  expect(() => validatePlan({ ...plan, startAt: new Date(Date.now() + 60_000).toISOString() })).toThrow();
});
it('resolves only prior response fields and rechecks protected record bindings', () => {
  const bindings = new Map<string, unknown>([['claim', [{ id: '0e90e217-9fbc-4ae4-b7f0-acfc01b80f9f' }]]]);
  const resolved = resolveRequest({ ...request, method: 'POST', path: '/rest/v1/rpc/transition_claim',
    body: { p_claim_id: { ref: 'claim.0.id' } } }, bindings);
  expect(() => validatePlan({ ...plan, groups: [[resolved]] })).toThrow('cannot be mutated');
  expect(() => resolveRequest({ ...request, body: { ref: 'claim.__proto__' } }, bindings)).toThrow();
});
it('protects archived reference mutations including nested forged parameters', () => {
  const mutation = { ...request, method: 'POST', path: '/rest/v1/rpc/transition_claim',
    body: { nested: { id: '0e90e217-9fbc-4ae4-b7f0-acfc01b80f9f' } } };
  expect(() => validatePlan({ ...plan, groups: [[mutation]] })).toThrow('cannot be mutated');
  expect(() => validatePlan({ ...plan, groups: [[{ ...mutation, body: {},
    path: '/rest/v1/claims?id=eq.%30e90e217-9fbc-4ae4-b7f0-acfc01b80f9f' }]] })).toThrow('cannot be mutated');
  expect(() => validatePlan({ ...plan, groups: [[{ ...request, method: 'GET',
    path: '/rest/v1/claims?id=eq.0e90e217-9fbc-4ae4-b7f0-acfc01b80f9f' }]] })).not.toThrow();
});
