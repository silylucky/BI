# Track B Wave1 Report — Tasks 6–7 (F-E docs)

**Status**: ✅ 完成（Task 6 + Task 7 + plan.md F-E 勾选）

## Commits（branch `feat/grad-docs-e2e`, base `f5b890b`）

| SHA | 说明 |
|-----|------|
| `de2324a` | docs(api): align public paths with AuthMiddleware (F-E) |
| `4d2af5c` | docs(ui): layout.md nav sync (F-E DS-007) |
| `b6859f1` | docs(plan): check M-PRODUCT F-E rows after docs sync (F-E) |

## Summary

### Task 6 — API-007 auth 公开路径对账
- 读取 `backend/app/auth/middleware.py`：`PUBLIC_PATHS = {"/health", "/docs", "/redoc", "/openapi.json", "/api/v1/auth/login"}`，且 `path.startswith("/docs")` 额外豁免 `/docs` 子资源；`main.py` 确认 FastAPI `docs_url="/docs"`、`redoc_url="/redoc"`、`openapi_url="/openapi.json"` 均已启用（未禁用）。
- 发现文档漂移：`docs/api/README.md` 中 `/docs`、`/redoc` 状态标「规划」，与实际（已启用 + 已豁免鉴权）不符；`/health`/`/openapi.json`/`/api/v1/auth/login` 缺少免鉴权注记。
- 修复：四行状态统一改为「已实现」，补 `AuthMiddleware.PUBLIC_PATHS` 注记与代码锚点（`main.py`、`auth/middleware.py`），版本号 1.0.2→1.0.3，补修订记录。

### Task 7 — DS-007 layout.md 对账
- 对比 `docs/ui/layout.md` §3 IA 树/侧栏分组表 与 `fe/src/config/nav-manifest.tsx`：
  - `/admin/connectors` 重定向、「数据连接」命名、F-B taxonomy（displayGroup/categoryLabel）文案均与代码一致，无漂移。
  - **发现漂移**：文档把「主题与实体」画成独立顶级侧栏分组（含 `/themes`、`/themes/:id` 路由），但 `nav-manifest.tsx` 实际把「实体与主题」作为「数据」分组内的嵌套子项（`iaTier: engineering`），且路由为固定 `/admin/themes/default`（对应 `routes.tsx` 的 `themes/:dashboardId`），并非通用 `/themes/:id`。此漂移在 §3 IA 树、「侧栏导航分组」表、「默认 IA 矩阵」表三处重复出现。
  - 修复：三处均改为「实体与主题嵌套于数据分组」，路由改为 `/admin/themes/:dashboardId`（现固定 `default`），版本号 1.2.1→1.2.2，补修订记录。
- `docs/automate/plan.md` F-E 分片：`API-007`、`DS-007` 两行勾选 `[x]（完成于 2026-07-09）`；同步更新 F-E 子批表（待完成 2→0，状态→已完成）与 M-PRODUCT 状态摘要行（F-A/B/C/E 已勾；F-D 收官后恢复）。

## Concerns
- `docs/ui/layout.md` 版本历史存在既有缺口（1.1.0 → 1.2.1 之间无修订记录条目），非本次引入，未回溯补齐（超出 Task 7 范围）。
- Task 6/7 均为文档层面对账，未运行 FastAPI/前端测试；建议 Track A 合并后由 Controller 在 Task 9 阶段做一次 `pnpm run check:design` / 相关 vitest 快照复核，确认无联动副作用（本轨未改 `fe/` 代码）。
- F-D（M-PRODUCT）仍排队，未在本轨处理；plan.md 摘要行已如实反映。
