# 5173 管理面对齐 — DeepTalk × VitalSpan

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-25 |
| 真源 | 运行态 `http://127.0.0.1:5173/admin` · IA [`docs/ui/layout.md`](../../ui/layout.md) · [`fe/src/config/nav-manifest.tsx`](../../../fe/src/config/nav-manifest.tsx) |
| 绑定 | `instanceConfig.vitalspan.feAdminUrl` 默认 `http://127.0.0.1:5173/admin` |

---

## 1. 5173 实际壳层（与你截图一致）

| 侧栏分组 | 菜单项 | 路径 | wf 关联 |
|----------|--------|------|---------|
| **数据准备** | 数据连接 | `/admin/datasources` | 数据源（非 DeepTalk 主路径） |
| | 数据集 | `/admin/datasets` | M13 |
| **分析** | 仪表板 | `/admin/dashboards` | **wf3** 编辑/验收 |
| | 数据大屏 | `/admin/data-screens` | **wf3** 大屏 |
| | 可视化模板 | `/admin/viz-templates` | 布局模板 Hub |
| | **组件库** | `/admin/viz-components` | **wf2** publish 后在此可见 |
| **报表** | 报表中心 | `/admin/reports/center` | 报表域（非 wf2/wf3） |

**入口行为**：访问 `/admin` → **重定向** `/admin/dashboards`（不是组件库）。

---

## 2. DeepTalk 集成文档 vs 5173 差异

| # | 原说法（文档/插件） | 5173 实际 | 严重度 | 处理 |
|---|---------------------|-----------|--------|------|
| D1 | E2E §4「**图表盘 → 自定义**」 | 侧栏 **分析 → 组件库** | 高 | ✅ 已改 E2E / 手测指南 |
| D2 | 插件 home 仅链 `feAdminUrl`（/admin） | 打开后落到 **仪表板列表** | 中 | ✅ home 增加 wf2/wf3 深链 |
| D3 | 「检测 API 连接」 | **不在 5173**；在 DeepTalk **VitalSpan** 导航 | 高（已踩坑） | 手测指南已写清 |
| D4 | 契约写「5173 管理面」笼统 | 多分组 IA；wf2/wf3 入口不同 | 低 | 契约补 IA 表 |
| D5 | `vs-ai-spec` 全局仍写「图表盘自定义」 | UI 已统一 **组件库** Hub | 低 | 集成层跟 layout；全局术语另开 docs  sweep |
| D6 | wf3 compose 后验收 | 仪表板 `/admin/dashboards/:id/edit` 或大屏 `/admin/data-screens/:id/edit` | 中 | E2E §4 补路径 |

---

## 3. 对齐后的绑定约定

```json
{
  "vitalspan": {
    "mode": "demo",
    "apiBaseUrl": "http://127.0.0.1:8000/api/v1",
    "feAdminUrl": "http://127.0.0.1:5173/admin"
  }
}
```

| 用途 | 由 `feAdminUrl` 派生 | 示例 |
|------|----------------------|------|
| 管理面入口 | `feAdminUrl` | `…/admin` → 重定向 dashboards |
| **wf2 组件库** | `{base}/viz-components` | `…/admin/viz-components` |
| **wf3 仪表板** | `{base}/dashboards` | `…/admin/dashboards` |
| **wf3 大屏** | `{base}/data-screens` | `…/admin/data-screens` |

`base` = `feAdminUrl` 去尾斜杠（插件 home 已实现深链按钮）。

---

## 4. 两个界面职责（不变）

| 界面 | 做什么 | 不做什么 |
|------|--------|----------|
| **DeepTalk · VitalSpan 导航** | 绑环境 · health · 跳 5173 深链 | wf2 publish · 大屏编辑 |
| **5173 /admin** | 组件库 · 仪表板/大屏编辑 · 样式面板 | API health 按钮 |

---

## 5. 关联

- [Phase 4 手测](./2026-08-25-deeptalk-vitalspan-phase4-handtest.md)
- [E2E-CHECKLIST §4](../../api/vs-ai-spec/deeptalk-product/E2E-CHECKLIST.md)
- [WORKSPACE-PLUGIN-CONTRACT §4.1](../../api/vs-ai-spec/deeptalk-product/WORKSPACE-PLUGIN-CONTRACT.md)
