# Kế hoạch Rà Soát Toàn Diện & Chuẩn Bị Production Stack (PostgreSQL + Docker Compose)

Tài liệu này vạch ra lộ trình rà soát toàn diện dự án Hệ thống Quản lý Hợp đồng Nội bộ & Tính Lương SLA/KPI, đồng thời nâng cấp toàn bộ hệ thống tài liệu Markdown (`README.md`, `ARCHITECTURE.md`, `API.md`, `SCHEMA.md`, `AGENTS.md`) và bổ sung hướng dẫn triển khai thực tế bằng Docker Compose kèm kịch bản di chuyển dữ liệu từ `database.json` sang PostgreSQL (Drizzle ORM).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Dựa trên phản hồi từ quá trình làm rõ yêu cầu, các quyết định kiến trúc chính cho việc chuyển đổi sang stack thực tế:
> - **Cơ sở dữ liệu Production**: Sử dụng **PostgreSQL** kết hợp **Drizzle ORM** (TypeScript-first, nhẹ, an toàn kiểu dữ liệu và dễ dàng sinh SQL migrations).
> - **Đóng gói & Triển khai**: Cung cấp cấu hình chuẩn **Docker Compose** đóng gói Express Backend, Vite Frontend Build, PostgreSQL 16 với persistent volume và cơ chế healthcheck.
> - **Chuyển đổi dữ liệu (Data Migration)**: Cung cấp tài liệu chi tiết, Drizzle schema chuẩn hóa và script di trú dữ liệu tự động từ file `/data/database.json` sang các bảng PostgreSQL quan hệ (`contracts`, `contract_files`, `audit_logs`, `settings`, `users`, `sim_logs`).
> - **Chuẩn hóa bộ tài liệu**: Nâng cấp toàn bộ 5 file MD hiện có và bổ sung hướng dẫn chạy local/production không thiếu sót bất kỳ biến môi trường hay bước cài đặt nào.

---

## 1. Tổng Quan & Mục Tiêu Kỹ Thuật

- **Mục tiêu**: Người dùng có thể `git clone` hoặc tải toàn bộ mã nguồn về máy tính, kích hoạt môi trường phát triển hoặc triển khai production chỉ với 1-2 câu lệnh (`docker compose up` hoặc `npm run dev` + PostgreSQL), chuyển đổi an toàn toàn bộ dữ liệu lịch sử từ JSON sang SQL.
- **Đối tượng sử dụng**:
  - **Developer / DevOps**: Nắm vững cấu trúc thư mục, luồng API, schema quan hệ, script migration, và biến môi trường.
  - **Doanh nghiệp / Vận hành**: Hiểu rõ SLA/KPI engine, cơ chế bảo mật hợp đồng, tích hợp Viettel Post & MS Teams, và bảo toàn tính toàn vẹn dữ liệu.

---

## 2. Kế Hoạch Cập Nhật Hệ Thống Tài Liệu Kỹ Thuật

Toàn bộ các file tài liệu sẽ được đồng bộ và cập nhật chi tiết:

### 2.1. `README.md` (Hướng dẫn Tổng thể & Khởi chạy)
- Hướng dẫn tổng quan các phân hệ: Vòng đời Hợp đồng, Soạn thảo Legal, Lương SLA/KPI, In ấn & Vận đơn Viettel Post, AI Gemini Trích xuất, và MS Teams.
- Hướng dẫn 2 chế độ chạy:
  1. **Chế độ Prototype / Độc lập hiện tại** (`tsx server.ts` với `data/database.json`).
  2. **Chế độ Production Stack** (Docker Compose + Node.js + PostgreSQL + Nginx reverse proxy).
- Bảng kê đầy đủ tất cả biến môi trường (`.env.example`) và ý nghĩa chi tiết.

### 2.2. `ARCHITECTURE.md` (Kiến trúc Hệ thống & Chuyển đổi Stack)
- Sơ đồ kiến trúc chuyển đổi từ Monolith nguyên khối dùng JSON File Storage sang kiến trúc sản phẩm chuẩn:
  - Frontend: React 19 SPA (Vite, Tailwind v4, Lucide).
  - Backend: Express.js REST API + Middleware xác thực.
  - Database: PostgreSQL (Relational) với Transaction-safe Audit Logs.
  - Services ngoại vi: Google Gemini API 2.5 Flash, Viettel Post Open API v2, MS Teams Incoming Webhook.
- Luồng dữ liệu (Data Flow) chi tiết cho các ca nghiệp vụ: Luồng duyệt draft & tính lương SLA, luồng quét QR in ấn / vận đơn Viettel Post.

### 2.3. `API.md` (Đặc tả RESTful API Toàn diện)
- Rà soát toàn bộ các route đang có trong `server.ts` (hơn 25 endpoints):
  - Nhóm Quản lý Hợp đồng: CRUD, chuyển trạng thái, ghi chú vật lý, hủy/từ chối/báo cáo sự cố.
  - Nhóm Soạn thảo Legal & Đánh giá SLA: Gửi yêu cầu, nộp draft, phản hồi feedback, chốt bảng lương.
  - Nhóm Văn thư & Vận đơn: Xác nhận in, tạo vận đơn VTP, cập nhật webhook trạng thái giao nhận, thu hồi kho.
  - Nhóm AI & Tích hợp: Trích xuất Gemini đa định dạng (PDF/DOCX/Ảnh), Webhook MS Teams test & notify, cấu hình kết nối Viettel Post.
