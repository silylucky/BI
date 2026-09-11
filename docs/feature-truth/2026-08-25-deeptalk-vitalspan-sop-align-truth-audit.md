# Feature Truth Audit: DeepTalk VitalSpan 插件 SOP 全量对齐（Task 7–8）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-25 |
| 核验范围 | 用户「对齐 SOP」交付：`resources` 视图 + `loadInstance` + 文档去 B 轨 N/A；wf2/wf3 Agent 工具不变 |
| 锚点 | `deeptalk-plugins/plugins/vitalspan/` · SOP `special-workspace-plugin-reuse-task.md` Task 7–9 |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **6.5/10 · C** |
| 状态 | draft |
| **sampling** | `full`（scope 内 13 项全列，无抽样） |

## 1. 核验标准与预期（来自用户/对话/设计）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 模板左侧有 **资源目录**，注册 `vitalspan:resources` | SOP Task 7 · 每新增一页 4 步 |
| T2 | home「打开资源目录」→ **页内** `navigateWorkspace`，父级 URL 变 `/workspace/view/resources` | SOP Task 7 · Task 9 #5 |
| T3 | `resources` 读 `routeSearch` 的 `?id=`，同一 viewId 下 query 变更高亮 | SOP Task 7 · Task 9 #7 |
| T4 | `plugin.json` 声明 **`loadInstance`** + `load-instance.cjs` | SOP Task 8 |
| T5 | `resources` 列表数据 **仅** `pluginExec('loadInstance')`；`views/*.js` 无 `fetch(` | SOP Task 8 · Task 9 #9 |
| T6 | wf2/wf3 **14×** `components.tools` 未改 | 用户原话「wf2/wf3 不变」 |
| T7 | VitalSpan 文档去 **B 轨 N/A**，叙事为 SOP 全量对齐 | 用户「就要对齐 sop」 |
| T8 | `npm run smoke` 绿；安装目录与构建产物 **哈希一致** | SOP Task 9 |
| T9 | **真实 DeepTalk 窗口**：左切 home↔resources 20 次稳定 | SOP Task 9 #4–#6 |
| T10 | **重启 DeepTalk 后** `main.log` 出现 `ViewLoader vitalspan:resources` | 安装 SOP 第 4 步 |

- 非目标：iframe 内 compose/upload；改 `deeptalk` 引擎；重打 release zip（除非用户另要求）。

## 2. 完整链路图

