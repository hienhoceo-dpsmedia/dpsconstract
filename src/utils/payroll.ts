import type { SettingsState } from '../types.js';

export interface PayrollCalculationResult {
  basePay: number;
  urgencyCoef: number;
  urgencyLabel: string;
  urgencyLevel: 'normal' | 'priority' | 'urgent' | 'emergency';
  punctualCoef: number;
  punctualLabel: string;
  isPunctual: boolean | null;
  qualityCoef: number;
  qualityLabel: string;
  feedbackCount: number;
  totalCoef: number;
  finalPayroll: number;
  formulaString: string;
}

/**
 * Calculates Urgency Coefficient based on Deadline vs Requested Time or explicit override
 */
export function calculateUrgencyInfo(
  requestedAtStr?: string | null,
  deadlineStr?: string | null,
  urgencyOverride?: 'normal' | 'priority' | 'urgent' | 'emergency' | null
): { coef: number; label: string; level: 'normal' | 'priority' | 'urgent' | 'emergency' } {
  if (urgencyOverride) {
    switch (urgencyOverride) {
      case 'emergency':
        return { coef: 0.3, label: 'Khẩn cấp (+30%)', level: 'emergency' };
      case 'urgent':
        return { coef: 0.2, label: 'Gấp (+20%)', level: 'urgent' };
      case 'priority':
        return { coef: 0.1, label: 'Ưu tiên (+10%)', level: 'priority' };
      case 'normal':
      default:
        return { coef: 0.0, label: 'Bình thường (+0%)', level: 'normal' };
    }
  }

  if (!requestedAtStr || !deadlineStr) {
    return { coef: 0.0, label: 'Bình thường (+0%)', level: 'normal' };
  }

  const reqTime = new Date(requestedAtStr).getTime();
  const dlTime = new Date(deadlineStr).getTime();
  const diffHours = (dlTime - reqTime) / (1000 * 60 * 60);

  if (diffHours <= 1.0) {
    return { coef: 0.3, label: 'Khẩn cấp (≤ 1h / ngoài giờ: +30%)', level: 'emergency' };
  } else if (diffHours < 3.0) {
    return { coef: 0.2, label: 'Gấp (< 3h trong ngày: +20%)', level: 'urgent' };
  } else if (diffHours < 24.0) {
    return { coef: 0.1, label: 'Ưu tiên (trong ngày ≥ 3h: +10%)', level: 'priority' };
  } else {
    return { coef: 0.0, label: 'Bình thường (≥ 1 ngày: +0%)', level: 'normal' };
  }
}

/**
 * Full calculation for a drafting contract task (LEGAL ROLE)
 */
