# DeepTalk × VitalSpan 产品对接契约（工作区插件形态）

> **产品定论（2026-08）**：与 DeepTalk 的最终对接形态是 **先安装 VitalSpan 插件 → 新建特殊工作区 → 工作区内是业务页面**；**不是**向 DeepTalk 源码仓同步 `integrations/vitalspan/` 作为交付路径。  
> 实施 SOP（Task 1–9）：[`SPECIAL-WORKSPACE-PLUGIN-TASK.md`](./SPECIAL-WORKSPACE-PLUGIN-TASK.md)  
> BI 交付铁律不变：[../IRON-RULES.md](../IRON-RULES.md) · 平台验收仍在 **5173**

---

## 1. 三层模型（产品最终形态）

| 层 | 载体 | 职责 |
|----|------|------|
| **DeepTalk 插件** | `deeptalk-plugins/plugins/vitalspan/`（安装 zip） | `plugin.json`：`components.tools`（Agent）、`workspaceTemplates`、`views`、`execTools`（按需） |
| **特殊工作区** | 用户「新建工作区」选 VitalSpan 模板 | 左侧导航、`instanceConfig` 绑定、iframe 全页视图（`fill`） |
| **VitalSpan 平台** | `:8000` API · `:5173` 管理面 · DB | 组件库、大屏、customViz 渲染、preflight、鉴权；**wf2/wf3 完成证据不变** |

```
用户安装 vitalspan 插件
    → 新建「VitalSpan BI」特殊工作区（向导写入 instanceConfig）
    → 工作区视图：连接状态 / health / **外链跳转 5173**（iframe 内仅 pluginExec 取数，**不**嵌 5173 编辑器）
    → Agent 聊天仍可调 components.tools 做 wf2/wf3
    → 正式 BI 编辑与验收：5173（artifactId / dashboardId）
```

**禁止**再向客户/内部描述「对接 = 改 DeepTalk 源码 + `integrations/vitalspan/executor/`」（已移除 legacy executor）。

### 1.1 壳 iframe 与 VitalSpan「不做 BI 沙箱」（必读）

| 层 | 是否 iframe | 与 gis/5173 铁律 |
|----|-------------|------------------|
| **DeepTalk 插件视图**（home / 向导） | 是（宿主 CSP 容器） | **不冲突** — 不是 BI 引擎 |
| **VitalSpan 5173 管理面 / 大屏 / 样式编辑** | **否**（外链或独立窗口） | 真 UI 仍在 5173 |
| **gis-map / GeoLibre 整应用** | **禁止**嵌入 DeepTalk iframe | 与 ADR-12 一致 |
| **customViz 正式渲染** | 在 5173 父页 mount | 不在 DeepTalk iframe 内交付 |

Task 文档中的「沙箱内取数」= **DeepTalk 插件视图 CSP**（`connect-src 'none'` → `pluginExec`），**不是**把 VitalSpan BI 放进 sandbox。

---

## 2. 与旧契约的差异

| 项 | 旧描述（已降级） | **产品最终形态** |
|----|------------------|------------------|
| 安装物 | sync 到 `deeptalk/integrations/vitalspan/` | **插件目录**（根上即 `plugin.json`） |
| 用户入口 | 主要靠聊天 + Agent 工具 | **工作区导航** + 聊天 Agent **并存** |
| 环境配置 | 全局 `config.yaml` / env | **每工作区** `instanceConfig.{domain}`（向导 `workspaceSetup.complete`） |
| 视图取数 | 工具进程 HTTP（无 iframe 限制） | iframe **禁止 fetch**；外连 VitalSpan 走 **`pluginExec` / execTools** |
| 源码改动 | `sync-vs-ai-spec-to-deeptalk-repo.ps1` | **只改插件仓**；**不改** DeepTalk 引擎 |

### 仍有效（不变）

- ② **`artifactId`**、③ **`dashboardId`** 为完成证据；无 uuid 不算交付
- bundle：`host.vsCv.mount` + `(p && p.style) || {}`
- 5173 为 BI 真 UI；不在 iframe 重做完整编辑器
- `components.tools` 与 `components.execTools` **分工**：前者给 Agent，后者给工作区 iframe

### 开发备用（非产品交付描述）

以下仅用于 VitalSpan 仓内联调、CI、无 DeepTalk 宿主时的脚本验真，**不得**写进对外产品对接说明：

- `docs/api/vs-ai-spec/tools/*.py` · `deeptalk-product/lib/`（gate/route CI）
- `scripts/sync-vs-ai-spec-to-deeptalk-repo.ps1`（可选 sync 到 integrations/vitalspan）

---

## 3. 插件仓应交付什么（SOP 全量对齐 · v0.3.0）

**已交付（2026-08-25）**：**v0.3.0** — Task 7–8 对齐通用 SOP（`resources` + `loadInstance`）；wf2/wf3 Agent 工具不变。见 [Phase 4 E2E](../../../reviews/grounded/2026-08-25-deeptalk-vitalspan-phase4-e2e.md)

