import { createClient } from '@supabase/supabase-js';
import { supabaseLocalEnvironment } from './supabase-local-env.mjs';
const { url, anonKey, serviceKey } = supabaseLocalEnvironment();

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceKey, options);
const password = 'local-test-only-2026!';
const invited = [
  ['director@moneykawkaw.test', 'Jamie Lee'],
  ['treasurer@moneykawkaw.test', 'Nora Lim'],
  ['hod-multimedia@moneykawkaw.test', 'Noor HOD'],
  ['hod-community@moneykawkaw.test', 'Rafi HOD'],
  ['member-multimedia@moneykawkaw.test', 'Aina Member'],
  ['member-community@moneykawkaw.test', 'Kian Member'],
];
const users = [...invited, ['uninvited@moneykawkaw.test', 'Synthetic Uninvited']];
const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
if (listed.error) throw listed.error;
const existing = new Map(listed.data.users.map((user) => [user.email, user]));
for (const [email, name] of users) {
  if (existing.has(email)) continue;
  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: name },
  });
  if (created.error) throw created.error;
}

for (const [email] of users) {
  const client = createClient(url, anonKey, options);
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  const claim = await client.rpc('accept_club_invitation');
  if (claim.error) throw claim.error;
  const membership = await client.from('club_memberships').select('status')
    .eq('user_id', login.data.user.id).maybeSingle();
  if (membership.error) throw membership.error;
  if (invited.some(([candidate]) => candidate === email)) {
    if (claim.data !== true || membership.data?.status !== 'active')
      throw new Error('An invited synthetic account could not claim its local membership.');
  } else if (claim.data !== false || membership.data !== null) {
    throw new Error('An uninvited synthetic account unexpectedly received club access.');
  }
  await client.auth.signOut();
}
console.log('Seeded 6 invited and 1 uninvited synthetic local accounts; no real member data was used.');
