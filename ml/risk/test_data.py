import copy
import unittest
import numpy as np
from ledger import Task, balances, demand, advance
from simulate import generate
from validate import validate


class DataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = generate(per_family=2)

    def test_reproducibility(self):
        self.assertEqual(self.data, generate(per_family=2))
        validate(self.data)

    def test_group_leakage(self):
        data = copy.deepcopy(self.data)
        data['rows'][1]['split'] = 'test'
        with self.assertRaises(AssertionError):
            validate(data)

    def test_forbidden_or_future_source(self):
        for mutation in (lambda r: r['raw'].update(bank_identifier=1),
                         lambda r: r.update(feature_day=r['prediction_day'] + 1),
                         lambda r: r['features'].__setitem__(0, r['label']),
                         lambda r: r['raw'].update(paid_sen=-1)):
            data = copy.deepcopy(self.data)
            mutation(data['rows'][0])
            with self.assertRaises((AssertionError, ValueError)):
                validate(data)

    def test_duplicate_and_label_leakage(self):
        data = copy.deepcopy(self.data)
        data['rows'].append(data['rows'][0])
        with self.assertRaises(AssertionError):
            validate(data)
        data = copy.deepcopy(self.data)
        data['rows'][0]['label'] ^= 1
        with self.assertRaises(AssertionError):
            validate(data)

    def test_exposure_replaces_estimate(self):
        tasks = [Task(8000, 11000, 'pending')]
        self.assertEqual(balances(tasks, 200000)['available_sen'], 189000)
        tasks[0].status = 'liability'
        self.assertEqual(balances(tasks, 200000)['available_sen'], 189000)
        tasks[0].status = 'paid'
        self.assertEqual(balances(tasks, 200000)['paid_sen'], 11000)
        self.assertFalse(demand(tasks, 200000, 200000))

    def test_hard_approval_block(self):
        tasks = [Task(8000, 11000, 'pending')]
        rng = np.random.default_rng(5)  # no rejection on this draw
        self.assertTrue(advance(tasks[0], tasks, 10000, rng, .2))
        self.assertEqual(tasks[0].status, 'pending')


if __name__ == '__main__':
    unittest.main()
