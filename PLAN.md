# Toàn bộ hệ thống quản lý hợp đồng — Implementation Plan

> **For agentic workers:** Dùng `executing-plans` nếu có, hoặc cơ chế Goal tương đương để thực hiện **toàn bộ T01–T60**. Checkbox là tiến độ triển khai, chưa có task nào được thực hiện bởi lượt viết plan này. Không cần hỏi lại sau mỗi task/Phase; checkpoint là kiểm tra kỹ thuật và lưu bằng chứng, không phải yêu cầu người dùng bấm duyệt để tiếp tục. Không bắt buộc subagent.

**Goal:** Biến prototype hiện tại thành hệ thống PostgreSQL thật, đăng nhập/phân quyền thật, workflow/audit/lương đáng tin, file và tích hợp trung thực, giữ sát UI, có test/build/container/backup và hồ sơ bàn giao đầy đủ.

**Architecture:** Modular monolith Express phục vụ React và API tại `0.0.0.0:3000`; PostgreSQL 16 + Drizzle là nguồn dữ liệu duy nhất. Một worker PostgreSQL xử lý outbox/inbox, SLA và đối soát. Engine toán học duy nhất ở `src/utils/payroll.ts`; mọi thay đổi trạng thái và việc chốt lương tương ứng cùng transaction với audit/outbox.

**Tech Stack:** Node.js 22, TypeScript, Express 4, React 19, Vite, Tailwind v4, Lucide, Motion, PostgreSQL 16, Drizzle, Argon2id, PG-backed sessions, Vitest/Supertest/Playwright, Docker Compose.

**Ngày lập:** 07/11/2026. **Đặc tả tham chiếu:** `SPEC.md` ngày 06/11/2026; không thay thế quy tắc bắt buộc trong `AGENTS.md`.

---

## 0. Cách dùng với Goal và phạm vi uỷ quyền

1. Giao **cả codebase**, `AGENTS.md`, `SPEC.md`, `PLAN.md` cho agent. Nội dung dán vào ô Goal nằm trong `GOAL.md`. Đọc trọn spec/plan một lần, sau đó chỉ nạp lại task hiện hành và contract liên quan; không lặp lại bước lập plan này.
2. Đây là **một plan trọn hệ thống**, không chỉ Phase 0–1/MVP. Tám Phase là thứ tự giảm rủi ro, không phải tám yêu cầu người dùng phải gửi riêng. Agent tự đi tiếp sau gate pass, sửa lỗi test do mình tạo ra, không dừng chỉ để hỏi “có làm tiếp không?”.
3. Mặc định phát triển dùng D1–D14 của `SPEC.md` khi người dùng giao Goal cho phép rõ điều này. Ghi `adopted_for_development`, **không ghi `owner_approved_for_production`** nếu chưa có xác nhận. Chọn khác mặc định thì cập nhật quyết định/test trước khi làm tiếp.
4. Uỷ quyền kỹ thuật không bao gồm: xoá/nhập dữ liệu thật, bật chi phí API, gửi tài liệu pháp lý ra ngoài, tạo đơn VTP thật, deploy public, ký biên bản thay owner, khởi tạo/push Git hoặc xoá volume. Những hành động này cần phép riêng.
5. Không có credential không phải lý do bỏ auth/workflow/lương/UI/Docker. Làm hết phần độc lập, client theo tài liệu đã xác minh và contract tests; để provider `not_configured`. Thiếu bằng chứng provider thật vẫn là hạn chế cần khai báo, không đổi thành “đã tích hợp thành công”.
6. Thiếu tài liệu xác minh schema/auth một provider thì **không bịa adapter**. Ghi blocker cụ thể cho provider đó, làm tiếp mọi task không phụ thuộc. Nếu thiếu PostgreSQL/Docker/quyền cài công cụ khiến không kiểm chứng được core thì ghi `blocked_environment`; không đổi integration tests thành mock để báo xanh.
7. Nếu yêu cầu bên ngoài hoặc chỉ dẫn đang áp dụng xung đột: giữ an toàn, ghi conflict và xin quyết định **chỉ cho phần bị chặn**. Không tự giải quyết bằng cách bỏ qua `AGENTS.md`.
8. Lượt hiện tại chỉ tạo tài liệu. Không có kết quả lint/build/app test hoặc thay đổi ứng dụng được ngầm khẳng định trong plan.

### 0.1. Mặc định dùng để agent không phải hỏi lại hàng loạt

| Quyết định | Profile phát triển trong plan |
|---|---|
| D1 | Email/password + session PostgreSQL, không SSO giả |
| D2 | Ba role xem hồ sơ chung trong một tổ chức; lương người khác bị lọc ở server |
| D3 | Admin giao/duyệt/hủy; không tự duyệt revision mình thực nộp |
| D4 | Digital vẫn duyệt bản mềm, chỉ bỏ in/ký giấy/giao vận |
| D5 | Manual/upload không tự hưởng tiền Legal |
| D6 | Giờ lịch 24/7, hiển thị/kỳ báo cáo Asia/Ho_Chi_Minh |
| D7 | Cộng thời gian Legal đang xử lý, loại thời gian chờ Admin review |
| D8 | Một payable work item/kind/contract; làm lại/khấu trừ qua adjustment |
| D9 | Metadata pháp lý khoá sau duyệt; đính chính riêng, số cũ giữ alias |
| D10 | Clerk KPI thu hồi 7 ngày theo spec; incident chỉ phạt sau Admin xác nhận |
| D11 | Một Clerk beneficiary; digital có thể có người xử lý nhưng không có Clerk pay |
| D12 | Hoàn tất cần scan bền vững + xác nhận tiếp nhận; Drive async/optional |
| D13 | Provider off/not_configured tới khi có cấu hình và quyền sử dụng dữ liệu |
| D14 | Không nhập 18 seed; không xoá nguồn; Docker một host, backup DB/file, không public deploy tự động |

### 0.2. Trạng thái hoàn thành — không đánh tráo khái niệm

- `engineering_complete`: tất cả phần code/automated verification của T01–T60 đã đạt; các tích hợp được bật có bằng chứng thật, các kiểm tra thủ công bắt buộc có kết quả thật.
- `engineering_complete_with_external_blockers`: toàn bộ phần có thể làm đã hoàn tất, còn danh sách rõ việc cần credential/thiết bị/người duyệt. Không gọi đây là nghiệm thu đủ mọi tích hợp hoặc sẵn sàng phát hành không điều kiện.
- `blocked_environment`: không có công cụ/quyền/môi trường để chứng minh một gate core. Báo lệnh fail và cách gỡ; không đánh dấu task bị chặn là done.
- `release_approved`: chỉ khi owner xác nhận policy, acceptance và cho phép triển khai; agent không tự đặt trạng thái này.

---

## 1. Hợp đồng thực thi liên tục và tiếp quản khi hết quota

### 1.1. Các file agent triển khai phải duy trì từ T01

| File | Nội dung |
|---|---|
| `IMPLEMENTATION_STATUS.md` | Task hiện hành/tiếp theo, bảng T01–T60, dependency, lệnh vừa chạy, evidence, blocker |
| `DECISIONS.md` | D1–D14 + quyết định kỹ thuật phát sinh, phân biệt mặc định dev với owner approval |
| `docs/evidence/phase-0/` đến `docs/evidence/phase-7/` | Output thật, ảnh, benchmark, report đã redact, không bí mật |
| `docs/ACCEPTANCE.md` | Checklist tự động/thủ công, provider nào chưa cấu hình, policy/deploy chưa được duyệt |

Tạo các file này **khi triển khai**, không giả rằng chúng đã tồn tại trong lần lập plan.

### 1.2. Vòng lặp cho từng task

1. Chọn task nhỏ nhất chưa xong có dependency đạt. Đọc source liên quan; nếu đã có thay đổi từ agent khác thì xác minh và tiếp quản, không ghi đè.
2. Viết test đỏ theo ca nêu trong task; chạy đúng lệnh mục tiêu để thấy failure liên quan. Không dùng một lỗi syntax/import vô can làm bằng chứng đã tái hiện bug nghiệp vụ.
3. Cài đặt phần thật nhỏ nhất; chạy test mục tiêu và `npm run lint`. Mỗi lần đổi schema phải đổi Drizzle/migration, `data/init-db.sql`, `src/types.ts` khi cần, importer và `SCHEMA.md` cùng task.
4. Chạy gate task/Phase, review thay đổi, cập nhật evidence/status. Task chỉ done sau khi có lệnh + exit code + assertion thực sự pass.
5. Nếu đang ở Git repo có sẵn và được phép commit: commit theo task, chỉ stage file của mình. Không có Git thì dùng manifest/diff/evidence; không init/push để đủ checklist.
6. Tự chuyển task kế tiếp. Nếu blocker external cục bộ, ghi lại rồi tiếp tục nhánh không phụ thuộc; không lặp một lỗi provider tới hết quota.

**Checkpoint không phải barrier người dùng:** hết Phase ghi tóm tắt + kết quả, sau đó đi tiếp nếu gate pass. Chỉ tạm dừng khi thiếu phép cho hành động thật hoặc không thể kiểm chứng core một cách an toàn.

### 1.3. Mẫu checkpoint bắt buộc

Mỗi lần kết thúc task/batch, ghi đầy đủ những trường sau vào `IMPLEMENTATION_STATUS.md`; không chỉ ghi “đang làm DB”:

```text
Current task: ID trong T01–T60 + tên task thực tế
Task state: in_progress / done / blocked_environment / blocked_external
Completed assertions: mô tả assertion đã pass
Changed files: danh sách đường dẫn thật
Verification: lệnh, exit code, thời điểm, đường dẫn evidence
Remaining: phần cụ thể chưa làm, không ghi chung chung
Next task: ID và bước đầu tiên cần chạy
Blocker: điều kiện thiếu + việc đã thử + ảnh hưởng dependency
Production approvals: chưa duyệt hay đã có xác nhận nào, dẫn nguồn
```

Nếu phiên bị ngắt: agent mới đọc `AGENTS.md`, `SPEC.md`, `PLAN.md`, `DECISIONS.md`, `IMPLEMENTATION_STATUS.md`; kiểm tra file/diff, chạy lại test mục tiêu đang dở rồi tiếp tục. Không làm lại từ T01 và không tin tick cũ nếu source/test đã thay đổi.

---

## 2. Bản đồ công việc và dependency

| Phase | Tasks | Kết quả cần đạt |
|---|---|---|
| 0 | T01–T05 | Bảo toàn baseline, công cụ, app factory, test harness, contract kiểu dữ liệu |
| 1 | T06–T14 | PostgreSQL/schema/migration/repository, collection UI, importer, bỏ JSON runtime |
| 2 | T15–T26 | Auth/RBAC/UI phiên, workflow engine/revisions/physical/digital/ngoại lệ/phân công |
| 3 | T27–T33 | Policy/engine lương/ledger/atomic finalization/API/export/UI đúng số |
| 4 | T34–T41 | Hardening file, upload-confirm, scan/QR/history/actions và UI regression |
| 5 | T42–T49 | Secret/status, worker, Teams/Gemini/Drive/VTP, operations, bỏ simulator |
| 6 | T50–T54 | SLA/reconciliation/cleanup, reports/totals, tải và lỗi vận hành |
| 7 | T55–T60 | Build JS production, container/role/volume, backup/restore, test cuối, bàn giao |

**Default order:** T01 → T60. Dependency liệt kê trong từng task cho phép làm nhánh khác khi external blocked; không phải lời mời tự chia việc cho subagent. Chỉ dùng subagent khi owner/harness đang áp dụng cho phép.

**Gate không phải release:** trước T60, app chỉ chạy local/private/test. Trong quá trình nối module, route chưa có đủ implementation phải fail closed/không được đăng ký; không để handler rỗng trả 200, không giữ logic mock cũ để smoke-test “đẹp”. Khi workflow/payroll/file chưa cùng hoàn thiện, không công bố giai đoạn trung gian là sản phẩm dùng thật.

### 2.1. File ownership đích

| Module | File chính |
|---|---|
| Bootstrap/HTTP | `server.ts`, `server/app.ts`, `server/config.ts`, `server/http/errors.ts`, `server/http/security.ts`, `server/http/csrf.ts`, `server/http/logger.ts` |
| DTO/domain | `src/shared/contracts.ts`, `src/types.ts`, `server/domain/types.ts`, `server/modules/contracts/dto.ts` |
| DB | `server/db/client.ts`, `server/db/schema.ts`, `drizzle.config.ts`, `drizzle/`, `scripts/db-migrate.ts` |
| Auth | `server/modules/auth/routes.ts`, `service.ts`, `repository.ts`, `middleware.ts`, `passwords.ts`, `tokens.ts`, `rate-limit.ts` trong cùng thư mục |
| Contracts | `server/modules/contracts/routes.ts`, `validation.ts`, `repository.ts`, `service.ts`, `identifiers.ts`, `revisions.ts`, `assignments.ts`, `physical-notes.ts` |
| Workflow | `server/modules/workflow/actions.ts`, `guards.ts`, `transition.ts`, `milestones.ts` |
| Payroll | `src/utils/payroll.ts`; `server/modules/payroll/policy.ts`, `service.ts`, `repository.ts`, `routes.ts`, `dto.ts`, `incidents.ts`, `csv.ts` |
| File | `server/modules/files/routes.ts`, `service.ts`, `storage.ts`, `validation.ts`; `server/modules/uploads/routes.ts`, `service.ts` |
| Settings | `server/modules/settings/routes.ts`, `service.ts`, `repository.ts`, `secrets.ts` |
| Integrations | `server/integrations/status.ts`, `outbound.ts`; `server/integrations/teams/client.ts`, `template.ts`; `gemini/client.ts`; `drive/client.ts`; `vtp/client.ts`, `normalize.ts`, `verify.ts` |
| Worker | `server/worker.ts`, `server/jobs/outbox.ts`, `inbox.ts`, `retry.ts`, `sla.ts`, `reconciliation.ts`, `cleanup.ts`, `heartbeat.ts` |
| Reports/ops | `server/modules/reports/routes.ts`, `service.ts`, `repository.ts`; `server/modules/operations/routes.ts` |
| UI hiện có | `src/services/api.ts`, `src/hooks/useContracts.ts`, `src/App.tsx`, các component đã có; không dựng UI thay thế |
| Ops/build | `scripts/build-server.mjs`, `scripts/bootstrap-admin.ts`, `scripts/migrate-json-to-pg.ts`, `scripts/backup.sh`, `scripts/restore-check.ts`, `Dockerfile`, Compose, env mẫu |

Các đường dẫn ngắn trong hàng module là file trong chính thư mục được nêu, không tạo file cùng tên ở root. Chỉ tạo file khi task sử dụng đến, tránh scaffolding rỗng.

---

## 3. Contract chung phải giữ nhất quán giữa tasks

### 3.1. Actor, clock và transport

Định nghĩa tại T05; đây là contract kiểu dữ liệu dự kiến, **không phải source đã được cài vào app**:

