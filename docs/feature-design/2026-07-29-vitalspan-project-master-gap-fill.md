# VitalSpan 项目 Master Gap-fill（统一真理源）

| 项 | 值 |
|----|-----|
| 模式 | Gap-fill |
| 日期 | 2026-07-29 |
| 状态 | **P0 已闭合 · F-D 收官 2026-07-30** |
| 分片归档 | [数据大屏 master](./2026-07-29-data-screen-master-gap-fill.md) · [land-design plan](../../.cursor/plans/vitalspan_整体缺口_overview_以_gap-fill_模式盘点_vitalspan_在「129_项_prd_合同已勾完」之后的真实补充面：m-depth_余项、体验_companion_7e22bb9a.plan.md) |

## 1. 问题与目标

129 项 PRD 合同已全部勾选，但 **合同勾完 ≠ 可交付运维**。大量 companion 在 PRD/plan 仍标 `[ ]`，而 FE/BE 代码已落地；少数薄实现（如 API-003 服务试跑）仍缺浏览器可感知能力。

**方法论**：代码实扫优先于 PRD `[ ]`；只回写有 L1 证据的项，不重复开发。

**成功标准**：M-DEPTH F-C 零 `[ ]`；project master 可索引全项目 P0/P1/P2 缺口；API-003 可在 `/admin/services` 完成参数试跑 + 结果 + OpenAPI。

**非目标**：P1 看板 canvas UX、map-3d 纹理、真实总线 HTTP、Phase 3 大屏播放。

---

## 2. 已闭合矩阵（代码实扫 · 2026-07-29）

| 域 | 能力 | 证据 |
|----|------|------|
| PRD 合同 | 129/129 已实现 | `docs/automate/plan.md` |
| M-DEPTH F-A | Dataset ORM + 真实 execute + 编辑页 | `backend/app/metadata/dataset/` · `DatasetListPage` |
| M-DEPTH F-B | filter widget 全链 | `FilterWidget.tsx` · `QueryComponentPicker` · `GlobalFilterBar` · `dashboardFilterUtils` |
| M-DEPTH F-C AUTH | RLS 分组 UI + 审计浏览 | `RlsAdminPage.tsx` · `AuditLogPage.tsx` |
| M-DEPTH F-C RPT | 调度历史 / 重试 UI | `ReportSchedulesPage` · `SchedulePanel` · `SchedulePanel.smoke.test.tsx` |
| M-DEPTH F-E | 报表诚实化 | mock 投递显式失败 |
| VIZ companion | 列驱动 Inspector | `useInspectorColumns.ts` · `DatasetFieldGroups.tsx` |
| 数据大屏 | Phase 2.5/2.6 + BUG-14 + BUG-12 e2e | [data-screen master](./2026-07-29-data-screen-master-gap-fill.md) |
| M-DEPTH F-D | API-006 公开分享 + BOOT-002 IA + ADR-15 | `PublicShareLinkCard` · `ChartExploreDrawer` · `docs/arch.md` ADR-15 |

---

## 3. 仍开放缺口（按优先级）

### P0 · 本批（2026-07-29）

| ID | 项 | 状态 |
|----|-----|------|
| P0-1 | project master 文档 | ✅ 本页 |
| P0-2 | PRD/plan 漂移回写 | ✅ |
| P0-3 | API-003 服务试跑加深 | ✅ |
| P0-4 | BUG-2 Pointer QA 手测表 | §6.1 · Vitest 绿 · 发版手测待抽测 |

### P1 · 下一迭代

| ID | 项 | 依据 |
|----|-----|------|
| P1-1 | 看板 canvas UX | `plans/2026-07-14-dashboard-canvas-ux-de-complete.md` |
| P1-2 | 大屏 MT 手测发版抽测 | [data-screen master §3](./2026-07-29-data-screen-master-gap-fill.md) · MT-INS/MT-DEPLOY 部分自动化已绿 |
| P1-3 | map-3d normal/displacement 运行时 | `buildGeoFlatPlateMesh.ts` |
| P1-4 | Embed CSP / X-Frame-Options | `main.py` 无 HTTP 安全头 |
| P1-5 | 治理真实总线 HTTP | `GovernanceHonestyBanner` |
| P1-6 | DASH-008 背景上传 / 组件样式 Tab | PRD 演化建议 |

### P2 · 挂点 / 远期

