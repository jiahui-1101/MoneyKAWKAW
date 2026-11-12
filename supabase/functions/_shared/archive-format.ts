export const maxLogicalBytes = 20 * 1024 * 1024;
export const maxCompressedBytes = 50 * 1024 * 1024;
export const uuidPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const maxEvidenceBytes = 1024 * 1024;

export class ArchiveFault extends Error {
  constructor(readonly code: string) { super(code); }
}

export interface Evidence {
  kind: 'receipt' | 'payment proof';
  bucket: 'receipts' | 'payment-proofs';
  record_id: string;
  claim_id: string;
  path: string;
  bytes: number;
  mime: 'image/png' | 'image/jpeg';
  sha256: string;
  finalized_at: string;
  retention: 'Retained original';
}

export async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function readBounded(stream: ReadableStream<Uint8Array> | null, limit: number, code: string) {
  if (!stream) throw new ArchiveFault(code);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ArchiveFault(code);
      }
      chunks.push(result.value);
    }
  } catch {
    throw new ArchiveFault(code);
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function gzip(source: Uint8Array<ArrayBuffer>) {
  const stream = new Blob([source]).stream().pipeThrough(new CompressionStream('gzip'));
  return readBounded(stream, maxCompressedBytes, 'UPLOAD_FAILED');
}

export function gunzip(compressed: Uint8Array<ArrayBuffer>) {
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  return readBounded(stream, maxLogicalBytes, 'ARCHIVE_MISMATCH');
}

export function archiveManifest(source: Uint8Array<ArrayBuffer>, archiveId: string, activityId: string): Evidence[] {
  try {
    const document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(source));
    if (document.schema !== 'moneykawkaw-financial-archive' || document.version !== 1 ||
      document.archiveId !== archiveId || document.activity?.id !== activityId ||
      document.reconciliation?.activity_id !== activityId ||
      document.approval?.reconciliation_id !== document.reconciliation?.id ||
      document.approval?.approved !== true || document.approval?.decided_by === document.reconciliation?.signed_by ||
      !document.records || Array.isArray(document.records) || typeof document.records !== 'object')
      throw new ArchiveFault('ARCHIVE_MISMATCH');
    const evidence: Evidence[] = document.records.evidence ?? [];
    if (!Array.isArray(evidence) || evidence.length > 2000) throw new ArchiveFault('ARCHIVE_MISMATCH');
    const seen = new Set<string>();
    for (const item of evidence) {
      const extension = item.mime === 'image/png' ? 'png' : item.mime === 'image/jpeg' ? 'jpg' : '';
      const expectedBucket = item.kind === 'receipt' ? 'receipts' : item.kind === 'payment proof' ? 'payment-proofs' : '';
      const key = item.bucket + '/' + item.path;
      if (!expectedBucket || item.bucket !== expectedBucket || !extension ||
        !uuidPattern.test(item.record_id) || !uuidPattern.test(item.claim_id) ||
        item.path !== item.claim_id + '/' + item.record_id + '.' + extension ||
        !Number.isSafeInteger(item.bytes) || item.bytes < 1 || item.bytes > maxEvidenceBytes ||
        !hashPattern.test(item.sha256) || !Number.isFinite(Date.parse(item.finalized_at)) ||
        item.retention !== 'Retained original' || seen.has(key)) throw new ArchiveFault('ARCHIVE_MISMATCH');
      seen.add(key);
    }
    return evidence;
  } catch {
    throw new ArchiveFault('ARCHIVE_MISMATCH');
  }
}

export async function verifyEvidence(evidence: Evidence[], read: (item: Evidence) => Promise<Response>) {
  let retainedBytes = 0;
  for (let start = 0; start < evidence.length; start += 6) {
    const sizes = await Promise.all(evidence.slice(start, start + 6).map(async (item) => {
      const response = await read(item);
      if (!response.ok) throw new ArchiveFault('EVIDENCE_MISSING');
      const bytes = await readBounded(response.body, item.bytes, 'EVIDENCE_MISMATCH');
      if (bytes.length !== item.bytes || await sha256(bytes) !== item.sha256)
        throw new ArchiveFault('EVIDENCE_MISMATCH');
      return bytes.length;
    }));
    retainedBytes += sizes.reduce((sum, size) => sum + size, 0);
  }
  return retainedBytes;
}