| 组件 | 状态 | 说明 |
|------|------|------|
| `components.tools` | ✅ v0.3.0 | Agent wf2/wf3 ×14（**不变**） |
| `workspace-templates/vitalspan.bi.default` | ✅ v0.3.0 | 「新建工作区」列表 |
| `views/home.js` | ✅ v0.3.0 | 绑定摘要 · health · 页内→resources · 外链 5173 |
| `views/resources.js` | ✅ v0.3.0 | 资源目录 · `loadInstance` · 深链 `?id=` |
| `views/workspace-setup.js` | ✅ v0.3.0 | 创建向导 |
| `execTools` `vitalspan_health` | ✅ v0.3.0 | iframe 内 health（无 fetch） |
| `execTools` `loadInstance` | ✅ v0.3.0 | iframe 内只读 list（artifacts + dashboards） |
| `scripts/assemble-plugin.mjs` | ✅ v0.3.0 | 与 `release.mjs` 一致 |
| iframe 内 compose/upload | ⏸ 仍用 Agent tools | **不改** wf2/wf3 工具链 |

**生产 zip**：`deeptalk-plugins/release/vitalspan-v0.3.0.zip`

---

## 4. instanceConfig 约定（VitalSpan 域 · Task 1 已冻结）

绑定权威：`instanceConfig.plugin` + `instanceConfig.vitalspan`。

| 键 | 冻结值 |
|----|--------|
| `plugin.id` | `vitalspan` |
| `templateId` | `vitalspan.bi.default` |
| `instanceConfig` 域键 | `vitalspan` |

```json
{
  "plugin": {
    "id": "vitalspan",
    "version": "0.3.0",
    "templateId": "vitalspan.bi.default",
    "templateVersion": "1.0.0"
  },
  "vitalspan": {
    "mode": "demo",
    "apiBaseUrl": "http://127.0.0.1:8000/api/v1",
    "feAdminUrl": "http://127.0.0.1:5173/admin"
  }
}
```

- **模板 JSON 禁止**写实例 ID、token、内网地址
- 凭据不进 Agent 工具参数；execTools worker 读 env（见 Task 8）
- 视图未绑定：横幅 + `reason`，**禁止**静默演示数据冒充已绑定

### 4.1 5173 管理面 IA 对齐（`feAdminUrl`）

真源：[`docs/ui/layout.md`](../../../ui/layout.md) · 运行态 `http://127.0.0.1:5173/admin`。

| 侧栏 | 菜单 | 路径 | DeepTalk wf |
|------|------|------|-------------|
| 分析 | **组件库** | `/admin/viz-components` | **②** publish 后验收 |
| 分析 | 仪表板 | `/admin/dashboards` | **③** dashboard |
| 分析 | 数据大屏 | `/admin/data-screens` | **③** data-screen |
| 数据准备 | 数据连接 | `/admin/datasources` | 平台配置（非 wf 主路径） |

- `feAdminUrl` 填 **`http://127.0.0.1:5173/admin`**（含 `/admin` 前缀）；打开后默认进仪表板列表，**wf2 须再进组件库**。
- 插件 home / resources 提供 wf2/wf3 **5173 外链**与页内 **resources 深链**（见 `home-entry.ts` · `resources-entry.ts`）。
- 评审：[5173 对齐记录](../../../reviews/grounded/2026-08-25-deeptalk-vitalspan-5173-admin-alignment.md)

---

## 5. 轨道决策（Phase 0 · 已闭合）

| 字段 | 值 |
|------|-----|
| **决策** | **SOP 全量对齐**（Task 7–8 满配；wf2/wf3 Agent 工具不变） |
| **日期** | 2026-08-25（自 B 轻量工作区升格） |
| **范围** | 模板 + 向导 + home + **resources** + `vitalspan_health` + **`loadInstance`** + 外链 5173 |
| **不含** | iframe 内 compose/upload/publish（仍 Agent tools）；iframe 内嵌 5173 / gis |
| **下一步** | ✅ v0.3.0 已交付 · wf2 金样对话回归按需 |

| 选项 | 范围 | 决策 |
|------|------|------|
| A 维持现状 | 仅 Agent 工具 + 5173 | 否 |
| B 轻量工作区 | 仅 home + health | 否（已升格） |
| **SOP 全量** | home + resources + health + loadInstance + navigateWorkspace 深链 | **是** |
| C 完整 BI 工作区 | iframe 内 compose/upload/delete | 否（仍 Agent tools） |

视图注册名：`vitalspan:home` · `vitalspan:resources` · `vitalspan:workspace-setup` · execTools `vitalspan_health` · `loadInstance`。

---

## 6. 文档索引

| 文档 | 用途 |
|------|------|
| 本文 | **产品对接形态**（工作区 + 插件） |
| [SPECIAL-WORKSPACE-PLUGIN-TASK.md](./SPECIAL-WORKSPACE-PLUGIN-TASK.md) | 插件仓实施清单 Task 1–9 |
| [../IRON-RULES.md](../IRON-RULES.md) | wf2/wf3、uuid、bundle 铁律 |
| [AGENT-SYSTEM-PROMPT.md](./AGENT-SYSTEM-PROMPT.md) | Agent 工具与禁止说法 |
| [agent-tools.schema.json](./agent-tools.schema.json) | `components.tools` 注册表 |
| DeepTalk 宿主契约 | `plugin-views.md` · `plugin-exec-bridge.md` · `wizard-plugin-step-contract.md`（在 DeepTalk 仓核对） |
