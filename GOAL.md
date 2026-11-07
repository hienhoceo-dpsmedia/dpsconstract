# Goal — Triển khai toàn bộ hệ thống theo SPEC và PLAN

Dán nội dung khối dưới đây vào ô Goal của agent **đang mở đúng codebase này**. Giao kèm `AGENTS.md`, `SPEC.md`, `PLAN.md` và toàn bộ source; không chỉ gửi ảnh chụp hay riêng file plan.

```text
MỤC TIÊU
Triển khai toàn bộ hệ thống Quản lý Hợp đồng Nội bộ & Tính Lương SLA/KPI hiện có từ prototype sang ứng dụng thật, theo AGENTS.md, SPEC.md và toàn bộ T01–T60 trong PLAN.md. Đây là yêu cầu CODE + TEST toàn hệ thống, không phải yêu cầu viết thêm một plan, không chỉ làm Phase 0–1/MVP.

PHẠM VI
- Giữ React 19/Express/TypeScript/Tailwind/Lucide/Motion và bố cục/phong cách UI hiện tại; chỉ thay đổi tương tác/nội dung tối thiểu trong SPEC mục 13.
- PostgreSQL 16 + Drizzle là nguồn dữ liệu duy nhất; không JSON/localStorage runtime cho nghiệp vụ/danh tính.
- Xác thực/session/RBAC thật, workflow transaction/audit/version/idempotency thật, policy/lương server snapshot bất biến, đúng người nhận.
- File/upload/scan/QR đúng hồ sơ và đúng guard; không bỏ duyệt/thiếu vận đơn/thiếu signed scan để hoàn tất.
- Triển khai worker/SLA/reports, cấu hình secret, integrations có tài liệu xác minh, build JS/container/backup/restore/runbook và test đầy đủ theo plan.

QUYẾT ĐỊNH VÀ QUYỀN LÀM VIỆC
Cho phép dùng các mặc định D1–D14 trong SPEC mục 14 để triển khai và kiểm thử ở môi trường phát triển/test riêng, không cần hỏi lại từng quyết định đó. Ghi rõ adopted_for_development trong DECISIONS.md, không coi là owner đã duyệt policy sản xuất.
Được sửa source, bổ sung dependencies cần thiết, tạo và dùng DB/storage/fixtures test riêng an toàn theo plan. Không tự đổi stack/redesign hoặc mở rộng sang payout/CA e-sign/multi-tenant.
Không được tự nhập/xoá dữ liệu thật, gửi hợp đồng thật ra provider, tạo vận đơn thật/mất phí, deploy public/cutover, ký acceptance thay owner, init/push Git hoặc xoá volume. Những việc này cần uỷ quyền riêng.

CÁCH THỰC HIỆN
1. Đọc đầy đủ AGENTS.md, SPEC.md, PLAN.md; nếu có thì đọc DECISIONS.md và IMPLEMENTATION_STATUS.md. Kiểm tra source hiện tại, bảo toàn mọi thay đổi/dữ liệu có sẵn trước khi sửa.
2. Thực hiện toàn bộ T01–T60 theo dependency. Sau khi task/Phase đạt gate thì tự đi tiếp, không dừng chỉ để hỏi “có tiếp tục không?”. Checkpoint là lưu tiến độ và bằng chứng, không phải chờ người dùng phê duyệt từng bước.
3. Test-first cho logic, chạy test đỏ đúng bug rồi implementation thật rồi test xanh. Không handler rỗng, không fallback giả, không disable auth/guard, không skip test fail để có kết quả xanh.
4. Mọi thay đổi schema phải đồng bộ Drizzle/migration/init-db.sql/importer/types/SCHEMA.md. Mọi status update qua workflow engine; mọi lương chính thức qua một engine/server snapshot và cùng transaction khi chốt.
5. Giữ PLAN task IDs ổn định. Sau mỗi task/batch cập nhật IMPLEMENTATION_STATUS.md với file đổi, assertion/lệnh/exit code/evidence, blocker và task/bước tiếp theo. Chỉ đánh done khi có verification thật.
6. Nếu phiên/quota/context sắp hết, lưu checkpoint đủ để agent khác tiếp quản. Khi tiếp tục, kiểm tra lại source và test task dở rồi đi tiếp từ checkpoint, không lập plan mới hoặc làm lại từ đầu.

TÍCH HỢP VÀ BLOCKER
- Xác minh tài liệu chính thức hiện hành trước khi viết client VTP/Teams/Gemini/Drive. Không bịa endpoint/auth/schema hoặc báo connected bằng một toggle.
- Thiếu credentials: vẫn hoàn thành client có thể xác minh, contract tests và toàn bộ phần core độc lập; runtime báo not_configured trung thực. Không gửi dữ liệu ra ngoài hoặc tạo kết quả/remote ID giả.
- Thiếu tài liệu xác minh một provider: ghi blocked_external cho đúng phần đó và tiếp tục mọi task không phụ thuộc. Không dùng nó làm lý do dừng cả hệ thống sau vài Phase.
- Thiếu PostgreSQL/Docker/tool/quyền khiến core không kiểm chứng được: ghi blocked_environment, lệnh lỗi và điều kiện cần gỡ; không thay PG tests bằng mock rồi tuyên bố đạt.
- Credential/provider-live, camera/QR thiết bị thật, policy production và deploy chưa được xác nhận phải xuất hiện rõ trong acceptance/blocker list. Không tự ghi chúng đã nghiệm thu.

ĐIỀU KIỆN KẾT THÚC
Hoàn tất tất cả phần triển khai có thể thực hiện trong T01–T60, chạy verification mới trên source cuối: lint web+backend/scripts, unit, integration với PG thật, e2e desktop/mobile, production build/runtime, migration/concurrency/security/file/payroll/worker/SLA/report và backup/restore theo môi trường có thật.
Không kết thúc chỉ vì code compile hoặc hết một Phase. Bất kỳ gate core fail/chưa chạy phải được báo thật, không ghi engineering_complete.
Phân loại đúng kết quả theo PLAN mục 0.2: engineering_complete, engineering_complete_with_external_blockers hoặc blocked_environment. Không tự đặt release_approved.
Bàn giao cuối bằng tiếng Việt: phần đã làm, lệnh/test pass thật và evidence, cách chạy local/Docker, dữ liệu cũ được bảo toàn, providers đã xác minh/chưa bật, giới hạn/blocker/check thủ công và việc owner cần cho phép trước production. Không tự push/deploy/chi trả lương.

Bắt đầu thực hiện từ task chưa hoàn thành đầu tiên, không chỉ trả lời kế hoạch.
```

**Lưu ý:** prompt này là uỷ quyền dành cho agent nhận Goal **khi bạn chủ động giao nó để triển khai**. Việc tạo hai file `PLAN.md`/`GOAL.md` trong phiên lập tài liệu không tự khởi chạy code, tích hợp hoặc deploy.
