# 项目锚定方案评审 — DeepTalk × VitalSpan「怎么去做」（执行路径）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-24 |
| Skill | `~/.cursor/skills/project-grounded-review/` |
| 问题 | 按 Task / 契约 / 评审结论，**具体怎么去做**？先做什么、谁做、如何验收？ |
| 选项 | P0 乱序全做 · **P1 门控分阶段（推荐）** · P2 仅文档(A) · P3 暂缓 |
| 裁决 | **RECOMMEND_SYNTHESIZED → P1 门控分阶段**（置信度 **HIGH**） |
| 方向纠正强度 | **改道**（相对「分析 plan 一次性完工 / 超前 v0.3」） |
| 置信度 | **HIGH**（执行步骤不依赖未验证代码；Phase 2 对 B 为 T3 门控） |
| 前置评审 | [2026-08-24-deeptalk-vitalspan-workspace-adjudication.md](./2026-08-24-deeptalk-vitalspan-workspace-adjudication.md) |
| **交付** | 判 + 纠 + 给（§6–§9 完整） |

---

## 1. 项目约束摘录

| ID | 约束 |
|----|------|
| C-01 | 产品交付 = **插件 zip + 特殊工作区**（[WORKSPACE-PLUGIN-CONTRACT.md](../../api/vs-ai-spec/deeptalk-product/WORKSPACE-PLUGIN-CONTRACT.md)）；`integrations/vitalspan` 仅开发备用 |
| C-02 | wf2/wf3/5173/bundle 铁律不变（[IRON-RULES.md](../../api/vs-ai-spec/IRON-RULES.md)） |
| C-03 | **禁止** iframe 嵌 5173 / gis 整应用（ADR-12 · gis 规则） |
| C-04 | Agent tools 可 Node fetch；工作区 iframe 仅 `pluginExec` |
| C-05 | **评估未完不改插件**；契约 §5「已选 B」、§3「v0.3 已完成」与事实不符，**须先纠偏** |
| C-06 | 实施 SOP：[SPECIAL-WORKSPACE-PLUGIN-TASK.md](../../api/vs-ai-spec/deeptalk-product/SPECIAL-WORKSPACE-PLUGIN-TASK.md)（Task 1–9） |
| C-07 | 生产插件基线：**v0.2.16**（tools+skills）；v0.3 工作区草稿 = **未交付** |

---

## 2. 问题重述

**用户问题**：`/project-grounded-review` — **怎么去做**？

**纠正后问题**：

> 在 **不跳过决策门、不超前写插件** 的前提下，按什么 **顺序、由谁、改哪些路径、用什么探针验收**，把 DeepTalk×VitalSpan 对接从「文档分裂 + 超前草稿」推到 **可交付状态**（A 或 B）？

---

## 3. 选项归一（「怎么做」的方法论）

| 选项 | 做法 | 结果 |
|------|------|------|
| **P0 乱序全做** | 分析 plan todo 全勾 + 直接 v0.3 代码 + 文档一次性宣称完成 | 已证明会超前、与用户节奏冲突 |
| **P1 门控分阶段** | Phase 0 决策 → 1 文档 → 2 spike(B) → 3 插件(B) → 4 E2E | **推荐** |
| **P2 仅文档(A)** | Phase 0 选 A + Phase 1 后停止 | 合法最小路径 |
| **P3 暂缓** | 维持 v0.2.16 + 旧叙事 | 与 C-01 产品定论长期冲突 |

**轨道（与 Phase 嵌套）**

| 轨道 | 在 P1 里走哪些 Phase |
|------|----------------------|
| **A** | 0 → 1 → 4（插件保持 v0.2.16） |
| **B** | 0 → 1 → 2 → 3 → 4 |

---

## 4. 证据与假设

| # | 证据 | 结论 |
|---|------|------|
| E1 | v0.2.16 仅 tools+skills | Phase 3 前无工作区能力 |
| E2 | 契约 §5/§3 超前 | Phase 0/1 **必须先纠偏文档** |
| E3 | Task SOP 要求 DeepTalk 真机 Task 9 | B 轨 **Phase 2 不可跳过** |
| E4 | 前置评审 RECOMMEND_SYNTHESIZED | 与本报告 P1 一致 |
| E5 | 用户要求评估期不改代码 | Phase 3 起始条件 = 用户明确 + Phase 2 过(B) |

