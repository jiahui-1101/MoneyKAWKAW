import { createClient } from '@supabase/supabase-js';
import { supabaseLocalEnvironment } from '../../scripts/supabase-local-env.mjs';

export const local = supabaseLocalEnvironment();
export const testPassword = 'local-test-only-2026!';
export const syntheticEmails = {
  director: 'director@moneykawkaw.test', treasurer: 'treasurer@moneykawkaw.test',
  multimediaHod: 'hod-multimedia@moneykawkaw.test', communityHod: 'hod-community@moneykawkaw.test',
  multimediaMember: 'member-multimedia@moneykawkaw.test', communityMember: 'member-community@moneykawkaw.test',
  uninvited: 'uninvited@moneykawkaw.test',
};
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
export const anonymous = createClient(local.url, local.anonKey, options);
export const admin = createClient(local.url, local.serviceKey, options);
export async function signIn(email, storage) {
  const client = createClient(local.url, local.anonKey, {
    ...options, auth: { ...options.auth, ...(storage ? { storage, persistSession: true } : {}) },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: testPassword });
  if (error) throw error;
  return { client, user: data.user };
}
export async function userId(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (error) throw error;
  const user = data.users.find((candidate) => candidate.email === email);
  if (!user) throw new Error('Synthetic local test account is missing.');
  return user.id;
}
