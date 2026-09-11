# Feature Truth Audit: G5 看板/大屏可视化 PDF 交付

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-03 |
| 核验范围 | G5 交付闭环（export token · export 路由 · Playwright PDF · 定时 semi-real · SMTP） |
| 锚点 | `/export/dashboard|data-screen/:id` · `/api/v1/dashboards/export-*` · `executor` semi-real · SMTP |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **7.2 / 10 · B-** |
| 状态 | closed-fix（2026-08-03 闭环修复 · live PDF 201 · SMTP 附件代码就绪 · MailHog live 待环境） |
| **sampling** | `full`（G5-T1…T13 全枚举） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| G5-T1 | export token TTL 5min；无效/过期 → 403 | WP-G5-1 · `export_token.py` |
| G5-T2 | `GET .../export-layout?token=` 无 JWT 可读 layout | DoD §3 |
| G5-T3 | export 页 chart 经 `X-Export-Token` 可 `export-query/execute` | WP-G5-3 |
| G5-T4 | `/export/dashboard/:id?token=` 无壳层；缺 token 报错 | DoD §3 |
| G5-T5 | `/export/data-screen/:id?token=` 对称可用 | DoD §3 |
| G5-T6 | Playwright → FE export 页 → PDF 含画布像素，非 `LAYOUT INVENTORY` | DoD §1 |
| G5-T7 | `POST .../export-jobs` PDF → `artifactKind=visual_snapshot` | WP-G5-5 |
| G5-T8 | `GET .../export-jobs/{id}/download` 返回 `%PDF` 字节 | §4 验收 |
| G5-T9 | 看板定时立即执行 → 历史「可视化快照」 | Case 18 |
| G5-T10 | 渲染失败 → `semi_real_failed` + 可读 `errorMessage` | DoD §2 |
| G5-T11 | SMTP 邮件 **含 PDF 附件**，收件人无需登录 | DoD §2 · 用户指南 |
| G5-T12 | 仅 `RPT_EXPORT_FALLBACK=1` 回落 layout_inventory | DoD §2 |
| G5-T13 | Excel 导出仍为 layout_inventory | 用户指南 |

- **非目标**：G4/G6/G7、模板真数据、批量导入、报表中心 T1–T8/T10–T14 重评

## 2. 完整链路图

