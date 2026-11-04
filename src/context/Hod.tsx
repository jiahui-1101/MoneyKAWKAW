import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { HodSnapshot } from '../domain/hod';
import { hodService } from '../services/hod';
import { HodContext } from './hod-context';
import { FormatSettingsContext } from './format-context';
import { useSession } from './session-context';
export function HodProvider({ children }: { children: ReactNode }) {
  const { actor } = useSession();
  const [data, setData] = useState<HodSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const locked = useRef(false);
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await hodService.load());
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Unable to load department workspace.');
    } finally {
      setLoading(false);
    }
  }, [actor.userId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key?.startsWith('moneykawkaw.')) void reload();
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [reload]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(''), 5500);
    return () => clearTimeout(id);
  }, [notice]);
  const run = async (
    operation: () => Promise<{ data: HodSnapshot; taskId?: string }>,
    message: string,
  ) => {
    if (locked.current) throw new Error('A change is being saved. Please try again.');
    locked.current = true;
    setBusy(true);
    try {
      const result = await operation();
      setData(result.data);
      setNotice(message);
      return result.taskId;
    } catch (e) {
      throw e;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return (
    <HodContext.Provider
      value={{ data, loading, error, busy, notice, reload, run, dismiss: () => setNotice('') }}
    >
      <FormatSettingsContext.Provider value={data?.settings ?? null}>
        {children}
      </FormatSettingsContext.Provider>
    </HodContext.Provider>
  );
}
