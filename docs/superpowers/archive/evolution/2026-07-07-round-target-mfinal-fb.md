# 本轮演化目标（共 4 项）

> 日期：2026-07-07 · 轮次来源：cron G2 · phase G2_DONE  
> 来源：plan §M-FINAL · F-B RBAC 授权与能力导航（当前节；F-A 已收官 2026-07-07）

---

## 选题决策

- **批量主题**：M-FINAL · F-B — RBAC 资源授权 FE + 能力驱动侧栏（原 M-FE-5）收官
- **来源**：`plan.md §M-FINAL · F-B`（当前节，第一个含未完成 `[ ]` 的子批）— 2 行 companion 拆为 4 子交付物
- **合并理由**：AUTH-004（grants UI）与 BOOT-002（capability-nav）同属 FE RBAC/壳层域，共用 `nav-manifest.ts` + `resolveNavGroups` + dev-switch 验收链；F-A manifest 已落地（PR #225），F-B 依赖已满足
- **范围框定**：`fe/src/pages/admin/system/grants/`（新建）、`fe/src/config/nav-manifest.ts`（capability 字段）、`resolve-nav.ts`、`fe/src/routes.tsx`、`AdminLayout` smoke、可选 `docs/ui/layout.md` §3 系统管理分组；估算 12–16 文件、1 模块（`fe/`）
- **不足 5 项原因**：plan F-B 勾选清单仅 2 行（AUTH-004 + BOOT-002 capability）；按 F-A 惯例拆为 4 子项已覆盖 plan 验收信号全文；F-G（CONN-023~027，hub 最低 85.4–85.6）plan 标注「F-A 后可选」但属后端连接器域，与本轮 FE RBAC 分轮更稳妥；F-C（CONN-017~022）同理留 F-B 收官后并行

---

## 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|---------|---------|
| CONN-023 | 85.6 | hub 最低分；F-G P1；与 F-B FE 域异模块，留 F-G 专批 |
| CONN-024 | 85.6 | 同上 |
| CONN-025 | 85.6 | 同上 |
| CONN-017 | 90.4 | F-C 信创首项；后端 dialect，与 F-B 分轮 |
| QUERY-007 | 91.7 | F-D 语义层；依赖 F-A 后但非当前节 |
| DS-007 | 93.8 | F-A 已收官（PR #225） |

---

## 子项 1：AUTH-004 — 资源授权列表页（`/admin/system/grants`）

- **选题理由**：plan F-B 首要交付；后端 `GET /api/v1/resource-grants` 已在 M2 交付，FE 缺 Admin 列表页；G4 可配置权限要求租户管理员可视化管理授权
- **选题时 PRD 加权总分 = 92.1/100**（用户价值84%·完整度98%·可靠性96%·架构健康90%·测试覆盖100%·性能86%·安全性90%）
- **主攻薄弱维**：用户价值（84%）— FE 缺口导致管理员无法浏览器内管理授权；性能（86%）— 列表分页与 TanStack Query 缓存
- **用户感知**：系统管理下出现「资源授权」入口；可按角色/资源类型浏览现有授权绑定
- **类型**：补缺（后端已实现，FE companion 缺口）
- **验收标准**：
  - `/admin/system/grants` 路由注册，manifest 系统管理分组可见（admin 角色）
  - 对接 `GET /api/v1/resource-grants`，列表展示角色×资源类型×资源 ID
  - 空状态与加载/错误态符合设计系统
  - 页面 smoke 或 vitest 覆盖列表渲染

---

## 子项 2：AUTH-004 — 授权绑定与撤销表单

- **选题理由**：列表页 alone 不满足 plan「按角色×资源类型 datasource/dashboard/report 绑定」；须 POST 创建与撤销能力
- **选题时 PRD 加权总分 = 92.1/100**（同上 ID）
- **主攻薄弱维**：用户价值（84%）— 无表单则授权配置仍须 API/脚本；可靠性（96% 已达但须 FE 防重提交）
- **用户感知**：管理员可为角色绑定/解除 datasource、dashboard、report 资源授权
- **类型**：补缺
- **验收标准**：
  - 对接 `POST /api/v1/resource-grants`（及既有撤销/删除契约）
  - 表单校验：角色必选、资源类型枚举、资源 ID 必填
  - 高危操作有确认；成功后列表刷新
  - 越权或未登录重定向 `/login`

---

## 子项 3：BOOT-002 — manifest capability 绑定与 resolveNavGroups 过滤

- **选题理由**：plan F-B 第二行；替代 `canManagePlatform` / `canEditDashboards` 硬编码三档 nav；F-A manifest 已建，本轮扩展 `capability` 字段并过滤
- **选题时 PRD 加权总分 = 95.3/100**（用户价值95%·完整度100%·可靠性94%·交互体验96%·架构健康96%·测试覆盖100%·性能88%·安全性92%）
- **主攻薄弱维**：性能（88%）— capability 解析不引入多余 re-render；交互体验（96% 已达但本子项为关键路径）
- **用户感知**：dev-switch 切换演示用户后，侧栏仅显示当前角色能力允许的分组；自定义 role code 在能力满足时可见对应菜单
- **类型**：补缺（F-A manifest 后的能力过滤层）
- **验收标准**：
  - `nav-manifest.ts` 项含 `capability`（或等价键）声明
  - `resolveNavGroups(role, capabilities)` 按能力过滤，移除硬编码三档分支
  - `resolve-nav.test.ts` 补充 capability 过滤用例（≥3 场景：admin/analyst/viewer 或自定义 role）
  - 未授权分组侧栏不可见

---

## 子项 4：BOOT-002 — grants 路由注册与 dev-switch 联动 smoke

- **选题理由**：闭环 plan 验收信号「未授权资源列表与侧栏不可见」；manifest 注册 grants 路由 + 端到端 smoke
- **选题时 PRD 加权总分 = 95.3/100**（同上 ID）
- **主攻薄弱维**：测试覆盖（100% 已达但本子项须补 E2E smoke）；性能（88%）
- **用户感知**：从侧栏可点击进入资源授权页；切换角色后菜单与授权页可达性一致
- **类型**：补缺（集成验收 companion）
- **验收标准**：
  - manifest 系统管理含 grants 子项，链接 `/admin/system/grants`
  - `AdminLayout.smoke.test.tsx` 覆盖 capability 驱动菜单 + grants 入口
  - `routes.smoke.test.tsx` grants 路由可达、无死链
  - dev-switch 演示：viewer 不见系统管理 grants；admin 可见

---

## F-B 整体验收信号

```
resolve-nav.test.ts         — capability 过滤 ≥3 场景
AdminLayout.smoke.test.tsx  — 能力驱动侧栏 + grants 入口
routes.smoke.test.tsx       — /admin/system/grants 可达
GrantsPage                  — 列表 + 绑定/撤销表单对接 resource-grants API
```

> **下轮建议**：F-B 收官后 → F-C（CONN-017~022 信创连接器 companion，可并行）或 F-G（CONN-023~027，hub 最低 85.4–85.6，P1 API/文件源优先）。
