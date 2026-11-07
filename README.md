# Hệ thống Quản lý Hợp đồng Nội bộ & Tính Lương SLA/KPI

[![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22_LTS-339933?logo=nodedotjs&logoColor=white)](package.json)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](src/App.tsx)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](data/init-db.sql)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](src/index.css)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini-2.5_Flash-8E75C2?logo=google&logoColor=white)](server.ts)

Hệ thống số hóa quy trình quản lý hợp đồng nội bộ toàn diện cho doanh nghiệp: quản trị trọn vẹn vòng đời hợp đồng, quản lý yêu cầu soạn thảo Legal, in ấn & vận đơn Viettel Post, camera quét mã Barcode/QR Code, tự động tính toán lương thưởng KPI theo SLA minh bạch, và trích xuất dữ liệu bằng AI Google Gemini 2.5 Flash.

---

## 📌 Mục Lục

1. [Tính Năng Nổi Bật](#-tính-năng-nổi-bật)
2. [Bộ Tài Liệu Kỹ Thuật Đầy Đủ](#-bộ-tài-liệu-kỹ-thuật-đầy-đủ)
3. [Cấu Trúc Thư Mục Dự Án](#-cấu-trúc-thư-mục-dự-án)
4. [Hướng Dẫn Khởi Chạy Local (Development)](#-hướng-dẫn-khởi-chạy-local-development)
5. [Hướng Dẫn Triển Khai Production Bằng Docker Compose](#-hướng-dẫn-triển-khai-production-bằng-docker-compose)
6. [Hướng Dẫn Di Chuyển Dữ Liệu (JSON ➔ PostgreSQL)](#-hướng-dẫn-di-chuyển-dữ-liệu-json--postgresql)
7. [Triển Khai Độc Lập Trên Ubuntu VPS (PM2 & Nginx)](#-triển-khai-độc-lập-trên-ubuntu-vps-pm2--nginx)
8. [Bảng Cấu Hình Biến Môi Trường (`.env`)](#-bảng-cấu-hình-biến-môi-trường-env)

---

## 🚀 Tính Năng Nổi Bật

### 1. Quản lý Vòng Đời Hợp Đồng (Contract Lifecycle Management)
- Theo dõi 8+ trạng thái hợp đồng: `Chờ soạn thảo` ➔ `Chờ duyệt bản mềm` ➔ `Chờ in` ➔ `Đang chờ ký` ➔ `Chờ tạo vận đơn` ➔ `Chờ shipper đến lấy` ➔ `Đang giao` ➔ `Chờ bản gửi lại` ➔ `Hoàn tất`.
- Nhánh rẽ **Số hóa (Digital)** dành cho hợp đồng ký điện tử (bỏ qua in ấn & bưu điện).
- Nhánh rẽ xử lý ngoại lệ: `Bị từ chối ký`, `Sự cố vận chuyển`, và `Đã hủy`.
- Vết kiểm toán bất biến (Immutable Audit Log) lưu trữ người cập nhật, thời điểm và ghi chú chi tiết.

### 2. Soạn Thảo Legal & Phê Duyệt Draft
- Phân công nhiệm vụ soạn thảo với hạn chót (Deadline) và 4 cấp độ khẩn cấp (`normal`, `priority`, `urgent`, `emergency`).
- Hỗ trợ nộp bản thảo bằng tệp Word `.docx` hoặc liên kết trực tiếp Google Docs.
- Vòng phản hồi (Feedback Loop) đánh giá chất lượng bản thảo giữa Ban Giám đốc và Pháp chế.

### 3. Động Cơ Tính Lương SLA/KPI Tự Động (Payroll Engine)
- **Legal Engine**: $\text{Lương} = \text{Đơn Giá Gốc} \times (1 + K_{\text{khẩn cấp}} + K_{\text{đúng hạn}} + K_{\text{chất lượng}})$.
- **Văn Thư (Clerk) Engine**: Tự động tính thưởng/phạt in nhanh ($\le 2$ giờ), bàn giao Viettel Post ($\le 4$ giờ), và thu hồi lưu kho ($\le 7$ ngày).
- Ma trận bảng lương trực quan, minh bạch và hỗ trợ xuất báo cáo.

### 4. Vận Đơn Viettel Post & Quét Mã QR Thông Minh
- Tích hợp mã vận đơn bưu cục Viettel Post, theo dõi lộ trình bưu kiện thời gian thực.
- Camera quét mã QR dán trên phong bì hồ sơ để tự động chuyển tiếp trạng thái không cần thao tác chuột.

### 5. Trợ Lý AI Google Gemini 2.5 Flash
- Tự động đọc và trích xuất thông tin hợp đồng (Tên, Mã số, Đối tác, Giá trị, Ngày ký) từ tài liệu DOCX/PDF/Hình ảnh.

### 6. Thông Báo Microsoft Teams Webhook
- Bắn thông báo thời gian thực về kênh chat MS Teams khi có hợp đồng mới, phê duyệt, giao hàng thành công hoặc vi phạm SLA.

---

## 📚 Bộ Tài Liệu Kỹ Thuật Đầy Đủ

Dự án cung cấp các tài liệu đặc tả chuyên sâu:
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: Sơ đồ kiến trúc sản phẩm, State Machine, công thức toán học SLA/KPI, và đặc tả API Viettel Post.
- **[API.md](API.md)**: Danh mục 100% RESTful API endpoints, Request/Response payloads, headers và mã lỗi HTTP.
- **[SCHEMA.md](SCHEMA.md)**: Sơ đồ ERD 3NF, đặc tả TypeScript Drizzle ORM Schema, và từ điển dữ liệu chi tiết.
- **[AGENTS.md](AGENTS.md)**: Quy tắc kỹ thuật, hằng số nghiệp vụ cố định, và hướng dẫn cho AI/Kỹ sư phát triển tiếp.

---

## 📂 Cấu Trúc Thư Mục Dự Án

```
├── Dockerfile                 # Multi-stage Docker build cho Production
├── docker-compose.yml         # Cấu hình container App + PostgreSQL 16
├── .env.example               # Mẫu biến môi trường chi tiết
├── server.ts                  # Máy chủ Express API & Vite SSR/Middleware
├── package.json               # Cấu hình scripts & dependencies
├── tsconfig.json              # TypeScript compilation config
├── data/
│   ├── database.json          # File lưu trữ dữ liệu Prototype hiện tại
│   ├── logs.json              # Nhật ký sự kiện hệ thống
│   ├── init-db.sql            # Script SQL khởi tạo schema PostgreSQL
│   └── contracts/             # Thư mục lưu tệp hợp đồng (.docx, .pdf)
├── scripts/
│   └── migrate-json-to-pg.ts  # Script di chuyển dữ liệu tự động sang PostgreSQL
└── src/
    ├── App.tsx                # Giao diện chính & điều hướng SPA
    ├── types.ts               # Định nghĩa kiểu dữ liệu TypeScript lõi
    ├── utils/
    │   ├── payroll.ts         # Động cơ tính lương SLA/KPI (Legal & Clerk)
    │   └── formatters.ts      # Định dạng tiền tệ VND, ngày tháng
    ├── components/            # Các phân hệ giao diện người dùng
    │   ├── ContractDashboard.tsx    # Bảng hợp đồng & bộ lọc đa tiêu chí
    │   ├── LegalPayrollDashboard.tsx# Báo cáo ma trận lương SLA/KPI
    │   ├── CreateContractForm.tsx   # Form khởi tạo hợp đồng
    │   ├── ContractScanner.tsx      # Quét mã QR bằng Camera
    │   ├── AdminSettings.tsx        # Cấu hình tham số SLA toàn hệ thống
    │   └── SimulatorPanel.tsx       # Bảng giả lập Webhook & SLA Cron Job
    └── constants/             # Nhãn trạng thái & workflow steps
```

---

## 💻 Hướng Dẫn Khởi Chạy Local (Development)

Chạy ứng dụng trực tiếp bằng Node.js và file JSON lưu trữ nhanh:

### Bước 1: Cài đặt gói phụ thuộc
```bash
npm install
```

### Bước 2: Thiết lập biến môi trường
Sao chép `.env.example` thành `.env` và điền `GEMINI_API_KEY`:
```bash
cp .env.example .env
```

### Bước 3: Khởi chạy Dev Server
```bash
npm run dev
```
Truy cập ứng dụng tại: **`http://localhost:3000`**

### Bước 4: Kiểm tra mã nguồn (Type Check)
```bash
npm run lint
```

---

## 🐳 Hướng Dẫn Triển Khai Production Bằng Docker Compose

Đây là cách nhanh nhất và chuẩn mực nhất để biến dự án thành một **Production Stack thực thụ**:

### Bước 1: Chuẩn bị file `.env`
Đảm bảo đã cấu hình mật khẩu PostgreSQL trong file `.env`:
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_super_strong_password
POSTGRES_DB=contracts_db
GEMINI_API_KEY=your_gemini_api_key_here
```

### Bước 2: Khởi động toàn bộ Stack
```bash
docker compose up -d --build
```

### Bước 3: Kiểm tra trạng thái các container
```bash
docker compose ps
```
Hệ thống sẽ tự động:
1. Kích hoạt cơ sở dữ liệu **PostgreSQL 16 Alpine** (Port 5432).
2. Tự động chạy script `data/init-db.sql` tạo đầy đủ cấu trúc bảng và indexes.
3. Build mã nguồn React và khởi động ứng dụng **Express Production** (Port 3000).

Truy cập hệ thống tại: **`http://localhost:3000`**

---

## 🔄 Hướng Dẫn Di Chuyển Dữ Liệu (JSON ➔ PostgreSQL)

Khi bạn đã có dữ liệu hợp đồng cũ trong `data/database.json` và muốn chuyển sạch sang PostgreSQL:

```bash
npm run migrate:json-to-pg
```
Script sẽ tự động:
- Đọc toàn bộ hợp đồng, tệp đính kèm, vết kiểm toán, lịch sử phản hồi và cấu hình.
- Nạp trực tiếp vào PostgreSQL (nếu có kết nối) hoặc xuất ra file `data/migrated-data.sql` để import thủ công qua lệnh:
  ```bash
  psql -U postgres -d contracts_db -f data/migrated-data.sql
  ```

---

## 🌐 Triển Khai Độc Lập Trên Ubuntu VPS (PM2 & Nginx)

### 1. Build ứng dụng Production
```bash
npm run build
```

### 2. Quản lý tiến trình bằng PM2
```bash
npm install -g pm2
pm2 start server.ts --name "contracts-app" --interpreter tsx
pm2 save
pm2 startup
```

### 3. Cấu hình Nginx Reverse Proxy (`/etc/nginx/sites-available/contracts.conf`)
```nginx
server {
    listen 80;
    server_name contracts.yourdomain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Kích hoạt chứng chỉ SSL miễn phí qua Certbot:
```bash
sudo certbot --nginx -d contracts.yourdomain.com
```

---

## ⚙️ Bảng Cấu Hình Biến Môi Trường (`.env`)

| Biến Môi Trường | Giá Trị Mặc Định | Mô Tả |
|---|---|---|
| `NODE_ENV` | `development` | Môi trường chạy (`development` hoặc `production`) |
| `PORT` | `3000` | Cổng HTTP lắng nghe của Express Server |
| `DATABASE_URL` | `postgresql://...` | Chuỗi kết nối PostgreSQL cho Production Stack |
| `GEMINI_API_KEY` | *(Bắt buộc cho AI)* | Khóa API Google AI Studio (Gemini 2.5 Flash) |
| `TEAMS_WEBHOOK_URL` | *(Tùy chọn)* | Webhook URL kênh Microsoft Teams nhận thông báo |
| `VTP_BASE_URL` | `https://partner.viettelpost.vn/v2` | Địa chỉ API chính thức của Viettel Post |
| `VTP_APP_TOKEN` | *(Tùy chọn)* | Token xác thực đối tác Viettel Post |
| `JWT_SECRET` | *(Bảo mật)* | Khóa bí mật ký xác thực Token bảo mật |

---

## 👨‍💻 Tác giả & Giấy phép
- Phát triển bởi **Hệ thống Quản lý Hợp đồng Doanh nghiệp**.
- Bảo lưu mọi quyền theo quy định nội bộ doanh nghiệp.
