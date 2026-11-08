import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type DataMode = 'demo' | 'local' | 'supabase';
const configuredMode = import.meta.env.MODE === 'test' ? 'demo' : (import.meta.env.VITE_DATA_MODE ?? 'supabase');
export const dataMode = configuredMode as DataMode | string;
export const demoMode = dataMode === 'demo';
let client: SupabaseClient<Database> | undefined;

export function supabaseClient(): SupabaseClient<Database> {
  if (demoMode) throw new Error('Supabase is disabled in explicit demo mode.');
  if (!['local', 'supabase'].includes(dataMode)) throw new Error('Choose demo, local, or Supabase mode.');
  if (client) return client;
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key } = import.meta.env;
  if (!url || !key) throw new Error('Supabase configuration is missing. Add the URL and publishable key to the local environment.');
  let endpoint: URL;
  try { endpoint = new URL(url); } catch { throw new Error('Supabase URL must be a valid HTTPS or local development URL.'); }
  const host = endpoint.hostname;
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
  if (dataMode === 'local' && (!loopback || endpoint.protocol !== 'http:'))
    throw new Error('Local mode only connects to a loopback Supabase instance.');
  if (dataMode === 'supabase' && (loopback || endpoint.protocol !== 'https:'))
    throw new Error('Supabase mode requires the HTTPS URL of the authorized project.');
  const token = key.split('.')[1];
  try {
    if (key.startsWith('sb_secret_') || (token && JSON.parse(atob(token)).role === 'service_role'))
      throw new Error('A server-only Supabase key cannot be used in the browser.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('server-only')) throw error;
  }
  client = createClient<Database>(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  return client;
}
