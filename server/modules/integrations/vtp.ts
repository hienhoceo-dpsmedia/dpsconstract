import { getDb } from '../../db/client.js';
import { shipments, vtpTrackingHistory, contracts } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { executeWorkflowTransition } from '../workflow/transition.js';
import type { ContractStatus } from '../../../src/shared/contracts.js';

export interface VtpStatusMapping {
  normalizedStatus: 'pickup' | 'in_transit' | 'delivered' | 'issue' | 'unknown';
  targetContractStatus?: ContractStatus;
  description: string;
}

/**
 * Maps Viettel Post webhook status codes to internal logistics events
 */
export function mapVtpStatusCode(statusCode: string | number): VtpStatusMapping {
  const code = parseInt(String(statusCode), 10);

  // 100 - 103: Tiếp nhận & Đang lấy hàng
  if ([100, 101, 102, 103].includes(code)) {
    return {
      normalizedStatus: 'pickup',
      targetContractStatus: 'Chờ shipper đến lấy',
      description: 'Bưu tá Viettel Post tiếp nhận yêu cầu lấy hàng',
    };
  }

  // 104 - 400: Đã lấy hàng, đang trung chuyển & đang phát
  if ([104, 105, 200, 201, 202, 300, 400].includes(code)) {
    return {
      normalizedStatus: 'in_transit',
      targetContractStatus: 'Đang giao',
      description: 'Bưu phẩm đang trung chuyển hoặc đang được bưu tá đi phát',
    };
  }

  // 500 - 501: Giao hàng thành công
  if ([500, 501].includes(code)) {
    return {
      normalizedStatus: 'delivered',
      targetContractStatus: 'Chờ bản gửi lại',
      description: 'Đối tác đã ký nhận bưu phẩm thành công',
    };
  }

  // 502, 504 - 507: Phát thất bại / Sự cố / Chuyển hoàn
  if ([502, 503, 504, 505, 506, 507].includes(code)) {
    return {
      normalizedStatus: 'issue',
      targetContractStatus: 'Sự cố vận chuyển',
      description: 'Giao hàng thất bại hoặc có sự cố chuyển phát Viettel Post',
    };
  }

  return {
    normalizedStatus: 'unknown',
    description: `Mã trạng thái Viettel Post chưa định danh (${code})`,
  };
}

/**
 * Ingests a Viettel Post webhook event, records tracking history, and transitions contract if applicable.
 */
export async function processVtpWebhookEvent(event: {
  waybillCode: string;
  statusCode: string | number;
  statusName: string;
  note?: string;
  location?: string;
  eventTime?: string;
}): Promise<{ recorded: boolean; transitioned: boolean; message: string }> {
  const { waybillCode, statusCode, statusName, note, location, eventTime } = event;
  const db = getDb();

  // 1. Find shipment record
  const [shipment] = await db
    .select()
    .from(shipments)
    .where(eq(shipments.waybillCode, waybillCode))
    .limit(1);

  if (!shipment) {
    return {
      recorded: false,
      transitioned: false,
      message: `Không tìm thấy bưu gửi với mã vận đơn: ${waybillCode}`,
    };
  }

  const mapping = mapVtpStatusCode(statusCode);
  const eventId = `vtp_ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // 2. Insert tracking history
  await db.insert(vtpTrackingHistory).values({
    id: eventId,
    shipmentId: shipment.id,
    providerEventId: eventId,
    rawStatus: `${statusCode}: ${statusName}`,
    normalizedStatus: mapping.normalizedStatus,
    occurredAt: eventTime ? new Date(eventTime) : new Date(),
    receivedAt: new Date(),
    note: note || mapping.description,
    location: location || null,
  });

  // 3. Attempt state transition if target contract exists
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, shipment.contractId))
    .limit(1);

  if (!contract) {
    return { recorded: true, transitioned: false, message: 'Đã lưu tracking, không tìm thấy hợp đồng' };
  }

  let transitioned = false;
  try {
    if (mapping.normalizedStatus === 'in_transit' && contract.status === 'Chờ shipper đến lấy') {
      await executeWorkflowTransition({
        contractId: contract.id,
        action: 'confirm_pickup',
        actor: { kind: 'service', service: 'vtp', eventId },
        payload: { note: `Cập nhật tự động Viettel Post: ${mapping.description}` },
      });
      transitioned = true;
    } else if (mapping.normalizedStatus === 'delivered' && contract.status === 'Đang giao') {
      await executeWorkflowTransition({
        contractId: contract.id,
        action: 'confirm_delivery',
        actor: { kind: 'service', service: 'vtp', eventId },
        payload: { note: `Viettel Post báo phát thành công: ${mapping.description}` },
      });
      transitioned = true;
    } else if (mapping.normalizedStatus === 'issue' && ['Chờ shipper đến lấy', 'Đang giao'].includes(contract.status)) {
      await executeWorkflowTransition({
        contractId: contract.id,
        action: 'report_issue',
        actor: { kind: 'service', service: 'vtp', eventId },
        payload: { note: `Báo cáo sự cố từ Viettel Post (${statusName}): ${note || mapping.description}` },
      });
      transitioned = true;
    }
  } catch (err: any) {
    // Transition could be rejected if guards fail; tracking is still recorded
    return {
      recorded: true,
      transitioned: false,
      message: `Đã ghi nhận tracking, không chuyển trạng thái: ${err.message}`,
    };
  }

  return {
    recorded: true,
    transitioned,
    message: `Đã xử lý sự kiện Viettel Post thành công (${mapping.description})`,
  };
}

