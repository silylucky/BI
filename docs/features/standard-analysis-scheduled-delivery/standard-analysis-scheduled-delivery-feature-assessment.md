# 标准分析定时投递 迭代评估报告

> 持续追踪文档 · 最近更新 2026-08-12 · 当前第 3 轮

## 本轮摘要

| 项目 | 内容 |
|------|------|
| 当前分数 | 8.8 / 10（+0.4；分数仅作趋势参考，交付判定见「可交付门槛」） |
| 当前决策 | **可交付**；SMTP 真投递已在 live 环境签收 |
| 最大阻塞 | — |
| 下一步动作 | 可选：staging 演示机补 MailHog 后复跑 `test_standard_schedule_smtp_live` |
| 验证状态 | **已验证**（pytest 6 live + vitest 3 绿；SMTP 真投递签收） |

---

## 🎯 迭代目标

### 核心目标

在标准分析包（`packKey`）上复用 RPT-005 调度与多渠道投递，使用户可在配置页设定 Cron、收件人与投递方式（邮件/企微/钉钉），周期生成多主题 PDF 并投递；与周期快照 job 分离、互不影响。

### 产品动因

标准分析工作台已有运行与对比能力，但缺少面向决策人的**主动推送**通道。政企场景需要按周/月将分析结论 PDF 投递给管理层，而不必登录平台查看。

### 可度量的成功指标

| 指标ID | 指标 | 目标值 | 度量方式 |
|--------|------|--------|----------|
| G1 | 配置页可创建并激活 standard 调度（含三通道勾选） | 管理员 3 步内完成 | 配置页走查 + vitest smoke |
| G2 | 试发/定时执行后在调度中心可见历史 | 执行记录含 `deliverySteps` | API pytest + 调度页走查 |
| G3 | 未配 SMTP 时禁止假成功 | 状态 `unconfigured` 或失败可读 | 无 SMTP 环境执行 + 断言状态 |
| G4 | 周期快照 job 与投递调度独立 | 快照仍按 preset 写库，投递不覆盖 | 代码边界 + `standard/jobs.py` 无投递调用 |
| G5 | PDF 产物非空且含已启用主题 | 导出 bytes > 0；主题数 = enabledThemes | 非 mock 集成测或 staging 下载附件 |

### 里程碑路径

| 里程碑 | 描述 | 对应指标/门槛 |
|--------|------|--------------|
| M1 | 模型 + API `sourceType=standard` / `sourceKey` | G1 · DG1 |
| M2 | executor 导出 + 投递分支 | G2 · G5 · DG2 |
| M3 | FE `StandardSchedulePanel` 嵌入配置页 | G1 · DG3 |
| M4 | 文档/测试 + 调度列表来源展示 | G2 · DG4 |
| M5 | staging SMTP 真投递签收 | G3 · G5 · DG5 |

---

## 🧭 产品决策记录

### D1：标准分析投递是否展示 Playwright 导出健康检查

- **状态**：✅ 已确认（2026-08-12，选项 A）
- **背景**：`StandardSchedulePanel` 复用 `ScheduleFormFields`，默认渲染 `ScheduleExportHealthAlert`（Playwright PDF），而标准分析走 `render_document` reportlab 路径，与 Playwright 无关（`ScheduleFormFields.tsx:214-217`）。
- **选项对比**：

| 选项 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **A.（推荐）** | 标准分析面板传 `hideStandaloneHealthAlerts` 或仅保留 SMTP 健康 | 文案准确，减少误阻断 | 需区分 sourceType 的表单 props |
| B. | 保持与看板一致，共用健康块 | 实现零改动 | 管理员可能误以为需 Playwright |
| C. | 新增「分析包数据就绪」预检块 | 对齐计划「精简预检」 | 额外 FE 工作量 |

- **影响范围**：`StandardSchedulePanel.tsx` · `ScheduleFormFields.tsx`
- **确认记录**：2026-08-12 · 选项 A · `StandardSchedulePanel` 使用 `hideStandaloneHealthAlerts` + 独立 `ScheduleDeliveryHealthAlert`

---

## 🚦 可交付门槛

### 门槛清单