```ts
export type Role = 'admin' | 'legal' | 'clerk';
export type UserActor = {
  kind: 'user'; userId: string; email: string; role: Role;
};
export type ServiceActor = {
  kind: 'service'; service: 'vtp' | 'sla' | 'import'; eventId: string;
};
export type Actor = UserActor | ServiceActor;
export type Clock = () => Date;
export type MutationContext = {
  actor: Actor; requestId: string; idempotencyKey: string;
};
export type ApiFailure = {
  error: string; code: string; requestId: string;
  details?: Record<string, unknown>;
};
export type Page<T> = {
  items: T[]; total: number; page: number; pageSize: number;
};
```

- DTO công khai chỉ có `User` an toàn; `ServiceActor` không được nhận từ body/header. Worker tạo service identity sau verification; browser chỉ có UserActor từ session.
- `ContractStatus` lấy đúng 12 string trong `src/types.ts`/SPEC; `ContractSummary` có id/status/version/metadata cần cho bảng/allowedActions, không lịch sử đầy đủ và không lương người khác. `ContractPage` = `Page<ContractSummary>` + `statusCounts` đủ 12 key.
- `Contract` detail giữ tên trường hiện có qua mapper; `files` không chứa storage path; histories fetch riêng tối đa 100/lượt. Tiền hợp đồng decimal dùng chuỗi, ngày date hoặc null; lương number safe integer VND.
- Workflow action nội bộ thống nhất: `submit_draft`, `feedback_draft`, `approve_soft_copy`, `print`, `sign`, `assign_waybill`, `confirm_pickup`, `confirm_delivery`, `upload_scan`, `archive`, `reject`, `report_issue`, `redraft`, `reship`, `cancel`. Route kebab-case map sang action này trong router.
- `workflow.create` là nhánh khởi tạo thuộc cùng engine, nhận `draft_request` hoặc `existing_draft`; `workflow.transition` chỉ xử lý hồ sơ đã có. Không để create service tự cấp status tuỳ ý.
- Mọi transition cần contract ID + action + expectedVersion + context + payload đã validate. Các kiểu payload là discriminated union; không dùng `Partial<Contract>` làm input ghi chung.

### 3.2. Request version/idempotency

- Header `Idempotency-Key` do UI tạo một lần cho **một ý định**. Retry cùng payload/key/version; ý định mới tạo key mới. Auth/CSRF kiểm tra trước replay. Key cùng actor nhưng route/payload khác trả 409.
- Idempotency row được claim bằng unique `(actor_key,key)` **trong transaction**, không chỉ SELECT trước INSERT. Hai request cùng key: request thua đợi record commit rồi trả kết quả cũ; nếu request đầu rollback thì request sau được thực thi. Không để unique violation thô thành 500.
- Workflow lock contract, kiểm version, guard, mutation, audit, payroll, outbox và completed replay response cùng commit. Replay kiểm tra trước stale-version để không từ chối chính lần retry đã hoàn tất.
- Không cache password/token raw/file bytes trong idempotency. Payload file dùng upload ID/hash ổn định; rotate CSRF không làm payload hash nghiệp vụ đổi.
- Danh sách đọc không yêu cầu operation key. Thao tác đổi settings có expected settings version; không lẫn version contract.

### 3.3. Test harness và thư viện

- Vitest unit không cần DB; integration dùng PostgreSQL thật riêng, Supertest app factory không listen; e2e dùng server port 3000/test DB, Playwright desktop/mobile. Provider stub chỉ trong `tests/support/`, không được bundle vào sản phẩm.
- `tests/support/database.ts`: kiểm tra `TEST_DATABASE_URL` là DB test riêng khác DATABASE_URL, tạo schema test tên ngẫu nhiên an toàn, apply migrations và cleanup chỉ schema tự tạo. Không truncate/drop DB vận hành.
- Migration journal và mọi connection cũng phải nằm trong namespace test đó. Nếu SQL migration qualify cứng `public` và không hỗ trợ schema test độc lập, dùng **database test riêng cho lượt chạy** cùng SQL gốc thay vì chỉ đổi search_path hoặc sửa chuỗi migration cho “pass”; xác minh quyền/vùng test trước tạo/dọn, serialize các suite dùng chung DB.
- `tests/support/clock.ts`: `set(ISO)`, `advance(ms)`, `now()`; không chờ thật 2 giờ/7 ngày để test SLA.
- `tests/support/fixtures.ts`: tạo users/hợp đồng/file thật trong DB/storage test. Fixtures không ghi sang DB dev/prod và không gọi provider.
- `tests/support/session.ts` từ T16: login bằng HTTP cookie/CSRF thật; không inject `x-user-role` để qua test auth. Domain unit test có thể truyền Actor trực tiếp.
- `tests/support/providers.ts` từ T42: local HTTP stub có response contract đã xác minh và error injection. Không gọi public Internet trong automated suite.
- Mỗi task ghi rõ test file, assertion và lệnh. `--` chuyển filter tới Vitest/Playwright; không cài thêm test framework song song.

### 3.4. Lệnh kiểm chứng phải được tạo và dùng

| Lệnh đích | Tạo ở | Kết quả mong đợi |
|---|---|---|
| `npm run lint` | T02 | Typecheck web + server + scripts, exit 0 |
| `npm run build` | T02, mở rộng T55 | Vite + server/worker/CLI JS, exit 0 |
| `npm run test:unit -- <file>` | T04 | Vitest chỉ unit file yêu cầu, không suite rỗng |
| `npm run test:integration -- <file>` | T04/T09 | Supertest/PG test thật, không fallback mock |
| `npm run test:e2e -- <file>` | T04 | Playwright projects có cấu hình, report/trace khi lỗi |
| `npm run db:migrate` | T06, harden T09 | Apply migrations có khoá bằng migration credential |
| `npm run db:generate` | T06 | Sinh SQL/meta, không tự push schema production |
| `npm run bootstrap:admin` | T15 | Tương tác stdin, không password command line |
| `npm run migrate:json-to-pg -- --source <path> --dry-run` | T13 | Chỉ report, không ghi DB/source |
| `npm run start`, `npm run worker` | T55 | Chạy JS compiled, không Vite/tsx runtime |
| `npm run test:load` | T54 | Benchmark test dataset 10.000 hồ sơ/10 clients, ghi số đo thật |
| `npm run verify:release` | T60 | Chạy gates tự động tuần tự, bất kỳ failure exit khác 0 |

Các lệnh là **đầu ra cần xây**, không phải giả định package hiện tại đã có. Chốt script includes đúng test folders để filter không chạy nhầm/không có test mà vẫn pass. Docker test chạy bằng profile/compose riêng, không tái dùng pgdata thật.

---

## Phase 0 — Bảo toàn, tooling, test contracts

### T01 — Chốt workspace, manifest và sổ tiến độ

**Depends:** không. **SPEC:** 0, 2.4, 12.0, 14.

**Files:** tạo `IMPLEMENTATION_STATUS.md`, `DECISIONS.md`, `docs/evidence/phase-0/baseline.md`; đọc `AGENTS.md`, `SPEC.md`, `PLAN.md`, toàn bộ root configs. Chưa sửa source/data.

- [ ] Xác minh cwd/repo/công cụ Node/npm/Docker/PG/browser, dữ liệu thật đang được dùng không; lưu phiên bản và lệnh có sẵn, không suy từ README.
- [ ] Lập hash manifest cho source/JSON/tài liệu, backup ngoài public root vào vị trí owner cho phép; backup không chứa secret mới trong Git/image. Kiểm kê file thật/missing và label demo, không xoá.
- [ ] Tạo registry T01–T60 với state `pending`; ghi defaults D1–D14 là development-only nếu Goal đã cho phép. Điểm chưa được uỷ quyền để `pending_owner`, không ký thay.
- [ ] Đối soát manifest ngay sau bước này: source/data không đổi. Có file mới từ người khác thì ghi nhận trước sửa.
- [ ] Gate: có đường dẫn backup/manifest, runtime capabilities, task tiếp T02 và danh sách approval boundaries trong status. Không dừng để hỏi chọn cách triển khai đã được Goal xác định.

### T02 — Dependency, typecheck đủ backend và build JS ban đầu

**Depends:** T01. **SPEC:** B24, B28, B37; 11.1.

**Files:** sửa `package.json`, `package-lock.json`, `tsconfig.json`; tạo `tsconfig.server.json`, `scripts/build-server.mjs`, `.gitignore`, `.dockerignore`; test `tests/unit/tooling.test.ts`.

- [ ] Red: test tooling yêu cầu lint include server/scripts, build backend tồn tại, start trỏ JS, ignore `.env`/uploads/backups. Ghi baseline lint/build của code cũ trước sửa.
- [ ] Cài đúng lockfile trước; sau đó thêm PG/Drizzle/Zod/Argon2id/session store/Helmet và test tools/types cần thiết. Không nâng major React/Express/Vite để tiện viết lại app. Move Vite/TS tooling ra runtime khi đã tách import T03.
- [ ] Typecheck web và server riêng với strict, scripts/config cũng trong check; sửa lỗi thực, không blanket any/ts-ignore. Build esbuild ESM Node 22 với packages external, sourcemap không public.
- [ ] Build ban đầu chỉ source entrypoint tồn tại; thêm worker/migration/bootstrap vào cùng script khi các task tạo chúng. T55 kiểm tra đủ entrypoints cuối, không bỏ missing bằng exists-check mãi mãi.
- [ ] Green: `npm run lint`, `npm run build`, `npm exec -- vitest run tests/unit/tooling.test.ts`. T02 đã cài Vitest nên chạy file trực tiếp được trước cấu hình project ởT04; sauT04 cũng phải pass qua test:unit. Backend phải thật sự nằm trong typecheck, không chỉ test regex cấu hình.
- [ ] Evidence: dependency diff, runtime/lockfile, baseline lỗi đã sửa; không gọi đây là hoàn thiện nghiệp vụ.

### T03 — App factory, config, lỗi HTTP và chế độ dev/prod

**Depends:** T02. **SPEC:** 3.1, 5.3, 10.1, 11.1.

**Files:** sửa `server.ts`; tạo `server/app.ts`, `server/config.ts`, `server/http/errors.ts`, `server/http/logger.ts`, `server/http/security.ts`; test `tests/integration/app-bootstrap.test.ts`.

- [ ] Red: import app không mở port/timer/tạo seed/gọi AI; API lạ là JSON 404; có dist vẫn dev nếu NODE_ENV=development; config production thiếu secret bị từ chối.
- [ ] Đưa listen/Vite/static/shutdown vào bootstrap; `createApp(services)` là factory rõ dependency. Bootstrap vẫn listen **0.0.0.0:3000**, không chọn port khác để né lỗi.
- [ ] Chuẩn hoá request ID, typed error envelope, no-store, body 1 MiB, log redact, trusted proxy; VTP raw parser đúng route sẽ nối T48 trước JSON parser.
- [ ] Health live tối thiểu, ready phản ánh các dependency hiện thực; không trả ready=OK khi DB/storage chưa có. Không leak config; không dùng `fs.existsSync(dist)` quyết định NODE_ENV.
- [ ] Green: `npm exec -- vitest run tests/integration/app-bootstrap.test.ts`, lint/build; chạy trực tiếp test app factory/Supertest không cần harnessT04, chưa yêu cầu schema nghiệp vụ. SauT04 file này phải pass qua test:integration. Smoke dev HMR sau build; chưa có DB thì ready fail trung thực, live vẫn dùng để kiểm app factory.

### T04 — Vitest/Supertest/Playwright và môi trường test cách ly

**Depends:** T03. **SPEC:** 11.1, 12.0.

**Files:** tạo `vitest.config.ts`, `playwright.config.ts`, `tests/setup.ts`, `tests/support/database.ts`, `tests/support/clock.ts`, `tests/support/fixtures.ts`, `tests/unit/test-safety.test.ts`, `docker-compose.test.yml`; sửa scripts npm.

- [ ] Red: harness từ chối DATABASE_URL vận hành, schema name không an toàn, provider request Internet bất ngờ; exit khác 0 khi không có test match.
- [ ] Unit/integration projects tách includes; integration serialized nếu dùng schema chung, hoặc schema riêng/worker với pool search_path đúng. Tạo role/DB test chỉ trong Compose test riêng, không sửa database cũ.
- [ ] Fixtures hỗ trợ file PDF/DOCX hợp lệ được test tạo; fake clock không dùng sleep. T06 mở rộng helper apply migration thật, T16 thêm session helper; hiện tại không import helper chưa có.
- [ ] Playwright projects `desktop` 1440×900 và `mobile` 390×844; test webServer port3000, refuse chiếm server không thuộc test. Chụp trace/screenshot failure, secrets không ghi artifacts.
- [ ] Green: `npm run test:unit`, `npm run test:integration -- tests/integration/app-bootstrap.test.ts`; lint/build. Chưa chạy suite nghiệp vụ chưa được viết và không tạo test skip giả cho đủ số.

### T05 — Shared DTO, domain types và baseline hình ảnh thật

**Depends:** T04. **SPEC:** 1.3, 3.2, 10, 13.

**Files:** tạo `src/shared/contracts.ts`, `server/domain/types.ts`, `tests/unit/contracts-types.test.ts`, `tests/e2e/baseline.spec.ts`; sửa `src/types.ts`, `docs/evidence/phase-0/baseline.md`.

- [ ] Red: schema/types giữ 12 status/3 role, money/date/null/ContractPage shape, không có secret trong public User/File DTO. Dùng type tests cho forbidden fields và runtime schemas cho request.
- [ ] Định nghĩa contract mục 3, Action/payload union, safe DTO để server/UI không phát triển hai tên hàm/trường khác nhau. Không expose Actor service/config server qua bundle web.
- [ ] Chụp UI hiện tại trong bản sao **cách ly**: env fake-outbound bị chặn, dùng data copy, không để readDb tự ghi nguồn gốc. Screens: login, home/tasks/contracts, create, history, payroll Legal/Clerk, reports/settings/scanner/QR.
- [ ] Screens không chạy được ghi nguyên nhân thật; không thay bằng ảnh dựng. Đây là manual/baseline evidence, không yêu cầu test mới ép UI cũ đáp ứng nghiệp vụ chưa sửa.
- [ ] Green: `npm run test:unit -- tests/unit/contracts-types.test.ts`, lint/build; baseline artifacts thật hoặc blocker riêng. **Phase 0 gate:** tooling/app factory/test safety pass, source backup còn nguyên.

---

## Phase 1 — PostgreSQL và lớp dữ liệu thật

### T06 — Pool PG, schema core/auth/settings và validation

**Depends:** T05. **SPEC:** 3.2–3.3, 5.

**Files:** tạo `server/db/client.ts`, `server/db/schema.ts`, `drizzle.config.ts`, `scripts/db-migrate.ts`, `server/modules/settings/validation.ts`; sửa `tests/support/database.ts`, `scripts/build-server.mjs`, npm scripts, `data/init-db.sql`, `.env.example`, `SCHEMA.md`; test `tests/integration/schema-core.test.ts`.

