# API.md - RESTful API Specification (Comprehensive Reference)

Tất cả các API được cung cấp bởi máy chủ Express.js chạy mặc định tại cổng `3000` (`http://localhost:3000` hoặc proxy Nginx `/api/*`).

---

## 1. Authentication & User Management

### `POST /api/auth/login`
- **Mục đích**: Đăng nhập bằng Email được mời trong hệ thống.
- **Request Body**:
  ```json
  {
    "email": "tankhoi.agribank@gmail.com"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "user": {
      "email": "tankhoi.agribank@gmail.com",
      "role": "admin",
      "invitedAt": "2026-10-17T08:00:00.000Z"
    }
  }
  ```
- **Response `403 Forbidden`**:
  ```json
  {
    "error": "Email chưa được mời tham gia hệ thống"
  }
  ```

### `POST /api/auth/invite`
- **Quyền yêu cầu**: `admin`
- **Headers**: `x-user-role: admin`
- **Request Body**:
  ```json
  {
    "email": "new.legal@company.com",
    "role": "legal" // 'admin' | 'legal' | 'clerk'
  }
  ```
- **Response `200 OK`**: Danh sách người dùng sau khi thêm/cập nhật.

### `DELETE /api/auth/invite/:email`
- **Quyền yêu cầu**: `admin`
- **Headers**: `x-user-role: admin`
- **Response `200 OK`**: Trả về danh sách người dùng còn lại sau khi hủy lời mời.

---

## 2. Contracts Core Operations

### `GET /api/contracts`
- **Mục đích**: Lấy toàn bộ danh sách hợp đồng kèm lịch sử và file đính kèm.
- **Response `200 OK`**: Mảng các đối tượng `Contract[]`.

### `GET /api/contracts/check-id/:id`
- **Mục đích**: Kiểm tra trùng lặp Mã hợp đồng (`contractNumber`) theo thời gian thực.
- **Response `200 OK`**:
  ```json
  { "exists": false }
  ```

### `GET /api/contracts/:id/files/:fileId`
- **Mục đích**: Tải xuống tệp tin đính kèm an toàn từ máy chủ (`data/contracts/*`).
- **Headers trả về**: `Content-Disposition: attachment; filename="..."`, `Content-Type: ...`

### `POST /api/contracts`
- **Mục đích**: Khởi tạo hợp đồng bằng cách tải file gốc DOCX (kích hoạt AI Gemini trích xuất tự động).
- **Quyền yêu cầu**: `legal`, `admin`
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `file`: Tệp Word `.docx`
  - `uploadedBy`: Email cán bộ tải lên
- **Quy trình ngầm**:
  1. Trích xuất văn bản thô bằng Mammoth.
  2. Gửi văn bản đến Google Gemini 2.5 Flash để nhận diện: Tên HĐ, Đối tác, Giá trị, Ngày ký, Ngày hiệu lực.
  3. Lưu metadata vào cơ sở dữ liệu với trạng thái ban đầu `Chờ duyệt bản mềm`.
  4. Gửi thông báo Webhook MS Teams.

### `POST /api/contracts/manual`
- **Mục đích**: Khởi tạo hợp đồng thủ công (kèm đường dẫn Google Docs & thông tin người nhận).
- **Quyền yêu cầu**: `legal`, `admin`
- **Request Body**:
  ```json
  {
    "name": "Hợp đồng Mua sắm Thiết bị Mạng Core",
    "contractNumber": "HD-2026-NET99",
    "partnerName": "Công ty Viễn thông VNPT",
    "value": "250.000.000 VNĐ",
    "signDate": "2026-10-18",
    "effectiveDate": "2026-10-18",
    "uploadedBy": "legal@test.com",
    "googleDocsLink": "https://docs.google.com/document/d/xyz",
    "receiverName": "Trần Thanh Hải",
    "receiverPhone": "0913987654",
    "receiverAddress": "Tòa nhà FPT, Phố Duy Tân, Cầu Giấy, Hà Nội",
    "deliveryNotes": "Bưu gửi bảo đảm, giao giờ hành chính",
    "processingMethod": "physical", // 'physical' hoặc 'digital'
    "printCopies": 2
  }
  ```
- **Response `200 OK`**: Đối tượng hợp đồng mới tạo.
- **Lưu ý nghiệp vụ**: Nếu chọn `processingMethod = 'digital'`, hợp đồng sẽ tự động bỏ qua khâu in ấn, trình ký và vận đơn để chuyển thẳng sang `Chờ bản gửi lại`.

