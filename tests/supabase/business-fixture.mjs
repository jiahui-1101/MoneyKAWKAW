import { admin } from './helpers.mjs';

export async function loadWorkflow() {
  const activity = await admin.from('activities').select('id').eq('name', 'Annual Dinner').single();
  if (activity.error) throw activity.error;
  const departments = await admin.from('departments').select('id,name').eq('activity_id', activity.data.id);
  if (departments.error) throw departments.error;
  return {
    activityId: activity.data.id,
    multimediaId: departments.data.find((department) => department.name === 'Multimedia')?.id,
    marketingId: departments.data.find((department) => department.name === 'Marketing')?.id,
  };
}
