import { createContext, useContext } from 'react';
import type { HodSnapshot } from '../domain/hod';
interface HodValue {
  data: HodSnapshot | null;
  loading: boolean;
  error: string;
  busy: boolean;
  notice: string;
  reload: () => Promise<void>;
  dismiss: () => void;
  run: (
    operation: () => Promise<{ data: HodSnapshot; taskId?: string }>,
    message: string,
  ) => Promise<string | undefined>;
}
export const HodContext = createContext<HodValue | null>(null);
export function useHod() {
  const value = useContext(HodContext);
  if (!value) throw new Error('HodProvider is required.');
  return value;
}
