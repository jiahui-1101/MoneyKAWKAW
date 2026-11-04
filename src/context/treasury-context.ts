import { createContext, useContext } from 'react';
import type { Store } from '../domain/models';
export interface TreasuryValue {
  data: Store|null; loading: boolean; error: string; busy: boolean; notice: string;
  reload:()=>Promise<void>; dismiss:()=>void;
  run:(operation:()=>Promise<Store>,message:string)=>Promise<void>;
}
export const TreasuryContext=createContext<TreasuryValue|null>(null);
export function useTreasury() {
  const value=useContext(TreasuryContext);
  if(!value) throw new Error('TreasuryProvider is required.');
  return value;
}
