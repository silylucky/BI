# 本轮演化目标（共 3 项）

> 日期：2026-07-07 · 轮次来源：cron 12:00 UTC · phase G2_DONE  
> 来源：plan §M-FINAL · F-A 壳层 IA 与里程碑导航（当前节全量收官）

---

## 选题决策

- **批量主题**：M-FINAL · F-A — 壳层 IA 与里程碑导航（原 M-FE-4）全量收官
- **来源**：`plan.md §M-FINAL · F-A`（当前节，第一个含未完成 `[ ]` 的子批）— 全量 3 项一次收官
- **合并理由**：F-A 3 个子项属同一 FE 壳层域（nav manifest + connector收拢 + 里程碑可见性），共用 `nav-manifest.ts` 核心文件，分拆会造成中间态破坏；`resolve-nav.ts` 需一次性废弃三份平行 nav，不宜跨轮
- **范围框定**：`fe/src/config/nav-manifest.ts`（新建）、`fe/src/layouts/AdminLayout.tsx`、`fe/src/routes.tsx`、`resolve-nav.ts`（废弃）及对应 smoke/unit 测试、`docs/ui/layout.md §3/§6` 同步；估算 10–16 文件
- **不足 5 项原因**：F-A 子批 plan 恰好 3 项，且 plan 明确「首轮建议 F-A 全量 3 项」；F-B（AUTH-004/ability-nav）依赖 manifest 完成后再做；F-C 信创连接器（纯后端）与 FE 壳层分轮更稳妥；F-G（CONN-023~027）plan 标注「F-A 收官后、F-F 前可选」，待本轮完成后再入队

---

## 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|---------|---------|
| CONN-023 | 85.6 | plan 约束「F-A 收官后 F-F 前可选」；本轮 F-A 优先 |
| CONN-024 | 85.6 | 同上 |
| CONN-025 | 85.6 | 同上 |
| CONN-026 | 85.4 | 同上 |
| CONN-027 | 85.4 | 同上 |
| AUTH-004（F-B） | 92.1 | 依赖 F-A `nav-manifest` 完成后再做 |
| BOOT-002-capability-nav（F-B） | 94.1 | 依赖 F-A manifest，不合并 |
| CONN-017（F-C） | 90.4 | 后端连接器域，与 FE 壳层分轮；F-C 6 项加入将超 20 文件上限 |

---

## 子项 1：BOOT-002 — nav-manifest + resolveNavGroups（壳层 IA manifest 骨架）

- **选题理由**：`resolve-nav.ts` 当前硬编码三档 nav（admin/analyst/user），三份平行 nav 拷贝长期维护成本高；F-A 首要任务是建立 `nav-manifest.ts` 单一真理源并废弃旧三拷贝；F-B ability-nav 和 F-D 语义层 FE 均依赖此 manifest
- **选题时 PRD 加权总分 = 94.1/100**（用户价值92%·完整度100%·可靠性92%·交互体验94%·架构健康94%·测试覆盖100%·性能88%·安全性92%）
- **主攻薄弱维**：性能（88%）— nav 初始化路径、`resolveNavGroups` 计算复杂度；架构健康（94%）— 废弃多拷贝漂移风险
- **用户感知**：Admin 侧栏「报表」变为父菜单（预制报表/模板/调度子项）；三档角色侧栏由 manifest 统一派生，减少因拷贝不同步导致的菜单错乱
- **类型**：补缺（结构性缺口，非新功能）
- **验收标准**：
  - `fe/src/config/nav-manifest.ts` 存在，`resolveNavGroups(role)` 派生三档侧栏
  - `resolve-nav.test.ts` 覆盖 admin/analyst/viewer 三档角色
  - 「报表」菜单含 subItems：预制报表 / 模板 / 调度
  - 旧 `admin-nav.tsx`/`analyst-nav.tsx`/`user-nav.tsx` 已废弃或移除
  - `AdminLayout.smoke.test.tsx` PASS

---

## 子项 2：DS-007 — 连接器收拢为「数据」分组子项

- **选题理由**：F-A manifest 建立后，连接器页面（`/admin/connectors`）需接入 manifest 的「数据」分组；当前连接器页独立于数据源分组，IA 结构不一致
- **选题时 PRD 加权总分 = 91.9/100**（用户价值88%·完整度100%·可靠性94%·交互体验86%·架构健康90%·测试覆盖100%·性能86%·安全性88%）
- **主攻薄弱维**：交互体验（86%）— 连接器入口在导航中的可达性与可见性；性能（86%）— 路由懒加载
- **用户感知**：侧栏「数据」分组下可见「连接管理」与「连接器类型」子项，无需记忆独立路由
- **类型**：补缺（IA 结构补齐）
- **验收标准**：
  - manifest 「数据」分组含 subItems：`连接管理（/admin/datasources）`、`连接器类型（/admin/connectors）`
  - `ConnectorsPage` 保留只读目录功能不退化
  - `routes.smoke.test.tsx` 覆盖 `/admin/connectors` 路由可达
  - `AdminLayout.smoke.test.tsx` 数据分组子项可见

---

## 子项 3：BOOT-002 — layout.md §6 里程碑可见性过滤

- **选题理由**：manifest 建立后须实现可见性矩阵：viewer/analyst 过滤未到期里程碑菜单项，admin 对四期未交付项标「预览」，禁止死链；同步 `docs/ui/layout.md §3/§6` 分组表
- **选题时 PRD 加权总分 = 94.1/100**（同 BOOT-002，同一 PRD 分片下第二项子任务）
- **主攻薄弱维**：性能（88%）— 可见性矩阵计算不引入额外 re-render；测试覆盖（100% 已达但本子项需补）
- **用户感知**：viewer/analyst 不会看到未开放的四期功能入口（无死链）；admin 可见「预览」标识，知晓哪些是待上线功能
- **类型**：补缺（路由守卫与 manifest 可见性矩阵缺失）
- **验收标准**：
  - `nav-manifest.ts` 项含可选 `milestone` 字段与 `preview` 标志
  - `resolveNavGroups(role, capabilities?)` 过滤 viewer/analyst 未开放项
  - admin 侧栏对未交付项显示「预览」badge
  - `resolve-nav.test.ts` 补充里程碑过滤场景（≥2 用例）
  - `docs/ui/layout.md §3/§6` 分组表与 manifest 定义一致
  - `routes.smoke.test.tsx` 无死链断言 PASS

---

## F-A 整体验收信号

```
resolve-nav.test.ts         — 三档角色 + 里程碑过滤
AdminLayout.smoke.test.tsx  — 报表 subItems + 数据分组 + 预览 badge
routes.smoke.test.tsx       — /admin/connectors 可达 + 无死链
```

> **下轮建议**：F-A 收官后 → F-B（AUTH-004 资源授权 UI + BOOT-002 ability-nav），同时 F-G（CONN-023~027，85.4–85.6，plan 约束「F-A 后 F-F 前」）可作为 F-B 后续或并行轮次入选候选。