- [ ] Red: schema phải có users/sessions/auth_tokens/auth_rate_limits/settings/settings_versions, email unique chuẩn hoá, role requester bị chặn, base pay 0 được giữ, settings thresholds sai bị chặn.
- [ ] Pool có connect/statement/idle timeout và graceful close; không log connection string. Migration credential tách runtime; session store dùng đúng shape pg-simple, không tự tạo bảng production bằng quyền runtime.
- [ ] Settings schema đủ keys cũ + urgency rates/Clerk rules theo spec; default giá 500.000/100.000 và rates chuẩn. Để tuân AGENTS về ngưỡng đọc từ settings, thêm `urgencyEmergencyMaxHours=1`, `urgencyUrgentBeforeHours=3`, `urgencyPriorityBeforeHours=24`, thứ tự tăng nghiêm ngặt; snapshot/import/UI cùng keys. Seed **chỉ** settings, không users demo.
- [ ] Generate migrations cùng schema, thêm db:generate/db:migrate và runner thật giữ advisory lock trên connection; helper test apply migrations trong schema cách ly. Đồng bộ init SQL/import mapping/schema docs; cột auth hash nullable chỉ cho invited, active user phải có credential theo profile password. T09 bổ sung chứng minh concurrency/permissions/parity, không đợiT09 mới chạy được schema tests.
- [ ] Green: `npm run test:integration -- tests/integration/schema-core.test.ts`, `npm run lint`, `npm run build`; không để gate chờ task tương lai.

### T07 — Schema hợp đồng/cycle/revision/file/audit/identifier

**Depends:** T06. **SPEC:** 3.3, 4, 7.

**Files:** sửa `server/db/schema.ts`, `data/init-db.sql`, `src/types.ts`, `SCHEMA.md`, `scripts/migrate-json-to-pg.ts`; generated SQL trong `drizzle/`; test `tests/integration/schema-contracts.test.ts`.

- [ ] Red: status ngoài 12 bị CHECK, số HĐ lower+trim/NFC trùng bị chặn, identifier không trỏ hai hồ sơ; file/revision/cycle/shipment liên kết cross-contract bị từ chối.
- [ ] Thêm contracts, cycles, revisions, files, feedback, physical events, identifiers, uploads theo spec. Cột tiền typed + kind/currency, date nullable, milestone timestamptz, version/stage/due/assignee/needs-review đầy đủ.
- [ ] Thiết kế circular references current_cycle/current_revision theo thứ tự insert + deferred/composite FK phù hợp; FK audit RESTRICT, không cascade delete hồ sơ/lịch sử.
- [ ] Audit actor user/service/legacy, snapshot display, request ID, event metadata; filed availability missing/present không biến legacy thiếu file thành hợp lệ.
- [ ] Green: `npm run test:integration -- tests/integration/schema-contracts.test.ts`, lint/build; schema/import/docs không lệch.

### T08 — Schema work item/lương/shipment/jobs/import ledger

**Depends:** T07. **SPEC:** 3.3–3.4, 6, 8–9.

**Files:** sửa `server/db/schema.ts`, `data/init-db.sql`, importer/schema docs; migrations; test `tests/integration/schema-ledgers.test.ts`.

- [ ] Red: tối đa một payable Legal/Clerk item mỗi contract, một entry/work item; job/inbox/event dedupe và một alert/stage/rule, shipment mã không trùng; đúng index cho jobs/session/payroll.
- [ ] Tạo đầy đủ work_items/payroll_entries/adjustments/clerk_incidents/shipments/tracking/inbox/outbox/file_backups/sla_alerts/idempotency/system_audit/credentials/heartbeat của SPEC.
- [ ] Thêm `json_import_runs`, `json_import_records` để hiện thực import ledger SPEC 3.4; unique source/record fingerprint, counts và evidence/report reference. Không tự đưa migrated legacy salary thành entry finalized.
- [ ] Work item lưu policy JSON bất biến và version; Legal có budget_ms, active_elapsed_ms/active_started_at để cập nhật dưới lock, input intervals lưu vào final snapshot. Timeline gốc vẫn từ draft/feedback events, không xoá review history.
- [ ] Green: `npm run test:integration -- tests/integration/schema-ledgers.test.ts`, lint/build. Mọi cột mới có mapping/schema documentation.

### T09 — Migration có khoá, quyền DB và test schema parity

**Depends:** T06–T08. **SPEC:** 3.3, 11.2.

**Files:** mở rộng `scripts/db-migrate.ts`; tạo `scripts/check-schema-parity.ts`, `tests/integration/migrations.test.ts`; sửa `scripts/build-server.mjs`, npm scripts, `tests/support/database.ts`, `data/init-db.sql`, migrations.

- [ ] Red: hai migrator chạy đồng thời không DDL race; runtime role không thể sửa/xoá audit/entry, bootstrap init SQL và migrations cho cùng schema constraints/index/defaults.
- [ ] Dùng cùng DB connection giữ advisory lock khi migrate; apply versioned SQL, rollback/exit nonzero khi fail. Không dùng schema push trực tiếp cho production.
- [ ] Migration role sở hữu DDL; runtime INSERT/SELECT audit, không UPDATE/DELETE audit/entry, trigger ngăn sửa immutable rows. Cho đúng quyền sequence cần cho số HĐ, không grant ALL cho tiện.
- [ ] Init SQL và migration có cơ chế tránh apply hai lần lên cùng DB: Compose chỉ chạy một pipeline schema; T56 bỏ mount init schema rồi migrate lại bảng trùng.
- [ ] Green: `npm run db:migrate`, `npm run test:integration -- tests/integration/migrations.test.ts`, toàn bộ schema tests T06–08, lint/build; helper test tạo/xoá **chỉ schema test**.

### T10 — Settings versioned, money/date/email validation thuần

**Depends:** T09. **SPEC:** 3.2, 6.1.

**Files:** tạo `server/modules/settings/repository.ts`, `service.ts`, `server/domain/money.ts`, `server/domain/dates.ts`, `server/domain/identifiers.ts`; test `tests/unit/money.test.ts`, `tests/unit/timezone.test.ts`, `tests/integration/settings.test.ts`.

- [ ] Red: 0 không fallback, recurring/unit/unknown không thành total, chuỗi mơ hồ giữ nguyên, date sai/ISO deadline không timezone bị chặn, stale settings version 409.
- [ ] Money parser bảo thủ giữ value_text và typed amount/kind chỉ khi rõ; không regex xoá mọi dấu rồi cộng. Chuẩn hoá email/số HĐ dùng một hàm mỗi loại; date không tự gán hôm nay.
- [ ] Settings update allowlist transaction + version + policy snapshot + system audit; users/secret không được mass-assign qua settings JSON.
- [ ] Green: `npm run test:unit -- tests/unit/money.test.ts tests/unit/timezone.test.ts`; `npm run test:integration -- tests/integration/settings.test.ts`; lint/build.

### T11 — List/detail/history repository, DTO và query thống nhất

**Depends:** T10. **SPEC:** 9.2, 10.1; B18/B22/B31.

**Files:** tạo `server/modules/contracts/repository.ts`, `dto.ts`, `validation.ts`, `routes.ts`; sửa `server/app.ts`; test `tests/integration/contracts-query.test.ts`, `tests/unit/dto-redaction.test.ts`.

- [ ] Red: page20 trên 45 rows trả total45/counts45; stable sort tie-break ID; input sort lạ không thành SQL; summary không chứa raw audit/files path/payroll người khác; detail/file scope trùng nhau.
- [ ] Query parameterized allowlist q/status/method/assignee/date/overdue/sort; money unknown cuối; số tổng theo **cùng filter**, không sum page. Read DTO nhận user scope từ auth port sẽ nối T18, không từ query role.
- [ ] Detail và histories riêng cursor/time+ID; 404 cho ngoài scope, không N+1 history toàn bảng. Không giả history=[] trong summary thành không có lịch sử.
- [ ] Green: `npm run test:integration -- tests/integration/contracts-query.test.ts`, `npm run test:unit -- tests/unit/dto-redaction.test.ts`, lint/build. Trước auth hoàn thiện chỉ private/test, không public route dữ liệu.

### T12 — Nối collection UI, sort/filter/page và đọc detail

**Depends:** T11. **SPEC:** 10.3, 13.

**Files:** sửa `src/services/api.ts`, `src/hooks/useContracts.ts`, `src/components/ContractTable.tsx`, `src/components/HistoryModal.tsx`, `src/constants/workflow.ts`, `src/App.tsx`, `src/types.ts`; test `tests/e2e/contracts-pagination.spec.ts`.

- [ ] Red: chuyển page không mất tổng; mobile load+10 đúng query; search cũ trả chậm không ghi đè mới; mở detail tải đúng ID ngoài page; skeleton/loading không hiện dữ liệu cũ nhầm.
- [ ] Đổi raw Contract[] fetch sang ContractPage; hook quản lý query/pagination/totals và hủy request cũ; bảng không sort/filter lần hai chỉ trên page; cards lấy server counts.
- [ ] Khi chọn hồ sơ fetch detail/histories, không truyền summary như detail hoàn chỉnh; giữ layout/class và bổ sung loading/error tối thiểu.
- [ ] Green: `npm run test:e2e -- tests/e2e/contracts-pagination.spec.ts` trong test environment, lint/build. Nếu auth chưa nối, dùng private test composition với fixtures, không thêm bypass production.

### T13 — Import JSON dry-run, đối soát và định danh ổn định

**Depends:** T09, T10. **SPEC:** 3.4; B35.

**Files:** sửa `scripts/migrate-json-to-pg.ts`; tạo `server/modules/import/inspect.ts`, `mapping.ts`, `tests/integration/json-import.test.ts`, `tests/fixtures/legacy-contracts.json`.

- [ ] Red: dry-run không ghi DB/source; 18 seed bị chặn production; missing files/role lạ/conflict number-ID/date-money mơ hồ được report, không tạo file/dữ liệu bịa.
- [ ] Mặc định dry-run; flags source/files-root/apply/include-demo/export-sql có validation, production cấm include-demo. Hash nguồn, history keys ổn định theo parent/collection/index/source.
- [ ] Map đủ users/settings/contracts/files/audit/feedback/VTP/physical; legacy actors label-only, salary legacy_unverified; đối chiếu storage path trong source root được phép.
- [ ] Green: `npm run test:integration -- tests/integration/json-import.test.ts -t dry-run`, lint/build. Dùng fixture copy test, không chạy apply lên data/database.json thật.

### T14 — Import apply atomic và gỡ JSON khỏi mọi runtime path

**Depends:** T11–T13. **SPEC:** G1/G6, 3.4; B21/B35.

**Files:** sửa importer, `server.ts`, `server/app.ts`, contract/settings repositories; tạo `server/modules/import/apply.ts`, `tests/integration/persistence.test.ts`; sửa schema/docs/build script.

- [ ] Red: apply lần hai counts không tăng/history không trùng; DB conflict rollback; DB down exit nonzero, không fallback export/seed; restart giữ dữ liệu, bảng rỗng không tái seed.
- [ ] Apply parameterized transaction + import ledger, stage/copy/hash file và đối soát trước commit; rollback DB có cleanup orphan có kiểm soát. Không silent ON CONFLICT đổi status hồ sơ khác.
- [ ] Gỡ readDb/writeDb/readLogs/writeLog/generateSeedContracts/MOCK_RECEIVERS khỏi app runtime; source JSON vẫn bảo toàn. Những mutation cũ chưa có service thật không được để chạy vào JSON hoặc trả success giả; chỉ kích hoạt routes mới sau dependency đủ.
- [ ] Green: `npm run test:integration -- tests/integration/json-import.test.ts tests/integration/persistence.test.ts`, toàn bộ unit/integration hiện có, lint/build.
- [ ] **Phase 1 gate:** PG-only runtime, schema parity/immutability/import/reads pass; UI list không vỡ wrapper; không có nghiệp vụ được quảng bá như đã hoàn tất khi write routes còn đang nối.

---

## Phase 2 — Danh tính thật, quyền và workflow

### T15 — Password hashing, bootstrap Admin và rate limit chia sẻ

**Depends:** T14. **SPEC:** 5.1; B15/B18.

**Files:** tạo `server/modules/auth/passwords.ts`, `repository.ts`, `rate-limit.ts`, `scripts/bootstrap-admin.ts`, `tests/integration/auth-bootstrap.test.ts`; sửa build/config/env/schema docs.

- [ ] Red: không password demo, bootstrap chỉ một lần kể cả chạy đôi; password 12–128 ký tự, hash không bằng password; disabled user không login; giới hạn 5 lần sai/15 phút dùng chung hai app instances.
- [ ] Argon2id với tham số kiểm chứng trên runtime được chọn; cấu hình khởi điểm memory64MiB/time3/parallelism1, đo chi phí và ghi quyết định. Không trim password, không log stdin/hash/token.
- [ ] Bootstrap giữ advisory lock, nhập email/name/password qua tương tác stdin, chỉ khi chưa có active Admin; không `--password`/tài khoản mặc định. Test gọi service bằng secret test, không cần ghi password vào source production.
- [ ] Rate-limit increment/lock nguyên tử ở PG theo account/IP đã hash; trusted proxy đúng, 429 + Retry-After; thông báo email/password sai chung, không account enumeration.
- [ ] Green: `npm run test:integration -- tests/integration/auth-bootstrap.test.ts`, lint/build; script compiled được thêm vào build ngay task này.

### T16 — Session PostgreSQL, CSRF, login/me/logout/revoke

**Depends:** T15. **SPEC:** 5.1–5.3, 10.2.

**Files:** tạo `server/modules/auth/service.ts`, `middleware.ts`, `routes.ts`, `server/http/csrf.ts`, `tests/support/session.ts`, `tests/integration/auth-session.test.ts`; sửa app/config/shared User DTO.

- [ ] Red: email-only/forged header không xác thực; regenerate session ID login; invalid Origin/CSRF bị403; logout/revoke/idle30m/absolute8h bị401; session còn hạn sống qua restart app.
- [ ] Wire express-session + connect-pg-simple store, cookie local/prod đúng SPEC, session chỉ userId/authVersion/loginAt/lastActivity. Đọc role/status DB mỗi request, không tin role được cache trong cookie/body.
- [ ] GET csrf cấp token anonymous ngắn hạn; POST login kiểm token/origin, rotate; GET me safe user+csrf; POST logout destroy+clear cookie đúng options. Không gửi raw session ID trong JSON.
- [ ] Session helper test đi qua HTTP login/CSRF/cookies thật; dùng fake clock được inject để test expiry, không sửa đồng hồ máy chủ.
- [ ] Green: `npm run test:integration -- tests/integration/auth-session.test.ts`, lint/build; request API không session →401 ngay trước route nghiệp vụ.

### T17 — Invite/reset/disable/role và Admin cuối cùng

**Depends:** T16. **SPEC:** 5.1–5.2.

**Files:** tạo `server/modules/auth/tokens.ts`, `tests/integration/user-management.test.ts`; mở rộng auth routes/service/repository, system audit.

