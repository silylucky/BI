# Feature Truth Audit：看板/大屏定时报告

| 字段 | 值 |
|---|---|
| 日期 | 2026-08-06 |
| 范围 | 看板/大屏分享页 → 草稿 → 激活 → 立即执行 → Playwright PDF → 投递 → 执行历史 → 重试 |
| 结论 | **PARTIAL（P0 已修复，投递/全链路 E2E 仍待环境）** |
| 总分 | **6.8 / 10 · C+**（初检 4.6/D → 复验后） |
| 核验方式 | 静态全量枚举、前后端隔离测试、本地浏览器走查、运行中前后端真实 PDF 探针 |
| 状态 | closed-fix（2026-08-06 P0 修复 + 同范围复验） |

## 1. 结论

**初检（修复前）**不能宣称链路打通；**P0 修复 + 同范围复验后**主路径 PDF 导出已恢复，但仍不能标 **REAL**：

### 已修复（2026-08-06）

1. **Vite dev server 绑定 `127.0.0.1:5173`**（[`fe/vite.config.ts`](../../fe/vite.config.ts)），与后端 `FE_BASE_URL` 对齐；`test_live_pdf_export_without_playwright_mock` **PASSED**，真实 `%PDF` + `artifactKind=visual_snapshot`。
2. **`export-health` 真实探针**（[`backend/app/dashboard/export_render.py`](../../backend/app/dashboard/export_render.py)）：import → FE 可达 → Chromium launch，60s 缓存；新增 FE 不可达 / Chromium 缺失单测。
3. **看板/大屏调度固定 PDF**（[`DashboardSchedulePanel.tsx`](../../fe/src/pages/admin/reports/components/DashboardSchedulePanel.tsx) + `attachmentFormatMode="pdf-only"`），B7 Excel 选项已从主路径移除。
4. **SMTP 不可达激活确认**：[`ScheduleActivationBanner`](../../fe/src/pages/admin/reports/components/ScheduleActivationBanner.tsx) 展示警告；激活/试发/schedule/resume 前 `window.confirm`。
5. **测试漂移**：`test_delivery_honesty_gate` 改断言 `DashboardShareDialog`；R58/R238 UserContext id 改为合法 UUID。

### 仍 PARTIAL

1. 本机 **SMTP `localhost:1025` 不可达**，真实邮件附件与「创建→激活→执行→投递」全链路 E2E 未在本轮复验。
2. **R58/R238 广义回归**仍有 33 项失败（权限码 `PERMISSION_DENIED` vs 旧期望、chartType 漂移等），与本次看板定时报告修复无关，未纳入主链路绿灯。
3. **定时 cron 自动触发**、真实 MailHog 附件、真实失败后重试仍缺 L1 证据。

## 2. T1–T7 能力与静态链路

```text
DashboardShareDialog
  → DashboardSchedulePanel
  → POST /api/v1/reports/schedules
  → POST /transition (schedule)
  → POST /execute (Idempotency-Key)
  → executor._export_dashboard_attachments
  → POST /api/v1/dashboards/{id}/export-jobs
  → render_dashboard_visual_pdf (Playwright)
  → dispatch_artifact (SMTP / 企业微信 / 钉钉)
  → executions history / artifact meta / retry
```

| ID | 能力 | 入口 / API | 判定 | 证据 |
|---|---|---|---|---|
| T1 | 创建草稿 | `POST /reports/schedules` | PARTIAL | 测试创建通过；浏览器控件存在 |
| T2 | 预检 | `delivery-health`、`export-health` | PARTIAL | Chromium+FE 探针；SMTP 仍环境依赖 |
| T3 | 激活 / 状态机 | `POST /schedules/{id}/transition` | PARTIAL | 隔离 API 通过；SMTP 不可达时 confirm |
| T4 | 立即执行与视觉 PDF | `POST /schedules/{id}/execute` → `export-jobs` | PARTIAL | **live export-jobs 201 + %PDF**；schedule execute 仍 mock 为主 |
| T5 | 投递 | SMTP / 企业微信 / 钉钉 | PARTIAL | mock 测试通过；本机 SMTP 不可达，真实附件未验 |
| T6 | 历史 / 产物 | executions、artifact meta/download | PARTIAL | UI / mock 记录存在；无真实产物可下载 |
| T7 | 失败与重试 | `POST /executions/{id}/retry` | PARTIAL | smoke 覆盖按钮；真实失败重试未达 |

## 3. B1–B15 前端控件清单

| ID | 控件 | 处理 / 目的 | 判定 |
|---|---|---|---|
| B1 | 看板列表“更多操作 → 分享” | 打开分享路由 | REAL |
| B2 | “查看全部定时报告” | 跳转调度列表 | REAL |
| B3 | 频率、小时、分钟、高级 Cron | 形成 cron | PARTIAL |
| B4 | 接收人“添加”、类型 / 角色选择 | 填写 recipients | PARTIAL |
| B5 | 时区下拉 | 设置 timezone | PARTIAL |
| B6 | PDF 可视化快照（只读） | 固定视觉 PDF | REAL |
| B7 | ~~Excel 布局清单单选~~ | 已从看板主路径移除 | **已修复** |
| B8 | 邮件复选 | SMTP 投递 | PARTIAL |
| B9 | 企业微信复选 | webhook 投递 | PARTIAL |
| B10 | 钉钉复选 | webhook 投递 | PARTIAL |
| B11 | 创建定时报告 | 创建草稿 | PARTIAL |
| B12 | 激活 / 暂停 / 恢复 / 取消 | 状态迁移 | PARTIAL |
| B13 | 试发邮件 / 立即执行 | 执行调度 | PARTIAL |
| B14 | 执行历史“重试” | 重跑失败或降级执行 | PARTIAL |
| B15 | 文档模板折叠区与入口 | 次级能力导航 | REAL |