### `PUT /api/contracts/:id/edit`
- **Mục đích**: Chỉnh sửa thông tin pháp lý của hợp đồng (Tên, Số HĐ, Đối tác, Giá trị, Ngày ký...).
- **Quyền yêu cầu**: `legal`, `admin`
- **Request Body**:
  ```json
  {
    "name": "Tên hợp đồng mới",
    "contractNumber": "HD-2026-EDITED",
    "partnerName": "Đối tác mới",
    "value": "300.000.000 VNĐ",
    "signDate": "2026-10-20",
    "effectiveDate": "2026-10-20",
    "updatedBy": "legal@test.com",
    "note": "Cập nhật theo yêu cầu Ban Giám đốc"
  }
  ```

---

## 3. Legal Drafting & Review Workflow

### `POST /api/contracts/request-draft`
- **Mục đích**: Quản lý / Ban Giám đốc giao việc soạn thảo hợp đồng cho Pháp chế (Legal).
- **Quyền yêu cầu**: `admin`, `legal`
- **Request Body**:
  ```json
  {
    "name": "Soạn thảo Hợp đồng Bảo hiểm Tài sản 2026",
    "contractNumber": "HD-REQ-8891",
    "partnerName": "Tổng Công ty Bảo hiểm Bảo Việt",
    "value": "180.000.000 VNĐ",
    "deadline": "2026-10-20T17:00:00.000Z",
    "basePay": 500000,
    "urgencyLevel": "urgent", // 'normal' | 'priority' | 'urgent' | 'emergency'
    "assignedTo": "legal@test.com",
    "requestedBy": "tankhoi.agribank@gmail.com",
    "draftingInstructions": "Soạn theo mẫu chuẩn, lưu ý điều khoản khấu trừ 5%",
    "googleDocsLink": "https://docs.google.com/document/d/draft-link"
  }
  ```
- **Trạng thái ban đầu**: `Chờ soạn thảo`.

### `POST /api/contracts/:id/submit-draft`
- **Mục đích**: Pháp chế (Legal) nộp bản thảo dự thảo (.docx hoặc Google Docs).
- **Quyền yêu cầu**: `legal`, `admin`
- **Content-Type**: `multipart/form-data` hoặc `application/json`
- **Form/Body Fields**: `googleDocsLink`, `updatedBy`, `file` (tùy chọn).
- **Logic đánh giá**: So sánh thời gian nộp với `deadline`. Nếu $\le$ deadline $\rightarrow$ `is_punctual = true`, `punctual_coef = +0.10` (+10%). Trạng thái chuyển thành `Chờ duyệt bản mềm`.

### `POST /api/contracts/:id/feedback-draft`
- **Mục đích**: Lãnh đạo gửi yêu cầu sửa đổi dự thảo.
- **Quyền yêu cầu**: `admin`
- **Request Body**:
  ```json
  {
    "updatedBy": "tankhoi.agribank@gmail.com",
    "note": "Điều 4 khoản 2 cần quy định rõ mức phạt vi phạm hợp đồng tối đa 8%."
  }
  ```
- **Hệ quả**: Tăng `feedback_count += 1`. Cập nhật hệ số chất lượng `quality_coef` (0-1 lần: +10%, 2 lần: 0%, 3+ lần: -10%). Trạng thái quay về `Chờ soạn thảo`.

### `POST /api/contracts/:id/approve-soft-copy`
- **Mục đích**: Lãnh đạo phê duyệt bản mềm dự thảo.
- **Quyền yêu cầu**: `admin`, `legal`, `clerk`
- **Hệ quả**:
  - Trạng thái chuyển thành `Chờ in`.
  - Tự động chốt lương KPI cho Legal:
    $$\text{Payroll} = \text{BasePay} \times (1 + \text{UrgencyCoef} + \text{PunctualCoef} + \text{QualityCoef})$$
  - Bắn thông báo MS Teams cho Văn thư in ấn.

---

## 4. Office Clerk & Courier Processing

### `POST /api/contracts/:id/print`
- **Mục đích**: Văn thư xác nhận đã in xong bản thảo giấy.
- **Quyền yêu cầu**: `clerk`, `admin`
- **Trạng thái đích**: `Đang chờ ký`.

### `POST /api/contracts/:id/sign`
- **Mục đích**: Văn thư xác nhận Lãnh đạo đã ký tay và đóng dấu đỏ lên bản cứng.
- **Quyền yêu cầu**: `clerk`, `admin`
- **Trạng thái đích**: `Chờ tạo vận đơn`.

