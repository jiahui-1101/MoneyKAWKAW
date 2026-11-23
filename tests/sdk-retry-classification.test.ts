import { afterEach, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const clientWith = (fetcher: typeof fetch) => createClient('https://retry-check.invalid', 'synthetic-public', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetcher },
});
afterEach(() => vi.useRealTimers());

it.each([[409, 'PT409'], [403, '42501'], [400, '23514'], [404, 'P0002'], [500, 'XX000']])(
  'does not retry RPC status %s / code %s', async (status, code) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ code, message: 'Synthetic terminal error' }), { status: Number(status) }));
    const result = await clientWith(fetcher).rpc('synthetic_mutation', {});
    expect(result.error?.code).toBe(code);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

it('bounds transient read retries to three retries with exponential delays', async () => {
  vi.useFakeTimers();
  const attempts: number[] = [];
  const fetcher = vi.fn<typeof fetch>(async () => {
    attempts.push(Date.now());
    return new Response(JSON.stringify({ message: 'Synthetic unavailable' }), { status: 503 });
  });
  const result = Promise.resolve(clientWith(fetcher).from('claims').select('id'));
  await vi.runAllTimersAsync();
  expect((await result).status).toBe(503);
  expect(attempts).toHaveLength(4);
  expect(attempts.slice(1).map((time, index) => time - attempts[index])).toEqual([1000, 2000, 4000]);
});

it('cancels backoff without another network attempt', async () => {
  vi.useFakeTimers();
  const control = new AbortController();
  let networkAttempts = 0;
  const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
    if (init?.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    networkAttempts++;
    return new Response('{}', { status: 503 });
  });
  const result = Promise.resolve(clientWith(fetcher).from('claims').select('id').abortSignal(control.signal));
  await vi.advanceTimersByTimeAsync(100);
  control.abort();
  await vi.runAllTimersAsync();
  expect((await result).status).toBe(0);
  expect(networkAttempts).toBe(1);
});
