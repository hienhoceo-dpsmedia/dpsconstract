import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../server/db/client.js';
import {
  contracts,
  contractCycles,
  contractRevisions,
  contractFeedbackHistory,
  workItems,
  users,
} from '../../server/db/schema.js';
import { createDraftingRequest } from '../../server/modules/contracts/service.js';
import {
  submitDraftRevision,
  recordDraftFeedback,
  approveSoftCopyDraft,
} from '../../server/modules/contracts/revisions.js';
import type { UserActor } from '../../server/domain/types.js';

describe('Drafting Lifecycle, Payroll Snapshot & Soft Approval (T22)', () => {
  const db = getDb();
  let adminActor: UserActor;
  let legalActor: UserActor;

  beforeEach(async () => {
    const adminId = crypto.randomUUID();
    const legalId = crypto.randomUUID();

    await db.insert(users).values([
      {
        id: adminId,
        email: `admin-draft-${Date.now()}@dps.media`,
        role: 'admin',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
      {
        id: legalId,
        email: `legal-draft-${Date.now()}@dps.media`,
        role: 'legal',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
    ]);

    adminActor = {
      kind: 'user',
      userId: adminId,
      email: `admin-draft-${Date.now()}@dps.media`,
      role: 'admin',
    };

    legalActor = {
      kind: 'user',
      userId: legalId,
      email: `legal-draft-${Date.now()}@dps.media`,
      role: 'legal',
    };
  });

  it('completes the drafting -> submit -> feedback -> resubmit -> approve cycle', async () => {
    // 1. Admin creates drafting request
    const createdContract = await createDraftingRequest({
      name: 'Hợp đồng phát triển phần mềm CRM',
      partnerName: 'Công ty Cổ phần DPS Media',
      valueText: '150.000.000 đ',
      legalAssigneeId: legalActor.userId,
      draftingInstructions: 'Soạn thảo điều khoản thanh toán 3 đợt, bảo hành 12 tháng.',
      actorId: adminActor.userId,
      actorEmail: adminActor.email,
    });

    expect(createdContract.status).toBe('Chờ soạn thảo');
    expect(createdContract.legalAssigneeId).toBe(legalActor.userId);

    // Verify Work Item and Base Pay snapshot
    const [legalWorkItem] = await db
      .select()
      .from(workItems)
      .where(eq(workItems.contractId, createdContract.id));

    expect(legalWorkItem).toBeDefined();
    expect(legalWorkItem.kind).toBe('legal');
    expect(legalWorkItem.basePaySnapshot).toBeGreaterThanOrEqual(500000);
    expect(legalWorkItem.state).toBe('open');

    // 2. Legal submits Revision 1
    const sub1 = await submitDraftRevision({
      contractId: createdContract.id,
      actor: legalActor,
      docsUrl: 'https://docs.google.com/document/d/sample-rev-1',
      note: 'Nộp bản thảo đợt 1',
    });

    expect(sub1.revisionNumber).toBe(1);
    expect(sub1.transitionResult.currentStatus).toBe('Chờ duyệt bản mềm');

    // 3. Admin rejects & requests feedback
    const fbRes = await recordDraftFeedback({
      contractId: createdContract.id,
      actor: adminActor,
      note: 'Bổ sung thêm điều khoản phạt vi phạm 8% giá trị vi phạm.',
    });

    expect(fbRes.transitionResult.currentStatus).toBe('Chờ soạn thảo');

    const feedbacks = await db
      .select()
      .from(contractFeedbackHistory)
      .where(eq(contractFeedbackHistory.contractId, createdContract.id));

    expect(feedbacks).toHaveLength(1);
    expect(feedbacks[0].note).toContain('phạt vi phạm 8%');

    // 4. Legal resubmits Revision 2
    const sub2 = await submitDraftRevision({
      contractId: createdContract.id,
      actor: legalActor,
      docsUrl: 'https://docs.google.com/document/d/sample-rev-2',
      note: 'Đã bổ sung điều khoản phạt vi phạm',
    });

    expect(sub2.revisionNumber).toBe(2);
    expect(sub2.transitionResult.currentStatus).toBe('Chờ duyệt bản mềm');

    // 5. Admin approves soft copy
    const approveRes = await approveSoftCopyDraft({
      contractId: createdContract.id,
      actor: adminActor,
    });

    expect(approveRes.transitionResult.currentStatus).toBe('Chờ in');

    // Verify DB contract state
    const [finalContract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, createdContract.id));

    expect(finalContract.status).toBe('Chờ in');
    expect(finalContract.softApprovedAt).toBeDefined();

    // Verify Cycle approvedAt
    const [cycle] = await db
      .select()
      .from(contractCycles)
      .where(eq(contractCycles.id, finalContract.currentCycleId!));

    expect(cycle.approvedAt).toBeDefined();
  });
});
