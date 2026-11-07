# SPEC.md — Chuyển "Hệ thống Quản lý Hợp đồng Nội bộ" từ prototype sang ứng dụng thật

> **Đối tượng đọc:** Claude Code (và kỹ sư tiếp quản).
> **Nguồn:** audit trực tiếp mã nguồn tại thư mục dự án (`server.ts` 2.562 dòng, `src/` 11.117 dòng tính cả CSS, `data/init-db.sql`, script migration, `data/database.json` và tài liệu hiện có).
> **Ngày lập:** 06/11/2026.
> **Phạm vi file này:** chỉ là **spec + kế hoạch**. Không chứa code triển khai.
> **Trạng thái:** hoàn chỉnh để chủ dự án duyệt và bàn giao cho agent triển khai; **chưa phải hệ thống đã được sửa hoặc kiểm thử**. Các mặc định nghiệp vụ ở mục 14 là đề xuất, không phải quyết định đã được chủ dự án xác nhận.

**Đọc nhanh:** mục 2 là audit mã nguồn; mục 3–11 là thiết kế đích; mục 12 là checklist triển khai; mục 13 là thay đổi so với mockup; mục 14 là các lựa chọn cần owner duyệt và prompt bàn giao.

---

## 0. Cách làm việc với file này (đọc kỹ trước khi code)

1. **Làm tuần tự theo Phase (mục 12).** Mỗi Phase kết thúc khi: `npm run lint` sạch, test của Phase đó xanh, và checklist smoke-test của Phase đó chạy tay được.
2. **Đây là đặc tả đích được đề xuất, không tự cấp quyền bỏ qua `AGENTS.md`.** Các mâu thuẫn tài liệu nằm ở mục 2.3. Sau khi chủ dự án duyệt spec, cập nhật các tài liệu liên quan ở cuối mỗi Phase; giữ quy tắc đồng bộ schema. Nếu quyết định mới xung đột chỉ dẫn đang áp dụng thì phải xin duyệt thay đổi chỉ dẫn trước.
3. **Không redesign giao diện.** Giữ bố cục, class Tailwind, màu sắc, tiếng Việt và tên trạng thái. Chỉ đổi dữ liệu, hành vi, nội dung đang hứa sai và phần nhập liệu tối thiểu cần cho bảo mật/nghiệp vụ (liệt kê ở mục 13).
4. **Không bịa API bên ngoài.** Viettel Post, Microsoft Teams, Google Drive, Gemini: đọc tài liệu chính thức hiện hành trước khi viết client. Chưa xác minh được thì ghi rõ rào cản, người phụ trách và điều kiện mở tích hợp trong `DECISIONS.md`; chạy chế độ "chưa cấu hình" trung thực (mục 8), không dựng client giả.
5. **Quyết định nghiệp vụ chưa chốt nằm ở mục 14**, mỗi mục có *mặc định đề xuất*. Có thể dùng mặc định để viết test và triển khai trên môi trường phát triển sau khi được yêu cầu code; trước vận hành thật phải được chủ dự án duyệt, nhất là xác thực, quyền xem hồ sơ và chính sách lương.
6. **Không commit bí mật.** Phải đưa `.env` vào `.gitignore` khi triển khai. Mật khẩu/API key/webhook URL không xuất hiện trong log hay response.
7. **Mỗi thay đổi trạng thái hợp đồng đều phải đi qua đúng một hàm** (`workflow.transition`, mục 4). Cấm viết thêm đường tắt cập nhật `status` ở nơi khác.

---

## 1. Mục tiêu, phi mục tiêu, nguyên tắc

### 1.1. Mục tiêu (định nghĩa "app thật")

| # | Mục tiêu | Kiểm chứng được bằng |
|---|---|---|
| G1 | **PostgreSQL là nguồn sự thật duy nhất.** Bỏ `data/database.json`, `data/logs.json` khỏi luồng chạy, không xoá nguồn nhập khi chưa được phép. `localStorage` chỉ giữ tuỳ chọn giao diện, **không** giữ danh tính/vai trò. | Restart server: dữ liệu còn nguyên. Xoá localStorage: không mất dữ liệu và không ảnh hưởng cookie phiên còn hợp lệ. Xoá cookie/thu hồi phiên: API trả 401. |
| G2 | **Danh tính thật.** Server xác định người dùng và vai trò từ phiên đăng nhập, không tin header/body do client gửi. | Gửi request giả `x-user-role: admin` bằng curl → 401/403. |
| G3 | **Một workflow engine duy nhất** kiểm soát chuyển trạng thái: có guard (trạng thái hiện tại, vai trò, điều kiện dữ liệu), chạy trong transaction, ghi audit bất biến. | Test bảng chuyển trạng thái (mục 4.3): mọi cặp (trạng thái, hành động) không hợp lệ đều trả 409. |
| G4 | **Một nguồn tính lương duy nhất**, chạy ở server, **đóng băng** khi chốt (không đổi khi Admin sửa cấu hình sau này). | Đổi `defaultBasePayLegal`, mở lại bảng lương: các task đã chốt không đổi số tiền. |
| G5 | **Tích hợp thật hoặc báo "chưa cấu hình" trung thực.** Không còn "giả lập thành công" (Drive, Teams, VTP, AI). | Bỏ `GEMINI_API_KEY`: màn hình tạo hợp đồng báo rõ "AI chưa cấu hình, nhập tay", không sinh dữ liệu ngẫu nhiên. |
| G6 | **Chuẩn vận hành:** migration có version, health check, backup, log có cấu trúc, Dockerfile chạy được. | `docker compose up` trên máy sạch → app chạy; `pg_dump`/restore thử thành công. |
| G7 | **Giữ bố cục và phong cách UI** so với bản AI Studio; chỉ thay đổi tương tác/nội dung cần thiết được liệt kê ở mục 13. | So sánh ảnh chụp từng màn hình trước/sau, giải thích từng delta có chủ đích. |

### 1.2. Phi mục tiêu (không làm trong đợt này)

- Đổi stack (vẫn Express + Vite + React 19 + Tailwind v4 + TypeScript).
- Redesign giao diện, đổi tên trạng thái, đổi tên role.
- Đa công ty / multi-tenant.
- Chữ ký số CA tích hợp. "Digital" vẫn nghĩa là *đính kèm file đã ký điện tử*, không gọi nhà cung cấp CA.
- Chi trả lương thật (payout/HRM). Hệ thống chỉ **tính, chốt, xuất báo cáo** để kế toán xử lý.
- App mobile native (web responsive + camera quét QR như hiện tại).

### 1.3. Nguyên tắc "sát hiện tại nhưng chuẩn business"

1. **Giữ**: tên 12 trạng thái, tên 3 role (`admin` / `legal` / `clerk`), route nghiệp vụ hiện có còn hợp lệ, cấu trúc công thức lương và các tham số Admin đang cấu hình, các màn hình và luồng thao tác. Ngoại lệ API/UX có chủ đích nằm ở mục 10 và 13.
2. **Sửa**: những chỗ code hiện tại *sai nghiệp vụ* hoặc *giả* (mục 2.2). Mỗi sửa đổi hành vi so với bản mockup được liệt kê ở mục 13 để chủ dự án biết cái gì đã đổi và vì sao.
3. **Tương thích ở ranh giới dữ liệu:** entity `Contract` giữ các tên trường hiện tại (kể cả `uploaded_at`, `slaBreached`, `base_pay`) qua một lớp DTO mapper có allowlist. Không trả `filePath`, bí mật hay lương người khác chỉ để tương thích. Danh sách chuyển sang envelope phân trang tại mục 10, cập nhật đồng thời `api.ts`, hook và bảng; không âm thầm trả một phần mảng rồi tính tổng trên đó. Không đổi hàng loạt tên trường UI.

---

## 2. Audit hiện trạng

### 2.1. Vì sao hiện tại mới chỉ là mockup

| Thành phần | Hiện trạng (vị trí) | Vấn đề | Xử lý tại |
|---|---|---|---|
| **Lưu trữ** | Mỗi request `readDb()` đọc cả `data/database.json`, sửa trong RAM, `writeDb()` ghi đè cả file (`server.ts`) | Không transaction, đua dữ liệu khi 2 người thao tác cùng lúc, mất dữ liệu khi crash giữa chừng, không truy vấn/phân trang được | Phase 1 |
| **PostgreSQL** | Có `data/init-db.sql`, `scripts/migrate-json-to-pg.ts`, `docker-compose.yml` | **Server không hề dùng Postgres**: `package.json` không có `pg`/`drizzle-orm`. Docker compose tham chiếu `Dockerfile` **không có trong zip** | Phase 0–1 |
| **Đăng nhập** | `POST /api/auth/login` chỉ cần email trong danh sách mời, **không mật khẩu, không token** (`server.ts:1121`). `AuthModal.tsx` có ô password nhưng không dùng | Biết email là vào được | Phase 2 |
| **Phân quyền** | Middleware `requireRole` đọc header `x-user-role` (`server.ts:1087`); frontend lấy role từ `localStorage` (`api.ts:3-14`, `useContracts.ts:8,148`) | Ai cũng tự nâng quyền admin bằng một dòng curl hoặc sửa localStorage | Phase 2 |
| **Danh tính trong audit** | `updatedBy`, `uploadedBy`, `requestedBy` lấy từ **body request**; fallback chuỗi `'Văn thư'`, `'Pháp chế'`, `'Quản lý'` | Giả mạo được người thực hiện; audit log không đáng tin | Phase 2 |
| **Đổi vai trò giả** | `App.tsx:~1383` có mục "Giả Lập Tài Khoản & Vai Trò" cho bấm đổi sang admin/legal/clerk; tài khoản demo hard-code (`tankhoi.agribank@gmail.com`, `legal@test.com`, `clerk@test.com`) | Phá vỡ toàn bộ phân quyền | Phase 2 |
| **Máy trạng thái** | Các endpoint tự gán `contract.status = ...` mà **không kiểm tra trạng thái hiện tại** | Xem B1–B4, B19 | Phase 2 |
| **Công thức lương** | 3 bản không khớp nhau: `payroll.ts` (theo settings, ±30%), `approve-soft-copy` trong `server.ts` (cứng +10/0/−10), `API.md`/`ARCHITECTURE.md` (mô tả khác nhau) | Xem B5–B10 | Phase 3 |
| **Giả lập Webhook VTP** | `POST /api/sim/vtp-webhook`, `POST /api/settings/toggle-vtp`, `SimulatorPanel.tsx`, `AdminSettings.tsx:597` | Công cụ dev nằm lẫn trong sản phẩm | Phase 5–7 |
| **Vận đơn Viettel Post** | Văn thư **gõ tay** mã vận đơn; không có lời gọi VTP API nào; webhook `/api/webhooks/vtp` không xác thực (`server.ts:2262`) | Chưa có tích hợp thật; ai biết URL cũng giả được trạng thái giao hàng | Phase 5 |
| **Quét scan tự khớp** | `ContractScanner.tsx:481-492` dùng `setTimeout` 1,5 giây rồi **chọn hợp đồng đầu tiên đang "Chờ bản gửi lại"** | Tính năng "AI khớp" là giả; có thể gắn nhầm bản scan vào hợp đồng khác | Phase 4 |
| **Trích xuất AI** | `server.ts` ~880-960: khi không có `GEMINI_API_KEY` hoặc lỗi → **sinh tên/đối tác/giá trị hợp đồng ngẫu nhiên** theo tên file; model hard-code `gemini-3.5-flash` trong khi `.env.example`/docs ghi `gemini-2.5-flash` và `GEMINI_MODEL` không được đọc | Dữ liệu bịa lọt vào hồ sơ pháp lý | Phase 5 |
| **Sao lưu Google Drive** | `backupToDrive()` chỉ `setTimeout` 1,5 giây rồi ghi log "thành công", sinh ID Drive ngẫu nhiên | Báo thành công giả | Phase 5 |
| **Thông báo Teams** | Có gọi `fetch` thật nếu có URL; nhưng thay `{{text}}` vào template JSON bằng `replace` thuần → vỡ JSON khi nội dung có dấu `"` hoặc xuống dòng; không retry, không hàng đợi | Mất thông báo âm thầm | Phase 5 |
| **Dữ liệu mẫu** | `generateSeedContracts()`, `MOCK_RECEIVERS`, 18 hợp đồng trong `database.json`, tiến trình upload giả trong `useContracts.ts:173-234` | Dữ liệu demo lẫn trong luồng chạy | Phase 1, 4 |
| **SLA nền** | `setInterval` 60 giây trong tiến trình Node, đo theo `lastActivityAt` | Xem B11, B25 | Phase 6 |
| **Báo cáo** | `GET /api/dashboard/reports` tính trong RAM trên toàn bộ danh sách; không cần đăng nhập | Không mở rộng được; lộ dữ liệu | Phase 6 |
| **Kiểu dữ liệu** | `value` là chuỗi tự do (`"840,000,000 VND"`); ngày ký/hiệu lực là `VARCHAR`; id = `Math.random().toString(36).substring(7)` | Không tính toán/thống kê được; id có thể trùng | Phase 1 |
| **Triển khai** | `npm start` = `node server.ts` (phụ thuộc hỗ trợ chạy TS trực tiếp của bản Node cụ thể); Compose mount lồng cả `./data:/app/data` và volume uploads | Chưa có pipeline build backend/runtime tái lập, ownership/persistence file khó đối soát | Phase 7 |

### 2.2. Lỗi nghiệp vụ phát hiện trong code hiện tại

Các lỗi này **phải được sửa** khi làm app thật (không chỉ "chuyển DB"). Mã `B#` được dùng lại ở các mục sau.

| Mã | Lỗi | Tác động | Cách sửa (mục) |
|---|---|---|---|
| **B1** | `approve-soft-copy` cho phép `admin`, `clerk`, `legal`, ở **mọi trạng thái** (`server.ts:1662`) | Pháp chế tự duyệt bản thảo của chính mình → tự chốt lương | 4.3, 5.2 |
| **B2** | `POST /:id/scan` chuyển hợp đồng từ **bất kỳ trạng thái** sang `Hoàn tất` (`server.ts:1827`) | Hợp đồng chưa in/ký vẫn "hoàn tất" | 4.3 |
| **B3** | `qr-transition` đi qua `Chờ tạo vận đơn → Chờ shipper` **không cần mã vận đơn**, và cho Văn thư đẩy `Chờ duyệt bản mềm → Chờ in` (thay Lãnh đạo duyệt) (`server.ts:1924`) | Hợp đồng đang giao mà không có vận đơn; bỏ qua bước duyệt | 4.3 |
| **B4** | Tạo thủ công với `processingMethod = digital` khởi tạo thẳng ở `Chờ bản gửi lại` (`server.ts` ~1342) | Bỏ qua bước **duyệt bản mềm** của Lãnh đạo | 4.4, 14-D4 |
| **B5** | Ba công thức lương khác nhau (xem 2.1) | Số tiền hiển thị ≠ số tiền ghi vào audit/DB | 6 |
| **B6** | `request-draft` nhận `basePay` từ client (`server.ts:1414`) | Vi phạm Quy tắc bất biến #1 trong `AGENTS.md` | 6.2 |
| **B7** | Hệ số chất lượng khi tạo task mặc định **+0,1**; `approve-soft-copy` cho 0–1 feedback = **+10%**, 2 = 0%, ≥3 = −10%; còn `payroll.ts`/ARCHITECTURE: 0 = 0%, 1 = −10%, 2 = −20%, ≥3 = −30% | Cùng một task ra hai số khác nhau tuỳ nơi tính | 6.2 |
| **B8** | Bảng lương tính **lại mỗi lần mở dashboard** bằng cấu hình hiện hành (`LegalPayrollDashboard.tsx`) | Admin đổi cấu hình → lương quá khứ thay đổi theo | 6.5 |
| **B9** | Lương Văn thư dùng `feedback_count` (số lần *Sếp phản hồi bản thảo của Legal*) làm số "sự cố" của Văn thư (`payroll.ts`, nhánh `calculateClerkPayroll`) | Văn thư bị trừ điểm vì lỗi của Legal | 6.3 |
| **B10** | SLA in ấn của Văn thư đo từ `uploaded_at` (lúc tạo hợp đồng), tức gồm cả thời gian soạn thảo và chờ duyệt | Văn thư gần như luôn "trễ" | 6.3 |
| **B11** | SLA nội bộ đo theo `lastActivityAt` (bị reset bởi mọi thao tác, kể cả sửa thông tin) và áp một ngưỡng chung cho cả `Chờ bản gửi lại` (trạng thái chờ **đối tác**, không phải xử lý nội bộ) | Cảnh báo sai/bỏ sót | 9.1 |
| **B12** | Template payload Teams thay thế chuỗi không escape JSON | Thông báo lỗi khi tên hợp đồng có dấu nháy | 8.2 |
| **B13** | ID base36 ngắn từ `Math.random().toString(36).substring(7)`, độ dài không được đảm bảo | Va chạm id khi dữ liệu lớn | 3.1 |
| **B14** | `LegalPayrollDashboard.tsx:~453` loại trừ cứng `legal@test.com`; `assigned_to` mặc định `'legal@test.com'` | Hành vi phụ thuộc tài khoản demo | 6.4 |
| **B15** | `updatedBy` do client gửi | Audit giả mạo được | 5.1 |
| **B16** | Mã QR in ra chứa `contractNumber` (`ContractTable.tsx:279`) trong khi `AGENTS.md` ghi là `contract.id`; số hợp đồng lại **sửa được** sau khi in | Tem đã dán thành vô hiệu khi sửa số HĐ | 4.6 |
| **B17** | `POST /api/webhooks/vtp` không xác thực | Ai cũng giả được "đã giao" | 8.1 |
| **B18** | `GET /api/settings`, `/api/contracts`, `/api/dashboard/reports`, `/api/sim/logs` không yêu cầu đăng nhập; `GET /api/settings` trả cả `teamsWebhookUrl` | Lộ dữ liệu và URL webhook | 5.2 |
| **B19** | `redraft` đưa hợp đồng về `Chờ duyệt bản mềm` mà không đòi bản thảo mới | Duyệt lại đúng bản cũ vừa bị đối tác từ chối | 4.3 |
| **B20** | Legal tự tạo task cho chính mình với mức khẩn cấp tự chọn | Tự nâng hệ số thưởng của mình | 4.3, 6.2 |
| **B21** | Đọc-sửa-ghi toàn file không khoá | Ghi đè lẫn nhau | 3 |
| **B22** | `value` là chuỗi tự do | Không thống kê được tổng giá trị hợp đồng | 3.2 |
| **B23** | Tên file tiếng Việt khi upload qua `multer` có thể bị sai mã hoá (multer/busboy mặc định giải `latin1`); đường dẫn file lưu tuyệt đối từ `req.file.path` | Tải về tên sai; lệ thuộc vị trí máy chủ | 7 |
| **B24** | `npm start` chạy thẳng TS, chưa có build backend; thiếu Dockerfile | Runtime phụ thuộc phiên bản Node/strip-types; Compose không build được image theo cấu hình đang có | 11 |
| **B25** | Job SLA là `setInterval` trong tiến trình | Chạy nhiều instance → thông báo trùng | 9.1 |
| **B26** | Hook gửi `physical_notes`, `physical_step_history` vào `/edit`, nhưng server không đọc; role clerk cũng không được gọi `/edit` | Toast có thể báo đã lưu dù ghi chú mất, hoặc bị 403 | 4.5, 10.2 |
| **B27** | `apiService.updateContractStatus` gọi `POST /:id/status` nhưng server **không có route**; bảng vẫn có menu chuyển tới mọi trạng thái | Nút chết; nếu thêm route gán status trực tiếp sẽ tạo cửa hậu workflow | 4.3, 10.2 |
| **B28** | `tsconfig.json` chỉ include `src`; `npm run lint` **không kiểm tra** `server.ts` hay script migration | Lint xanh không chứng minh backend chạy được | 11.1, Phase 0 |
| **B29** | Multer ghi file **trước** kiểm tra role; không giới hạn dung lượng/loại file | Request không có quyền vẫn tốn đĩa; có thể upload file nguy hiểm | 7.1 |
| **B30** | Webhook dùng điều kiện `status !== ...`, không deduplicate hay kiểm tra thứ tự sự kiện/vận đơn hiện hành | Callback cũ có thể đưa `Hoàn tất` trở lại `Đang giao`; reship nhầm chuyến | 8.1 |
| **B31** | Báo cáo khởi tạo `statusCounts` thiếu `Chờ soạn thảo`, `Chờ duyệt bản mềm` | Tổng số theo trạng thái không bằng tổng hợp đồng | 9.2 |
| **B32** | Clerk dashboard cộng cả hồ sơ chưa làm, hồ sơ digital và không gắn người làm; chỉ lọc lương bằng UI | Ghi nhận lương khi chưa hoàn thành; lộ lương và không xác định người nhận | 5.2, 6.3–6.5 |
| **B33** | Cửa sổ in QR đưa tên/địa chỉ vào `document.write` không escape; CSV và link do người dùng nhập chưa kiểm soát đầy đủ | Stored XSS ở trang in, công thức độc hại khi mở CSV, URL không an toàn | 7.3, 10.3 |
| **B34** | Google Docs là link sửa được, không có bản duyệt bất biến | Nội dung in/gửi có thể khác nội dung Lãnh đạo đã duyệt | 4.2, 7.2 |
| **B35** | Migration fallback sang xuất SQL khi lỗi kết nối; đếm bản ghi nguồn như đã nhập; feedback/VTP có ID mới mỗi lần; thiếu lịch sử vật lý | Báo migration thành công sai, chạy lại sinh trùng/mất lịch sử | 3.4 |
| **B36** | Deadline `datetime-local` khởi tạo bằng `toISOString().slice(0,16)` rồi đọc như giờ địa phương | Lệch 7 giờ trên máy dùng múi giờ Việt Nam | 3.2, 6.2 |
| **B37** | Server chọn production nếu thấy thư mục `dist`, không chỉ dựa `NODE_ENV` | Vừa build xong thì `npm run dev` mất HMR, khó tái lập môi trường | 11.1 |