- [ ] Red: token chỉ lưu hash, dùng một lần, invite48h/reset1h; disable không xoá lịch sử; đổi role/revoke có hiệu lực ngay; hai request không thể vô hiệu hết Admin.
- [ ] Implement invite/accept/reset-init/reset-complete/disable/update-role với transaction và scope Admin. Link một lần dùng PUBLIC_APP_URL đã validate; không tuyên bố mail đã gửi.
- [ ] Last-admin check giữ khoá nhất quán cho mọi đường role/disable; cùng transaction increment auth_version/revoke tokens/sessions/audit. Invited email chuẩn hoá không tạo user trùng.
- [ ] Raw invite/reset link chỉ được trả một lần ở response hành động được phép và không có trong logs/history public. Token hết hạn/không tồn tại trả lỗi chung.
- [ ] Green: `npm run test:integration -- tests/integration/user-management.test.ts`, lint/build. Không tạo quyền `requester` mới để chiều schema cũ.

### T18 — Scope/RBAC bắt buộc trên mọi endpoint và DTO

**Depends:** T17, T11. **SPEC:** bảng 5.2; B1/B15/B18/B20/B32.

**Files:** mở rộng auth middleware/contracts DTO/settings service; tạo `tests/integration/auth-security.test.ts`, `tests/integration/route-access.test.ts`.

- [ ] Red: liệt kê toàn bộ route dữ liệu/file/check-id/resolve/report/settings; anonymous401, role sai403, ngoài scope404. Contract response không chứa lương người khác, path/key/session/password, kể cả nested metadata.
- [ ] Đặt auth mặc định cho router `/api`; chỉ allowlist auth public/health/provider webhook verified. Quyền sửa theo legal owner/assignee hoặc clerk-assignee, không chỉ tên role.
- [ ] Tách read settings projection theo vai trò; Admin cũng không đọc lại raw secret. Đừng lọc field bằng cách stringify rồi replace; DTO allowlist rõ ràng.
- [ ] Service actor không đi qua role header; worker identity không thể tạo bằng request JSON. Admin được quyền hành động nhưng vẫn chịu guard dữ liệu/state/self-approval.
- [ ] Green: `npm run test:integration -- tests/integration/auth-security.test.ts tests/integration/route-access.test.ts`, lint/build; tập route inventory được cập nhật khi thêm route ở tasks sau.

### T19 — Nối UI session và loại bỏ đăng nhập/đổi role giả

**Depends:** T18. **SPEC:** 10.3, 13.

**Files:** sửa `src/components/AuthModal.tsx`, `src/hooks/useContracts.ts`, `src/services/api.ts`, `src/App.tsx`, `src/components/AdminSettings.tsx`; tạo `tests/e2e/auth.spec.ts`.

- [ ] Red: localStorage.role=admin không cấp quyền, reload gọi me, 401 clear cả hồ sơ/lương/selected detail, 403 không tự logout; password thật được gửi qua login đúng flow.
- [ ] Fetch wrapper cookie cùng origin + CSRF typed errors; bỏ x-user-role/actor fields và fallback email demo. Bỏ quick demo accounts/role switch và hard-code tên nhân viên; profile lấy DB.
- [ ] UI auth loading chặn flash hồ sơ; logout clear RAM/request/camera, không xoá tuỳ chọn UI không liên quan. Đổi copy “SSO/Google” thành đúng password profile, giữ style/modal.
- [ ] Nối invite/reset bằng form tối thiểu trong modal/panel hiện có; link một lần chỉ Admin thấy; disabled user không được mời lại để xoá lịch sử cũ.
- [ ] Green: `npm run test:e2e -- tests/e2e/auth.spec.ts`, auth integration tests, lint/build; tự tiếp T20, không chờ duyệt giao diện mới nếu không redesign.

### T20 — Ma trận action/guard và tính allowedActions

**Depends:** T18, T05. **SPEC:** 4.2–4.6.

**Files:** tạo `server/modules/workflow/actions.ts`, `guards.ts`, `milestones.ts`, `tests/unit/workflow-matrix.test.ts`; sửa shared/domain types.

- [ ] Red: Cartesian product 12 statuses × actions × user roles; chỉ ô SPEC4.3 được phép. Test thêm physical/digital/assignee/revision/file/missing proof, service actor chỉ action provider được giao.
- [ ] Pure guard trả transition definition hoặc domain error; allowedActions dùng cùng guard source, không một switch client khác. Role fail403, source/status fail409, thiếu prerequisite422 được phân biệt.
- [ ] Approve chỉ Admin và không cùng revision submitter; final state không được quay lùi; QR chỉ uỷ quyền tập action an toàn. Creation chỉ hai nhánh hợp lệ trong workflow.create.
- [ ] Milestone plan định nghĩa field nào ghi/giữ/reset mỗi action/cycle/attempt; không gán received/printed/picked-up giả để thoả guard.
- [ ] Green: `npm run test:unit -- tests/unit/workflow-matrix.test.ts`, lint/build. T20 chỉ rule thuần, không tự công bố đã có mutation API hoàn chỉnh.

### T21 — Transaction engine, audit, version và idempotency

**Depends:** T20, T09. **SPEC:** 4.1, 10.1; B13/B15/B21.

**Files:** tạo `server/modules/workflow/transition.ts`, `tests/integration/workflow-atomicity.test.ts`, `tests/integration/concurrency.test.ts`; mở rộng contract repository và outbox repository tối thiểu.

- [ ] Red: cùng key 2 request chỉ một mutation/audit/outbox; key khác cùng version một200/một409; payroll/audit/outbox insert fail rollback toàn bộ; replay không thua stale-version của chính operation.
- [ ] Hiện thực transaction claim-idempotency → contract FOR UPDATE → guard → domain writes → audit → transactional side-effects → outbox → save response → commit. Không giữ transaction khi HTTP/AI/file parse chạy.
- [ ] `workflow.transition` có dependency typed cho transaction side-effects; T31 nối payroll thật. Không cung cấp default no-op cho bước chốt bắt buộc; API payable approve/complete chưa được đăng ký/enable tới khi dependency đủ. Unit test có thể dùng port stub, app production không được.
- [ ] Audit server actor/time/requestId, exactly one row/status change; metadata writes có own event cùng status, immutable triggers giữ nguyên. Không cho repository khác gán status tự do.
- [ ] Green: `npm run test:integration -- tests/integration/workflow-atomicity.test.ts tests/integration/concurrency.test.ts`, lint/build. Test service core với fixture thật; không dùng callback rỗng để chứng minh đã chốt lương.

### T22 — Tạo yêu cầu/hồ sơ, submit/feedback/revision/snapshot

**Depends:** T21, T10. **SPEC:** 4.2–4.3, 7.2.

**Files:** tạo `server/modules/contracts/service.ts`, `revisions.ts`; mở rộng routes/validation/identifiers; test `tests/integration/revisions.test.ts`, `tests/integration/drafting.test.ts`.

- [ ] Red: Admin-only giao task; client basePay/actor/status bị422 unknown field; manual không payable; submit cần file/Docs hợp lệ; feedback đúng revision tăng một lần; approve reference không trỏ file của hồ sơ khác.
- [ ] Workflow.create cấp ID UUID/số nội bộ sequence và register identifier cùng transaction, metadata được xác nhận, audit null→initial; không để AI tự tạo hồ sơ. Direct upload-confirm đầy đủ nối T35–37, chưa có thì fail closed.
- [ ] Revision/cycle IDs bất biến; Google Docs link-only được submit nhưng không đủ approve; snapshot route attach file/hash đúng revision chưa có file, không thay submitted_at/status. Nhận nội dung mới phải qua revision mới.
- [ ] Đưa auth/CSRF trước Multer ngay ở upload draft tạm dùng; file thật có giới hạn25MiB/hash/storage key, không path public. T34 harden toàn bộ container/MIME/cleanup, không tái mở upload anonymous trong thời gian chờ.
- [ ] Green: `npm run test:integration -- tests/integration/revisions.test.ts tests/integration/drafting.test.ts`, lint/build; lưu file fixture thật, không tạo metadata placeholder file vắng.

### T23 — Physical in/ký/vận đơn/manual pickup/delivery

**Depends:** T22. **SPEC:** 4.3–4.4, 6.3, 8.1 manual.

**Files:** mở rộng workflow/contract routes/milestones; tạo `tests/integration/physical-workflow.test.ts`.

- [ ] Red: in trước duyệt409, digital không in/giao vận; waybill rỗng/trùng/receiver thiếu422; pickup thiếu current shipment bị chặn; ghi note không làm đã giao.
- [ ] Ánh xạ print/sign/waybill/confirm-pickup/confirm-delivery đúng engine; ghi actor là người xác nhận, không Sếp/VTP giả. Shipment manual source rõ, không nói API đã tạo đơn.
- [ ] Claim Clerk atomic lúc print nếu chưa được giao; Admin hỗ trợ ghi người thực và Clerk beneficiary riêng. Waybill readiness từ sign, delivery timestamp có chứng cứ/manual confirmation rõ.
- [ ] Transaction tests có milestone chronology valid, không đổi từ chờ shipper sang đang giao khi chưa có mã. Approval endpoints chỉ mở đầy đủ sau T31 atomic payroll binding.
- [ ] Green: `npm run test:integration -- tests/integration/physical-workflow.test.ts`, lint/build; old routes không gán status ngoài engine.

### T24 — Digital, signed scan, archive và guard hoàn tất

**Depends:** T23. **SPEC:** 4.3–4.4, 6.5, 7.3; B2/B4/B32.

**Files:** mở rộng workflow/files/contract validation; tạo `tests/integration/digital.test.ts`, `tests/integration/completion.test.ts`.

- [ ] Red: digital manual ban đầu chờ duyệt, sau approve chờ bản trả về; in/ký giấy/waybill timestamps null, không Clerk payable item. Scan sai state/thiếu ký nhận/empty archive không complete.
- [ ] Scan/receipt confirmation phải đúng contract/cycle/version, file persisted trước công bố DB. Digital Clerk có thể claim tác nghiệp ở scan, không tự sinh tiền.
- [ ] Physical payable thiếu beneficiary/milestone chặn422, không complete rồi bỏ entry. Drive failure không kéo workflow về trạng thái cũ vì backup optional.
- [ ] T31 nối completion với entry Clerk cùng transaction; trước binding không enable payable completion thật. T34–39 bổ sung mọi MIME/client/camera flow mà không nới guard.
- [ ] Green: `npm run test:integration -- tests/integration/digital.test.ts tests/integration/completion.test.ts`, lint/build.

### T25 — Reject/issue/redraft/reship/cancel giữ nguyên lịch sử

**Depends:** T24. **SPEC:** 4.3–4.4, 6.5; B19/B30.

**Files:** mở rộng workflow/contracts/revisions/milestones; tạo `tests/integration/exceptions.test.ts`, `tests/integration/shipment-cycles.test.ts`.

- [ ] Red: action sai source409; lý do trống422; redraft hash cũ/không file mới bị chặn; reship mất/hỏng chưa có chứng cứ ký lại/Admin confirmation bị chặn; cancel cuối không hồi sinh.
- [ ] Redraft tạo cycle mới/revision mới + non-payable rework nếu cần, giữ audit/entry/cycle cũ. Reset projection hiện hành, không xoá shipment/events trước đó.
- [ ] Reship supersede attempt cũ và chuẩn bị attempt mới; guard bản thay thế được Admin xác nhận. Bổ sung action không đổi status `POST /api/contracts/:id/replacement-approval` Admin-only lưu evidence file + audit, để Clerk không tự giả boolean xác nhận của Admin.
- [ ] Cancel chỉ Admin, lý do, stop jobs chưa gửi và đối soát job đang gửi; giữ earned Legal entry, không tự truy thu/huỷ đơn provider bằng thay status nội bộ.
- [ ] Green: `npm run test:integration -- tests/integration/exceptions.test.ts tests/integration/shipment-cycles.test.ts`, lint/build; callback chuyến cũ không điều khiển cycle mới.

### T26 — Assignment, edit allowlist, correction và physical notes

**Depends:** T25. **SPEC:** 4.5, 5.2, 6.4, D9/D11; B26/B27.

**Files:** tạo `server/modules/contracts/assignments.ts`, `physical-notes.ts`, `tests/integration/physical-notes.test.ts`, `tests/integration/contract-edits.test.ts`; mở rộng validation/routes/audit.

- [ ] Red: Clerk note sống qua restart với actor/time server; client history array/status/payroll/timestamp bị chặn; metadata sau duyệt không silently edit; Admin reassign active task có reason, entry đã chốt không đổi người.
- [ ] Note route chỉ nhận note+version; append event, DTO projection giữ UI cũ. Task/receiver/legal metadata allowlist riêng, không `Object.assign(contract,body)`.
- [ ] `POST /api/contracts/:id/corrections` Admin-only ghi đính chính có reason/evidence/diff vào audit bất biến, giữ tài liệu/metadata pháp lý gốc đã duyệt. Đây là hiện thực D9, không backdoor sửa status hoặc lương.
- [ ] Identifier registry giữ số cũ thành alias trong transaction; không cho tái dùng số/alias của hồ sơ khác. `/status` cũ trả410, production simulator sẽ gỡ hẳn T49.
- [ ] Green: `npm run test:integration -- tests/integration/physical-notes.test.ts tests/integration/contract-edits.test.ts`, auth/workflow tests, lint/build.
- [ ] **Phase 2 gate:** auth/RBAC/session/guard/transaction/revisions/exceptions pass; không còn role switch/actor giả. Các action payable chưa binding payroll được ghi rõ private integration gate, không báo app hoàn tất; T27–31 xử lý ngay tiếp theo.

---

## Phase 3 — Một engine lương, snapshot và sổ cái bất biến

### T27 — Policy snapshot và primitives tiền/duration

**Depends:** T26, T10. **SPEC:** 6.1–6.3.

**Files:** sửa `src/utils/payroll.ts`; tạo `server/modules/payroll/policy.ts`, `tests/unit/payroll-amount.test.ts`; sửa types/settings schema/import/docs khi cần.

- [ ] Red: base0 giữ0, tổng hệ số âm clamp0, .5 VND half-up, invalid/unsafe input bị chặn; policy defaults đầy đủ và zero rates không fallback.
- [ ] Engine không import DOM/DB/settings global hoặc `new Date()` ngầm. Server lấy policy locked/versioned; `calculatePayrollAmount(basePay,ratesPct)` chỉ nhận số nguyên phần trăm và integer VND, dùng bigint/decimal bên trong.
- [ ] Contract pure mới: `calculateTaskPayroll(input,policy)` nhận basePay/budgetMs/usedMs/urgencyLevel/feedbackCount; `calculateClerkPayroll(input,policy)` nhận basePay/printingMs/courierMs/retrievalMs/confirmedIncidentCount. Missing dữ liệu xử lý bằng eligibility ở service, không bịa timestamp trong engine.
- [ ] DTO vẫn có breakdown/coef để UI hiển thị, nhưng tiền chỉ tính từ rate integer. Policy snapshot lúc giao Legal/ready Clerk, settings đổi chỉ task mới; engineVersion được lưu.
- [ ] Green: `npm run test:unit -- tests/unit/payroll-amount.test.ts`, lint/build. Bộ test và hàm mẫu đầy đủ trong phụ lục A của plan là oracle cho task này.