**假设 T3**：DeepTalk 开发机可安装插件 zip 并创建特殊工作区（B 轨 Phase 2 验证）。

---

## 5. 多维打分（方法论）

| 选项 | 可交付 | 风险 | 成本 | 对齐产品 | 加权 |
|------|--------|------|------|----------|------|
| P0 | 3 | 2 | 4 | 4 | **3.2** |
| **P1** | 9 | 8 | 7 | 9 | **8.4** |
| P2 | 8 | 9 | 9 | 7 | **8.0** |
| P3 | 5 | 6 | 10 | 3 | **5.8** |

---

## 6. 裁决

**推荐**：**RECOMMEND_SYNTHESIZED → 采用 P1 门控分阶段执行**

**一句话**：**今天只做 Phase 0（定 A 或 B）+ Phase 1（修契约/Task/提交）；选 B 则 Phase 2 DeepTalk spike 通过后再 Phase 3 Task 1–9；全程不动 VitalSpan 平台代码、不改 DeepTalk 引擎。**

**相对「直接去做 Task 1–9」的纠正**：Task 是 **Phase 3 的施工手册**，不是 **第 1 步**。

---

## 7. 规划方向纠正

**原方向错在哪？**

- 把 `SPECIAL-WORKSPACE-PLUGIN-TASK.md` 当成 **立即开工令**，跳过 Phase 0 轨道决策与 Phase 2 宿主 spike。
- 契约/Task 把 **目标态**（B + v0.3）写成 **现态**。
- 「沙箱 / iframe」未在 Task 内与 VitalSpan BI 铁律分界，引发误读。

**纠正后目标（一句话）**

> 用 **Phase 0–4 门控** 把 DeepTalk×VitalSpan 集成推到与产品定论一致的可交付态；B 轨仅交付 **壳工作区（绑环境 + health + 跳 5173）**，BI 仍在 Agent tools + 5173。

**应停止**

- 在未 Phase 0 拍板前改 `deeptalk-plugins` 工作区代码或发 v0.3 zip
- 把 Task 8 全量 execTools 当 B 必做（list/compose 属 C 轨）
- 在 iframe 内嵌 5173 或做 gis/customViz 编辑器
- 继续宣称「v0.3 / B 已选 / Task 已完成」

**应优先**

1. **Phase 0**：A/B 决策写入契约 §5（带日期）
2. **Phase 1**：Task 修订 + 契约 §3 纠偏 + 提交 Task MD
3. **（B）Phase 2**：DeepTalk spike 10 条
4. **（B）Phase 3**：Task 1–9 + release + smoke 回归

---

## 8. 推荐解决方案（合成）— **怎么去做**

### 8.1 方案摘要

**名称**：P1 门控五阶段执行法  
**类型**：SYNTHESIZED（流程 + A/B 分叉）  
**一句话**：**决策 → 文档 →（B）spike →（B）插件 → 联调**；每阶段有 Done 探针，失败则降级不硬推。

### 8.2 目标与非目标

| Phase 1 必达 | 非目标 |
|--------------|--------|
| 契约/Task/评审 叙事一致 | 改 VitalSpan backend/fe |
| Phase 0 有 recorded 决策 | 改 DeepTalk 引擎 |
| B：spike 过才写插件 | iframe 内 BI 编辑 |
| v0.2.16 smoke 始终绿 | C 轨 list/compose（二期） |
| | Python preflight TS 化（独立可选） |

### 8.3 架构与触及面（谁改什么）

| Phase | 负责人 | 改哪里 | 不改 |
|-------|--------|--------|------|
| 0 | 产品/你 | 契约 §5 决策句 | 代码 |
| 1 | 文档/Agent | `docs/api/vs-ai-spec/deeptalk-product/*`、`.cursor/rules` 如需 | 插件 |
| 2 (B) | 集成同学习 DeepTalk | DeepTalk 真机 + 读 `deeptalk/docs/features/*` | 引擎源码 |
| 3 (B) | 插件 | `deeptalk-plugins/plugins/vitalspan` | VitalSpan 仓 |
| 4 | QA/你 | E2E 清单手测 + `npm run smoke` | — |

### 8.4 实施步骤（有序 · **这就是「怎么去做」**）

#### Phase 0 — 拍板（≤ 半天）

