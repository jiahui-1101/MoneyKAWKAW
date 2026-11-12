import { ArchiveFault } from '../_shared/archive-format.ts';

export class RequestFault extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

interface ArchiveConfig {
  url: string;
  anonKey: string;
  serviceKey: string;
}

export interface ArchiveMaterial {
  id: string;
  activity_id: string;
  archive_state: 'Staging' | 'Finalized';
  source_revision: number;
  source_text: string | null;
  logical_bytes: number;
  logical_sha256: string;
  compressed_bytes: number | null;
  compressed_sha256: string | null;
  object_path: string;
  failure_code: string | null;
}

export function archiveBackend(config: ArchiveConfig, authorization: string) {
  const userHeaders = { apikey: config.anonKey, Authorization: authorization };
  const serverHeaders = { apikey: config.serviceKey, Authorization: 'Bearer ' + config.serviceKey };
  const jsonHeaders = { 'Content-Type': 'application/json' };
  const objectPath = (bucket: string, path: string) =>
    encodeURIComponent(bucket) + '/' + path.split('/').map(encodeURIComponent).join('/');

  async function rpc<T>(name: string, args: Record<string, unknown>, server = false): Promise<T> {
    const response = await fetch(config.url + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { ...jsonHeaders, ...(server ? serverHeaders : userHeaders) },
      body: JSON.stringify(args),
    });
    if (!response.ok) {
      if (server) throw new ArchiveFault('FINALIZATION_FAILED');
      if (response.status === 401 || response.status === 403)
        throw new RequestFault(403, 'Your current role cannot access this archive operation.');
      throw new RequestFault(409, 'Refresh the activity and confirm its approval and evidence before archiving.');
    }
    return (response.status === 204 ? null : await response.json()) as T;
  }

  return {
    async identity() {
      const response = await fetch(config.url + '/auth/v1/user', { headers: userHeaders });
      if (!response.ok) throw new RequestFault(401, 'Sign in again to access archive operations.');
      const user = await response.json();
      return user.id as string;
    },
    rpc,
    read(bucket: string, path: string) {
      return fetch(config.url + '/storage/v1/object/authenticated/' + objectPath(bucket, path), {
        headers: serverHeaders,
      });
    },
    async upload(path: string, bytes: Uint8Array<ArrayBuffer>) {
      const response = await fetch(config.url + '/storage/v1/object/' + objectPath('financial-archive', path), {
        method: 'POST',
        headers: { ...serverHeaders, 'Content-Type': 'application/gzip', 'x-upsert': 'false' },
        body: bytes,
      });
      await response.body?.cancel();
      return response.ok;
    },
  };
}
export type ArchiveBackend = ReturnType<typeof archiveBackend>;