### T28 — Legal urgency/SLA active-duration/feedback

**Depends:** T27. **SPEC:** 6.2, 6.6; B5/B6/B7/B14/B20/B36.

**Files:** sửa `src/utils/payroll.ts`, workflow draft timing; tạo `tests/unit/legal-payroll.test.ts`, `tests/integration/legal-timing.test.ts`.

- [ ] Red: các vector650k/500k/400k/800k/600k; biên1h/3h/24h và1ms; feedback0/1/2/3/4. Lần nộp được duyệt mới là kết thúc, thời gian chờ review không tính.
- [ ] Khi submit cộng khoảng đang soạn, pause; feedback mở khoảng sửa; approve dùng toàn bộ thời gian xử lý đến accepted revision, không tính tới giờ Admin duyệt. So sánh tỷ lệ bằng ms và cross-multiply, không round giờ trước chọn bậc.
- [ ] Urgency Admin chọn hoặc suy từ D hợp lệ, rate và các ngưỡng1h/3h/24h đều từ settings snapshot; operator đổi ngưỡng phải có boundary tests mới. Chất lượng0/−10/−20/−30 mặc định. Chỉ task payable do Admin giao mới được xét entry.
- [ ] Đổi deadline/urgency task mở có audit và nguyên nhân; policy rates/base snapshot không tự thay bằng settings mới. Client basePay/urgencyCoef không được nhận authoritative.
- [ ] Green: `npm run test:unit -- tests/unit/legal-payroll.test.ts`, `npm run test:integration -- tests/integration/legal-timing.test.ts`, lint/build.

### T29 — Clerk KPI đúng mốc, đúng người, incident riêng

**Depends:** T28. **SPEC:** 6.3–6.6; B9/B10/B32.

**Files:** sửa `src/utils/payroll.ts`; tạo `server/modules/payroll/incidents.ts`, `tests/unit/clerk-payroll.test.ts`, `tests/integration/clerk-ownership.test.ts`.

- [ ] Red: in từ approved, tạo vận đơn từ sign, retrieval shipment cuối; ví dụ100k→150k; thêm2 feedback Legal không đổi150k; carrier issue chưa quy trách nhiệm không phạt; digital/unfinished không finalized.
- [ ] Đọc Clerk threshold percentages/rates từ snapshot: print50/75/100/150/200; courier50/100; retrieval50/100, duration2h/4h/7d. Test đúng3.5 ngày là50% của7 ngày.
- [ ] Incident riêng chỉ confirmed_by Admin tính quality; người ghi incident không được tự xác nhận trách nhiệm của mình để định đoạt tiền. Sau chốt incident mới chỉ qua adjustment, không sửa entry.
- [ ] Một Clerk beneficiary/work item, Admin hỗ trợ không tự nhận tiền; reship/redraft không chọn lần nhanh nhất hoặc nhân base. Preview thiếu milestone hiển thị chưa đủ điều kiện, không default full base pay.
- [ ] Green: `npm run test:unit -- tests/unit/clerk-payroll.test.ts`, `npm run test:integration -- tests/integration/clerk-ownership.test.ts`, lint/build.

### T30 — Payroll ledger, adjustments và đối soát legacy

**Depends:** T29. **SPEC:** 3.4, 6.4–6.5.

**Files:** tạo `server/modules/payroll/repository.ts`, `service.ts`, `dto.ts`, `tests/integration/payroll-ledger.test.ts`; mở rộng schema/import snapshots.

- [ ] Red: unique entry/work item, UPDATE/DELETE DB bị chặn; adjustment ghi thêm, net âm vẫn minh bạch; cùng key không ghi delta hai lần; reassign không đổi beneficiary entry.
- [ ] Entry lưu input/policy/rates/engineVersion/amount/beneficiary/finalized actor-time; tính tổng bằng số chính xác. Hủy trước duyệt0, sau duyệt giữ earned Legal, Clerk chưa complete không tự có entry.
- [ ] Legacy import giữ legacy_unverified ngoài tổng. Thêm `POST /api/payroll/legacy-confirmations` Admin-only nhận source/import record, beneficiary, số tiền đã đối soát, reason/evidence; tạo immutable entry source=legacy_confirmed, không giả engine mới đã tính. Chỉ dùng dữ liệu thật khi owner cho phép đối soát.
- [ ] Adjustment Admin-only bounded integer delta + reason, entry FK, audit transaction, không payout/thu tiền thật. Policy/input gốc không sửa.
- [ ] Green: `npm run test:integration -- tests/integration/payroll-ledger.test.ts`, lint/build.

### T31 — Nối workflow/payroll/audit/outbox cùng transaction

**Depends:** T30, T21–T26. **SPEC:** 4.1, 6.5; B1/B2/B5/B8/B21.

**Files:** sửa workflow transition/contracts service/payroll service; tạo `tests/integration/payroll.test.ts`, mở rộng concurrency/atomicity/completion tests.

- [ ] Red: double approve/scan sinh một entry; fail payroll insert rollback status/audit/outbox; thiếu beneficiary không complete; settings đổi lúc approve không đổi policy task đã nhận.
- [ ] Bind payroll side-effects thật vào WorkflowServices: create request snapshot, approve Legal finalize + Clerk work item physical ready, complete physical Clerk finalize. Digital không tạo item/entry Clerk.
- [ ] Mở các route payable đã fail closed trước đó, bỏ integration gate tạm; kiểm toàn bộ API hành động đến service thật, không còn no-op/fallback vào công thức server cũ.
- [ ] Khi Admin đổi settings song song create/approve, transaction đọc version nhất quán; chỉ policy được lưu ở task mới quyết định amount. Không chạy tính tiền sau commit như background task.
- [ ] Green: `npm run test:integration -- tests/integration/payroll.test.ts tests/integration/workflow-atomicity.test.ts tests/integration/concurrency.test.ts tests/integration/completion.test.ts`, unit payroll, lint/build.

### T32 — Payroll query/export cùng nguồn, cùng scope/kỳ

**Depends:** T31. **SPEC:** 6.4–6.5, 9.2, 10.3; B8/B32/B33.

**Files:** tạo `server/modules/payroll/routes.ts`, `csv.ts`, `tests/integration/payroll-query.test.ts`, `tests/unit/csv.test.ts`; mở rộng service/repository.

- [ ] Red: non-admin thêm beneficiary query người khác không đọc được; tháng boundary VN đúng `[from,to)`; finalized/preview/adjustment tách, bảng và CSV cùng filter tổng giống nhau.
- [ ] GET payroll + export dùng một query builder/domain result; Admin được all, Legal/Clerk own. Không lấy tháng upload, không tính lại finalized bằng settings hiện tại.
- [ ] CSV UTF-8 BOM, escape quote/newline, chống formula text sau whitespace/control; numeric tiền typed không bị biến thành text công thức. Stream/batch export bounded, không bypass scope khi export.
- [ ] Green: `npm run test:integration -- tests/integration/payroll-query.test.ts`, `npm run test:unit -- tests/unit/csv.test.ts`, lint/build.

### T33 — Nối dashboard lương, form giao việc và settings

**Depends:** T32, T19. **SPEC:** 6.4, 10.3, 13; B14/B20/B36.

**Files:** sửa `src/components/LegalPayrollDashboard.tsx`, `CreateDraftingRequestModal.tsx`, `AdminSettings.tsx`, hooks/API/types/App; tạo `src/utils/datetime.ts`, `tests/e2e/payroll.spec.ts`, `tests/e2e/timezone.spec.ts`.

- [ ] Red: hiển thị đúng650k/snapshot sau đổi settings/reload; CSV cùng số; Clerk không thấy lương khác; zero denominator là—; địa phương chọn17:00 VN lưu/reload đúng17:00.
- [ ] Bỏ tính tiền chính thức bằng engine import trong component và client CSV math. Render server breakdown, preview/not_eligible/finalized/adjustments rõ, không tính task chờ review là completed.
- [ ] Dropdown nhân sự active thật, bỏ defaults email/giá trị100triệu mẫu; Admin-only giao task, base pay read-only từ settings và không gửi như giá tự chọn. Deadline chuyển timezone đúng, không cắt UTC làm local.
- [ ] Cấu hình rates/thresholds mới trong panel sẵn có, validation lỗi có field; chưa đủ quyền không fetch reports/settings secret. Không thay theme/navigation.
- [ ] Green: `npm run test:e2e -- tests/e2e/payroll.spec.ts tests/e2e/timezone.spec.ts`, payroll tests, lint/build.
- [ ] **Phase 3 gate:** full physical/digital workflow cùng ledger thật đã nối; UI/CSV đúng snapshot, own-scope và timezone; không còn ba công thức lệch nhau hay payable routes chưa có side-effect.

---

## Phase 4 — File, scan, QR và UI dùng được thật

### T34 — Hardening storage, MIME/container và giới hạn tài nguyên

**Depends:** T33. **SPEC:** 7.1; B23/B29.

**Files:** tạo/mở rộng `server/modules/files/storage.ts`, `validation.ts`, `service.ts`, `routes.ts`; test `tests/integration/files.test.ts`, `tests/unit/file-validation.test.ts`; sửa package/lock nếu cần thư viện detect MIME/ZIP an toàn.

- [ ] Red: anonymous/role sai không tạo file; >25MiB413, MIME giả415, ZIP bomb/DOCX malformed/HTML/SVG/path traversal/control chars bị chặn; tên Việt/emoji roundtrip đúng, không double-decode UTF-8.
- [ ] Middleware auth/role/scope/CSRF trước stream upload; limit file/field/count. Detect magic bytes/container DOCX, cap giải nén100MiB/2.000entries/text200k/parser10s; kiểm actual stream, không chỉ tin ZIP headers.
- [ ] Storage key UUID tương đối, chỉ MIME allowlist và extension xác minh; file root ngoài dist, chống symlink/path escape. Parser nặng chạy worker/thread có thể terminate, không chỉ Promise.race để process vẫn ngốn RAM sau timeout.
- [ ] Stage→verify/hash→atomic rename→DB publication, failure không tạo metadata file chưa có; cleanup có reference/lease protection. Download không execute/render untrusted HTML/PDF JS.
- [ ] Green: `npm run test:unit -- tests/unit/file-validation.test.ts`, `npm run test:integration -- tests/integration/files.test.ts`, lint/build; no upload static route.

### T35 — Upload resource, consume đúng owner và snapshot file

**Depends:** T34, T22. **SPEC:** 7.2, 4.2.

**Files:** tạo `server/modules/uploads/routes.ts`, `service.ts`; mở rộng file/revision/contracts service; test `tests/integration/uploads.test.ts`.

- [ ] Red: upload chưa thành contract; owner khác/hết24h/đã consume/contract khác không dùng được; hai create cùng upload chỉ một consume; AI fail giữ file, không sinh contract bịa.
- [ ] POST uploads trả ID/status, GET owner/admin status/suggestions nullable, có checksum/expiry và extraction state. Chưa có worker/AI thì not_configured đúng, không job completion giả.
- [ ] JSON confirmed create dùng uploadId + metadata, consume/link contract/revision/file/audit transaction. `/manual` chia sẻ service, chấp nhận Docs hoặc uploadId hợp lệ. Legacy multipart `/contracts` thiếu xác nhận422.
- [ ] Snapshot route chuyển sang storage hardened; approved hash/file không thay được, không consume upload bên ngoài scope. Không đổi submit time khi chỉ đóng băng Docs revision.
- [ ] Green: `npm run test:integration -- tests/integration/uploads.test.ts tests/integration/revisions.test.ts`, lint/build; inspect DB/file count trước/sau failure.

### T36 — Download/private histories, physical note và audit redaction

**Depends:** T35, T26. **SPEC:** 4.5, 5.2–5.3, 7.1, 10.2.

**Files:** mở rộng files/contracts routes/DTO/physical notes; tạo `tests/integration/history-download.test.ts`; sửa `src/components/HistoryModal.tsx`, API/hooks.

- [ ] Red: guessed fileId sai contract404, no session401; UTF-8 filename* đúng; missing file404 rõ; histories cursor không trùng/mất row khi timestamp bằng nhau; note lưu thật sau restart.
- [ ] Stream từ storage key đã validate, metadata safe, Content-Disposition attachment/nosniff/no-store. Không trả filePath/storage key/ciphertext ở bất cứ response nào.
- [ ] Audit rows mới không nhúng số lương vào note công khai; chi tiết lương chỉ payroll API có quyền. Legacy note không phân loại chắc chắn phải mask cho non-admin, không tin raw text không chứa lương.
- [ ] History modal load detail/audit/tracking với cursor; giữ bố cục và from/to/actor/time, có nút tải tiếp, không xem summary history thiếu như không có.
- [ ] Green: `npm run test:integration -- tests/integration/history-download.test.ts tests/integration/physical-notes.test.ts`, lint/build; download từ browser dùng cùng cookie, không URL token public.

### T37 — Form tạo hợp đồng: upload → xác nhận, manual fallback

**Depends:** T36. **SPEC:** 7.2, 10.3, 13.

**Files:** sửa `src/components/CreateContractForm.tsx`, upload modal trong `src/App.tsx`, hooks/API/types; tạo `tests/e2e/create-contract.spec.ts`.

- [ ] Red: AI disabled/quota vẫn nhập tay với upload đã giữ; field không rõ không tự điền ngày/giá trị/đối tác; double submit không tạo hai hồ sơ; lỗi unique409 giữ form/file.
- [ ] Hiển thị suggestions editable + nút xác nhận trong modal kết quả sẵn có; confirmed metadata/processingMethod rõ. Digital không ép địa chỉ/bản in, physical chưa biết receiver phải bổ sung trước waybill chứ không người nhận random.
- [ ] Upload progress byte qua XHR nếu hiển thị phần trăm, AI processing indeterminate; bỏ timer tăng15%. Check-id lỗi không tự báo mã còn trống; abort query cũ khi sửa mã.
- [ ] Google Docs allowlist HTTPS đúng host/path, không fetch tùy ý từ server. Frozen file requirement được giải thích trước approve, không ngầm chặn mà thiếu cách đính kèm.
- [ ] Green: `npm run test:e2e -- tests/e2e/create-contract.spec.ts`, upload/integration tests, lint/build; giữ layout screenshot baseline.

### T38 — QR identifier/legacy resolve/print an toàn

**Depends:** T37, T20, T26. **SPEC:** 4.6; B3/B16/B33.

**Files:** mở rộng `server/modules/contracts/identifiers.ts`, QR delegation routes; sửa `src/components/ContractTable.tsx`, `ContractScanner.tsx`; test `tests/integration/qr.test.ts`, `tests/e2e/qr.spec.ts`, `tests/e2e/print-security.spec.ts`.

