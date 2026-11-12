import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const container = 'supabase_db_MoneyKAWKAW';
const logicalLimit = 20 * 1024 * 1024;
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error((result.stderr || result.error?.message || 'Local recovery command failed').trim());
  return result.stdout.trim();
}

export function decodeArchive(compressed, logicalSha, compressedSha) {
  assert.ok(compressed.length <= 50 * 1024 * 1024, 'Compressed archive exceeds the supported size');
  assert.equal(hash(compressed), compressedSha, 'Compressed SHA-256 mismatch');
  const original = gunzipSync(compressed, { maxOutputLength: logicalLimit });
  assert.equal(hash(original), logicalSha, 'Logical SHA-256 mismatch');
  const document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(original));
  assert.equal(document.schema, 'moneykawkaw-financial-archive');
  assert.equal(document.version, 1, 'Unsupported financial archive format version');
  assert.ok(uuid.test(document.activity.id));
  assert.equal(document.reconciliation.activity_id, document.activity.id);
  assert.equal(document.approval.reconciliation_id, document.reconciliation.id);
  assert.notEqual(document.approval.decided_by, document.reconciliation.signed_by);
  assert.equal(document.approval.approved, true);
  return { document, original };
}

function verifyEvidenceFixture(document, evidenceRoot) {
  const files = new Map((document.records.receipts ?? []).map((item) => [item.id, { ...item, bucket: 'receipts' }]));
  for (const proof of document.records.proofs ?? []) files.set(proof.id, { ...proof, bucket: 'payment-proofs' });
  const evidence = document.records.evidence ?? [];
  assert.equal(evidence.length, document.reconciliation.facts.evidenceCount);
  const seen = new Set();
  let bytes = 0;
  for (const entry of evidence) {
    const file = files.get(entry.record_id);
    assert.ok(file && !seen.has(entry.record_id), 'Unlinked or duplicate evidence manifest entry');
    seen.add(entry.record_id);
    assert.equal(entry.claim_id, file.claim_id);
    assert.equal(entry.bucket, file.bucket);
    assert.equal(entry.path, file.storage_path);
    assert.equal(entry.sha256, file.sha256);
    assert.equal(entry.mime, file.mime_type);
    assert.equal(entry.bytes, file.size_bytes);
    const extension = entry.mime === 'image/png' ? 'png' : entry.mime === 'image/jpeg' ? 'jpg' : null;
    assert.ok(extension && uuid.test(entry.claim_id) && uuid.test(entry.record_id));
    assert.equal(entry.path, entry.claim_id + '/' + entry.record_id + '.' + extension);
    const filePath = join(evidenceRoot, entry.bucket, entry.path);
    assert.equal(statSync(filePath).size, entry.bytes, 'Evidence fixture size mismatch');
    const contents = readFileSync(filePath);
    assert.equal(hash(contents), entry.sha256, 'Evidence fixture SHA-256 mismatch');
    bytes += contents.length;
  }
  return { count: seen.size, bytes };
}

export function recoverArchive({ compressed, logicalSha, compressedSha, evidenceRoot }) {
  const started = performance.now();
  const { document, original } = decodeArchive(compressed, logicalSha, compressedSha);
  const evidence = verifyEvidenceFixture(document, resolve(evidenceRoot));
  const database = 'phase08_recovery_' + randomUUID().replaceAll('-', '').slice(0, 12);
  const schema = readFileSync(new URL('./recovery-schema.sql', import.meta.url), 'utf8');
  const input = "\\set package_base64 '" + original.toString('base64') + "'\n" + schema;
  docker(['exec', container, 'createdb', '-U', 'postgres', '--template=template0', database]);
  try {
    const output = docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-qAt', '-v', 'ON_ERROR_STOP=1'], input);
    const result = JSON.parse(output);
    const facts = document.reconciliation.facts;
    assert.equal(result.budget, facts.budget);
    assert.equal(result.allocated, facts.allocated);
    assert.equal(result.paid, facts.paid);
    assert.equal(result.allocated - result.paid, facts.unspentAllocated);
    assert.equal(result.budget - result.allocated, facts.unallocated);
    assert.equal(result.paymentCount, facts.payments);
    assert.equal(result.evidenceCount, evidence.count);
    assert.equal(result.auditCount, document.records.audit?.length ?? 0);
    assert.ok(result.auditCount >= facts.audit.count && result.auditBoundariesExist);
    assert.equal(result.badPayments + result.missingPayments, 0);
    assert.ok(result.exactRows && result.sourceRows === result.restoredRows);
    for (const row of result.departments) {
      const signed = facts.departments.find((department) => department.departmentId === row.id);
      assert.deepEqual([row.allocated, row.paid, row.unspent], [signed.budget, signed.paid, signed.remaining]);
    }
    return { database, ...result, evidenceBytes: evidence.bytes, milliseconds: Math.round(performance.now() - started) };
  } finally {
    docker(['exec', container, 'dropdb', '-U', 'postgres', database]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [file, evidenceRoot, logicalSha, compressedSha] = process.argv.slice(2);
  assert.ok(file && evidenceRoot && logicalSha && compressedSha,
    'Usage: node scripts/phase08/recover.mjs <archive.gz> <evidence directory> <logical SHA-256> <compressed SHA-256>');
  const result = recoverArchive({ compressed: readFileSync(file), evidenceRoot, logicalSha, compressedSha });
  console.log(JSON.stringify(result, null, 2));
}
