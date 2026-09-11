# Feature Truth Audit: 分享 / 嵌入（Share & Embed）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-30 |
| 核验范围 | 看板/大屏分享页、公开链接、单图嵌入、Embed 消费页、`/embed/share` 高级配置 |
| 锚点 | `/admin/dashboards/:id/share` · `/admin/data-screens/:id/share` · `/embed/chart/*` · `/embed/screen/*` · `/embed/share` · `/api/v1/embed/*` |
| 总体判定 | **REAL**（主路径闭环） |
| **总分 / 档位** | **8/10 · B** |
| 状态 | closed-loop（2026-07-30 二轮优化） |

## 闭环摘要

```
分享页签发 → embedUrl（含 token[/shareMode=public]）
  → EmbedChartPage / EmbedScreenPage 消费
  → 匿名 GET chart-view | dashboard-layout
  → ChartRenderer(embedded) | DataScreenPresenter
```

**L1 证据（2026-07-30）**

| 层 | 命令 / 文件 | 结果 |
|----|-------------|------|
| 后端 embed API | `pytest tests/test_integration_api_l1_r44.py -k embed` | **14 passed** |
| FE 签发→消费 | `vitest run src/embed/embedShareLoop.test.tsx` | **5 passed** |
| FE 门禁/SDK | `embedAccess.test.ts` · `embedSdk.test.ts` · `api.test.ts` | **25 passed** |
| 分享页 smoke | `DashboardSharePage.smoke.test.tsx` | **4 passed** |

## 二轮修复清单（已实现）

| ID | 修复 |
|----|------|
| B19 | SDK `dashboard` → `/embed/screen/`；sdk-params 回传 `targetType/targetId/shareMode` |
| T2/T4 | `embedAccess`：有效 token 即放行（iframe 闭环）；chart-view 不再 Origin 拒载 |
| T2 | `embedShareLoop.test.tsx` 覆盖签发→匿名加载 |
| B3 | `PublicShareLinkCard` 文案说明 `/embed/screen/` |
| B13 | 成功态移除多余「重试」 |
| 路由 | share 页 `RequireCapabilityName capability=dashboard:share`；admin/analyst 能力登记 |
| 文档 | `docs/api/README.md` dashboard-layout 描述修正 |

## 子能力判定（更新）

| ID | 判定 | 说明 |
|----|------|------|
| T1 分享页签发 | **REAL** | smoke + loop 测试 |
| T2 公开链匿名 | **REAL** | loop 测试 + api.test embed 401 不跳登录 |
| T3 单图 token 门禁 | **REAL** | 裸链报错 + ChartEmbedShareActions |
| T4 iframe 嵌入 | **REAL** | token 放行 + chart-view 后端 Origin 移除 |
| T5 大屏分享 | **REAL** | DataScreenSharePanel + loop screen 测试 |

## 剩余演化项（非阻断）

| 项 | 优先级 | 说明 |
|----|--------|------|
| Token 内存存储 | P2 | 进程重启失效；二期可持久化 |
| 真实浏览器 E2E | P2 | 单测已闭环；可选 Playwright |
| viewer 角色 | — | 无 `dashboard:share`，分享页 Forbidden（符合后端签发约束） |

## 验证命令

```bash
pytest tests/test_integration_api_l1_r44.py -k embed -q
cd fe && npx vitest run src/embed/embedShareLoop.test.tsx src/embed/embedAccess.test.ts src/sdk/embedSdk.test.ts src/pages/admin/dashboard/DashboardSharePage.smoke.test.tsx src/lib/api.test.ts
```
