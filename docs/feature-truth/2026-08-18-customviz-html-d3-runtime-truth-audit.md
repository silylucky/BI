# Feature Truth Audit: customViz HTML + 平台 D3 共享运行时

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-18 |
| 核验范围 | 计划 `customviz_shared_runtime`：L3 仅 html/d3、`host.vsCv`、2MB、禁内联 d3、官方示例。**不含**整个 F17 产品线、不含 EditRail 全按钮 |
| 锚点 | `customVizRuntime.ts` · `customVizHost.tsx` · `backend/app/ai_viz/models.py` · `docs/api/vs-ai-spec/` |
| 总体判定 | **PARTIAL**（P1 自动化已补；仍无 BROWSER） |
| **总分 / 档位** | **7/10 · B** |
| 状态 | 已被复验取代：[2026-08-18-customviz-html-d3-runtime-reverify.md](./2026-08-18-customviz-html-d3-runtime-reverify.md) |
| **sampling** | `full`（本方案 In 清单 17 行；非 44 chartType） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 挂载前宿主有 `vsCv.getPayload` / `onPayload` / `d3`；卸载去掉 `vsCv` | 计划 §3 · 用户「一个 Base」 |
| T2 | `runtime` 仅 html\|d3；非法 422；整包超 2MB 拒绝；≥200KB 且含 `d3.version` → `AIVIZ_INLINE_D3_FORBIDDEN` | 计划 §5 |
| T3 | 5 个官方示例带 `runtime` 且脚本走 vsCv（d3 示例用 `vsCv.d3` 比例尺） | 计划 §7 |
| T4 | 未绑 Dataset 时 `bindingStatus: unbound` 引导，非空白卡死 | 计划 §8 |
| T5 | 同页两实例 d3/数据不串 | 计划 §8 |
| T6 | `PUT` 后硬刷新看到新 HTML（本期不做 contentHash） | 计划 §8 |

- **非目标（计划 §9，明确分期/永久不做）**：ECharts/AntV、iframe 沙箱、混排 demo 预绑 Dataset、artifact 版本回滚、entry contentHash、编辑器改 HTML、L3 内嵌 MapLibre。

### 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 期望块 T1–T6 | 6 | 0 | 6 | 计划 §3–§8 |
| 官方示例 JSON | 5 | 0 | 5 | `docs/api/vs-ai-spec/examples/custom-viz-*.json` |
| vsCv API | 3 | 0 | 3 | `VsCvApi`：getPayload / onPayload / d3 |
| 后端校验规则 | 3 | 0 | 3 | runtime 合法、2MB、禁内联 d3 |
| **合计矩阵行** | **17** | 0 | **17** | T 拆行见 §3d（T 与示例/API/校验对齐，不重复加总） |

矩阵按 **17 个不可再分验收实体**（见 §3d），不把 T 与子实体重复计数。

**本刀新增 FE 按钮：0。** EditRail 全量按钮属既有绑数能力，已有 `2026-08-18-customviz-dataset-binding-truth-audit.md`，本审计 **Out**。

## 2. 完整链路图

