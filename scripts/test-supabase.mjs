import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const win = process.platform === 'win32';
const root = fileURLToPath(new URL('..', import.meta.url));
const cli = win
  ? resolve(root, 'node_modules', '@supabase', 'cli-windows-x64', 'bin', 'supabase.exe')
  : resolve(root, 'node_modules', '.bin', 'supabase');
let startAttempted = false;
function run(command, args, label, inherit = false) {
  const result = spawnSync(command, args, {
    cwd: root, encoding: 'utf8', windowsHide: true, shell: false,
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) throw new Error(`${label} failed. See the local runtime and CLI prerequisites.`);
}

try {
  startAttempted = true;
  run(cli, ['start'], 'Local Supabase startup');
  run(cli, ['db', 'reset'], 'Local database reset');
  run(process.execPath, ['scripts/seed-supabase.mjs'], 'Synthetic local seed', true);
  const tests = readdirSync(new URL('../tests/supabase', import.meta.url))
    .filter((file) => file.endsWith('.test.mjs')).sort().map((file) => `tests/supabase/${file}`);
  if (!tests.length) throw new Error('No Supabase integration tests were found.');
  run(process.execPath, ['--test', '--test-concurrency=1', ...tests], 'Supabase integration tests', true);
} finally {
  if (startAttempted) {
    try { run(cli, ['stop'], 'Local Supabase shutdown'); }
    catch { /* A failed start may leave no service to stop. */ }
  }
}
