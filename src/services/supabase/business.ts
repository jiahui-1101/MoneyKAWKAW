import type { ActivityInput, PurchasingStatus } from '../../domain/models';
import type { TaskInput } from '../../domain/hod';
import type { Database } from './database.types';
import { supabaseClient } from './client';

type PurchaseStatus = Database['public']['Enums']['purchase_task_status'];
type RpcError = { code?: string; message: string };

function result<T>(data: T | null, error: RpcError | null, fallback: string): T {
  if (error) {
    const expected = ['22023', '23503', '23505', '23514', '40001', '42501', 'P0002'];
    throw new Error(error.code && expected.includes(error.code) ? error.message : fallback);
  }
  if (data === null) throw new Error(fallback);
  return data;
}

// The generated PostgREST contract represents SQL-nullable arguments as required strings.
const nullableRpcArg = <T>(value: T | null): T => value as T;

export async function saveActivity(id: string | undefined, input: ActivityInput) {
  const { data, error } = await supabaseClient().rpc('save_activity', {
    p_id: nullableRpcArg(id ?? null),
    p_name: input.name,
    p_description: input.description,
    p_type: input.type,
    p_status: input.status,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_budget_sen: input.budget,
  });
  return result(data, error, 'The activity could not be saved. Check your connection and retry.');
}

export interface DepartmentSetupInput {
  activityId: string;
  departmentId?: string;
  name: string;
  description: string;
  head: string;
  allocation: number;
  hodUserId?: string;
  memberUserIds: string[];
}

export async function saveDepartmentSetup(input: DepartmentSetupInput) {
  const { data, error } = await supabaseClient().rpc('save_department_setup', {
    p_activity_id: input.activityId,
    p_department_id: nullableRpcArg(input.departmentId ?? null),
    p_name: input.name,
    p_description: input.description,
    p_head_label: input.head,
    p_allocation_sen: input.allocation,
    p_hod_user_id: nullableRpcArg(input.hodUserId ?? null),
    p_member_user_ids: input.memberUserIds,
  });
  return result(data, error, 'The department could not be saved. Check your connection and retry.');
}

export async function savePurchaseTask(
  activityId: string,
  departmentId: string,
  input: TaskInput,
  requestKey: string,
  id?: string,
  expected?: string,
) {
  if (!input.assigneeId) throw new Error('Assign this task to an eligible department Member.');
  const { data, error } = await supabaseClient().rpc('save_purchase_task', {
    p_id: nullableRpcArg(id ?? null),
    p_request_key: nullableRpcArg(id ? null : requestKey),
    p_activity_id: activityId,
    p_department_id: departmentId,
    p_item_name: input.name,
    p_description: input.description,
    p_assigned_member_id: input.assigneeId,
    p_estimated_budget_sen: input.budget,
    p_due_date: input.dueDate,
    p_priority: input.priority,
    p_expected_updated_at: nullableRpcArg(expected ?? null),
  });
  return result(data, error, 'The purchasing task could not be saved. Check your connection and retry.');
}

function databaseStatus(status: PurchasingStatus): PurchaseStatus {
  if (status === 'Not Started' || status === 'In Progress' || status === 'Purchased' ||
      status === 'Completed' || status === 'Cancelled') return status;
  throw new Error('Claim status is not available in the purchasing workflow.');
}

export async function setHodPurchaseStatus(taskId: string, status: PurchasingStatus, expected?: string) {
  const { data, error } = await supabaseClient().rpc('update_hod_purchase_task_status', {
    p_task_id: taskId,
    p_status: databaseStatus(status),
    p_expected_updated_at: nullableRpcArg(expected ?? null),
  });
  return result(data, error, 'The purchasing status could not be updated. Reload and retry.');
}

export async function setMemberPurchaseProgress(taskId: string, status: PurchasingStatus, expected: string) {
  const { data, error } = await supabaseClient().rpc('update_my_purchase_progress', {
    p_task_id: taskId,
    p_status: databaseStatus(status),
    p_expected_updated_at: expected,
  });
  return result(data, error, 'Your purchasing progress could not be updated. Reload and retry.');
}