### 2.3. Tài liệu cũ mâu thuẫn với code (sửa ở cuối mỗi Phase)

- `README.md` liệt kê file **không tồn tại**: `Dockerfile`, `src/utils/formatters.ts`, `src/components/ContractDashboard.tsx`, `data/logs.json` (chỉ sinh khi chạy).
- `API.md` ghi quality coef (0–1 lần = +10%, 2 = 0%, ≥3 = −10%) khác `ARCHITECTURE.md` (0 / −10 / −20 / −30%). **Bản đúng sau spec này: mục 6.**
- `API.md` ghi đúng-hạn = +10% cố định; code lương thật dùng 7 bậc sớm/trễ cấu hình được. **Bản đúng: mục 6.**
- `AGENTS.md` nói QR chứa `contract.id`; code in `contractNumber`. **Bản đúng: mục 4.6.**
- `AGENTS.md` nói model `gemini-2.5-flash`; code dùng `gemini-3.5-flash`. **Bản đúng: đọc từ `GEMINI_MODEL` (mục 8.3).**
- `AGENTS.md` mục "Prototype dùng database.json": **xoá** sau Phase 1.

### 2.4. Bằng chứng và giới hạn của lần audit tiếp quản

- Trong bản đang có: **18/18 hợp đồng có ID `con_seed_*`**; 19 metadata file, **0 file tìm thấy theo đường dẫn lưu trong JSON**. Đây không phải bằng chứng rằng chủ dự án không có tài liệu ở nơi khác. Không xoá JSON và không nhập các hồ sơ này vào production mặc định.
- `src/db/schema.ts` hiện chỉ xuất hiện như ví dụ trong `SCHEMA.md`, chưa có file triển khai. Schema SQL còn role `requester`, trong khi UI/TypeScript chỉ có ba role; bản đích giữ ba role, dữ liệu role lạ phải được đối soát khi nhập.
- Thư mục hiện không có `.git`, `node_modules`, Dockerfile hay test suite. Chưa chạy ứng dụng, lint/build, database, camera thật hoặc tích hợp bên ngoài trong lần viết tài liệu này.
- Các số dòng audit là mốc của bản hiện tại, không phải API contract. Khi triển khai cần tìm theo tên route/hàm, không patch mù theo số dòng.

---

## 3. Kiến trúc và dữ liệu đích

### 3.1. Lựa chọn kiến trúc

**Chọn modular monolith:** một Express app phục vụ API + `dist/`, một PostgreSQL 16, một worker dùng chung code và database. Express luôn nghe **`0.0.0.0:3000`**. Worker không mở cổng HTTP. Không thêm Redis, microservices, framework frontend hoặc ORM khác.

Hai hướng không chọn: (a) chỉ thay JSON bằng SQL, vì vẫn còn giả mạo quyền, sai workflow/lương; (b) viết lại toàn bộ frontend/backend, vì tăng rủi ro lệch UI và chi phí kiểm thử không cần thiết.

**Ranh giới trách nhiệm dự kiến (chưa tạo các file này trong lượt viết spec):**

| Đường dẫn | Trách nhiệm |
|---|---|
| `server.ts` | Bootstrap, Vite chỉ ở development, listen, graceful shutdown; không chứa nghiệp vụ |
| `server/app.ts`, `server/config.ts` | Tạo Express app không tự listen để test; kiểm tra env và cấu hình |
| `server/db/client.ts`, `server/db/schema.ts`, `drizzle.config.ts`, `drizzle/` | Pool `pg`, schema Drizzle, migration SQL có version |
| `server/modules/auth/` | Login, session PostgreSQL, invite/reset, RBAC và tài khoản |
| `server/modules/contracts/` | Routes, validation, repository, DTO và truy vấn hồ sơ |
| `server/modules/workflow/` | Bảng action/guard, transaction, revision/cycle và audit |
| `server/modules/payroll/` | Policy snapshot, work item, kết quả chốt, điều chỉnh và truy vấn lương |
| `src/utils/payroll.ts` | **Engine toán học duy nhất**, pure/deterministic, server gọi; không đọc DB, DOM, localStorage hoặc đồng hồ ngầm |
| `server/modules/files/` | Upload staging, kiểm tra file, storage key, tải file có quyền |
| `server/modules/settings/` | Cấu hình có version, public projection và secret write-only |
| `server/integrations/{vtp,teams,gemini,drive}/` | Adapter dịch vụ thật; không quyết định workflow hoặc tự ghi status |
| `server/jobs/`, `server/worker.ts` | Outbox/inbox, SLA, retry, đối soát và dọn staging |
| `server/modules/reports/`, `server/http/` | Aggregate báo cáo; middleware lỗi, request ID, CSRF, rate limit |
| `src/services/api.ts`, `src/hooks/useContracts.ts`, `src/types.ts` | DTO frontend, phiên `/me`, fetch/error/pagination; giữ component hiện có |
| `tests/{unit,integration,e2e}/` | Engine/guard, API + PostgreSQL thật riêng cho test, luồng UI |

Chỉ tách file khi Phase tương ứng cần đến. Không dựng cả cây module rỗng. Router gọi service; service dùng transaction/repository; repository không đọc `req`, không nhận actor từ body.

**Luồng ghi:** request → session/CSRF → validation → service → transaction (lock hồ sơ + kiểm tra version + cập nhật + audit + outbox) → commit → DTO. Worker gửi Teams/Drive/VTP sau commit. Không giữ transaction SQL trong lúc gọi mạng, AI hoặc đọc file lớn.

### 3.2. Quy ước dữ liệu và validation

1. **ID:** dùng `crypto.randomUUID()` cho bản ghi mới; cột ID `varchar(64)` để vẫn chứa ID cũ nếu nhập dữ liệu thật. ID bất biến, không dùng số hợp đồng làm FK. Trường hợp ID cũ trùng phải dừng nhập và đối soát, không tạo lại ID âm thầm.
2. **Số hợp đồng:** `trim`, Unicode NFC, không phân biệt hoa/thường khi kiểm tra trùng; unique index theo `lower(contract_number)`. Dùng chung chuẩn hoá ở create/edit/check-id/import. Nếu yêu cầu soạn thảo để trống, server cấp số nội bộ bằng sequence (`HD-REQ-<năm>-<sequence>`), không để AI tự bịa số pháp lý. Lưu rõ đây là mã hồ sơ nội bộ.
3. **Tiền:** tách `value_text` (giữ nội dung gốc/UI), `value_amount numeric(20,2)` nullable, `currency` nullable và `value_kind = total | recurring | unit_price | unknown`. Chỉ tổng hợp `total` đã xác nhận, nhóm theo tiền tệ; không cộng tiền/tháng, đơn giá/km hoặc tự suy đoán tỷ giá. Ví dụ `840,000,000 VND` → 840000000.00/VND/total khi parser xác định rõ; `45,000,000 VND / Tháng` không biến thành tổng 45 triệu. Chuỗi mơ hồ giữ nguyên và yêu cầu xác nhận.
4. **Lương VND:** lưu số nguyên `bigint`, không dùng float để làm tròn trung gian; tỷ lệ phần trăm nguyên, tính bằng số nguyên/decimal và round half-up một lần đến 1 VND. JSON lương kiểu number chỉ trong miền safe integer được server kiểm tra; giá trị hợp đồng decimal truyền bằng chuỗi.
5. **Thời gian:** sự kiện là `timestamptz`, server tạo thời điểm thao tác; ngày ký/hiệu lực là `date` nullable, trả `YYYY-MM-DD`. Thiếu ngày không tự điền hôm nay. API deadline phải có timezone ISO 8601; form `datetime-local` chuyển từ/đến múi giờ hiển thị đúng, không cắt UTC rồi đọc như local. Báo cáo/mốc tháng theo `Asia/Ho_Chi_Minh`.
6. **Validation chung:** email chuẩn hoá lowercase + trim; tên HĐ/đối tác 1–500 ký tự, số HĐ 1–100; ghi chú/lý do 1–4.000 ký tự; instructions tối đa 20.000. Chặn chuỗi chỉ có khoảng trắng và trường JSON không có trong allowlist ghi.
7. **Physical:** số bản in nguyên 1–100, cần người nhận/tên/địa chỉ/SĐT hợp lệ trước khi tạo/gán vận đơn. Có thể chưa biết người nhận ở task soạn thảo; không bổ sung người nhận ngẫu nhiên. `-` được hiểu là chưa có, **không** đủ điều kiện giao vận.
8. **Digital:** không bắt địa chỉ giao hàng/số bản in; các timestamp in/ký giấy/vận đơn giữ null. Không tạo timestamp giả để đủ công thức lương.
9. **Settings:** đơn giá nguyên 0–1.000.000.000 VND; giờ/ngày SLA hữu hạn > 0, tối đa 8.760 giờ/365 ngày; rate nguyên trong [-100,100]. `0 < earlyMinPct < earlyMidPct < earlyMaxPct <= 100`, `0 < lateMinHours < lateMidHours`. Không dùng `x || default` cho cấu hình cho phép 0. Toàn bộ settings mới có cùng validation phía server và UI.

### 3.3. Schema tối thiểu cần có

Đây là **schema đích**, không phải khẳng định các bảng đã tồn tại. Các cột metadata không nêu hết ở đây tiếp tục được giữ và map từ bản hiện tại.

| Bảng | Trường/constraint quan trọng |
|---|---|
| `users` | `id`, email unique không phân biệt hoa/thường, name, role chỉ admin/legal/clerk, `password_hash`, `status` invited/active/disabled, `auth_version`, timestamps. Không hard-delete người có lịch sử |
| `sessions` | Store tương thích `express-session` + `connect-pg-simple`: `sid`, `sess`, `expire` + expiry index; không dùng MemoryStore production |
| `auth_tokens` | `id`, user FK, type invite/reset, token hash unique, expires/consumed/revoked timestamps; không lưu raw token |
| `auth_rate_limits` | Bucket theo tài khoản/IP đã hash, count/locked_until/expiry; thao tác tăng nguyên tử và chia sẻ giữa các instance |
| `settings` | Một row `global_default`, toàn bộ cấu hình hiện có không bí mật, quy tắc clerk ở mục 6.3, `version`, updated_by/at |
| `settings_versions` | Snapshot policy bất biến theo version, actor/time; không chứa webhook URL, API key hoặc password |
| `contracts` | ID, số HĐ unique chuẩn hoá, metadata tiền/ngày, 12 status có CHECK, processing method, các timestamp gồm `digital_ready_at`, `stage_instance_id`, `status_entered_at`, `status_due_at`, `requires_review`, `version` nguyên tăng, creator/owner/Legal assignee/`clerk_assignee_id` FK, `current_revision_id`, `current_cycle_id`, `current_shipment_id` |
| `contract_revisions` | Contract/cycle FK, revision number unique trong cycle, file FK hoặc Docs URL, content hash khi có file, submitted_by/at, approved_by/at. Revision đã duyệt không thay nội dung |
| `contract_cycles` | Contract FK, cycle number, type initial/redraft, started/approved timestamps, revision đang xử lý; cycle cũ chỉ đọc |
| `contract_files` | ID, contract FK, revision/cycle FK nullable, type original/scan/attachment, tên NFC, `storage_key` tương đối unique, detected MIME, size, SHA-256, uploaded_by FK, timestamp, availability present/missing |
| `contract_audit_logs` | Append-only: action, contract/cycle, from/to status, actor user hoặc service, email/name snapshot, server time, reason, request ID, metadata diff; FK RESTRICT, không CASCADE |
| `contract_feedback_history` | ID, contract/cycle/revision FK, actor, note, time; mỗi feedback tương ứng đúng một action chuyển về soạn thảo |
| `contract_physical_events` | ID, contract/cycle, step, note, actor/time; append-only, không nhận mảng lịch sử do client tự ghép |
| `contract_identifiers` | Registry chung: code chuẩn hoá unique, kind id/current_number/legacy_number, contract FK, actor/time. Đăng ký cả ID, số hiện tại và alias số cũ để unique được thực thi trong DB, kể cả hai request chạy đồng thời |
| `uploads` | Upload ID, owner FK, storage key/hash/MIME/size, extraction status/suggestions, expires_at, consumed_contract_id; upload chưa xác nhận không phải hợp đồng |
| `integration_credentials` | Provider/key, ciphertext + nonce/tag, key version, updated_by/at; chỉ dùng cho secret write-only có UI quản trị, không trả ciphertext ra API |
| `work_items` | Contract FK, kind legal/clerk, assignee FK nullable trước claim, payable flag, policy snapshot/version, base pay snapshot, deadline/start, state open/finalized/cancelled, source cycle; tối đa một work item **có lương** mỗi kind/contract |
| `payroll_entries` | Work item unique, beneficiary FK, finalized_by/at, engine version, input snapshot, hệ số, số tiền VND, policy snapshot; immutable |
| `payroll_adjustments` | Entry FK, delta VND có dấu, lý do, actor/time và idempotency key; không sửa kết quả gốc |
| `clerk_incidents` | Contract/work item FK, mô tả/bằng chứng, assignee bị quy trách nhiệm, recorded_by, confirmed_by/at; chỉ incident Admin xác nhận mới tính phạt |
| `shipments` | Contract/cycle FK, attempt number, provider, waybill unique `(provider, waybill_code)` khi có mã, status, tạo/lấy/giao timestamps, source manual/api, external request key, superseded_at |
| `vtp_tracking_history` | Shipment FK, provider event ID/dedupe key unique, raw status, normalized status, provider occurred_at, received_at, note/location; không chỉ gắn contract |
| `integration_inbox` | Provider + dedupe key unique, payload đã giới hạn, received/verified/processed state, reason; hạn chế quyền đọc raw payload |
| `outbox_jobs` | ID, event type, aggregate ID, dedupe key unique, payload reference, state queued/running/succeeded/retry/awaiting_reconciliation/dead/skipped, attempts, next_run_at, locked_until, last_error đã redact |
| `integration_file_backups` | File + provider unique, pending/succeeded/failed/not_configured, remote ID/checksum, last attempt; không nhầm với trạng thái hợp đồng |
| `sla_alerts` | Contract + stage_instance_id + rule_version unique, cycle/shipment reference, deadline, opened/resolved timestamps; lưu lịch sử, phân biệt mỗi lần vào lại một bước |
| `idempotency_requests` | Actor + key unique, route, request hash, state, response DTO/status, created/expires; workflow giữ tối thiểu 7 ngày, không lưu password/file bytes |
| `system_audit_logs` | Sự kiện user/role/settings/auth/điều chỉnh lương, actor/time, target, diff đã redact; không giới hạn 100 dòng như simulator |
| `worker_heartbeats` | Worker ID, last_seen_at, version và job summary tối thiểu; phục vụ health/monitor, không chứa credentials |

**Ràng buộc bổ sung:**

- Các FK người thực hiện dùng ID, DTO hiển thị email/name snapshot. Danh sách Users trong Settings chỉ là projection, không còn là nơi lưu người dùng chính.
- Tạo cycle trước rồi gán `current_cycle_id`/revision/shipment trong cùng transaction; FK phải trỏ về đúng contract, không chỉ tồn tại bất kỳ. Dùng composite FK hoặc service check + test cross-contract cho mọi liên kết.
- Role runtime chỉ INSERT/SELECT audit, không UPDATE/DELETE; thêm trigger từ chối sửa/xoá audit và payroll entry. DB owner/migration role tách biệt; bất biến ở đây không có nghĩa chống được DBA toàn quyền.
- Không có API xoá hồ sơ/file/audit hàng loạt. `Đã hủy` là trạng thái nghiệp vụ, không phải delete. Chính sách lưu trữ/xoá pháp lý là quyết định riêng ở mục 14.
- Index: status + status_entered_at, uploaded_at + id, assigned user, contract file/audit parent + time, waybill, job state + next_run_at, session expiry, payroll beneficiary + finalized_at. Search ILIKE có parameter, thêm `pg_trgm` khi dữ liệu đo được cần; không tự bật extension nếu môi trường không cho phép.
- `data/init-db.sql` là snapshot tạo DB mới, đồng bộ với Drizzle migrations; không phải cơ chế nâng cấp DB đang có volume. Một lệnh migration có khoá thực thi, không để app/worker cùng chạy DDL khi khởi động.

