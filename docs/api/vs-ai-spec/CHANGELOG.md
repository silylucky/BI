# vs-ai-spec 变更

## 2026-08-27 (范式收口 · 插件 v0.3.7)

- `custom-viz-paradigms.json` v2：`referenceSamples` + `scaffoldPolicy`；Agent **仅** generic-blank 起盘
- `capability-routing.json`：wf2 去 `template` 强制；补 `paradigm`；折线/排名不与 wf1 抢路由
- `route_request` 透传 `paradigm`；Agent **忽略** route 遗留 `template`
- 文档/contract/hints/SKILL：「抄金样」→ 参考 + generic-blank；插件 `scaffoldArtifact` 拒非 generic-blank

## 2026-08-27 (数据契约 · 插件 v0.3.6)

- generic-blank 壳层注入 `rowsToSeries` / `resolveBoundColumns` / `monotoneCurve`（勿删；只改 renderBusiness）
- 入库 warn：`AIVIZ_WARN_DATA_ENCODING` · `AIVIZ_WARN_DATA_DOMAIN_SORT`（折线/面积数据语义；**不限制**视觉样式）
- 路由：趋势 wf2 起盘 generic-blank-d3；trend-line **仅参考**
- Agent：金样禁止整包抄；validate 须 0 warnings 含 DATA_*

## 2026-08-27 (内置图误路由 · 插件 v0.3.5)

- `capability-routing.json` 补 wf1：treemap/pie/funnel/word-cloud/sunburst/heatmap/scatter/radar/gauge/liquid/bar/line 等
- 入库 warn：`AIVIZ_WARN_BUILTIN_MISROUTE` · `AIVIZ_WARN_STYLE_KEYS_NOT_APPLIED`（误路由 + 文本列表 dump）
- Agent 铁律：**先 route_request**；矩形树/饼图等 **禁止 wf2 customViz**
- 插件 **v0.3.5**：轻量 preflight 同步误路由 422

## 2026-08-26 (customViz resize 生命周期门禁 · 插件 v0.3.4)

- 入库 warn/DeepTalk 拦：`AIVIZ_WARN_RESIZE_LAYOUT` · `AIVIZ_WARN_D3_INTERRUPT` · `AIVIZ_WARN_D3_CLEAR`（`style_compliance.py`）
- `AIVIZ_MOUNT_REQUIRED` 扩展至 **html + d3**（422）
- [guides/BUNDLE-BOILERPLATE.md](./guides/BUNDLE-BOILERPLATE.md) §3b · [AGENT-SYSTEM-PROMPT.md](./deeptalk-product/AGENT-SYSTEM-PROMPT.md) resize 铁律
- `assets/aiviz-structured-fixes.json` · `aiviz-publish-hints.json` 补 fix/snippet
- 金样 `generic-blank-d3` 补 `svg.interrupt()`
- DeepTalk 插件 **v0.3.4**：轻量 `preflight.ts` 同步 resize 422 · sync 脚本 · `release/vitalspan-v0.3.4.zip`

## 2026-08-25 (customViz 禁止重复平台配置 · maxItems 等)

- [STYLE-SCHEMA.md](./guides/STYLE-SCHEMA.md) §禁止重复平台能力：数据 Tab「结果展示」/刷新、样式六块、截断横幅等 **不得**再进 styleSchema
- 入库 warn：`AIVIZ_WARN_PLATFORM_DUPLICATE_STYLE`（`style_compliance.py` + `aiviz-publish-hints.json`）
- 金样修复：`custom-viz-podium-leaderboard` v1.1.2 · `custom-viz-ranking-bar-medal` 移除 `maxItems`，bundle 全量读 `payload.rows`
- Agent 提示词 / IRON-RULES / CUSTOM-VIZ-AUTHOR 同步

## 2026-08-25 (customViz 容器自适应 · 溢出滚动通用规范)

- [guides/BUNDLE-BOILERPLATE.md](./guides/BUNDLE-BOILERPLATE.md) 新增 **§4 容器自适应与溢出**：DeepTalk 组件须读 `p.layout` 缩放；内容多/widget 小 → 组件内滚动，能展示多少就多少
- **IRON-RULES** · **HTML-RUNTIME** · **PLATFORM-SLA** · **CUSTOM-VIZ-AUTHOR** · **DEEPTALK-AGENT-PROMPT** 同步
- 金样 `custom-viz-podium-leaderboard` → v1.1.1：领奖台随 layout 缩放 + 列表区 `overflow-y:auto`

## 2026-08-25 (政企内置大屏 compose 参考 · gov-*)