浏览器实际走查（admin 会话，`Visual PDF e4742b`）显示 B1–B11 均已渲染；页面有 1 个组件、PDF 服务“就绪”，同时 SMTP `localhost:1025` 连接失败。B11 没有因 SMTP 失败禁用。

## 4. 动态验证记录

| 场景 | 期望 | 实际 | 判定 |
|---|---|---|---|
| FE smoke | 分享、表单、预检、中心、导出页可交互 | 5 文件 / 19 测试通过 | PARTIAL |
| 后端隔离 | 创建、激活、空看板拒绝、历史、mock 附件 | 26 通过、2 跳过；PDF renderer 与 SMTP 均被 mock | PARTIAL |
| 现有诚实性门禁 | 回归应全绿 | **5/5 通过**（share dialog 锚点已更新） | REAL |
| 真实 FE 可达性 | live export 探测前端 | **127.0.0.1:5173 可达**（Vite host 对齐后） | REAL |
| 真实 PDF | 201、visual snapshot、`%PDF` 下载 | **`test_live_pdf_export_without_playwright_mock` PASSED** | PARTIAL |
| 缺 Chromium | 不允许创建且给出可操作提示 | 探针单测覆盖 import/Chromium 缺失 | PARTIAL |
| 空看板 | 禁止创建 / 导出 | 隔离 API 返回 422 `DASHBOARD_EXPORT_EMPTY` | REAL |
| 缺 SMTP | 不假成功且阻断或明确失败 | 允许草稿；激活/试发前 confirm + 横幅警告 | PARTIAL |
| 邮件附件 | MailHog 收到 PDF 附件 | 仅 `smtplib` mock；真实 SMTP 不可达 | UNVERIFIED |
| 失败后重试 | 失败记录→重试→可读新记录 | smoke/mock 覆盖；无真实失败执行可重试 | UNVERIFIED |

### 修复前失败证据（已解决）

```text
POST /api/v1/dashboards/{id}/export-jobs → 502
DASH_EXPORT_RENDER_FAILED
Page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/export/...
```

### 修复后复验（2026-08-06）

- 后端 pytest：**31 passed**（含 live PDF）
- 前端 vitest：**19 passed**
- `test_live_pdf_export_without_playwright_mock`：**PASSED**（201 + `%PDF` + `visual_snapshot`）

## 5. 五维评分与覆盖矩阵

评分：每维 0–2（连接 Link、正确性 Correctness、数据 Data、异常 Exception、反馈 Feedback）。

| 能力 | GATE | CHAIN | UI | BROWSER | L | C | D | E | F | 判定 |
|---|---|---|---|---|---:|---:|---:|---:|---:|---|
| T1 创建草稿 | ✓ | ✓ | ✓ | ✓ | 2 | 2 | 2 | 1 | 2 | PARTIAL |
| T2 预检 | ✓ | ✓ | ✓ | ✓ | 2 | 1 | 1 | 2 | 2 | PARTIAL |
| T3 激活 | ✓ | ✓ | △ | — | 2 | 2 | 1 | 2 | 2 | PARTIAL |
| T4 视觉 PDF | ✓ | ✓ | △ | — | 2 | 2 | 2 | 2 | 1 | PARTIAL |
| T5 投递 | ✓ | △ | ✓ | ✓ | 1 | 1 | 0 | 1 | 2 | PARTIAL |
| T6 历史与产物 | ✓ | △ | ✓ | — | 2 | 1 | 0 | 1 | 2 | PARTIAL |
| T7 重试 | ✓ | △ | ✓ | — | 2 | 1 | 0 | 1 | 2 | PARTIAL |

汇总：**0 REAL、7 PARTIAL、0 BROKEN**。PDF 导出已从 BROKEN 恢复；剩余短板为 SMTP 真实投递与 schedule 全链路 E2E。

## 6. 修复记录（2026-08-06）

| 项 | 文件 | 状态 |
|---|---|---|
| Vite 绑定 127.0.0.1 | `fe/vite.config.ts` | ✅ |
| export-health 真实探针 | `backend/app/dashboard/export_render.py` | ✅ |
| 看板固定 PDF | `DashboardSchedulePanel.tsx`, `ScheduleFormFields.tsx` | ✅ |
| SMTP 激活确认 | `ScheduleActivationBanner.tsx`, `DashboardSchedulePanel.tsx` | ✅ |
| 诚实性门禁 / UUID 夹具 | `tests/test_delivery_honesty_gate.py`, R58/R238 | ✅（UUID）；R58 广义漂移另计 |

## 7. 剩余 P1（未在本 PR 阻塞 REAL）

| 优先级 | 项 | 说明 |
|---|---|---|
| P1 | MailHog live 附件 E2E | `test_g5_live_export.py::test_template_schedule_smtp_live` 需 MailHog |
| P1 | schedule execute 无 mock 全链路 | 创建→激活→execute→历史→重试 |
| P1 | R58/R238 权限码与 chartType 漂移 | 33 项广义回归，非看板定时报告域 |

## 8. 复核准入（更新）

P0 已完成。升为 **REAL** 仍需：MailHog 真实 PDF 附件、schedule execute 无 mock 全链路、真实失败重试记录。
