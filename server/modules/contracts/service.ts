import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import {
  contracts,
  contractCycles,
  contractAuditLogs,
  contractIdentifiers,
  workItems,
} from '../../db/schema.js';
import { getSettingsRecord } from '../settings/repository.js';
import { AppError } from '../../http/errors.js';
import { normalizeContractNumber } from '../../domain/identifiers.js';
import { parseContractValue } from '../../domain/money.js';

export interface CreateDraftingRequestParams {
  name: string;
  partnerName: string;
  valueText: string;
  valueAmount?: number;
  currency?: string;
  draftingInstructions?: string;
  legalAssigneeId?: string | null;
  processingMethod?: 'physical' | 'digital';
  actorId: string;
  actorEmail?: string;
  clock?: () => Date;
}

export interface CreateManualContractParams {
  name: string;
  contractNumber: string;
  partnerName: string;
  valueText: string;
  signDate?: string;
  effectiveDate?: string;
  googleDocsLink?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  deliveryNotes?: string;
  processingMethod: 'physical' | 'digital';
  printCopies?: number;
  actorId: string;
  actorEmail?: string;
  clock?: () => Date;
}

export async function createDraftingRequest(params: CreateDraftingRequestParams) {
  const db = getDb();
  const now = params.clock ? params.clock() : new Date();

  const settings = await getSettingsRecord();
  const basePayLegal = settings?.defaultBasePayLegal ?? 500000;
  const legalSlaHours = settings?.slaInternalHours ?? 24;
  const deadline = new Date(now.getTime() + legalSlaHours * 3600 * 1000);

  const contractId = crypto.randomUUID();
  const contractNumber = `YC-${Date.now()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  const cycleId = crypto.randomUUID();
  const workItemId = crypto.randomUUID();

  return await db.transaction(async (tx) => {
    // 1. Insert contract
    const [insertedContract] = await tx
      .insert(contracts)
      .values({
        id: contractId,
        contractNumber,
        name: params.name,
        partnerName: params.partnerName,
        valueText: params.valueText,
        valueAmount: params.valueAmount ? String(params.valueAmount) : '0',
        currency: params.currency || 'VND',
        status: 'Chờ soạn thảo',
        version: 1,
        processingMethod: params.processingMethod || 'physical',
        uploadedAt: now,
        statusEnteredAt: now,
        statusDueAt: deadline,
        createdBy: params.actorId,
        legalAssigneeId: params.legalAssigneeId || null,
        currentCycleId: cycleId,
        draftingInstructions: params.draftingInstructions || null,
        lastActivityAt: now,
      })
      .returning();

    // 2. Insert Initial Cycle
    await tx.insert(contractCycles).values({
      id: cycleId,
      contractId,
      cycleNumber: 1,
      type: 'initial',
      startedAt: now,
    });

    // 3. Insert Legal Work Item with immutable payroll snapshot
    await tx.insert(workItems).values({
      id: workItemId,
      contractId,
      kind: 'legal',
      assigneeId: params.legalAssigneeId || null,
      payable: true,
      policySnapshot: settings || {},
      basePaySnapshot: basePayLegal,
      deadline,
      startedAt: now,
      state: 'open',
      sourceCycleId: cycleId,
      createdAt: now,
    });

    // 4. Record Identifier
    await tx.insert(contractIdentifiers).values({
      code: contractNumber,
      kind: 'current_number',
      contractId,
      createdAt: now,
    });

    // 5. Append Audit Log
    await tx.insert(contractAuditLogs).values({
      id: crypto.randomUUID(),
      contractId,
      cycleId,
      action: 'create_draft_request',
      fromStatus: null,
      toStatus: 'Chờ soạn thảo',
      actorKind: 'user',
      actorId: params.actorId,
      actorEmail: params.actorEmail || null,
      reason: params.draftingInstructions || 'Khởi tạo yêu cầu soạn thảo hợp đồng',
      createdAt: now,
    });

    return insertedContract;
  });
}

export async function createManualContract(params: CreateManualContractParams) {
  const db = getDb();
  const now = params.clock ? params.clock() : new Date();

  const normalizedNumber = normalizeContractNumber(params.contractNumber);
  if (!normalizedNumber) {
    throw new AppError(400, 'INVALID_CONTRACT_NUMBER', 'Số hợp đồng không được để trống.');
  }

  // Check duplicate
  const [existing] = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(sql`lower(${contracts.contractNumber}) = ${normalizedNumber.toLowerCase()}`);

  if (existing) {
    throw new AppError(
      409,
      'DUPLICATE_CONTRACT_NUMBER',
      `Số hợp đồng "${params.contractNumber}" đã tồn tại trong hệ thống.`
    );
  }

  const settings = await getSettingsRecord();
  const basePayClerk = settings?.defaultBasePayClerk ?? 100000;
  const parsedValue = parseContractValue(params.valueText);

  const contractId = crypto.randomUUID();
  const cycleId = crypto.randomUUID();

  return await db.transaction(async (tx) => {
    // 1. Insert contract
    const [insertedContract] = await tx
      .insert(contracts)
      .values({
        id: contractId,
        contractNumber: normalizedNumber,
        name: params.name,
        partnerName: params.partnerName,
        valueText: params.valueText,
        valueAmount: parsedValue.valueAmount !== null ? String(parsedValue.valueAmount) : '0',
        currency: parsedValue.currency || 'VND',
        status: 'Chờ duyệt bản mềm',
        version: 1,
        processingMethod: params.processingMethod,
        uploadedAt: now,
        statusEnteredAt: now,
        createdBy: params.actorId,
        currentCycleId: cycleId,
        googleDocsLink: params.googleDocsLink || null,
        receiverName: params.receiverName || null,
        receiverPhone: params.receiverPhone || null,
        receiverAddress: params.receiverAddress || null,
        deliveryNotes: params.deliveryNotes || null,
        printCopies: params.printCopies || 1,
        lastActivityAt: now,
      })
      .returning();

    // 2. Insert Cycle
    await tx.insert(contractCycles).values({
      id: cycleId,
      contractId,
      cycleNumber: 1,
      type: 'initial',
      startedAt: now,
    });

    // 3. If physical, create Clerk Work Item with base pay snapshot
    if (params.processingMethod === 'physical') {
      await tx.insert(workItems).values({
        id: crypto.randomUUID(),
        contractId,
        kind: 'clerk',
        assigneeId: null,
        payable: true,
        policySnapshot: settings || {},
        basePaySnapshot: basePayClerk,
        startedAt: now,
        state: 'open',
        sourceCycleId: cycleId,
        createdAt: now,
      });
    }

    // 4. Record Identifier
    await tx.insert(contractIdentifiers).values({
      code: normalizedNumber,
      kind: 'current_number',
      contractId,
      createdAt: now,
    });

    // 5. Append Audit Log
    await tx.insert(contractAuditLogs).values({
      id: crypto.randomUUID(),
      contractId,
      cycleId,
      action: 'create_contract_manual',
      fromStatus: null,
      toStatus: 'Chờ duyệt bản mềm',
      actorKind: 'user',
      actorId: params.actorId,
      actorEmail: params.actorEmail || null,
      reason: 'Khởi tạo hồ sơ hợp đồng thủ công',
      createdAt: now,
    });

    return insertedContract;
  });
}
