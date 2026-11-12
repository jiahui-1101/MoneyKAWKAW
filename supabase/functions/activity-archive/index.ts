import { ArchiveFault, readBounded, uuidPattern } from '../_shared/archive-format.ts';
import { archiveBackend, RequestFault, type ArchiveMaterial } from './transport.ts';
import { verifyArchive } from './verify.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Expose-Headers': 'Content-Disposition',
  'Cache-Control': 'no-store',
};
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ message: 'Use POST for archive operations.' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ message: 'Sign in to continue.' }, 401);
  const config = {
    url: Deno.env.get('SUPABASE_URL') ?? '',
    anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  };
  if (!config.url || !config.anonKey || !config.serviceKey)
    return json({ message: 'Archive service is unavailable.' }, 503);
  const backend = archiveBackend(config, authorization);
  const started = performance.now();
  let archiveId: string | undefined;
  let actor: string | undefined;
  let operation: string | undefined;
  let role: string | undefined;
  try {
    actor = await backend.identity();
    if (!uuidPattern.test(actor)) throw new RequestFault(401, 'Sign in to continue.');
    let input;
    try {
      input = JSON.parse(new TextDecoder().decode(await readBounded(request.body, 2048, 'BAD_REQUEST')));
    } catch {
      throw new RequestFault(400, 'Choose a supported activity archive operation.');
    }
    const activity = input?.activity;
    role = input?.role;
    operation = input?.operation;
    if (typeof activity !== 'string' || !uuidPattern.test(activity) ||
      (role !== 'Director' && role !== 'Treasurer') ||
      (operation !== 'generate' && operation !== 'verify' && operation !== 'download'))
      throw new RequestFault(400, 'Choose a supported activity archive operation.');
    if (operation === 'generate' && role !== 'Director')
      throw new RequestFault(403, 'Director access is required to generate an archive.');
    archiveId = operation === 'generate'
      ? await backend.rpc<string>('reserve_activity_archive', { p_activity: activity })
      : await backend.rpc<string>('authorize_activity_archive', {
        p_activity: activity, p_role: role, p_download: operation === 'download',
      });
    const material = await backend.rpc<ArchiveMaterial>('activity_archive_material', { p_archive: archiveId }, true);
    if (!material || material.activity_id !== activity) throw new ArchiveFault('FINALIZATION_FAILED');

    const create = operation === 'generate' && material.archive_state === 'Staging';
    if (create && material.failure_code === 'ARCHIVE_MISMATCH') {
      material.object_path = await backend.rpc<string>('replace_corrupt_archive_stage', {
        p_archive: archiveId, p_actor: actor, p_expected_path: material.object_path,
      }, true);
    }
    const verified = await verifyArchive(backend, material, create);
    if (create) {
      await backend.rpc('finalize_activity_archive', {
        p_archive: archiveId, p_actor: actor, p_revision: material.source_revision,
        p_logical_sha: material.logical_sha256, p_compressed_sha: verified.compressedHash,
        p_compressed_bytes: verified.compressed.length, p_evidence_count: verified.evidenceCount,
        p_evidence_bytes: verified.evidenceBytes,
      }, true);
    } else {
      await backend.rpc('record_activity_archive_check', {
        p_archive: archiveId, p_actor: actor, p_role: role, p_operation: operation,
        p_failure: null, p_compressed_sha: verified.compressedHash,
      }, true);
    }
    if (operation === 'download') return new Response(verified.compressed, {
      headers: { ...headers, 'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="activity-' + activity + '.json.gz"' },
    });
    return json({ id: archiveId, verification: 'Verified', logicalBytes: material.logical_bytes,
      compressedBytes: verified.compressed.length, logicalSha256: material.logical_sha256,
      compressedSha256: verified.compressedHash, evidenceCount: verified.evidenceCount,
      evidenceBytes: verified.evidenceBytes, storageReads: verified.reads, storageWrites: verified.writes,
      milliseconds: Math.round(performance.now() - started) });
  } catch (error) {
    if (error instanceof RequestFault) return json({ message: error.message }, error.status);
    const code = error instanceof ArchiveFault ? error.code : 'FINALIZATION_FAILED';
    if (archiveId && actor && role && operation) {
      try {
        await backend.rpc('record_activity_archive_check', { p_archive: archiveId, p_actor: actor,
          p_role: role, p_operation: operation, p_failure: code, p_compressed_sha: null }, true);
      } catch {
        // Staging and the frozen activity survive a database or authorization outage.
      }
    }
    return json({ code, message: 'Archive verification could not finish. Review the integrity result before retrying.' }, 409);
  }
});
