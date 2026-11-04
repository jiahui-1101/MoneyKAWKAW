import type { Store } from '../domain/models';
import { requireRole } from '../domain/session';
export function configureTreasurer(current: Store, activityId: string, enabled: boolean): Store {
  requireRole('Director');
  const store = structuredClone(current);
  if (!store.treasury || !store.activities.some(a=>a.id===activityId)) throw new Error('Activity not found.');
  store.treasury.grants = store.treasury.grants.filter(g=>g.activityId!==activityId || g.userId!=='treasurer-nora');
  if (enabled) store.treasury.grants.push({activityId,userId:'treasurer-nora'});
  store.events.unshift({id:crypto.randomUUID(),activityId,action:'Treasurer access configured',detail:`Nora Lim · ${enabled?'granted':'removed'} activity oversight`,actor:'Director · demo',at:new Date().toISOString()});
  return store;
}
