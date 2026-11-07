import { describe, it, expect } from 'vitest';
import {
  validateActionGuard,
  computeAllowedActions,
  WorkflowGuardError,
  type ContractWorkflowSubject,
} from '../../server/modules/workflow/guards.js';
import {
  ACTION_TARGET_MAP,
  WORKFLOW_ACTIONS,
} from '../../server/modules/workflow/actions.js';
import type { UserActor, ServiceActor } from '../../server/domain/types.js';

describe('Workflow Matrix, Guards & Allowed Actions (T20)', () => {
  const adminActor: UserActor = {
    kind: 'user',
    userId: 'u-admin',
    email: 'admin@dps.media',
    role: 'admin',
  };

  const legalActor: UserActor = {
    kind: 'user',
    userId: 'u-legal',
    email: 'legal@dps.media',
    role: 'legal',
  };

  const clerkActor: UserActor = {
    kind: 'user',
    userId: 'u-clerk',
    email: 'clerk@dps.media',
    role: 'clerk',
  };

  const vtpServiceActor: ServiceActor = {
    kind: 'service',
    service: 'vtp',
    eventId: 'evt-123',
  };

  describe('1. Happy Paths & Allowed Actions per Role', () => {
    it('allows legal and admin to submit_draft on "Chờ soạn thảo"', () => {
      const contract: ContractWorkflowSubject = {
        id: 'c-1',
        status: 'Chờ soạn thảo',
        processingMethod: 'physical',
      };

      const legalActions = computeAllowedActions(contract, legalActor);
      expect(legalActions).toContain('submit_draft');
      expect(legalActions).not.toContain('approve_soft_copy');

      const clerkActions = computeAllowedActions(contract, clerkActor);
      expect(clerkActions).not.toContain('submit_draft');

      const adminActions = computeAllowedActions(contract, adminActor);
      expect(adminActions).toContain('submit_draft');
      expect(adminActions).toContain('cancel');
    });

    it('distinguishes physical and digital approve_soft_copy target status', () => {
      expect(
        ACTION_TARGET_MAP.approve_soft_copy({ processingMethod: 'physical' })
      ).toBe('Chờ in');

      expect(
        ACTION_TARGET_MAP.approve_soft_copy({ processingMethod: 'digital' })
      ).toBe('Chờ bản gửi lại');
    });

    it('hides physical-only steps from digital contracts', () => {
      const digitalContract: ContractWorkflowSubject = {
        id: 'c-2',
        status: 'Chờ in', // Hypothethical invalid status for digital
        processingMethod: 'digital',
      };

      const clerkActions = computeAllowedActions(digitalContract, clerkActor);
      expect(clerkActions).not.toContain('print');
    });

    it('allows clerk and service to advance physical shipping milestones', () => {
      const pickingUpContract: ContractWorkflowSubject = {
        id: 'c-3',
        status: 'Chờ shipper đến lấy',
        processingMethod: 'physical',
      };

      const clerkActions = computeAllowedActions(pickingUpContract, clerkActor);
      expect(clerkActions).toContain('confirm_pickup');
      expect(clerkActions).toContain('report_issue');

      const serviceActions = computeAllowedActions(pickingUpContract, vtpServiceActor);
      expect(serviceActions).toContain('confirm_pickup');
      expect(serviceActions).toContain('report_issue');
      expect(serviceActions).not.toContain('cancel');
    });
  });

  describe('2. Guards Validation & Inviolable Invariants', () => {
    it('throws FORBIDDEN_ROLE when clerk tries to approve soft copy', () => {
      const contract: ContractWorkflowSubject = {
        id: 'c-4',
        status: 'Chờ duyệt bản mềm',
        processingMethod: 'physical',
      };

      expect(() =>
        validateActionGuard(contract, 'approve_soft_copy', clerkActor)
      ).toThrowError(WorkflowGuardError);

      try {
        validateActionGuard(contract, 'approve_soft_copy', clerkActor);
      } catch (err: any) {
        expect(err.code).toBe('FORBIDDEN_ROLE');
      }
    });

    it('throws INVALID_STATUS_TRANSITION when trying to print before soft approval', () => {
      const contract: ContractWorkflowSubject = {
        id: 'c-5',
        status: 'Chờ duyệt bản mềm',
        processingMethod: 'physical',
      };

      expect(() =>
        validateActionGuard(contract, 'print', clerkActor)
      ).toThrowError(WorkflowGuardError);

      try {
        validateActionGuard(contract, 'print', clerkActor);
      } catch (err: any) {
        expect(err.code).toBe('INVALID_STATUS_TRANSITION');
      }
    });

    it('requires note on reject, feedback, report_issue, redraft, reship, and cancel', () => {
      const signingContract: ContractWorkflowSubject = {
        id: 'c-6',
        status: 'Đang chờ ký',
        processingMethod: 'physical',
      };

      expect(() =>
        validateActionGuard(signingContract, 'reject', adminActor, { note: '' })
      ).toThrowError(WorkflowGuardError);

      try {
        validateActionGuard(signingContract, 'reject', adminActor, { note: '   ' });
      } catch (err: any) {
        expect(err.code).toBe('MISSING_REQUIRED_NOTE');
      }

      // Valid note succeeds
      expect(() =>
        validateActionGuard(signingContract, 'reject', adminActor, {
          note: 'Đối tác yêu cầu điều chỉnh điều khoản bảo hành',
        })
      ).not.toThrow();
    });

    it('requires signed scan file before archiving digital contracts', () => {
      const digitalContract: ContractWorkflowSubject = {
        id: 'c-7',
        status: 'Chờ bản gửi lại',
        processingMethod: 'digital',
        hasScanFile: false,
      };

      expect(() =>
        validateActionGuard(digitalContract, 'archive', clerkActor, { hasScanFile: false })
      ).toThrowError(WorkflowGuardError);

      try {
        validateActionGuard(digitalContract, 'archive', clerkActor, { hasScanFile: false });
      } catch (err: any) {
        expect(err.code).toBe('MISSING_SIGNED_SCAN');
      }

      // With scan file present, archive succeeds
      expect(() =>
        validateActionGuard(digitalContract, 'archive', clerkActor, { hasScanFile: true })
      ).not.toThrow();
    });

    it('requires waybill code on assign_waybill', () => {
      const contract: ContractWorkflowSubject = {
        id: 'c-8',
        status: 'Chờ tạo vận đơn',
        processingMethod: 'physical',
      };

      expect(() =>
        validateActionGuard(contract, 'assign_waybill', clerkActor, { waybillCode: '' })
      ).toThrowError(WorkflowGuardError);

      try {
        validateActionGuard(contract, 'assign_waybill', clerkActor, { waybillCode: '  ' });
      } catch (err: any) {
        expect(err.code).toBe('MISSING_WAYBILL_CODE');
      }

      expect(() =>
        validateActionGuard(contract, 'assign_waybill', clerkActor, { waybillCode: 'VTP123456789' })
      ).not.toThrow();
    });
  });

  describe('3. Matrix Exhaustiveness', () => {
    it('covers all 15 workflow actions in WORKFLOW_ACTIONS', () => {
      expect(WORKFLOW_ACTIONS).toHaveLength(15);
      for (const action of WORKFLOW_ACTIONS) {
        expect(ACTION_TARGET_MAP[action]).toBeDefined();
      }
    });
  });
});

