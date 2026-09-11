# 成品清扫清单（Product Polish）

Plan type: Headless Automation Plan  
Cursor Build: disabled  
目标：四期里程碑已收官后，将 **用户可见体验** 对齐「可演示成品」  
真理源：`docs/automate/plan.md` §M-FINAL 收官信号 · `docs/ui/layout.md` · `docs/automate/prd/F11-META.md` QUERY-009

---

## 总体验收（P4-SMOKE · 全链路）

手动或 E2E 须能走通：

```
数据连接 → Dataset 建模 → 设计器(可选) → 工单/发布(可选)
  → Dashboard 组件选 Dataset 出图 → 预览有真实数据
```

**当前状态（2026-07-08）**：Dashboard `WidgetInspector` 已支持 Dataset 模式；`useChartExecute` 可走 `POST /api/v1/query/dataset/execute`（见 QUERY-009 · META-004）。

---

## P0 — 壳层与第一印象（1–3 天）

> 不修则用户仍认为「M1 开发中」。

### P0-1 运营总览去占位

| 项 | 内容 |
|----|------|
| **问题** | `AdminHomePage` 仍显示 M1 文案、禁用数据源、假指标 |
| **文件** | `fe/src/pages/admin/AdminHomePage.tsx` · `fe/src/pages/admin/AdminHome.smoke.test.tsx` |
| **改动** | ① 接 `GET /api/v1/datasources`、`GET /api/v1/dashboards` 显示真实计数；② 去掉 `disabled: true` 快捷入口；③ 文案改为产品态（非「M1 壳层」） |
| **验收** | `pnpm exec vitest run src/pages/admin/AdminHome.smoke.test.tsx`；浏览器 admin 登录见非「—」指标 |

### P0-2 四期导航去「预览」

| 项 | 内容 |
|----|------|
| **问题** | M13 项在 admin 侧栏仍标「预览」（`resolve-nav.ts` + `ACTIVE_MILESTONES` 不含 M13） |
| **文件** | `fe/src/lib/resolve-nav.ts` · `fe/src/config/nav-manifest.tsx` · `docs/ui/layout.md` §6 |
| **改动** | 将 `ACTIVE_MILESTONES` 扩展含 `M13`，或四期收官后移除 preview badge 逻辑 |
| **验收** | `pnpm exec vitest run src/lib/resolve-nav.test.ts src/layouts/AdminLayout.smoke.test.tsx`；侧栏无「预览」或仅保留明确实验项 |

### P0-3 登录默认工作台

| 项 | 内容 |
|----|------|
| **问题** | admin 登录进 `/admin` 总览；analyst/viewer 才自动进 Dashboard |
| **文件** | `fe/src/pages/admin/AdminHomePage.tsx` · `fe/src/lib/defaultViewResolve.ts` · `docs/ui/layout.md` §2 默认落地 |
| **改动** | 方案 A（推荐）：admin 也默认 `Navigate` 到 `/admin/dashboards` 或角色默认 Dashboard；总览改为可选入口 |
| **验收** | `fe/e2e/login-default-dashboard.spec.ts`（若存在）或 smoke 断言 admin 登录落点 |

### P0-4 侧栏 IA 与 layout 对齐

| 项 | 内容 |
|----|------|
| **问题** | `layout.md` 有「我的 → /me/views」；manifest 无该分组（已重定向到账号设置） |
| **文件** | `fe/src/config/nav-manifest.tsx` · `docs/ui/layout.md` §3 |
| **改动** | 二选一：**A** manifest 增加「我的」→ `/admin/account/settings`；**B** 修订 layout 删除独立「我的」 |
| **验收** | `routes.smoke.test.tsx` nav href 有效；文档与 manifest 一致 |

### P0-5 文档漂移清扫

| 项 | 内容 |
|----|------|
| **问题** | `plan.md` frontmatter `96/129` 与 §M-FINAL 全 `[x]` 不一致；`services/README` ingestion 标「未实现」 |
| **文件** | `docs/automate/plan.md` · `docs/services/README.md` · `docs/services/ingestion.md` |
| **验收** | hub `prd.md` feature 状态与 plan 完成数一致 |

---

## P1 — 四期主路径 FE 闭环（核心成品，3–7 天）

### P1-1 Dashboard 接 Dataset 出图 ★最高优先级

| 项 | 内容 |
|----|------|
| **PRD** | QUERY-009 · META-004 · F07-DASH |
| **后端** | `POST /api/v1/query/dataset/execute`（`configId` + `dataSourceId`）已实现 |
| **前端缺口** | `ChartViewConfig` 无 `datasetId`/`configId`；`WidgetInspector` 无 Dataset 选择；`useChartExecute` 未走 dataset 路径 |
| **建议文件** | `fe/src/lib/chartViewConfig.ts` · `fe/src/components/dashboard/WidgetInspector.tsx` · `fe/src/components/charts/useChartExecute.ts` · `fe/src/components/charts/ChartRenderer.tsx` · 新建 `fe/src/components/dashboard/DatasetFieldPicker.tsx`（可选） |
| **改动要点** | ① Inspector 增加 Tab：**Dataset** / **SQL 高级**；② Dataset 下拉 `GET /api/v1/datasets`；③ 绑定 `boundConfigId` 或 `configId`；④ execute 改调 `/query/dataset/execute`；⑤ 保留一至三期 SQL 路径 |
| **验收** | ① `vitest` 覆盖 config 序列化；② 手动：sample-mysql → 建 Dataset → Dashboard 柱状图无手写 SQL 出数；③ `pytest tests/test_mfinal_fd*.py` 或 QUERY-009 集成测仍绿 |