### 3.4. Nhập dữ liệu từ JSON — có kiểm soát, không phá nguồn

**Mặc định production mới:** DB hợp đồng rỗng; seed chỉ policy mặc định và tài khoản Admin qua bootstrap tương tác. Không tự nhập 18 hồ sơ mẫu, không tự tạo ba tài khoản demo, không tự sinh hợp đồng khi bảng trống.

Nếu chủ dự án xác nhận có dữ liệu thật cần giữ, sửa `scripts/migrate-json-to-pg.ts` theo hợp đồng:

1. Nhận `--source <path>` và tuỳ chọn `--files-root <path>`; chế độ mặc định `--dry-run`, ghi report đếm/đối soát, không ghi DB. Để nhập phải có `--apply`; phát hiện `con_seed_*` thì từ chối trừ khi chủ dự án chủ động dùng `--include-demo` trên DB thử nghiệm. Cờ này bị cấm khi `NODE_ENV=production`.
2. Backup nguyên JSON/file ngoài thư mục app; ghi source SHA-256, danh sách ID, mã trùng, role lạ, email không map được, tiền/ngày không parse được, timestamp âm/thứ tự sai, file không tồn tại. Không sửa file nguồn.
3. Giữ ID hợp đồng/file/audit cũ hợp lệ. Lịch sử không có ID dùng khóa ổn định theo source hash + parent ID + collection + index; chạy lại cùng nguồn không sinh thêm feedback/VTP/physical events.
4. Không dùng `ON CONFLICT contract_number DO UPDATE status` để trộn hai hồ sơ khác ID. Khác ID cùng số HĐ là conflict cần quyết định; cùng ID khác nội dung cũng dừng, không ghi đè hoạt động đã phát sinh trên app thật.
5. Map đủ metadata, physical history, settings, users, files, feedback, tracking và audit. Người cũ không xác định được lưu label snapshot + `actor_kind=legacy`, **không gán cho Admin hiện tại**. Mật khẩu không tự sinh từ email; user nhập cần kích hoạt/reset.
6. File phải copy vào storage key mới, kiểm tra hash/dung lượng. File thiếu được báo `availability=missing`, không tạo file trắng hoặc báo đã sao lưu. Hồ sơ nhập thiếu chứng cứ bắt buộc được đánh dấu `requires_review` và chặn bước tiếp; không sửa ngược lịch sử thành "hợp lệ".
7. Không tính lại lương quá khứ tự động. Số cũ lưu dưới nhãn `legacy_unverified`, không đưa vào tổng lương chốt cho đến khi Admin đối soát/phê duyệt có audit. Không suy ra clerk beneficiary từ email demo.
8. Apply bằng SQL parameter/Drizzle, một transaction cho dữ liệu DB; nếu lỗi kết nối/constraint phải rollback và exit khác 0. Không fallback im lặng sang xuất SQL. Nếu cần `--export-sql`, đây là mode riêng, báo rõ **chỉ xuất, chưa nhập**.
9. Report tách `source`, `inserted`, `already_imported`, `conflicts`, `missing_files`, `rejected`; chỉ báo thành công sau commit. Import ledger lưu source hash và fingerprint bản ghi; lần chạy lại không đổi số row, lương hoặc lịch sử.
10. Cutover có thời gian dừng ghi, backup DB + file, dry-run được ký duyệt, apply, đối soát count/hash/FK và test tải file. Lỗi trước mở ghi có thể restore; sau mở ghi phải dừng và bảo toàn dữ liệu mới trước khi rollback, không bật lại JSON song song.

---

## 4. Workflow hợp đồng, phiên bản tài liệu và QR

### 4.1. Hợp đồng của `workflow.transition`

Service nhận contract ID, **action** (không phải status tùy ý), actor từ middleware, `expectedVersion`, idempotency key và dữ liệu đúng allowlist của action.

Trong một transaction:

1. Kiểm tra quyền truy cập hồ sơ, tìm kết quả idempotency cùng actor/route/key. Cùng key nhưng payload khác → 409 `IDEMPOTENCY_CONFLICT`; replay hợp lệ trả kết quả cũ, không chạy thêm bước.
2. Lock contract `FOR UPDATE`, kiểm tra `version === expectedVersion`; sai → 409 `STALE_VERSION`, frontend tải lại và yêu cầu thao tác lại. Không tự retry nghiệp vụ bằng version mới.
3. Kiểm tra source status, processing method, role, assignee, revision và dữ liệu bắt buộc theo bảng 4.3. Không cấp quyền toàn năng cho admin để bỏ qua guard dữ liệu.
4. Cập nhật đúng milestone của action, status/status_entered_at, version + 1. Cùng action này mới được tạo snapshot lương nếu đạt điều kiện mục 6.
5. INSERT **một** audit action cho mỗi thay đổi status; có thể thêm row nghiệp vụ riêng như feedback/file. Cập nhật SLA alert hiện hành đã được giải quyết; không xoá alert cũ.
6. INSERT outbox với dedupe key dựa trên event ID; lưu kết quả idempotency rồi commit. Lỗi bất kỳ → không có status/lương/audit/outbox nửa chừng.

`lastActivityAt` còn để hiển thị hoạt động, **không** là điểm bắt đầu SLA. Metadata edit/ghi chú tăng version nhưng không đổi `status_entered_at`. Không có đường khác ghi status ngoài engine, kể cả webhook, QR, batch hoặc dashboard.

### 4.2. Tài liệu dùng để duyệt

- Mỗi lần nộp là một `contract_revision`; giữ tất cả file/lượt nộp cũ. `current_revision_id` chỉ trỏ bản đang chờ duyệt hoặc bản được duyệt hiện hành.
- Nộp draft cần file DOCX/PDF hoặc Google Docs URL hợp lệ. Link-only vẫn cho nộp để giữ luồng hiện tại, nhưng **trước khi duyệt** cần bản file đóng băng của đúng revision. Người dùng export Docs và đính kèm bằng ô file hiện có/bổ sung tối thiểu; chỉ export tự động nếu có tích hợp Docs thật đã xác minh.
- Link-only đang chờ duyệt bổ sung file qua `POST /api/contracts/:id/revisions/:revisionId/snapshot`, chỉ Legal phụ trách/Admin, đúng revision/version; lưu file hash + uploader/time + audit, không thay status hay ghi thời gian nộp mới. Nếu cần đổi **nội dung** chứ không chỉ đóng băng bản đã nộp thì phải feedback/nộp revision mới, không dùng snapshot để thay file cũ.
- Lãnh đạo duyệt chính xác revision ID + file hash. File này là bản để in/gửi, không lấy nội dung Google Docs có thể đã thay đổi. Không tự tải URL người dùng nhập từ server.
- Feedback chỉ áp dụng bản đang chờ duyệt, yêu cầu lý do; tăng count đúng một lần, giữ bản bị feedback. Nộp lại tạo revision mới, không sửa file cũ.
- Đổi tên/giá trị/đối tác/ngày có ảnh hưởng pháp lý **sau duyệt** không được âm thầm sửa hồ sơ đã ký. Mặc định chỉ sửa ở `Chờ soạn thảo` hoặc `Chờ duyệt bản mềm`; trường đã đưa vào bản duyệt phải nộp revision mới. Đính chính sau ký do Admin ghi audit riêng, không thay nội dung tài liệu gốc (mục 14-D9).

### 4.3. Bảng chuyển trạng thái được phép

Mọi ô không có trong bảng đều bị từ chối; có quyền nhưng sai source status → 409 `INVALID_TRANSITION`, thiếu chứng cứ → 422 `MISSING_PREREQUISITE`. `legal` trong bảng chỉ là Legal được giao/owner của hồ sơ, không phải bất kỳ người có role Legal nào.

| Action / route | Từ | Sang | Actor | Guard và milestone |
|---|---|---|---|---|
| Create drafting request `/request-draft` | Chưa tồn tại | Chờ soạn thảo | admin | Active Legal assignee, deadline tương lai, đơn giá/policy từ server; requested_at = server now |
| Create `/manual` hoặc upload đã xác nhận | Chưa tồn tại | Chờ duyệt bản mềm | legal, admin | Metadata xác nhận + draft reference; ghi created_by, revision/cycle đầu; **không** tự tạo lương Legal nếu không có task được giao |
| `submit-draft` | Chờ soạn thảo | Chờ duyệt bản mềm | legal, admin hỗ trợ | Có revision mới hợp lệ; Legal đúng assignee; lưu submitted_at và người thực nộp |
| `feedback-draft` | Chờ duyệt bản mềm | Chờ soạn thảo | admin | Note bắt buộc, đúng revision đang chờ; tăng feedback trong transaction, mở khoảng xử lý sửa |
| `approve-soft-copy` physical | Chờ duyệt bản mềm | Chờ in | admin | Có frozen revision; người duyệt không phải người thực nộp; soft_approved_at = now; chốt lương Legal có task, tạo clerk work item nếu chưa có |
| `approve-soft-copy` digital | Chờ duyệt bản mềm | Chờ bản gửi lại | admin | Cùng guard duyệt; không tạo clerk work item, ghi digital_ready_at và soft_approved_at |
| `print` | Chờ in | Đang chờ ký | clerk, admin | Physical, approved file còn tồn tại, printCopies hợp lệ; gắn clerk phụ trách; printed_at = now |
| `sign` | Đang chờ ký | Chờ tạo vận đơn | clerk, admin | Physical, xác nhận đã ký/đóng dấu thực tế; signed_at = now; audit người **xác nhận**, không giả actor là Sếp |
| `waybill` | Chờ tạo vận đơn | Chờ shipper đến lấy | clerk, admin | Physical, đủ thông tin người nhận; mã không trùng từ vận đơn đã tạo thật bên ngoài hoặc kết quả provider đã xác minh; tạo shipment attempt; waybill_created_at |
| `confirm-pickup` | Chờ shipper đến lấy | Đang giao | VTP đã xác minh; clerk/admin xác nhận thực tế | Shipment hiện hành có mã; picked_up_at; chế độ manual cần xác nhận và note |
| `confirm-delivery` | Đang giao | Chờ bản gửi lại | VTP đã xác minh; clerk/admin khi manual | Đúng shipment, không dùng sự kiện cũ; delivered_at được ghi từ chứng cứ đã xác minh |
| `scan` | Chờ bản gửi lại | Hoàn tất | clerk, admin | Signed scan đã lưu bền vững; người dùng xác nhận đúng HĐ/đủ chữ ký; physical xác nhận nhận bản trả về và có beneficiary nếu task payable, digital xác nhận bản ký điện tử; received_back_at + archived_at |
| `archive` | Chờ bản gửi lại | Hoàn tất | clerk, admin | Đã có signed scan hợp lệ liên kết đúng contract/cycle, xác nhận tiếp nhận và beneficiary nếu task physical payable; không cho archive rỗng |
| `reject` | Đang chờ ký hoặc Chờ bản gửi lại | Bị từ chối ký | admin, legal, clerk | Note nói rõ bên từ chối/lý do; không trộn từ chối nhận bưu phẩm với từ chối điều khoản |
| `report-issue` | Chờ shipper đến lấy hoặc Đang giao hoặc Chờ bản gửi lại | Sự cố vận chuyển | clerk, admin; provider đã xác minh | Physical; issue gắn shipment và note, không tự phạt clerk |
| `redraft` | Bị từ chối ký | Chờ duyệt bản mềm | legal, admin | Note + **bản thảo mới** khác hash bản bị từ chối; mở cycle mới, vô hiệu approval hiện hành, không cộng thêm base pay tự động |
| `reship` | Sự cố vận chuyển | Chờ tạo vận đơn | clerk, admin | Physical, note, xác nhận bản giấy đủ điều kiện gửi; nếu mất/hỏng phải có chứng cứ bản thay thế đã ký và Admin xác nhận; giữ shipment cũ, chưa có mã mới thì chưa sang chờ shipper |
| `cancel` | Mọi trạng thái trừ Hoàn tất/Đã hủy | Đã hủy | admin | Lý do bắt buộc; huỷ xử lý nội bộ không có nghĩa đã huỷ được vận đơn tại provider; dừng job tạo mới, đối soát job đang chạy |

**Trạng thái cuối:** `Hoàn tất`, `Đã hủy` không có action quay lùi trong đợt này. Replay cùng idempotency key là ngoại lệ kỹ thuật trả kết quả cũ, không tạo thêm log. Không thêm nút "chuyển bất kỳ trạng thái" cho Admin.

### 4.4. Digital, redraft và reship

**Digital chuẩn:** `Chờ soạn thảo` (nếu có task) → `Chờ duyệt bản mềm` → Admin duyệt → `Chờ bản gửi lại` → signed scan → `Hoàn tất`. Hồ sơ nhập tay không có task bắt đầu ở chờ duyệt. Đây là làm rõ bước "bỏ qua in/bưu điện" trong `AGENTS.md`, không bỏ qua duyệt nội dung. Không xác nhận tính hợp lệ của chữ ký số CA bằng AI; người có trách nhiệm kiểm tra chứng cứ.

**Redraft:** giữ cycle/revision/approval/shipment cũ; cycle mới reset projection timestamp in/ký/giao/thu hồi hiện hành, giữ `uploaded_at` gốc. `waybillCode` hiện hành trống và callback chuyến cũ chỉ vào lịch sử chuyến cũ. Nếu cần theo dõi việc sửa, tạo work item non-payable gắn cycle mới, không mở lại task payable/feedback count đã chốt. Không đặt lại audit hoặc payroll entry đã chốt.

**Reship:** tăng attempt, shipment cũ được supersede, không xoá tracking. Khi bắt đầu gửi lại, reset projection waybill/pickup/delivery/received cho chuyến mới; không giả đã in/ký lại. Quy trình vẫn về `Chờ tạo vận đơn` như hiện tại nhưng guard bắt chứng cứ hợp lệ trước khi tiếp tục. Các bước bổ sung vật lý có thể ghi trong `contract_physical_events` mà không tự đổi status.

`processingMethod` chỉ đổi trước duyệt, có audit. Sau duyệt không dùng đổi physical → digital làm lối tắt hoàn tất hoặc né phạt.

### 4.5. Sửa metadata và ghi chú vật lý

- `PUT /api/contracts/:id/edit`: legal/owner hoặc admin, allowlist metadata của giai đoạn trước duyệt. Không nhận `status`, actor, lịch sử, lương, hệ số hoặc timestamp do client gán.
- Thêm `POST /api/contracts/:id/physical-notes`: clerk phụ trách hoặc admin, body chỉ note + expectedVersion. Server thêm event với actor/time/status hiện hành, trả DTO có `physical_notes` và `physical_step_history` projection. Không nhận mảng event từ browser.
- Ghi chú vật lý không tự đổi thông tin giao nhận; nếu cần đổi địa chỉ phải dùng edit có quyền trước tạo vận đơn, hoặc Admin đối soát/cập nhật vận đơn provider thật. Chip "đổi địa chỉ" không phải bằng chứng đã sửa đơn hàng.
- Metadata edit, file attach, claim/reassign, ghi nhận sự cố đều phải có audit phù hợp, kể cả fromStatus = toStatus.

### 4.6. QR — định danh bền vững, không phải giấy phép bỏ bước

1. Nhãn mới chứa **`contract.id` bất biến** đúng `AGENTS.md`; dưới QR vẫn in số HĐ cho con người. Không nhúng URL có token, email, thông tin hợp đồng hay mã vận đơn làm khoá hồ sơ.
2. Resolve trên server qua `GET /api/contracts/resolve?code=...`, không tìm trong một trang danh sách ở client. Hỗ trợ legacy số HĐ chính xác đã chuẩn hoá khi chỉ có một kết quả; với hồ sơ đổi số giữ alias số cũ để tem cũ không mất dấu. Alias không được trùng với ID/số/alias của hồ sơ khác; mơ hồ thì yêu cầu chọn lại, không lấy kết quả đầu tiên.
3. Giữ thao tác quét → hiển thị hồ sơ/hành động → xác nhận hiện có. Khi xác nhận, gọi `/api/contracts/:id/qr-transition` với `expectedAction`, `expectedVersion`, idempotency key cố định cho lượt đó. QR không thay cho auth/CSRF.
4. QR có thể uỷ quyền đúng action `print`, `sign`, `confirm-pickup`, hoặc `archive` **nếu đủ guard**. Không duyệt bản mềm thay Admin, không tự sinh vận đơn, không xác nhận đối tác đã nhận chỉ vì quét tem tại văn phòng. `Chờ tạo vận đơn` cần nhập/tạo mã; `Chờ bản gửi lại` cần signed scan trước khi archive.
5. Camera đọc nhiều frame/click đôi dùng cùng operation key; chỉ một transition. Muốn sang bước kế tiếp phải tải trạng thái mới và có lượt xác nhận mới, không tự lấy next status từ switch phía client.
6. Server trả DTO mới + allowedActions; scanner dùng kết quả đó, không tự gán trạng thái dự đoán. Không mở URL bất kỳ nếu QR chứa URL lạ.

---

## 5. Xác thực, phân quyền và audit đáng tin cậy

### 5.1. Mặc định triển khai: email + mật khẩu + session server

Đây là mặc định D1 để có hệ thống hoạt động không phụ thuộc tenant SSO chưa được cung cấp. **Không gọi nó là Google SSO.** Nếu chủ dự án chọn Workspace SSO, phải đổi riêng phần xác thực sang OIDC Authorization Code + PKCE/state/nonce, xác minh issuer/audience/email_verified và allowlist user; không coi việc gõ email là SSO. Không làm đồng thời hai phương án trong đợt đầu.

