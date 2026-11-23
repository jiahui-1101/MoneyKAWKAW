import { expect, it } from 'vitest';
import { validatePlan, type Plan } from './hosted/runtime';

const request = { label: 'own scoped read', path: '/rest/v1/claims?select=id', expectStatus: [200] };
const plan: Plan = { label: 'SYNTHETIC-09C-guard', groups: [[request, request]] };
it('permits bounded real HTTP pairs without accepting external destinations', () => {
  expect(() => validatePlan(plan)).not.toThrow();
  for (const path of ['https://example.com/rest/v1/claims', '//example.com/rest/v1/claims', '/auth/v1/admin/users'])
    expect(() => validatePlan({ ...plan, groups: [[{ ...request, path }]] })).toThrow();
  expect(() => validatePlan({ ...plan, groups: [[request, request, request]] })).toThrow();
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