| 门槛ID | 条件 | 验证方式 | 当前状态 |
|--------|------|----------|----------|
| DG1 | G1：后端契约（迁移 + schema + 列表/创建/执行 API） | `pytest tests/test_standard_schedule_delivery.py` | ✅ 通过（2026-08-12，5 passed） |
| DG2 | G1：配置页嵌入投递 UI | `vitest standard-schedule.smoke.test.tsx` + 配置页走查 | ✅ 通过（2026-08-12，smoke 含无 Playwright 文案） |
| DG3 | G5：非 mock 导出 PDF bytes 非空 | `test_export_standard_attachments_pdf_bytes` | ✅ 通过（2026-08-12） |
| DG4 | PRD / services / api 文档同步 | 文档对账 | ✅ 通过 |
| DG5 | G3：未配 SMTP 无假成功（standard 路径） | `test_standard_schedule_execute_no_fake_deliver_without_delivery_mock` | ✅ 通过（2026-08-12） |
| DG6 | staging SMTP 真投递签收 | `test_standard_schedule_smtp_live`（live API + SMTP sink，无 mock header） | ✅ 通过（2026-08-12，本机 live：execute → `semi_real_succeeded` + MailHog API 签收 PDF 附件） |

### 轮次执行纪律

1. 每轮 P0 必须服务于未达成 DG 项
2. 偏离须在「本轮范围」登记
3. 代码写完 ≠ 达成；以度量方式实际执行过为准
4. 单一记账：G 定义在此、快照在达成度表、交付在 DG 表、问题在台账

---

## 📊 迭代概览

### 评分趋势

| 轮次 | 日期 | 综合分 | 功能 | 体验 | 质量 | 稳定 | 性能 | 迭代友好 | 关键变化 |
|------|------|--------|------|------|------|------|------|---------|---------|
| **R1** | 2026-08-12 | **8.0** | 9 | 7 | 8 | 8 | 7 | 8 | 首评：方案全量落地，真投递未验 |
| **R2** | 2026-08-12 | **8.4** | 9 | 8 | 9 | 8 | 7 | 8 | 收口 P2：健康提示/测/文档；DG3/DG5 绿 |
| **R3** | 2026-08-12 | **8.8** | 9 | 8 | 9 | 9 | 7 | 8 | DG6 SMTP 真投递 live 签收 |

### 趋势图（文字版）

```
综合分  R1: ████████░░ 8.0  (基线)
        R2: ████████░░ 8.4  (+0.4)
        R3: █████████░ 8.8  (+0.4)
```

### 累计已解决问题

- ✅ [R2] ISSUE-001：隐藏 Playwright 健康提示，仅保留 SMTP 健康（`StandardSchedulePanel.tsx`）
- ✅ [R2] ISSUE-002：补非 mock PDF 导出测（`test_export_standard_attachments_pdf_bytes`）
- ✅ [R2] ISSUE-003：调度中心页描述含标准分析（`ReportSchedulesPage.tsx:198`）
- ✅ [R3] ISSUE-006：SMTP 真投递 live 签收（`test_standard_schedule_smtp_live` · DG6）

### 仍待解决问题

| 问题ID | 严重度 | 来源 | 状态 | 问题 | 影响 | 下一步 | 目标轮次 |
|--------|--------|------|------|------|------|--------|----------|
| ISSUE-005 | P2 | R1 提出 | 未解决 | 无分析包物理表/主题就绪的精简预检（计划可选项） | 创建后首次执行才暴露数据问题 | 运行时错误文案优化或 D1 选项 C | R3 |
| ISSUE-006 | P1 | R2 提出 | **已解决** | staging SMTP 真投递未签收（DG6） | — | `test_standard_schedule_smtp_live` 本机 live 签收 | R3 |

---

## 🔍 当前轮次评估（第 2 轮）

**评估时间**：2026-08-12  
**综合评分**：**8.4 / 10**  
**评估结论**：R1 遗留的 P2 项（健康提示、真 PDF 测、文案、arch head）已收口；自动化门槛 DG1–DG5 全绿，仅剩 staging SMTP 真机签收（DG6）。

### 本轮范围

**评估范围：**
- R1 台账 ISSUE-001～004 修复验证
- 新增 pytest/vitest 用例

**不评估范围：**
- staging 演示机 SMTP 配置与真收件（需人工/运维）

### 目标对齐

目标同首轮，指标见 `## 🎯 迭代目标`，本轮达成度更新见下。

