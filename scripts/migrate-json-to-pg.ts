/**
 * =============================================================================
 * SCRIPT DI CHUYỂN DỮ LIỆU TỰ ĐỘNG (DATABASE.JSON -> POSTGRESQL)
 * Hệ thống Quản lý Hợp đồng Nội bộ & Tính Lương SLA/KPI
 * =============================================================================
 * Cách sử dụng:
 * 1. Đảm bảo PostgreSQL đang chạy (ví dụ: docker compose up -d postgres)
 * 2. Thiết lập biến môi trường DATABASE_URL trong file .env
 * 3. Chạy lệnh: npx tsx scripts/migrate-json-to-pg.ts
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Đọc file database.json hiện tại
const DB_FILE = path.resolve('data/database.json');
const LOGS_FILE = path.resolve('data/logs.json');

interface MigrationStats {
  settings: number;
  users: number;
  contracts: number;
  files: number;
  auditLogs: number;
  feedbacks: number;
  vtpHistory: number;
  simLogs: number;
}

async function runMigration() {
  console.log('🚀 Bắt đầu quá trình di chuyển dữ liệu sang PostgreSQL...');

  if (!fs.existsSync(DB_FILE)) {
    console.error(`❌ Không tìm thấy file dữ liệu: ${DB_FILE}`);
    process.exit(1);
  }

  const rawJson = fs.readFileSync(DB_FILE, 'utf-8');
  const dbData = JSON.parse(rawJson);

  let logsData: any[] = [];
  if (fs.existsSync(LOGS_FILE)) {
    try {
      logsData = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
    } catch (e) {
      logsData = [];
    }
  }

  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres_secret_password@localhost:5432/contracts_db?sslmode=disable';
  console.log(`📡 Chuỗi kết nối Database: ${databaseUrl.replace(/:[^:]*@/, ':****@')}`);

  // Tùy chọn sử dụng thư viện pg (nếu được cài đặt) hoặc xuất file SQL Insert hoàn chỉnh
  let pgClient: any = null;
  try {
    const { Client } = await import('pg');
    pgClient = new Client({ connectionString: databaseUrl });
    await pgClient.connect();
    console.log('✅ Đã kết nối thành công tới máy chủ PostgreSQL!');
  } catch (err: any) {
    console.warn('⚠️ Gói "pg" chưa được cài đặt trong node_modules hoặc PostgreSQL chưa chạy.');
    console.warn('👉 Hệ thống sẽ tạo file SQL di trú hoàn chỉnh: data/migrated-data.sql');
  }

  const stats: MigrationStats = {
    settings: 0,
    users: 0,
    contracts: 0,
    files: 0,
    auditLogs: 0,
    feedbacks: 0,
    vtpHistory: 0,
    simLogs: 0
  };

  const sqlStatements: string[] = [];
  sqlStatements.push('-- TỰ ĐỘNG SINH TỪ SCRIPTS/MIGRATE-JSON-TO-PG.TS');
  sqlStatements.push('BEGIN;');

  // 1. DI CHUYỂN SETTINGS
  const s = dbData.settings || {};
  const settingsQuery = `
    INSERT INTO settings (
      id, sla_internal_hours, sla_viettel_post_days, 
      default_base_pay_legal, default_base_pay_clerk,
      sla_printing_hours, sla_courier_hours, sla_retrieval_days,
      sla_early_max_rate, sla_early_mid_rate, sla_early_min_rate, sla_on_time_rate,
      sla_late_min_rate, sla_late_mid_rate, sla_late_max_rate,
      sla_early_max_time_pct, sla_early_mid_time_pct, sla_early_min_time_pct,
      sla_late_min_hours, sla_late_mid_hours,
      feedback_0_rate, feedback_1_rate, feedback_2_rate, feedback_3_rate,
      teams_webhook_url, teams_payload_template,
      ai_extract_endpoint, ai_extract_payload_template,
      google_drive_folder_id, vtp_connection_status
    ) VALUES (
      'global_default',
      ${s.slaInternalHours ?? 2}, ${s.slaViettelPostDays ?? 3},
      ${s.defaultBasePayLegal ?? 500000}, ${s.defaultBasePayClerk ?? 100000},
      ${s.slaPrintingHours ?? 2}, ${s.slaCourierHours ?? 4}, ${s.slaRetrievalDays ?? 7},
      ${s.slaEarlyMaxRate ?? 30}, ${s.slaEarlyMidRate ?? 20}, ${s.slaEarlyMinRate ?? 10}, ${s.slaOnTimeRate ?? 0},
      ${s.slaLateMinRate ?? -10}, ${s.slaLateMidRate ?? -20}, ${s.slaLateMaxRate ?? -30},
      ${s.slaEarlyMaxTimePct ?? 50}, ${s.slaEarlyMidTimePct ?? 25}, ${s.slaEarlyMinTimePct ?? 5},
      ${s.slaLateMinHours ?? 2}, ${s.slaLateMidHours ?? 6},
      ${s.feedback0Rate ?? 0}, ${s.feedback1Rate ?? -10}, ${s.feedback2Rate ?? -20}, ${s.feedback3Rate ?? -30},
      ${escapeSql(s.teamsWebhookUrl || '')}, ${escapeSql(s.teamsPayloadTemplate || '')},
      ${escapeSql(s.aiExtractEndpoint || '')}, ${escapeSql(s.aiExtractPayloadTemplate || '')},
      ${escapeSql(s.googleDriveFolderId || 'root/contracts_backup_folder')}, ${escapeSql(s.vtpConnectionStatus || 'connected')}
    ) ON CONFLICT (id) DO UPDATE SET
      sla_internal_hours = EXCLUDED.sla_internal_hours,
      default_base_pay_legal = EXCLUDED.default_base_pay_legal,
      default_base_pay_clerk = EXCLUDED.default_base_pay_clerk,
      teams_webhook_url = EXCLUDED.teams_webhook_url;
  `;
  sqlStatements.push(settingsQuery);
  stats.settings++;

  // 2. DI CHUYỂN USERS
  const users = s.users || [];
  for (const u of users) {
    const userQuery = `
      INSERT INTO users (email, role, invited_at)
      VALUES (${escapeSql(u.email)}, ${escapeSql(u.role)}, ${escapeSql(u.invitedAt || new Date().toISOString())})
      ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;
    `;
    sqlStatements.push(userQuery);
    stats.users++;
  }

  // 3. DI CHUYỂN CONTRACTS VÀ CÁC THỰC THỂ QUAN HỆ
  const contracts = dbData.contracts || [];
  for (const c of contracts) {
    const contractQuery = `
      INSERT INTO contracts (
        id, contract_number, name, partner_name, value, sign_date, effective_date,
        status, processing_method, print_copies, requested_by, assigned_to,
        urgency_level, urgency_coef, drafting_instructions, google_docs_link,
        receiver_name, receiver_phone, receiver_address, delivery_notes, waybill_code,
        base_pay, punctual_coef, quality_coef, calculated_payroll, feedback_count, is_punctual,
        requested_at, deadline, draft_submitted_at, soft_approved_at,
        printed_at, signed_at, waybill_created_at, picked_up_at, delivered_at,
        received_back_at, archived_at, uploaded_at, last_activity_at,
        sla_breached, sla_breach_type, physical_notes
      ) VALUES (
        ${escapeSql(c.id)},
        ${escapeSql(c.contractNumber)},
        ${escapeSql(c.name)},
        ${escapeSql(c.partnerName)},
        ${escapeSql(c.value || '0 VND')},
        ${escapeSql(c.signDate || '')},
        ${escapeSql(c.effectiveDate || '')},
        ${escapeSql(c.status || 'Chờ duyệt bản mềm')},
        ${escapeSql(c.processingMethod || 'physical')},
        ${c.printCopies || 2},
        ${escapeSql(c.requested_by || '')},
        ${escapeSql(c.assigned_to || '')},
        ${escapeSql(c.urgency_level || 'normal')},
        ${c.urgency_coef || 0.0},
        ${escapeSql(c.drafting_instructions || '')},
        ${escapeSql(c.googleDocsLink || '')},
        ${escapeSql(c.receiverName || '')},
        ${escapeSql(c.receiverPhone || '')},
        ${escapeSql(c.receiverAddress || '')},
        ${escapeSql(c.deliveryNotes || '')},
        ${escapeSql(c.waybillCode || '')},
        ${c.base_pay || 500000},
        ${c.punctual_coef || 0.0},
        ${c.quality_coef || 0.0},
        ${c.calculated_payroll || 0},
        ${c.feedback_count || 0},
        ${c.is_punctual === true ? 'TRUE' : c.is_punctual === false ? 'FALSE' : 'NULL'},
        ${c.requested_at ? escapeSql(c.requested_at) : 'NULL'},
        ${c.deadline ? escapeSql(c.deadline) : 'NULL'},
        ${c.draft_submitted_at ? escapeSql(c.draft_submitted_at) : 'NULL'},
        ${c.soft_approved_at ? escapeSql(c.soft_approved_at) : 'NULL'},
        ${c.printed_at ? escapeSql(c.printed_at) : 'NULL'},
        ${c.signed_at ? escapeSql(c.signed_at) : 'NULL'},
        ${c.waybill_created_at ? escapeSql(c.waybill_created_at) : 'NULL'},
        ${c.picked_up_at ? escapeSql(c.picked_up_at) : 'NULL'},
        ${c.delivered_at ? escapeSql(c.delivered_at) : 'NULL'},
        ${c.received_back_at ? escapeSql(c.received_back_at) : 'NULL'},
        ${c.archived_at ? escapeSql(c.archived_at) : 'NULL'},
        ${c.uploaded_at ? escapeSql(c.uploaded_at) : 'NOW()'},
        ${c.lastActivityAt ? escapeSql(c.lastActivityAt) : 'NOW()'},
        ${c.slaBreached ? 'TRUE' : 'FALSE'},
        ${c.slaBreachType ? escapeSql(c.slaBreachType) : 'NULL'},
        ${escapeSql(c.physical_notes || '')}
      ) ON CONFLICT (contract_number) DO UPDATE SET
        status = EXCLUDED.status,
        last_activity_at = EXCLUDED.last_activity_at,
        calculated_payroll = EXCLUDED.calculated_payroll;
    `;
    sqlStatements.push(contractQuery);
    stats.contracts++;

    // Tệp đính kèm (Files)
    if (Array.isArray(c.files)) {
      for (const f of c.files) {
        const fileQuery = `
          INSERT INTO contract_files (id, contract_id, name, type, uploaded_by, uploaded_at, size, mime_type, file_path)
          VALUES (
            ${escapeSql(f.id)}, ${escapeSql(c.id)}, ${escapeSql(f.name)}, ${escapeSql(f.type)},
            ${escapeSql(f.uploadedBy)}, ${escapeSql(f.uploadedAt || new Date().toISOString())},
            ${f.size || 0}, ${escapeSql(f.mimeType || 'application/octet-stream')}, ${escapeSql(f.filePath || '')}
          ) ON CONFLICT (id) DO NOTHING;
        `;
        sqlStatements.push(fileQuery);
        stats.files++;
      }
    }

    // Lịch sử Audit Log
    if (Array.isArray(c.auditLog)) {
      for (const a of c.auditLog) {
        const auditQuery = `
          INSERT INTO contract_audit_logs (id, contract_id, from_status, to_status, updated_by, updated_at, note)
          VALUES (
            ${escapeSql(a.id)}, ${escapeSql(c.id)}, ${a.fromStatus ? escapeSql(a.fromStatus) : 'NULL'},
            ${escapeSql(a.toStatus)}, ${escapeSql(a.updatedBy)},
            ${escapeSql(a.updatedAt || new Date().toISOString())}, ${escapeSql(a.note || '')}
          ) ON CONFLICT (id) DO NOTHING;
        `;
        sqlStatements.push(auditQuery);
        stats.auditLogs++;
      }
    }

    // Lịch sử phản hồi Feedback
    if (Array.isArray(c.feedback_history)) {
      for (const fb of c.feedback_history) {
        const fbQuery = `
          INSERT INTO contract_feedback_history (contract_id, by_user, at, note)
          VALUES (${escapeSql(c.id)}, ${escapeSql(fb.by)}, ${escapeSql(fb.at || new Date().toISOString())}, ${escapeSql(fb.note || '')});
        `;
        sqlStatements.push(fbQuery);
        stats.feedbacks++;
      }
    }

    // Lịch sử Viettel Post
    if (Array.isArray(c.vtpStatusHistory)) {
      for (const vtp of c.vtpStatusHistory) {
        const vtpQuery = `
          INSERT INTO vtp_tracking_history (contract_id, status, note, updated_at)
          VALUES (${escapeSql(c.id)}, ${escapeSql(vtp.status)}, ${escapeSql(vtp.note || '')}, ${escapeSql(vtp.updatedAt || new Date().toISOString())});
        `;
        sqlStatements.push(vtpQuery);
        stats.vtpHistory++;
      }
    }
  }

  // 4. DI CHUYỂN SIM LOGS
  for (const log of logsData) {
    const logQuery = `
      INSERT INTO sim_logs (id, type, title, content, timestamp)
      VALUES (${escapeSql(log.id)}, ${escapeSql(log.type)}, ${escapeSql(log.title)}, ${escapeSql(log.content)}, ${escapeSql(log.timestamp)})
      ON CONFLICT (id) DO NOTHING;
    `;
    sqlStatements.push(logQuery);
    stats.simLogs++;
  }

  sqlStatements.push('COMMIT;');

  // Ghi file SQL dự phòng
  const sqlFilePath = path.resolve('data/migrated-data.sql');
  fs.writeFileSync(sqlFilePath, sqlStatements.join('\n'), 'utf-8');
  console.log(`💾 Đã sinh thành công file SQL di trú: ${sqlFilePath}`);

  // Nếu có kết nối trực tiếp, thực thi SQL
  if (pgClient) {
    try {
      console.log('⚡ Đang thực thi nạp dữ liệu trực tiếp vào PostgreSQL...');
      await pgClient.query(sqlStatements.join('\n'));
      console.log('🎉 Nạp dữ liệu vào PostgreSQL hoàn tất 100%!');
      await pgClient.end();
    } catch (err: any) {
      console.error('❌ Lỗi khi thực thi câu lệnh SQL trực tiếp:', err.message);
      if (pgClient) await pgClient.end();
    }
  }

  console.log('--------------------------------------------------');
  console.log('📊 THỐNG KÊ DI CHUYỂN DỮ LIỆU:');
  console.log(`- Cấu hình (Settings): ${stats.settings} bản ghi`);
  console.log(`- Tài khoản (Users): ${stats.users} bản ghi`);
  console.log(`- Hợp đồng (Contracts): ${stats.contracts} bản ghi`);
  console.log(`- Tệp đính kèm (Files): ${stats.files} bản ghi`);
  console.log(`- Vết kiểm toán (Audit Logs): ${stats.auditLogs} bản ghi`);
  console.log(`- Vòng phản hồi (Feedback): ${stats.feedbacks} bản ghi`);
  console.log(`- Lịch sử vận đơn (VTP History): ${stats.vtpHistory} bản ghi`);
  console.log(`- Nhật ký hệ thống (Sim Logs): ${stats.simLogs} bản ghi`);
  console.log('--------------------------------------------------');
}

function escapeSql(str: string): string {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

runMigration().catch((err) => {
  console.error('Lỗi nghiêm trọng trong quá trình migration:', err);
  process.exit(1);
});