- 新增 6 套 **5173 内置大屏** DeepTalk compose 参考：`gov-eco-monitor` · `gov-industrial-park` · `gov-smart-city` · `gov-digital-cockpit` · `gov-emergency-command` · `gov-community`
- 导出脚本：`tools/export-gov-compose-templates.py`（源：`backend/.../templates/layouts/*.json`）
- `assets/layout-templates/index.json` → `version: 3` · `recommendedGovDataScreen` · catalog **21** 套（5 de + 6 gov + 10 dash）
- 指南：[guides/COMPOSE-TEMPLATES-GOV.md](./guides/COMPOSE-TEMPLATES-GOV.md)

## 2026-08-25 (customViz DOM 查找通用规范)

- 新增 [guides/BUNDLE-BOILERPLATE.md](./guides/BUNDLE-BOILERPLATE.md)：entry 脚本外壳、`$()` 查节点、`vsCv.mount` 模板
- **PROTOCOL / HTML-RUNTIME / CUSTOM-VIZ-AUTHOR**：明确禁止 `document.getElementById` 与 `(host||document).getElementById`
- 入库 warn：`AIVIZ_WARN_DOM_HOST_LOOKUP` · `AIVIZ_WARN_DOM_DOCUMENT_LOOKUP`（`style_compliance.py` + `aiviz-publish-hints.json`）
- 金样 `*.bundle.html` 与 `scrolling-table` / `html-minimal` / `dynamic-scroll-chart*` JSON 内联 HTML 统一为 `host.querySelector('#…')`
- 平台 FE：`CustomVizWidget` 宿主挂载时序 + `ensureCustomVizHostElementLookup` 兼容旧 bundle

## 2026-08-25 (移除旧 compose 大屏模板)

- **删除** 10 套无 DE 壳层的 data-screen 模板（`gov-cockpit`、`kpi-flow-banner` 等）；catalog 现为 **5 DE + 10 dash = 15**
- `index.json` 增加 `removedDataScreenIds`；生成脚本自动清理 orphan JSON
- Agent/文档/Skill 示例统一为 **`de-classic-cockpit`** 等 5 套 `de-*`

## 2026-08-25 (compose 大屏 DE 工整模板 + 壳层)

- 新增 5 套 **DE 推荐** compose 模板：`de-classic-cockpit` · `de-sales-command` · `de-balanced-four` · `de-map-command` · `de-kpi-flow-wall`
- compose 自动：**顶栏标题 + 时钟** · 槽位 `defaultChartType` · customViz 空槽 → 富文本占位
- 指南：[guides/COMPOSE-TEMPLATES-DE.md](./guides/COMPOSE-TEMPLATES-DE.md) · Agent 提示词已更新

## 2026-08-25 (SOP 全量对齐 · resources + loadInstance)

- 插件 v0.3.0：`views/resources.js` · `exec-tools/load-instance.cjs`（SOP 名 `loadInstance`）
- Task 7：`navigateWorkspace` 页内导航 + `routeSearch` 深链；模板 navigation `resources`
- Task 8：resources 取数走 `pluginExec('loadInstance')`；**wf2/wf3 Agent 工具不变**
- 文档：`SPECIAL-WORKSPACE-PLUGIN-TASK.md` · `WORKSPACE-PLUGIN-CONTRACT.md` · `examples/` 去 B 轨 N/A

## 2026-08-25 (examples 实例副本与真源对齐)

- [`examples/special-workspace-plugin-reuse-task.md`](../../../examples/special-workspace-plugin-reuse-task.md) 同步为 VitalSpan B 轨 v0.3.0 已闭合实例（Task 全勾）
- 明确 **wf2/wf3 · 14× Agent 组件工具不变**；仅工作区壳 Task 1–9 叙事
- 真源仍为 `SPECIAL-WORKSPACE-PLUGIN-TASK.md`；两文件互链

## 2026-08-25 (Task 9 证据 · code-reviewer 修复)

- 插件：`task9-host-evidence.mjs` · `TASK9-EVIDENCE.json` · `workspace-template-contract.test` · `instanceConfig` 补测
- 验收文档：[Task 9 宿主验收](../../../reviews/grounded/2026-08-25-deeptalk-vitalspan-task9-host-acceptance.md) · [交付评审](../../../reviews/grounded/2026-08-25-deeptalk-vitalspan-task1-9-delivery-review.md)
- Phase 2 spike 计分更新为 **10/10**；执行评审 §11 与 Phase 3 审计对齐

## 2026-08-25 (5173 管理面 IA 对齐)