export function calculateTaskPayroll(
  contract: {
    base_pay?: number;
    requested_at?: string | null;
    deadline?: string | null;
    draft_submitted_at?: string | null;
    urgency_level?: 'normal' | 'priority' | 'urgent' | 'emergency';
    urgency_coef?: number;
    feedback_count?: number;
  },
  settings?: SettingsState
): PayrollCalculationResult {
  const basePay = contract.base_pay || settings?.defaultBasePayLegal || 500000;
  const feedbackCount = contract.feedback_count || 0;

  // Custom rates from settings or defaults
  const earlyMaxRate = (settings?.slaEarlyMaxRate ?? 30) / 100;
  const earlyMidRate = (settings?.slaEarlyMidRate ?? 20) / 100;
  const earlyMinRate = (settings?.slaEarlyMinRate ?? 10) / 100;
  const onTimeRate = (settings?.slaOnTimeRate ?? 0) / 100;
  const lateMinRate = (settings?.slaLateMinRate ?? -10) / 100;
  const lateMidRate = (settings?.slaLateMidRate ?? -20) / 100;
  const lateMaxRate = (settings?.slaLateMaxRate ?? -30) / 100;

  // Custom threshold time criteria
  const earlyMaxTimePct = (settings?.slaEarlyMaxTimePct ?? 50) / 100;
  const earlyMidTimePct = (settings?.slaEarlyMidTimePct ?? 25) / 100;
  const earlyMinTimePct = (settings?.slaEarlyMinTimePct ?? 5) / 100;
  const lateMinHours = settings?.slaLateMinHours ?? 2;
  const lateMidHours = settings?.slaLateMidHours ?? 6;

  const fb0Rate = (settings?.feedback0Rate ?? 0) / 100;
  const fb1Rate = (settings?.feedback1Rate ?? -10) / 100;
  const fb2Rate = (settings?.feedback2Rate ?? -20) / 100;
  const fb3Rate = (settings?.feedback3Rate ?? -30) / 100;

  // 1. Urgency Coef
  const urgencyInfo = calculateUrgencyInfo(
    contract.requested_at,
    contract.deadline,
    contract.urgency_level
  );
  const urgencyCoef = contract.urgency_coef !== undefined ? contract.urgency_coef : urgencyInfo.coef;

  // 2. SLA Timeliness Coef (Sớm / Đúng / Trễ SLA)
  let isPunctual: boolean | null = null;
  let punctualCoef = onTimeRate;
  let punctualLabel = 'Chưa nộp';

  if (contract.draft_submitted_at && contract.deadline) {
    const submitTime = new Date(contract.draft_submitted_at).getTime();
    const deadlineTime = new Date(contract.deadline).getTime();
    const requestTime = contract.requested_at ? new Date(contract.requested_at).getTime() : submitTime - 24 * 3600 * 1000;
    
    const totalDuration = Math.max(1000 * 60, deadlineTime - requestTime);
    const usedTime = Math.max(0, submitTime - requestTime);
    const savedRatio = (totalDuration - usedTime) / totalDuration;

    if (submitTime <= deadlineTime) {
      isPunctual = true;
      if (savedRatio >= earlyMaxTimePct) {
        punctualCoef = earlyMaxRate;
        punctualLabel = `Sớm nhiều (+${Math.round(earlyMaxRate * 100)}%)`;
      } else if (savedRatio >= earlyMidTimePct) {
        punctualCoef = earlyMidRate;
        punctualLabel = `Sớm vừa (+${Math.round(earlyMidRate * 100)}%)`;
      } else if (savedRatio >= earlyMinTimePct) {
        punctualCoef = earlyMinRate;
        punctualLabel = `Sớm ít (+${Math.round(earlyMinRate * 100)}%)`;
      } else {
        punctualCoef = onTimeRate;
        punctualLabel = `Đúng SLA (${Math.round(onTimeRate * 100) >= 0 ? '+' : ''}${Math.round(onTimeRate * 100)}%)`;
      }
    } else {
      isPunctual = false;
      const overdueHours = (submitTime - deadlineTime) / (1000 * 3600);
      if (overdueHours <= lateMinHours) {
        punctualCoef = lateMinRate;
        punctualLabel = `Trễ ít (${Math.round(lateMinRate * 100)}%)`;
      } else if (overdueHours <= lateMidHours) {
        punctualCoef = lateMidRate;
        punctualLabel = `Trễ vừa (${Math.round(lateMidRate * 100)}%)`;
      } else {
        punctualCoef = lateMaxRate;
        punctualLabel = `Trễ nhiều (${Math.round(lateMaxRate * 100)}%)`;
      }
    }
  } else if (contract.deadline) {
    const nowTime = new Date().getTime();
    const deadlineTime = new Date(contract.deadline).getTime();
    if (nowTime > deadlineTime) {
      isPunctual = false;
      const overdueHours = (nowTime - deadlineTime) / (1000 * 3600);
      if (overdueHours <= lateMinHours) {
        punctualCoef = lateMinRate;
        punctualLabel = `Quá hạn ít (${Math.round(lateMinRate * 100)}%)`;
      } else if (overdueHours <= lateMidHours) {
        punctualCoef = lateMidRate;
        punctualLabel = `Quá hạn vừa (${Math.round(lateMidRate * 100)}%)`;
      } else {
        punctualCoef = lateMaxRate;
        punctualLabel = `Quá hạn nhiều (${Math.round(lateMaxRate * 100)}%)`;
      }
    } else {
      punctualLabel = 'Đang trong hạn';
      punctualCoef = onTimeRate;
    }
  }

  // 3. Quality / Feedback Coef
  let qualityCoef = fb0Rate;
  let qualityLabel = `Chất lượng (0 feedback: ${Math.round(fb0Rate * 100) >= 0 ? '+' : ''}${Math.round(fb0Rate * 100)}%)`;

  if (feedbackCount === 1) {
    qualityCoef = fb1Rate;
    qualityLabel = `1 lần feedback (${Math.round(fb1Rate * 100)}%)`;
  } else if (feedbackCount === 2) {
    qualityCoef = fb2Rate;
    qualityLabel = `2 lần feedback (${Math.round(fb2Rate * 100)}%)`;
  } else if (feedbackCount >= 3) {
    qualityCoef = fb3Rate;
    qualityLabel = `3+ lần feedback (${Math.round(fb3Rate * 100)}%)`;
  }

  // 4. Formula Calculation
  const totalCoef = 1 + urgencyCoef + punctualCoef + qualityCoef;
  const finalPayroll = Math.round(basePay * Math.max(0, totalCoef));

  const formulaString = `${basePay.toLocaleString('vi-VN')} VNĐ × (1 + ${urgencyCoef >= 0 ? '+' : ''}${urgencyCoef} [Gấp] + ${punctualCoef >= 0 ? '+' : ''}${punctualCoef} [SLA] + ${qualityCoef >= 0 ? '+' : ''}${qualityCoef} [Chất lượng]) = ${finalPayroll.toLocaleString('vi-VN')} VNĐ`;

  return {
    basePay,
    urgencyCoef,
    urgencyLabel: urgencyInfo.label,
    urgencyLevel: urgencyInfo.level,
    punctualCoef,
    punctualLabel,
    isPunctual,
    qualityCoef,
    qualityLabel,
    feedbackCount,
    totalCoef,
    finalPayroll,
    formulaString
  };
}

