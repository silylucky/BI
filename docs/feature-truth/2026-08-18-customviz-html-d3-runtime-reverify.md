# Feature Truth Audit: customViz HTML + 平台 D3（复验 · 是否完成）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-18 |
| 核验范围 | 与 [2026-08-18-customviz-html-d3-runtime-truth-audit.md](./2026-08-18-customviz-html-d3-runtime-truth-audit.md) **同范围** + 后续闭环（`?h=contentHash`、页签可见重拉）。**不含** F17 全产品、不含 EditRail |
| 锚点 | `CustomVizWidget.tsx` · `customVizHost.tsx` · `customVizRuntime.ts` · `backend/app/ai_viz/` · `docs/api/vs-ai-spec/` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **7/10 · B** |
| 状态 | reverify（只审计，未改代码） |
| **sampling** | `full` |
| 前次 | 17 行；GATE-only 6、NONE 2。本次 **20 行**（原 17 加深 + 闭环 3 行） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 挂载前 `host.vsCv`：getPayload / onPayload / d3 | 计划 §3 |
| T2 | runtime 仅 html\|d3；超 2MB 413；内联 d3 整库 422 | 计划 §5 |
| T3 | 5 个官方示例挂载后走 vsCv；d3 示例画出柱 | 计划 §7–§8 |
| T4 | 未绑数 `bindingStatus=unbound` 且引导文案 | 计划 §8 |
| T5 | 两实例 payload/d3 不串 | 计划 §8 |
| T6 | PUT 后 GET entry 为新 HTML；页签可见按新 hash 再拉 | 计划 §8 · 用户「闭环」 |
| T7 | 真机打开看板硬刷新见新 HTML | 计划 §8 原文「硬刷新」 |

- **非目标**：ECharts/AntV、沙箱、混排预绑 Dataset、版本回滚、HTML 源码编辑器、L3 MapLibre、EditRail 全按钮。

### 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 原矩阵行 | 17 | 0 | 17 | 前次 §3d |
| 闭环增量 | 3 | 0 | 3 | visibility 重拉、HTTP 413、Widget unbound |
| 真机硬刷新 | 1 | 0 | 1 | 计划 §8（T7） |
| **必验合计** | **20** | 0 | **20** | 下表 §3d（T7 占用 1 行，不与 T6 重复） |

原 17 + 闭环 3 = 20；T7 即 `acc-browser-hard-refresh`，已含在 20 内（见 §3d：原 17 中 `acc-put-refresh` 升为 API CHAIN，另增 visibility / HTTP 413 / widget-unbound；真机单独 1 行替换「仍 NONE 的硬刷新」）。

精确 20 行见 §3d，不把 T 再加总。

**本范围新增可交互按钮：0。** EditRail Out。

## 2. 完整链路图