- 新增 [5173 对齐评审](../../../reviews/grounded/2026-08-25-deeptalk-vitalspan-5173-admin-alignment.md)
- E2E §4 / 契约 §4.1 / AGENT-SYSTEM-PROMPT：「图表盘自定义」→ **分析→组件库** `/admin/viz-components`
- 插件 home 增加 wf2/wf3 5173 深链按钮

## 2026-08-25 (Phase 4 · B 轨 v0.3.0 交付)

- 用户 Phase 4 手测全过；契约 §3 更新为 **v0.3.0 已交付**
- E2E §1 勾选；§2–§3 smoke/CI；§4–§5 按需 wf2 金样回归
- 修复 `test_agent_tools_schema` 对齐 14 tools

## 2026-08-25 (Phase 3 审计 · Phase 4 手测指南)

- Task 1–8 + release 验收落盘；`ids-sync.test` 加入 smoke
- Phase 4 手测指南：区分 DeepTalk 插件页 vs 5173 管理面

## 2026-08-25 (Phase 2 spike 闭合 · Phase 3 启动)

- Spike **10/10**（#4/#10 于 Phase 4 / Task 9 闭合）
- 插件 `npm run smoke` 回归绿
- Phase 3 Task 1–9 **已闭合**（见 Phase 3 审计 · Task 9 验收）

## 2026-08-24 (B 轨决策 · Phase 0/1)

- Phase 0：**B 轻量工作区** 决策闭合（用户确认）
- Phase 1：`WORKSPACE-PLUGIN-CONTRACT` §1.1 iframe 口径 · §3 改回 v0.2.16 基线 · §5 正式决策
- `SPECIAL-WORKSPACE-PLUGIN-TASK.md`：Phase 2 spike 门控 · B-min Task 8 · 目录对齐 release.mjs
- 评审落盘：`docs/reviews/grounded/2026-08-24-deeptalk-vitalspan-*-adjudication.md`
- **下一步**：Phase 2 DeepTalk spike（≥8/10）通过后 Phase 3 Task 1–9

## 2026-08-24 (工作区插件形态 · 文档收口)

- 产品对接真源：[deeptalk-product/WORKSPACE-PLUGIN-CONTRACT.md](./deeptalk-product/WORKSPACE-PLUGIN-CONTRACT.md)
- 新增 [SPECIAL-WORKSPACE-PLUGIN-TASK.md](./deeptalk-product/SPECIAL-WORKSPACE-PLUGIN-TASK.md) · [PREFLIGHT-DUAL-TRACK.md](./deeptalk-product/PREFLIGHT-DUAL-TRACK.md)
- 修订 `deeptalk-product/README` · `AGENT-SYSTEM-PROMPT` · `E2E-CHECKLIST` · `IRON-RULES` §7 · `DEEPTALK-AGENT-PROMPT` · Cursor 规则
- `integrations/vitalspan/` + `executor/cli.py` 降级为 **开发/CI 备用**；产品路径 = vitalspan 插件 zip + 特殊工作区

## 2026-08-20 (MVP 无源码上传)

- 新增 [MVP-UPLOAD.md](./MVP-UPLOAD.md) · `tools/mvp-upload.py` · 根目录 `upload-component.ps1`
- `local.config.json.example`：API / VITALSPAN_ROOT 本地配置；支持 `--from output/` 复制入库
- 无 DeepTalk 发版即可 POST 入库（给接口即用）

## 2026-08-20 (DeepTalk 产品级对接)

- 新增 [deeptalk-product/](./deeptalk-product/)：AGENT-SYSTEM-PROMPT · config 模板 · agent-tools.schema.json
- 新增 `deeptalk-product/executor/`：publish 执行器 · completion_gate · `cli.py` 六工具
- 新增 `scripts/sync-vs-ai-spec-to-deeptalk-repo.ps1` → `integrations/vitalspan/`
- 测试：`backend/tests/test_deeptalk_product_integration.py`

## 2026-08-20 (一体集成完善)

- 新增 [IRON-RULES.md](./IRON-RULES.md) · Cursor 规则 `deeptalk-vitalspan-integration.mdc`
- 新增 `tools/publish-ai-viz-artifact.py` · `check-vitalspan-health.py` · `list-ai-viz-artifacts.py` · `delete-ai-viz-artifact.py`
- 新增金样 `examples/custom-viz-trend-line.json`（d3 动态趋势 · `p.style` 合规）
- 平台 `DELETE /api/v1/ai-viz/artifacts/{id}`；5173 图表盘属主移除
- 文档口径：「外部规范包」→ **DeepTalk 集成项目 × VitalSpan 平台能力**

## 2026-08-20 (三条线工程分离)

