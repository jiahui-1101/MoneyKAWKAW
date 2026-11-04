import { useCallback, useEffect, useState } from 'react';
import type { ClaimDraft, MemberSnapshot } from '../../domain/member';
import { useMember } from '../../context/member-context';
import { draftService } from '../../services/member-drafts';
export type DraftChange=(operation:()=>Promise<{data:MemberSnapshot;result:unknown}>,message:string)=>Promise<void>;
export function useMemberDraft(id:string) {
  const {run,busy}=useMember();const [draft,setDraft]=useState<ClaimDraft|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refreshing,setRefreshing]=useState(false);
  const reload=useCallback(async()=>{setLoading(true);setError('');try{setDraft(await draftService.load(id));}catch(e){setDraft(null);setError(e instanceof Error?e.message:'Unable to load claim draft.');}finally{setLoading(false);}},[id]);
  useEffect(()=>{void reload();},[reload]);
  const change:DraftChange=async(operation,message)=>{
    setRefreshing(true);
    try{await run(operation,message);setDraft(await draftService.load(id));}finally{setRefreshing(false);}
  };
  return {draft,loading,error,reload,change,saving:busy||refreshing};
}