### P1-2 已发布查询服务 Admin 页

| 项 | 内容 |
|----|------|
| **PRD** | API-003 · GOV-005/006 |
| **后端** | `GET /api/v1/services` · `POST .../execute` · `GET .../openapi` |
| **前端缺口** | 无页面 |
| **建议** | `fe/src/pages/admin/services/QueryServicesPage.tsx`；路由 `/admin/services`；nav-manifest「治理」或「分析」下新增 |
| **验收** | 列表已发布服务 → 试跑 execute → 展示 JSON 结果；smoke test |

### P1-3 治理发布 → 服务 导航串联

| 项 | 内容 |
|----|------|
| **问题** | `GovernancePublishPage` 与查询服务页割裂 |
| **文件** | `fe/src/pages/admin/governance/GovernancePublishPage.tsx` · P1-2 新页 |
| **改动** | 发布成功后 deep link 到服务详情/试跑 |
| **验收** | P4-SMOKE 后半段可点击完成 |

### P1-4 报表同步导出 UI

| 项 | 内容 |
|----|------|
| **后端** | `GET /api/v1/reports/export` · `.../download` |
| **建议** | `fe/src/pages/admin/reports/ReportExportPage.tsx` 或嵌入 `ReportTemplatesPage` |
| **验收** | 触发导出 → 轮询状态 → 下载文件 |

### P1-5 Excel/CSV/REST 建源表单

| 项 | 内容 |
|----|------|
| **PRD** | CONN-023~024 |
| **文件** | `fe/src/pages/admin/datasources/DatasourceFormPage.tsx` |
| **改动** | 按 `type` 显示文件上传 / base URL / 认证字段 |
| **验收** | 创建 CSV 源 → test 连通 → schema 浏览 |

### P1-6 Dashboard 分享入口

| 项 | 内容 |
|----|------|
| **layout** | `/admin/dashboards/:id/share`（`layout.md`） |
| **现状** | 仅 `/admin/share` SDK 演示 |
| **建议** | 路由 + `DashboardEditPage` 工具栏「分享」 |
| **验收** | 从 Dashboard 进入 embed 配置并复制 token/URL |

---

## P1.5 — 账号与权限（已部分完成）

| ID | 状态 | 备注 |
|----|------|------|
| 个人资料/改密码 | ✅ 已实现 | `PATCH /me` · `AccountProfilePage` |
| 账号侧栏切换 | ✅ 已实现 | `resolveSidebarSections` · `account-nav.tsx` |
| 资源授权 UI | ✅ 已实现 | `/admin/system/grants` |
| 能力驱动导航 | ✅ 已实现 | `resolve-nav.ts` + capabilities |

---

## P2 — Companion 深度（按合同裁剪）

PRD 分片仍有 `[ ]`，**不阻塞演示**但影响「对标 DE/SS 全量」：

| 域 | 文件 | 未勾项摘要 |
|----|------|-----------|
| F11-META | `prd/F11-META.md` | Dataset 全量对标、计算字段引擎、物理映射、主题树 DnD |
| F14-CAT | `prd/F14-CAT.md` | IF-02 真实实体/聚合/地域查询（非 probe） |
| F08-RPT | `prd/F08-RPT.md` | PDF/Word 渲染、预制 binding 完整表单 |
| F07-DASH | `prd/F07-DASH.md` | GIS 下钻、跨组件口径 |
| F12-DESIGN | `prd/F12-DESIGN.md` | SQL 语法高亮（文档标计划外） |

---

## 推荐执行顺序

```text
P0-1 → P0-2 → P0-3 → P1-1 ★ → P1-2 → P1-3 → P0-4 → P0-5
  → P1-4 → P1-5 → P1-6 → P2（按需）
```

**首轮 dev-autopilot 建议契约**：

- goal: 可演示 P4-SMOKE + 去 M1 壳层占位
- scope_include: P0 全量 + P1-1
- acceptance: vitest 相关 smoke 绿 + 手动 Dashboard Dataset 出图

---

## 验证命令矩阵

| 范围 | 命令 |
|------|------|
| FE 壳层 | `cd fe && pnpm exec vitest run src/layouts/AdminLayout.smoke.test.tsx src/lib/resolve-nav.test.ts src/pages/admin/AdminHome.smoke.test.tsx` |
| FE Dashboard | `cd fe && pnpm exec vitest run src/pages/admin/dashboard src/components/charts` |
| BE 四期 | `cd backend && python -m pytest tests/test_mfinal_fd*.py tests/test_auth_profile.py -q` |
| 全量回归（收官前） | `cd backend && python -m pytest -q` · `cd fe && pnpm run check`（若项目有） |

---

## 决策点（实施前确认）

| # | 问题 | 推荐 |
|---|------|------|
| D1 | Dashboard 默认模式 | Dataset 优先，SQL 收进「高级」 |
| D2 | admin 登录落点 | `/admin/dashboards` 或角色默认 Dashboard |
| D3 | M13 预览 badge | 四期收官后移除 |
| D4 | 「我的」入口 | 侧栏增加分组，链到账号设置 |

---

*创建：2026-07-08 · 对应会话「成品感差距」审计*
