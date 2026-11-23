import { describe, expect, it } from 'vitest';
import { mapNodeNeedsAction, type MapNode } from '../src/components/charts/MoneyMap';

const node = (kind: MapNode['kind'], status: string): MapNode => ({
  id: `${kind}-${status}`, kind, label: status, sub: '', tone: '', status,
});

describe('Money Map Needs action filter', () => {
  it('includes open tasks, unsettled claims, deficits, and member confirmations', () => {
    expect([
      mapNodeNeedsAction(node('task', 'Not Started')),
      mapNodeNeedsAction(node('task', 'In Progress')),
      mapNodeNeedsAction(node('task', 'Purchased')),
      mapNodeNeedsAction(node('claim', 'Pending')),
      mapNodeNeedsAction(node('claim', 'Under Review')),
      mapNodeNeedsAction(node('claim', 'Approved')),
      mapNodeNeedsAction(node('claim', 'Rejected')),
      mapNodeNeedsAction(node('dept', 'Over budget')),
      mapNodeNeedsAction(node('pay', 'Awaiting member')),
    ]).toEqual(Array(9).fill(true));
  });

  it('excludes settled tasks, claims, payments, and in-budget departments', () => {
    expect([
      mapNodeNeedsAction(node('task', 'Completed')),
      mapNodeNeedsAction(node('task', 'Claim Submitted')),
      mapNodeNeedsAction(node('claim', 'Paid')),
      mapNodeNeedsAction(node('pay', 'Member confirmed')),
      mapNodeNeedsAction(node('dept', 'Within budget')),
    ]).toEqual(Array(5).fill(false));
  });
});
