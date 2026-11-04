import { createContext, useContext } from 'react';
import type { MemberSnapshot } from '../domain/member';
interface MemberValue {
  data:MemberSnapshot|null;loading:boolean;error:string;busy:boolean;notice:string;
  reload:()=>Promise<void>;dismiss:()=>void;
  run:<T>(operation:()=>Promise<{data:MemberSnapshot;result:T}>,message:string)=>Promise<T>;
}
export const MemberContext=createContext<MemberValue|null>(null);
export function useMember(){const value=useContext(MemberContext);if(!value)throw new Error('MemberProvider is required.');return value;}
