# MANDATORY RULES FOR FLASH MODEL (WINDOWS + DOCKER DESKTOP)
1. BẮT BUỘC gọi tool `sequentialthinking` để lập kế hoạch trước khi sửa bất kỳ file nào.
2. KHÔNG sửa quá 2 file trong 1 lượt. KHÔNG viết lại toàn bộ file dài, chỉ dùng công cụ edit từng đoạn nhỏ.
3. Khi cần kiểm tra PostgreSQL, hãy chạy lệnh trực tiếp qua terminal (ví dụ: `docker compose ps`, hoặc `docker compose exec -T postgres psql -U postgres -d dpsconstract -c "\dt"`), TUYỆT ĐỐI KHÔNG dùng `data/database.json` cho runtime.
4. Sau mỗi lần sửa file, BẮT BUỘC chạy `npm run check:types` và script `npm run test:*` tương ứng trong `package.json` để kiểm chứng.
---

# AGENTS.md - System Context, Coding Guidelines & Architecture Rules

Tài liệu này đóng vai trò là kim chỉ nam cho các AI Coding Agents và kỹ sư phần mềm khi phát triển, bảo trì hoặc mở rộng **Hệ thống Quản lý Hợp đồng Nội bộ & Tính Lương SLA/KPI**.

---

## 1. Tổng Quan Kỹ Thuật (Tech Stack & Architecture)

- **Project Name**: Hệ thống Quản lý Hợp đồng Nội bộ & Tính Lương SLA/KPI
- **Frontend Stack**: React 19, TypeScript, Tailwind CSS v4, Lucide React (Icons), Motion (Animations), html2canvas & jsPDF, jsqr & qrcode.
- **Backend Stack**: Express.js (Node.js 22 LTS), `@google/genai` (Gemini API 2.5 Flash), Multer, Mammoth.
- **Data Persistence**:
  - **Môi trường Prototype / AI Studio Preview**: File-based storage engine tại `/data/database.json`.
  - **Môi trường Production Thực tế**: PostgreSQL 16 kết hợp Drizzle ORM qua Docker Compose (`docker-compose.yml` & `data/init-db.sql`).
- **Server Architecture**: Single App Full-Stack (Express Server bao bọc Vite Middlewares ở chế độ Development và phục vụ thư mục tĩnh `dist/` ở chế độ Production trên cổng 3000).

---

## 2. Các Quy Tắc Nghiệp Vụ Bất Biến (Inviolable Business Rules)

1. **Quy Tắc Đơn Giá Lương Gốc (Base Pay Inviolability)**:
   - `defaultBasePayLegal` (Mặc định: `500.000 VNĐ`) và `defaultBasePayClerk` (Mặc định: `100.000 VNĐ`) được cấu hình tập trung bởi Admin trong `settings`.
   - **Tuyệt đối không** cho phép người dùng tự nhập đơn giá lương tùy tiện trên form tạo yêu cầu. Luôn lấy đơn giá cố định từ cấu hình hệ thống.

2. **Công Thức Tính Lương SLA/KPI Chuẩn**:
   $$\text{Payroll} = \text{BasePay} \times \max\Big(0,\; 1 + \text{UrgencyCoef} + \text{SlaCoef} + \text{QualityCoef}\Big)$$
   - Động cơ tính toán độc lập nằm tại `src/utils/payroll.ts` (cho cả Pháp chế và Văn thư).
   - Tỷ lệ thưởng/phạt và ngưỡng thời gian phải được đọc từ `settings` để đảm bảo tính linh hoạt cho Admin.

3. **Luồng Máy Trạng Thái Hợp Đồng (State Machine Progression)**:
   - Quy trình vật lý: `Chờ soạn thảo` ➔ `Chờ duyệt bản mềm` ➔ `Chờ in` ➔ `Đang chờ ký` ➔ `Chờ tạo vận đơn` ➔ `Chờ shipper đến lấy` ➔ `Đang giao` ➔ `Chờ bản gửi lại` ➔ `Hoàn tất`.
   - Quy trình số hóa (`processingMethod === 'digital'`): Bỏ qua in ấn và bưu điện, chuyển thẳng sang `Chờ bản gửi lại` (đính kèm scan số hóa).
   - Ngoại lệ: `Bị từ chối ký` (Cho phép `redraft` về Chờ duyệt bản mềm), `Sự cố vận chuyển` (Cho phép `reship` về Chờ tạo vận đơn), `Đã hủy`.
   - Mọi thay đổi trạng thái **bắt buộc** phải ghi 1 bản ghi kiểm toán mới vào `auditLog` / `contract_audit_logs`.

4. **Quét Mã Barcode/QR Code**:
   - Nhãn mã QR bưu kiện in trên phong bì hợp đồng chứa `contract.id`.
   - Quét mã QR phải tự động kích hoạt API `/api/contracts/:id/qr-transition` để chuyển tiếp trạng thái tuần tự và ghi log.

---

## 3. Các Lệnh Điều Hành Quan Trọng (Command Reference)

| Câu Lệnh | Mục Đích |
|---|---|
| `npm run dev` | Khởi chạy máy chủ phát triển (Express + Vite HMR) tại `http://localhost:3000` |
| `npm run lint` | Kiểm tra lỗi cú pháp và kiểu dữ liệu TypeScript (`tsc --noEmit`) |
| `npm run build` | Đóng gói sản phẩm frontend vào thư mục `dist/` |
| `npm run start` | Khởi chạy máy chủ production (`node server.ts` phục vụ `dist/`) |
| `npm run migrate:json-to-pg` | Di chuyển toàn bộ dữ liệu từ `database.json` sang PostgreSQL |
| `docker compose up -d --build` | Khởi chạy toàn bộ Production Stack (App + Postgres 16) |

---

## 4. Hướng Dẫn Dành Riêng Cho AI Coding Agents

- **Port & Host**: Máy chủ Express **bắt buộc** luôn lắng nghe tại `PORT 3000` và host `0.0.0.0`.
- **Thư viện Biểu tượng & Hiệu ứng**:
  - Toàn bộ Icon **phải** được import từ `lucide-react`.
  - Hiệu ứng động giao diện **phải** sử dụng `motion/react` hoặc CSS Tailwind v4.
- **Bảo Mật API Key**:
  - `GEMINI_API_KEY` được bảo mật nghiêm ngặt tại server-side (`process.env.GEMINI_API_KEY`). Tuyệt đối không tạo input nhập key trên frontend.
- **Không Dùng Dữ Liệu Ảo (No Mock Data)**:
  - Mọi thao tác tạo, cập nhật, xóa phải ghi nhận thực tế vào cơ sở dữ liệu (`data/database.json` hoặc PostgreSQL) kèm audit log đầy đủ.
- **Đồng Bộ Schema & Migration**:
  - Khi bổ sung trường dữ liệu mới vào `src/types.ts` hoặc `server.ts`, phải đồng thời cập nhật `data/init-db.sql`, `scripts/migrate-json-to-pg.ts`, và `SCHEMA.md`.