- [ ] Red: QR payload ID bất biến; tem số cũ resolve sau đổi số; identifier collision concurrent bị chặn; scan ngoài page tìm được hồ sơ, không lấy hợp đồng đầu tiên.
- [ ] Resolve server exact normalized ID/current/alias, ambiguity không auto-pick. `/qr-transition` nhận expectedAction/version/key, delegate engine guard, không switch next status riêng.
- [ ] Duplicate frame/click giữ cùng operation key →một transition; cần lượt xác nhận mới cho action tiếp. Chờ duyệt/thiếu mã/thiếu scan không nhảy bước bằng QR, không dùng tem văn phòng làm chứng cứ delivered.
- [ ] In bằng DOM/React textContent hoặc escape toàn bộ interpolations; tên/địa chỉ chứa HTML không chạy script. Không mở URL arbitrary từ QR, không nhúng session token/PII vào payload.
- [ ] Green: `npm run test:integration -- tests/integration/qr.test.ts`, `npm run test:e2e -- tests/e2e/qr.spec.ts tests/e2e/print-security.spec.ts`, lint/build.

### T39 — Scanner/camera/PDF/đối khớp không giả

**Depends:** T38. **SPEC:** 7.3; B2.

**Files:** sửa `src/components/ContractScanner.tsx`, `ClerkManualMatcher.tsx`, hooks/API; tạo `tests/e2e/scanner.spec.ts`.

- [ ] Red: auto-match không dùng contracts[0]/first waiting; nhiều candidate phải chọn; camera denied/manual upload, failed upload giữ pages; đóng modal stop tracks và scan loop; stale state409 không toast success.
- [ ] Giữ crop/xoay/filter/multi-page jsPDF, max20trang/cạnh3000px/output25MiB. Matching ưu tiên QR exact →exact số HĐ →gợi ý có chứng cứ, luôn preview/confirm đúng HĐ/cycle trước scan.
- [ ] Đối khớp q/resolve ở server; chưa OCR thật thì nói rõ, không chờ1.5s rồi chọn. Không tự xác thực chữ ký bằng AI hoặc nói đã nhận đủ hồ sơ khi chưa có xác nhận.
- [ ] Camera tests dùng media fixture trong test runner; thêm checklist thiết bị thật HTTPS vào acceptance. Chưa có thiết bị thì ghi hardware_pending, không nói camera thật đã kiểm.
- [ ] Green: `npm run test:e2e -- tests/e2e/scanner.spec.ts`, completion/file tests, lint/build; manual receipt/scan vẫn dùng được không AI/Drive.

### T40 — UI mọi action/ngoại lệ, pending và lỗi nhất quán

**Depends:** T39, T31. **SPEC:** 10.3, 13.

**Files:** sửa `src/hooks/useContracts.ts`, `src/services/api.ts`, `src/components/ContractTable.tsx`, `LegalPayrollDashboard.tsx`, `HistoryModal.tsx`, `src/App.tsx`; test `tests/e2e/workflow-actions.spec.ts`.

- [ ] Red: handler thất bại phải reject/return failure, modal không đóng/toast success; request timeout retry key cũ;409 refresh data nhưng không tự lặp mutation với version mới.
- [ ] Nối tất cả endpoints thật: draft/feedback/approve/snapshot/in/ký/waybill/manual pickup-delivery/scan/archive/reject/issue/redraft/reship/cancel/assignment/note/correction/incident. Guard UI theo allowedActions, server vẫn là authority.
- [ ] Redraft có file revision mới, reship có proof/Admin approval theoT25, scan có signed/receipt confirmations; Admin chọn Clerk beneficiary khi hỗ trợ, digital không hiện lương Clerk giả.
- [ ] Loại menu status override, fallback names/emails và success copy sai. Chỉ thêm input/tooltip cần thiết trong panel hiện có, không thay bộ component/theme.
- [ ] Green: `npm run test:e2e -- tests/e2e/workflow-actions.spec.ts`, lint/build; API inventory không có button gọi route chưa triển khai.

### T41 — Regression UI desktop/mobile và accessibility cơ bản

**Depends:** T40, T05. **SPEC:** G7, 13.

**Files:** tạo `tests/e2e/visual-regression.spec.ts`, `tests/e2e/navigation.spec.ts`; chỉnh targeted component/CSS chỉ khi regression thật; evidence Phase4.

- [ ] Red: desktop/mobile tất cả màn hình baseline không overflow/mất nút, keyboard submit/cancel/focus modal, loading/error/empty state đúng; phiên role không phù hợp không vào tab admin.
- [ ] Chụp cùng viewport/content test/thiết lập deterministic, so với ảnh nguồn; mỗi delta phải giải thích theo SPEC13. Không update toàn bộ snapshot để che redesign ngoài phạm vi.
- [ ] E2E support server/fixtures chỉ trong tests; không thêm debug API/time-travel/seed endpoints vào production. Kiểm import graph production không trỏ tests.
- [ ] Green: `npm run test:e2e -- tests/e2e/visual-regression.spec.ts tests/e2e/navigation.spec.ts`, toàn bộ e2e hiện có, lint/build.
- [ ] **Phase 4 gate:** full manual physical/digital qua browser, file thật tải lại được, QR/scan chống gắn nhầm và guard vẫn giữ; hardware chưa có được khai báo riêng, không fake pass.

---

## Phase 5 — Integrations thật, worker và vận hành

### T42 — Registry provider, secret write-only và tài liệu hiện hành

**Depends:** T41. **SPEC:** 8.0, 5.3.

**Files:** tạo `server/integrations/status.ts`, `outbound.ts`, `server/modules/settings/secrets.ts`, `tests/support/providers.ts`, `tests/integration/integration-security.test.ts`; tạo `docs/integrations/teams.md`, `gemini.md`, `drive.md`, `vtp.md`.

- [ ] Red: credentials/URL/ciphertext không có trong settings/log/bundle; env-managed không bị DB ghi đè; invalid/private/redirect SSRF target bị chặn; no credential là not_configured, không healthy.
- [ ] Xác minh docs chính thức tại thời điểm code: URL/date/version/auth/payload/error/rate-limits; đọc SDK/API tương ứng, không lấy endpoint từ ARCHITECTURE cũ làm chuẩn. Không có docs cần thiết ghi blocker provider và tiếp tục nhánh khác.
- [ ] AES256-GCM với encryption key32byte env, nonce/tag/key version; secret write-only; Gemini/VTP/Drive credential server/env/secret mount, **không input Gemini key trên frontend**.
- [ ] HTTP outbound adapter có allowlist HTTPS/origin, DNS/egress validation, timeout, redirect policy và error redact. Test stub local HTTP chỉ được inject trong test services, không cho production tùy ý bật flag bypass SSRF.
- [ ] Green: `npm run test:integration -- tests/integration/integration-security.test.ts`, lint/build; docs ghi gì verified/blocked rõ, không có “mẫu như thật” không dẫn nguồn.

### T43 — Durable outbox/inbox, lease, retry và worker thật

**Depends:** T42, T21. **SPEC:** 8.0, 9.1.

**Files:** tạo `server/worker.ts`, `server/jobs/outbox.ts`, `inbox.ts`, `retry.ts`, `tests/integration/worker.test.ts`; sửa build/npm/config, outbox repository.

- [ ] Red: worker chết sau claim thì lease được reclaim; hai worker không cùng sở hữu job; lỗiHTTP không rollback contract đã commit; duplicate event không nhân queue; lease owner cũ không ghi kết quả của lease mới.
- [ ] Claim SKIP LOCKED transaction, lease token, commit rồi HTTP; timeout<lease hoặc renew có token. State queued/running/retry/succeeded/dead/skipped/awaiting_reconciliation rõ; không “exactly-once qua mạng” giả.
- [ ] Teams/Drive tối đa5 attempts,30s exponential+jitter cap30m, respect Retry-After; AI budget riêng; VTP unknown result không chung retry tạo đơn. Fake clock/random injected cho tests retry không sleep dài.
- [ ] Worker entrypoint không HTTP port, terminate graceful và release/expire lease đúng; build JS worker được thêm ngay. Không tạo job runner timer trong từng Express instance.
- [ ] Green: `npm run test:integration -- tests/integration/worker.test.ts`, atomicity/concurrency tests, lint/build; start app+worker test riêng, không gửi ra provider public.

### T44 — Teams template object và gửi thật có kiểm tra kết quả

**Depends:** T43. **SPEC:** 8.2; B12.

**Files:** tạo `server/integrations/teams/client.ts`, `template.ts`, `tests/unit/teams-template.test.ts`, `tests/integration/teams.test.ts`; nối outbox handler/settings validation.

- [ ] Red: quote/newline/backslash/Vietnamese/nested template thành JSON đúng; placeholder lạ/template sai422; HTTP500/429/401 không succeeded; URL thiếu skipped/not_configured.
- [ ] Parse JSON rồi map string values cho title/text/contractId/status/timestamp, serialize JSON cuối; escape card markup theo format tenant đã xác minh. Không replace trực tiếp chuỗiJSON thô.
- [ ] Client chỉ sends endpoint tenant được phép, timeout/classify retry, 2xx + provider success semantics. Không gửi lương/scan/PII không cần vào kênh chung.
- [ ] Green: `npm run test:unit -- tests/unit/teams-template.test.ts`, `npm run test:integration -- tests/integration/teams.test.ts`, lint/build. Live send chỉ khi có quyền/URL/test data; thiếu thì ghi unverified_external, không ảnh hưởng tests core.

### T45 — Gemini suggestions nullable, model env và quota fallback

**Depends:** T42, T43, T35; độc lập với credential Teams. **SPEC:** 8.3; B5 liên quan không dùng AI tính lương.

**Files:** tạo `server/integrations/gemini/client.ts`, `tests/integration/ai-extraction.test.ts`; nối uploads/outbox/parser và docs.

- [ ] Red: thiếu key/model không random data, timeout/429 giữ upload và manual input; structured response sai/null fields không thành ngày hôm nay/giá0 mặc định; nội dung file prompt injection không tạo side effects.
- [ ] Model từ GEMINI_MODEL đã xác minh availability, SDK chính thức; DOCX text bounded, PDF/image modality đúng. Response schema+validation chỉ suggestions, không workflow/identity/signature/matching authority.
- [ ] Job timeout60s/concurrency2/max2 retry tạm thời, cap text/token/file; quota hết không tự retry vô hạn. Không log raw contract/prompt/AI response; chỉ metadata lỗi đã redact.
- [ ] Green: `npm run test:integration -- tests/integration/ai-extraction.test.ts`, upload/create e2e, lint/build. Test contract qua stub/SDK port không được ghi thành bằng chứng Gemini thật.

### T46 — Drive backup file thật và đối soát remote ID

**Depends:** T42, T43, T34; độc lập với credential Gemini/Teams. **SPEC:** 8.4; D12.

**Files:** tạo `server/integrations/drive/client.ts`, `tests/integration/drive-backup.test.ts`; mở rộng backups repository/outbox/docs, `package.json`/lockfile khi tài liệu đã xác minh yêu cầu Google auth/client library.

- [ ] Red: không credentials/folder quyền sai không fake drv_ID; timeout sau remote created không nhân file; checksum/provider/fileID unique; Drive fail không đổi contract completed về cũ.
- [ ] Xác minh Shared Drive/folder quyền service account và quota, credential mount ngoài dist; không public-share link. Upload file actual bytes, lưu remote ID/hash/appProperties dùng tìm lại.
- [ ] Before retry reconcile remote by fileID/checksum/request correlation; provider không đối soát được thì operator-required, không “backup succeeded” từ timer. File private nội bộ vẫn nguồn gốc chính.
- [ ] Green: `npm run test:integration -- tests/integration/drive-backup.test.ts`, lint/build. Live artifact remote chỉ ghi verified khi có ID thật được kiểm chứng; không tạo file trắng để test xanh.

### T47 — VTP manual + API create, unknown result và cuộc đua cancel

**Depends:** T42, T23, T43; độc lập với credential Drive/Gemini/Teams. **SPEC:** 8.1.

**Files:** tạo `server/integrations/vtp/client.ts`, mở rộng shipments/contracts routes; test `tests/integration/vtp-create.test.ts`; docs/config/env.

- [ ] Red: manual nhập mã không tự claim app đã tạo đơn; API request không sender/receiver/service hợp lệ bị422; cùng operation không hai order; timeout sau gửi không blind retry; cancel lúc HTTP đang chạy không hồi sinh contract.
- [ ] API schema/auth/address/service codes lấy tài liệu hiện hành của tài khoản VTP. Lưu shipment pending/correlation key + outbox trước send; trả202 operationId, không chuyển chờ shipper khi chưa có mã thật.
- [ ] Provider outcome áp bằng trusted service action gắn đúng create job đã uỷ quyền; mở guard `assign_waybill` cho VTP **chỉ** với verified outcome/correlation đó. Không nhận service actor/event từ browser. Lock/recheck cycle/state/receiver+revision fingerprint trước transition.
- [ ] Unknown result→shipment unknown_result/job awaiting_reconciliation, tra cứu trước retry. Nếu contract đã hủy/đổi cycle/receiver, lưu remote result để xử lý chứ không mất mã hoặc tự gán sang hồ sơ khác.
- [ ] Green: `npm run test:integration -- tests/integration/vtp-create.test.ts`, workflow matrix cập nhật case verified-job service, lint/build. Thiếu docs/auth verification là blocker VTP API, manual mode vẫn hoàn chỉnh, không bịa client.

### T48 — VTP webhook verified, inbox và sự kiện đảo thứ tự

**Depends:** T47. **SPEC:** 8.1; B17/B30.

**Files:** tạo `server/integrations/vtp/verify.ts`, `normalize.ts`, `tests/integration/vtp-webhook.test.ts`; mở rộng inbox/tracking/workflow/bootstrap raw parser.

- [ ] Red: webhook chưa verified không đổi state; duplicate/old shipment/final status không regress; delivered trước pickup không tự bịa time; unmapped raw code giữ lịch sử không đoán; lỗi DB không ACK success.
- [ ] Xác minh signature/token theo docs. Không có cơ chế auth đủ thì payload chỉ hint, server tra cứu VTP xác minh; không tra cứu được thì không auto-transition. Không tự đặt HMAC header giả rồi tưởng provider hỗ trợ.
- [ ] Raw-body parser đúng route trước JSON, body/rate cap, không CSRF session; durable inbox trước ACK, response không contract/PII. Dedupe eventID hoặc fingerprint bất biến; không dùng receivedAt mới mỗi lần.
- [ ] Chỉ current shipment/cycle điều khiển engine. Out-of-order pending reconciliation, đủ evidence mới tuần tự action/audit; từ chối nhận bưu gửi không tự là từ chối ký điều khoản.
- [ ] Green: `npm run test:integration -- tests/integration/vtp-webhook.test.ts`, atomicity/concurrency tests, lint/build; fixture provider status là contract documented, không mock API production.

### T49 — Operations/Admin status, retry và gỡ simulator

**Depends:** T42, T43; nối từng adapter T44–T48 khi phần code tương ứng có đủ điều kiện, không phụ thuộc live credential để làm operations UI. **SPEC:** 10.2–10.3; B18.

**Files:** tạo `server/modules/operations/routes.ts`, `src/components/OperationsPanel.tsx`, `tests/e2e/integrations.spec.ts`, `tests/integration/operations.test.ts`; sửa AdminSettings/App/API/hooks; ngừng dùng SimulatorPanel sau đối chiếu chức năng/changes.