```
POST/PUT artifacts → 校验（2MB / runtime / 禁内联 d3）
  → Widget：GET meta(contentHash) + GET entry?h=hash
  → mountCustomVizHtml + vsCv
  → execute 就绪则 payload bound，否则 unbound 引导
  → 页签 visible → 再拉 meta+entry（hash 变则换 HTML）
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | API 注册/覆盖 | 通 | hybrid 12 passed（2026-08-18 15:33） | 含 PUT→v2、413 超限；外链 script 断言并进 oversize 用例 |
| 2 | 域校验 | 通 | bundle.py 4 passed | 2MB 边界 + 溢出 |
| 3 | vsCv 挂载 | 通 | host.test 2 passed | |
| 4 | 官方 HTML | 通 | examples 6 passed | 5 unbound + 2 rect |
| 5 | Widget 闭环 | 通 | loop 2 passed | visibility v1→v2；unbound 引导 |
| 6 | Payload 绑数 | 通 | payload widget 1 passed | bound rows |
| 7 | 真机看板 | 断 | 无 | **NONE** |

动态命令输出（必须）：

- `pytest backend/tests/test_ai_viz_bundle.py tests/test_ai_viz_hybrid.py -q` → **12 passed**
- `vitest run` host/examples/payload/widget/loop → **23 passed / 6 files**

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | vsCv | **REAL** | 9/B | host UI |
| T2 | 限额/runtime | **REAL** | 9/B | unit + HTTP 413 |
| T3 | 官方示例 | **REAL** | 8/B | 5 HTML 真挂载 |
| T4 | unbound | **REAL** | 8/B | examples + widget loop |
| T5 | 多实例 | **REAL** | 8/B | host 两实例 |
| T6 | PUT + 可见重拉 | **REAL** | 8/B | PUT GET + visibility UI（非真机） |
| T7 | 真机硬刷新 | **UNVERIFIED** | 0/F | 无 BROWSER |

总体取 T 最低档（T7）约束：**不得 REAL**；加权叙述 7/B 表示自动化主路径可用。

## 3b. 前端控件下钻表

无本范围新增按钮。

| ID | 文案/位置 | handler | 期望 | 实际 | 判定 |
|----|-----------|---------|------|------|------|
| — | Out | — | EditRail 另档 | 不验 | Out |

## 3d. 覆盖矩阵（20 行 = 必验）

| 实体 ID | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|-------|-----|------|---|---|------|------|
| runtime-html | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | bundle + 示例 runtime |
| runtime-d3 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | 同上 |
| runtime-illegal | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | rejects echarts |
| limit-2mb | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | 恰 2MB 过、+1 拒绝；HTTP 413 |
| forbid-inline-d3 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | `d3.version` 大文件 |
| vscv-getPayload | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | host.test |
| vscv-onPayload | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | host.test |
| vscv-d3 | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | `rect.length===2` |
| ex-bundle | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | examples `$name` |
| ex-d3 | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | unbound + bars |
| ex-pulse | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | examples |
| ex-ring | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | examples |
| ex-alert | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | examples |
| acc-unbound-hint | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | 引导文案 |
| acc-multi-host | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | 两 host |
| acc-put-get | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | entry 含 v2 不含 ok |
| jsdom-script | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | 官方脚本已执行 |
| acc-visibility-reload | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | loop v1→v2、`h=h2` |
| widget-unbound | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | loop + payload unbound |
| acc-browser-hard-refresh | ❌ | ❌ | ❌ | **NONE** | 0 | 0 | UNVERIFIED | 未开真实看板 |

相对前次：GATE-only 6→**0**；NONE 2→**1**；新增 3 行均为 UI/CHAIN REAL。

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | **20** |
| GATE only | **0** |
| CHAIN | 6 |
| UI / BROWSER | 13 / **0** |
| NONE（未验） | **1**（真机硬刷新） |
| REAL 达标 | **19/20** |
| **逐一校验** | **否** — 20 行都有深度标注，但 1 行 NONE，且 0 BROWSER |
| 总体可否 REAL | **否** — 任一行 NONE 不得总体 REAL |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 2 | 2 | 1 | 2 | 9 | B | REAL | 卸载泄漏未单测 |
| T2 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | |
| T3 | 2 | 2 | 2 | 1 | 2 | 9 | B | REAL | |
| T4 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | |
| T5 | 2 | 2 | 1 | 1 | 2 | 8 | B | REAL | |
| T6 | 2 | 2 | 2 | 1 | 2 | 9 | B | REAL | 自动化闭环 |
| T7 | 0 | 0 | 0 | 0 | 0 | 0 | F | UNVERIFIED | |
| **总体** | — | — | — | — | — | **7** | **B** | **PARTIAL** | 受 T7 上限 |

**打通但不对**（L≥2 且 C≤1）：**0**  
**假功能**：无  
**未验**：T7 真机

## 4. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | pytest bundle+hybrid | 绿 | 12 passed | ✅ | 终端 2026-08-18 15:33 |
| 2 | vitest 6 文件 | 绿 | 23 passed | ✅ | 同上 |
| 3 | 官方 unbound | 引导句 | 5/5 含「请在右侧绑定…」 | ✅ | examples.test |
| 4 | d3 bound | 2 rect | 2 | ✅ | examples.test |
| 5 | visibility PUT 模拟 | v2 + h=h2 | 通过 | ✅ | loop.test |
| 6 | 浏览器大屏 | 硬刷新新 HTML | 未执行 | ❌ | NONE |

## 5. 修复文档

### T7 — 真机硬刷新

**判定**：UNVERIFIED  
**期望 vs 实际**：打开含 customViz 的看板/大屏，PUT 制品后硬刷新或切回页签，应见新 HTML。自动化已覆盖 PUT 与 visibility，**未** MCP/Playwright 真页。  
**修复方向**：scenario-playbook / 浏览器走查 1 条；或把 T7 明确标 Out「不验收真机」。  
**优先级**：P2（非本方案功能缺失）

§9 分期项仍不是漏做。

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P2 | T7 | 真机 1 条走查才能把总体从 PARTIAL 提到 REAL |
| — | §9 | 预绑/编辑器/ECharts 不做 |

## 7. 交接

- **本方案自动化闭环：已完成**（19/20 REAL）
- **功能线总体：未完成 REAL**（缺真机）
- 建议：仅报告 / 批准真机走查 / 不要为 T7 改业务代码