export interface ClerkPayrollResult {
  basePay: number;
  printSlaCoef: number;
  courierSlaCoef: number;
  retrievalSlaCoef: number;
  accuracyCoef: number;
  totalCoef: number;
  finalPayroll: number;
  formulaString: string;
}

/**
 * Calculates Clerk (Văn thư) Physical Processing Payroll
 */
export function calculateClerkPayroll(
  contract: {
    uploaded_at?: string | null;
    printed_at?: string | null;
    waybill_created_at?: string | null;
    picked_up_at?: string | null;
    delivered_at?: string | null;
    received_back_at?: string | null;
    archived_at?: string | null;
    status?: string;
    clerk_base_pay?: number;
    feedback_count?: number;
  },
  settings?: SettingsState
): ClerkPayrollResult {
  const basePay = contract.clerk_base_pay || settings?.defaultBasePayClerk || 100000;
  const slaPrintLimitHours = settings?.slaPrintingHours || 2;
  const slaCourierLimitHours = settings?.slaCourierHours || 4;
  const slaRetrievalLimitDays = settings?.slaRetrievalDays || 7;

  const earlyMaxRate = (settings?.slaEarlyMaxRate ?? 30) / 100;
  const earlyMidRate = (settings?.slaEarlyMidRate ?? 20) / 100;
  const earlyMinRate = (settings?.slaEarlyMinRate ?? 10) / 100;
  const onTimeRate = (settings?.slaOnTimeRate ?? 0) / 100;
  const lateMinRate = (settings?.slaLateMinRate ?? -10) / 100;
  const lateMidRate = (settings?.slaLateMidRate ?? -20) / 100;
  const lateMaxRate = (settings?.slaLateMaxRate ?? -30) / 100;

  const fb0Rate = (settings?.feedback0Rate ?? 0) / 100;
  const fb1Rate = (settings?.feedback1Rate ?? -10) / 100;
  const fb2Rate = (settings?.feedback2Rate ?? -20) / 100;
  const fb3Rate = (settings?.feedback3Rate ?? -30) / 100;

  // 1. Print SLA Coef
  let printSlaCoef = onTimeRate;
  if (contract.printed_at && contract.uploaded_at) {
    const printTime = new Date(contract.printed_at).getTime();
    const uploadTime = new Date(contract.uploaded_at).getTime();
    const diffHours = (printTime - uploadTime) / (1000 * 60 * 60);

    if (diffHours <= slaPrintLimitHours * 0.5) {
      printSlaCoef = earlyMaxRate; // In siêu nhanh (< 50% thời hạn)
    } else if (diffHours <= slaPrintLimitHours * 0.75) {
      printSlaCoef = earlyMidRate;
    } else if (diffHours <= slaPrintLimitHours) {
      printSlaCoef = onTimeRate; // Đúng SLA (+0%)
    } else if (diffHours <= slaPrintLimitHours * 1.5) {
      printSlaCoef = lateMinRate; // Trễ nhẹ
    } else if (diffHours <= slaPrintLimitHours * 2) {
      printSlaCoef = lateMidRate;
    } else {
      printSlaCoef = lateMaxRate;
    }
  } else if (contract.printed_at) {
    printSlaCoef = onTimeRate;
  }

  // 2. Courier SLA Coef (Viettel Post)
  let courierSlaCoef = onTimeRate;
  if (contract.waybill_created_at || contract.picked_up_at) {
    if (contract.printed_at && contract.waybill_created_at) {
      const waybillTime = new Date(contract.waybill_created_at).getTime();
      const printTime = new Date(contract.printed_at).getTime();
      const diffHours = (waybillTime - printTime) / (1000 * 60 * 60);

      if (diffHours <= slaCourierLimitHours * 0.5) {
        courierSlaCoef = earlyMaxRate;
      } else if (diffHours <= slaCourierLimitHours) {
        courierSlaCoef = earlyMinRate;
      } else {
        courierSlaCoef = lateMinRate;
      }
    } else {
      courierSlaCoef = earlyMinRate;
    }
  }

  // 3. Retrieval SLA Coef (Thu hồi & Lưu kho)
  let retrievalSlaCoef = onTimeRate;
  if (contract.received_back_at || contract.archived_at || contract.status === 'Hoàn tất') {
    if (contract.delivered_at && contract.received_back_at) {
      const recTime = new Date(contract.received_back_at).getTime();
      const delTime = new Date(contract.delivered_at).getTime();
      const diffDays = (recTime - delTime) / (1000 * 60 * 60 * 24);

      if (diffDays <= slaRetrievalLimitDays * 0.5) {
        retrievalSlaCoef = earlyMaxRate;
      } else if (diffDays <= slaRetrievalLimitDays) {
        retrievalSlaCoef = earlyMinRate;
      } else {
        retrievalSlaCoef = lateMinRate;
      }
    } else {
      retrievalSlaCoef = earlyMinRate;
    }
  }

  // 4. Quality / Incident / Feedback Coef
  let incidentCount = contract.feedback_count || 0;
  if (contract.status === 'Sự cố vận chuyển' || contract.status === 'Bị từ chối ký') {
    incidentCount += 1;
  }

  let accuracyCoef = fb0Rate;
  if (incidentCount === 0) {
    accuracyCoef = fb0Rate;
  } else if (incidentCount === 1) {
    accuracyCoef = fb1Rate;
  } else if (incidentCount === 2) {
    accuracyCoef = fb2Rate;
  } else {
    accuracyCoef = fb3Rate;
  }

  const totalCoef = 1 + printSlaCoef + courierSlaCoef + retrievalSlaCoef + accuracyCoef;
  const finalPayroll = Math.round(basePay * Math.max(0, totalCoef));

  const formulaString = `${basePay.toLocaleString('vi-VN')} VNĐ × (1 + ${printSlaCoef >= 0 ? '+' : ''}${printSlaCoef} [In SLA] + ${courierSlaCoef >= 0 ? '+' : ''}${courierSlaCoef} [VTP SLA] + ${retrievalSlaCoef >= 0 ? '+' : ''}${retrievalSlaCoef} [Kho SLA] + ${accuracyCoef >= 0 ? '+' : ''}${accuracyCoef} [Sự cố/FB]) = ${finalPayroll.toLocaleString('vi-VN')} VNĐ`;

  return {
    basePay,
    printSlaCoef,
    courierSlaCoef,
    retrievalSlaCoef,
    accuracyCoef,
    totalCoef,
    finalPayroll,
    formulaString
  };
}