- [ ] Red: non-admin không jobs/logs/retry/test; settings không leaksecret; toggle/sim endpoints404 production; unknown VTP create result không có retry button blind; not_configured không badge connected.
- [ ] Chuyển panel logs hiện có sang trạng thái thật/read-only, job detail sanitized và retry hợp lệ; health unknown/configured/healthy/degraded/disabled tách rõ. Provider test chỉ thử config lưu sẵn, không nhận arbitrary URL/key trong body.
- [ ] Thêm Admin reconcile thao tác cho VTP unknown result: verify mã provider/correlation trước liên kết job/shipment, reason+audit, không toggle success. Bổ sung route `/api/operations/jobs/:id/reconcile` với validation quyền và evidence.
- [ ] Gỡ mọi production sim route/mock receiver/random fallback/Drive giả/role switch. Test fixture/stub chỉ nằm tests, không xoá dữ liệu nguồn hoặc sửa UI ngoài vùng giả lập bị thay thế cần thiết.
- [ ] Green: `npm run test:integration -- tests/integration/operations.test.ts`, `npm run test:e2e -- tests/e2e/integrations.spec.ts`, lint/build.
- [ ] **Phase 5 gate:** mọi provider có client/test/docs đúng nếu đủ tài liệu; provider thiếu điều kiện ở state trung thực. Credential/live evidence còn thiếu phải ghi cụ thể, không dùng “đã xong toàn bộ tích hợp” để vượt gate nghiệm thu thật.

---

## Phase 6 — SLA, báo cáo và khả năng vận hành

### T50 — SLA engine theo stage, pause review và dedupe alert

**Depends:** T31, T43; không cần provider live. **SPEC:** 9.1; B11/B25.

**Files:** tạo `server/jobs/sla.ts`, `tests/integration/sla-jobs.test.ts`; mở rộng workflow milestones/schema/DTO/worker; sửa status types/docs.

- [ ] Red: edit/note/tracking không reset elapsed; đúng due_at chưa breach, +1ms breach; review pause Legal; return7days không internal2h; hai worker một alert/job; complete/cancel không nhắc tiếp.
- [ ] Stage instance UUID mỗi lần vào bước, due_at lưu từ policy lúc vào; workflow action resolve alert cũ và mở stage mới. Draft active-budget dùng cùng helper thời gian Legal, không viết công thức thứ ba.
- [ ] Worker scan mỗi60s batch, lock/unique theo contract+stage_instance+rule; cảnh báo một lần, không xoá lịch sử khi resolved. Không đặt setInterval full-scan trong Express.
- [ ] Projection slaBreached + breachType internal/viettelpost/counterparty đúng, exception states quản lý riêng. Milestone legacy chưa tin cậy phải review, không lấy uploaded_at bù.
- [ ] Green: `npm run test:integration -- tests/integration/sla-jobs.test.ts`, payroll/timing tests, lint/build.

### T51 — Reconciliation, cleanup, heartbeat và shutdown an toàn

**Depends:** T50, T34, T43; nhánh VTP cần client T47–T48 khi có đủ tài liệu. **SPEC:** 8.1, 9.1, 11.2–11.3.

**Files:** tạo `server/jobs/reconciliation.ts`, `cleanup.ts`, `heartbeat.ts`, `tests/integration/job-lifecycle.test.ts`; mở rộng worker/config/operations.

- [ ] Red: current shipment reconcile không áp event chuyến cũ; missing provider không poll; cleanup không xoá file được reference/job đang dùng; leased job crash được reclaim; heartbeat stale phát hiện đúng.
- [ ] VTP API reconciliation mặc định15m, batch/rate theo docs, unknown result cần correlation; khi adapter chưa verified/not_configured chỉ báo disabled, không fake event. Teams/Drive retry có giữ idempotent correlation.
- [ ] Cleanup staged upload >24h và expired sessions/tokens/idempotency >7d theo policy; raw technical/inbox retention30d tách audit/entry. File đang rename/consume có lease/DB recheck trước xoá, không recursive delete rộng.
- [ ] Heartbeat30s/stale120s; worker SIGTERM ngừng claim, xử lý/lease đang chạy đúng; app shutdown ngừng nhận request, chờ transaction, đóng pool. Quota/provider down không restart cả core vô hạn.
- [ ] Green: `npm run test:integration -- tests/integration/job-lifecycle.test.ts`, worker tests, lint/build; kiểm actual process kill/restart trong test stack không đụng app khác.

### T52 — SQL reports đúng trạng thái, thời gian, tiền và scope

**Depends:** T50, T32, T11. **SPEC:** 9.2; B22/B31/B32.

**Files:** tạo `server/modules/reports/repository.ts`, `service.ts`, `routes.ts`, `tests/integration/reports.test.ts`; sửa shared/report types.

- [ ] Red: đủ12 status kể cả0, tổngcount bằng filtered total; active không gồm completed/cancelled; averages không âm/không trộncycle/digital; zero sample null; only totals cùng currency được cộng.
- [ ] SQL aggregate parameterized, scope/filter dùng query base giống list; report Admin-only. AvgUploadToPrint giữ nghĩa cũ, thêm AvgApprovalToPrint cho KPI; sampleCount và excludedInvalidCount rõ.
- [ ] Overdue preview max20 + overdueTotal, danh sách đầy đủ qua paginated contracts. Salary reports dùng immutable entry+adjustment theo finalized period VN, không reprice history.
- [ ] Numeric aggregate chính xác, không parse recurring thành total, không đổi unknown amount thành0 để nói đã thống kê đủ.
- [ ] Green: `npm run test:integration -- tests/integration/reports.test.ts`, query/payroll tests, lint/build.

### T53 — Nối reports/totals cho mọi màn hình và vai trò

**Depends:** T52, T40. **SPEC:** 10.3, 13.

**Files:** sửa `src/components/ReportView.tsx`, `src/constants/workflow.ts`, `src/App.tsx`, hooks/API/types; tạo `tests/e2e/reports.spec.ts`.

- [ ] Red: total không đổi theo page size, status cards/filter/export nhất quán; report Admin-only không fetch bằng account Clerk; null metrics là—, không 0h/100% giả.
- [ ] Các thẻ home/tasks/contracts dùng counts/query context đúng, không contracts.length của page làm tổng tổ chức. Counts trạng thái12, exception grouping minh bạch, cancelled không active.
- [ ] Metrics in nhanh dùng approval→print, label upload→print không bị thay nghĩa âm thầm; counterparty breach không tô như nội bộ Legal làm trễ.
- [ ] Green: `npm run test:e2e -- tests/e2e/reports.spec.ts`, visual/payroll/query tests, lint/build; kiểm mobile cùng numbers.

### T54 — Load, lỗi DB/disk/provider và security regression

**Depends:** T53, T49, T51. **SPEC:** 5.3, 7.1, 9, 11; toàn bộ B1–B37 liên quan.

**Files:** tạo `scripts/test-load.ts`, `tests/integration/failure-modes.test.ts`, `tests/integration/security-regression.test.ts`, `tests/e2e/network-errors.spec.ts`; bổ sung indexes/query khi có số đo; evidence Phase6.

- [ ] Red: mất DB/disk full khiến request fail không status/file/entry nửa chừng; timeout sau commit retry trả operation cũ; người bị disable mất quyền download/replay; quota không random dữ liệu hoặc crash core.
- [ ] Fault injection dùng services/filesystem/provider test port hoặc test container riêng, không phá volume/quyền máy thật. No credentials/raw contract trong log/API/bundle; CSP/print/link/CSV vẫn bảo vệ sau UI changes.
- [ ] Generate10.000 test contracts trên test DB, warmup,10 clients đồng thời; đo ít nhất500 read/report requests có scope/filter, lưu hardware/dataset/query/p50/p95/error rate. Mục tiêu p95<=1s, không ghi số dự đoán như kết quả.
- [ ] Profile/EXPLAIN query chậm/index, batch/limits để đạt; không tăng timeout rồi coi đạt latency. Không đưa API provider vào transaction để test concurrency pass giả.
- [ ] Green: `npm run test:integration -- tests/integration/failure-modes.test.ts tests/integration/security-regression.test.ts`, `npm run test:e2e -- tests/e2e/network-errors.spec.ts`, `npm run test:load`, lint/build.
- [ ] **Phase 6 gate:** SLA/jobs/reports/security/load đo được, không fake green. Nếu phần external còn blocked, runtime off có test và blocker không làm nhánh này ngừng vô lý.

---

## Phase 7 — Production package, backup/restore và bàn giao

### T55 — Build server/worker/CLI JS và runtime production-deps-only

**Depends:** T54. **SPEC:** 11.1; B24/B28/B37.

**Files:** hoàn thiện `scripts/build-server.mjs`, package scripts/dependency classification/config/bootstrap; tạo `tests/integration/production-build.test.ts`; sửa tsconfig/env/docs.

- [ ] Red: build thiếu app/worker/migrate/bootstrap/import CLI bị fail; image/runtime không devDependencies vẫn start; NODE_ENVdev có dist vẫn HMR; production không import test/Vite/tsx hoặc bí mật vào web bundle.
- [ ] Entry map explicit: `server.ts`→`dist-server/server.js`, `server/worker.ts`→`dist-server/server/worker.js`, CLI giữ `dist-server/scripts/<name>.js`. Copy migration SQL và assets cần thiết, không copy `.env`, seed JSON/uploads/backup.
- [ ] npm start/worker chạy nodeJS compiled. Dev Vite dynamic import chỉ nhánh development, packages external đúng và production packages thực cài đủ. Không dựa native strip-types Node patch.
- [ ] Smoke từ thư mục/artifact sạch với chỉ prod deps và DB test riêng: live/ready/GETme/list login đúng, shutdown đúng, no standalone listen từ app import.
- [ ] Green: `npm run build`, `npm run test:integration -- tests/integration/production-build.test.ts`, `npm run lint`; lưu startup logs đã redact, không claim production server đang deploy.

### T56 — Docker/Compose roles, migration một lần, health và volumes

**Depends:** T55, T09. **SPEC:** 11.2.

**Files:** tạo `Dockerfile`, `docker-compose.dev.yml`, `scripts/init-db-roles.sh`, `deploy/nginx.conf.example`; sửa `docker-compose.yml`, `.dockerignore`, env mẫu; test `tests/integration/container-stack.test.ts`.

- [ ] Red: thiếu secret production fail-fast, PG không public, runtime non-root, app/worker cùng một uploads volume, recreate giữ file/DB; migration fail thì app/worker không lên.
- [ ] Multi-stage Node22 image, compiled CLI; Compose postgres/migrate one-shot/app/worker. DB roles cấp an toàn từ secret/env, không password trong SQL/source/command log. User runtime không DDL/audit-entry edit/delete, migrator không dùng cho HTTP app.
- [ ] Bỏ overlapping data mount và init SQL double-migration: schema chỉ versioned migrate service; `data/init-db.sql` dùng tài liệu/parity/fresh manual install, không mount rồi tạo lại cùng bảng. Bootstrap role init không seed user/hợp đồng demo.
- [ ] Core required env DATABASE_URL/MIGRATION_DATABASE_URL/PUBLIC_APP_URL/COOKIE secret; URI password ký tự đặc biệt phải encoded/hình thành đúng, không ghép template URL hỏng. Bind app0.0.0.0:3000, DB chỉ internal; local dev override chỉlocalhost.
- [ ] TLS proxy config, trusted forward/size/rate/timeouts, health cached DB/migration/storage và worker heartbeat. Recreate test trên project/volumes test riêng; không `down -v` bất kỳ hệ thống vận hành nào.
- [ ] Green: `docker compose config --quiet` trên env test hợp lệ, `npm run test:integration -- tests/integration/container-stack.test.ts`, lint/build. Docker thiếu quyền thì blocked_environment có lỗi thật, không thay bằng kiểm file YAML rồi nói image chạy.

### T57 — Backup DB+file nhất quán, mã hoá và restore rehearsal

**Depends:** T56, T51. **SPEC:** 11.3, D14.

**Files:** tạo `scripts/backup.sh`, `scripts/restore-check.ts`, `tests/integration/backup-restore.test.ts`, `docs/OPERATIONS.md`; mở rộng maintenance control/ops audit có quyền.

- [ ] Red: dump không file/hash sai phải fail; restore destination ngoài test/được phép bị chặn; worker restored chưa cho outbound; thiếu crypto key/tool không tạo bản backup plaintext rồi báo an toàn.
- [ ] Backup custom pg_dump + storage manifest/migration version, quiesce writers/jobs bằng maintenance window thật hoặc snapshot nhất quán đã chứng minh; mã hoá bằng công cụ hỗ trợ trên host, key quản lý ngoài bundle/DB. Không gửi password qua command line/log.
- [ ] Retention30ngày áp trên backup được nhận diện trong dedicated backup root, không xoá file hồ sơ/audit. Tạo lịch chạy/document operator setup; không tự cài cron production khi chưa được phép.
- [ ] Restore vào DB/volume riêng, migrations version đúng, count/FK/checksum/download/payroll hash/login pass; disable integration until reconcile để không gửi đơn/thông báo lại. Đo thời gian/RPO thực, mục tiêu24h/4h là đề xuất, không tự tuyên bố đạt khi chưa diễn tập.
- [ ] Green: `npm run test:integration -- tests/integration/backup-restore.test.ts`; evidence restore commands/count/hash/timing đã redact. Dữ liệu thật không được dump/restore/đổi maintenance nếu owner chưa cho phép.

### T58 — Kiểm thử end-to-end cuối, quyền thô và thiết bị thật

**Depends:** T55,T56,T40; chạy cả khi backup/provider-live có blocker để không bỏ phần E2E độc lập. Provider-live chỉ khi có quyền/credential. **SPEC:** G1–G7, 12.1, 13.

**Files:** tạo `tests/e2e/physical-lifecycle.spec.ts`, `digital-lifecycle.spec.ts`, `exceptions-lifecycle.spec.ts`, `tests/integration/route-inventory.test.ts`; cập nhật evidence Phase7/acceptance.

- [ ] Red trước sửa regression còn sót: lifecycle đủ9 bước physical, digital qua duyệt, feedback/revision, reject/redraft, issue/reship/callback cũ, cancel/concurrent/double scan và lương không đổi theo settings.
- [ ] Chạy browser và raw API theo3role thật/unauth; forged header/body/localStorage không đổi quyền/actor, payroll/file/settings/report/replay scope đúng. Route inventory không còn mutation gán status ngoài engine.
- [ ] E2E qua image compiled/PG test thật; record scan/upload/download hashes, final salary/snapshot/CSV, history actor/status. Không dùng “UI có nút” làm bằng chứng đã lưu DB.
- [ ] Checklist thiết bị thật: camera permission/HTTPS, chụp nhiều trang/crop/rotate, in/đọc QR, PDF reload; integration bật có provider real evidence. Không có thiết bị/credential ghi pending_external chính xác; không fabricate screenshots remote success.
- [ ] Green: `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`; manual checks có evidence hoặc blocker riêng. Không skip test nghiệp vụ lỗi để chạy hết bộ.

### T59 — Đồng bộ tài liệu, runbook và acceptance không ký giả