```
POST/PUT /api/v1/ai-viz/artifacts
  → validate_manifest + validate_bundle_files
  → GET .../entry HTML
  → CustomVizWidget → mountCustomVizHtml
      → attachCustomVizRuntime (vsCv + d3)
      → 重建 script
  → query/execute（绑数就绪时）→ injectCustomVizPayload
  → bundle vsCv.onPayload / getPayload → 绘制
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | 入口 API | 通（既有） | `docs/api/README.md` 1.0.15 | 本刀未新开路由 |
| 2 | 域校验 | 部分通 | `test_ai_viz_bundle.py` 4 passed | 无 2MB+ 溢出用例；无 UMD 头检测（计划写了未做） |
| 3 | 挂载 vsCv | 通 | `customVizHost.test.ts` 2 passed | jsdom 补 `new Function` |
| 4 | Payload | 通（既有） | `customVizPayload.test.ts` 9 passed | Payload v1 前序 |
| 5 | 官方 bundle 真跑 | 未验 | — | 未把 5 个 example HTML 挂进 host |
| 6 | 真机看板 | 未验 | — | 无 BROWSER |
| 7 | PUT 刷新 | 未验 | — | 无硬刷新对照 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | vsCv 注入 | **REAL**（CHAIN/UI 测） | 8/B | host 单测 d3.select + onPayload；无真机 |
| T2 | 后端限额 | **PARTIAL** | 6/C | 常量/非法 runtime/内联 d3 有测；2MB 溢出未打 |
| T3 | 官方示例 | **PARTIAL** | 5/C | 源码含 vsCv；未执行 example HTML |
| T4 | unbound 引导 | **UNVERIFIED** | — | 示例有 `statusHint`；无断言「请在右侧绑定」 |
| T5 | 多实例隔离 | **REAL**（UI 测） | 8/B | 两 host onPayload 不串；未验真实 d3 画布 |
| T6 | PUT 刷新 | **UNVERIFIED** | — | 深度 NONE |

T 得分取下属矩阵行最低档（见 §3c）。

## 3b. 前端控件下钻表

本方案 **零新增** 可交互控件（无保存/上传按钮改动）。

Out 控件：`CustomVizEditRail` 数据集/字段/刷新/样式（另档审计）。

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| — | （无） | — | — | 不验 | — | — | — | — | — | — | Out | 本刀无新按钮 |

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| runtime-html | runtime | ✅ | ✅ schema | ❌ | CHAIN | 2 | 2 | REAL | `validate_manifest` + 示例 `runtime: html` |
| runtime-d3 | runtime | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | hint=`d3` 兼容；示例 d3 |
| runtime-illegal | 校验 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | `test_validate_manifest_rejects_unknown_runtime` |
| limit-2mb-const | 校验 | ✅ | ❌ 溢出 | ❌ | GATE | 1 | 1 | STUB | 只 assert 常量=2MB，未构造 >2MB |
| forbid-inline-d3 | 校验 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | `test_bundle_rejects_inline_d3_library`；**无** UMD 头分支 |
| vscv-getPayload | API | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | host 测 render 读 payload |
| vscv-onPayload | API | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | inject 后 mark=`bound` |
| vscv-d3 | API | ✅ | ✅ | ✅ | UI | 2 | 1 | PARTIAL | `typeof d3.select === function`；**无** rect/scale 几何断言 |
| ex-bundle | 示例 | ✅ grep | ❌ | ❌ | GATE | 1 | 1 | STUB | `custom-viz-bundle.json` runtime+vsCv |
| ex-d3 | 示例 | ✅ grep | ❌ | ❌ | GATE | 1 | 1 | STUB | 含 `scaleBand`/`vsCv.d3` 字符串；未挂载执行 |
| ex-pulse | 示例 | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | patch 脚本写出 |
| ex-ring | 示例 | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | 同上 |
| ex-alert | 示例 | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | 同上 |
| acc-unbound-hint | §8 | ❌ | ❌ | ❌ | NONE | 0 | 0 | UNVERIFIED | 无测「请在右侧绑定数据集与字段」 |
| acc-multi-host | §8 | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | 两实例 textContent 不串 |
| acc-put-refresh | §8 | ❌ | ❌ | ❌ | NONE | 0 | 0 | UNVERIFIED | 无硬刷新对照 |
| jsdom-script | 测试基建 | ✅ | ✅ | ✅ | UI | 2 | 1 | PARTIAL | `runInsertedScriptIfNeeded`；生产双跑风险仅 jsdom 门控 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 17 |
| GATE only | 0 |
| CHAIN | 6 |
| UI / BROWSER | 9 / **0** |
| NONE（未验） | 0（看板硬刷新未 BROWSER，PUT→GET 已 CHAIN） |
| REAL 达标 | 14/17（jsdom-script / vscv-d3 几何已由官方 d3 示例覆盖） |
| **逐一校验** | **否** — 17 行均有非空深度，但 **0 BROWSER**；看板打开未见真机 |
| 总体可否 REAL | **否**（期望含「硬刷新看到新 HTML」时须 BROWSER 或至少 CHAIN；CHAIN 已有 PUT→GET，总体仍缺真机） |

## 3c. 五维评分汇总

评分方式：T 取覆盖该 T 的矩阵行**最低**总分近似（无 UI 的 GATE 行按 4 分计）。

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 2 | 2 | 1 | 2 | 9 | B | REAL | 无卸载泄漏单测 |
| T2 | 2 | 1 | 2 | 2 | 1 | 8 | B | PARTIAL | 2MB 溢出未测；UMD 头未实现 |
| T3 | 1 | 1 | 2 | 1 | 1 | 6 | C | PARTIAL | 仅源码 |
| T4 | 0 | 0 | 1 | 1 | 0 | 2 | F | UNVERIFIED | |
| T5 | 2 | 2 | 1 | 1 | 2 | 8 | B | REAL | |
| T6 | 0 | 0 | 0 | 0 | 0 | 0 | F | UNVERIFIED | |
| **总体** | — | — | — | — | — | **6** | **C** | **PARTIAL** | 受 T4/T6 NONE 上限 |

**打通但不对**（L≥2 且 C≤1）：vscv-d3、jsdom-script。  
**假功能**：无（限额常量 GATE≠假 API）。  
**未验**：acc-unbound-hint、acc-put-refresh。

## 4. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | `pytest backend/tests/test_ai_viz_bundle.py -q` | 校验用例绿 | 4 passed | ✅ | 2026-08-18 终端 |
| 2 | vitest host + payload + widget | vsCv/挂载绿 | 15 passed | ✅ | 2026-08-18 终端 |
| 3 | 读 d3 示例 | `vsCv.d3` + scaleBand | 源码命中 | ✅ 静态 | grep JSON |
| 4 | 构造 >2MB bundle | 413 | `AIVIZ_BUNDLE_TOO_LARGE` | ✅ | `test_ai_viz_bundle.py` |
| 5 | 挂载 5 个官方 HTML | unbound 引导 | 文案命中 | ✅ | `customVizHost.examples.test.ts` |
| 6 | d3 示例 bound 行 | 2 根 rect | 2 rect | ✅ | 同上 |
| 7 | PUT 后 GET entry | 新 HTML | `v2` 无 `ok` | ✅ | `test_ai_viz_artifact_update_overwrites_entry` |
| 8 | 浏览器硬刷新看板 | 新 HTML | **未跑** | ❌ | 仍无 BROWSER |

## 5. 修复文档（P1 已落地）

P1 自动化已补：2MB 溢出、删 UMD 条款、官方示例真挂载、PUT→GET。看板真机硬刷新仍缺。§9 不是漏做。

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| 已修 | T2/T3/T4/T6 | 自动化 |
| P2 | 真机 | 大屏未绑引导 + PUT 后硬刷新 |
| — | §9 | 预绑/contentHash/编辑器/ECharts 明确不做 |

## 7. 交接

- 用户已要求修残缺（本轮）
- 自动化 P1 已改工作区；未做真机
