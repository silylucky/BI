# VitalSpan 插件预检双轨说明

> Agent 工具（Node）与工作区 iframe（pluginExec）的预检/发布能力分层。  
> 产品形态：[WORKSPACE-PLUGIN-CONTRACT.md](./WORKSPACE-PLUGIN-CONTRACT.md)

## 两档预检

| 档位 | 触发条件 | 能力 | 输出 |
|------|----------|------|------|
| **轻量（默认）** | 未设 `VITALSPAN_ROOT` · 无 Python CLI | 插件 `preflight.ts`：manifest · mount · 禁止模式 · 体积 | `preflight ok (plugin local)`；可能 `[info]` 提示全量 |
| **全量** | `VITALSPAN_ROOT` 或探测到 `tools/publish-ai-viz-artifact.py` | Python 与 API 对齐的 styleCompliance · fieldSlots 等 | `styleComplianceTier=full` · warnings=0 |

**结论（当前实现，非缺陷）**：

- 装插件 **即可** wf2/wf3（Node fetch 入库/compose）— 不强制 VitalSpan 源码仓
- **金样 scaffold**（从 `examples/` 拷贝模板）与 **full tier 验收** 仍建议设 `vitalspan.vitalspan_root` 或 sync vs-ai-spec 到工作区
- **短期保留** `spawnSync python` 回退；**长期可选** 将全量 lint 移植到 TS（降低 Python 依赖）

## 配置优先级（Agent tools · loadConfig）

```
环境变量（VITALSPAN_*）
  → .deeptalk/workspace.json instanceConfig.vitalspan（api/fe）
  → 工作区 config.json / local.config.json vitalspan 段
  → assets/defaults.json
```

凭据：`VITALSPAN_USERNAME` · `VITALSPAN_DEV_ADMIN_PASSWORD`（不进 instanceConfig）。

## 三处实现（须行为对齐）

| 位置 | 角色 |
|------|------|
| `docs/api/vs-ai-spec/tools/*.py` | 金样 · CI · 桌面包 |
| `deeptalk-product/lib/` | completion_gate · route_request（CI 单测） |
| `deeptalk-plugins/.../dist/*.js` | **产品 Agent 主路径** |

wf3 gate：`ok dashboardId=` + `layout widgets: N`（N≥1）— 插件 TS 已实现；改 Python 侧时须同步。

## 文档口径（对外）

- ✅ 「安装插件 + 起 :8000/:5173 → Agent 工具可 publish/compose」
- ✅ 「full styleCompliance 需 VITALSPAN_ROOT 或 Python 全量路径」
- ❌ 「必须 sync integrations/vitalspan 才能交付」（产品 = 插件 zip）
- ❌ 「装插件即 guaranteed full tier 无需任何配置」（需见上表）

## 相关文件

- 插件：`deeptalk-plugins/plugins/vitalspan/src/preflight.ts` · `shared.ts` · `validateArtifact.ts`
- VitalSpan：`tools/publish-ai-viz-artifact.py` · `tools/validate-ai-viz-bundle.py`
