import type { Store } from '../domain/models';
import type { ReceiptEvidence } from '../domain/treasury';
const xml = (s: string) => s.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
export function sampleEvidence(expenseId: string, description: string, amount: number, at: string): ReceiptEvidence {
  const original = [{id:'item',description,amount:amount+1000},{id:'personal',description:'Personal refreshment (excluded)',amount:800}];
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="520" height="420"><rect width="520" height="420" fill="#fff"/><g fill="#202626" font-family="monospace" font-size="16"><text x="32" y="42">FICTIONAL RECEIPT · SAMPLE ONLY</text><text x="32" y="80">Campus Supplies · ${xml(expenseId)}</text><text x="32" y="125">${xml(description.slice(0,43))}</text><text x="32" y="160">Original item: ${(original[0].amount/100).toFixed(2)}</text><text x="32" y="200">Personal refreshment: 8.00</text><text x="32" y="250">Original total: ${((amount+1800)/100).toFixed(2)}</text><text x="32" y="305">Demo evidence, not an actual invoice.</text></g></svg>`;
  return { id:`receipt-${expenseId}`,expenseId,merchant:'Campus Supplies · fictional',originalUrl:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,originalLines:original,submittedAt:at,
    edits:[{lineId:'item',before:structuredClone(original[0]),after:{...original[0],amount},excluded:false,reason:'Corrected OCR amount against receipt (fictional example).',actor:'Member · demo fixture',at},
      {lineId:'personal',before:structuredClone(original[1]),after:structuredClone(original[1]),excluded:true,reason:'Personal item is not claimable.',actor:'Member · demo fixture',at}] };
}
export function upgradeTreasury(source: Store): Store {
  if (source.treasury) return source;
  const store=structuredClone(source);
  store.treasury={grants:store.activities.filter(a=>['innovation-summit','design-workshop','community-day','annual-dinner'].includes(a.id)).map(a=>({userId:'treasurer-nora',activityId:a.id})),receipts:[],payouts:[],rules:{mediumVariance:10,highVariance:25,lowHeadroomPercent:20}};
  for(const e of store.expenses){
    const task=store.assignments.find(t=>t.expenseId===e.id);const claimantId=task?.purchasing?.assigneeId??undefined;
    const at=`${e.date}T09:00:00+08:00`;
    e.review??={claimantId,submittedAt:at,updatedAt:at,justification:task&&e.amount>task.budget?'Supplier availability required a higher-cost replacement. Please review the attached evidence.':'Within the planned purchase context.'};
    store.treasury.receipts.push(sampleEvidence(e.id,e.description,e.amount,at));
    // Explicit fictional snapshots belong to demo claims; not real saved banking instructions.
    if(claimantId)store.treasury.payouts.push({expenseId:e.id,ownerId:claimantId,label:'Fictional demo destination · not payable',kind:'Bank',holder:store.directory?.users.find(u=>u.id===claimantId)?.name??'Demo claimant',institution:'Demo bank (not a financial institution)',identifier:`DEMO-NOT-PAYABLE-${e.id}`,masked:`DEMO •••• ${e.id.slice(-1)}`});
  }
  return store;
}
