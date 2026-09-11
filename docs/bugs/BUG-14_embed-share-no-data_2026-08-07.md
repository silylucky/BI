# BUG-14：公开分享大屏图表无数据（显示「登录已过期」）

> 最近更新 2026-08-07

| 字段 | 值 |
|------|-----|
| 状态 | 🔧 部分修复 |
| 优先级 | P0 |
| 发现日期 | 2026-08-07 |
| 影响范围 | 所有 `shareMode=public` 的大屏/看板分享链接；Dataset 模式图表必现 |
| 数据来源 | 用户截图 [线索]、OpenAPI 路由表 L1、TestClient/pytest L1、PowerShell 实机探针 L1 |

## 问题总览

| # | 根因 | 状态 | 说明 |
|---|------|------|------|
| 1 | 运行中后端未加载 `POST /api/v1/embed/dataset/execute`，中间件按 JWT 拦截 | 🔧 部分缓解 | 代码+中间件已修；须干净重启 uvicorn（Windows 注意端口 8000 僵尸进程） |
| 2 | Dataset 图表匿名页仍走 `/query/dataset/execute`（需 JWT） | ✅ 已修复 | `fe/src/lib/api.ts` `resolveDatasetExecutePath` |
| 3 | embed 布局未绑定本环境 `dataSourceId` / `configId` | ✅ 已修复 | `prepare_layout_for_embed` |
| 4 | `mapApiError` 将 embed 401 的 `UNAUTHORIZED` 误映射为「登录已过期」 | ✅ 已修复 | 2026-08-07 归一化为 `EMBED_UNAUTHORIZED` |

---

## 现象描述

[用户反馈] 用户在大屏「工业园区数据监控中心」生成公开分享链接后，打开 `localhost:5173/embed/screen/{id}?token=...&shareMode=public`：

- 页面框架、标题、富文本正常渲染
- **全部 Dataset 图表**显示「登录已过期，请重新登录」+「重试」
- 期望：匿名访客仅凭 URL `token` 即可看到图表数据

必现条件：图表 `chartConfig.mode === "dataset"`（工业园区模板 5/5 图表均为 Dataset 模式）。

---

## 失败过程还原

### 关键数据

| 指标 | 值 |
|------|-----|
| 受影响图表数 | 5/5（工业园区模板） |
| 失败率 | 100%（Dataset 模式） |
| 布局 API | ✅ 200（`/embed/dashboard-layout?token=...`） |
| 查数 API | ❌ 401 |

### 时序图

| Seq | 动作 | 输入/参数 | 结果 | 证据来源 | 说明 |
|-----|------|---------|------|---------|------|
| 1 | 打开分享 URL | `token` + `shareMode=public` | ✅ | L2 用户截图 | 页面壳层加载成功 |
| 2 | `GET /embed/dashboard-layout` | query `token` | ✅ 200 | L1 `EmbedScreenPage.tsx:47` | 不走 JWT，layout 正常 |
| 3 | 图表 `fetchChartExecuteResult` | `resolveDatasetExecutePath()` | → `/embed/dataset/execute` | L1 `chartExecuteProbe.ts:265` | 前端已切 embed 路径 |
| 4 | `POST /api/v1/embed/dataset/execute` | `X-Embed-Token` | ❌ 401 | L1 实机探针 | **运行中 OpenAPI 无此路由** |
| 5 | Auth 中间件 | 无 Bearer | ❌ `Missing or invalid bearer token` | L1 `middleware.py:39` | 旧进程未放行 dataset 路由 |
| 6 | `mapApiError` | `code=UNAUTHORIZED` | UI「登录已过期」 | L1 `apiError.ts:16` | 误导性文案（已修） |

**分水岭**：Seq 4 — 布局可读、查数被 JWT 中间件拦截。

### 量化分析

- 布局阶段成功率：100%（token 在 query string，白名单路由）
- 查数阶段失败率：100%（Dataset 走 body POST + header，依赖 **新** embed dataset 路由）
- 实机 OpenAPI（`http://127.0.0.1:8000/openapi.json`）仅有 `/embed/query/execute`，**无** `/embed/dataset/execute` → 进程代码落后于仓库

---

## 根因 1：运行中后端未注册 embed dataset 查数路由 🔧 部分缓解

**代码证据**（仓库已含，运行进程未加载）：

`backend/app/api/v1/embed.py:112-133`：

```python
@router.post("/dataset/execute")
def embed_dataset_execute(request: Request, payload: DatasetExecuteRequest):
    token = request.headers.get("X-Embed-Token", "").strip()
    if not token:
        return JSONResponse(
            status_code=401,
            content={"code": "UNAUTHORIZED", "message": "Missing embed token", "detail": None},
        )
    ...
```

`backend/app/auth/middleware.py:135-136`：

```python
if path in {"/api/v1/embed/query/execute", "/api/v1/embed/dataset/execute"}:
    return bool(request.headers.get("X-Embed-Token", "").strip())
```

**数据流**：

```text
ChartRenderer → fetchChartExecuteResult → POST /api/v1/embed/dataset/execute
  → [旧进程] 路由未注册 + 中间件未白名单
  → AuthMiddleware 要求 Bearer JWT
  → 401 UNAUTHORIZED "Missing or invalid bearer token"
  → mapApiError →「登录已过期」
```

**影响量化**：工业园区模板 5/5 图表查数失败（100%）。