### `POST /api/contracts/:id/waybill`
- **Mục đích**: Văn thư đăng ký bưu gửi và gán mã vận đơn Viettel Post.
- **Quyền yêu cầu**: `clerk`, `admin`
- **Request Body**:
  ```json
  {
    "waybillCode": "VTP-2026-998811",
    "updatedBy": "clerk@test.com"
  }
  ```
- **Trạng thái đích**: `Chờ shipper đến lấy`.

### `POST /api/contracts/:id/scan`
- **Mục đích**: Tải lên tệp scan bản hợp đồng đã có chữ ký 2 bên (hoàn tất vòng đời).
- **Quyền yêu cầu**: `clerk`, `admin`
- **Content-Type**: `multipart/form-data`
- **Trạng thái đích**: `Hoàn tất`.

### `POST /api/contracts/:id/archive`
- **Mục đích**: Xác nhận thu hồi lưu kho bản cứng vật lý, khép lại 100% quy trình.
- **Quyền yêu cầu**: `clerk`, `admin`
- **Trạng thái đích**: `Hoàn tất`.

### `POST /api/contracts/:id/qr-transition`
- **Mục đích**: Quét mã QR dán trên bìa hồ sơ để chuyển bước tự động tuần tự.
- **Quyền yêu cầu**: `clerk`, `admin`
- **Luồng chuyển bước**:
  - `Chờ duyệt bản mềm` $\rightarrow$ `Chờ in`
  - `Chờ in` $\rightarrow$ `Đang chờ ký`
  - `Đang chờ ký` $\rightarrow$ `Chờ tạo vận đơn`
  - `Chờ tạo vận đơn` $\rightarrow$ `Chờ shipper đến lấy`
  - `Chờ shipper đến lấy` $\rightarrow$ `Đang giao`
  - `Đang giao` $\rightarrow$ `Chờ bản gửi lại`
  - `Chờ bản gửi lại` $\rightarrow$ `Hoàn tất`

---

## 5. Exceptions & Dispute Handling

### `POST /api/contracts/:id/reject`
- **Mục đích**: Ghi nhận đối tác từ chối ký duyệt và gửi trả lại hồ sơ.
- **Trạng thái đích**: `Bị từ chối ký`.

### `POST /api/contracts/:id/report-issue`
- **Mục đích**: Ghi nhận sự cố vận chuyển bưu tá Viettel Post (mất hàng, rách ướt...).
- **Trạng thái đích**: `Sự cố vận chuyển`.

### `POST /api/contracts/:id/redraft`
- **Mục đích**: Soạn thảo lại hợp đồng sau khi phát sinh sự cố/từ chối. Chuyển về `Chờ duyệt bản mềm`.

### `POST /api/contracts/:id/reship`
- **Mục đích**: In lại bản cứng và chuyển về `Chờ tạo vận đơn` để gửi lại bưu kiện mới.

### `POST /api/contracts/:id/cancel`
- **Mục đích**: Hủy hợp đồng theo chỉ đạo Lãnh đạo. Trạng thái chuyển thành `Đã hủy`.

---

## 6. Webhooks & External Services

### `POST /api/webhooks/vtp`
- **Mục đích**: Endpoint nhận Webhook thời gian thực từ bưu cục Viettel Post.
- **Request Body**:
  ```json
  {
    "waybillCode": "VTP-2026-998811",
    "status": "DELIVERED", // 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED'
    "note": "Bưu tá đã giao tận tay người nhận",
    "location": "Bưu cục Cầu Giấy, Hà Nội"
  }
  ```
- **Xử lý tự động**:
  - `PICKED_UP`: Tự động chuyển hợp đồng sang `Đang giao`.
  - `DELIVERED`: Tự động chuyển hợp đồng sang `Chờ bản gửi lại`.

### `POST /api/settings/toggle-vtp`
- **Mục đích**: Giả lập ngắt kết nối hoặc khôi phục kết nối API Viettel Post để kiểm tra tính năng chịu lỗi hệ thống.

---

## 7. Reporting & SLA Analytics

### `GET /api/dashboard/reports`
- **Mục đích**: Thống kê số lượng hợp đồng theo từng trạng thái, thời gian chu kỳ trung bình (giờ), và danh sách hợp đồng vi phạm SLA.
- **Response `200 OK`**:
  ```json
  {
    "statusCounts": {
      "Chờ in": 2,
      "Đang chờ ký": 1,
      "Đang giao": 3,
      "Hoàn tất": 12
    },
    "averages": {
      "avgUploadToPrintHours": 1.4,
      "avgPrintToSignHours": 2.1,
      "avgTotalCycleHours": 48.5
    },
    "overdueContracts": []
  }
  ```
