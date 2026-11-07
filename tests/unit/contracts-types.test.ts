import { describe, expect, it } from 'vitest';
import {
  CONTRACT_STATUSES,
  type ContractStatus,
  type Role,
  type SafeUser,
  type ContractSummary,
  type ContractPage,
} from '../../src/shared/contracts';
import type { Actor, UserActor, ServiceActor, WorkflowAction } from '../../server/domain/types';

describe('Shared DTO and Domain Contracts', () => {
  it('defines exactly 12 contract statuses matching specification', () => {
    expect(CONTRACT_STATUSES).toHaveLength(12);
    expect(CONTRACT_STATUSES).toContain('Chờ soạn thảo');
    expect(CONTRACT_STATUSES).toContain('Chờ duyệt bản mềm');
    expect(CONTRACT_STATUSES).toContain('Chờ in');
    expect(CONTRACT_STATUSES).toContain('Đang chờ ký');
    expect(CONTRACT_STATUSES).toContain('Chờ tạo vận đơn');
    expect(CONTRACT_STATUSES).toContain('Chờ shipper đến lấy');
    expect(CONTRACT_STATUSES).toContain('Đang giao');
    expect(CONTRACT_STATUSES).toContain('Chờ bản gửi lại');
    expect(CONTRACT_STATUSES).toContain('Hoàn tất');
    expect(CONTRACT_STATUSES).toContain('Bị từ chối ký');
    expect(CONTRACT_STATUSES).toContain('Sự cố vận chuyển');
    expect(CONTRACT_STATUSES).toContain('Đã hủy');
  });

  it('prohibits internal secrets and file paths on public DTOs', () => {
    const userDto: SafeUser = {
      id: 'u_1',
      email: 'test@dps.media',
      name: 'Tester',
      role: 'admin',
      status: 'active',
    };
    expect(userDto).not.toHaveProperty('password_hash');
    expect(userDto).not.toHaveProperty('password');

    const summary: ContractSummary = {
      id: 'c_1',
      contractNumber: 'HD-001',
      name: 'Hop dong',
      partnerName: 'Doi tac A',
      value: '100,000,000 VND',
      status: 'Chờ in',
      version: 1,
      processingMethod: 'physical',
      uploaded_at: '2026-11-07T00:00:00.000Z',
      slaBreached: false,
      slaBreachType: null,
      allowedActions: ['print'],
    };
    expect(summary).not.toHaveProperty('filePath');
    expect(summary).not.toHaveProperty('storage_key');
  });

  it('ensures ContractPage envelope requires all 12 status counts', () => {
    const counts: Record<ContractStatus, number> = {
      'Chờ soạn thảo': 0,
      'Chờ duyệt bản mềm': 0,
      'Chờ in': 0,
      'Đang chờ ký': 0,
      'Chờ tạo vận đơn': 0,
      'Chờ shipper đến lấy': 0,
      'Đang giao': 0,
      'Chờ bản gửi lại': 0,
      'Hoàn tất': 0,
      'Bị từ chối ký': 0,
      'Sự cố vận chuyển': 0,
      'Đã hủy': 0,
    };

    const page: ContractPage = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      statusCounts: counts,
    };

    expect(Object.keys(page.statusCounts)).toHaveLength(12);
  });
});