**Depends:** T58. **SPEC:** 0.2, 2.3, 11, 14.

**Files:** sửa `README.md`, `API.md`, `ARCHITECTURE.md`, `SCHEMA.md`, `AGENTS.md`, `.env.example`, `DECISIONS.md`; hoàn thiện `docs/OPERATIONS.md`, `docs/ACCEPTANCE.md`, integration docs/evidence.

- [ ] Audit mọi command/route/schema/UI permission trong docs bằng code/test hiện tại. README không liệt kê file chưa có, không nói Drizzle/Drive/SSO/real provider chạy nếu chưa có bằng chứng.
- [ ] Runbook đủ: fresh install, bootstrap/invite/reset, migrations, manual shipping, API enable, quota, DB/disk/worker lỗi, stuck/unknown shipment, backup/restore, secret rotation, legacy import/confirmation, release rollback giữ dữ liệu mới.
- [ ] AGENTS cập nhật runtimePG-only/build commands/model config/QR/SLA theo spec được phép, giữ bất biến basepay/engine location/port/icons/secret/no-mock/schema sync. Xung đột chỉ dẫn không tự xoá để thuận tiện; cần owner quyết định phần thật sự xung đột.
- [ ] Acceptance mapping G1–G7/B1–B37/tasks/evidence, approvals/dev defaults rõ; mục owner sign/date để pending, không ghi tên/chữ ký tự tạo. Provider docs có ngày verify/real evidence hoặc blocker.
- [ ] Gate: doc links/commands/routes/schema parity check pass, sensitive artifact scan không lộ secret; source/spec khác với quyết định mặc định dev được ghi rõ trước bàn giao.

### T60 — Release verification, trạng thái Goal và handoff cuối

**Depends:** mọi task khả thi trước đó đạt; external tasks bị chặn được liệt kê, không tự đánh done.

**Files:** tạo `scripts/verify-release.mjs`; cập nhật npm scripts, `IMPLEMENTATION_STATUS.md`, `docs/ACCEPTANCE.md`, `docs/evidence/phase-7/final-verification.md`.

- [ ] Tạo `npm run verify:release`: lint→unit→integration→build→e2e→production/Compose/backup smoke theo môi trường test; exit nonzero ngay khi một gate bắt buộc fail. Không wrap lỗi thành exit0.
- [ ] Chạy fresh mọi lệnh cần thiết từ source cuối; lưu exact command/exit/result/evidence và artifact version/hash. Code đổi sau một run thì rerun suite chịu ảnh hưởng, không trích output cũ để kết luận.
- [ ] Reconcile status: tick chỉ task đã đạt assertions. External client/doc/live/hardware/owner approval thiếu ghi tên/provider/điều kiện/mức ảnh hưởng; bất kỳ core gate chưa test được không được ghi engineering_complete.
- [ ] Xác nhận không đụng source JSON/file cũ trái phép, không còn prod seed/mocks/direct status writer/frontend price override/secret exposure, stack giữ UI/port/schema invariants.
- [ ] Bàn giao: phần code đã làm, lệnh pass thật, provider thực/chưa bật, manual checks, limits/blockers, hướng chạy local/Docker, bước owner cần để production. Không tự push/deploy/cutover/payout hoặc ký biên bản.
- [ ] Kết thúc Goal với đúng trạng thái ở mục0.2. Nếu quota sắp hết trước đó, checkpoint task đang dở + next command, không kết luận “hoàn thành” để đóng phiên.

---

## 4. Ma trận coverage: spec/audit không bị bỏ sót

### 4.1. Mục tiêu và subsystem

| Requirement | Task chịu trách nhiệm | Evidence tối thiểu |
|---|---|---|
| G1 PostgreSQL-only, persistence/import | T06–T14, T56–T57 | Restart/empty DB/import2lần/backup restore test |
| G2 identity/auth/RBAC | T15–T19, T18/T58 route inventory | Cookie/CSRF/revoke/forged-role/raw API test |
| G3 state machine/audit/concurrency | T20–T26, T31, T38, T48 | Matrix/atomic rollback/version/idempotency/provider ordering |
| G4 payroll policy/ledger | T27–T33 | Vector/boundary/snapshot/immutability/scope/CSV |
| G5 providers trung thực | T42–T49 | Not-configured/error tests + docs/real evidence riêng |
| G6 operation/build/migration | T02–T04, T09, T43, T50–T60 | Compiled image/worker/health/backup/restore/runbook |
| G7 UI giữ sát | T05, T12, T19, T33, T37–T41, T53, T58 | Baseline/diff + workflow desktop/mobile thật |
| SPEC3 typed data/schema/import | T05–T14 | SQL/init parity + validation + ledger/missing file |
| SPEC4 revisions/digital/QR/exceptions | T20–T26, T35–T40 | API+UI đúng revision/file/assignee/state |
| SPEC5 security/privacy | T15–T19, T34, T36, T42, T54 | Role/CSRF/secret/SSRF/file/CSV/XSS |
| SPEC6 payroll | T27–T33, T31 rollback | Exact integers + locked inputs + beneficiary |
| SPEC7 file/camera | T34–T41 | File bytes/hash/Unicode/PDF/camera check |
| SPEC8 integrations | T42–T49 | Contract/timeout/retry/verify/remote reconciliation |
| SPEC9 SLA/reports | T50–T54 | Due-boundary/dedupe/counterparty/SQL counts/latency |
| SPEC10 API/UI | T05, T11–T12, T18–T19, T32–T41, T49/T53/T58 | Typed route inventory/status/error/loading/scope |
| SPEC11 production | T55–T60 | JS/prod-deps/image/roles/volumes/backup/migrations |
| SPEC12–14 phased execution/deltas/decisions | T01/T05/T41/T59/T60 | Status/decisions/acceptance và approvals chưa có ghi pending |

### 4.2. Audit B1–B37

| Audit | Tasks | Test oracle |
|---|---|---|
| B1 | T18,T20,T31 | Legal/Clerk không approve, Admin không self-approve |
| B2 | T24,T31,T39 | Scan/empty archive không bypass state/evidence |
| B3 | T20,T23,T38 | QR không duyệt/không sinh mã/vượt prerequisite |
| B4 | T24,T37 | Digital phải duyệt, không timestamp/payout Clerk giả |
| B5 | T27–T33 | Một engine, UI/DB/CSV cùng server result |
| B6 | T22,T28,T33 | Client basePay422, server settings snapshot |
| B7 | T27,T28 | Quality0/−10/−20/−30, no route hard-code |
| B8 | T30–T33 | Settings đổi không đổi entry/snapshot task |
| B9 | T29 | Legal feedback không incident Clerk |
| B10 | T29 | Print start approved_at, courier start signed_at |
| B11 | T50 | Stage time, pause review, counterparty7d |
| B12 | T44 | Object JSON template đúng quote/newline/HTTP result |
| B13 | T07,T21 | UUID/unique/identifier/concurrency |
| B14 | T19,T28,T33 | Không mặc định/exclude email demo |
| B15 | T16,T18,T21 | Actor từ session/service verified |
| B16 | T26,T38 | QR ID + alias số cũ, identifier unique |
| B17 | T48 | Provider verify/inbox trước transition |
| B18 | T18,T36,T49,T58 | Mọi data/file/log/report có quyền, secret redaction |
| B19 | T22,T25 | Redraft bắt nội dung revision mới |
| B20 | T18,T22,T28 | Admin giao task/urgency, Legal không tự tăng thưởng |
| B21 | T09,T14,T21,T31 | PG transaction/lock/atomicity, không ghi fileJSON |
| B22 | T10,T52 | Typed money, không cộng recurring/unit/unknown |
| B23 | T34,T36 | Filename Unicode/relative key/download đúng |
| B24 | T02,T55,T56 | Compiled JS + Dockerfile sạch |
| B25 | T43,T50,T51 | Worker dedupe/lease, không timer mỗi web instance |
| B26 | T26,T36 | Physical note thật, đúng route và server actor |
| B27 | T20,T26,T40 | No arbitrary status writer, legacy route410 |
| B28 | T02,T55 | Backend/scripts nằm trong typecheck |
| B29 | T22,T34 | Auth trước Multer, file/size/container cap |
| B30 | T25,T47,T48 | Old shipment/out-of-order/terminal không regress |
| B31 | T11,T52,T53 | Đủ12status, counts theo scope/filter toàn bộ |
| B32 | T18,T29–T33 | Clerk beneficiary, chưa xong/digital không lương |
| B33 | T32,T34,T38,T54 | Print/URL XSS/CSV formula bị chặn |
| B34 | T22,T35,T37 | Frozen revision/hash/file đúng bản duyệt |
| B35 | T13,T14 | Dry-run/apply/rollback/idempotent counts/missing file |
| B36 | T10,T28,T33 | Deadline timezone roundtrip17:00VN |
| B37 | T03,T55 | Mode từ NODE_ENV, dist không tắt HMR dev |

---

## Phụ lục A — Test/code oracle nhỏ cho phần dễ sai

Đây là nội dung **để agent đưa vào test/source trong task tương ứng**, không phải khẳng định đã tồn tại. Không cần nhét toàn bộ source ứng dụng vào plan; mỗi task phải tự viết implementation thật theo contract/acceptance ở trên, không dùng handler rỗng hoặc ghi “để sau”.

### A1. T27 — Phép tính tiền bằng số nguyên

`tests/unit/payroll-amount.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculatePayrollAmount } from '../../src/utils/payroll';

describe('calculatePayrollAmount', () => {
  it.each([
    { base: 500000, rates: [20, 20, -10], expected: 650000 },
    { base: 500000, rates: [0, 0, 0], expected: 500000 },
    { base: 500000, rates: [0, -10, -10], expected: 400000 },
    { base: 500000, rates: [30, 30, 0], expected: 800000 },
    { base: 500000, rates: [0, 30, -10], expected: 600000 },
    { base: 100000, rates: [30, 10, 10, 0], expected: 150000 },
    { base: 500000, rates: [-100, -100, 0], expected: 0 },
    { base: 0, rates: [30, 30, 0], expected: 0 },
    { base: 5, rates: [10], expected: 6 },
  ])('$base x $rates => $expected', ({ base, rates, expected }) => {
    expect(calculatePayrollAmount(base, rates)).toBe(expected);
  });

  it('rejects invalid and unsafe input', () => {
    expect(() => calculatePayrollAmount(-1, [0])).toThrow();
    expect(() => calculatePayrollAmount(100, [0.5])).toThrow();
    expect(() => calculatePayrollAmount(100, [101])).toThrow();
    expect(() => calculatePayrollAmount(Number.NaN, [0])).toThrow();
    expect(() => calculatePayrollAmount(Number.MAX_SAFE_INTEGER, [100])).toThrow();
  });
});
```

Implementation primitive T27 trong `src/utils/payroll.ts`:

```ts
export function calculatePayrollAmount(
  basePay: number,
  ratesPct: readonly number[],
): number {
  if (!Number.isSafeInteger(basePay) || basePay < 0) {
    throw new RangeError('Invalid base pay');
  }
  let multiplier = 100n;
  for (const rate of ratesPct) {
    if (!Number.isSafeInteger(rate) || rate < -100 || rate > 100) {
      throw new RangeError('Invalid rate');
    }
    multiplier += BigInt(rate);
  }
  if (multiplier < 0n) multiplier = 0n;
  const amount = (BigInt(basePay) * multiplier + 50n) / 100n;
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Payroll amount exceeds safe JSON range');
  }
  return Number(amount);
}
```

Chạy red trước, thêm primitive, chạy green:

```text
npm run test:unit -- tests/unit/payroll-amount.test.ts
```

Primitive này không thay policy/domain/eligibility tests; không tính rates theo client input.

### A2. T28/T29 — Boundary tables bắt buộc

| Input mặc định | Expected |
|---|---|
| urgency D=1h,1h+1ms,3h−1ms,3h,24h−1ms,24h | emergency,urgent,urgent,priority,priority,normal |
| Legal budget8h, used4h,6h,7h36m,8h | earlyMax30,earlyMid20,earlyMin10,onTime0 |
| Legal used=budget+2h, +2h+1ms, +6h, +6h+1ms | lateMin−10,lateMid−20,lateMid−20,lateMax−30 |
| Clerk print budget2h, used1h,1.5h,2h,3h,4h,4h+1ms | 30,20,0,−10,−20,−30 |
| Clerk courier budget4h, used2h,4h,4h+1ms | 30,10,−10 |
| Clerk retrieval budget7d, used3.5d,7d,7d+1ms | 30,10,−10 |
| Legal intervals08–10 và12–14, review10–12, budget8h | used4h, không6h |

Settings rates/threshold khác mặc định phải có test riêng; test ngưỡng dùng ms, không `toFixed` trước compare.

### A3. T21/T31 — Transaction oracle khi double click/rollback

| Thí nghiệm PG thật | Trạng thái DB/API phải có |
|---|---|
| Hai approve cùng key/payload/version | Hai response cùng kết quả; status/version chỉ tăng1; audit1; Legal entry1; outbox event1 |
| Hai approve key khác cùng version | Một thành công, một409; không thêm entry/audit từ request thua |
| Replay key cũ sau transition commit | Trả response operation cũ, không stale409 và không chạy bước tiếp |
| Cùng key nhưng payload/route khác | 409 IDEMPOTENCY_CONFLICT, không đổi DB |
| Lỗi insert payroll sau planned status update | Status/version/audit/outbox/entry đều giữ trước request |
| Clerk đã logout/disabled replay operation | 401/403 theo session, không trả dữ liệu cached cho người mất quyền |
| Worker đã nhận DELIVERED rồi callback PICKED_UP cũ | Không quay về Đang giao, không đổi delivered/entry |

Không chỉ assert HTTP200: query transaction rows, counts, hash và beneficiary để chứng minh.

---

## Phụ lục B — Checklist không được rút gọn để “xong Goal”

- [ ] Không đổi DB thật sang JSON/localStorage khi lỗi kết nối.
- [ ] Không bỏ auth/CSRF/guard/file evidence để E2E dễ pass.
- [ ] Không lấy settings hiện tại tính lại lương chốt hoặc nhận giá client.
- [ ] Không tính task chưa làm/digital thành lương Clerk, không trừ feedback Legal sang Clerk.
- [ ] Không dùng test provider/stub trong runtime production hoặc nói nó là kết quả thật.
- [ ] Không update snapshot hình ảnh hàng loạt để che redesign.
- [ ] Không đổi test fail thành skipped/xfailed/passWithNoTests.
- [ ] Không gọi Docker YAML validate là bằng chứng image/restore hoạt động.
- [ ] Không tick task blocked_external thành done hoặc tự ký/cho phép release.
- [ ] Không dừng sau Phase0–1 nếu còn task khả thi; đây là plan toàn hệ thống.

**Bàn giao hiện tại:** chỉ có `PLAN.md` và `GOAL.md` được thêm. Mọi task triển khai, code mẫu, lệnh và test trong plan là công việc của agent nhận Goal sau này; source, dữ liệu và `SPEC.md` chưa bị sửa ở lượt lập plan.
