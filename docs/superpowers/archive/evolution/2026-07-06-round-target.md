# 演化轮次选题 — 2026-07-06（M-FE-1 认证与数据源 FE companion）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**M-FE-1 认证与数据源 FE companion** — 浏览器可感知缺口（正式登录、API 客户端、数据源管理/连通性测试/连接器类型页）；移除 `Bearer dev` / `session.ts` 硬编码；对齐 `layout.md` §3「数据」分组
- **来源**：`docs/automate/plan.md` §**M-FE-1**（当前节，**5 项 `[ ]`**）；饱和熔断**已跳过**（plan 存在且当前节含未完成项）；`prd.md` hub 8 维总表映射入选 ID 分数；`evolution-state.md` **待办池空**、**选题卡住计数表空**；`git log -5` f80371e（G1 r191）+ ba9cbdd（G1 r190 #204）+ 4514d5f（plan v2.1）+ 267f1fe（G1 r189 #203）+ 7236981（G1 r188 #202）；上游 G0 PASS base_branch=dev-auto
- **合并理由**：plan 推荐顺序 `BOOT-003 → BOOT-002 → DS-002 → DS-003 → DS-007`；BOOT-003/002 为 DS 页面前置（鉴权 + API 客户端）；三 DS 项共享 `fe/pages/admin/datasources` 与 `connectors` 路由域；后端 DS API 已交付（M3），本轮为 **FE companion 补缺** 而非重复后端
- **范围框定**：
  - **模块**（≤3）：`fe/`（login、api 客户端、datasources/connectors 页）+ `backend/app/auth/`（JWT 登录端点若缺）+ `backend/app/api/v1/` 薄 entry（auth/login 挂载）
  - **文件**（估 ≤18，≤20）：`fe/src/pages/login/*`、`fe/src/lib/api.ts`、`queryKeys`、`mapApiError`、路由守卫、`fe/src/pages/admin/datasources/*`、`fe/src/pages/admin/connectors/*`、`routes.tsx`、侧栏导航、`backend/app/auth/*`（login/JWT 若需）、`api/v1/auth/*`、相关 pytest/fe smoke
  - **不含**：Schema 浏览器（DS-004 · M-FE-2）、Dashboard 出数（M-FE-2）、角色/用户 Admin（M-FE-3）、MySQL/PG 连接器实现（CONN-001/002 · M3）、M13 冻结项
- **不足 5 项原因**：不适用 — plan 当前节满 5 项

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| BOOT-003 | 90.9 | **入选**（plan M-FE-1 #1，登录前置） |
| BOOT-002 | 90.7 | **入选**（plan M-FE-1 #2，API 客户端前置） |
| DS-002 | 92.1 | **入选**（plan M-FE-1 #3，数据源 CRUD 页） |
| DS-003 | 91.8 | **入选**（plan M-FE-1 #4，连通性测试 UI） |
| DS-007 | 91.2 | **入选**（plan M-FE-1 #5，连接器类型只读页） |
| CAT-001 | 90.0 | hub #1 饱和 ≥90；plan 活跃节优先，非 M-FE-1 范围 |
| CAT-002 | 90.0 | hub #2，同上 |
| CONN-004 | 90.0 | hub #3，连接器实现属 M3 非本轮 FE |
| DASH-004 | 90.0 | hub #4，属 M-FE-3 排队 |
| NFR-001 | 90.0 | hub #5，属 M6 排队 |

### STUCK 标注

- 选题卡住计数表**空** — 五入选 ID 无 STUCK 硬标注

## 演化北极星自检

1. **用户感知**：可 `/login` 登录；未登录访问 `/admin/*` 重定向；浏览器完成数据源新建与连通性测试；侧栏「数据源」「连接器」可点击
2. **补缺 or 创造**：补缺（后端已交付 API 的 FE companion）；符合 `goal.md` **G2 多源接入** 与 **P1-SMOKE** 前置
3. **不做代价**：继续 `Bearer dev` 硬编码，无法浏览器验收 M-FE-2 P1 出数闭环
4. **能否批处理更小项**：已按 plan M-FE-1 批处理为 5 项同节（auth 链 + datasources 域）
5. **共几项/文件模块**：5 项；`fe/` + `auth/` + 薄 `api/v1`，估 ≤18 文件、3 模块

---

### 子项 1：BOOT-003 鉴权中间件骨架