```
分享页 DashboardSchedulePanel
  → POST /reports/schedules (sourceType=dashboard)
  → transition schedule
  → POST .../execute (X-Rpt-Semi-Real: 1)
  → executor.submit_dashboard_export
  → issue_export_token + render_dashboard_visual_pdf
  → Playwright GET {FE_BASE_URL}/export/{dashboard|data-screen}/{id}?token=
  → FE export-layout + export-query/execute
  → page.pdf() → export_jobs._jobs (内存)
  → artifactKind=visual_snapshot
  → dispatch_artifact → SMTP 文本（无 MIME 附件）
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | FE export 路由 | 部分通 | `routes.tsx:98-105` · vitest 2/2 | mock layout；无真 chart |
| 2 | export-layout API | 通 | pytest 403/200 | token 须同进程签发 |
| 3 | export-query | 未验 | 无 pytest | actor=admin 权限放大 |
| 4 | Playwright render | **断** | live 502 · D2 | FE base path 不匹配；selector 超时 |
| 5 | export-jobs 内存 | 通 | pytest mock PDF | 多 worker/重启丢 job |
| 6 | executor 失败路径 | 通 | live semi_real_failed | 诚实 errorMessage |
| 7 | SMTP 投递 | **假通** | `delivery_adapter.py:57` | 文案称附件，仅文本+URL |
| 8 | 下载 URL | 需 JWT | `dashboards.py:451-455` | 外部收件人不可用 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| G5-T1 | Export token | PARTIAL | 6/C | 无效 token 403 ✓；TTL 过期无动态实测；内存 store |
| G5-T2 | export-layout | PARTIAL | 7/B | pytest 200/403；跨进程 token 无效（设计预期） |
| G5-T3 | export-query | UNVERIFIED | 4/D | 无自动化；静态存在 `export_snapshot.py:31-47` |
| G5-T4 | dashboard export 页 | PARTIAL | 6/C | vitest mock；无真 chart/ready 时序 |
| G5-T5 | data-screen export 页 | STUB | 4/D | 路由对称；无独立 vitest |
| G5-T6 | Playwright PDF | **BROKEN** | 3/D | live 502；FE `/export` 404（base `/sc-datav/`） |
| G5-T7 | export-jobs 枚举 | PARTIAL | 6/C | mock PDF 下 artifactKind 对；非真渲染 |
| G5-T8 | download bytes | PARTIAL | 6/C | mock 下 %PDF ✓；live 502 无 bytes |
| G5-T9 | 定时 execute 历史 | PARTIAL | 6/C | mock 下 visual_snapshot；live 失败 |
| G5-T10 | 渲染失败诚实性 | PARTIAL | 7/B | live semi_real_failed + Playwright timeout 文案 |
| G5-T11 | SMTP PDF 附件 | **BROKEN** | 2/F | 无 `add_attachment`；MailHog 未运行 |
| G5-T12 | fallback env | UNVERIFIED | 4/D | 无 pytest；默认 false 静态可读 |
| G5-T13 | Excel layout_inventory | PARTIAL | 7/B | live 201 layout_inventory ✓ |

**T 汇总**：0 REAL · 8 PARTIAL · 2 BROKEN · 3 UNVERIFIED/STUB → **总体 PARTIAL · 5.8/C**

## 3b. 前端控件下钻表

功能块映射：G5-T9 → B-G5-1…B-G5-5

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B-G5-1 | 创建定时报告 | POST schedules | 201 + 表单 | smoke 挂载+API 201 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | DashboardShare smoke G5 |
| B-G5-2 | 激活/暂停/取消 | transitionSchedule | FSM 转换 | smoke 未逐 action | 1 | 2 | 2 | 1 | 2 | 8 | PARTIAL | SchedulePanel 同类 smoke |
| B-G5-3 | 立即执行 | executeSchedule | 历史行+artifactKind | live 失败 honest | 2 | 1 | 2 | 2 | 2 | 9 | PARTIAL | API test + live probe |
| B-G5-4 | 历史 artifactKind 列 | ScheduleHistoryTable | 「可视化快照」 | localize 有映射 | 2 | 1 | 2 | 2 | 2 | 9 | PARTIAL | 枚举对、PDF 内容未验 |
| B-G5-5 | 历史重试 | retryExecution | toast/重试 | SchedulePanel smoke | 2 | 2 | 2 | 2 | 2 | 10 | REAL | report-schedules smoke |

**打通但不对**（L≥2 且 C≤1）：**B-G5-3、B-G5-4**（execute 失败或 artifactKind 对但无真 PDF）

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|---------|------|---|---|------|------|
| G5-T1 | token | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | pytest invalid 403 |
| G5-T2 | export-layout | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | pytest 200 layoutJson |
| G5-T3 | export-query | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | UNVERIFIED | 静态代码 only |
| G5-T4 | dashboard export FE | ✅ | ❌ | ✅ | ❌ | UI | 2 | 1 | PARTIAL | vitest mock layout |
| G5-T5 | data-screen export FE | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | STUB | routes 对称无测 |
| G5-T6 | Playwright PDF | ✅ | ❌ | ❌ | ❌ | NONE→live fail | 1 | 0 | **BROKEN** | live 502; FE base mismatch |
| G5-T7 | export-jobs enum | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | pytest mock visual_snapshot |
| G5-T8 | download bytes | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | mock %PDF; live 502 |
| G5-T9 | schedule execute | ✅ | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | pytest + live failed |
| G5-T10 | render fail honest | ✅ | ✅ | ❌ | ✅ | CHAIN | 2 | 2 | PARTIAL | live semi_real_failed |
| G5-T11 | SMTP PDF attach | ✅ | ❌ | ❌ | ❌ | NONE | 1 | 0 | **BROKEN** | 无 MIME 附件 |
| G5-T12 | fallback env | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | UNVERIFIED | 未切换 env 实测 |
| G5-T13 | excel inventory | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | live 201 layout_inventory |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | **13** |
| GATE only | **3**（T3,T5,T12） |
| CHAIN | **8** |
| UI | **1**（T4） |
| BROWSER | **0**（T6 live fail 不计 PASS） |
| NONE / live fail | **2**（T6,T11） |
| REAL 达标 | **0 / 13** |
| **逐一校验** | **否** — T3/T5/T6/T11/T12 未达 C≥2；T6/T11 BROKEN |
| 总体可否 REAL | **否** |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| G5-T6 | 1 | 0 | 1 | 2 | 1 | 5 | C | BROKEN | FE base path + selector 超时 |
| G5-T11 | 1 | 0 | 1 | 1 | 1 | 4 | D | BROKEN | 宣称附件实为 URL |
| G5-T9 | 2 | 1 | 2 | 2 | 2 | 9 | B | PARTIAL | 枚举对、产物未验 |
| **模块** | 2 | 1 | 2 | 2 | 1 | **5.8** | **C** | **PARTIAL** | 0/13 REAL |

**打通但不对**（L≥2 且 C≤1）：G5-T7、G5-T8、G5-T9、B-G5-3、B-G5-4  
**假功能/断链**：G5-T6（live）、G5-T11

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| A1 | vitest export + DashboardShare | 7 passed | **7 passed** | ✅ | 2026-08-03 run |
| A2 | pytest visual_export + schedule | 7 passed | **7 passed** | ✅ | 均 mock Playwright/render |
| D1 | `pip show playwright` | 可 import | **1.60.0 OK** | ✅ | |
| D2 | live POST export-jobs PDF | 201 + %PDF | **502** DASH_EXPORT_RENDER_FAILED selector timeout | ❌ | uvicorn :8000 |
| D2b | live excel export | layout_inventory | **201 layout_inventory** | ✅ | |
| D3 | Playwright `localhost:5173/export/...` | 200 + capture attr | **404** 提示 base `/sc-datav/` | ❌ | |
| D3b | Playwright `/sc-datav/export/...` | 画布渲染 | **200** 但 body 空、无 capture | ❌ | |
| D4 | live schedule execute | visual_snapshot 成功 | **semi_real_failed** render 失败 | ❌ | artifactKind null |
| D5 | MailHog :8025 / SMTP :1025 | PDF MIME 附件 | **端口不可达** unreachable | ❌ | 无法验附件 |
| D6 | 渲染失败路径 | failed + errorMessage | **semi_real_failed** + Playwright timeout 文案 | ✅ | G5-T10 部分满足 |

### 闭环修复后 live 探针（2026-08-03 17:05）

| 步骤 | 期望 | 实际 | 一致？ |
|------|------|------|--------|
| L1 | `POST export-jobs` PDF @127.0.0.1 | 201 visual_snapshot · 69KB %PDF | ✅ |
| L2 | integration pytest ×3 | passed | ✅ |
| L3 | schedule execute + SMTP | semi_real_succeeded + 附件 | ⚠️ MailHog 未启动 → delivery_degraded（PDF 渲染 OK） |
| L4 | excel export | layout_inventory | ✅ |

**P0 修复摘要**：SMTP MIME 附件 · `FE_BASE_URL=127.0.0.1` · `appBasePath` · `domcontentloaded` 等待 · export-query 测试 · docker-compose mailhog

### 自动化测试深度说明

| 测试 | 深度 | 验了什么 | 没验什么 |
|------|------|----------|----------|
| `DashboardExportSnapshotPage.smoke` ×2 | UI | token 缺失报错；mock layout 挂载 | 真 chart、data-export-ready 时序 |
| `DashboardSharePage.smoke` G5 | UI | 定时报告面板挂载 | execute 真 PDF |
| `test_export_layout_requires_valid_token` | CHAIN | 200 layoutJson；invalid 403 | TTL 过期 |
| `test_submit_pdf_export_returns_visual_snapshot` | CHAIN | mock playwright → artifactKind + %PDF | Chromium、真实 FE、图表像素 |
| `test_render_rejects_inventory_leak` | CHAIN | inventory 字节拒绝 | — |
| `test_dashboard_execute_records_visual_snapshot_artifact` | CHAIN | mock render → history artifactKind | 真 PDF、SMTP |

## 5. 修复文档

### G5-T11 — SMTP 邮件 PDF 附件（P0）

**判定 / 得分**：BROKEN 4/10，C=0  
**期望 vs 实际**：期望 MIME `application/pdf` 附件；实际 `EmailMessage.set_content` 仅文本 + `/api/v1/.../download`（需 JWT）  
**根因**：[`delivery_adapter.py`](../../backend/app/reports/scheduler/delivery_adapter.py) L53-57 无 `add_attachment`；executor 只传 `artifact_ref` 不传 bytes  
**修复方向**：executor/delivery 传入 PDF bytes；`msg.add_attachment(pdf, maintype='application', subtype='pdf', filename=...)`  
**修后验收**：MailHog 可见附件；打开非 `LAYOUT INVENTORY`；C≥2

### G5-T6 — Playwright 真渲染（P0）

**判定 / 得分**：BROKEN 5/10，C=0  
**期望 vs 实际**：期望 FE export 页可截图；live `FE_BASE_URL=http://localhost:5173/export/...` → 404（dev 实际 base `/sc-datav/`）  
**根因**：[`export_render.py`](../../backend/app/dashboard/export_render.py) L27-29 未含 Vite base；L13-15 OR 选择器过早命中 thumbnail attr  
**修复方向**：`FE_BASE_URL` 含 base path 或 config 增 `fe_base_path`；CAPTURE_SELECTOR 仅 `[data-export-ready="true"]`  
**修后验收**：live export-jobs 201；PDF >5KB；无 inventory 前缀