| 步 | 动作 | 验收 |
|----|------|------|
| 0.1 | 选 **A** 或 **B** | 会议纪要或契约 §5 一行 |
| 0.2 | 若 **A**：Task 文首改「工作区二期」 | 与 §5 一致 |
| 0.3 | 若 **B**：Task 保留 B-min，但 §3 标「待 Phase 3」 | 无「v0.3 已完成」 |
| 0.4 | 本地 v0.3 草稿：**A→revert；B→git 冻结分支** | release 默认可仍 v0.2.16 |

**Done**：§5 无超前表述；团队知道走 A 还是 B。

---

#### Phase 1 — 文档闭合（1–2 人日 · A/B 都做）

| 步 | 动作 | 文件 |
|----|------|------|
| 1.1 | 纠偏契约 §3：基线 **v0.2.16**；B 能力 **待实施** | `WORKSPACE-PLUGIN-CONTRACT.md` |
| 1.2 | §5 写 **正式决策**（替换「已选 B」若未拍板） | 同上 |
| 1.3 | 新增 **「壳 iframe ≠ BI 沙箱」** 小节 | 同上 + Task |
| 1.4 | 修订 Task：目录对齐 `release.mjs`；Task 8 拆 B-min/C-ext；加 Phase 2 门控 | `SPECIAL-WORKSPACE-PLUGIN-TASK.md` |
| 1.5 | 提交 Task MD；核对 E2E 与 A/B 一致 | git commit |

**验收探针**：

```bash
rg "integrations/vitalspan" docs/api/vs-ai-spec/deeptalk-product --glob "*.md"
# 仅「开发备用」语境

# 人工：WORKSPACE-PLUGIN-CONTRACT §5 ↔ Task 文首 ↔ 前置评审 一致
```

**Done**：文档真源单一；无断链。

**若选 A**：Phase 1 完成后可 **跳到 Phase 4（仅 §2–§5 E2E）**，跳过 2–3。

---

#### Phase 2 — DeepTalk spike（仅 B · 1–2 人日）

| 步 | 动作 |
|----|------|
| 2.1 | 用 **v0.2.16 zip**（或最小 mock）安装 DeepTalk |
| 2.2 | 对照 DeepTalk 仓三份 features 文档核对字段 |
| 2.3 | 跑 spike 清单（≥8/10 通过才进 Phase 3） |

**Spike 清单（10 条）**

1. 插件 loaded（含 workspaceTemplates 时）
2. 新建工作区列表有 VitalSpan BI
3. 向导视图可加载
4. `workspaceSetup.complete` → 磁盘 `instanceConfig.vitalspan`
5. 导航打开 `vitalspan:home`
6. iframe 无 `:8000` fetch
7. `pluginExec('vitalspan_health')` 成功
8. 外链 5173 正常
9. 未绑定有横幅
10. 切视图 20 次稳定

**失败**：降级 **A** 或改 Task 字段后再 spike — **禁止进 Phase 3**。

---

#### Phase 3 — 插件 Task 1–9（仅 B · spike 通过后）

严格按 [SPECIAL-WORKSPACE-PLUGIN-TASK.md](../../api/vs-ai-spec/deeptalk-product/SPECIAL-WORKSPACE-PLUGIN-TASK.md)：

| Task | 要点 | 验收 |
|------|------|------|
| 1 | `ids.ts` + `PLUGIN_IDS.md` | 三处 id 一致 |
| 2 | `plugin.json` + views/templates/execTools | 宿主 loaded |
| 3 | `vitalspan.bi.default.workspace.json` | 新建列表可见 |
| 4–6 | instanceConfig + home + workspace-setup | 单测 + 手测 |
| 7 | 导航（B 可仅 home） | URL 一致 |
| 8 | **仅** `vitalspan_health` execTool | home 检测 |
| 9 | `npm run build` + `release` + Task 9 十条 | zip 可装 |

**回归**：`npm run smoke`（14 工具仍绿）。

**版本**：全过才发 **v0.3.0 zip**。

---

#### Phase 4 — 联调收口（A/B）

| 轨道 | E2E | 额外 |
|------|-----|------|
| **A** | [E2E-CHECKLIST.md](../../api/vs-ai-spec/deeptalk-product/E2E-CHECKLIST.md) §2–§5 | smoke |
| **B** | §1–§5 全过 | smoke + wf2/wf3 金样各 1 条 |

**文档**：仅 Phase 4 全过后，才把契约 §3 标为 v0.3 已交付。

