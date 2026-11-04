import type { AccountInput, PaymentAccount } from '../domain/member';
import type { Store } from '../domain/models';
import { requireRole } from '../domain/session';
import { memberCommand, memberData, memberRead } from './member-core';
import { accountInUse, validateAccount } from '../domain/accounts';
const owned = (store: Store, id: string) => {
  const account = store.member?.accounts.find(
    (a) => a.id === id && a.ownerId === requireRole('Member').userId,
  );
  if (!account) throw new Error('Payment account unavailable for your profile.');
  return account;
};
function audit(store: Store, account: PaymentAccount, action: string, detail: string) {
  const data = memberData(store);
  data.accountHistory ??= [];
  data.accountHistory.unshift({
    id: crypto.randomUUID(),
    ownerId: account.ownerId,
    accountId: account.id,
    action,
    detail,
    at: new Date().toISOString(),
  });
}
export const accountService = {
  async detail(id: string) {
    const { store } = await memberRead();
    return structuredClone(owned(store, id));
  },
  save(input: AccountInput, id?: string, expected?: string) {
    return memberCommand((store) => {
      validateAccount(input);
      const userId = requireRole('Member').userId,
        data = memberData(store);
      const existing = id ? owned(store, id) : undefined;
      if (existing && existing.updatedAt !== expected)
        throw new Error('This account changed. Reload before editing.');
      const identifier = input.identifier.trim(),
        before = existing ? `${existing.label} · ${existing.masked}` : 'None';
      const account: PaymentAccount = {
        id: id ?? crypto.randomUUID(),
        ownerId: userId,
        label: input.label.trim(),
        kind: input.kind,
        holder: input.holder.trim(),
        institution: input.kind === 'TNG' ? 'Touch ’n Go eWallet' : input.institution.trim(),
        identifier,
        masked: `${input.kind === 'Bank' ? 'Bank' : 'TNG'} •••• ${identifier.slice(-4)}`,
        isDefault:
          !!existing?.isDefault ||
          input.isDefault ||
          !data.accounts.some((a) => a.ownerId === userId),
        updatedAt: new Date().toISOString(),
      };
      if (account.isDefault)
        for (const a of data.accounts.filter((a) => a.ownerId === userId)) a.isDefault = false;
      if (existing) Object.assign(existing, account);
      else data.accounts.push(account);
      audit(
        store,
        account,
        existing ? 'Account updated' : 'Account added',
        `${before} → ${account.label} · ${account.masked}. Submitted claim snapshots are unchanged.`,
      );
      return account.id;
    });
  },
  setDefault(id: string) {
    return memberCommand((store) => {
      const account = owned(store, id),
        at = new Date().toISOString();
      for (const a of memberData(store).accounts.filter((a) => a.ownerId === account.ownerId)) {
        a.isDefault = a.id === id;
        a.updatedAt = at;
      }
      audit(
        store,
        account,
        'Default account changed',
        `${account.label} · ${account.masked}. Existing claim destinations are unchanged.`,
      );
    });
  },
  remove(id: string) {
    return memberCommand((store) => {
      const account = owned(store, id),
        data = memberData(store);
      if (accountInUse(store, id))
        throw new Error(
          'This account is referenced by a claim or active draft. Keep it for the audit trail.',
        );
      data.accounts = data.accounts.filter((a) => a.id !== id);
      if (account.isDefault) {
        const next = data.accounts.find((a) => a.ownerId === account.ownerId);
        if (next) {
          next.isDefault = true;
          next.updatedAt = new Date().toISOString();
        }
      }
      audit(store, account, 'Unused account removed', `${account.label} · ${account.masked}`);
    });
  },
};
