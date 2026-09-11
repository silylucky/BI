# 本轮演化目标（共 3 项）

> 日期：2026-07-08 · 轮次来源：cron G2 · phase G2_DONE  
> 来源：plan §M-PRODUCT · F-B DataEase 数据源分类（当前活跃节；F-A 余 CONN-023/024 留下轮）

---

## 本轮演化目标（共 3 项）

### 选题决策

- **批量主题**：M-PRODUCT · F-B — DataEase 五类数据源展示 taxonomy + 连接器目录/建源向导分组（DS-007 companion 全量）
- **来源**：`docs/automate/plan.md` §**M-PRODUCT · F-B**（plan v2.6.0 首轮建议 F-B 全量；饱和熔断已跳过——当前节含 33 条 companion `[ ]`）；`prd.md` hub v1.2.109 · `evolution-state.md` 待办池空 · `git log -5` b3cb415（CI fix）+ 8f359f4（#245 merge）+ b2a14ea（上轮 SATURATED）+ 5d4912a（G1 audit）+ a3daf40（plan 同步）
- **合并理由**：plan F-B 勾选清单 3 行均为 DS-007 companion 子交付，共用 `displayGroup`/`categoryLabel` 契约与 ConnectorsPage ↔ DatasourceFormPage 选型链路；引擎 `category` 不改，仅 FE 展示层 + types API 扩展
- **范围框定**：`backend/app/datasources/` types 导出（`displayGroup`/`categoryLabel`）、`GET /api/v1/datasources/types` 契约；`fe/src/pages/admin/connectors/ConnectorsPage.tsx`、`fe/src/pages/admin/datasources/DatasourceFormPage.tsx`、连接器类型映射模块（新建或扩展现有 constants）、`docs/ui/layout.md` §3 数据分组文案；估算 **≤12 文件、≤2 模块**（`datasources` 域 + `fe/` 数据源页）；**禁止**改方言注册/连接器执行链
- **不足 5 项原因**：plan F-B 勾选清单恰 **3 行** companion 验收（首轮 F-B 全量对焦）；F-A 余 CONN-023/024 表单与 F-C IA 收敛留后续轮次，避免单轮跨子批超 20 文件上限；hub 薄弱项 Top5 均 ≥90 但 plan 有未完成项故非饱和态

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| CONN-023 | 92.4 | F-A 收尾项；REST API 专用表单项，留 F-A 专轮与 F-B 解耦 |
| CONN-024 | 92.4 | F-A 收尾项；Excel/CSV 上传 companion，留 F-A 专轮 |
| BOOT-002 | 95.9 | F-C IA 收敛；依赖 F-B 分类文案后再瘦身侧栏 |
| VIZ-002 | 93.2 | F-C 图表探索降权；非当前节 |
| DESIGN-004 | 92.8 | F-C 设计器治理分组；非当前节 |
| CONN-027 | 90.1 | hub 最低分；M-FINAL F-G 已勾；无 plan `[ ]` 行 |
| API-002 | 90.2 | hub Top2；合同已实现，无 M-PRODUCT companion 行 |

### STUCK 标注

- 选题卡住计数表**空** — 无 STUCK 标注项

---

## 子项 1：DS-007 — `displayGroup` 展示 taxonomy（oltp · olap · warehouse · file · api · extension）

- **选题理由**：plan F-B 第一行；对标 DataEase 五类（OLTP/OLAP/数仓库湖/文件/API）+ 扩展类归「更多」；为 ConnectorsPage 与 DatasourceFormPage 提供统一分组键
- **选题时 PRD 加权总分 = 93.8/100**（用户价值92%·完整度100%·可靠性94%·交互体验94%·架构健康94%·测试覆盖100%·性能86%·安全性88%）
- **主攻薄弱维**：性能（86%）— types 列表缓存与分组元数据不阻塞首屏；交互体验（94%）— 中文 `categoryLabel` 可读性
- **用户感知**：连接器类型 API 返回可分组的中文标签；后续页面可按类筛选，不再平铺 22+ 型
- **类型**：补缺（后端 types API 已有，缺 FE 展示 taxonomy companion）
- **验收标准**：
  - `GET /api/v1/datasources/types` 响应含 `displayGroup`（枚举：oltp/olap/warehouse/file/api/extension）与 `categoryLabel`（中文）
  - 引擎内部 `category` 字段不变；扩展类（时序/搜索/文档等）映射 `extension`
  - 后端 pytest 覆盖 types 响应 schema 与分组映射（≥1 用例/组）
  - `docs/api/README.md` 登记字段扩展（若契约变更）

---

## 子项 2：DS-007 — `ConnectorsPage` 按类分组 Tab/手风琴 + 类型图标

- **选题理由**：plan F-B 第二行；用户浏览连接器目录时按 DataEase 五类分组，降低认知负担
- **选题时 PRD 加权总分 = 93.8/100**（同上 ID）
- **主攻薄弱维**：交互体验（94%）— Tab/手风琴切换流畅、空组隐藏；用户价值（92%）— 目录可发现性对标 DE
- **用户感知**：`/admin/connectors` 按「关系型/OLAP/数仓库湖/文件/API/更多」分组展示，各类型有图标
- **类型**：补缺（只读目录页 companion 深化）
- **验收标准**：
  - `ConnectorsPage` 消费子项 1 的 `displayGroup`/`categoryLabel` 渲染分组 UI（Tab 或手风琴二选一，P1 设计定）
  - 每组内列表连接器类型名称 + 图标（可用现有 icon 映射或占位一致风格）
  - vitest smoke：至少 2 组 mock types 渲染断言
  - `pnpm run check:design` 通过

---

## 子项 3：DS-007 — `DatasourceFormPage` 先选大类卡片再选具体库

- **选题理由**：plan F-B 第三行；对标 DataEase「新建数据源」向导——先选大类再选具体引擎
- **选题时 PRD 加权总分 = 93.8/100**（同上 ID）
- **主攻薄弱维**：交互体验（94%）— 两步向导减少表单项噪音；性能（86%）— 大类卡片懒加载具体类型列表
- **用户感知**：新建数据源时先看到五类卡片（含中文说明），点选后再进入对应连接器表单
- **类型**：补缺（建源 FE companion；与 CONN-023/024 专用字段正交，可后续叠加）
- **验收标准**：
  - `DatasourceFormPage`（新建路径）增加 Step 1 大类卡片 + Step 2 具体类型选择 + Step 3 既有表单
  - 编辑已有数据源跳过 Step 1/2，直达表单
  - 手动或 smoke：选 OLTP → MySQL → 完成建源表单可见
  - vitest 覆盖向导状态机（新建 vs 编辑）≥2 场景

---

## 演化北极星自检

1. **用户感知**：新建数据源与连接器目录均按 DataEase 五类中文分组，成品感显著提升。
2. **补缺 or 创造**：补缺 — DS-007 合同已实现，companion 展示层未达标。
3. **不做代价**：用户仍面对 22+ 型平铺列表，与 DataEase 走查差距显性。
4. **能否批处理更小项**：已按 plan 3 行拆为最小可交付子项；再拆将违反 F-B 全量验收信号。
5. **共几项/文件/模块**：3 项；≤12 文件；2 模块（`datasources` + `fe/` 数据源页）。