- Dùng Argon2id theo cấu hình hiện hành được kiểm chứng lúc triển khai; mật khẩu 12–128 ký tự, không trim âm thầm, không ghi log/body capture. Message login sai chung cho sai email/password/user chưa active để tránh dò tài khoản.
- Dùng `express-session` và `connect-pg-simple`; session regenerate sau login/đổi mức xác thực, chứa user ID + auth_version + thời điểm login, không dùng role client. Mỗi request đọc trạng thái/role hiện tại ở DB; disable/đổi role tăng auth_version và revoke phiên.
- Cookie production `__Host-contract_session`: HttpOnly, Secure, SameSite=Lax, Path=/, không Domain. Local HTTP dùng tên không có prefix `__Host-`, Secure=false chỉ ở development. Không lưu access token/session ID trong localStorage.
- Mặc định phiên hết sau 30 phút không hoạt động hoặc tối đa 8 giờ từ login; enforce cả phía server. Restart app không làm mất session còn hạn vì store ở PG. Logout destroy session và clear đúng cookie.
- `GET /api/auth/me` trả `{user, csrfToken}` hoặc 401. Frontend khởi động ở trạng thái đang kiểm tra phiên, không render dữ liệu hồ sơ trước `/me`; xử lý 401 bằng xoá state nhạy cảm + yêu cầu login, 403 chỉ báo thiếu quyền, không giả logout.
- `GET /api/auth/csrf` public/rate-limited cấp session anonymous ngắn hạn + synchronizer token cho login/invite/reset; refresh token sau login. Request ghi dùng header CSRF và kiểm tra Origin cùng site; webhook provider có cơ chế riêng mục 8.1. Cookie SameSite không thay thế CSRF.
- Rate limit login theo IP và tài khoản, mặc định 5 lần sai/15 phút, trả 429 + Retry-After; ngưỡng triển khai phải test qua proxy tin cậy. Rate limit tổng có thể ở reverse proxy; không dựa hoàn toàn bộ nhớ một process khi chạy nhiều instance.
- Không có đăng ký công khai. Bootstrap Admin bằng lệnh tương tác trên máy chủ, nhập mật khẩu qua stdin, không tham số command-line; không password mặc định trong SQL/env/log. Bootstrap chỉ khi chưa có Admin và phải có khoá chống chạy đôi.
- Invite: Admin tạo user invited và token một lần 48 giờ; token lưu hash, link được hiển thị **một lần** cho Admin để gửi bằng kênh an toàn. Không hiển thị "đã gửi email" khi chưa có mail adapter thật. `accept-invite` đặt mật khẩu và activate trong transaction. Reset do Admin khởi tạo token một lần 1 giờ; revoke phiên sau reset. Không cần xây email service ở đợt này.
- Remove user nghĩa là disable/revoke invite/session, giữ FK và lịch sử; không được disable/hạ role Admin active cuối cùng. Kiểm tra dưới khoá transaction để hai request không vô hiệu hết Admin.

### 5.2. Ma trận quyền — server thực thi, UI chỉ hỗ trợ

Mặc định D2 giữ cách nhìn chung hồ sơ hiện tại trong **một tổ chức nội bộ**; không coi đây là thiết kế cách ly hồ sơ theo phòng ban. Nếu chủ dự án cần hồ sơ mật theo assignee, phải chốt scope filter trước Phase 2 và áp dụng mọi endpoint/file/search/report, không chỉ bảng.

| Nghiệp vụ/dữ liệu | admin | legal | clerk |
|---|---|---|---|
| Xem danh sách/chi tiết, file hợp đồng trong scope tổ chức | Có | Có | Có |
| Tạo hồ sơ manual/upload không tự sinh quyền lương | Có | Có, là owner | Không |
| Giao task, đổi assignee/deadline/urgency | Có, có lý do khi sửa | Không | Không |
| Nộp/sửa draft | Có, lưu actor thật, không tự duyệt | Chỉ task được giao/hồ sơ owner | Không |
| Feedback/duyệt bản mềm | Có; không tự duyệt bản mình thực nộp | Không | Không |
| In/xác nhận ký/giao nhận/scan/archive | Có, guard không đổi | Không | Clerk phụ trách; physical claim lần in đầu, digital claim lần scan đầu nếu chưa được giao |
| Ghi chú vật lý | Có | Không | Clerk phụ trách |
| Reject | Có | Legal phụ trách | Clerk phụ trách |
| Report issue/reship | Có | Không | Clerk phụ trách |
| Redraft | Có | Legal phụ trách | Không |
| Cancel | Có | Không | Không |
| Lương toàn tổ chức, chốt/điều chỉnh, CSV toàn bộ | Có | Không | Không |
| Xem/xuất lương bản thân | Có | Chỉ beneficiary là mình | Chỉ beneficiary là mình |
| Settings nghiệp vụ (read, không bí mật) | Có | Projection cần cho công việc | Projection cần cho công việc |
| Sửa settings/users/secret, báo cáo quản trị, system audit | Có | Không | Không |

- Mọi route `/api/*` mặc định yêu cầu session, trừ nhóm auth public đã liệt kê, health tối thiểu và webhook xác minh provider. File download/check-id/resolve cũng có auth.
- DTO contract dùng allowlist: không trả `base_pay`, coefficients, calculated_payroll, snapshots/adjustments của người khác. View có quyền lương lấy qua payroll endpoint; không gửi cả bảng lương rồi giấu cột bằng React.
- `GET /api/settings` không trả raw URL Teams, key, credential, password hoặc danh sách user cho non-admin. Trạng thái tích hợp chỉ trả configured/healthy/last_error_redacted. Admin cũng chỉ thấy secret masked + configured, không được đọc lại secret nguyên văn.
- `x-user-role`, `updatedBy`, `uploadedBy`, `requestedBy` client gửi không được dùng làm identity. DTO input mới loại các trường này; client cũ gửi phải bị reject validation hoặc bỏ qua theo allowlist có test chứng minh không đổi actor.
- Claim clerk dưới lock: hai Clerk cùng in/scan, chỉ một claim/transition thắng. `clerk_assignee_id` là người phụ trách tác nghiệp cho cả physical/digital; physical đồng bộ assignee vào work item, digital chỉ gán tác nghiệp, **không tạo work item có lương**. Admin làm hỗ trợ physical phải chọn beneficiary Clerk active hoặc giữ task chưa đủ điều kiện chốt; không tự trả lương cho tài khoản demo. Reassign mở cần lý do, không đổi beneficiary entry đã chốt.

### 5.3. Audit và bảo mật HTTP

- Contract audit ghi action, from/to, actor ID + display snapshot, actor_kind user/service/legacy, timestamp server, request ID, reason, revision/shipment liên quan và diff allowlist. Không dùng log văn bản làm nguồn tính lại lương.
- System audit ghi invite/disable/role, thay cấu hình, login failure có giới hạn, reset, nhập legacy và điều chỉnh lương. Không ghi plaintext secret, session ID, token hoặc toàn văn tài liệu/AI response.
- HTTPS bắt buộc trên production để cookie và camera hoạt động. Same-origin frontend/API, không `CORS_ORIGIN=*` với credentials; `trust proxy` cấu hình theo proxy thực, không tin mọi IP tùy ý.
- Security headers qua middleware phù hợp; CSP triển khai cùng kiểm thử Vite/print, không tắt mọi bảo vệ chỉ để modal hoạt động. Body JSON mặc định tối đa 1 MiB; webhook giới hạn riêng sau xác minh tài liệu provider.
- SQL parameter/Drizzle, error handler chung không trả stack/connection string; `Cache-Control: no-store` cho dữ liệu nhạy cảm và response auth. Các request ghi cần request ID + timeout.

---

## 6. Lương SLA/KPI — một engine, có người nhận, có snapshot

### 6.1. Công thức, cấu hình và thời điểm chụp policy

Giữ quy tắc bất biến:

**Legal:** `roundVND(BasePay × max(0, 1 + UrgencyCoef + SlaCoef + QualityCoef))`.

**Clerk:** cùng quy tắc cộng hệ số: UrgencyCoef = 0, SlaCoef = PrintCoef + CourierCoef + RetrievalCoef, QualityCoef = AccuracyCoef. Vì vậy tương đương công thức nhiều hạng mục đang có trong `calculateClerkPayroll`, không đổi sang nhân từng hệ số.

- `src/utils/payroll.ts` là nơi duy nhất chứa công thức, tách hàm tính duration/rate thuần để test. Server payroll service cung cấp input/policy/`asOf` rõ ràng; frontend hiển thị server result, không tự tính số chính thức khi render hoặc export.
- Snapshot **toàn bộ** policy và base pay lúc task được giao (Legal) hoặc lúc bản mềm physical được duyệt để vào hàng chờ Văn thư (Clerk). Admin đổi settings sau đó chỉ ảnh hưởng task mới; không chỉ chụp base pay mà để tỷ lệ cũ biến đổi theo settings mới.
- Snapshot có policy version và engine version. Preview của task mở dùng chính snapshot đó; luôn gắn nhãn "Tạm tính", không là lương phải trả. Task thiếu assignee/thời điểm/chứng cứ trả `not_eligible` + lý do, không lấy mốc giả.
- Khi chốt ghi immutable payroll entry với đầu vào, milestones, các hệ số và số tiền. Đơn giá bằng 0 là hợp lệ và không fallback về 500.000/100.000.

### 6.2. Legal

**Điều kiện có lương:** task do Admin giao cho Legal active, có work item payable. Manual/upload tự tạo hồ sơ không tự sinh tiền công. Deadline/urgency đổi chỉ khi task mở, Admin nhập lý do; giữ lịch sử cũ và tính lại policy đầu vào được phép, không cho Legal tự tăng khẩn cấp/đơn giá.

**Urgency:** mức Admin chọn có hiệu lực; nếu không chọn, server suy từ thời lượng cam kết `D = deadline − requested_at > 0`:

| Thời lượng cam kết | Level | Rate mặc định |
|---|---|---|
| `D <= 1 giờ` | emergency | +30% |
| `1 giờ < D < 3 giờ` | urgent | +20% |
| `3 giờ <= D < 24 giờ` | priority | +10% |
| `D >= 24 giờ` | normal | 0% |

Bổ sung vào settings `urgencyNormalRate`, `urgencyPriorityRate`, `urgencyUrgentRate`, `urgencyEmergencyRate`, mặc định 0/10/20/30; snapshot cùng policy. Không tự nhận biết "ngoài giờ" khi chưa có lịch làm việc. Mặc định dùng giờ lịch 24/7, không tự bỏ thứ bảy/chủ nhật (D6).

**SLA soạn thảo — mặc định đề xuất D7:** tính thời gian xử lý thực của Legal đến lần nộp được duyệt, **không tính thời gian chờ Admin review**. Cộng các khoảng `requested → submit lần 1`, `feedback → submit lần 2`, ... đến revision cuối được duyệt. Chưa submit thì khoảng đang soạn kết thúc ở `asOf` để preview. Không chốt theo thời gian Admin bấm duyệt.

- Gọi tổng thời gian xử lý là `T`, thời lượng cam kết ban đầu là `D`; `savedRatio = (D − T) / D`.
- Khi `T <= D`: savedRatio ≥ 50%/25%/5% lần lượt nhận `slaEarlyMaxRate`/`slaEarlyMidRate`/`slaEarlyMinRate`; còn lại `slaOnTimeRate`.
- Khi `T > D`: trễ `<= slaLateMinHours` (mặc định 2) → `slaLateMinRate`; `<= slaLateMidHours` (6) → `slaLateMidRate`; lớn hơn → `slaLateMaxRate`.
- Rates mặc định +30/+20/+10/0/−10/−20/−30, thresholds đọc settings snapshot. So sánh trên milliseconds/decimal, không round giờ trước chọn bậc. `is_punctual = T <= D`.
- UI giữ deadline cam kết gốc, hiển thị thêm thời gian chờ review/hiệu chỉnh trong tooltip chi tiết để giải thích vì sao giờ nộp có thể sau deadline lịch nhưng vẫn trong SLA xử lý. Đây là thay đổi nghiệp vụ cần duyệt, không khẳng định là cách hiện tại đang làm.

**Chất lượng:** số feedback Admin yêu cầu sửa trong cùng task payable; 0/1/2/3+ lần → `feedback0Rate`/`feedback1Rate`/`feedback2Rate`/`feedback3Rate`, mặc định 0/−10/−20/−30%. Không có thưởng +10% mặc định ở server như bản cũ.

**Chốt:** lần Admin duyệt revision đầu tiên đáp ứng task. Các feedback trước duyệt được tính; redraft sau đối tác từ chối không tự tạo entry thứ hai hoặc sửa entry cũ. Nếu cần điều chỉnh trách nhiệm sau đó, dùng adjustment có lý do, không recompute lịch sử (D8).

### 6.3. Clerk

**Eligibility:** chỉ physical; đúng một work item payable cho một contract, có Clerk beneficiary, đủ milestone và ký nhận scan khi Hoàn tất. Không cộng tiền cho hồ sơ đang chờ in/chưa làm, không lọc digital bằng điều kiện `status !== Chờ soạn thảo` như code cũ.

Giữ cấu trúc các bậc trong engine Clerk hiện tại để ít thay đổi nghiệp vụ, nhưng sửa điểm bắt đầu đo và đưa ngưỡng cứng vào settings `clerkSlaRules`:

| Hạng mục | Khoảng thời gian | Bậc mặc định (thời lượng thực / thời lượng chuẩn) |
|---|---|---|
| In | Bản mềm được duyệt → lần xác nhận in đầu tiên của task | `<= 50%`: earlyMax; `<= 75%`: earlyMid; `<= 100%`: onTime; `<= 150%`: lateMin; `<= 200%`: lateMid; lớn hơn: lateMax |
| Tạo vận đơn | Xác nhận ký xong → vận đơn hợp lệ đầu tiên | `<= 50%`: earlyMax; `<= 100%`: earlyMin; lớn hơn: lateMin |
| Thu hồi | Shipment cuối giao đối tác thành công → xác nhận nhận signed copy trả lại | `<= 50%`: earlyMax; `<= 100%`: earlyMin; lớn hơn: lateMin |

- Thời lượng chuẩn tương ứng `slaPrintingHours=2`, `slaCourierHours=4`, `slaRetrievalDays=7`. Retrieval 50% của 7 ngày là **3,5 ngày**, không phải cố định 3 ngày như tài liệu cũ.
- `clerkSlaRules` chứa `printEarlyMaxPct=50`, `printEarlyMidPct=75`, `printOnTimePct=100`, `printLateMinPct=150`, `printLateMidPct=200`, `courierEarlyMaxPct=50`, `courierOnTimePct=100`, `retrievalEarlyMaxPct=50`, `retrievalOnTimePct=100`; giới hạn ngưỡng tăng nghiêm ngặt cho từng nhóm. Các rate lấy từ settings hiện có như bảng, kể cả rate bằng 0.
- Không đo in từ `uploaded_at`; không đo vận đơn từ `printed_at` vì có thời gian chờ Sếp ký. Không lấy `picked_up_at` thay `waybill_created_at` để lấp dữ liệu thiếu và không trừ lương Clerk vì shipper lấy chậm.
- Retrieval gồm thời gian chờ đối tác nên mặc định coi là KPI thu hồi/phối hợp, không quy kết lỗi cá nhân tự động. Chủ dự án phải duyệt cách thưởng/phạt này ở D10; không nhầm với SLA xử lý nội bộ 2 giờ.
- Sự cố chất lượng lấy **số incident quy trách nhiệm Clerk đã được Admin xác nhận**, không dùng feedback Legal và không tự cộng chỉ vì status là Sự cố vận chuyển/Bị từ chối ký. 0/1/2/3+ incident dùng các feedback rates như cấu hình hiện có; ví dụ lỗi do VTP không tự trừ Clerk.
- Reship/redraft không nhân số lần hưởng base pay. KPI in và vận đơn lấy lần đầu hợp lệ của work item; retrieval lấy shipment cuối hiện hành. Các lần làm lại được lưu riêng; không chọn lần nhanh nhất để xoá KPI xấu. Cần thưởng công sửa/gửi lại phải dùng adjustment được duyệt.
- Việc nhận bản trả về và lưu scan có thể cùng thao tác nhưng lưu rõ hai thời điểm nếu người dùng xác nhận khác thời điểm; không cho backdate tuỳ ý. Đính chính thời gian lịch sử chỉ Admin, lý do + audit, không âm thầm thay lương đã chốt.

### 6.4. Gán việc và dữ liệu đưa lên dashboard

- Legal beneficiary là assignee của task được giao; Clerk beneficiary là Clerk claim được task hoặc được Admin phân công. Không suy từ email trong file upload, tên role, requested_by hoặc `legal@test.com`.
- Digital vẫn có thể được Admin giao/Clerk claim để scan/lưu hồ sơ, nhưng gán người xử lý không đồng nghĩa đủ điều kiện hưởng lương Clerk theo chính sách mặc định.
- Mặc định một người chịu trách nhiệm mỗi work item; nhiều Clerk cùng thực hiện chỉ có một beneficiary. Chia tiền theo từng bước chưa thuộc phạm vi, phải chốt khác ở D11 trước khi mở.
- Danh sách nhân sự từ users active trong DB, không hard-code tên/email demo; không loại trừ bất kỳ email nào bằng điều kiện trong component.
- Dashboard phân biệt số task đang làm, đã duyệt/chốt, đã hủy, tạm tính và lương đã chốt. `Chờ duyệt bản mềm` không được tính là completed chỉ vì đã nộp.
- Tỷ lệ đúng hạn = số task đủ dữ liệu có `T <= D` / số task đã hoàn thành đủ dữ liệu; đúng hạn hệ số 0% vẫn là đúng hạn. Không dùng `printSlaCoef > 0` để tính tỷ lệ. Khi mẫu số 0 hiển thị `—`, không bịa 100%.

### 6.5. Chốt, kỳ lương, huỷ và điều chỉnh

- Entry Legal tạo trong cùng transaction approve; entry Clerk tạo trong cùng transaction hoàn tất hồ sơ physical. Unique work item + idempotency chặn duyệt/scan đôi sinh tiền đôi.
- Nếu work item physical payable chưa có Clerk beneficiary hoặc thiếu đầu vào bắt buộc, chặn hoàn tất bằng 422 để Admin phân công/đối soát trước. Không cho hồ sơ hoàn tất rồi âm thầm bỏ mất entry lương đáng lẽ phải ghi. Trường hợp legacy chưa đủ điều kiện phải qua đối soát ở mục 3.4, không tự áp quy tắc trả tiền mới lên lịch sử.
- Kỳ báo cáo theo `finalized_at` trong `Asia/Ho_Chi_Minh`, khoảng đầu kỳ inclusive/cuối kỳ exclusive. Không lấy tháng upload hoặc ngày Admin mở dashboard.
- Settings thay đổi, sửa thông tin liên hệ, đổi status, webhook trễ không làm đổi entry đã chốt. UI và CSV đọc cùng endpoint/result, cộng cùng phạm vi beneficiary/kỳ/lọc.
- Huỷ trước khi Legal được duyệt: work item chưa chốt nhận 0, giữ lịch sử. Huỷ sau khi đã duyệt: giữ lương Legal đã kiếm được; Clerk chưa hoàn tất thì không tự chốt. Khấu trừ có lý do dùng adjustment, không xóa entry.
- Admin tạo adjustment có delta có dấu + lý do; hệ thống không tự chi trả. Báo cáo tách gross entry, adjustments, net. Nếu net âm phải gắn nhãn cần kế toán xử lý, không sửa số gốc hay nói đã thu hồi tiền.
- DB trigger/role ngăn sửa entry; correction được ghi thêm, audit actor thật. Không có API "tính lại toàn bộ lương lịch sử bằng settings mới".

### 6.6. Test vector bắt buộc

