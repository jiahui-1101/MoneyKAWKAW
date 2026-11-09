"""Reference field extraction, separate from classification and financial correctness."""
import json
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from sources import ROOT

def comparable(value):
    return re.sub(r'\W+', '', value or '').upper()

def date_value(value):
    for pattern in ('%Y-%m-%d','%d/%m/%Y','%d-%m-%Y','%d/%m/%y','%d-%m-%y'):
        try:
            return datetime.strptime(value.strip(),pattern).date().isoformat()
        except ValueError:
            pass
    return None

def main():
    sources={d['id']:d['data'] for d in json.loads((ROOT/'sroie.json').read_text(encoding='utf8'))}
    rows=json.loads((ROOT/'baseline.json').read_text(encoding='utf8'))
    predictions=json.loads((ROOT/'test-predictions.json').read_text(encoding='utf8'))
    results={field:{'supported':0,'baselineExact':0,'hybridExact':0,'modelCandidateCoverage':0} for field in ('company','date','total')}
    for row in rows:
        if row['id'] not in sources:
            continue
        entities=sources[row['id']]['entities']
        for field,label in [('company','MERCHANT'),('date','RECEIPT_DATE'),('total','GRAND_TOTAL')]:
            value=entities[field]
            if not value:
                continue
            expected=comparable(value)
            def actual(output):
                if field=='company': return comparable(output['merchant'])
                if field=='date': return output['purchaseDate'] or None
                return output.get('total')
            if field=='date':
                expected=date_value(value)
            if field=='total':
                try: expected=int(Decimal(value.replace(',','').strip())*100)
                except InvalidOperation: expected=None
            if expected is None:
                continue
            r=results[field];r['supported']+=1
            r['baselineExact']+=actual(row['output'])==expected
            r['hybridExact']+=actual(row['hybridOutput'])==expected
            r['modelCandidateCoverage']+=any(p['label']==label and comparable(value) in comparable(p['text']) for p in predictions[row['id']])
    (ROOT/'field-evaluation.json').write_text(json.dumps(results,indent=2),encoding='utf8')
    print(json.dumps(results))

if __name__=='__main__':
    main()