- Đầy đủ HTTP Method, URL, Header, Request Body mẫu, Response Schema và Mã lỗi chuẩn HTTP (200, 400, 404, 500).

### 2.4. `SCHEMA.md` (Mô hình Dữ liệu SQL Chuẩn & Drizzle ORM)
- Chuyển đổi mô hình JSON phẳng thành mô hình quan hệ chuẩn hóa (3NF):
  - Bảng `users`: Danh sách tài khoản, vai trò (admin, legal, clerk), thời gian mời.
  - Bảng `contracts`: Toàn bộ trường lõi, SLA, trạng thái, mã vận đơn, thông tin người nhận, công thức lương KPI.
  - Bảng `contract_files`: Lưu vết các file gốc, file scan, file dự thảo đính kèm.
  - Bảng `audit_logs`: Lịch sử vết thay đổi trạng thái bất biến (Immutable Audit Trail).
  - Bảng `contract_feedback`: Lưu vết từng vòng phản hồi chất lượng draft.
  - Bảng `settings`: Lưu tham số SLA cấu hình động toàn hệ thống.
  - Bảng `sim_logs`: Lưu nhật ký webhook/hệ thống.
- Cung cấp sẵn mã nguồn TypeScript định nghĩa Schema bằng **Drizzle ORM** (`src/db/schema.ts`) và cấu hình kết nối.

### 2.5. `AGENTS.md` & Tài liệu Bổ trợ Migration (`MIGRATION.md` hoặc Script trong docs)
- Cập nhật quy tắc phát triển, các hằng số nghiệp vụ (Base Pay cố định, hệ số khẩn cấp, công thức phạt/thưởng SLA).
- Hướng dẫn từng bước chạy script di chuyển dữ liệu từ `database.json` sang PostgreSQL mà không làm gián đoạn hệ thống.

---

## 3. Kiến Trúc Kỹ Thuật Khi Đóng Gói Thành Real Stack

```
+──────────────────────────────────────────────────────────────────────────+
│                         NGINX REVERSE PROXY                              │
│                    (SSL Termination / Port 80 & 443)                     │
+────────────────────┬─────────────────────────────────┬───────────────────+
                     │ /api/*                          │ /*
                     v                                 v
+──────────────────────────────────────────+    +──────────────────────────+
│             EXPRESS BACKEND              │    │     VITE REACT SPA       │
│  - REST Controllers & Middleware         │    │  - Contract Dashboard    │
│  - SLA Engine (src/utils/payroll.ts)     │    │  - Legal Payroll Matrix  │
│  - AI Service (@google/genai)            │    │  - QR Scanner & Cam      │
│  - Drizzle ORM Data Access Layer         │    │  - Admin SLA Manager     │
+────────────────────┬─────────────────────+    +──────────────────────────+
                     │
     ┌───────────────┼───────────────┬────────────────────────┐
     │               │               │                        │
     v               v               v                        v
+───────────+  +───────────+  +─────────────+          +─────────────+
│PostgreSQL │  │Gemini 2.5 │  │Viettel Post │          │  MS Teams   │
│Database 16│  │Flash API  │  │ OpenAPI v2  │          │   Webhook   │
│(Persistent│  │(Document  │  │  (Tracking  │          │(Notification│
│  Volume)  │  │Extraction)│  │ & Webhook)  │          │  Channels)  │
+───────────+  +───────────+  +─────────────+          +─────────────+
```

---

## 4. Các Bước Thực Hiện Chi Tiết

1. **Rà soát & Kiểm tra Codebase Hiện tại**:
   - Kiểm tra toàn bộ endpoint trong `server.ts`, logic SLA trong `src/utils/payroll.ts`, cấu trúc dữ liệu thực tế trong `data/database.json`.
   - Xác minh mã nguồn sạch, không có lỗi biên dịch với `npm run lint` hoặc `compile_applet`.
2. **Cập nhật & Mở rộng `SCHEMA.md`**:
   - Viết đặc tả Drizzle ORM Schema hoàn chỉnh cho PostgreSQL (bao gồm types, relations, indexes, foreign keys).
   - Kèm theo SQL DDL script tương đương sẵn sàng chạy trên bất kỳ Postgres server nào.
3. **Cập nhật & Mở rộng `API.md`**:
   - Liệt kê chuẩn hóa 100% các endpoint hiện hữu của backend.
4. **Cập nhật & Mở rộng `ARCHITECTURE.md`**:
   - Bổ sung chi tiết luồng nghiệp vụ và mô hình triển khai Docker Compose đa container.
5. **Cập nhật `README.md` & Hướng Dẫn Migration**:
   - Bổ sung file cấu hình mẫu `docker-compose.yml`, `.env.example`, lệnh chạy migrate từ `database.json`.
6. **Cập nhật `AGENTS.md`**:
   - Giữ vững các nguyên tắc kỹ thuật cốt lõi và hướng dẫn mở rộng cho AI/kỹ sư tiếp quản.
7. **Biên dịch & Xác Thực Lại Toàn Bộ Ứng Dụng**:
   - Đảm bảo app hiện tại vẫn hoạt động mượt mà, sẵn sàng để người dùng tải toàn bộ về triển khai.