```
安装 plugin.json + views + exec-tools
  → 模板 navigation/capabilities
  → 宿主 ViewLoader 注册 vitalspan:resources
  → iframe resources-entry.ts
  → pluginExec('loadInstance') → worker login + GET artifacts/dashboards
  → 渲染列表 + navigateWorkspace 深链
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | 构建/assemble | **通** | `npm run smoke` exit 0 · `TASK9-EVIDENCE.json` hashRows 6/6 match | 含 resources.js、load-instance.cjs |
| 2 | 模板契约 | **通** | `workspace-template-contract.test.mjs` ok | navigation id=resources |
| 3 | loadInstance worker | **通** | `node …/load-instance.cjs` → `{ ok:true, ac:1, dc:20 }` | CHAIN，非 iframe |
| 4 | views 无 fetch | **通** | grep views/ 无 `fetch(` · T9-9 ok | GATE+静态 |
| 5 | 文档 SOP | **通** | grep SPECIAL-WORKSPACE 无 `N/A`/`B 轨说明` | 仅历史「自 B 轨升格」 |
| 6 | DeepTalk UI Task 7 | **未验** | `main.log` 无 `vitalspan:resources` | 见 T9/T10 |
| 7 | release zip | **未验/可能过期** | 仓内未找到新打 `vitalspan-v0.3.0.zip` | 分发物未确认 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | resources 页 + 模板注册 | **REAL** | 8/B | 源码 + contract test |
| T2 | home 页内 navigate | **PARTIAL** | 6/C | 源码有 handler；**无 BROWSER 父 URL 证据** |
| T3 | 深链 `?id=` | **PARTIAL** | 6/C | 源码 parse `routeSearch`；**无 BROWSER** |
| T4 | loadInstance 声明 | **REAL** | 9/A | ids-sync + plugin.json |
| T5 | resources 取数链 | **PARTIAL** | 7/B | worker CHAIN 通；iframe 内 pluginExec **未 L1** |
| T6 | wf2/wf3 不变 | **REAL** | 8/B | plugin.json 仍 14 dist tools |
| T7 | 文档对齐 | **REAL** | 8/B | SPECIAL-WORKSPACE / CONTRACT / examples |
| T8 | smoke + 哈希 | **REAL** | 9/A | TASK9-EVIDENCE 2026-08-25T03:55:33Z |
| T9 | 宿主 UI 稳定性 | **UNVERIFIED** | 2/F | 无 Phase4 复跑记录 |
| T10 | 重启后 ViewLoader | **UNVERIFIED** | 1/F | main.log 仅有 `vitalspan:home`（2026-08-24） |

## 3b. 前端控件下钻表（DeepTalk iframe · 必验 6 控件）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | home「打开资源目录（页内）」 | `home-entry.ts` → `navigateWorkspace({ viewId:'resources' })` | 父级 URL 变 resources | **未在 DeepTalk 实测** | 1 | 1 | 2 | 1 | 1 | 6 | PARTIAL | 静态读码 |
| B2 | home「检测 API 连接」 | `pluginExec('vitalspan_health')` | health ok/失败可见 | Phase4 曾验 home；**本次未复跑** | 1 | 1 | 2 | 1 | 1 | 6 | PARTIAL | 历史 Phase4 |
| B3 | resources「返回 VitalSpan 首页」 | `navigateWorkspace({ viewId:'home' })` | 回 home URL | **未实测** | 1 | 1 | 2 | 1 | 1 | 6 | PARTIAL | 静态 |
| B4 | resources 列表行点击 | `navigateWorkspace({ search:'?id=' })` | URL 带 id + 高亮 | **未实测** | 1 | 1 | 2 | 1 | 1 | 6 | PARTIAL | 静态 |
| B5 | resources「重试」 | 失败后再 `render()` | 重拉 loadInstance | **未实测失败态** | 0 | 1 | 2 | 1 | 1 | 5 | PARTIAL | 静态 |
| B6 | 左侧 nav「资源目录」 | 宿主 builtinOrPlugin | 打开 resources iframe | **main.log 无 resources** | 0 | 0 | 2 | 1 | 1 | 4 | **UNVERIFIED** | 需重启宿主 |

Out 控件：5173 外链（`target=_blank`）— SOP 允许，不替代 Task 7 页内 navigate 验收。

功能块映射：T2→B1,B6 · T3→B4 · T5→B4,B5 · T9→B1,B3,B6

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI/BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|------------|------|---|---|------|------|
| E1 | views/resources.js 产物 | ✅ | ✅ esbuild | ❌ | CHAIN | 2 | 2 | REAL | build-views ok |
| E2 | template nav resources | ✅ | ✅ contract test | ❌ | CHAIN | 2 | 2 | REAL | workspace-template-contract |
| E3 | capabilities vitalspan:resources | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | template JSON |
| E4 | execTool loadInstance 登记 | ✅ | ✅ ids-sync | ❌ | CHAIN | 2 | 2 | REAL | plugin.json |
| E5 | home navigateWorkspace | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | home.js 静态 |
| E6 | routeSearch ?id= | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | resources-entry.ts |
| E7 | views 无 fetch | ✅ | ✅ T9-9 | ❌ | CHAIN | 2 | 2 | REAL | grep + evidence |
| E8 | loadInstance API 返回 | ❌ | ✅ node invoke | ❌ | CHAIN | 2 | 2 | REAL | ac=1 dc=20 |
| E9 | 安装哈希 6 文件 | ✅ | ✅ TASK9 | ❌ | CHAIN | 2 | 2 | REAL | TASK9-EVIDENCE.json |
| E10 | 文档去 N/A | ✅ | ✅ grep | ❌ | CHAIN | 2 | 2 | REAL | SPECIAL-WORKSPACE |
| E11 | 14 Agent tools | ✅ | ❌ | ❌ | GATE | 1 | 2 | PARTIAL | plugin.json 计数 |
| E12 | Task9 #5 父 URL | ❌ | ❌ | ❌ | **NONE** | 0 | 0 | UNVERIFIED | 无手测记录 |
| E13 | Task9 #7 深链定位 | ❌ | ❌ | ❌ | **NONE** | 0 | 0 | UNVERIFIED | 无手测记录 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 13 |
| GATE only | 2（E5、E6） |
| CHAIN | 8 |
| UI / BROWSER | 0 |
| NONE（未验） | 2（E12、E13） |
| REAL 达标 | 7/13 |
| **逐一校验** | **否** — 已验 11/13 行有证据，其中 2 行 NONE；**零 BROWSER** |
| 总体可否 REAL | **否** — E12/E13 NONE；Task 7 UI 期望须 BROWSER |

## 3c. 五维评分汇总（总体 T-SOP）

| 维 | 分 | 说明 |
|----|-----|------|
| L | 1.5 | 构建/ worker / 哈希通；iframe 宿主链未 L1 |
| C | 1.5 | worker 数据正确；UI navigate/深链未对比预期 |
| D | 2 | 安装哈希与 repo 一致 |
| E | 1.5 | 失败重试代码存在，未验失败态 |
| F | 1 | 未在 DeepTalk 看反馈 |
| **总分** | **6.5/10 · C** | |

**打通但不对**：0（无 L≥2 且 C=0 的已验链）  
**假/未验**：E12、E13、B6（ViewLoader 未出现）

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `npm run smoke` | exit 0 | exit 0 | ✅ | 2026-08-25 会话 |
| 2 | `node load-instance.cjs` | ok + 列表 JSON | `{ ok:true, ac:1, dc:20 }` | ✅ | shell 输出 |
| 3 | grep views fetch | 0 命中 | 0 命中 | ✅ | grep |
| 4 | TASK9 hashRows | 6/6 match | 6/6 match | ✅ | TASK9-EVIDENCE.json |
| 5 | main.log ViewLoader resources | 重启后有 `vitalspan:resources` | **无匹配** | ❌ | main.log grep |
| 6 | DeepTalk home→resources URL | 父 URL 含 `/view/resources` | **未执行** | ❌ | — |
| 7 | 打开 `?id=<uuid>` | 高亮 + 详情卡 | **未执行** | ❌ | — |

## 5. 修复文档（P0 · 未 REAL 项）

### T2/T3/T9/T10 — DeepTalk 宿主 UI 未闭合

**判定 / 得分**：UNVERIFIED · L=0 · C=0  
**期望 vs 实际**：期望重启后左 nav 有资源目录、页内 navigate 改父 URL、`?id=` 可定位；实际 **代码已装、哈希一致，但 main.log 无 `vitalspan:resources`**，推断 **未完全重启 DeepTalk** 或未手测 Task 9 #5/#7。  
**根因**：SOP Task 9 第 4 步「完全退出并重启」+ Phase 4 手测 **本次未复跑**。  
**修复方向**（无代码）：  
1. 完全退出 DeepTalk → 重启  
2. VitalSpan BI 工作区：home → 资源目录 → 点一行 → 复制 URL 带 `?id=` 新开  
3. 左 nav 连续切 20 次  
4. 补 `main.log` 截图或更新 `docs/TASK9-EVIDENCE.json` 增加 `T9-log-resources` 探针  
**修后验收**：E12/E13 深度 BROWSER，L≥2 C≥2，T9 总体 ≥8/10

### T8 可选 — release zip

**判定**：UNVERIFIED（分发）  
**期望 vs 实际**：对外安装应 zip 与当前 build 一致；仓内 **未确认** 新 zip 已打。  
**修复方向**：`deeptalk-plugins` 根 `npm run release` → 核对 zip 含 `resources.js` + `load-instance.cjs`  
**优先级**：P1（本机 `%APPDATA%` 已同步时可后做）

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | T9/T10 | 重启 DeepTalk 并手测 Task 7/9 #5/#7，确认 ViewLoader resources |
| P1 | T8 zip | 重打 release 制品（若要对外分发） |

## 7. 交接

- 建议：用户手测闭合 P0 后，可复跑 `/feature-truth-verify` 同 scope 升 REAL  
- **代码实现层面**：Task 7–8 **已落地**（非 STUB）  
- **「确认完成了吗」结论**：**实现完成 · 验收未闭合** — 不能标总体 REAL  
- 用户批准修复：否（本审计仅报告）
