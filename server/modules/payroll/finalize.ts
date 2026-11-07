import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import {
  workItems,
  payrollEntries,
  contracts,
  contractFeedbackHistory,
  clerkIncidents,
  users,
} from '../../db/schema.js';
import { calculateTaskPayroll, calculateClerkPayroll } from '../../../src/utils/payroll.js';
import type { UserActor } from '../../domain/types.js';
import { AppError } from '../../http/errors.js';

export interface FinalizePayrollParams {
  workItemId: string;
  actor: UserActor;
  clock?: () => Date;
}

export async function finalizePayrollEntry(params: FinalizePayrollParams) {
  const db = getDb();
  const now = params.clock ? params.clock() : new Date();

  return await db.transaction(async (tx) => {
    // 1. Lock workItem
    const [workItem] = await tx
      .select()
      .from(workItems)
      .where(eq(workItems.id, params.workItemId))
      .for('update');

    if (!workItem) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy mục công việc (Work Item) tính lương.');
    }

    if (workItem.state === 'finalized') {
      throw new AppError(
        409,
        'ALREADY_FINALIZED',
        'Mục công việc này đã được chốt lương và đóng băng snapshot bất biến.'
      );
    }

    if (!workItem.assigneeId) {
      throw new AppError(400, 'UNASSIGNED', 'Không thể chốt lương cho mục công việc chưa được gán nhân sự.');
    }

    // 2. Fetch contract details
    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, workItem.contractId));

    if (!contract) {
      throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Không tìm thấy hợp đồng tương ứng.');
    }

    let calculationResult: any;

    if (workItem.kind === 'legal') {
      // Count feedback for legal
      const feedbacks = await tx
        .select()
        .from(contractFeedbackHistory)
        .where(eq(contractFeedbackHistory.contractId, contract.id));

      calculationResult = calculateTaskPayroll(
        {
          base_pay: workItem.basePaySnapshot,
          requested_at: contract.uploadedAt ? contract.uploadedAt.toISOString() : null,
          deadline: workItem.deadline ? workItem.deadline.toISOString() : null,
          draft_submitted_at: contract.softApprovedAt
            ? contract.softApprovedAt.toISOString()
            : null,
          feedback_count: feedbacks.length,
        },
        workItem.policySnapshot as any
      );
    } else {
      // Count clerk incidents
      const incidents = await tx
        .select()
        .from(clerkIncidents)
        .where(eq(clerkIncidents.contractId, contract.id));

      calculationResult = calculateClerkPayroll(
        {
          clerk_base_pay: workItem.basePaySnapshot,
          uploaded_at: contract.uploadedAt ? contract.uploadedAt.toISOString() : null,
          printed_at: contract.printedAt ? contract.printedAt.toISOString() : null,
          waybill_created_at: contract.waybillCreatedAt
            ? contract.waybillCreatedAt.toISOString()
            : null,
          picked_up_at: contract.pickedUpAt ? contract.pickedUpAt.toISOString() : null,
          delivered_at: contract.deliveredAt ? contract.deliveredAt.toISOString() : null,
          received_back_at: contract.receivedBackAt
            ? contract.receivedBackAt.toISOString()
            : null,
          archived_at: contract.archivedAt ? contract.archivedAt.toISOString() : null,
          status: contract.status,
          feedback_count: incidents.length,
        },
        workItem.policySnapshot as any
      );
    }

    const payrollEntryId = crypto.randomUUID();

    // 3. Insert immutable payrollEntry
    const [inserted] = await tx
      .insert(payrollEntries)
      .values({
        id: payrollEntryId,
        workItemId: workItem.id,
        contractId: contract.id,
        beneficiaryId: workItem.assigneeId,
        finalizedBy: params.actor.userId,
        finalizedAt: now,
        engineVersion: '1.0',
        amountVnd: calculationResult.finalPayroll,
        coefBreakdown: calculationResult,
        policySnapshot: workItem.policySnapshot,
        inputSnapshot: {
          calculationResult,
          policySnapshot: workItem.policySnapshot,
          basePaySnapshot: workItem.basePaySnapshot,
          contractNumber: contract.contractNumber,
          contractName: contract.name,
          partnerName: contract.partnerName,
          finalPayroll: calculationResult.finalPayroll,
          formulaString: calculationResult.formulaString,
        },
      })
      .returning();

    // 4. Update workItem state to finalized
    await tx
      .update(workItems)
      .set({ state: 'finalized' })
      .where(eq(workItems.id, workItem.id));

    return {
      payrollEntryId,
      finalPayroll: calculationResult.finalPayroll,
      formulaString: calculationResult.formulaString,
      beneficiaryId: workItem.assigneeId,
      finalizedAt: now,
      snapshot: inserted.inputSnapshot,
    };
  });
}
