import type { AccountInput } from './member';
export const accountKinds=[{value:'Bank',label:'Bank account'},{value:'TNG',label:'Touch ’n Go eWallet'}] as const;
export function validateAccount(input:AccountInput) {
  if(!input||![input.label,input.holder,input.institution,input.identifier].every(v=>typeof v==='string')||typeof input.isDefault!=='boolean'||
    !['Bank','TNG'].includes(input.kind)||!input.label.trim()||input.label.length>80||!input.holder.trim()||input.holder.length>100 ||
    (input.kind==='Bank'&&(!input.institution.trim()||input.institution.length>80)))throw new Error('Add a label, account holder, and the institution required by this account type.');
  const valid=input.kind==='Bank'?/^[A-Za-z0-9 -]{6,34}$/.test(input.identifier):/^\+?\d{8,15}$/.test(input.identifier.replace(/[ -]/g,''));
  if(!valid)throw new Error(input.kind==='Bank'?'Use a 6–34 character account identifier (letters, digits, spaces, or hyphens).':'Use the registered phone identifier, 8–15 digits with optional +.');
}
