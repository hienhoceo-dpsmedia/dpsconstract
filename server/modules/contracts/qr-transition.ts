import crypto from 'crypto';
import { verifyAndDecodeQrString } from '../security/qr.js';
import { executeWorkflowTransition } from '../workflow/transition.js';
import { getDb } from '../../db/client.js';
import { contracts, users, shipments } from '../../db/schema.js';
import { eq, or } from 'drizzle-orm';
import type { Actor, WorkflowAction } from '../../domain/types.js';
import type { Role } from '../../../src/shared/contracts.js';

export interface QrTransitionResult {
  success: boolean;
  contractId: string;
  previousStatus: string;
  newStatus: string;
  actionTaken: WorkflowAction;
  contract: any;
  message: string;
}

/**
 * Handles automatic sequential workflow transition triggered by scanning QR code label.
 */
export async function handleQrTransition(params: {
  qrString: string;
  actorId: string;
  actorKind?: 'user' | 'service';
  actorRole?: Role;
  notes?: string;
}): Promise<QrTransitionResult> {
  const { qrString, actorId, actorKind = 'user', actorRole, notes } = params;

  // 1. Verify and decode QR code
  const qrVerification = verifyAndDecodeQrString(qrString);
  if (!qrVerification.valid || !qrVerification.data) {
    throw new Error(qrVerification.error || 'Mã QR không hợp lệ hoặc đã bị can thiệp');
  }

  const { contractId } = qrVerification.data;

  // 2. Fetch contract
  const db = getDb();
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (!contract) {
    throw new Error(`Không tìm thấy hợp đồng với mã ID: ${contractId}`);
  }

  const currentStatus = contract.status;
  let actionToExecute: WorkflowAction | null = null;
  let actionMessage = '';

  // 3. Determine next physical progression action
  switch (currentStatus) {
    case 'Chờ in':
      actionToExecute = 'print';
      actionMessage = 'Đã quét xác nhận in hợp đồng vật lý thành công';
      break;

    case 'Đang chờ ký':
      actionToExecute = 'sign';
      actionMessage = 'Đã quét xác nhận ký hợp đồng thành công';
      break;

    case 'Chờ tạo vận đơn': {
      // If already has shipment with waybill code, move to pickup
      const [shipment] = await db
        .select()
        .from(shipments)
        .where(eq(shipments.contractId, contract.id))
        .limit(1);

      if (shipment && shipment.waybillCode) {
        actionToExecute = 'confirm_pickup';
        actionMessage = 'Đã quét xác nhận shipper Viettel Post tiếp nhận bưu phẩm';
      } else {
        throw new Error('Hợp đồng đang chờ tạo vận đơn. Vui lòng nhập mã vận đơn trước khi quét lấy hàng.');
      }
      break;
    }

    case 'Chờ shipper đến lấy':
      actionToExecute = 'confirm_pickup';
      actionMessage = 'Đã quét xác nhận shipper đã nhận phong bì hợp đồng';
      break;

    case 'Đang giao':
      actionToExecute = 'confirm_delivery';
      actionMessage = 'Đã quét xác nhận đối tác đã nhận được hợp đồng';
      break;

    case 'Chờ bản gửi lại':
      actionToExecute = 'archive';
      actionMessage = 'Đã quét xác nhận bản scan/hợp đồng gốc gửi lại và lưu kho hoàn tất';
      break;

    case 'Hoàn tất':
      return {
        success: true,
        contractId,
        previousStatus: currentStatus,
        newStatus: currentStatus,
        actionTaken: 'archive' as any,
        contract,
        message: 'Hợp đồng này đã ở trạng thái Hoàn tất, không cần chuyển tiếp.',
      };

    default:
      throw new Error(`Trạng thái hiện tại của hợp đồng ("${currentStatus}") không hỗ trợ chuyển tiếp tự động bằng mã QR.`);
  }

  // 4. Resolve Actor
  let actorObj: Actor;
  if (actorKind === 'service') {
    actorObj = {
      kind: 'service',
      service: 'vtp',
      eventId: crypto.randomUUID(),
    };
  } else {
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.id, actorId), eq(users.email, actorId)))
      .limit(1);

    actorObj = {
      kind: 'user',
      userId: user?.id || actorId,
      email: user?.email || actorId,
      role: (user?.role as any) || actorRole || 'clerk',
    };
  }

  // 5. Execute atomic workflow transition
  const transitionResult = await executeWorkflowTransition({
    contractId,
    action: actionToExecute,
    actor: actorObj,
    payload: {
      note: notes || `Quét QR tự động chuyển trạng thái: ${actionMessage}`,
    },
  });

  // Re-fetch updated contract
  const [updatedContract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  return {
    success: true,
    contractId,
    previousStatus: currentStatus,
    newStatus: transitionResult.currentStatus,
    actionTaken: actionToExecute,
    contract: updatedContract,
    message: actionMessage,
  };
}
