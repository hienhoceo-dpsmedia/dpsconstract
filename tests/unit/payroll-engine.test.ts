import { describe, it, expect } from 'vitest';
import {
  calculateTaskPayroll,
  calculateClerkPayroll,
  calculateUrgencyInfo,
} from '../../src/utils/payroll.js';

describe('Unified Payroll Engine Invariants (T27)', () => {
  describe('1. Urgency Coefficient & Rules', () => {
    it('accurately evaluates urgency tiers based on requested vs deadline difference', () => {
      const now = new Date('2026-11-07T10:00:00Z');

      // <= 1 hour: Emergency (+30%)
      const emergencyDl = new Date('2026-11-07T10:45:00Z').toISOString();
      const emergency = calculateUrgencyInfo(now.toISOString(), emergencyDl);
      expect(emergency.level).toBe('emergency');
      expect(emergency.coef).toBe(0.3);

      // < 3 hours: Urgent (+20%)
      const urgentDl = new Date('2026-11-07T12:30:00Z').toISOString();
      const urgent = calculateUrgencyInfo(now.toISOString(), urgentDl);
      expect(urgent.level).toBe('urgent');
      expect(urgent.coef).toBe(0.2);

      // < 24 hours: Priority (+10%)
      const priorityDl = new Date('2026-11-07T18:00:00Z').toISOString();
      const priority = calculateUrgencyInfo(now.toISOString(), priorityDl);
      expect(priority.level).toBe('priority');
      expect(priority.coef).toBe(0.1);

      // >= 24 hours: Normal (+0%)
      const normalDl = new Date('2026-11-09T10:00:00Z').toISOString();
      const normal = calculateUrgencyInfo(now.toISOString(), normalDl);
      expect(normal.level).toBe('normal');
      expect(normal.coef).toBe(0.0);
    });
  });

  describe('2. Legal Drafting Payroll Calculations', () => {
    it('calculates on-time, zero feedback legal payroll as basePay', () => {
      const requestedAt = '2026-11-07T08:00:00Z';
      const deadline = '2026-11-08T08:00:00Z';
      const draftSubmittedAt = '2026-11-08T07:30:00Z'; // submitted slightly before deadline

      const res = calculateTaskPayroll({
        base_pay: 500000,
        requested_at: requestedAt,
        deadline,
        draft_submitted_at: draftSubmittedAt,
        feedback_count: 0,
      });

      expect(res.basePay).toBe(500000);
      expect(res.finalPayroll).toBe(500000); // 1 + 0 + 0 + 0 = 1.0 * 500.000 = 500.000 đ
    });

    it('rewards early submission with bonus coefficient', () => {
      const requestedAt = '2026-11-07T08:00:00Z';
      const deadline = '2026-11-08T08:00:00Z'; // 24h total
      const draftSubmittedAt = '2026-11-07T12:00:00Z'; // submitted after 4h (used 16.6% -> saved > 50%)

      const res = calculateTaskPayroll({
        base_pay: 500000,
        requested_at: requestedAt,
        deadline,
        draft_submitted_at: draftSubmittedAt,
        feedback_count: 0,
      });

      expect(res.punctualCoef).toBe(0.3); // +30% early bonus
      expect(res.finalPayroll).toBe(650000); // 500.000 * 1.3 = 650.000 đ
    });

    it('never produces negative payroll even under extreme penalties', () => {
      const requestedAt = '2026-11-07T08:00:00Z';
      const deadline = '2026-11-07T09:00:00Z';
      const draftSubmittedAt = '2026-11-08T09:00:00Z'; // severely late (+24h)

      const res = calculateTaskPayroll({
        base_pay: 500000,
        requested_at: requestedAt,
        deadline,
        draft_submitted_at: draftSubmittedAt,
        feedback_count: 5, // heavy feedback penalty
      });

      // Total coef could be 1 - 0.3 (late) - 0.3 (3+ feedback) = 0.4
      expect(res.finalPayroll).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(res.finalPayroll)).toBe(true);
    });
  });

  describe('3. Clerk Physical Payroll Calculations', () => {
    it('calculates clerk standard payroll and respects minimum 0 bounds', () => {
      const res = calculateClerkPayroll({
        clerk_base_pay: 100000,
        uploaded_at: '2026-11-07T08:00:00Z',
        printed_at: '2026-11-07T09:00:00Z', // 1 hour (within 2h SLA)
        waybill_created_at: '2026-11-07T10:00:00Z', // 1 hour after print (within 4h SLA)
        delivered_at: '2026-11-08T10:00:00Z',
        received_back_at: '2026-11-09T10:00:00Z', // 1 day retrieval (within 7d SLA)
        feedback_count: 0,
      });

      expect(res.basePay).toBe(100000);
      expect(res.finalPayroll).toBeGreaterThanOrEqual(100000);
      expect(Number.isInteger(res.finalPayroll)).toBe(true);
    });
  });
});

