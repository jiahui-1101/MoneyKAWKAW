"""Synthetic integer-sen ledger; mirrors the effective exposure state machine."""
from dataclasses import dataclass


@dataclass
class Task:
    estimate: int
    amount: int = 0
    status: str = 'unclaimed'


def balances(tasks, allocation):
    result = {k: 0 for k in ('unclaimed_sen', 'pending_sen', 'liability_sen', 'paid_sen',
                             'unclaimed_count', 'pending_count')}
    for t in tasks:
        assert t.estimate > 0 and t.amount >= 0
        group = 'unclaimed' if t.status in ('unclaimed', 'rejected') else t.status
        result[f'{group}_sen'] += t.estimate if group == 'unclaimed' else t.amount
        if group in ('unclaimed', 'pending'):
            result[f'{group}_count'] += 1
    result['available_sen'] = allocation - sum(result[k] for k in (
        'unclaimed_sen', 'pending_sen', 'liability_sen', 'paid_sen'))
    return result


def demand(tasks, allocation, amount):
    if amount > balances(tasks, allocation)['available_sen']:
        return False
    tasks.append(Task(amount))
    return True


def advance(task, tasks, allocation, rng, variance):
    """Returns True only when an attempted approval is blocked by budget."""
    if task.status in ('unclaimed', 'rejected'):
        task.amount = max(1, round(task.estimate * rng.lognormal(-variance**2 / 2, variance)))
        task.status = 'pending'
    elif task.status == 'pending':
        if rng.random() < .12:  # ordinary independent review rejection
            task.status = 'rejected'
        elif balances(tasks, allocation)['available_sen'] < 0:
            return True
        else:
            task.status = 'liability'
    elif task.status == 'liability':
        task.status = 'paid'
    return False