| Trường hợp | Kết quả với cấu hình mặc định |
|---|---|
| Legal base 500.000, urgent +20%, sớm vừa +20%, 1 feedback −10% | 650.000 VND |
| Legal normal, đúng chính xác deadline xử lý, 0 feedback | 500.000 VND, is_punctual=true |
| Legal normal, trễ đúng 2 giờ, 1 feedback | 400.000 VND (bậc trễ ít) |
| Legal emergency +30%, tiết kiệm đúng 50%, 0 feedback | 800.000 VND |
| Cam kết 8 giờ, soạn 08:00–10:00, chờ review 10:00–12:00, sửa 12:00–14:00, 1 feedback, normal | T=4 giờ, sớm nhiều +30%, lương 600.000 VND |
| Tổng các hệ số làm multiplier < 0 | 0 VND, không lương âm |
| Base pay cấu hình bằng 0 | 0 VND, không fallback |
| Clerk base 100.000, in 1 giờ, tạo vận đơn 3 giờ sau ký, thu hồi 4 ngày, không incident | 150.000 VND (+30%/+10%/+10%) |
| Cùng hồ sơ Clerk nhưng có 2 feedback Legal | Vẫn 150.000 VND nếu không incident Clerk |
| Digital, chưa có Clerk payable work item | Không có lương Clerk; không tạo entry 100.000 |
| Settings đổi sau giao task/chốt | Task snapshot/entry cũ không đổi |
| Thiếu timestamp, deadline <= requested, timestamp kết thúc trước bắt đầu | Validation/eligibility error, không tính rate thưởng |

Test biên thêm: đúng 1h/3h/24h urgency; đúng và lệch 1 ms ở mọi threshold early/late/Clerk; feedback 0/1/2/3/4; double approve, double scan, reassign và cancel; rounding .5 VND; role/beneficiary không được phép.

---

## 7. File thật, scan thật, không gắn nhầm hồ sơ

### 7.1. Upload và download an toàn

- Thứ tự middleware: session → role/scope → CSRF → giới hạn request → Multer staging → kiểm tra nội dung → service/transaction. Không ghi file trước auth như B29. Chỉ nhận một file/request, tối đa **25 MiB/file**, số field/độ dài field bị giới hạn; proxy phải có giới hạn tương thích với overhead multipart.
- Original/draft nhận DOCX/PDF; scan nhận PDF/JPEG/PNG; attachment chỉ các loại được khai báo ở đây, không HTML/SVG/executable hoặc ZIP bất kỳ. Kiểm tra extension + magic bytes/container, không tin `Content-Type` browser. DOCX là ZIP có cấu trúc Office hợp lệ; giới hạn kích thước giải nén 100 MiB, số entry 2.000, text trích xuất 200.000 ký tự và thời gian parser 10 giây. Không dereference external relationship.
- Storage dùng UUID + extension xác minh; tên gốc chỉ metadata. Cấm path traversal, absolute path, null byte, control characters. Chuẩn hoá Unicode NFC; chỉ sửa lỗi latin1→UTF-8 khi nhận diện được byte lỗi và có test, không decode hai lần mọi tên tiếng Việt.
- `UPLOAD_DIR` mặc định production `/app/data/contracts`, nằm ngoài `dist`. DB chỉ lưu `storage_key` tương đối, server resolve + kiểm tra vẫn nằm trong storage root; không public static thư mục upload. App và worker dùng cùng persistent volume.
- File staged được kiểm tra, hash và atomic rename sang key cuối trước khi DB công bố file. DB transaction lưu metadata/audit/consumed upload; nếu rollback, file mồ côi được đánh dấu/dọn sau, không tham chiếu file chưa tồn tại. Không hứa filesystem và PostgreSQL có một transaction phân tán.
- Upload chưa tiêu thụ hết hạn sau 24 giờ; cleanup chỉ xoá file staging/mồ côi không được row/job nào tham chiếu, kiểm tra lại dưới lock. Không dùng tuổi file làm lý do xoá hồ sơ đã lưu trữ.
- Download xác thực session + scope + đúng quan hệ contract/file; trả Content-Type đã xác minh, `Content-Disposition` chuẩn có `filename*` UTF-8, `nosniff`, no-store. Không trả storage key/path thật. File mất trả 404 `FILE_NOT_AVAILABLE`, ghi cảnh báo vận hành, không tạo file giả thay thế.
- Nếu triển khai có antivirus, file quarantine không được tải xuống/duyệt đến khi pass; nếu không có, không hiển thị "đã quét virus". Không chạy macro, JavaScript trong PDF hoặc render HTML từ nội dung tài liệu.

### 7.2. Upload → gợi ý AI → người dùng xác nhận

Tách **upload tài liệu** khỏi **tạo hồ sơ pháp lý** để AI không tự ghi thông tin bịa:

1. `POST /api/uploads/contract` nhận file hợp lệ, tạo `uploads` owner-scoped và trả upload ID. Có thể enqueue trích xuất; `GET /api/uploads/:id` trả trạng thái queued/running/succeeded/failed/not_configured và suggestions nullable. File vẫn nằm trên server khi AI lỗi để không phải upload lại.
2. Modal hiện có hiển thị gợi ý và ô xác nhận/chỉnh sửa. AI thiếu field thì để trống; không tự điền tên đối tác, tiền, ngày ký hoặc mã HĐ ngẫu nhiên. Không tự lưu raw response AI vào log.
3. Người dùng xác nhận metadata, processing method và draft source; `POST /api/contracts` JSON với uploadId + metadata gọi cùng create service với `/manual`. Consume upload đúng owner, chưa hết hạn, chưa gắn hồ sơ khác, trong transaction tạo contract/revision/file/audit.
4. Nếu AI chưa cấu hình/lỗi, vẫn cho nhập tay với chính uploadId này. `/manual` nhận Google Docs URL như luồng hiện tại, hoặc uploadId; không buộc người dùng tạo một file Google Docs giả để đi tiếp.
5. API upload cũ gọi thẳng `POST /api/contracts` multipart không được lặng lẽ tạo hồ sơ từ AI; cập nhật frontend đồng thời. Request legacy thiếu xác nhận trả 422 `CONFIRMATION_REQUIRED`, không tạo dữ liệu nửa chừng.

Đây là thay đổi hành vi có chủ đích so với mockup; giữ modal và bố cục hiện tại, chỉ thêm bước xác nhận ngay trong vùng kết quả đang có.

### 7.3. Camera và đối khớp scan

- Giữ chụp nhiều trang, crop, xoay, filter, ghép PDF hiện có; đó là xử lý ảnh thật phía client, không gắn nhãn "AI xác thực chữ ký". Mặc định giới hạn 20 trang/lượt, ảnh tối đa 3.000 px cạnh dài trước ghép, PDF vẫn phải dưới giới hạn server. Hết bộ nhớ/quyền camera bị từ chối có đường tải file/chọn thủ công.
- Xoá hành vi `contracts.find(...Chờ bản gửi lại) || contracts[0]`. Không có đủ chứng cứ thì **không tự khớp**.
- Đối khớp ưu tiên QR ID chính xác → số HĐ chính xác → gợi ý OCR/AI nếu cấu hình. Không dùng chỉ tên đối tác hoặc trạng thái để gán file. Có nhiều kết quả hoặc khác biệt metadata thì yêu cầu chọn thủ công.
- Tìm kiếm/resolve ở server, bao phủ toàn bộ scope chứ không chỉ page hiện tại. Preview phải hiển thị mã HĐ, tên, đối tác, trạng thái và file chuẩn bị gắn; người dùng xác nhận rồi mới upload `/scan`.
- Không thêm phụ thuộc AI để hoàn tất scan thủ công. Nếu chưa có OCR thật, nút tự khớp chỉ dùng QR hoặc nói rõ chưa hỗ trợ; không chờ 1,5 giây rồi báo thành công.
- `/scan` chỉ nhận hồ sơ `Chờ bản gửi lại`, đúng cycle/version, có cam kết người dùng rằng bản scan đầy đủ và đã ký. Dù AI gợi ý đúng vẫn không được bỏ guard server.
- Khi modal đóng/unmount: stop mọi MediaStreamTrack, dừng vòng scan, hủy request có thể huỷ, revoke object URL; không để camera chạy nền. Upload thất bại giữ trang đã chụp để retry/chọn lại hồ sơ, không toast thành công.
- Cửa sổ in nhãn dùng React/DOM `textContent` hoặc escape mọi field đưa vào HTML. URL chỉ HTTPS, Google Docs URL allowlist đúng host/path, cấm javascript/data URL. CSV chống formula injection như mục 10.3.

---

## 8. Tích hợp: thực hiện thật hoặc báo chưa cấu hình

### 8.0. Hợp đồng chung và quản lý secret

- Mỗi adapter có trạng thái `not_configured`, `configured` (chưa kiểm tra), `healthy`, `degraded`, `disabled`. Không đặt "connected" chỉ vì có token hoặc user bấm toggle. DTO cũ `vtpConnectionStatus` chỉ còn projection tương thích, UI hiển thị trạng thái chi tiết mới.
- Adapter nhận dữ liệu allowlist tối thiểu, có timeout, phân loại retryable/non-retryable, request ID và log đã redact. Không log toàn văn hợp đồng, nội dung prompt/response chứa dữ liệu cá nhân hay URL secret.
- Gửi Teams/Drive/tạo đơn chạy qua outbox bền vững. Thông báo/backup lỗi không rollback nghiệp vụ đã commit, UI phản ánh riêng queued/failed/not_configured. Không ghi "đồng bộ thành công" từ `setTimeout`.
- `GEMINI_API_KEY`, VTP credentials và Drive service-account key chỉ server/env/secret mount; **không thêm input Gemini key trên frontend**. Teams webhook có thể là env-managed hoặc Admin nhập write-only trong form cũ, lưu AES-256-GCM ở `integration_credentials`, encryption key riêng từ env. Không lưu key giải mã trong DB, backup DB không chứa plaintext secret.
- Nếu secret được env quản lý thì UI chỉ hiện source và masked/configured, không cho ghi đè DB rồi tưởng có hiệu lực. Khi đổi env secret cần restart/rollout có chủ đích. Backup/restore phải bảo toàn key mã hoá bằng kênh riêng.
- Chặn SSRF cho outbound URL cấu hình: HTTPS, allowlist origin được operator duyệt, cấm private/loopback/link-local/metadata IP và redirect sang origin khác; kiểm tra DNS/egress phù hợp. Không proxy `aiExtractEndpoint` tùy ý từ settings. Hai ô endpoint/template AI cũ chỉ hiển thị thông tin adapter hoặc disabled có giải thích, không làm cửa gọi mạng tùy tiện.
- Trước bật từng provider, lưu trong `docs/integrations/<provider>.md`: URL tài liệu chính thức, ngày xác minh, phiên bản, auth/permission, mapping, timeout/retry, mẫu request/response đã ẩn PII và bằng chứng sandbox/test. Không coi ví dụ endpoint ở `ARCHITECTURE.md` là đã được xác minh.

### 8.1. Viettel Post

**Hai chế độ thật, không có simulator production:**

1. **Manual (mặc định khi chưa có tài khoản API):** Văn thư tạo đơn thật trên công cụ của VTP rồi nhập mã vào hệ thống; badge ghi "nhập tay, chưa đối soát API". Pickup/delivery do người có quyền xác nhận thực tế với note. Không giả rằng nhập mã nghĩa là app đã tạo đơn VTP.
2. **API (chỉ bật sau xác minh):** adapter tạo/tra cứu đơn theo tài liệu/tài khoản VTP được cung cấp, đủ sender/receiver/service/address codes/weight thực; không hard-code schema địa chỉ có thể đã đổi. Outbox tạo shipment pending; chỉ chuyển `Chờ shipper` khi provider trả mã thật và engine commit hợp lệ.

**Tạo vận đơn chống trùng:**

- Lưu external request key trước gọi provider, unique một create job/chuyến. Nếu provider có idempotency/correlation hỗ trợ thì dùng đúng tài liệu.
- Timeout sau gửi không chứng minh tạo thất bại. Tra cứu bằng external key/mã tham chiếu trước retry; nếu provider không cho tra cứu an toàn thì shipment đánh dấu `unknown_result`, job chuyển `awaiting_reconciliation`, yêu cầu operator đối soát, **không blind retry tạo hai đơn**.
- Người dùng huỷ hợp đồng trong lúc job gửi: khi nhận response phải lock/recheck trạng thái/version; không cho callback làm hồi sinh hồ sơ. Nếu đơn đã tạo tại provider thì lưu orphaned external result và yêu cầu huỷ/đối soát; không bỏ mất mã đơn.

**Webhook:**

- Không tin payload demo `{waybillCode,status,note,location}` là schema thật. Chuẩn hoá mã provider sang sự kiện nội bộ pickup/in_transit/delivered/shipping_issue sau xác minh tài liệu; giữ raw code và provider occurred_at riêng.
- Xác thực đúng cơ chế provider hỗ trợ (signature/token được chứng minh). Nếu không có signature đáng tin, inbound chỉ là tín hiệu để server tra cứu provider và xác minh kết quả trước transition. Nếu chưa thể xác minh bằng cách nào thì endpoint không được tự đổi status, giữ manual. Không tự đặt header HMAC rồi khẳng định VTP sẽ gửi.
- Verify signature cần raw body thì mount route/raw parser trước `express.json` đúng phạm vi. Giới hạn body và rate; không áp CSRF session cho provider webhook.
- Chỉ ACK sau khi sự kiện đã được ghi bền vững vào inbox; lỗi DB trả lỗi để provider retry theo tài liệu. Response không trả cả contract hoặc PII. Sự kiện đã biết trả ACK cùng kết quả, không nhân audit/lương.
- Deduplicate theo event ID provider; nếu thiếu, dùng fingerprint ổn định gồm provider, shipment, raw status, occurred_at và trường bất biến đã xác minh. Không dùng received_at làm khoá. Không có đủ khoá tin cậy thì tra cứu/đối soát thay vì phát sinh transition mỗi lần.
- Chỉ shipment hiện hành được dẫn động workflow. Callback chuyến cũ sau reship/redraft giữ trong tracking, không sửa status/timestamp hiện hành. Event đến trễ/đảo thứ tự không kéo lùi `Chờ bản gửi lại`, `Hoàn tất`, `Đã hủy`.
- Nếu delivered đến trước pickup: không bịa timestamp pickup. Giữ pending reconciliation, tra cứu lịch sử; có đủ chứng cứ thì chạy các action hợp lệ tuần tự, mỗi thay đổi một audit. Không đủ thì người vận hành đối soát manual có lý do.
- Từ chối nhận bưu kiện không tự ánh xạ thành "đối tác từ chối ký điều khoản". Mã không biết chỉ lưu tracking/cảnh báo, không đoán status.
- Thêm reconciliation định kỳ shipment API đang mở, mặc định mỗi 15 phút với batch/rate limit theo provider; không poll nếu chưa cấu hình. Mã không tìm thấy lưu inbox unmatched để Admin xử lý, không lộ tồn tại hồ sơ cho caller lạ.

### 8.2. Microsoft Teams

- Dùng cơ chế webhook/Workflows **thực sự được tenant hỗ trợ tại thời điểm triển khai**. Không mặc định connector/MessageCard cũ còn khả dụng chỉ vì tài liệu prototype nói vậy.
- Parse template JSON một lần và thay placeholder **ở giá trị chuỗi** của object, sau đó `JSON.stringify`; không replace text vào chuỗi JSON thô. Chỉ hỗ trợ placeholder allowlist title/text/contractId/status/timestamp; template sai bị 422 khi lưu, không ghi settings hỏng.
- Title/text có dấu nháy, xuống dòng, backslash, tiếng Việt phải tạo JSON hợp lệ. Escape nội dung theo loại card thực tế để tên hợp đồng không chèn markup/link tùy ý. Không gửi tiền lương/scan/PII không cần thiết vào kênh chung.
- Chỉ HTTP 2xx và response hợp lệ theo provider mới ghi succeeded. HTTP 400/401/403 là lỗi cấu hình cần can thiệp; 429 theo Retry-After, 5xx/network theo retry. `fetch` resolve không có nghĩa thành công.
- Outbox dedupe chống queue trùng; gửi qua mạng có thể **at-least-once**, timeout sau provider nhận có thể khiến thông báo trùng. Không hứa exactly-once nếu endpoint không hỗ trợ idempotency; kèm event ID để nhận biết.
- Chưa có URL thật: job marked skipped/not_configured, Admin thấy rõ; không gửi vào URL example và không báo "mô phỏng thành công".

### 8.3. Gemini

- Model lấy từ `GEMINI_MODEL`, không hard-code model không được xác minh. Mẫu env giữ model đã được operator xác nhận dùng được cho tài khoản; không tự quyết `gemini-3.5-flash` có tồn tại hoặc được cấp quyền.
- `GEMINI_API_KEY` chỉ server; SDK `@google/genai` được kiểm tra phiên bản lúc triển khai. DOCX qua Mammoth text; PDF/ảnh qua modality mà model được chọn thật sự hỗ trợ, không gửi text rỗng rồi yêu cầu tạo mẫu theo tên file.
- Prompt yêu cầu **không suy đoán** field không có, trả null và evidence ngắn nếu có. Structured output schema + server validation; JSON hợp lệ không chứng minh dữ liệu pháp lý đúng. Mọi kết quả là suggestion, cần xác nhận mục 7.2.
- Không coi chỉ dẫn trong hợp đồng là chỉ dẫn hệ thống: nội dung file là untrusted data, không cho model gọi tool, mạng hoặc lệnh. Không dùng AI để quyết định role, chuyển trạng thái, ghi lương hoặc tự chọn hồ sơ để gắn scan.
- Timeout mặc định 60 giây/job, concurrency giới hạn 2/worker, tối đa 2 retry cho lỗi tạm thời và có kiểm soát chi phí. Input giới hạn như mục 7.1, không gửi cả kho tài liệu. Quota hết/429/503: trạng thái lỗi trung thực, giữ upload, cho nhập tay.
- Không có key/model: `not_configured`, không fallback random/default partner/date/value. Không tự retry hàng loạt khi operator chưa bật lại budget.
- Trước bật production phải duyệt chính sách dữ liệu được gửi ra bên ngoài, tài khoản nhà cung cấp và yêu cầu bảo mật nội bộ (D13). Không dùng dữ liệu pháp lý thật để thử integration khi chưa được phép.

### 8.4. Google Drive

- Đây là **bản sao file**, không thay backup PostgreSQL hoặc storage gốc. Chỉ đánh dấu file đã backup khi provider trả remote ID thật và upload/metadata được xác minh.
- Xác minh quyền/quota của service account trên Shared Drive/thư mục cụ thể. Không giả định service account có thể ghi vào mọi My Drive. Không dùng chuỗi `root/contracts_backup_folder` như folder ID thật.
- Đường dẫn credential từ secret mount ngoài public root; folder ID cấu hình server/Admin, xác minh truy cập. Không tạo public share link mặc định.
- Job unique theo file ID + checksum + provider; metadata remote có local file ID làm đối soát. Sau timeout phải tra cứu trước tạo bản sao mới; lưu remote ID vào `integration_file_backups`.
- Retry thất bại → failed/dead và có nút retry Admin đúng file, không đổi contract về trạng thái cũ. Mặc định Hoàn tất cần scan lưu bền vững tại storage nội bộ, **không** bắt Drive thành công; badge backup hiển thị riêng (D12).
- Chưa có Drive credentials: not_configured; scan/workflow thủ công vẫn hoạt động. Không sinh ID `drv_*` ngẫu nhiên.

---

## 9. Worker, SLA và báo cáo

### 9.1. Job và mốc SLA

