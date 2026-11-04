import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Store } from '../domain/models';
import { treasuryService } from '../services/treasury';
import { TreasuryContext } from './treasury-context';
import { FormatSettingsContext } from './format-context';
export function TreasuryProvider({children}:{children:ReactNode}) {
  const [data,setData]=useState<Store|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const locked=useRef(false);
  const reload=useCallback(async()=> {
    setLoading(true);setError('');
    try {setData(await treasuryService.load());}
    catch(e){setData(null);setError(e instanceof Error?e.message:'Unable to load financial workspace.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void reload();},[reload]);
  useEffect(()=>{
    const sync=(e:StorageEvent)=>{if(e.key?.startsWith('moneykawkaw.'))void reload();};
    window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
  },[reload]);
  useEffect(()=>{if(notice){const id=setTimeout(()=>setNotice(''),5500);return()=>clearTimeout(id);}},[notice]);
  const run=async(operation:()=>Promise<Store>,message:string)=>{
    if(locked.current)throw new Error('A change is being saved. Please wait.');
    locked.current=true;setBusy(true);
    try{setData(await operation());setNotice(message);}
    finally{locked.current=false;setBusy(false);}
  };
  return <TreasuryContext.Provider value={{data,loading,error,busy,notice,reload,run,dismiss:()=>setNotice('')}}>
    <FormatSettingsContext.Provider value={data?.settings??null}>{children}</FormatSettingsContext.Provider>
  </TreasuryContext.Provider>;
}