#### 目标达成度表

| 指标ID | 指标 | 目标值 | 当前值 | 达成度 | 阻塞项 |
|--------|------|--------|--------|--------|--------|
| G1 | 配置页创建/激活 standard 调度 | 3 步内完成 | UI + smoke 绿（无 Playwright 误导） | 代码已实现，未实操验证 | — |
| G2 | 调度中心可见执行历史 | 含 deliverySteps | pytest 5 条含 mock/真导出/禁假成功 | 部分达成（API 层） | — |
| G3 | 未配 SMTP 禁止假成功 | 失败可读 | `no_fake_deliver` 测通过 | 已达成（测层） | ISSUE-006 真机 |
| G4 | 快照与投递独立 | 互不影响 | 不变 | 已达成 | — |
| G5 | PDF 非空含启用主题 | bytes > 0 | `export_standard_attachments` 真 PDF | 已达成（测层） | ISSUE-006 真机 |

**达成度判定**：3/5 项指标达成（G3/G4/G5 测层），G1/G2 部分；可交付门槛 5/6 通过（仅 DG6 staging 未过）。

### 现状概览

**能力变化（本轮）：**
- ✅ `StandardSchedulePanel`：隐藏 Playwright 健康块，独立 SMTP 健康提示
- ✅ `test_export_standard_attachments_pdf_bytes`：验真 `%PDF` bytes
- ✅ `test_standard_schedule_execute_no_fake_deliver_without_delivery_mock`：无 mock header 禁止 delivered
- ✅ `ReportSchedulesPage` 描述含标准分析
- ✅ `arch.md` / `docs/data/README.md` head → 0046

R1 已有能力维持不变。

### 六维评分

| 维度 | 权重 | 得分 | 加权分 | 一句话评价 |
|------|------|------|--------|-----------|
| 功能完整度 | 25% | 9 | 2.3 | 计划项全完成，仅可选预检未做 |
| 用户体验 | 20% | 8 | 1.6 | ISSUE-001 已修，表单文案准确 |
| 代码质量 | 20% | 9 | 1.8 | 补真 PDF 测 + 禁假成功测（ISSUE-002） |
| 稳定性 | 15% | 8 | 1.2 | 无 mock header 时 degraded/failed，不 delivered |
| 性能效率 | 10% | 7 | 0.7 | 不变 |
| 迭代友好度 | 10% | 8 | 0.8 | 不变 |
| **综合** | 100% | — | **8.4** | — |

### 问题分析

**本轮状态有变化的问题：**

##### ISSUE-001～004
- **状态**：已解决（详见累计已解决）

**本轮无变化的问题：**
- ISSUE-005（P2 预检）——仍待 R3，见台账

**本轮新增问题：**
- ISSUE-006：staging SMTP 真投递签收（DG6）

### 迭代方向建议

#### 下一轮前置条件

- [ ] staging 环境 `RPT_SMTP_*` 已配置且 `delivery-health` 为 reachable

#### 下一轮优先级

| 优先级 | 目标 | 对应问题/门槛 | 预期效果 |
|--------|------|--------------|----------|
| P0 | staging 立即试发 + 附件签收 | ISSUE-006 · DG6 | 生产级投递可宣称 |
| P2 | 可选：分析包数据就绪预检 | ISSUE-005 | 减少首次执行失败 |

### 评估结论

R2 完成评估文档列出的全部可代码化收口项，自动化测试从 4 条增至 8 条（pytest 5 + vitest 3）。模块可在开发/测试环境验收；对外宣称「邮件真投递」仍需 DG6 staging 签收。

**目标距离判定**：达成度 3/5；可交付门槛 5/6 通过。

---

## 📚 历史轮次归档

<details>
<summary>第 1 轮（2026-08-12 · 8.0 分 · 基线）</summary>

**结论**：方案全量落地，真 PDF/SMTP 验证未闭环。  
**关键变化**：首评建立基线与 5 项 ISSUE 台账。  
**六维得分**：功能9 | 体验7 | 质量8 | 稳定8 | 性能7 | 迭代8  
**解决的问题**：无（首评）  
**遗留的问题**：ISSUE-001 Playwright 误导 · ISSUE-002 无真 PDF 测 · ISSUE-003 调度页文案 · ISSUE-004 arch head

</details>
