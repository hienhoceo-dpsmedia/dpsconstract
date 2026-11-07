# ARCHITECTURE.md - System Architecture & Production Blueprint

Tài liệu này cung cấp cái nhìn toàn diện về kiến trúc hệ thống, quy trình luân chuyển dữ liệu và thiết kế sản phẩm của **Hệ thống Quản lý Hợp đồng Nội bộ & Tính Lương SLA/KPI**, phục vụ đóng gói và vận hành trên môi trường Production thực thụ.

---

## 1. Sơ Đồ Kiến Trúc Hệ Thống (Production Multi-Container Stack)

```
+───────────────────────────────────────────────────────────────────────────────+
│                                 USERS / CLIENTS                               │
│            Web Browser (PC / Laptop)        &       Mobile Barcode Scanner    │
+───────────────────────────────────────┬───────────────────────────────────────+
                                        │ HTTPS (Port 443 / 80)
                                        v
+───────────────────────────────────────────────────────────────────────────────+
│                             NGINX REVERSE PROXY                               │
│  - SSL/TLS Termination (Let's Encrypt Certbot)                                │
│  - Static Asset Caching (Gzip / Brotli)                                       │
│  - Rate Limiting (100 req/min per IP)                                         │
+───────────────────────┬───────────────────────────────┬───────────────────────+
                        │ /*                            │ /api/*
                        v                               v
+───────────────────────────────────────+   +───────────────────────────────────+
│          FRONTEND SERVICE             │   │          BACKEND SERVICE          │
│  - React 19 SPA (Vite Bundled)        │   │  - Node.js 22 + Express REST API  │
│  - Tailwind CSS v4 + Motion           │   │  - SLA/KPI Payroll Engine         │
│  - Camera QR / Barcode Decoder (jsqr) │   │  - Multer File Upload Handler     │
│  - PDF & Print Exporter (jsPDF)       │   │  - Drizzle ORM Data Access Layer  │
+───────────────────────────────────────+   +─┬──────────────┬──────────────┬───+
                                              │              │              │
                    ┌─────────────────────────┘              │              └────────────────────────┐
                    │ SQL Queries                            │ HTTP Requests                         │ Webhooks
                    v                                        v                                       v
+───────────────────────────────────────+   +───────────────────────────────────+   +───────────────────────────────────+
│          POSTGRESQL 16 ENGINE         │   │       GOOGLE GEMINI 2.5 FLASH     │   │      VIETTEL POST OPEN API v2     │
│  - Tables: contracts, users, settings │   │  - Multimodal Contract Extractor  │   │  - Waybill Code Generator         │
│  - Immutable Audit Logs               │   │  - OCR Fallback for Scan PDFs     │   │  - Courier Status Webhook Ingest  │
│  - Persistent Volume (pgdata)         │   +───────────────────────────────────+   +───────────────────────────────────+
+───────────────────────────────────────+                                                            │
                                                                                                     v
                                                                                    +───────────────────────────────────+
                                                                                    │      MICROSOFT TEAMS WEBHOOK      │
                                                                                    │  - Realtime Channel Notifications │
                                                                                    │  - SLA Breach Incident Alerts     │
                                                                                    +───────────────────────────────────+
```

---

## 2. Máy Trạng Thái Hợp Đồng (State Machine Lifecycle)

Hệ thống quản lý hợp đồng thông qua máy trạng thái hữu hạn (FSM) gồm 8 bước tuần tự chính, 1 nhánh rẽ số hóa, và 3 nhánh xử lý ngoại lệ:

```
[Khởi tạo Task / HĐ]
        │
        ├───────────────────────────────────────┐
        │ (Yêu cầu soạn thảo)                   │ (Đã có sẵn file ký số)
        v                                       v
[1. Chờ soạn thảo]                       [Nhánh Số Hóa: Digital]
        │                                       │ (Bỏ qua in ấn & bưu điện)
        v (Legal nộp draft)                     │
[2. Chờ duyệt bản mềm]                          │
        │                                       │
        ├──────────────────┐                    │
        │ (Lãnh đạo duyệt) │ (Feedback sửa)     │
        v                  └─────────────> Quay lại [1]
[3. Chờ in]
        │
        v (Văn thư in xong)
[4. Đang chờ ký]
        │
        v (Sếp ký tay & đóng dấu)
[5. Chờ tạo vận đơn]
        │
        v (Gán mã VTP)
[6. Chờ shipper đến lấy]
        │
        v (Bưu tá gom hàng)
[7. Đang giao]
        │
        v (Phát hàng thành công)
[8. Chờ bản gửi lại] <──────────────────────────┘
        │
        v (Văn thư tải bản scan lên)
[9. HOÀN TẤT LƯU TRỮ SỐ HÓA]
```

### Các Nhánh Xử Lý Ngoại Lệ (Exception Handling):
1. **`Bị từ chối ký`**:
   - Xảy ra khi đối tác nhận được hợp đồng giấy nhưng từ chối ký do sai lệch điều khoản.
   - Thao tác khắc phục: Pháp chế chọn **Soạn thảo lại** (`POST /api/contracts/:id/redraft`) $\rightarrow$ quay lại `Chờ duyệt bản mềm`.
2. **`Sự cố vận chuyển`**:
   - Xảy ra khi bưu phẩm Viettel Post bị thất lạc hoặc hư hỏng.
   - Thao tác khắc phục: Văn thư chọn **Giao lại** (`POST /api/contracts/:id/reship`) $\rightarrow$ quay lại `Chờ tạo vận đơn` để gán mã vận đơn mới.