- **选题理由**：plan M-FE-1 **#1**；移除 M1 `Bearer dev` 占位，交付正式登录与会话；DS 页与路由守卫依赖本项
- **选题时 PRD 加权总分**：90.9/100（用户价值 **84%** · 完整度 **100%** · 可靠性 **90%** · 架构 **88%** · 测试覆盖 **98%** · 性能 **86%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→浏览器可登录感知）；交互体验（本轮新增 FE `/login` 页后由 N/A 转实评）
- **用户感知**：`/login` 页输入凭证登录；`api.ts` 携带 JWT；未登录 `/admin/*` → 重定向 `/login`；`GET /api/v1/me` 200
- **类型**：补缺（FE companion + 正式 JWT 登录端点）
- **验收标准**（来源 plan §M-FE-1 · BOOT-003）：
  - `POST /api/v1/auth/login` 返回 JWT
  - `/login` 页与路由守卫
  - `fe/src/lib/api.ts` 读 token，移除 `Bearer dev` / `session.ts` 硬编码
  - 未登录访问 `/admin/*` → `/login`；登录后 `GET /api/v1/me` 200

### 子项 2：BOOT-002 React 管理端壳层

- **选题理由**：plan M-FE-1 **#2**；M1 仅静态壳层，本轮补齐 TanStack Query 与统一 API 客户端，供 datasources 页消费
- **选题时 PRD 加权总分**：90.7/100（用户价值 **84%** · 完整度 **96%** · 可靠性 **88%** · 交互体验 **94%** · 架构 **92%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **88%**）
- **主攻薄弱维**：用户价值（84%→业务 API 联调可感知）；安全性（88%→`mapApiError` 脱敏与 401 处理）
- **用户感知**：数据源列表/表单 loading、成功、失败态即时反馈；401 自动跳转登录
- **类型**：补缺（二期联调 API 客户端，plan 明确 M-FE-1 范围）
- **验收标准**（来源 plan §M-FE-1 · BOOT-002）：
  - `@/lib/api.ts` 统一 fetch + Authorization 头
  - `@/lib/queryKeys` 与 TanStack Query provider
  - `mapApiError` 结构化错误展示
  - datasources 页可调用 DS CRUD API

### 子项 3：DS-002 数据源 CRUD API

- **选题理由**：plan M-FE-1 **#3**；后端 CRUD 已实现，缺 `/admin/datasources` 列表/新建/编辑页
- **选题时 PRD 加权总分**：92.1/100（用户价值 **84%** · 完整度 **98%** · 可靠性 **96%** · 架构 **90%** · 测试覆盖 **100%** · 性能 **86%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：交互体验（整维 N/A→本轮 FE 实评）；用户价值（84%→管理员可浏览器建源）
- **用户感知**：侧栏「数据源」可点击；列表/新建/编辑 MySQL 或 PG 数据源
- **类型**：补缺（DS 域 FE companion）
- **验收标准**（来源 plan §M-FE-1 · DS-002）：
  - `/admin/datasources` 列表/新建/编辑路由注册
  - 对接 `GET/POST/PATCH /api/v1/datasources`
  - `fe/src/routes.tsx` 与侧栏「数据」分组对齐 `layout.md` §3

### 子项 4：DS-003 连通性测试

- **选题理由**：plan M-FE-1 **#4**；后端 test API 已交付，缺详情页触发 test 与结构化错误展示
- **选题时 PRD 加权总分**：91.8/100（用户价值 **84%** · 完整度 **94%** · 可靠性 **98%** · 架构 **90%** · 测试覆盖 **100%** · 性能 **86%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：交互体验（N/A→测试 loading/成功/失败态）；完整度（94%→分片未勾浏览器验收）
- **用户感知**：数据源详情页点击「测试连接」，成功或看到可定位错误信息
- **类型**：补缺（DS 域 FE companion）
- **验收标准**（来源 plan §M-FE-1 · DS-003）：
  - 详情页触发 `POST .../datasources/{id}/test`
  - 展示结构化错误（非笼统「操作失败」）
  - 浏览器完成 MySQL 或 PG 连通性测试成功（M-FE-1 验收信号）

### 子项 5：DS-007 已注册类型清单 API

- **选题理由**：plan M-FE-1 **#5**；types API 已交付，缺 `/admin/connectors` 只读页
- **选题时 PRD 加权总分**：91.2/100（用户价值 **84%** · 完整度 **96%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **100%** · 性能 **86%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：交互体验（N/A→只读列表页）；用户价值（84%→管理员可见已注册连接器类型）
- **用户感知**：`/admin/connectors` 展示已注册连接器类型清单
- **类型**：补缺（DS 域 FE companion）
- **验收标准**（来源 plan §M-FE-1 · DS-007）：
  - `/admin/connectors` 路由与只读列表页
  - 对接 types API
  - `routes.tsx` 注册 connectors；侧栏可导航
