import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { build, loadEnv } from 'vite';

const root = process.cwd();
const env = { ...loadEnv('release', root, ''), ...process.env };
const endpoint = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (endpoint !== 'https://mqklyfboywbxcexdttrl.supabase.co')
  throw new Error('Release requires the authorized MoneyKAWKAW HTTPS project URL.');
let publicKey = key?.startsWith('sb_publishable_');
try {
  const payload = JSON.parse(Buffer.from(key?.split('.')[1] ?? '', 'base64url').toString());
  publicKey ||= payload.role === 'anon';
} catch { /* Modern publishable keys have no JWT payload. */ }
if (!publicKey) throw new Error('Release requires a public Supabase key. Server credentials are rejected.');

// Use a bounded generated directory so local model weights cannot enter the release.
const assets = resolve(root, '.local', 'release-public');
await rm(assets, { recursive: true, force: true });
await mkdir(assets, { recursive: true });
await cp(join(root, 'public', 'ocr'), join(assets, 'ocr'), { recursive: true });
const csp = [
  "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
  "script-src 'self' 'wasm-unsafe-eval'", "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:", "img-src 'self' blob: data: " + endpoint,
  "connect-src 'self' " + endpoint, "form-action 'self'",
].join('; ');
await writeFile(join(assets, '_headers'), [
  '/*', '  Content-Security-Policy: ' + csp, '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: no-referrer', '  X-Frame-Options: DENY',
  '  Strict-Transport-Security: max-age=31536000',
  '  Permissions-Policy: camera=(self), microphone=(), geolocation=()',
  '  Cache-Control: no-store', '',
].join('\n'));
// Explicitly close QA URLs even when an edge still has previous HTML cached.
if (env.MONEYKAWKAW_HOSTED_QA !== 'synthetic-09c') {
  await writeFile(join(assets, '_redirects'), [
    '/tests/hosted/qa / 302', '/tests/hosted/qa.html / 302', '',
    '/tests/hosted/p1 / 302', '/tests/hosted/p1.html / 302', '',
  ].join('\n'));
}
await build({
  mode: 'release', publicDir: assets,
  define: {
    'import.meta.env.VITE_DATA_MODE': JSON.stringify('supabase'),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(endpoint),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(key),
    'import.meta.env.VITE_LOCAL_TEST_LOGIN': JSON.stringify('false'),
    'import.meta.env.VITE_RECEIPT_MODEL': JSON.stringify('off'),
    'import.meta.env.VITE_QWEN_MODEL': JSON.stringify('off'),
    'import.meta.env.VITE_PRESSURE_MODEL': JSON.stringify('off'),
  },
});
async function inspect(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    files.push(...entry.isDirectory() ? await inspect(path) : [path]);
  }
  return files;
}
const files = await inspect(resolve(root, 'dist'));
if (files.some((file) => /[\\/]models[\\/]|\.onnx$|\.env/.test(file)))
  throw new Error('Unexpected model or environment file in release.');
console.log('Release built with Google login, deterministic guidance and local OCR assets.');
