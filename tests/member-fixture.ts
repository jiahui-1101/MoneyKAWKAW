import { afterEach, beforeEach, vi } from 'vitest';
import { seed } from '../src/services/seed';
import { STORAGE_KEY } from '../src/services/director';
import { selectDemoActor } from '../src/domain/session';
import type { Store } from '../src/domain/models';
import { draftService } from '../src/services/member-drafts';
export const proof = {
  name: 'receipt.png',
  mime: 'image/png',
  size: 68,
  dataUrl:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tK0AAAAASUVORK5CYII=',
};
export const account = {
  label: 'Demo bank',
  kind: 'Bank' as const,
  holder: 'Ava Chen',
  institution: 'Fictional Bank',
  identifier: '111122223333',
  isDefault: true,
};
export function setupMember() {
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map([[STORAGE_KEY, JSON.stringify(seed)]]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T10:00:00Z'));
    selectDemoActor('member-ava');
  });
  afterEach(() => {
    selectDemoActor('director-jamie');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  return {
    raw: () => JSON.parse(values.get(STORAGE_KEY)!) as Store,
    write: (s: Store) => values.set(STORAGE_KEY, JSON.stringify(s)),
  };
}
export async function capturedDraft(taskId = 'as-2', amount = 11000) {
  const id = (await draftService.begin(taskId)).result;
  let draft = await draftService.load(id);
  await draftService.receipt(id, draft.updatedAt, proof);
  draft = await draftService.load(id);
  await draftService.baseline(id, draft.updatedAt, {
    merchant: 'Demo Supplies',
    purchaseDate: '2026-11-05',
    originalTotal: amount,
    method: 'manual',
    rawText: '',
    lines: [{ id: 'cable', description: 'HDMI cable', amount }],
  });
  return await draftService.load(id);
}
