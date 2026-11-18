import { expect, it } from 'vitest';
import { readPages } from '../src/services/supabase/pages';

it('retrieves records beyond the Supabase row cap without losing or repeating rows', async () => {
  const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
  const result = await readPages(() => ({
    range: async (from, to) => ({ data: rows.slice(from, to + 1), error: null }),
  }));
  expect(result).toEqual({ data: rows, error: null });
});

it('discards partial financial rows when a later page fails', async () => {
  const result = await readPages(() => ({
    range: async (from) => from === 0
      ? { data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }
      : { data: null, error: { message: 'Authorization changed.' } },
  }));
  expect(result.data).toBeNull();
  expect(result.error?.message).toBe('Authorization changed.');
});
