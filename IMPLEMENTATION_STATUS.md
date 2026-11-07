# IMPLEMENTATION_STATUS.md - Bảng Theo Dõi Tiến Độ & Báo Cáo Systematic Debug & Fix

Tài liệu theo dõi trạng thái triển khai tuần tự theo kế hoạch chi tiết tại `PLAN.md` và nhật ký kiểm thử toàn diện 5 giai đoạn (Phases 1-5).

---

## 1. Trạng Thái Hiện Tại (Post Systematic Debug & Fix Verification)

- **Trạng thái tổng thể**: **READY & VERIFIED (Tất cả 5 Phase hoàn thành 100%)**
- **Kết quả nghiệm thu kiểm thử (Verification Gates)**:
  - **TypeScript Typecheck (`npm run lint`)**: PASS (0 lỗi trên cả `tsconfig.json` và `tsconfig.server.json`).
  - **Unit Tests (`npm run test:unit`)**: **12/12 test files PASS, 59/59 tests PASS** (1.07s).
  - **Integration Tests (`npm run test:integration`)**: **33/33 test files PASS, 70/70 tests PASS** (26.65s trên PostgreSQL).
  - **Production Build (`npm run build`)**: PASS (Vite compile frontend `dist/`, esbuild bundle backend `dist-server/server.js`).
  - **Playwright End-to-End Tests (`npx playwright test`)**: **6/6 tests PASS** (100% trên cả Desktop Chrome và Mobile Pixel 7).

---

## 2. Báo Cáo Chi Tiết: Các Lỗi Tìm Thấy, Nguyên Nhân Gốc Rễ & Cách Khắc Phục

### Lỗi 1: Phân tách kiến trúc máy chủ (`server.ts` cũ vs `server/app.ts` mới)
- **Triệu chứng**: Chạy `npm run dev` khởi chạy file monolith `server.ts` 2643 dòng dựa trên file JSON `data/database.json`, không kết nối PostgreSQL và thiếu toàn bộ các route bảo mật/transaction mới.
- **Nguyên nhân gốc rễ (Root Cause)**: File `server.ts` cũ được giữ từ prototype ban đầu, trong khi kiến trúc mới đã được phân tầng tại `server/app.ts` nhưng chưa có bootstrap script kết nối hai bên.
- **Cách khắc phục**:
  - Tái cấu trúc hoàn toàn `server.ts`: trở thành bootstrap entrypoint chuẩn mực.
  - Sử dụng `createApp()` từ `server/app.ts`, nạp cấu hình tập trung từ `server/config.ts`.
  - Kết nối pool PostgreSQL thực tế qua `server/db/client.ts`.
  - Tích hợp Vite HMR middleware ở chế độ development (`NODE_ENV !== 'production'`) và phục vụ file tĩnh `dist/` ở chế độ production (`NODE_ENV === 'production'`).
  - Xử lý đóng kết nối database graceful khi nhận tín hiệu `SIGINT` / `SIGTERM`.

### Lỗi 2: Thiếu Route Settings và Simulator trong Router mới
- **Triệu chứng**: Giao diện Admin Settings và Simulators không thể lấy hoặc lưu cấu hình khi gọi `/api/settings`, `/api/sim/vtp-webhook`.
- **Nguyên nhân gốc rễ (Root Cause)**: `server/modules/settings/service.ts` đã có nhưng chưa xây dựng router Express; `server/modules/integrations/vtp.ts` đã có hàm xử lý webhook nhưng chưa có endpoint tiếp nhận.
- **Cách khắc phục**:
  - Tạo `server/modules/settings/routes.ts` xử lý `GET /api/settings`, `POST /api/settings`, `PUT /api/settings` (kiểm tra quyền Admin và optimistic lock version) và `POST /api/settings/toggle-vtp`.
  - Tạo `server/modules/integrations/routes.ts` xử lý `POST /api/sim/vtp-webhook` (dùng `processVtpWebhookEvent`), `POST /api/sim/run-sla-check` và `GET /api/sim/logs`.
  - Mount đầy đủ `settingsRouter`, `reportsRouter` và `integrationsRouter` vào `server/app.ts`.

### Lỗi 3: Trùng lặp Identifier 'logout' và lỗi xác thực Client Header
- **Triệu chứng**: Lỗi biên dịch `TS2300 Duplicate identifier 'logout'` trong `src/services/api.ts` và lỗi HTTP 401 khi tạo task soạn thảo từ modal.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Có 2 hàm `logout()` cùng tên trong `apiService`.
  - Middleware phía server yêu cầu role admin (`requireRole(['admin'])`) kiểm tra thông tin phiên hoặc header `x-user-role`, nhưng client `request()` không tự động đính kèm thông tin user đã đăng nhập.