- 新增 [guides/THREE-WORKFLOWS.md](./guides/THREE-WORKFLOWS.md)：② 组件库入库 vs ③ 大屏复用已有+新建
- 重写 `START-HERE` / `EXTERNAL-AUTHOR` / `DASHBOARD-LAYOUT` / `DEEPTALK-AGENT-PROMPT` 按工作流编号

## 2026-08-20 (工程身份写清)

- 新增 [PACK-IDENTITY.md](./PACK-IDENTITY.md)：集成规范包 ≠ 组件项目目录；平台真系统在 :8000
- 新增 [DEEPTALK-AGENT-PROMPT.md](./DEEPTALK-AGENT-PROMPT.md)：禁止「项目目录 / output 完成」话术

## 2026-08-20 (三条路径 Runbook)

- 新增 [START-HERE.md](./START-HERE.md)：总入口、三条路径完成判据、一键命令
- 新增 [guides/L1-L2-CHART-CONFIG.md](./guides/L1-L2-CHART-CONFIG.md) · `examples/line|pie-manual-deStyle.json`
- 新增 [guides/DASHBOARD-LAYOUT.md](./guides/DASHBOARD-LAYOUT.md)
- 新增 `tools/validate-chart-config.py` · `upload-dashboard-layout.py` · `vitalspan_http.py`

## 2026-08-20 (对外暴露与入库判据写清)

- **00-REQUIREMENTS §0**：规范包 ≠ 上传目的地；入库端点、禁止 `output/`、禁止「VS Code 扩展可用」等误读
- **EXTERNAL-AUTHOR**：禁止的完成说法表；汇报必须带 `artifactId`

## 2026-08-20 (外部作者打通)

- 新增 [EXTERNAL-AUTHOR.md](./EXTERNAL-AUTHOR.md)：validate → upload → `artifactId` 三步；明确 `write_file` ≠ 入库
- `tools/validate-ai-viz-bundle.py` + `bundle_preflight.py`：本地与 API 相同 lint（含 `AIVIZ_MOUNT_REQUIRED`、style warnings）
- `upload-ai-viz-artifact.py`：默认先 preflight；`--validate-only`；成功打印 `warnings` / `styleComplianceTier`
- VitalSpan 仓 `scripts/sync-vs-ai-spec-pack.ps1` 同步本包到桌面联调目录（非镜像，保留外部 examples）
- `scripts/pack-vs-ai-spec-deeptalk-test.ps1` 重打 `docs/api/vs-ai-spec-deeptalk-test.zip`

## 2026-08-20 (Phase 3)

- **styleHooks**：自愿 manifest 映射 → FE Hook Bridge；入库 warn + `styleComplianceTier`
- 组件库 Hub 预览与编辑页共用 `CustomVizWidget` + 默认看板 preview 主题
- 脚手架 `scripts/scaffold-custom-viz-html.mjs`

## 2026-08-20 (Phase 1)

- **样式合规 Phase 1**：`AiVizArtifactOut.warnings[]`（POST/PUT/GET 返回，不阻断入库）
- 新增 [guides/CUSTOM-VIZ-STYLE-COMPLIANCE.md](./guides/CUSTOM-VIZ-STYLE-COMPLIANCE.md)
- 官方 `custom-viz-*.json` CI：须零 style warnings

## 2026-08-19

- **PLATFORM-SLA**：`vsCv.mount` 统一 lifecycle；Payload `axisPlan`；壳层 truncated；d3 入库须 `vsCv.mount`
- 新增 [guides/PLATFORM-SLA.md](./guides/PLATFORM-SLA.md) · [guides/HTML-RUNTIME.md](./guides/HTML-RUNTIME.md)
- 官方示例改为 `boot()` → `host.vsCv.mount`；d3 消费 `axisPlan.categoryTickIndices`

## 2026-08-18c

- 官方示例禁止 `document.getElementById`，改为宿主内 `querySelector`（同页多实例）
- 联调：必须服务端/本机脚本 POST；浏览器跨域会 CORS 失败
- GET artifact meta/entry：有 `dashboard:read` 即可（共享看板）；列表与 PUT 仍仅属主

## 2026-08-18b

- 增加 `00-REQUIREMENTS.md`：完成定义=HTTP 201+artifactId；禁止写桌面/打开本地 html
- `tools/upload-ai-viz-artifact.py` 随包装走，本机可 POST 黄金样例

## 2026-08-18

- 明确 L3 runtime **仅 html | d3**（非 vanilla/react/webgl）
- `schemas/layout-v2.schema.json` 作为 `layout.schema.json` 的文件名别名
- 补 `styles.schema.json`、`tokens.schema.json`
- artifact schema：`runtime`、单文件上限与后端 2MB 对齐
- `HANDOFF.md` 增加误读对照
