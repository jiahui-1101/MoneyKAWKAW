import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Store } from '../domain/models';
import { directorService } from '../services/director';

interface WorkspaceValue {
  store: Store | null; loading: boolean; error: string; busy: boolean; notice: string;
  reload: () => Promise<void>; reset: () => Promise<void>;
  mutate: (change: (store: Store) => Store, message: string) => Promise<Store>;
  dismiss: () => void;
}
const Context = createContext<WorkspaceValue | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store | null>(null);
  const current = useRef<Store | null>(null);
  const locked = useRef(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { const s = await directorService.load(); current.current = s; setStore(s); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load workspace.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const sync = (e: StorageEvent) => { if (e.key?.startsWith('moneykawkaw.')) void reload(); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [reload]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 5500); return () => clearTimeout(t); }, [notice]);
  const mutate = async (change: (s: Store) => Store, message: string) => {
    if (!current.current || locked.current) throw new Error('Workspace is busy. Please try again.');
    locked.current = true; setBusy(true);
    try {
      const saved = await directorService.save(change(current.current));
      current.current = saved; setStore(saved); setNotice(message); return saved;
    } finally { locked.current = false; setBusy(false); }
  };
  const reset = async () => {
    const s = await directorService.reset(); current.current = s; setStore(s); setError(''); setNotice('Sample workspace restored.');
  };
  return <Context.Provider value={{ store, loading, busy, error, notice, reload, mutate, reset, dismiss: () => setNotice('') }}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('WorkspaceProvider is required.');
  return value;
}
