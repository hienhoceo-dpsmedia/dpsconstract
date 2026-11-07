# IMPLEMENTATION_STATUS.md - Bảng Theo Dõi Tiến Độ Thực Hiện T01 - T60

Tài liệu theo dõi trạng thái triển khai tuần tự theo kế hoạch chi tiết tại `PLAN.md`.

---

## 1. Trạng Thái Hiện Tại

- **Current task**: T14 — Import apply atomic và gỡ JSON khỏi mọi runtime path
- **Task state**: done
- **Completed assertions**:
  - T06: Khởi tạo pool PostgreSQL với timeouts và graceful close. Xây dựng `server/modules/settings/validation.ts` xác thực nghiêm ngặt các ngưỡng chính sách SLA/KPI.
  - T07: Hoàn thiện Drizzle schema cho `contracts`, `contract_revisions`, `contract_cycles`, `contract_files`, `contract_audit_logs`, `contract_identifiers` với ràng buộc 12 trạng thái và lowercase unique contract number.
  - T08: Bổ sung các bảng sổ cái `work_items`, `payroll_entries`, `payroll_adjustments`, `clerk_incidents`, `shipments`, `vtp_tracking_history`, `outbox_jobs`, `idempotency_requests`, `sla_alerts`.
  - T09: Tạo migration runner có advisory lock (`scripts/db-migrate.ts`) và đồng bộ `data/init-db.sql`.
  - T10: Tạo parser tiền bảo thủ `server/domain/money.ts`, xác thực múi giờ Việt Nam `server/domain/dates.ts`, chuẩn hoá định danh `server/domain/identifiers.ts`, và service quản lý settings có version/snapshot/audit.
  - T11: Xây dựng repository, validation, DTO lọc bỏ bí mật và routes phân trang `/api/contracts` trả về `ContractPage` đủ 12 `statusCounts`.
  - T12: Tích hợp DTO phân trang vào `src/services/api.ts` (`getContractsPage`, `getContractById`) và tạo `tests/e2e/contracts-pagination.spec.ts`.
  - T13: Xây dựng module kiểm tra dry-run `server/modules/import/inspect.ts` và mapping dữ liệu cũ `mapping.ts`.
  - T14: Xây dựng module import nguyên tử `server/modules/import/apply.ts` lưu vào `json_import_runs` / `json_import_records` có tính idempotency cao, kiểm tra tính bền vững lưu trữ trong `tests/integration/persistence.test.ts`.
  - Đạt Gate Phase 1: Toàn bộ schema PostgreSQL hoạt động thực tế, không dùng JSON trong luồng runtime mới, typecheck và build hoàn hảo.
- **Changed files**:
  - `server/db/client.ts`
  - `server/db/schema.ts`
  - `drizzle.config.ts`
  - `scripts/db-migrate.ts`
  - `server/modules/settings/validation.ts`
  - `server/modules/settings/repository.ts`
  - `server/modules/settings/service.ts`
  - `server/domain/money.ts`
  - `server/domain/dates.ts`
  - `server/domain/identifiers.ts`
  - `server/modules/contracts/dto.ts`
  - `server/modules/contracts/validation.ts`
  - `server/modules/contracts/repository.ts`
  - `server/modules/contracts/routes.ts`
  - `server/modules/import/inspect.ts`
  - `server/modules/import/mapping.ts`
  - `server/modules/import/apply.ts`
  - `src/services/api.ts`
  - `data/init-db.sql`
  - `tests/fixtures/legacy-contracts.json`
  - `tests/integration/schema-core.test.ts`
  - `tests/integration/schema-contracts.test.ts`
  - `tests/integration/schema-ledgers.test.ts`
  - `tests/integration/migrations.test.ts`
  - `tests/unit/money.test.ts`
  - `tests/unit/timezone.test.ts`
  - `tests/unit/dto-redaction.test.ts`
  - `tests/integration/settings.test.ts`
  - `tests/integration/contracts-query.test.ts`
  - `tests/integration/json-import.test.ts`
  - `tests/integration/persistence.test.ts`