| ID | 项 |
|----|-----|
| P2-1 | `screenPlaylist` 播放逻辑 |
| P2-2 | 视口 pan/zoom 持久化 |
| P2-3 | NFR 生产化、Dataset 多表 join |

---

## 4. 域附录速查

| 域 | companion 状态 | 指针 |
|----|----------------|------|
| dashboard | v2 像素画布已实现；BUG-2 手测待发版 | `docs/services/dashboard.md` |
| metadata | Dataset ORM + 编辑已实现 | `docs/services/metadata.md` |
| integration | API-003 试跑 + API-006 公开分享已实现 | `QueryServiceTrialSheet.tsx` · `PublicShareLinkCard.tsx` |
| reports | 调度历史/重试 UI 已实现 | `SchedulePanel.tsx` |
| auth | RLS/审计 FE 已实现 | `RlsAdminPage` · `AuditLogPage` |
| viz | 列驱动 Inspector 已实现 | `useInspectorColumns.ts` |
| governance | 真实总线未对接 | `GovernanceHonestyBanner` |

---

## 5. 验证命令（F-D + P0）

```bash
# API-006 embed
pytest tests/test_integration_api_l1_r44.py -k embed -q

# FE F-D
cd fe && npx vitest run \
  src/pages/admin/dashboard/DashboardSharePage.smoke.test.tsx \
  src/components/dashboard/ChartExploreContent.test.tsx \
  src/routes.smoke.test.tsx -t "T-FE-09"
```

数据大屏回归见 [data-screen master §2](./2026-07-29-data-screen-master-gap-fill.md)。

---

## 6. 手测 / E2E 登记

### 6.1 普通看板 BUG-2 Pointer QA

| ID | 步骤 | 期望 |
|----|------|------|
| BUG2-MT-1 | v2 看板编辑页拖移组件 | 位置实时更新 |
| BUG2-MT-2 | 八向 resize 手柄 | 尺寸跟手 |
| BUG2-MT-3 | 保存 → 刷新 | 位置/尺寸保持 |
| BUG2-MT-4 | 多选 + 方向键 nudge | 位移正确 |

**状态**：Vitest `PixelCanvas.test.tsx` 30+ 用例 ✅ 2026-07-30 · **发版 Pointer 手测待抽测**

**参考**：`docs/superpowers/specs/2026-07-13-dashboard-de-canvas-design.md` §验收

### 6.2 数据大屏 MT（引用）

见 [data-screen master §3 MT-* / MT-BUG2-DS-*](./2026-07-29-data-screen-master-gap-fill.md)。

**抽测登记（2026-07-30）**：MT-INS-2 Vitest 绿；MT-DEPLOY-2/3 API-006 embed pytest + SharePage smoke 绿；MT-1/6/7 等发版手测仍待浏览器抽测。

### 6.3 F-D 验收（2026-07-30）

| ID | 项 | 自动化 | 手测 |
|----|-----|--------|------|
| FD-1 | API-006 公开链接 | pytest embed 12/12 · SharePage smoke | 分享页生成 → 无登录打开 |
| FD-2 | BOOT-002 Palette Drawer | ChartExploreContent.test · T-VIZ-FC-04 | Palette 无 `/charts/types` 死链 |
| FD-3 | DESIGN-001 ADR-15 | `docs/arch.md` 落盘 | — |

---

## 7. 验收清单

- [x] project master 落盘且交叉引用 data-screen master
- [x] PRD F-B / AUTH F-C / RPT-005 / VIZ 列驱动 / API-003 回写
- [x] plan.md §M-DEPTH F-C 两项 `[x]`
- [x] API-003 Trial Sheet 浏览器可试跑
- [x] BUG-2 手测表登记（§6.1 · Vitest 绿）
- [x] F-D 三项 plan/PRD 回写（2026-07-30）
- [x] F-D 自动化回归（§6.3）

---

## 8. 开放决策

| 决策 | 结论 |
|------|------|
| P0 先回写再开发 | **是** — 避免重复实现 F-B/RPT-005/RLS |
| API-003 范围 | services 页内参数试跑 + 结果表 + OpenAPI Sheet |
| BUG-2 e2e | 非阻塞；Vitest 已覆盖 |
| **文档对齐策略** | **代码 + 可感知行为 > PRD companion `[ ]`**；`[ ]` 多为演化/可选/QA，非合同未交付 |
