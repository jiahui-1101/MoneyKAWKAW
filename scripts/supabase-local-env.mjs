import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export function supabaseLocalEnvironment() {
  const win = process.platform === 'win32';
  const cli = resolve(process.cwd(), 'node_modules', '.bin', win ? 'supabase.cmd' : 'supabase');
  const output = execFileSync(cli, ['status', '-o', 'env'], {
    encoding: 'utf8', windowsHide: true, shell: win,
  });
  const values = new Map();
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values.set(match[1], match[2].replace(/^"|"$/g, ''));
  }
  const url = values.get('API_URL');
  const anonKey = values.get('ANON_KEY') ?? values.get('PUBLISHABLE_KEY');
  const serviceKey = values.get('SERVICE_ROLE_KEY') ?? values.get('SECRET_KEY');
  if (!url || !anonKey || !serviceKey) throw new Error('Local Supabase is not running or did not return local keys.');
  if (!['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname))
    throw new Error('Local-only data scripts reject non-loopback Supabase URLs.');
  return { url, anonKey, serviceKey };
}
