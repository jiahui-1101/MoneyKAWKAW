import { createClient } from '@supabase/supabase-js';
import { checked } from '../../src/services/supabase/finance';

// Diagnostic transport uses the installed application SDK and a genuine captured Google bearer.
// Credentials remain in memory; record only attempt counts, status and safe business errors.
export async function sdkRequest(endpoint: string, key: string, token: string, path: string,
  body: unknown, cancelAfterMs?: number) {
  if (!/^\/rest\/v1\/rpc\/[a-z_]+$/.test(path)) throw new Error('SDK checks require a reviewed RPC.');
  let response: Response | undefined, attempts = 0;
  const controller = new AbortController();
  const timer = cancelAfterMs ? setTimeout(() => controller.abort(), cancelAfterMs) : undefined;
  const client = createClient(endpoint, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: 'Bearer ' + token }, fetch: async (url, init) => {
      attempts++;
      const result = await fetch(url, init);
      response = result.clone();
      return result;
    } },
  });
  try {
    const result = await client.rpc(path.split('/').at(-1)!, body as Record<string, unknown>)
      .abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]));
    let clientMessage: string | undefined;
    try { checked(result); } catch (error) {
      if (result.error?.code === 'PT409' && error instanceof Error
        && /^(Claim|Draft|This task|Purchasing task|Selected payment|Payment|Refresh|Financial context|The staging)/.test(error.message))
        clientMessage = error.message;
    }
    return { response, attempts, status: result.status, cancelled: controller.signal.aborted,
      clientMessage, code: result.error?.code };
  } finally { if (timer) clearTimeout(timer); }
}