**Worker PostgreSQL, không cần Redis:** claim batch bằng transaction + `FOR UPDATE SKIP LOCKED`, gán lease/locked_until rồi commit trước gọi mạng. Worker chết thì lease hết được nhận lại; side effect dùng cơ chế dedupe/đối soát của từng provider. Mặc định tối đa 5 lần gửi Teams/Drive, backoff 30 giây nhân đôi có jitter, tối đa 30 phút, tôn trọng Retry-After; hết lượt → dead và cảnh báo. AI dùng ngân sách retry riêng ở 8.3, tạo đơn VTP có unknown_result riêng ở 8.1.

Job SLA chạy mỗi 60 giây và khi có action liên quan. Không đặt timer quét/ghi toàn file trong mỗi Express instance. Hai worker chạy cùng lúc vẫn chỉ tạo một alert/job cho cùng stage instance/rule nhờ khoá + unique constraint.

Mỗi lần vào trạng thái có `stage_instance_id` mới, `status_entered_at` và `status_due_at` được lưu theo policy áp dụng lúc vào bước. Settings mới không dời deadline của bước đang chạy âm thầm. Dùng clock truyền vào khi test, so sánh quá hạn `now > due_at` (đúng hạn chưa bị breach).

| Trạng thái | Bắt đầu/ngưỡng | Loại cảnh báo; liên hệ lương |
|---|---|---|
| Chờ soạn thảo | Tổng thời gian Legal đang soạn so với D; pause lúc chờ review | internal; theo cùng duration engine Legal |
| Chờ duyệt bản mềm | Vào bước chờ review, `slaInternalHours` | internal, người xử lý Admin; không trừ Legal trong lúc chờ |
| Chờ in | soft_approved_at, `slaPrintingHours` snapshot | internal, Clerk; cùng gốc SLA in |
| Đang chờ ký | printed_at, `slaInternalHours` | internal, chờ lãnh đạo; không trừ SLA tạo vận đơn của Clerk |
| Chờ tạo vận đơn | signed_at hoặc thời điểm reship sẵn sàng, `slaCourierHours` | internal; KPI lần đầu như 6.3 |
| Chờ shipper đến lấy | waybill_created_at, `slaInternalHours` | viettelpost, theo dõi lấy hàng, không tự phạt Clerk |
| Đang giao | picked_up_at của shipment, `slaViettelPostDays` | viettelpost; tracking mới không reset thời gian giao |
| Chờ bản gửi lại physical | delivered_at shipment hiện hành, `slaRetrievalDays` | counterparty/thu hồi, **không** gán ngưỡng nội bộ 2 giờ |
| Chờ bản gửi lại digital | digital_ready_at, `slaRetrievalDays` mặc định | counterparty/đợi signed copy, không phạt Clerk |
| Hoàn tất/Đã hủy/Bị từ chối ký/Sự cố vận chuyển | Không tự quét SLA xử lý tiêu chuẩn | Không spam; ngoại lệ nằm danh sách cần xử lý riêng |

- Bổ sung `counterparty` vào kiểu breach và schema/DTO/UI liên quan; tên 12 status giữ nguyên. UI `slaBreached` là projection alert chưa resolve, `slaBreachType` là loại chính; chi tiết trả danh sách alert.
- Unique alert theo contract + stage_instance_id + rule_version; Teams cảnh báo một lần lúc mở, không gửi lại mỗi phút. Resolve khi ra bước/hoàn tất/huỷ và giữ lịch sử. Metadata edit/ghi chú không resolve/reset alert.
- Không có milestone tin cậy sau import thì `requires_review`; không tính from uploaded_at cho mọi thứ. Chỉ tạo due_at sau đối soát đủ dữ liệu.
- Worker có heartbeat DB, backlog/dead metrics và structured log. Manual SLA check chỉ Admin qua route operations, dùng cùng service/unique constraint, không một bản logic riêng.

### 9.2. Báo cáo và số tổng

- SQL aggregate trong PG, không tải mọi contract/file/audit về RAM/browser. Cùng quyền, filter thời gian và scope giữa bảng, thẻ tổng, báo cáo và export; không tính tổng bằng page 20 dòng.
- `statusCounts` có đủ **12 khóa**, kể cả 0; tổng bằng tổng contract theo filter. Active work = không Hoàn tất/Đã hủy; completed/cancelled riêng. Không gọi tất cả hồ sơ chưa hủy là đang xử lý nếu đã hoàn tất.
- Giữ metric cũ `avgUploadToPrintHours` đúng nghĩa upload→print, **không** dùng làm KPI in; thêm `avgApprovalToPrintHours` để đo việc Clerk. `avgPrintToSignHours`, `avgTotalCycleHours` dùng milestone cùng cycle/trường hợp hợp lệ. Digital không lọt trung bình in/giao vận.
- Metric thiếu mẫu trả null + sample count, UI hiển thị `—`; không báo 0 giờ/100% khi chưa có dữ liệu. Thời lượng âm/legacy chưa đối soát bị loại và thống kê số bản ghi cần kiểm tra.
- Tổng giá trị chỉ cộng `value_kind=total` đã xác nhận, nhóm theo currency; show unquantified count riêng. Không lấy regex bỏ chữ rồi cộng mọi con số.
- Báo cáo lương lấy immutable entry + adjustment; preview nằm nhóm khác. Tỷ lệ đúng hạn theo boolean/elapsed, không theo hệ số dương. Tháng/khoảng ngày chuyển timezone ở server, `[from,to)` rõ ràng.
- Danh sách overdue trong response báo cáo chỉ là preview tối đa 20 dòng + `overdueTotal`; truy vấn danh sách đầy đủ qua API phân trang. Người không phải Admin không được gọi báo cáo quản trị.

---

## 10. Hợp đồng API và nối lại frontend

### 10.1. Quy ước chung

- Giữ các route nghiệp vụ đang dùng khi còn đúng mục đích; sửa quyền và validation. Các thay đổi wrapper/flow có chủ đích nằm ở bảng dưới, không cố tương thích với lỗ hổng bảo mật.
- Success entity là Contract DTO có thêm version/allowedActions cần cho guard; timestamp ISO UTC, date là YYYY-MM-DD, tiền decimal là chuỗi. File DTO chỉ metadata an toàn + URL API có auth.
- `GET /api/contracts` trả `{items,total,page,pageSize,statusCounts}`; page >= 1, pageSize mặc định 20/max 100. Search q tối đa 200 ký tự; filter status/method/assignee/date/overdue được validate; sort allowlist uploaded_at/value_amount/status_entered_at/partner_name và luôn thêm ID để thứ tự ổn định. Unknown monetary amount để cuối khi sort tiền. Desktop pagination/mobile load more gọi server, không cắt trên toàn bộ mảng local.
- `items` là `ContractSummary`, không nhét toàn bộ audit/tracking vào mỗi dòng. Khi mở hồ sơ, tải detail và lịch sử riêng; thiếu lịch sử trong summary không được giả thành "chưa có lịch sử". Detail giữ tên trường cũ qua mapper, history API phân trang tối đa 100 event/lượt.
- API lỗi thống nhất `{error,code,requestId,details?}`. `error` là message tiếng Việt để code UI hiện tại đọc được; details chỉ field validation và trạng thái/allowed action có quyền, không stack/SQL/secret.
- Status: 400 request sai cú pháp; 401 chưa xác thực; 403 thiếu quyền/CSRF; 404 không tồn tại/ngoài scope; 409 stale/transition/duplicate/idempotency conflict; 413 quá dung lượng; 415 loại file; 422 dữ liệu/điều kiện nghiệp vụ; 429 rate limit; 503 DB/provider bắt buộc chưa sẵn sàng. Tích hợp optional thiếu cấu hình không làm API danh sách thành 503.
- Mọi mutation workflow/create/feedback/settings/adjustment có `Idempotency-Key`; thao tác vào contract có expectedVersion, create không cần. Session và quyền được kiểm tra trước trả replay; không replay dữ liệu cho user đã bị disable/mất scope.
- Response auth/payroll/contracts no-store. API path không tồn tại trả JSON 404 **trước** SPA fallback; không trả HTML 200 cho API lỗi.

### 10.2. Danh mục route đích

| Route | Thay đổi/hợp đồng chính |
|---|---|
| `POST /api/auth/login` | Nhận email + password theo mặc định D1, session cookie; không email-only |
| `GET /api/auth/csrf`, `GET /api/auth/me`, `POST /api/auth/logout` | CSRF bootstrap, khôi phục phiên server và logout thật |
| `POST /api/auth/invite`, `DELETE /api/auth/invite/:email` | Admin-only; invite/disable, giữ lịch sử, bảo vệ Admin cuối |
| `POST /api/auth/accept-invite`, `POST /api/auth/reset-password` | Token một lần + mật khẩu; public có rate limit/CSRF, lỗi không lộ user |
| `POST /api/auth/users/:id/reset` | Admin tạo link reset một lần, không trả password |
| `GET /api/settings`, `POST /api/settings` | Safe projection + version; write allowlist, secret write-only; user management không qua ghi settings.users |
| `POST /api/uploads/contract`, `GET /api/uploads/:id` | Upload/extraction trước xác nhận, owner/admin scope, TTL |
| `POST /api/contracts`, `POST /api/contracts/manual` | Create service chung; metadata xác nhận + uploadId/Docs, actor từ session |
| `GET /api/contracts` | Phân trang/filter/sort, scope và DTO redaction |
| `GET /api/contracts/check-id/:id`, `GET /api/contracts/resolve` | Check unique/resolve QR phía server, auth, validate input |
| `GET /api/contracts/:id` | Detail gồm file/audit projection có quyền; refresh sau thao tác/409 |
| `GET /api/contracts/:id/audit`, `GET /api/contracts/:id/tracking` | Lịch sử phân trang/cursor có quyền, hiển thị đủ qua modal hiện có |
| `GET /api/contracts/:id/files/:fileId` | Streaming file private có auth, không filePath |
| `POST /api/contracts/request-draft` | Chỉ Admin; không tin basePay/actor từ client |
| `POST /api/contracts/:id/submit-draft` | Draft/revision mới, hỗ trợ file hoặc Docs, đúng assignee/status |
| `POST /api/contracts/:id/revisions/:revisionId/snapshot` | Đóng băng file của revision link-only đang chờ duyệt, có audit/hash/version, không đổi nội dung bản đã có file |
| `POST /api/contracts/:id/feedback-draft`, `.../approve-soft-copy` | Admin review đúng revision, workflow + payroll transaction |
| `POST /api/contracts/:id/print`, `.../sign`, `.../waybill` | Guard physical, assignee, evidence; manual waybill không giả API |
| `POST /api/contracts/:id/confirm-pickup`, `.../confirm-delivery` | Xác nhận thực tế có note, dùng cùng workflow với provider |
| `POST /api/contracts/:id/scan`, `.../archive` | Chỉ chờ bản trả về, signed scan hợp lệ, không archive rỗng |
| `POST /api/contracts/:id/qr-transition` | Delegation một action an toàn, expectedAction/version, không next-status tự do |
| `POST /api/contracts/:id/reject`, `.../report-issue`, `.../redraft`, `.../reship`, `.../cancel` | Guard/role/lý do theo 4.3; redraft nhận revision/file mới |
| `PUT /api/contracts/:id/edit` | Metadata allowlist trước duyệt; không status/payroll/timestamp/history |
| `POST /api/contracts/:id/physical-notes` | Lưu event ghi chú thật thay client gửi cả history vào edit |
| `POST /api/contracts/:id/assignments` | Admin reassign task mở/deadline/urgency có lý do; không sửa entry đã chốt |
| `POST /api/contracts/:id/incidents` | Clerk/Admin ghi nhận, chưa phạt khi chưa xác nhận |
| `POST /api/clerk-incidents/:id/confirm` | Admin xác nhận trách nhiệm trước chốt; sau chốt cần adjustment riêng |
| `GET /api/payroll`, `GET /api/payroll/export` | Own/admin scope, kỳ/lọc thống nhất, entry + preview tách biệt |
| `POST /api/payroll/:entryId/adjustments` | Admin-only, lý do, delta, immutable ledger |
| `GET /api/dashboard/reports` | Admin-only SQL aggregate với filter, sample count |
| `POST /api/webhooks/vtp` | Provider verification/inbox, không dùng browser role/session |
| `POST /api/contracts/:id/shipments` | API mode yêu cầu tạo đơn thật, trả 202 + operation ID trước khi có mã |
| `GET /api/operations/jobs`, `POST /api/operations/jobs/:id/retry` | Admin đọc lỗi/retry job đủ điều kiện; không blind retry unknown VTP result |
| `POST /api/operations/sla-check`, `GET /api/operations/logs` | Thay chức năng vận hành của simulator; Admin-only, log đã redact |
| `POST /api/integrations/:provider/test` | Admin kiểm tra adapter đã cấu hình, không nhận URL/secret tuỳ ý trong body |
| `/api/sim/*`, `POST /api/settings/toggle-vtp` | Không đăng ký trên production, trả 404; không để hidden frontend nhưng API vẫn mở |
| `POST /api/contracts/:id/status` | Client cũ nhận 410 `USE_WORKFLOW_ACTION`; UI bỏ menu override, không thêm route gán status tự do |
| `GET /health/live`, `GET /health/ready` | Live tối thiểu; ready kiểm tra DB/migration/storage, không trả config nhạy cảm |

Route tĩnh `/resolve`, `/check-id`, `/request-draft` được khai báo trước route `/:id` tương ứng để tránh match nhầm. Các thư mục `...` trong bảng route là cùng prefix `/api/contracts/:id`, không phải route literal.

### 10.3. Yêu cầu frontend giữ UI nhưng dùng dữ liệu thật

- `api.ts`: một fetch wrapper cùng origin, cookie/session, CSRF, request ID, typed error. Bỏ header role và actor field khỏi request. Không tự retry POST bằng key mới; network timeout giữ operation key cũ cho retry người dùng xác nhận.
- `useContracts.ts`: trạng thái auth loading/authenticated/anonymous; fetch theo quyền/tab, không gọi reports admin từ tài khoản Clerk/Legal; 401 xoá contracts/reports/payroll/selected detail khỏi RAM. Logout clear toàn bộ state nhạy cảm, camera và request đang chạy.
- Không dùng localStorage làm nguồn danh tính; xóa khóa legacy `contract_auth_user` lúc khởi động mà không xoá tuỳ chọn UI khác. Page mới gọi `/me` mỗi lần, đổi role/disable phản ánh ở server ngay.
- Chuyển bảng/filter/sort sang query server; search debounce + AbortController hoặc sequence guard để response cũ không ghi đè query mới. Thẻ tổng dùng server totals, scanner resolve không phụ thuộc list page.
- Nút nghiệp vụ đọc `allowedActions` từ server và role để hiển thị, server vẫn kiểm tra lại. Disable pending chống double click, giữ form khi lỗi; chỉ đóng modal/toast thành công sau response commit thành công. Hook phải throw/return failure để component không hiểu nhầm promise resolve là thành công.
- Progress upload dùng XHR upload progress nếu muốn phần trăm byte; trong thời gian AI xử lý dùng indeterminate + tên bước thật. Không tăng 15%/400 ms giả làm phần trăm truyền file. Camera compile có thể đo số trang thực như hiện tại.
- Sửa các câu hứa sai tối thiểu: SSO giả thành đăng nhập nội bộ nếu chọn password; "AI đã trích xuất" chỉ khi có kết quả thật; "Đã lưu Drive" chỉ khi backup succeeded; lỗi mạng/check-id không được hiểu là `exists=false` chắc chắn.
- Payroll dashboard bỏ import engine để tính tiền chính thức trên render/export; chỉ render server breakdown/snapshot. CSV tải từ server cùng filter, UTF-8 BOM, escape quote/newline và chặn công thức ở text cell bắt đầu bằng `=`, `+`, `-`, `@` sau ký tự điều khiển/khoảng trắng. Số tiền numeric có kiểu riêng, không biến tên đối tác thành công thức Excel.
- Giữ responsive, modal history, camera flow, nhãn QR, bộ lọc, màu trạng thái; chỉ thêm trường xác nhận/lỗi/phân công/snapshot tối thiểu. Không thay thư viện icons (Lucide) hoặc animation (Motion/CSS) và không đổi bố cục toàn ứng dụng.

---

## 11. Build, triển khai và vận hành

### 11.1. Công cụ và lệnh đích

Giữ Node.js 22 theo dự án, PostgreSQL 16 và npm lockfile. Thêm `pg`, `drizzle-orm`, validation schema (Zod), Argon2id, session + PG store, security middleware; dev thêm Drizzle Kit, Vitest, Supertest và Playwright. Chốt version tương thích khi triển khai và commit lockfile, không nâng major toàn bộ stack ngoài phạm vi.

**Các lệnh dưới đây là yêu cầu cần bổ sung, chưa phải lệnh đều đã có/chạy xanh trong bản hiện tại:**

| Lệnh | Hợp đồng đích |
|---|---|
| `npm ci` | Cài đúng lockfile, không phụ thuộc package cài global |
| `npm run dev` | `tsx server.ts`, Vite middleware HMR và DB thật riêng development, không đọc JSON |
| `npm run lint` | Type-check frontend **và** backend/scripts/config; không chỉ `src` |
| `npm run build:frontend` | Vite build `dist/` |
| `npm run build:server` | esbuild ESM Node 22, compile app/worker và CLI scripts vào `dist-server/`, package externals được khai báo rõ |
| `npm run build` | Chạy cả frontend + server build, không chỉ Vite |
| `npm run start` | Chạy JavaScript `node dist-server/server.js`, không trông chờ Node tự chạy TS |
| `npm run worker` | `node dist-server/server/worker.js`, durable queue/SLA/reconciliation |
| `npm run db:generate`, `npm run db:migrate` | Tạo migration Drizzle và apply có khoá; local dùng CLI TS, image production dùng JS đã compile |
| `npm run bootstrap:admin` | Bootstrap tương tác, không tài khoản/mật khẩu mẫu |
| `npm run migrate:json-to-pg -- --source <path> --dry-run` | Audit nhập dữ liệu, không ghi; `--apply` phải chủ động |
| `npm run test:unit` | Engine/validation/guard/template tests bằng Vitest, không cần provider thật |
| `npm run test:integration` | API + PostgreSQL test riêng, transaction/concurrency/auth/file/job/migration |
| `npm run test:e2e` | Playwright UI desktop/mobile theo role, có backend + PG test |

- Thêm `tsconfig.server.json` include `server.ts`, `server/**/*.ts`, `scripts/**/*.ts`, `drizzle.config.ts`; frontend tsconfig không import server secrets. `lint` phải báo lỗi nếu cố tình đặt lỗi kiểu vào một file backend được test bằng fixture/tooling check.
- Chỉ `NODE_ENV=production` chọn phục vụ build. Có `dist/` không làm development đổi mode. Vite là dependency development, được dynamic import chỉ trong nhánh dev; production image không cần cài Vite/tsx để chạy app.
- Tách app factory khỏi listen/timer: integration test import `createApp` không mở port, không seed, không gọi provider. Test database qua `TEST_DATABASE_URL` bắt buộc khác development/production, account test chỉ có quyền trên DB/schema test; test runner từ chối URL không đúng database test. Không chạy cleanup trên database vận hành.
- Production build resolve chính xác đường dẫn `dist`, `drizzle`, uploads theo config/image, không trông chờ TS source tương đối. Smoke-test image với **chỉ production dependencies** để bắt module thiếu khi Vite/server bundle chạy. Khi làm từng Phase, build chỉ liệt kê entrypoint đã có; thêm worker/CLI vào build ngay trong Phase tạo file đó, không dựng entrypoint giả để đủ lệnh.

