import type { ContractStatus } from '../../../src/shared/contracts.js';
import type { WorkflowAction } from '../../domain/types.js';

export type ContractMilestoneField =
  | 'soft_approved_at'
  | 'printed_at'
  | 'signed_at'
  | 'waybill_created_at'
  | 'picked_up_at'
  | 'delivered_at'
  | 'received_back_at'
  | 'archived_at';

export function getMilestoneForAction(
  action: WorkflowAction,
  now: Date
): Partial<Record<ContractMilestoneField, Date>> {
  switch (action) {
    case 'approve_soft_copy':
      return { soft_approved_at: now };
    case 'print':
      return { printed_at: now };
    case 'sign':
      return { signed_at: now };
    case 'assign_waybill':
      return { waybill_created_at: now };
    case 'confirm_pickup':
      return { picked_up_at: now };
    case 'confirm_delivery':
      return { delivered_at: now, received_back_at: now };
    case 'archive':
      return { archived_at: now };
    default:
      return {};
  }
}