3. **`Đã hủy`**:
   - Hợp đồng bị hủy theo chỉ đạo của Ban Giám đốc do thay đổi ngân sách hoặc dừng dự án.

---

## 3. Thuật Toán Lõi Tính Lương SLA & KPI

Hệ thống trang bị 2 bộ công thức tính lương độc lập được chuẩn hóa trong `src/utils/payroll.ts`:

### 3.1. Engine Lương Pháp Chế (Legal Specialist Payroll)
$$\text{Lương Thực Nhận} = \text{Đơn Giá Gốc} \times \max\Big(0,\; 1 + K_{\text{khẩn cấp}} + K_{\text{SLA}} + K_{\text{chất lượng}}\Big)$$

- **Đơn giá gốc (`BasePay`)**: Cố định từ cấu hình hệ thống (Mặc định `500.000 VNĐ`). Nghiêm cấm người dùng tự nhập tùy tiện.
- **Hệ số khẩn cấp ($K_{\text{khẩn cấp}}$)**:
  - Khẩn cấp $\le 1$ giờ / ngoài giờ: $+30\%$ (`+0.30`)
  - Gấp $< 3$ giờ trong ngày: $+20\%$ (`+0.20`)
  - Ưu tiên $\ge 3$ giờ trong ngày: $+10\%$ (`+0.10`)
  - Tiêu chuẩn $\ge 24$ giờ: $+0\%$ (`+0.00`)
- **Hệ số đúng hạn SLA ($K_{\text{SLA}}$)**:
  - Nộp sớm nhiều ($\ge 50\%$ thời gian cam kết): $+30\%$
  - Nộp sớm vừa ($\ge 25\%$ thời gian cam kết): $+20\%$
  - Nộp sớm ít ($\ge 5\%$ thời gian cam kết): $+10\%$
  - Đúng hạn cam kết: $+0\%$
  - Trễ hạn ít ($\le 2$ giờ): $-10\%$
  - Trễ hạn vừa ($\le 6$ giờ): $-20\%$
  - Trễ hạn nhiều ($> 6$ giờ): $-30\%$
- **Hệ số chất lượng bản thảo ($K_{\text{chất lượng}}$)**:
  - 0 lần feedback (Duyệt ngay lần đầu): $+0\%$
  - 1 lần feedback (Chỉnh sửa nhỏ): $-10\%$
  - 2 lần feedback: $-20\%$
  - 3+ lần feedback: $-30\%$

### 3.2. Engine Lương Văn Thư (Office Clerk Payroll)
$$\text{Lương Văn Thư} = \text{Đơn Giá Gốc} \times \max\Big(0,\; 1 + K_{\text{In}} + K_{\text{Vận Đơn}} + K_{\text{Lưu Kho}} + K_{\text{Sự Cố}}\Big)$$

- **Đơn giá gốc**: Mặc định `100.000 VNĐ`.
- **$K_{\text{In}}$ (In ấn)**: Tiêu chuẩn $\le 2$ giờ. Hoàn thành $\le 1$ giờ: $+30\%$. Quá hạn: $-10\%$ đến $-30\%$.
- **$K_{\text{Vận Đơn}}$ (Bàn giao VTP)**: Tiêu chuẩn $\le 4$ giờ. Hoàn thành $\le 2$ giờ: $+30\%$.
- **$K_{\text{Lưu Kho}}$ (Thu hồi)**: Tiêu chuẩn $\le 7$ ngày kể từ ngày khách nhận. Hoàn thành $\le 3$ ngày: $+30\%$.

---

## 4. Đặc Tả Tích Hợp Các Dịch Vụ Thực Tế

### 4.1. Tích hợp Viettel Post Open API v2
- **Tạo đơn hàng vận chuyển**:
  - Endpoint: `POST https://partner.viettelpost.vn/v2/order/create`
  - Headers: `Token: <VTP_APP_TOKEN>`
  - Payload gửi đi: Thông tin bưu cục gửi, thông tin người nhận (`receiverName`, `receiverPhone`, `receiverAddress`), trọng lượng giấy tờ (200g).
- **Cấu hình Webhook Callback**:
  - Viettel Post gửi thông báo trạng thái về: `POST https://yourdomain.com/api/webhooks/vtp`.

### 4.2. Tích hợp Trí tuệ Nhân tạo Google Gemini 2.5 Flash
- Sử dụng SDK chính thức `@google/genai`.
- Đầu vào: Đọc file Word `.docx` bằng thư viện `mammoth`, hoặc truyền file PDF/Ảnh scan qua định dạng Base64 đa phương thức (Multimodal).
- Cấu hình: `responseMimeType: 'application/json'` với cấu trúc schema bắt buộc để đảm bảo 100% dữ liệu trả về chuẩn kiểu.

### 4.3. Tích hợp Microsoft Teams Webhook
- Hỗ trợ định dạng MessageCard chuẩn của Microsoft:
  ```json
  {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    "themeColor": "0076D7",
    "summary": "Thông báo hợp đồng",
    "sections": [{
      "activityTitle": "Hợp đồng mới được tải lên",
      "activitySubtitle": "Mã: HD-2026-NET01",
      "text": "Nội dung chi tiết thông báo..."
    }]
  }
  ```
