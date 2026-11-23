import { build, loadEnv } from 'vite';
import { cp } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Explicit opt-in supplement, never called by the ordinary production build.
assert.equal(process.env.MONEYKAWKAW_HOSTED_QA, 'synthetic-09c');
const env = { ...loadEnv('release', process.cwd(), ''), ...process.env };
assert.equal(env.VITE_SUPABASE_URL, 'https://mqklyfboywbxcexdttrl.supabase.co');
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key?.startsWith('sb_publishable_') || JSON.parse(Buffer.from(key?.split('.')[1] ?? '', 'base64url')).role === 'anon');
await build({ configFile: false, mode: 'release', publicDir: false,
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(key),
    'import.meta.env.VITE_DATA_MODE': JSON.stringify('supabase') },
  build: { outDir: '.local/phase09c/qa-assets', rollupOptions: { input: 'tests/hosted/qa.html' } },
});
await cp('.local/phase09c/qa-assets', 'dist', { recursive: true });
console.log('Temporary bounded QA entry added; normal production builds omit it.');