### 11.2. Container và cấu hình

- Thêm Dockerfile multi-stage Node 22, build frontend/backend, copy migration SQL + CLI đã compile và production dependencies. Runtime user không phải root; thư mục uploads có quyền ghi cần thiết, không toàn filesystem. `.dockerignore` loại `.env`, JSON/demo data, file hợp đồng, backup và node_modules máy chủ.
- Compose đích gồm `postgres`, `migrate` one-shot, `app`, `worker`; app/worker chỉ lên sau migration thành công. `migrate` dùng DB migration role riêng; app/worker dùng runtime role không có DDL/audit delete. Có thể cùng image, khác command.
- Bỏ mount chồng cả `./data:/app/data`. Chỉ một volume `contracts_uploads:/app/data/contracts` dùng chung app/worker; `pgdata` riêng. Không công khai Postgres ra Internet, mặc định chỉ internal network; mở localhost cho dev trong override riêng.
- Container app vẫn `0.0.0.0:3000`. Reverse proxy TLS bên ngoài tới port này; env port mapping không đổi cổng lắng nghe nội bộ. Proxy cấu hình upload/timeouts và trusted forwarding đúng, không chuyển request file thành 413 khó hiểu.
- Health live trả 200 khi process còn phục vụ; ready 200 khi DB, migration version và storage readiness OK, nếu không trả 503 với thông tin tối thiểu. Kiểm tra quyền storage ở startup/chu kỳ có cache, không ghi file probe mới mỗi lần health request public.
- Worker heartbeat mặc định mỗi 30 giây, quá 120 giây cảnh báo. Tích hợp optional down không làm liveness chết/restart vòng lặp; backlog/dead jobs phải quan sát được.
- Graceful shutdown: ngừng nhận request/job mới, hoàn tất transaction đang chạy trong khoảng grace, đóng HTTP/pool; lease công việc dang dở hết hạn để worker khác đối soát. Không dùng process exit khi file/DB chưa hoàn tất commit.

**Env cần tài liệu hoá:**

| Nhóm | Biến |
|---|---|
| Core bắt buộc production | `NODE_ENV`, `DATABASE_URL` runtime, `MIGRATION_DATABASE_URL` chỉ migrate, `PUBLIC_APP_URL` origin HTTPS, `SESSION_COOKIE_SECRET` mạnh, `UPLOAD_DIR` |
| Secret write-only nếu bật | `INTEGRATION_ENCRYPTION_KEY` 32 byte, có cơ chế key version/rotation và backup riêng |
| Optional AI | `GEMINI_API_KEY`, `GEMINI_MODEL`, flag bật AI/cost limits |
| Optional Teams | `TEAMS_WEBHOOK_URL` hoặc ciphertext DB, allowlist outbound origins |
| Optional VTP | `VTP_BASE_URL`, credential đã xác minh, sender/service config thực, webhook verification config thực |
| Optional Drive | `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` secret mount |
| Test | `TEST_DATABASE_URL`, test upload root, provider stub base URL chỉ trong test |

Không giữ secret example như cấu hình hợp lệ; startup từ chối mật khẩu/cookie secret mặc định ở production. Bỏ hoặc ghi rõ `JWT_SECRET` không dùng nếu chọn session; không tạo JWT cho đủ biến cũ. `CORS_ORIGIN=*` không là cấu hình production được chấp nhận.

### 11.3. Backup, restore và quan sát

- Mặc định backup hàng ngày PostgreSQL (`pg_dump` custom format) + toàn bộ storage + manifest checksum/migration version; giữ 30 ngày theo policy owner duyệt, mã hoá và copy sang nơi khác máy chủ. Drive file-copy không thay thế việc này.
- Đảm bảo DB/file cùng mốc: maintenance read-only tạm thời trong lúc snapshot hoặc dùng cơ chế snapshot nhất quán đã chứng minh; không dump DB rồi tuỳ tiện copy storage đang thay đổi mà nói chắc chắn nhất quán.
- Thử restore trên **DB/volume riêng**, tắt outbound worker ở môi trường restore cho đến khi đối soát tránh gửi lại thông báo/tạo đơn. Kiểm tra count, FK, hash, tải được file, session/login, entry lương và nguồn provider correlation.
- Mục tiêu ban đầu đề xuất RPO <= 24 giờ, RTO <= 4 giờ, chưa phải SLA đã đạt. Phải ghi thời gian thực tế lần diễn tập và điều chỉnh theo yêu cầu doanh nghiệp.
- JSON log có timestamp/level/requestId/actorId/action/duration/errorCode; redact secrets/PII. Theo dõi 5xx, auth failures bất thường, disk space, DB connection pool, worker heartbeat, outbox lag/dead và backup gần nhất.
- Hạn lưu raw inbox/AI suggestions/log kỹ thuật mặc định 30 ngày, dọn bằng job riêng đã mask; audit hợp đồng/lương không tự xoá theo chính sách log. Thay policy lưu trữ pháp lý cần duyệt D14.
- Có runbook: DB down, đầy đĩa, worker chết, provider quota, webhook duplicate/out-of-order, sai scan, quên password, secret rotation, restore và rollback release. Không khuyến cáo `docker compose down -v` trên hệ thống đang có dữ liệu.

---

## 12. Kế hoạch triển khai tuần tự và tiêu chí nghiệm thu

> **For agentic workers:** Chỉ triển khai khi chủ dự án yêu cầu code và duyệt các quyết định bắt buộc ở mục 14. Dùng `executing-plans` để làm theo Phase có checkpoint; không tự spawn subagent hoặc tự deploy. Các checkbox dưới đây đều là **việc chưa triển khai**, không phải kết quả đã đạt.

**Goal:** chuyển hệ thống hiện có sang PostgreSQL + danh tính thật + workflow/lương đáng tin, không redesign UI.

**Architecture:** modular monolith Express phục vụ React và một worker PostgreSQL; engine lương thuần dùng chung; audit/outbox trong transaction, tích hợp optional có trạng thái trung thực.

**Tech stack:** React 19, TypeScript, Vite, Tailwind v4, Express, Node 22, PostgreSQL 16, Drizzle, Vitest/Supertest/Playwright, Docker Compose.

### 12.0. Cách chạy mỗi task và gate chung

1. Đọc spec + quyết định được duyệt + file thực tế; không thay cấu trúc/tên trường ngoài phạm vi task.
2. Viết test cho hành vi cụ thể và chạy để thấy fail đúng lý do; nếu test pass trước sửa thì bổ sung ca tái hiện đúng bug. Với build/infra, kiểm tra cấu hình lỗi hoặc smoke-test đóng vai trò test đỏ.
3. Thực hiện thay đổi nhỏ nhất, chạy test mục tiêu đến pass; sau đó lint/build/test hồi quy liên quan. Tài liệu này không chèn code triển khai vì yêu cầu bàn giao chỉ là spec/plan.
4. Chạy smoke-test Phase, lưu output/ảnh/report trong `docs/evidence/phase-N/` đã redact. Cập nhật `README.md`, `API.md`, `SCHEMA.md`, `ARCHITECTURE.md`, `AGENTS.md` khi có thay đổi tương ứng.
5. Review diff và scope; nếu repo đã được khởi tạo theo sự đồng ý của owner thì commit nhỏ theo task. Hiện chưa có Git, **không tự init/push** hoặc ghi đè file của người khác. Không tạo worktree bằng giả định có repo.
6. Chỉ sang Phase kế tiếp khi gate pass; nếu credentials chưa có thì đánh dấu integration disabled/not_configured và phân biệt gate core với gate tích hợp thật. Không báo full production integration đã xong nhờ mock test.

### Phase 0 — Chốt baseline và hàng rào kiểm thử

**Files:** đọc toàn bộ tài liệu hiện có; sửa `package.json`, `package-lock.json`, `tsconfig.json`, `server.ts`; tạo `tsconfig.server.json`, `vitest.config.ts`, `playwright.config.ts`, `tests/setup.ts`, `server/app.ts`, `DECISIONS.md`, `.gitignore`, `.dockerignore`.

- [ ] P0.1 Chụp bản sao source/JSON trước sửa, lập manifest SHA-256; lấy quyết định D1–D14. Không loại bỏ seed/file cũ khi chưa backup/phân loại.
- [ ] P0.2 Cài dependency theo lockfile và ghi lỗi baseline; thêm typecheck backend/scripts, app factory không auto listen, script test/build server. Sửa lỗi type thật theo phạm vi, không tắt strict/biến mọi thứ thành any để lint xanh.
- [ ] P0.3 Tạo test DB/storage riêng và fixture do test tự tạo, không nhập seed prototype vào production. Provider stub chỉ ở test, không đường simulator trong app production.
- [ ] P0.4 Chạy bản cũ trong môi trường **cách ly không public/outbound** để chụp baseline desktop 1440×900 và mobile 390×844: login, home/tasks/contracts, create form, history, payroll hai tab, reports, settings, scanner preview, QR label. Bản cũ có auth hỏng nên không đưa lên Internet để lấy ảnh.
- [ ] P0.5 Lưu `docs/evidence/phase-0/baseline.md`: dependency/runtime version, lỗi có sẵn, ảnh thật, màn hình chưa chụp được và nguyên nhân. Không tự vẽ ảnh làm bằng chứng baseline.

**Gate:** `npm run lint`, `npm run build`, `npm run test:unit`; có ít nhất một test API qua app factory và một test cho biết backend nằm trong type-check. Smoke: dev vẫn HMR sau khi có thư mục dist. Nếu baseline chưa chạy được thì sửa blocker tooling tối thiểu, ghi rõ chứ không bỏ qua gate.

### Phase 1 — PostgreSQL, schema và nhập liệu an toàn

**Files:** tạo `server/db/client.ts`, `server/db/schema.ts`, `drizzle.config.ts`, `drizzle/` migrations, `scripts/db-migrate.ts`, `server/modules/contracts/repository.ts`, `server/modules/contracts/dto.ts`, `server/modules/settings/repository.ts`; sửa `data/init-db.sql`, `scripts/migrate-json-to-pg.ts`, `server.ts`, `src/types.ts`, `src/services/api.ts`, `src/hooks/useContracts.ts`, `src/components/ContractTable.tsx`, `docker-compose.yml`, `.env.example`, `SCHEMA.md`.

- [ ] P1.1 Tạo schema/constraint/index mục 3, roles runtime/migrate, migration có lock; DB mới chỉ có cấu hình, không user/hợp đồng demo. Kiểm tra init snapshot tương đương chạy migrations trên DB rỗng.
- [ ] P1.2 Thay toàn bộ readDb/writeDb/readLogs/writeLog dùng cho runtime bằng repository PostgreSQL. DB lỗi phải fail rõ/readiness 503, không fallback JSON/seed.
- [ ] P1.3 Tạo DTO allowlist, typed tiền/ngày, ID UUID mới, unique số HĐ + identifier registry. Nối đồng thời ContractPage/summary, server filter/sort/pagination/totals vào API client/hook/bảng và detail fetch để không phá UI giữa các Phase. Viết test normalization, 0 value, null/date, FK liên kết sai contract và page/total nhất quán.
- [ ] P1.4 Viết lại migration theo 3.4, có dry-run/apply, report chính xác, ổn định history ID, missing file và legacy_unverified; **chỉ chạy trên dữ liệu test** nếu chưa được owner cho phép nhập thật.
- [ ] P1.5 Đồng bộ schema/types/init SQL/migration/SCHEMA và test nhập hai lần không tăng row; kết nối DB lỗi exit khác 0; transaction fail không còn dữ liệu một phần.

**Gate:** `npm run db:migrate`, lint/build/unit/integration. Smoke: DB rỗng vẫn rỗng sau restart; tạo dữ liệu qua test/API kiểm soát, restart vẫn còn; mất DB không sinh lại JSON. Chưa mở môi trường này ra ngoài trước Phase 2.

### Phase 2 — Danh tính thật, RBAC và workflow transaction

**Files:** tạo `server/modules/auth/{routes,service,middleware,repository}.ts`, `server/modules/contracts/{routes,validation,service,revisions}.ts`, `server/modules/workflow/{actions,guards,transition}.ts`, `server/http/{errors,csrf,security}.ts`, `scripts/bootstrap-admin.ts`; sửa `server.ts`, `src/services/api.ts`, `src/hooks/useContracts.ts`, `src/components/AuthModal.tsx`, `src/App.tsx`, `src/types.ts` và schema/docs liên quan.

- [ ] P2.1 Bootstrap/invite/password login/PG session/CSRF/me/logout/reset thật; revoke khi disable/đổi role, bảo vệ Admin cuối dưới concurrency. Không có demo quick login hoặc role switch.
- [ ] P2.2 Áp mặc định auth trên mọi route dữ liệu/file/settings/report, redaction phía server. Gửi header admin giả phải không có tác dụng. Quyền assignee/beneficiary chạy ở query/service, không chỉ component.
- [ ] P2.3 Engine theo bảng 4.3: row lock/version/idempotency, guard revision/milestone, audit/outbox atomic. Test toàn bộ status × action × role, gồm invalid paths và final state.
- [ ] P2.4 Triển khai cycle/revision/snapshot, digital qua duyệt, redraft cần nội dung mới, reship giữ shipment cũ. Giữ upload file thật hiện có, chuyển auth trước Multer và ghi hash để guard duyệt dùng được; hardening/storage lifecycle đầy đủ ở Phase 4. Test bằng file thật trong test storage; tính năng chưa nối UI không được trả thành công giả.
- [ ] P2.5 Thay UI session và allowedActions, bỏ menu direct status; API cũ `/status` trả 410 JSON. Đổi copy SSO đúng auth đã chọn, giữ style modal.

**Gate:** lint/build/unit/integration; smoke 3 tài khoản thật riêng: Legal không duyệt được, Clerk không tạo task/chỉnh giá, Admin không tự duyệt revision mình thực nộp; cùng một hợp đồng hai tab bấm cùng lúc chỉ một transition/audit. Curl không session hoặc forged role bị 401; sai role có session bị 403.

### Phase 3 — Engine lương chuẩn và ledger bất biến

**Files:** sửa `src/utils/payroll.ts`, `src/types.ts`; tạo `server/modules/payroll/{service,policy,repository,routes,dto}.ts`, `server/modules/contracts/assignments.ts`, `server/modules/payroll/incidents.ts`; sửa `server/modules/workflow/transition.ts`, `src/components/LegalPayrollDashboard.tsx`, `src/components/CreateDraftingRequestModal.tsx`, `src/components/AdminSettings.tsx`, schema/migration/docs.

- [ ] P3.1 Test vectors 6.6 trước sửa; gom mọi công thức server về engine thuần, đồng hồ/input/policy explicit; không còn ±10% hard-code ở route hoặc tính lại trên UI.
- [ ] P3.2 Chụp policy/base pay lúc tạo task; Admin-only giao việc/đổi urgency/deadline có audit, server không nhận client basePay làm authoritative. Sửa default deadline timezone và bỏ giá trị ước tính mẫu được điền sẵn như dữ liệu thật.
- [ ] P3.3 Duration Legal loại khoảng review theo D7 được duyệt; feedback count đúng revision; entry chốt một lần khi duyệt. Task manual không đủ eligibility không tự được trả lương.
- [ ] P3.4 Clerk có claim/beneficiary, mốc in từ approve và vận đơn từ sign, incident riêng Admin xác nhận; digital/unfinished không có entry chính thức. Một contract không nhân base pay qua reship/redraft.
- [ ] P3.5 Dashboard/CSV dùng server result, tách preview/finalized/adjustments, own-payroll scope. Settings đổi sau giao/chốt không làm đổi snapshot, kể cả base bằng 0.

**Gate:** lint/build/unit/integration, test số tiền chính xác từng vector + boundary 1 ms + concurrency. Smoke: ghi nhận lương, đổi settings, logout/login/restart, mở lại và xuất CSV vẫn cùng số; người khác không đọc được lương qua response contract/raw payroll API.

### Phase 4 — File, scan, QR và nối đủ UI

**Files:** tạo `server/modules/files/{routes,service,storage,validation}.ts`, `server/modules/contracts/{identifiers,physical-notes}.ts`; sửa `src/components/{CreateContractForm,ContractScanner,ContractTable,ClerkManualMatcher,HistoryModal}.tsx`, `src/services/api.ts`, `src/hooks/useContracts.ts`, `src/types.ts` và schema/docs.

- [ ] P4.1 Upload staging + verification/hash/relative key/download có quyền, cleanup orphan, tên Việt đúng; unauthorized upload không để lại file, file sai/quá dung lượng bị chặn.
- [ ] P4.2 Upload → gợi ý nullable → xác nhận → create thật; AI disabled vẫn dùng manual + file đã upload. Frozen revision đủ để approve, không in link Docs thay bản đã duyệt.
- [ ] P4.3 Scan đúng hồ sơ và source status, giữ trang khi lỗi, bỏ auto-match giả; camera cleanup, multi-page PDF giới hạn; manual fallback không cần AI.
- [ ] P4.4 QR ID + legacy resolve registry, giữ số HĐ trên nhãn; expectedAction/version/key, duplicate frame không nhảy hai bước; không vượt duyệt/vận đơn/scan guard.
- [ ] P4.5 Lưu physical note qua route riêng; history detail/pagination đúng. Frontend collection envelope/filter/load-more dùng query server, không mất số tổng hoặc gán scan nhầm hồ sơ ngoài page.
- [ ] P4.6 Test XSS trang in, link xấu, filename/path traversal, CSV formula, stale response; đối chiếu ảnh baseline và chỉ chấp nhận delta ở mục 13.

**Gate:** lint/build/unit/integration/e2e. Smoke trên desktop + điện thoại HTTPS/camera thật: chụp, xoay/crop, ghép nhiều trang, chọn đúng hợp đồng, upload, restart, tải được PDF đúng chữ ký; in/đọc QR thật. Playwright giả camera chỉ là bổ sung, không thay smoke thiết bị.

### Phase 5 — Tích hợp trung thực, outbox/inbox

**Files:** tạo `server/integrations/{vtp,teams,gemini,drive}/client.ts`, `server/integrations/status.ts`, `server/worker.ts`, `server/jobs/{outbox,inbox,retry}.ts`, `server/modules/settings/{routes,service,secrets}.ts`, `docs/integrations/{vtp,teams,gemini,drive}.md`; sửa `.env.example`, `package.json` build/worker scripts, `src/components/AdminSettings.tsx`, `src/components/SimulatorPanel.tsx`, hooks/API và schema/docs.