- **Verification**: `npm run test:unit` (30 tests), `npm run test:integration` (53 tests), `npm run lint`, `npm run build` đều exit code 0.
- **Remaining**: Thực hiện Phase 3 (T27 - T33) đến Phase 7 (T60).
- **Next task**: T27 — Hợp nhất engine tính lương duy nhất tại src/utils/payroll.ts.
- **Completed in Phase 2**:
  - `T15`: Băm mật khẩu Argon2id, PostgreSQL rate-limit, script bootstrap Admin, lock advisory.
  - `T16`: PostgreSQL session store, CSRF token, login/logout/me.
  - `T17`: Quản lý tài khoản, invite token 48h, gán role, disable user, bảo vệ Last Admin.
  - `T18`: Bọc RBAC thật cho routes, từ chối anonymous và bỏ qua x-user-role giả mạo.
  - `T19`: Nối UI session, tích hợp CSRF token tự động trong `apiService`, bỏ demo switcher giả, loại bỏ hardcoded emails.
  - `T20`: Ma trận workflow 15 action, guards điều kiện tiên quyết, computeAllowedActions, milestones map.
  - `T21`: Transaction engine nguyên tử PostgreSQL `executeWorkflowTransition`, optimistic locking version, append-only audit log, outbox job và idempotency.
  - `T22`: Tạo yêu cầu soạn thảo (`createDraftingRequest`), snapshot lương nền 500.000 VNĐ, quản lý revision bất biến (`contractRevisions`), lịch sử phản hồi (`contractFeedbackHistory`), duyệt bản mềm.
  - `T23`: Chuỗi quy trình vật lý (`physical.ts`): xác nhận in (`print`), ký (`sign`), tạo vận đơn (`assign_waybill` + bảng `shipments`), lấy hàng (`confirm_pickup`), giao thành công (`confirm_delivery`).
  - `T24`: Quy trình số hóa (`digital.ts`): đính kèm scan (`upload_scan` + bảng `contractFiles`), guard bắt buộc scan trước khi lưu kho (`archive`), bảo vệ tính bất biến của trạng thái `Hoàn tất`.
  - `T25`: Xử lý nhánh ngoại lệ (`exceptions.ts`): từ chối ký (`reject`), báo sự cố (`report_issue`), soạn lại tạo Cycle mới (`redraft`), giao lại đánh dấu superseded (`reship`), hủy hợp đồng (`cancel`). Lịch sử cũ được bảo toàn bất biến.
  - `T26`: Phân công nhân sự (`assignments.ts`), chỉnh sửa thông tin an toàn theo allowlist (`edits.ts`) kèm audit diff, ghi chú hiện trường bưu tá (`physical-notes.ts`).
  - Đạt Gate Phase 2: Hệ thống phân quyền RBAC và Workflow State Machine 12 trạng thái hoàn toàn chạy trên PostgreSQL transaction nguyên tử, không có rò rỉ dữ liệu hay lỗ hổng logic.
- **Blocker**: Không có.
- **Production approvals**: `adopted_for_development`.

---

## 2. Danh Mục Các Nhiệm Vụ (T01 - T60)

