# DeepTalk × VitalSpan 产品级联调验收

> 在 running VitalSpan（`:8000` + `:5173`）就绪后执行。  
> 产品形态真源：[WORKSPACE-PLUGIN-CONTRACT.md](./WORKSPACE-PLUGIN-CONTRACT.md)

## 1. 插件与工作区（产品路径）

- [x] `deeptalk-plugins` 构建并安装 `release/vitalspan-v*.zip`
- [x] DeepTalk 设置页插件 **loaded**
- [x] 「新建工作区」列表出现 **VitalSpan BI**
- [x] 走完创建向导（api/fe 地址写入 `instanceConfig.vitalspan`）
- [x] 打开工作区 **首页** 视图：已绑定显示 API/FE 摘要；未绑定显示横幅 + reason
- [x] 页内「打开 VitalSpan 管理面」跳转 **5173**（不在 iframe 内嵌完整编辑器）
- [x] 工作区 iframe 无对外部 host 的 `fetch`（health 走 `pluginExec`）

## 2. Agent 工具（components.tools）

在 DeepTalk 工作区对话或工具面板：

| 步骤 | 工具 | 期望 |
|------|------|------|
| health | `vitalspan_health_check` | `ok health http://127.0.0.1:8000/health` |
| publish 金样 | `vitalspan_publish_artifact` | `ok artifactId=<uuid>` + `styleComplianceTier=full` |
| list | `vitalspan_list_artifacts` | 列表含该组件 |
| get | `vitalspan_get_artifact` | `ok get artifactId=... file=examples/...` |
| refs | `vitalspan_list_artifact_dashboard_refs` | 被引用时列出 dashboardId |
| delete | `vitalspan_delete_artifact` | 默认 `unlink=true`：`ok deleted` + 有引用时 `ok unlinked dashboard=...`；`unlink=false` 且仍被引用 → **409** |
| delete dash | `vitalspan_delete_dashboard` | `ok deleted dashboardId=...` |
| route | `vitalspan_route_request` | JSON `workflow` 1/2/3；wf2 含 `paradigm`/`runtime`，**无** wf2 `template` |
| compose | `vitalspan_compose_dashboard` | `ok dashboardId=` + `slots: chart X/X customViz Y/Y` + `layout widgets: N` |

### v0.4.0 体验场景（E1–E6 + E4a–c）

| # | 场景 | 期望 |
|---|------|------|
| E1 | 「商务矩形树图」 | wf1 treemap + validate；5173 非文本列表 |
| E2 | 标准柱/线 + deStyle | wf1 validate → compose manual |
| E3 | 炫丽 trend/rank wf2 | artifactId + full tier；5173 样式 Tab + 手绑出数 |
| E4 | 拼大屏柱+线+组件 | template + artifact_ids；manual 绑数 |
| E4a | 驾驶舱 | `template=de-classic-cockpit`；stdout `chart 8/8` |
| E4b | 加 customViz | publish 后 compose 带 artifact_ids |
| E4c | 无 template | compose 成功 + `[warn] NO_TEMPLATE_GRID`；gate 仍过 |
| E5 | output/ 交付 | gate **拒绝** |
| E6 | scaffold 金样 | scaffold **拒绝** |

- [ ] DeepTalk Agent 已内置 [AGENT-SYSTEM-PROMPT.md](./AGENT-SYSTEM-PROMPT.md)（≤300 行）

## 3. 完成 Gate

```
vitalspan_completion_gate workflow=2 + tool_stdout（publish 原始输出）
vitalspan_completion_gate workflow=3 + tool_stdout（compose/upload 含 ok dashboardId= 与 layout widgets:）
```

- [ ] wf2 summary 无 uuid 时被 gate **拒绝**
- [ ] wf2 summary 含 forbidden phrase（如「可在工作区直接使用」）时被 **拒绝**

## 4. 前端 5173

> IA 真源：[layout.md](../../../ui/layout.md) · `/admin` 默认重定向 **仪表板**；wf2 验收进 **分析 → 组件库**。

- [ ] **分析 → 组件库**（`/admin/viz-components`）可见已 publish 组件
- [ ] 组件编辑页样式面板改色生效（bundle 读 `p.style`）
- [ ] 组件库卡片 **属主移除** → DELETE 204
- [ ] **wf3**：`/admin/dashboards/:id/edit` 或 `/admin/data-screens/:id/edit` 可打开 compose 结果

## 5. Agent 行为

- [ ] 趋势图问卷结束后 **自动 publish**，不再问「保存到 output/」
- [ ] 任务结束必须报 `artifactId` / `dashboardId`，不得仅报本地路径

## 6. 开发备用（可选 · vs-ai-spec tools）

在 VitalSpan 仓 `docs/api/vs-ai-spec/`（或 sync 后的 `integrations/vitalspan/vs-ai-spec/`）：

```bash
python tools/check-vitalspan-health.py
python tools/scaffold-custom-viz.py --id hex-kpi-grid --name "六边形KPI" --template generic-blank-html
python tools/build-hex-kpi-example.py
python tools/validate-ai-viz-bundle.py --file examples/hex-kpi-grid.json
python tools/publish-ai-viz-artifact.py --file examples/hex-kpi-grid.json
python deeptalk-product/lib/completion_gate.py --workflow 2 --agent-summary "..." --tool-stdout "<publish stdout>"
```

与插件工具输出语义应对齐；**不作为**客户交付验收主路径。`deeptalk-product/executor/` 已移除。

## 7. L3-ZeroRef 闭环（VitalSpan 仓 · 2026-08-26）

| 步骤 | 命令/产物 | 期望 |
|------|-----------|------|
| 契约 | `vitalspan_get_contract_card` | JSON `contract_card` |
| 起盘 | `scaffold` → `generic-blank-*` | `examples/<id>.json` |
| 业务 | 只改 `renderBusiness` | 不抄 trend-line 金样 |
| 预检 | `validate --json` | `ok` + `full` + `fixes:[]` |
| 入库 | `publish` | `ok artifactId=<uuid>` + `full` |
| Gate | `completion_gate wf2` | passed |
| 5173 | 分析 → 组件库 | 可见 + 样式 Tab 六块有反应 |

- [x] `examples/hex-kpi-grid.json`（验收金样 · 已 publish 可复测）
- [x] validate → publish → `completion_gate wf2` 绿（CLI）
- [x] `AGENT-SYSTEM-PROMPT.md` ≤300 行 · `DEEPTALK-AGENT-PROMPT.md` 已对齐
- [x] 插件 **v0.4.0** sync + `release/vitalspan-v0.4.0.zip`（wf3 模板填槽 · manual compose · HTTP validate）
- [x] 插件 **v0.4.1** sync + `release/vitalspan-v0.4.1.zip`（wf3 快路径默认 · 按需 patch · gate demo/style 语义）
- [ ] DeepTalk 安装 zip 并重启 · 新 wf2 折线须 validate 0 warnings（含 DATA_ENCODING/SORT）

## VitalSpan CI 参考

- [backend/tests/test_deeptalk_product_integration.py](../../../backend/tests/test_deeptalk_product_integration.py)
- [backend/tests/test_vs_ai_spec_tools.py](../../../backend/tests/test_vs_ai_spec_tools.py)
- [tests/test_ai_viz_hybrid.py](../../../tests/test_ai_viz_hybrid.py)