**L1 实机验证**（2026-08-07）：

```text
OpenAPI paths: 含 /api/v1/embed/query/execute，不含 /api/v1/embed/dataset/execute
POST /api/v1/embed/dataset/execute + X-Embed-Token → 401 Missing or invalid bearer token
POST /api/v1/embed/query/execute + X-Embed-Token → 422（已进入 handler，非中间件 401）
```

### 修复详情（2026-08-07）

| 文件 | 改动 |
|------|------|
| `backend/app/api/v1/embed.py` | `POST /dataset/execute`（已有） |
| `backend/app/auth/middleware.py` | embed 查数路由始终放行，由 handler 校验 `X-Embed-Token`（避免误报 JWT 过期） |

**干净重启后验证**（`127.0.0.1:8001` 新进程 L1）：

```text
OpenAPI: /api/v1/embed/dataset/execute ✅
POST + X-Embed-Token → 200，rows=5 ✅
```

**修复前**（`127.0.0.1:8000` 僵尸旧进程 L1）：

```text
OpenAPI: 无 /embed/dataset/execute
POST + X-Embed-Token → 401 Missing or invalid bearer token
```

### 待办

| 优先级 | 建议方案 | 位置 | 改动难度 |
|--------|---------|------|---------|
| P0 | 结束所有占用 `:8000` 的 uvicorn，重新 `uvicorn app.main:app --reload --port 8000` | `backend/` | 低 |
| P0 | 重启后确认 OpenAPI 含 `/api/v1/embed/dataset/execute` | 运维走查 | 低 |
| P1 | Windows 若 `netstat` 显示 LISTENING 但 `taskkill` 找不到 PID，改端口或重启终端 | 本地环境 | 低 |

---

## 根因 2：Dataset 查数未走 embed 匿名路径 ✅ 已修复

**代码证据**（`fe/src/lib/api.ts:55-60`）：

```typescript
export function resolveDatasetExecutePath(): string {
  if (isExportSnapshotContext()) {
    return "/api/v1/dashboards/export-query/dataset/execute";
  }
  if (isEmbedShareContext()) return "/api/v1/embed/dataset/execute";
  return "/api/v1/query/dataset/execute";
}
```

**数据流**：embed URL + `token` → `isEmbedShareContext()` 为 true → 查数走 embed 专用路径并附带 `X-Embed-Token`。

**影响量化**：修复前 100% Dataset 图表打到 JWT 路由；修复后路径正确，但被根因 1 阻塞。

### 修复详情（2026-08-07 前序 PR）

| 文件 | 改动 |
|------|------|
| `fe/src/lib/api.ts` | `resolveDatasetExecutePath` embed 分支 |
| `fe/src/lib/chartExecuteProbe.ts` | embed 页跳过 `/datasources` 解析 |
| `backend/app/api/v1/embed.py` | 新增 `POST /dataset/execute` |

---

## 根因 3：embed 返回 layout 未绑定本环境数据源 ✅ 已修复

**代码证据**（`backend/app/integration/embed_resolve.py:87-88`）：

```python
layout = prepare_layout_for_embed(session, layout)
```

`prepare_layout_for_embed` 调用 `bind_demo_dataset_config_ids`，将 `configId` / `dataSourceId` 写为本环境 demo 绑定。

**影响量化**：无此修复时即使鉴权通过也可能 422/空数据；与本次「登录已过期」无直接关系。

### 修复详情（2026-08-07 前序 PR）

pytest：`tests/test_embed_demo_layout_bind.py::test_embed_dashboard_layout_binds_demo_dataset_config` ✅

---

## 根因 4：`mapApiError` 将 embed 401 误显示为「登录已过期」 ✅ 已修复

**代码证据**（`fe/src/lib/apiError.ts:403-409`）：

```typescript
if (coded.code && CODE_MESSAGES[coded.code]) {
  return CODE_MESSAGES[coded.code]; // UNAUTHORIZED →「登录已过期」
}
```

embed 401 响应 `code: "UNAUTHORIZED"` 时，即使 `apiFetch` 已设置 embed 专用 message，仍被 code 映射覆盖。

### 修复详情（2026-08-07）

| 文件 | 改动 |
|------|------|
| `fe/src/lib/api.ts` | embed/export 401 将 `UNAUTHORIZED` 归一化为 `EMBED_UNAUTHORIZED` / `EXPORT_UNAUTHORIZED` |
| `fe/src/lib/apiError.ts` | 新增对应中文文案 |

**修复前**：
```
登录已过期，请重新登录
```

**修复后**：
```
嵌入访问未授权，请重新生成分享链接
```
（或后端返回的具体 message，如 `Missing embed token`）

---

## 启示

1. **分享页两类 API 鉴权方式不同**：layout 用 query `token`，查数用 header `X-Embed-Token`；验收须分别探针。
2. **OpenAPI 路由表是进程是否加载新代码的低成本 L1 证据**，优于只看源码。
3. **错误码复用 `UNAUTHORIZED` 会污染 embed 场景 UX**；headless 上下文应使用专用 code。
4. **Dataset 与 SQL 查数路径分叉**，embed 修复须同时覆盖 `/embed/dataset/execute` 与 `/embed/query/execute`。
5. **uvicorn `--reload` 失败时进程可长期运行旧代码**；P0 故障应先查 OpenAPI 再查前端。
