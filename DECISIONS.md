# DECISIONS.md - Kiến Trúc & Quyết Định Kỹ Thuật

Tài liệu này ghi nhận các quyết định kiến trúc và nghiệp vụ theo đặc tả tại `SPEC.md` và kế hoạch tại `PLAN.md`.

---

## 1. Các Quyết Định Nghiệp Vụ Cốt Lõi (D1 - D14)

Trạng thái: **adopted_for_development** (Áp dụng cho môi trường phát triển và kiểm thử theo ủy quyền trong `GOAL.md`; chưa ghi `owner_approved_for_production` khi chưa có văn bản phê duyệt chính thức từ Chủ dự án).

| Mã | Quyết Định | Nội Dung Áp Dụng Cho Môi Trường Phát Triển |
|---|---|---|
| **D1** | Xác thực & Quản lý Phiên | Email/password bảo mật bằng Argon2id + Session lưu trong PostgreSQL (`connect-pg-simple`). Tuyệt đối không dùng SSO giả lập, không tin tưởng header `x-user-role`. |
| **D2** | Phạm Vi Xem Dữ Liệu | 3 vai trò (admin, legal, clerk) xem danh sách hợp đồng chung trong cùng tổ chức. Dữ liệu lương và chi tiết thu nhập của người khác bị lọc triệt để tại server. |
| **D3** | Quyền Tạo & Duyệt | Admin toàn quyền giao việc, duyệt và hủy hợp đồng. Admin không được tự duyệt revision do chính mình nộp (chống tự duyệt). |
| **D4** | Hợp Đồng Số Hóa (Digital) | Hợp đồng số hóa vẫn bắt buộc phải qua bước Lãnh đạo duyệt bản mềm (`approve-soft-copy`), chỉ bỏ qua các khâu in ấn, ký giấy và bưu tá giao nhận. |
| **D5** | Nguồn Tạo Thủ Công / Upload | Tạo thủ công (`/manual`) hoặc upload trực tiếp không tự động phát sinh công lương Pháp chế (chỉ tính lương khi có task được Admin giao). |
| **D6** | Quy Chuẩn Thời Gian & Giờ Làm Việc | Đo SLA theo đồng hồ thực tế 24/7 (giờ lịch). Toàn bộ hiển thị và mốc kỳ báo cáo chuẩn hóa theo múi giờ `Asia/Ho_Chi_Minh` (UTC+7). |
| **D7** | Cách Đo Thời Gian Xử Lý Legal | Cộng dồn thời gian Pháp chế thực tế đang xử lý (tính từ lúc giao việc hoặc nhận feedback đến lúc nộp draft mới), loại trừ thời gian chờ Admin review. |
| **D8** | Số Lượng Work Item Lương | Tối đa đúng 1 work item có lương cho mỗi loại vai trò (1 cho Legal, 1 cho Clerk) trên mỗi hợp đồng. Xử lý làm lại/khấu trừ thông qua bản ghi điều chỉnh (`payroll_adjustments`). |
| **D9** | Khóa Metadata Sau Khi Duyệt | Thông tin pháp lý (tên, số tiền, đối tác, ngày ký) bị khóa sau khi Lãnh đạo duyệt. Mọi đính chính sau ký phải do Admin thực hiện với bản ghi audit riêng, số hợp đồng cũ được lưu dưới dạng alias. |
| **D10** | Ngưỡng KPI Văn Thư | Áp dụng ngưỡng thu hồi hợp đồng 7 ngày theo đặc tả. Sự cố vận hành chỉ tính phạt trừ điểm khi có xác nhận chính thức từ Admin. |
| **D11** | Người Thụ Hưởng Lương Văn Thư | Đúng 1 Văn thư được thụ hưởng lương cho 1 hợp đồng. Quy trình digital có thể có nhân sự thao tác nhưng không phát sinh đơn giá lương Văn thư. |
| **D12** | Điều Kiện Hoàn Tất Hợp Đồng | Chỉ hoàn tất khi có bản scan hợp đồng đã ký hợp lệ và có xác nhận tiếp nhận vật lý. Sao lưu Google Drive là tiến trình bất đồng bộ tùy chọn, không chặn hoàn tất. |
| **D13** | Tích Hợp Bên Ngoài Khi Thiếu Cấu Hình | Mọi adapter tích hợp (Viettel Post, Teams, Google Drive, Gemini) ở trạng thái `not_configured` trung thực khi chưa có API key/credentials, không sinh dữ liệu giả lập. |
| **D14** | Vận Hành & Dữ Liệu | Không nhập 18 hợp đồng mẫu seed vào production; không xóa nguồn `database.json`; Docker đơn host, sao lưu DB và file định kỳ, không public deploy tự động. |

---

## 2. Ghi Nhận Quyết Định Kỹ Thuật Bổ Sung

1. **Engine Lương Duy Nhất**: Toàn bộ công thức tính toán lương nằm tại `src/utils/payroll.ts`, là pure function tính toán trên số nguyên VND (tránh sai số làm tròn số thực) và tỷ lệ phần trăm nguyên.
2. **Máy Trạng Thái Bất Biến**: Mọi thay đổi trạng thái hợp đồng bắt buộc chạy qua `workflow.transition` trong một PostgreSQL Transaction kèm Audit Log và Outbox Job.
3. **Môi Trường Lưu Trữ**: PostgreSQL 16 kết hợp Drizzle ORM là nguồn dữ liệu duy nhất. Không dùng JSON file hay `localStorage` cho dữ liệu nghiệp vụ.