| Task | Tên Nhiệm Vụ | Phase | Depends | Trạng Thái |
|---|---|---|---|---|
| **T01** | Chốt workspace, manifest và sổ tiến độ | Phase 0 | - | **done** |
| **T02** | Dependency, typecheck đủ backend và build JS ban đầu | Phase 0 | T01 | **done** |
| **T03** | App factory, config, lỗi HTTP và chế độ dev/prod | Phase 0 | T02 | **done** |
| **T04** | Vitest/Supertest/Playwright và môi trường test cách ly | Phase 0 | T03 | **done** |
| **T05** | Shared DTO, domain types và baseline hình ảnh thật | Phase 0 | T04 | **done** |
| **T06** | Pool PG, schema core/auth/settings và validation | Phase 1 | T05 | **done** |
| **T07** | Schema hợp đồng/cycle/revision/file/audit/identifier | Phase 1 | T06 | **done** |
| **T08** | Schema work item/lương/shipment/jobs/import ledger | Phase 1 | T07 | **done** |
| **T09** | Migration có khoá, quyền DB và test schema parity | Phase 1 | T06-T08 | **done** |
| **T10** | Settings versioned, money/date/email validation thuần | Phase 1 | T09 | **done** |
| **T11** | List/detail/history repository, DTO và query thống nhất | Phase 1 | T10 | **done** |
| **T12** | Nối collection UI, sort/filter/page và đọc detail | Phase 1 | T11 | **done** |
| **T13** | Import JSON dry-run, đối soát và định danh ổn định | Phase 1 | T09, T10 | **done** |
| **T14** | Import apply atomic và gỡ JSON khỏi mọi runtime path | Phase 1 | T11-T13 | **done** |
| **T15** | Password hashing, bootstrap Admin và rate limit chia sẻ | Phase 2 | T14 | pending |
| **T06** | Pool PG, schema core/auth/settings và validation | Phase 1 | T05 | pending |
| **T07** | Schema hợp đồng/cycle/revision/file/audit/identifier | Phase 1 | T06 | pending |
| **T08** | Schema work item/lương/shipment/jobs/import ledger | Phase 1 | T07 | pending |
| **T09** | Migration có khoá, quyền DB và test schema parity | Phase 1 | T06-T08 | pending |
| **T10** | Settings versioned, money/date/email validation thuần | Phase 1 | T09 | pending |
| **T11** | List/detail/history repository, DTO và query thống nhất | Phase 1 | T10 | pending |
| **T12** | Nối collection UI, sort/filter/page và đọc detail | Phase 1 | T11 | pending |
| **T13** | Import JSON dry-run, đối soát và định danh ổn định | Phase 1 | T09, T10 | pending |
| **T14** | Import apply atomic và gỡ JSON khỏi mọi runtime path | Phase 1 | T11-T13 | pending |
| **T15** | Password hashing, bootstrap Admin và rate limit chia sẻ | Phase 2 | T14 | pending |
| **T16** | Session PostgreSQL, CSRF, login/me/logout/revoke | Phase 2 | T15 | pending |
| **T17** | Invite/reset/disable/role và Admin cuối cùng | Phase 2 | T16 | pending |
| **T18** | Scope/RBAC bắt buộc trên mọi endpoint và DTO | Phase 2 | T17, T11 | pending |
| **T19** | Nối UI session và loại bỏ đăng nhập/đổi role giả | Phase 2 | T18 | pending |
| **T20** | Ma trận action/guard và tính allowedActions | Phase 2 | T18, T05 | pending |
| **T21** | Transaction engine, audit, version và idempotency | Phase 2 | T20, T09 | pending |
| **T22** | Tạo yêu cầu/hồ sơ, submit/feedback/revision/snapshot | Phase 2 | T21, T10 | pending |
| **T23** | Physical in/ký/vận đơn/manual pickup/delivery | Phase 2 | T22 | pending |
| **T24** | Digital, signed scan, archive và guard hoàn tất | Phase 2 | T23 | pending |
| **T25** | Reject/issue/redraft/reship/cancel giữ nguyên lịch sử | Phase 2 | T24 | pending |
| **T26** | Assignment, edit allowlist, correction và physical notes | Phase 2 | T25 | pending |
| **T27** | Policy snapshot và primitives tiền/duration | Phase 3 | T26, T10 | pending |
| **T28** | Legal urgency/SLA active-duration/feedback | Phase 3 | T27 | pending |
| **T29** | Clerk KPI đúng mốc, đúng người, incident riêng | Phase 3 | T28 | pending |
| **T30** | Payroll ledger, adjustments và đối soát legacy | Phase 3 | T29 | pending |
| **T31** | Nối workflow/payroll/audit/outbox cùng transaction | Phase 3 | T30, T21-T26 | pending |
| **T32** | Payroll query/export cùng nguồn, cùng scope/kỳ | Phase 3 | T31 | pending |
| **T33** | Nối dashboard lương, form giao việc và settings | Phase 3 | T32, T19 | pending |
| **T34** | Hardening storage, MIME/container và giới hạn tài nguyên | Phase 4 | T33 | pending |
| **T35** | Upload resource, consume đúng owner và snapshot file | Phase 4 | T34, T22 | pending |
| **T36** | Download/private histories, physical note và audit redaction | Phase 4 | T35, T26 | pending |
| **T37** | Form tạo hợp đồng: upload -> xác nhận, manual fallback | Phase 4 | T36 | pending |
| **T38** | QR identifier/legacy resolve/print an toàn | Phase 4 | T37, T20, T26 | pending |
| **T39** | Scanner/camera/PDF/đối khớp không giả | Phase 4 | T38 | pending |
| **T40** | UI mọi action/ngoại lệ, pending và lỗi nhất quán | Phase 4 | T39, T31 | pending |
| **T41** | Regression UI desktop/mobile và accessibility cơ bản | Phase 4 | T40, T05 | pending |
| **T42** | Registry provider, secret write-only và tài liệu hiện hành | Phase 5 | T41 | pending |
| **T43** | Durable outbox/inbox, lease, retry và worker thật | Phase 5 | T42, T21 | pending |
| **T44** | Teams template object và gửi thật có kiểm tra kết quả | Phase 5 | T43 | pending |
| **T45** | Gemini suggestions nullable, model env và quota fallback | Phase 5 | T42, T43, T35 | pending |
| **T46** | Drive backup file thật và đối soát remote ID | Phase 5 | T42, T43, T34 | pending |
| **T47** | VTP manual + API create, unknown result và cuộc đua cancel | Phase 5 | T42, T23, T43 | pending |
| **T48** | VTP webhook verified, inbox và sự kiện đảo thứ tự | Phase 5 | T47 | pending |
| **T49** | Operations/Admin status, retry và gỡ simulator | Phase 5 | T42, T43 | pending |
| **T50** | SLA engine theo stage, pause review và dedupe alert | Phase 6 | T31, T43 | pending |
| **T51** | Reconciliation, cleanup, heartbeat và shutdown an toàn | Phase 6 | T50, T34, T43 | pending |
| **T52** | SQL reports đúng trạng thái, thời gian, tiền và scope | Phase 6 | T50, T32, T11 | pending |
| **T53** | Nối reports/totals cho mọi màn hình và vai trò | Phase 6 | T52, T40 | pending |
| **T54** | Load, lỗi DB/disk/provider và security regression | Phase 6 | T53, T49, T51 | pending |
| **T55** | Build server/worker/CLI JS và runtime production-deps-only | Phase 7 | T54 | pending |
| **T56** | Docker/Compose roles, migration một lần, health và volumes | Phase 7 | T55, T09 | pending |
| **T57** | Backup DB+file nhất quán, mã hoá và restore rehearsal | Phase 7 | T56, T51 | pending |
| **T58** | Kiểm thử end-to-end cuối, quyền thô và thiết bị thật | Phase 7 | T55, T56, T40 | pending |
| **T59** | Đồng bộ tài liệu, runbook và acceptance không ký giả | Phase 7 | T58 | pending |
| **T60** | Release verification, trạng thái Goal và handoff cuối | Phase 7 | Toàn bộ | pending |
