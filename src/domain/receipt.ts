import type { ReceiptEvidence, ReceiptLine } from './treasury';
export const maxMoney=100_000_000_000;
export const lineValue=(line:ReceiptLine)=>line.kind==='discount'?-line.amount:line.amount;
export function quantityAmount(unitPrice:number,quantityMilli:number) {
  if(!Number.isSafeInteger(unitPrice)||unitPrice<0||unitPrice>maxMoney || !Number.isSafeInteger(quantityMilli)||quantityMilli<=0||quantityMilli>1_000_000)
    throw new Error('Use a non-negative unit price and quantity between 0.001 and 1,000.');
  const value=Number((BigInt(unitPrice)*BigInt(quantityMilli)+500n)/1000n);
  if(value>maxMoney)throw new Error('Line amount exceeds the supported limit.');
  return value;
}
export function parseQuantity(value:string) {
  if(!/^\d+(\.\d{1,3})?$/.test(value.trim()))throw new Error('Quantity supports up to three decimal places.');
  const [whole,fraction='']=value.trim().split('.');
  const quantity=Number(whole)*1000+Number(fraction.padEnd(3,'0'));
  quantityAmount(0,quantity);return quantity;
}
export function validateLine(line:ReceiptLine) {
  if(!line.id||typeof line.description!=='string'||!line.description.trim()||line.description.length>180 ||
    !Number.isSafeInteger(line.amount)||line.amount<0||line.amount>maxMoney ||
    (line.kind&&!['item','tax','discount'].includes(line.kind)))throw new Error('Add a valid receipt description and non-negative amount.');
  if(line.quantityMilli!==undefined||line.unitPrice!==undefined)
    if(line.quantityMilli===undefined||line.unitPrice===undefined||quantityAmount(line.unitPrice,line.quantityMilli)!==line.amount)
      throw new Error('Line total must match quantity × unit price, rounded to the nearest minor unit.');
}
export function receiptLines(receipt:ReceiptEvidence) {
  return [...receipt.originalLines,...(receipt.addedLines??[])].map(original=>{
    const latest=receipt.edits.filter(e=>e.lineId===original.id).at(-1);
    return {original,final:latest?.after??original,excluded:latest?.excluded??false,edited:!!latest};
  });
}
export function receiptTotal(receipt:ReceiptEvidence,includedOnly=true) {
  return receiptLines(receipt).filter(l=>!includedOnly||!l.excluded).reduce((sum,l)=>sum+lineValue(l.final),0);
}
export const reviewedTotal=(receipt:ReceiptEvidence)=>receipt.totalEdits?.at(-1)?.after??receipt.originalTotal??receipt.originalLines.reduce((sum,l)=>sum+lineValue(l),0);
export function validateClaimReceipt(receipt:ReceiptEvidence) {
  const lines=receiptLines(receipt),total=receiptTotal(receipt);
  if(!lines.length||lines.length>100||!Number.isSafeInteger(total)||total<=0||total>maxMoney)
    throw new Error('Include at least one valid item. The final claim amount must be positive.');
  for(const line of lines)validateLine(line.final);
  if(receipt.extraction && receiptTotal(receipt,false)!==reviewedTotal(receipt))
    throw new Error('All final lines, including excluded items and charges, must reconcile to the reviewed receipt total.');
  if(receipt.extraction && total>reviewedTotal(receipt))throw new Error('The claim cannot exceed the reviewed receipt total.');
  return total;
}
