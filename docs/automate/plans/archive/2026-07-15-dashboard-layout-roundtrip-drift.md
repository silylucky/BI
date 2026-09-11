# 看板布局持久化往返一致性（Layout Round-Trip Fidelity）

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
日期：2026-07-15  
前置：`docs/bugs/BUG-6_dashboard-layout-roundtrip-drift_2026-07-15.md`

---

## 0. 需求契约

| 字段 | 值 |
|------|-----|
| request | 保存后布局不变；退出重进与最后一次保存一致 |
| type | bug |
| goal | v2 像素画布 layout 持久化 WYSIWYG；save → reload 坐标 idempotent |
| scope_include | `dashboardCanvasMode.ts`、`useDashboardCanvasState.ts`、`DashboardEditPage.tsx`、`collisionLayout.ts`、相关 vitest |
| scope_exclude | 后端 schema 变更；v1 栅格编辑器行为变更；新增「整理布局」产品 UI（P2 可选） |
| acceptance | §4 单测绿 + §5 手测清单 + BUG-6 RC-1/2/3 标记 fixed |
| risk_level | low |
| autonomy_policy | strict_plan_match |

---

## 1. 方案概述

**核心原则**：持久化布局 = 用户所见坐标；load/save/fingerprint 共用一条 **canonical pipeline**，禁止在 hydrate 时隐式 `packPixelLayoutSeamless`。

1. 抽取 `canonicalizeLayoutForPersistence(layout, styleConfig)`（或在现有 `buildDashboardLayoutForSave` 上扩展文档契约），作为 save、fingerprint、post-save hydrate 的唯一入口。
2. `resetLayout` 增加 `options?: { repack?: boolean }`，默认 `repack: false`；仅当显式请求时才 pack。
3. `DashboardEditPage.load()` 改为 `resetLayout(prepared.layout)`，widgets/fingerprint 同源。
4. `dashboardPersistFingerprint` 删除 pack 分支，直接 `JSON.stringify(buildDashboardLayoutForSave(...))`。
5. 补充 round-trip 单测：非紧凑布局 save → hydrate 后 x/y/width/height 不变。

---

## 2. 关键决策

| 决策 | 选择 | 备选 | 理由 |
|------|------|------|------|
| hydrate 是否 auto-pack | **否** | 保持现状 | pack 是破坏性重排，与 WYSIWYG 矛盾 |
| 碰撞处理 | 保留拖拽时 `resolvePixelCollisions` | 全面禁用 pack | 编辑态推挤是交互需求，与持久化 hydrate 分离 |
| canonical 函数 | 复用 `buildDashboardLayoutForSave` | 新建第三函数 | 已含 strip v1 + fitCanvasHeight，最小 diff |
| v1 布局 | prepare 迁移后统一走 v2 hydrate | 分支维持 | 减少双轨 |

---

## 3. 非目标

- 不保证重叠布局在 DB 中自动消除（用户可后续加「整理布局」）
- 不改后端 layout JSON schema
- 不在本 plan 内做全量 `dashboard.smoke.test.tsx` OOM 治理

---

## 4. 任务清单

| ID | 文件 | 说明 | 状态 |
|----|------|------|------|
| T1 | `dashboardCanvasMode.ts` | `dashboardPersistFingerprint` 移除 pack；导出/文档化 canonical 契约 | done |
| T2 | `useDashboardCanvasState.ts` | `resetLayout` 默认不 pack；可选 `repack: true` 供未来 UI | done |
| T3 | `DashboardEditPage.tsx` | `load()` → `resetLayout(prepared.layout)`；save 后 hydrate 不触发 pack | done |
| T4 | `dashboardCanvasMode.test.ts` | round-trip：稀疏坐标 layout save 后几何不变；fingerprint === stringify(save) | done |
| T5 | `collisionLayout.test.ts` | 断言 pack **会**改变非紧凑布局（文档化为何不能 auto-pack） | done |
| T6 | bug-case + BUG-6 | 登记 case；修复后更新 BUG-6 根因状态 | done |

---

## 5. 整体验证方案

```bash
cd fe && npx vitest run \
  src/components/dashboard/dashboardCanvasMode.test.ts \
  src/components/dashboard/pixelCanvas/collisionLayout.test.ts \
  src/components/dashboard/dashboardFilterUtils.test.ts

cd fe && npx tsc --noEmit
```

### 手测清单

1. 打开 v2 看板编辑页，将两个 chart 拖到画布右下区域（明显非紧凑）
2. 保存 → **组件不应跳动**
3. F5 刷新 → 位置与步骤 2 一致
4. 退出到列表再进入编辑 → 与步骤 2 一致
5. 保存按钮不应在保存成功后仍显示「未保存」（fingerprint 一致）

---

## 6. 八维度自审

| 维度 | 结论 |
|------|------|
| 范围 | ✅ 仅 fe dashboard 持久化链 |
| 依赖 | ✅ 无后端/API 变更 |
| 风险 | ✅ 可逆；最坏回滚 resetLayout pack 分支 |
| 测试 | ✅ round-trip 单测覆盖 RC-1/3 |
| 文档 | ✅ BUG-6 + bug-case |
| 性能 | ✅ 移除多余 pack，略优 |
| 兼容 | ✅ v1 经 prepare 迁移不变 |
| 回退 | ✅ 单 PR revert |

**plan-review state: PASS**

---

## 7. 风险与回退

- **风险**：历史 DB 中已有重叠 widget，禁用 pack 后重叠可见 → 可接受（编辑态仍有 collision resolve）
- **回退**：恢复 `resetLayout` pack 块（不推荐）