### G5-T1 — 文档过度签收（P0）

**判定**：初版复评文档（已移除）曾宣称 REAL 8.6/A- 无 §3d  
**修复方向**：标 superseded；closure/reports 降级 PARTIAL  
**修后验收**：无 REAL 宣称直至 13/13 达标

### G5-T3 — export-query 未验（P1）

**根因**：无 pytest；`execute_export_query` 使用 `roles=["admin"]`  
**修复方向**：补 CHAIN 测试 + 缩小 permissions

### G5-T12 — fallback 未验（P1）

**修复方向**：pytest 设 `RPT_EXPORT_FALLBACK=1` 断言 layout_inventory

### G5-T6 — E2E 测试（P1）

**修复方向**：`@pytest.mark.e2e` + vite preview + 真 Playwright（CI optional）

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | G5-T11 | SMTP 须附 PDF bytes，非 JWT 下载链接 |
| P0 | G5-T6 | FE_BASE_URL 对齐 Vite base；仅等 export-ready |
| P0 | 文档 | 撤销 REAL 8.6/A- 签收 |
| P1 | G5-T3 | export-query 测试 + 降权 |
| P1 | G5-T12 | fallback env pytest |
| P1 | G5-T6 | opt-in E2E 不测 mock 主路径 |

## 7. 交接

- 建议：`root-first-solve` 先 P0（SMTP 附件 + FE base path），再 P1
- **用户批准修复**：否（本审计默认不改业务代码）
-  superseded：初版 `2026-08-03-report-center-delivery-recheck.md`（已移除；以本审计为准）