### 8.5 风险与回退

| 风险 | 缓解 | 回退 |
|------|------|------|
| spike 失败 | Phase 2 门控 | 走 A，工作区二期 |
| v0.3 与 v0.2.16 混淆 | Phase 0.4 冻结/revert | 继续 v0.2.16 release |
| Task「沙箱」误读 | Phase 1.3 口径段 | — |
| 资源不足 | 先 A 再 B | Phase 1 仍值得做 |

### 8.6 对「直接做 Task」的纠正

| 原做法 | 纠正 |
|--------|------|
| 拷贝 Task 就从 Task 1 写代码 | 先 Phase 0–1 |
| Task 8 全做 | B 只做 health execTool |
| Task 9 本地 build 即交付 | 必须 DeepTalk 真窗口 Task 9 |
| 契约写 v0.3 已完成 | Phase 4 后才更新 §3 |

---

## 9. 规划提纲（交 plan-create）

**背景与目标**：用 Phase 0–4 门控交付 DeepTalk×VitalSpan 集成；B 轨为轻量工作区壳；A 轨为文档+工具。

**硬约束**：C-01～C-07（§1）

**改动清单草案**

1. Phase 0：契约 §5 决策记录
2. Phase 1：契约 §3/§5 纠偏 + iframe 口径 + Task 修订 + 提交 Task MD
3. Phase 1：E2E 与 A/B 对齐
4. Phase 0.4：v0.3 草稿 revert 或 freeze
5. (B) Phase 2：spike 报告（10 条勾选）
6. (B) Phase 3：Task 1–9 @ deeptalk-plugins
7. (B) Phase 3：`scripts/release.mjs` 打 v0.3.0 zip
8. Phase 4：E2E + smoke
9. Phase 4：契约 §3 更新为已交付（仅全过后）
10. 不修改 VitalSpan backend/fe、DeepTalk 引擎

**验证方案**

| Phase | 探针 |
|-------|------|
| 1 | rg + 人工叙事一致 |
| 2 | spike ≥8/10 |
| 3 | smoke + Task 9 |
| 4 | E2E-CHECKLIST |

**非目标**：5173 iframe · gis sandbox · C 轨 · 平台新 API

**待验证 spike**：Phase 2（B 专用）

**plan-create 前置追溯**：见前置评审 §11 表；本报告 §8.4 为 **执行步真源**。

---

## 10. 验证命令

```bash
# Phase 1
rg "integrations/vitalspan" docs/api/vs-ai-spec/deeptalk-product --glob "*.md"

# Phase 3/4 插件（B）
cd deeptalk-plugins/plugins/vitalspan && npm run smoke
cd deeptalk-plugins && npm run release
```

---

## 11. 交接与下一步

| 你现在做 | 命令/动作 |
|----------|-----------|
| ~~**1. 定 A 或 B**~~ | ✅ **B**（2026-08-24） |
| ~~**2. Phase 1 只改文档**~~ | ✅ commit `1b4f50d6` |
| **3. Phase 2 DeepTalk spike** | ✅ **10/10** · [验收记录](./2026-08-24-deeptalk-vitalspan-phase2-spike.md) |
| **3. Phase 3 Task 1–9** | ✅ 全过 · [Phase 3 审计](./2026-08-25-deeptalk-vitalspan-phase3-audit.md) · [Task 9 验收](./2026-08-25-deeptalk-vitalspan-task9-host-acceptance.md) |
| **4. Phase 4** | ✅ [E2E 收口](./2026-08-25-deeptalk-vitalspan-phase4-e2e.md) · B 轨 **v0.3.0 可交付** |

**推荐默认路径（资源一般）**：**Phase 0 定 B 意图 → Phase 1 文档 → Phase 2 spike → 再决定是否 Phase 3**。

若资源紧：**Phase 0 定 A → Phase 1 → Phase 4**，工作区明确二期。

---

## 12. 与前置评审关系

| 文档 | 关系 |
|------|------|
| [2026-08-24-deeptalk-vitalspan-workspace-adjudication.md](./2026-08-24-deeptalk-vitalspan-workspace-adjudication.md) | **判+纠**（为何这样做） |
| **本报告** | **给+怎么做**（Phase 0–4 操作手册） |

二者合并 = 完整 project-grounded-review 链；plan-create 以 **本报告 §8.4 + §9** 为输入。