- [ ] P5.1 Kiểm kê credential/permission thật; xác minh tài liệu hiện hành rồi mới viết adapter được chọn. Nếu chưa có thì khoá tích hợp + not_configured; hoàn tất manual core chứ không dựng endpoint/provider giả.
- [ ] P5.2 Khởi chạy worker outbox/inbox thật với claim/lease/retry, thêm build/worker entrypoint; Teams object-template + 2xx check + dedupe; Drive upload/checksum/remote ID thật hoặc not_configured. Secret write-only/encrypted/env-managed, không rò qua settings/log.
- [ ] P5.3 Gemini server model/env, schema validation, không random fallback; missing/quota/error giữ upload và manual input. Không gửi hồ sơ thật ra provider khi D13 chưa duyệt.
- [ ] P5.4 VTP manual thật; API create có correlation/unknown-result và đối soát; webhook verify→inbox→normalization→workflow, duplicate/out-of-order/old shipment không đổi sai trạng thái.
- [ ] P5.5 Bỏ production simulator/toggle, chuyển phần logs đang có thành trạng thái vận hành read-only/Admin retry có kiểm soát; không giữ API giả chỉ vì UI đã ẩn.

**Gate core:** lint/build/unit/integration/e2e; mọi provider thiếu credential hiển thị trung thực, workflow manual chạy đủ vòng và không có fake-success.

**Gate integration được bật:** thêm request/response sandbox hoặc dữ liệu thử đã được phép, event provider thật, remote ID thật và kiểm thử quyền; nếu chưa có bằng chứng thì tích hợp đó vẫn **chưa nghiệm thu**, không đánh dấu hoàn thành toàn bộ sản phẩm tích hợp.

### Phase 6 — Worker, SLA và báo cáo đúng phạm vi

**Files:** tạo `server/jobs/{sla,reconciliation,cleanup,heartbeat}.ts`, `server/modules/reports/{routes,service,repository}.ts`, `server/modules/operations/routes.ts`; mở rộng `server/worker.ts`; sửa `src/components/ReportView.tsx`, `src/constants/workflow.ts`, hooks/API/types, schema/migration/docs.

- [ ] P6.1 Worker leases/skip-locked/retry/dead + heartbeat; kill giữa job và restart không mất job, không tạo đơn mù hoặc ghi nhận lương trùng.
- [ ] P6.2 SLA theo stage_instance/due_at, loại counterparty, pause review; dedupe alert nhiều worker, note/edit không reset, final/cancel không bị nhắc tiếp.
- [ ] P6.3 Reports SQL đủ 12 trạng thái, average đúng mẫu/cycle, tiền đúng loại/currency, pagination tổng đúng filter, lương đúng snapshot/beneficiary/kỳ.
- [ ] P6.4 Admin operations/logs/retry/SLA check có auth; non-admin không xem report quản trị, secrets/PII không nằm trong logs.
- [ ] P6.5 Chạy dữ liệu test tối thiểu 10.000 hợp đồng với 10 client đồng thời; đo trên cấu hình ghi rõ. Mục tiêu đề xuất p95 list/report <= 1 giây, page <= 100; nếu chưa đạt phải profile/index/query, không giả số benchmark. Không đưa provider latency vào thời gian transaction DB.

**Gate:** lint/build/unit/integration/e2e; hai worker cùng quét một hồ sơ trễ chỉ một alert/outbox; webhook cập nhật hành trình không reset SLA đang giao; status totals bằng tổng, zero-data UI là `—` đúng chỗ.

### Phase 7 — Đóng gói production, diễn tập và bàn giao

**Files:** tạo `Dockerfile`, `scripts/backup.ps1` hoặc `scripts/backup.sh` theo host vận hành được chọn, `docs/OPERATIONS.md`, `docs/ACCEPTANCE.md`; sửa `docker-compose.yml`, `.dockerignore`, `.gitignore`, `.env.example`, `package.json` scripts build/start/worker, toàn bộ tài liệu cũ cần đồng bộ.

- [ ] P7.1 Multi-stage image production-deps-only; one-shot migrate + app/worker runtime role, health, TLS/proxy, volumes đúng; không public PostgreSQL, không mount secret vào dist/image.
- [ ] P7.2 Máy sạch chạy stack qua `docker compose up -d --build`; bootstrap Admin thật; làm đủ physical và digital bằng tài khoản test được owner cho phép, không tài khoản hard-code.
- [ ] P7.3 Backup/restore thử DB + file trên môi trường riêng, đối soát hash/count/lương; đo RPO/RTO, kiểm chứng rollback trước/sau mở ghi và không làm mất dữ liệu mới.
- [ ] P7.4 Chạy toàn bộ lệnh verification từ code đã build; audit quyền với curl/raw API, scan thiết bị thật, screenshot diff, file download Unicode, duplicate/out-of-order webhook.
- [ ] P7.5 Owner ký `docs/ACCEPTANCE.md` ghi quyết định, integration nào đã xác minh/cái nào chưa cấu hình, bản release, backup/restore, bằng chứng test và các giới hạn còn lại. Chỉ deploy/cutover khi có uỷ quyền riêng; không vì spec hoàn chỉnh mà tự deploy.

**Gate cuối:** lint/build/unit/integration/e2e xanh; clean image chạy bằng JS, dữ liệu tồn tại sau restart/recreate, auth/RBAC đúng, không mock-success, restore pass, UI không redesign. Tích hợp nào chưa có credentials phải ghi rõ chưa nghiệm thu, không che bằng kết quả unit stub.

### 12.1. Ma trận test truy vết về audit

| Audit | Test file đích | Assertion bắt buộc |
|---|---|---|
| B1, B3, B27 | `tests/integration/workflow.test.ts` | Clerk/Legal không duyệt, không skip mã vận đơn, status override 410, mọi action sai source 409 |
| B2, B19, B34 | `tests/integration/revisions.test.ts` | Scan/empty archive sai bước bị chặn; redraft không có nội dung mới bị chặn; duyệt đóng băng đúng revision/hash |
| B4 | `tests/integration/digital.test.ts` | Digital manual vẫn chờ duyệt; không print/waybill/Clerk pay |
| B5, B6, B7, B8, B14, B20 | `tests/unit/legal-payroll.test.ts`, `tests/integration/payroll.test.ts` | Vectors, client basePay vô hiệu, task Admin-only, snapshot không đổi khi sửa settings, không phụ thuộc email demo |
| B9, B10, B32 | `tests/unit/clerk-payroll.test.ts`, `tests/integration/clerk-ownership.test.ts` | Feedback Legal không phạt Clerk, đúng mốc giờ, không chốt pending/digital, claim và beneficiary đúng |
| B11, B25 | `tests/integration/sla-jobs.test.ts` | Stage không reset bởi edit, review pause, counterparty không ngưỡng 2h, hai worker chỉ một alert |
| B12 | `tests/unit/teams-template.test.ts` | Quote/newline/backslash/tiếng Việt tạo JSON đúng, template sai 422, HTTP 500 không succeeded |
| B13, B21 | `tests/integration/concurrency.test.ts` | UUID/unique/FK, lock/version, hai mutation không ghi đè và chỉ một side effect |
| B15, B18 | `tests/integration/auth-security.test.ts` | Header/body giả không đổi actor; unauth GET/file/settings 401; payroll/secret redaction; CSRF/revoke/last-admin |
| B16 | `tests/e2e/qr.spec.ts` | In ID bất biến, tem cũ resolve alias, đổi số không gắn sang hồ sơ khác, duplicate scan một action |
| B17, B30 | `tests/integration/vtp-webhook.test.ts` | Invalid verification không đổi DB; replay/đảo thứ tự/old shipment/terminal không regress; unknown create result không blind retry |
| B22 | `tests/unit/money.test.ts` | Total/recurring/unit/unknown khác nhau; decimal/zero/currency không bị cộng sai |
| B23, B29 | `tests/integration/files.test.ts` | Tên Unicode tải lại đúng, path traversal/MIME mismatch/25MiB+/unauth bị chặn trước public storage |
| B24, B28, B37 | `tests/integration/production-build.test.ts` | Backend được typecheck, image production-deps-only start bằng JS, có dist vẫn dev HMR |
| B26 | `tests/integration/physical-notes.test.ts` | Note thật tồn tại sau restart, actor/time server, client không thay cả history, Clerk dùng đúng route |
| B31 | `tests/integration/reports.test.ts` | Đủ 12 status, total/filter/page khớp, null/sample count đúng, Clerk không đọc admin report |
| B33 | `tests/e2e/print-security.spec.ts`, `tests/unit/csv.test.ts` | Tên HĐ có HTML không chạy script khi in; URL xấu chặn; CSV không thực thi công thức |
| B35 | `tests/integration/json-import.test.ts` | Dry-run không ghi, apply rollback đúng, hai lần không trùng history, missing file không giả thành present |
| B36 | `tests/e2e/timezone.spec.ts` | Deadline chọn 17:00 VN thành đúng ISO và hiển thị lại 17:00; chạy browser timezone khác không lệch ngầm |

Test vận hành bổ sung: thiếu DB/disk full/provider quota, lease expiry, upload orphan, backup/restore, secret không có trong bundle/log/API, provider at-least-once không sinh payroll entry trùng. Dữ liệu test là fixture tách riêng, không vi phạm quy tắc không mock dữ liệu sản phẩm.

---

## 13. Những gì thay đổi so với mockup — để owner duyệt

| Giữ nguyên | Thay đổi bắt buộc |
|---|---|
| React/Tailwind/Motion/Lucide, layout/màu/modal/responsive | Session thật, xoá quick demo role-switch và copy SSO giả |
| 12 tên trạng thái và luồng physical/digital | Digital phải duyệt bản mềm; không endpoint/QR bỏ guard |
| Form tạo hồ sơ, upload/camera/Google Docs | Người dùng xác nhận metadata AI; bản duyệt phải có file đóng băng, không chỉ link mutable |
| Nút submit/feedback/approve/in/ký/waybill/scan | Quyền theo actor/assignee, revision, expectedVersion/idempotency; lỗi không đóng modal/toast thành công |
| Nhãn QR và số HĐ in dưới nhãn | QR data chứa contract ID, resolve server; không dùng scan thay sự kiện đã giao/đã ký đủ |
| Màn hình lương và các cột hệ số | Server là nguồn tính, base pay/policy snapshot, lương riêng theo người, preview khác entry chốt |
| Tham số Admin hiện có | Validation/versions, thêm urgency rates và Clerk thresholds; không trả secret nguyên văn |
| Ghi chú vật lý, modal lịch sử | Ghi thật DB + actor server; lịch sử phân trang, không nhận mảng client chỉnh sửa |
| Bộ lọc/sort/page/load more hiện tại | Query server, total từ server, `ContractPage` thay raw mảng; detail/history fetch khi mở |
| Các tab reports/settings | Admin-only thật, không fetch rồi giấu UI; đủ trạng thái, mẫu số/zero-data đúng |
| VTP/Teams/Drive/Gemini là các provider dự kiến | Chạy thật sau cấu hình/xác minh hoặc báo not_configured; bỏ simulator và ID/kết quả giả |
| Tạo task cho Legal | Mặc định chỉ Admin giao; Legal tự tạo hồ sơ không tự sinh base pay/urgency thưởng |
| Quy tắc base pay tập trung và công thức cộng hệ số | Sửa ba công thức lệch nhau; Clerk không bị phạt feedback Legal, không nhận tiền khi chưa làm |
| Mã/số HĐ có thể phải đính chính | Đổi có kiểm soát trước duyệt, giữ identifier alias; nội dung đã ký không âm thầm sửa |

**UI bổ sung tối thiểu, không phải redesign:** password/invite/reset hoạt động thật; loading phiên; step xác nhận dữ liệu upload; ô file frozen revision; confirmation signed scan/physical receipt; lý do/beneficiary khi Admin hỗ trợ; badge preview/finalized/backup/integration; tooltip thời gian SLA và thông báo conflict. Tận dụng modal/panel đang có, không tự thay navigation/theme hay viết lại thành app khác.

**Không làm ké:** chuẩn hoá toàn bộ camelCase/snake_case, đổi React router/state library, thay bộ component, làm HR payout, CA e-sign, multi-tenant, mobile native, chia tiền nhiều nhân viên/từng bước, migration cloud tự động hoặc thêm provider khác. Những việc đó cần yêu cầu riêng.

---

## 14. Quyết định cần chủ dự án xác nhận

Ghi lựa chọn, người duyệt và ngày vào `DECISIONS.md` khi bắt đầu triển khai. **Không suy từ câu "làm tiếp spec" thành đã duyệt các chính sách bên dưới.** Nếu chưa trả lời có thể dùng mặc định để thiết kế/test ở dev sau khi được phép code, không tự dùng cho dữ liệu/lương thật.

| Mã | Câu hỏi | Mặc định đề xuất và hệ quả |
|---|---|---|
| D1 | Đăng nhập nội bộ hay SSO Google Workspace? | Email/password + PG session để triển khai độc lập; copy không nói SSO. Nếu SSO: cần tenant/client/redirect/owner và đổi Phase 2 theo OIDC thật, không làm cả hai mặc định |
| D2 | Nhân viên được xem toàn bộ hợp đồng nội bộ hay chỉ được giao? | Giữ xem chung hồ sơ trong một tổ chức; lương riêng vẫn own-only. Nếu hồ sơ mật thì scope assignee phải chốt trước Phase 2 cho cả search/download/report |
| D3 | Ai giao task, duyệt, hủy; có được tự duyệt? | Chỉ Admin giao/duyệt/hủy; không duyệt revision mình thực nộp. Muốn Admin vừa soạn vừa duyệt cần người Admin khác; không thêm bypass vì chỉ có một Admin |
| D4 | Digital có cần phê duyệt nội dung trước scan? | Có. Chỉ bỏ in/ký giấy/bưu điện, không bỏ bước duyệt bản mềm |
| D5 | Hồ sơ nhập tay/upload có tự được tính tiền Legal không? | Không. Chỉ task được Admin giao là payable; nếu cần công nhận hồ sơ ngoài task phải có action Admin đối soát riêng, không tự trả theo upload |
| D6 | SLA theo giờ lịch hay giờ làm việc; ngày nghỉ/ngoài giờ? | Giờ lịch 24/7, timezone Asia/Ho_Chi_Minh; urgency do Admin chọn hoặc suy duration, không tự gắn ngoài giờ. Business calendar cần spec riêng nếu chọn |
| D7 | SLA Legal đo lần nộp nào, có loại thời gian chờ review không? | Tổng thời gian thực đang soạn đến revision được duyệt, loại khoảng chờ Admin; feedback vẫn đánh chất lượng. Nếu chọn elapsed đến lần nộp cuối như code cũ thì phải đổi vector và UI giải thích trước làm thật |
| D8 | Redraft/reship/hủy sau chốt có thêm tiền hoặc tự truy thu? | Một payable work item/kind/contract; không tự nhân tiền, giữ entry đã kiếm được. Thêm/giảm qua adjustment Admin có lý do, không sửa entry |
| D9 | Ai sửa metadata/số HĐ sau khi duyệt/ký? | Khoá nội dung pháp lý sau duyệt; đính chính Admin có audit/bản chứng cứ, không thay file đã ký. Số cũ giữ alias, không gắn sang hồ sơ khác |
| D10 | Clerk có chịu KPI thu hồi do đối tác/VTP làm chậm? | Giữ thang KPI thu hồi 7 ngày như engine hiện tại, tách khỏi cảnh báo nội bộ; incident chỉ phạt khi Admin xác nhận trách nhiệm. Nếu loại thời gian đối tác/VTP khỏi tiền công phải có chính sách và bằng chứng pause riêng |
| D11 | Clerk một người phụ trách hay chia tiền nhiều người? | Một beneficiary/contract work item, claim/reassign có audit; không chia từng bước trong đợt này. Admin hỗ trợ không làm mất tên người nhận tiền |
| D12 | Hoàn tất có bắt buộc Drive thành công/lưu kho giấy vị trí cụ thể không? | Bắt buộc signed scan nội bộ và xác nhận tiếp nhận; physical xác nhận bản trả về, ghi chú vị trí kho nếu có. Drive optional async; muốn Drive/kệ kho là guard bắt buộc phải chốt lại cả offline/error flow |
| D13 | Có tài khoản VTP/Teams/Drive/Gemini thật và được phép gửi dữ liệu gì? | Mặc định tích hợp chưa cấu hình, VTP manual; chỉ bật từng adapter sau cung cấp credential/quyền, xác minh tài liệu và duyệt dữ liệu ra ngoài. Không giả tích hợp để đủ checklist |
| D14 | Có dữ liệu thật cần giữ, host/domain, retention/backup yêu cầu gì? | 18 seed không tự nhập, không xoá nguồn; triển khai Docker một host + TLS, backup DB/file hàng ngày giữ 30 ngày, audit/pháp lý không tự purge. Mục tiêu RPO 24h/RTO 4h cần diễn tập và owner xác nhận |

### 14.1. Điều kiện bắt đầu code và điều kiện phát hành

- **Bắt đầu code:** chủ dự án yêu cầu triển khai; D1–D11 được chốt hoặc cho phép rõ dùng mặc định ở môi trường dev; có môi trường PG test riêng và cách bảo toàn source hiện tại. Không đòi credentials provider để làm auth/workflow/manual core.
- **Phát hành core dùng thật:** toàn bộ gate Phase 0–7 cho core pass, policy tiền/quyền/dữ liệu D1–D14 được duyệt, backup/restore pass, owner cho phép deploy/cutover; các provider chưa bật được ghi rõ trên giao diện và biên bản.
- **Tuyên bố tích hợp provider hoàn tất:** có cấu hình thật, tài liệu hiện hành đã xác minh và bằng chứng end-to-end thật của provider tương ứng. Unit/integration stub không thay điều kiện này.

### 14.2. Prompt bàn giao ngắn cho agent triển khai

> Đọc `AGENTS.md` và toàn bộ `SPEC.md` trước. Đây là kế hoạch chuyển prototype quản lý hợp đồng sang PostgreSQL thật, không redesign UI. Trước code, đối chiếu `DECISIONS.md` hoặc xin chốt các quyết định bắt buộc mục 14; không coi mặc định đề xuất là đã được duyệt cho production. Làm từng Phase mục 12, test-first, bảo toàn dữ liệu/file cũ, không mock-success hoặc tin role client. Mọi transition đi qua workflow service transaction/audit/outbox; mọi số lương chính thức lấy server snapshot. Đồng bộ schema/types/init SQL/migration/SCHEMA. Kết thúc mỗi Phase báo file thay đổi, lệnh thực sự đã chạy và kết quả, bằng chứng smoke/UI, hạn chế/blocker. Chưa được phép thì không tự deploy, nhập dữ liệu thật, khởi tạo Git/push hoặc bật tích hợp ra ngoài.

---

**Ghi chú bàn giao:** lượt tiếp quản này chỉ hoàn thiện `SPEC.md`. Không sửa mã ứng dụng, không cài dependency, không migrate/xoá dữ liệu, không bật provider và không tuyên bố lint/build/e2e đã chạy. Các thư mục/file/lệnh đích nêu trên sẽ được tạo/thay đổi trong giai đoạn triển khai có uỷ quyền.