- **Cách khắc phục**:
  - Gộp thành 1 hàm `logout()` duy nhất trong `apiService`, gọi API POST `/api/auth/logout`, xóa sạch `currentUser` trong `localStorage` và xóa `cachedCsrfToken`.
  - Bổ sung cơ chế tự động đọc `currentUser` trong `request()` của `src/services/api.ts` để luôn gửi kèm `x-user-role` và `x-user-email` cùng `credentials: 'include'`.
  - Tự động lấy và gửi `x-csrf-token` cho toàn bộ các request thay đổi dữ liệu (POST, PUT, PATCH, DELETE) và request upload `multipart/form-data`.

### Lỗi 4: Nguy cơ Lỗi Runtime `undefined is not an object` khi render dữ liệu rỗng
- **Triệu chứng**: Khi API contracts hoặc reports đang tải hoặc trả về rỗng, một số màn hình bị crash trắng trang do gọi `.filter()` trên `undefined`.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Trong `ContractTable.tsx`, `ContractScanner.tsx`, `ClerkManualMatcher.tsx`, `LegalPayrollDashboard.tsx`, props `contracts` chưa được ép kiểu mảng an toàn trước khi gọi `.filter()` hoặc `.find()`.
  - Trong `ReportView.tsx`, code truy cập trực tiếp `reports.averages.avgUploadToPrintHours` và `reports.overdueContracts.filter()` trong khi `reports` có thể là `null`.
  - Trong `AdminSettings.tsx`, component crash khi `settings` chưa nạp xong (`null`).
- **Cách khắc phục**:
  - Thêm fallback chuẩn: `const safeContracts = Array.isArray(contracts) ? contracts : [];`.
  - Bảo vệ chuỗi tìm kiếm không bị null: `(c.contractNumber || '').toLowerCase()`.
  - Thêm loading spinner guard trong `AdminSettings.tsx` khi `!settings`.
  - Thêm fallback default metric `'0.0'` và `safeOverdue` trong `ReportView.tsx`.

### Lỗi 5: Môi trường Playwright E2E thiếu browser binary
- **Triệu chứng**: Chạy `npx playwright test` báo lỗi không tìm thấy `@playwright/test` và `chrome-headless-shell.exe`.
- **Nguyên nhân gốc rễ (Root Cause)**: Thư viện `@playwright/test` chưa nằm trong `devDependencies` và máy trạm chưa tải binary `chromium_headless_shell-1254`.
- **Cách khắc phục**:
  - Cài đặt `@playwright/test` vào `devDependencies`.
  - Tải và cài đặt trọn vẹn browser testing: `npx playwright install chromium`.
  - Xác nhận chạy thành công 6/6 tests kịch bản E2E (Baseline smoke test, Form login với authentication thực tế, Phân trang danh sách hợp đồng trên cả giao diện Desktop và Mobile).

---

## 3. Bảng Tổng Hợp Kiểm Thử (Test Execution Summary)

| Loại Kiểm Thử | Lệnh Chạy | Số Lượng Tests | Kết Quả | Thời Gian Thực Hiện |
|---|---|---|---|---|
| **TypeScript Typecheck** | `npm run lint` | Toàn bộ codebase | **PASS (0 errors)** | ~7s |
| **Unit Tests** | `npm run test:unit` | 12 files / 59 tests | **PASS (100%)** | 1.07s |
| **Integration Tests** | `npm run test:integration` | 33 files / 70 tests | **PASS (100%)** | 26.65s |
| **Production Build** | `npm run build` | Frontend + Server | **PASS (100%)** | ~5s |
| **Playwright E2E Tests** | `npx playwright test` | 6 tests (Desktop/Mobile) | **PASS (100%)** | 9.1s |

---

## 4. Danh Mục Nhiệm Vụ Kế Hoạch (T01 - T60 Status)

Toàn bộ các nhiệm vụ nền tảng (Phase 0 đến Phase 7) đã được đối soát kỹ thuật:
- **Phase 0 (T01 - T05)**: Thiết lập cấu trúc, typecheck, domain types và mock baseline -> **done**.
- **Phase 1 (T06 - T14)**: PostgreSQL pool, schema core, settings validation, query contracts và JSON import atomic -> **done**.
- **Phase 2 (T15 - T26)**: Argon2id auth, PostgreSQL session, RBAC middleware, Workflow State Machine 12 trạng thái, Revisions, Digital & Physical transitions -> **done**.
- **Phase 3 (T27 - T33)**: SLA Engine, Payroll calculations, adjustments ledger, payroll snapshots -> **done**.
- **Phase 4 (T34 - T41)**: Range request file storage, Content-Addressable SHA-256 storage, QR security, Clerk camera scanning -> **done**.
- **Phase 5 (T42 - T49)**: Integrations (ViettelPost webhook, Teams notification, Gemini extraction) với graceful fallback -> **done**.
- **Phase 6 (T50 - T54)**: SLA detection scan, SQL reconciliation reports, Outbox worker -> **done**.
- **Phase 7 (T55 - T60)**: Build server production, Playwright E2E suite, release readiness -> **done**.
