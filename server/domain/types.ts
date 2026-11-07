import type { Role, ContractStatus } from '../../src/shared/contracts.js';

export type UserActor = {
  kind: 'user';
  userId: string;
  email: string;
  role: Role;
};

export type ServiceActor = {
  kind: 'service';
  service: 'vtp' | 'sla' | 'import';
  eventId: string;
};

export type Actor = UserActor | ServiceActor;
export type Clock = () => Date;

export type MutationContext = {
  actor: Actor;
  requestId: string;
  idempotencyKey: string;
};

export type WorkflowAction =
  | 'submit_draft'
  | 'feedback_draft'
  | 'approve_soft_copy'
  | 'print'
  | 'sign'
  | 'assign_waybill'
  | 'confirm_pickup'
  | 'confirm_delivery'
  | 'upload_scan'
  | 'archive'
  | 'reject'
  | 'report_issue'
  | 'redraft'
  | 'reship'
  | 'cancel';

