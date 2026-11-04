import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { MemberSnapshot } from '../domain/member';
import { memberService } from '../services/member';
import { MemberContext } from './member-context';
import { FormatSettingsContext } from './format-context';
export function MemberProvider({children}:{children:ReactNode}) {
  const [data,setData]=useState<MemberSnapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');const locked=useRef(false);
  const reload=useCallback(async()=>{
    setLoading(true);setError('');
    try{setData(await memberService.load());}catch(e){setData(null);setError(e instanceof Error?e.message:'Unable to load your Member workspace.');}finally{setLoading(false);}
  },[]);
  useEffect(()=>{void reload();},[reload]);
  useEffect(()=>{const sync=(e:StorageEvent)=>{if(e.key?.startsWith('moneykawkaw.'))void reload();};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[reload]);
  useEffect(()=>{if(notice){const id=setTimeout(()=>setNotice(''),5500);return()=>clearTimeout(id);}},[notice]);
  const run=async<T,>(operation:()=>Promise<{data:MemberSnapshot;result:T}>,message:string)=>{
    if(locked.current)throw new Error('A change is being saved. Please wait.');locked.current=true;setBusy(true);
    try{const result=await operation();setData(result.data);setNotice(message);return result.result;}finally{locked.current=false;setBusy(false);}
  };
  return <MemberContext.Provider value={{data,loading,error,busy,notice,reload,run,dismiss:()=>setNotice('')}}><FormatSettingsContext.Provider value={data?.settings??null}>{children}</FormatSettingsContext.Provider></MemberContext.Provider>;
}
