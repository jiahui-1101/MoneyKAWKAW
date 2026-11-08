import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const win = process.platform === 'win32';
let generated;
try {
  generated = execFileSync(win ? 'npx.cmd' : 'npx', ['supabase', 'gen', 'types', 'typescript', '--local'], {
    encoding: 'utf8', windowsHide: true, shell: win,
  });
} catch {
  throw new Error('Could not generate local database types. Start the local Supabase database and retry.');
}
if (!generated.includes('export type Database')) throw new Error('Supabase CLI returned no database type definition.');
writeFileSync(new URL('../src/services/supabase/database.types.ts', import.meta.url), generated, 'utf8');
console.log('Generated TypeScript types from the local Supabase schema.');
