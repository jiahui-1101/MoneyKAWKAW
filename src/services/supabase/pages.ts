type PageResult<T> = { data: T[] | null; error: { message: string } | null };
type PageQuery<T> = { range(from: number, to: number): PromiseLike<PageResult<T>> };

// Supabase caps individual responses. Every caller supplies a stable unique order.
export async function readPages<T>(query: () => PageQuery<T>): Promise<PageResult<T>> {
  const rows: T[] = [];
  const size = 500;
  for (let start = 0; start < 20000; start += size) {
    const page = await query().range(start, start + size - 1);
    if (page.error || !page.data) return { data: null, error: page.error ?? { message: 'Missing page.' } };
    rows.push(...page.data);
    if (page.data.length < size) return { data: rows, error: null };
  }
  return { data: null, error: { message: 'Workspace exceeds the supported record limit.' } };
}
