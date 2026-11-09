import unittest
from labels import LABELS, cord_label, normalize
from prepare import assign_splits, sroie_rows, cord_rows
import json

class DataIntegrity(unittest.TestCase):
    def test_public_annotation_mapping(self):
        self.assertEqual(cord_label(['sub_total.tax_price']), 'TAX')
        self.assertEqual(cord_label(['menu.price', 'menu.nm']), 'ITEM_DESCRIPTION')
        self.assertEqual(cord_label(['total.cashprice']), 'PAYMENT_INFORMATION')
        self.assertEqual(normalize(None), '')

    def test_sroie_unannotated_items_are_not_negative_labels(self):
        data = {'words': ['HDMI cable', 'TOTAL 10.00'], 'bboxes': [[0,0,50,10],[0,20,50,30]],
                'entities': {'company': None, 'date': None, 'total': '10.00'}}
        rows = sroie_rows(data)
        self.assertIsNone(rows[0]['label'])
        self.assertEqual(rows[1]['label'], 'GRAND_TOTAL')

    def test_equal_amount_is_not_a_total_annotation(self):
        data = {'words': ['Cable 10.00'], 'bboxes': [[0,0,50,10]],
                'entities': {'company': '', 'date': '', 'total': '10.00'}}
        self.assertIsNone(sroie_rows(data)[0]['label'])

    def test_same_visual_row_merges_total_label_and_amount(self):
        data={'words':['TOTAL','125.00','Cable 125.00'], 'bboxes':[[0,0,40,10],[80,1,130,11],[0,30,130,40]],
              'entities':{'company':'','date':'','total':'125.00'}}
        rows=sroie_rows(data)
        self.assertEqual(rows[0],{'text':'TOTAL 125.00','label':'GRAND_TOTAL'})
        self.assertIsNone(rows[1]['label'])

    def test_duplicate_variants_stay_together(self):
        docs = [{'id': str(i), 'source': 'synthetic', 'family': 'layout-A',
                 'rows': [{'text': f'Cable {i}.00', 'label': 'ITEM_DESCRIPTION'}]} for i in range(12)]
        result = assign_splits(docs)
        self.assertEqual(len({d['split'] for d in result}), 1)
        self.assertEqual(assign_splits(json.loads(json.dumps(docs))), result)

    def test_actual_prepared_split_and_classes(self):
        from sources import ROOT
        docs = json.loads((ROOT/'prepared.json').read_text(encoding='utf8'))
        groups = {}
        for doc in docs:
            self.assertEqual(groups.setdefault(doc['group'], doc['split']), doc['split'])
            for row in doc['rows']:
                self.assertTrue(row['label'] is None or row['label'] in LABELS)
        self.assertEqual({d['split'] for d in docs}, {'train', 'validation', 'test'})
        self.assertEqual(len({d['id'] for d in docs}), len(docs))

if __name__ == '__main__':
    unittest.main()
