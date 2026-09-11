# 项目锚定方案评审 — DeepTalk × VitalSpan 工作区插件怎么落地

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-24 |
| Skill | `~/.cursor/skills/project-grounded-review/` |
| 问题 | 文档/代码冲突分析后，DeepTalk 对接应按何路径实施？iframe 是否与「不做沙箱」冲突？ |
| 选项 | S0 维持 v0.2.16 · A 仅文档 · B 轻量工作区 · C 完整 BI 工作区 |
| 裁决 | **RECOMMEND_SYNTHESIZED**（分 Phase 0–4；Phase 1 文档必做；Phase 3 仅 B 轨且需 spike 通过） |
| 方向纠正强度 | **改道** |
| 置信度 | **MEDIUM**（DeepTalk 宿主字段未在本仓 T1 验真；B 轨依赖宿主能力） |
| **交付** | 判 + 纠 + 给（§6–§9 完整） |

---

## 1. 项目约束摘录

| ID | 来源 | 约束 |
|----|------|------|
| C-01 | [WORKSPACE-PLUGIN-CONTRACT.md](../../api/vs-ai-spec/deeptalk-product/WORKSPACE-PLUGIN-CONTRACT.md) · 何奥产品定论 | 交付形态 = **安装 vitalspan 插件 zip → 新建特殊工作区**；非 sync `integrations/vitalspan/` |
| C-02 | [IRON-RULES.md](../../api/vs-ai-spec/IRON-RULES.md) §1–§6 | wf2 `artifactId`、wf3 `dashboardId`、5173 验收、bundle `(p&&p.style)` **不变** |
| C-03 | [geo-map-offline-china.mdc](../../../.cursor/rules/geo-map-offline-china.mdc) · [arch.md](../../arch.md) ADR-12 | gis-map / BI **不做** iframe 嵌 GeoLibre 整应用 / 在线瓦片 |
| C-04 | [deeptalk-vitalspan-integration.mdc](../../../.cursor/rules/deeptalk-vitalspan-integration.mdc) | 工作区 iframe **禁止 fetch :8000**；Agent `components.tools` 在 Node 内 fetch **合法** |
| C-05 | [goal.md](../../automate/goal.md) · [plan.md](../../automate/plan.md) | 里程碑重心在 VitalSpan 平台 M1–M-FINAL；**DeepTalk 工作区不是 PRD 功能项**，属集成交付层 |
| C-06 | [PREFLIGHT-DUAL-TRACK.md](../../api/vs-ai-spec/deeptalk-product/PREFLIGHT-DUAL-TRACK.md) | 插件默认可 wf2/wf3；**full styleCompliance** 仍可能需 `VITALSPAN_ROOT` / Python |
| C-07 | 用户会话约束 | **评估未完前不改业务代码**；契约 §5「已选 B」**未经正式拍板** |

**T1 现码锚点（插件 · 生产可用基线）**

- `deeptalk-plugins/plugins/vitalspan` **v0.2.16**：`components.tools` ×14 + `skills/vitalspan-bi`；**无** workspaceTemplates / views / execTools（截至评审时对外 release 语义）
- 本地存在 **v0.3.0 草稿**（工作区相关文件）：**未经验收、未获用户批准**，不得视为已交付

**T1 文档锚点（已部分收口）**

- commit `59a1bddc`：README、AGENT-SYSTEM-PROMPT、E2E、IRON-RULES §7、PREFLIGHT-DUAL-TRACK、Cursor 规则等已修订
- 未提交/待对齐：`SPECIAL-WORKSPACE-PLUGIN-TASK.md`；`WORKSPACE-PLUGIN-CONTRACT.md` §3/§5 与事实不符处

---

## 2. 问题重述

**用户问题**：冲突分析计划落地时**要怎么做**？iframe 是否与「不做沙箱」冲突？当前要改的方案是什么？

**纠正后问题**（§7 重定义）：

> 在 **不改动 VitalSpan 平台 (:8000/:5173) 与 wf2/wf3 铁律** 的前提下，如何分阶段闭合 **DeepTalk 对接叙事分裂**，并在 **用户正式选择轨道后** 才实施 **deeptalk-plugins** 工作区能力；如何避免把 **DeepTalk 插件壳 iframe** 误判为 **VitalSpan BI 沙箱**。

---

## 3. 选项归一

| 选项 | 范围 | 用户可见变化 | 主要成本 |
|------|------|--------------|----------|
| **S0** | 维持 v0.2.16 + 旧叙事 | 仅聊天调工具 + 5173 | 文档与产品定论持续冲突 |
| **A** | S0 + **文档收口** | 无新 UI；Agent 少误导 | 低；1–2 人日文档 |
| **B** | A + **轻量工作区** | 新建 VitalSpan BI 工作区；向导绑 API/FE；home 页 health + 跳 5173 | 中；插件 Task 1–9 + **DeepTalk 真机 spike** |
| **C** | B + iframe 内 list/compose/delete | DeepTalk 内更多平台操作 | 高；execTools 面大；**仍不能替代 5173 编辑器** |

**归一说明**：Cursor 原 plan 将 **A/B/C 决策**、**文档修订**、**v0.3 插件实现** 绑在同一 todo 链并标「已完成」——与 **「先评估、后实施」** 冲突；本评审将其拆为 **Phase 0 决策门 + Phase 1 文档 + Phase 2 spike + Phase 3 实现**。

---

## 4. 证据与假设

| # | 证据 | 层级 | 结论 |
|---|------|------|------|
| E1 | v0.2.16 `plugin.json` 仅 tools+skills | T1 | B/C 所需 manifest 组件 **当前生产基线缺失** |
| E2 | WORKSPACE-PLUGIN-CONTRACT §5 写「已选 B」 | T2 文档 | **超前**；用户未拍板 |
| E3 | ADR-12 / gis 规则「不做 iframe/sandbox」 | T0 | 指 **BI/gis 运行时**，非 DeepTalk 插件视图容器 |
| E4 | Task SOP：`CSP connect-src none` + `pluginExec` | T2（DeepTalk 仓待 T3 验） | B 轨 health 必须 execTools，不能 iframe fetch |
| E5 | `59a1bddc` 已提交文档修订 | T1 | Phase 1 **部分已完成**，需纠偏 §3/§5 |
| E6 | goal/plan 无 DeepTalk 工作区里程碑 | T0 | 集成层 **不阻塞** M-RPT；但 **不应占用平台 FE/BE 资源** |
| E7 | 三处工具实现（py/cli/TS） | T1 | 长期漂移风险；**非 Phase 1 阻塞** |

**假设（T3 · 待 spike 验证）**

- DeepTalk 开发宿主已支持 `workspaceTemplates`、`workspaceSetup.complete`、`pluginExec` 与 `viewOptions.height.fill`
- 字段以 `deeptalk/docs/features/plugin-views.md` 等为准（VitalSpan 仓仅指针）

---

## 5. 多维打分

权重：合规 30 · 可交付 25 · 成本 20 · 可维护 15 · 用户价值 10

| 选项 | 合规 | 可交付 | 成本 | 可维护 | 用户价值 | 加权 |
|------|------|--------|------|--------|----------|------|
| S0 | 4 | 8 | 9 | 7 | 4 | **6.5** |
| A | 9 | 8 | 9 | 8 | 5 | **8.0** |
| B | 8 | 6* | 6 | 7 | 8 | **7.0** |
| C | 6 | 4 | 3 | 5 | 7 | **5.0** |

\*B 可交付在 **未做 DeepTalk spike 前** 降为 6；spike 通过后升为 8。

---

## 6. 裁决

**推荐**：**RECOMMEND_SYNTHESIZED**（置信度 **MEDIUM**）

**一句话**：**先做 Phase 0 轨道拍板与文档纠偏（含撤销「B 已选 / v0.3 已完成」），Phase 1 闭合文档；仅当选择 B 且 DeepTalk spike 通过后，再在 deeptalk-plugins 做轻量工作区；C 轨与 TS 化全量 preflight 一律后置。**

**相对 Cursor 原 plan 的纠正**：

| 原 plan | 问题 | 纠正 |
|---------|------|------|
| todo 全标 completed | 评估未结束即宣称完工 | Phase 门控；实现 todo 依赖 spike |
| 契约 §5「已选 B」 | 未经用户决策 | 改回 **待决策** 或写入会议纪要后再定 |
| 分析 plan 直接驱动 v0.3 代码 | 越权实施 | v0.3 草稿 **回滚或冻结**，直到 Phase 3 |
| iframe = 沙箱冲突 | 概念混层 | 文档加 **壳 iframe vs BI 引擎** 分界（见 §8.2） |
| Phase 1 与 Phase 3 并行 | 节奏错 | **文档 → spike → 插件** 严格顺序 |

**不推荐**

- **RECOMMEND_C**：违反 C-03/C-04 边界风险高，且不能替代 5173（性价比低）
- **RECOMMEND_S0 长期**：违反 C-01 产品定论（仅可作过渡）

---

## 7. 规划方向纠正

**原方向错在哪？**

1. 把 **冲突分析报告** 当成 **已批准的实施合同**，跳过 A/B/C 拍板与 DeepTalk 宿主验真。
2. 在 **WORKSPACE-PLUGIN-CONTRACT** 中把 **目标态** 写成 **现态**（v0.3 已完成、B 已选）。
3. 将 **DeepTalk 插件 iframe**（宿主标准容器）与 **VitalSpan「BI/gis 不做 sandbox」** 混为一谈，引发不必要的架构顾虑。
4. 改动散在 **VitalSpan 文档 auto-commit** 与 **deeptalk-plugins 草稿** 两处，缺少 **单一 Phase 门控**。

**纠正后目标（一句话）**

> 以 `WORKSPACE-PLUGIN-CONTRACT` 为产品叙事真源，先闭合文档与决策门；若选 B，则在 DeepTalk 真机 spike 通过后，仅改 `deeptalk-plugins/vitalspan` 交付轻量工作区壳（绑环境、health、跳 5173），BI 交付仍走 Agent tools + 5173。

**应停止**

- 在用户拍板前继续改 `deeptalk-plugins` 工作区代码或发布 v0.3 zip
- 在 iframe 内嵌 5173 / 跑 gis-map / customViz 完整编辑器
- 将 `integrations/vitalspan` 写回客户交付主路径
- 把 plan 文件 todo 标 completed 当作项目状态

**应优先**

1. **Phase 0**：轨道决策（A 或 B）+ 修正契约 §5/§3 超前表述
2. **Phase 1**：文档断链与 E2E 对齐（`SPECIAL-WORKSPACE-PLUGIN-TASK.md` 入库、iframe 口径段落）
3. **Phase 2**（仅 B）：DeepTalk 宿主 10 条 spike（Task 9 子集）
4. **Phase 3**（仅 B spike 过）：插件 Task 1–9 最小闭环

**与里程碑对齐**

| 对齐项 | 当前 Cursor/plan 倾向 | goal/plan | 纠正建议 |
|--------|----------------------|-----------|----------|
| 范围 | 文档+插件+决策一次做完 | 平台 M-RPT companion 活跃 | DeepTalk 集成 **单列集成 Epic**，不占 VitalSpan FE/BE 里程碑 |
| 验收 | 本地 build/smoke | 5173 + API 合同 | B 轨增加 **DeepTalk 真窗口** 为硬门禁 |
| 产品定论 | 已写进契约 | goal 未列 DeepTalk | 正确：集成层服从 C-01，不反向改 G1–G5 |

---

## 8. 推荐解决方案（合成）

### 8.1 方案摘要

**名称**：SYNTH-A→B（文档先行 + 门控 B 轨）  
**类型**：SYNTHESIZED（A 的文档闭合 + B 的条件实施）  
**一句话**：无论选 A 还是 B，先统一文档与决策；**只有选 B 且 spike 过** 才做工作区插件。

### 8.2 目标与非目标

| 目标（Phase 1 必做） | 非目标（本期不做） |
|----------------------|-------------------|
| 文档真源单一：`WORKSPACE-PLUGIN-CONTRACT` hub | 改 DeepTalk 引擎源码 |
| 修正 §5「已选 B」/ §3「v0.3 已完成」 | iframe 内嵌 5173 管理面 |
| 入库 `SPECIAL-WORKSPACE-PLUGIN-TASK.md` | iframe 内 gis-map / GeoLibre 整应用 |
| 写清 **壳 iframe ≠ BI 沙箱** 口径 | C 轨 list/compose/delete |
| legacy `executor/cli` 标开发备用 | VitalSpan 平台新 API |
| 用户正式记录 A 或 B 决策 | Python preflight 全量 TS 化（Phase 5 可选） |

**iframe 分界（回答用户顾虑）**

| 层 | iframe? | 是否违反「不做沙箱」 |
|----|---------|---------------------|
| DeepTalk 插件 home/向导（几屏 UI） | 是（宿主 CSP 容器） | **否** — 不是 BI 引擎 |
| VitalSpan 5173 编辑器 | **否**（外链） | **否** |
| gis-map / customViz 在 5173 渲染 | 否（平台父页） | **否** |
| 5173 或 gis 嵌进 DeepTalk iframe | **禁止** | **是** — 违反 C-03/C-04 |

### 8.3 架构与触及面

| 层 | 动作 | 路径/模块 | 复用 |
|----|------|-----------|------|
| 文档 | 纠偏 + 决策记录 | `docs/api/vs-ai-spec/deeptalk-product/*` | 已有 `59a1bddc` 修订 |
| 文档 | iframe 口径 | `WORKSPACE-PLUGIN-CONTRACT` § 新增小节 | IRON-RULES §7 |
| 插件（仅 B·Phase 3） | workspace 模板/视图/execTools | `deeptalk-plugins/plugins/vitalspan/` | v0.2.16 tools 不动 |
| 插件（仅 B） | instanceConfig 读盘 | `shared.ts` + `readWorkspaceMeta.ts` | 已有草稿可复用 **若** Decision=B |
| VitalSpan 平台 | **无改动** | — | wf2/wf3 API 已有 |
| DeepTalk 宿主 | **只读 spike** | `deeptalk/docs/features/*` | 不改引擎 |

### 8.4 实施步骤（有序）

| 步 | 内容 | 依赖 | 验收 |
|----|------|------|------|
| **0** | **轨道决策**：A（仅文档+工具）或 B（+工作区）；会议纪要写入契约 §5 | 本报告 | §5 无「超前已选」；有 dated 决策句 |
| **1** | 文档纠偏：§3 改回「v0.2.16 基线 + B 待实施」；补 iframe 分界段 | 0 | `grep integrations/vitalspan` 仅出现在「开发备用」上下文 |
| **1b** | 提交 `SPECIAL-WORKSPACE-PLUGIN-TASK.md`；E2E 与决策一致 | 0 | 无断链 |
| **2** | 处理 v0.3 草稿：**冻结或 git revert** deeptalk-plugins 工作区改动，直至 0=B | 0 | release 仍可为 v0.2.16 |
| **3** | **（仅 B）DeepTalk spike**：装插件、新建工作区、向导、home、pluginExec health | 0=B, 1 | Task 9 清单 ≥8/10 通过 |
| **4** | **（仅 B）** 插件 Task 1–9 实施 + `npm run release` | 3 | `E2E-CHECKLIST` §1–§3 + smoke |
| **5** | 可选：评估 Python→TS 全量 preflight | 4 或 A | `PREFLIGHT-DUAL-TRACK` 更新决策 |

### 8.5 风险与回退

| 风险 | 缓解 | 回退 |
|------|------|------|
| DeepTalk 宿主字段与 Task SOP 不一致 | Phase 3 前只读核对三份 features  doc | 降级 **A 轨**，保留文档 |
| 文档已 commit 但决策变 A | §5 写清「工作区二期」 | 插件不发布 workspace 组件 |
| v0.3 草稿与 v0.2.16 混淆 | Phase 2 明确 revert | 继续用 v0.2.16 zip |
| Agent 仍引用 integrations 路径 | Cursor 规则 + AGENT prompt 已改；补 grep CI | 文档 hotfix |

### 8.6 对 Cursor 原方案的具体纠正

| 原建议 | 问题 | 纠正后做法 |
|--------|------|------------|
| plan todo 全部 completed | 虚假进度 | 以 Phase 0–5 门控替代 |
| 默认 RECOMMEND B 并写进契约 | 无用户拍板 | Phase 0 决策门 |
| 分析后立即 v0.3 代码 | 越权 | spike 后再 Task 1–9 |
| 「列表 + 跳 5173」与 iframe 沙箱冲突 | 概念混层 | §8.2 分界表进契约 |
| TS 化 preflight 与工作区捆绑 | scope 膨胀 | Phase 5 独立可选 |

---

## 9. 规划提纲（交 plan-create）

**背景与目标**：闭合 DeepTalk×VitalSpan 对接叙事；在用户选择 B 且 DeepTalk spike 通过后，交付轻量 VitalSpan BI 工作区壳；wf2/wf3/5173 铁律不变。

**硬约束**：C-01～C-07（§1）

**改动清单草案**（≤10 条）

1. 修正 [WORKSPACE-PLUGIN-CONTRACT.md](../../api/vs-ai-spec/deeptalk-product/WORKSPACE-PLUGIN-CONTRACT.md) §3/§5 + 新增 iframe 分界小节
2. 提交 [SPECIAL-WORKSPACE-PLUGIN-TASK.md](../../api/vs-ai-spec/deeptalk-product/SPECIAL-WORKSPACE-PLUGIN-TASK.md)
3. 新增决策记录段（A 或 B + 日期 + 决策人）
4. （若 A）E2E 删除/标注工作区条目为「二期」
5. （若 B）revert/冻结 deeptalk-plugins v0.3 草稿 → spike → 再实现
6. （若 B）`deeptalk-plugins` Task 1–9 + release.mjs 已支持 workspace-templates/exec-tools
7. （若 B）DeepTalk 真机 Task 9 验收
8. 不修改 `backend/`、`fe/` 业务代码
9. 不修改 DeepTalk 引擎
10. 可选 Phase 5：`PREFLIGHT-DUAL-TRACK` TS 化评估单

**验证方案**

| Phase | 探针 |
|-------|------|
| 1 | 人工：契约/README/AGENT 叙事一致；无「integrations 为主路径」 |
| 2 | `deeptalk-plugins/plugins/vitalspan`: `npm run smoke`（v0.2.16 基线） |
| 3 | DeepTalk 真窗口：E2E-CHECKLIST §1 |
| 4 | `npm run release` + E2E §1–§5 |

**非目标**：5173 iframe 化 · gis sandbox · C 轨 · VitalSpan 新 API · DeepTalk 引擎 PR

**待验证 spike（DEFER_VERIFY）**：DeepTalk `workspaceTemplates` + `pluginExec` + 向导 `workspaceSetup.complete` 字段与 Task SOP 一致

---

## 10. 验证命令

```bash
# VitalSpan 文档一致性（Phase 1）
rg "integrations/vitalspan" docs/api/vs-ai-spec/deeptalk-product --glob "*.md"

# 插件基线（Phase 2 · v0.2.16）
cd deeptalk-plugins/plugins/vitalspan && npm run smoke

# 工作区（Phase 4 · 仅 B）
cd deeptalk-plugins && npm run release
# + DeepTalk 真机 E2E-CHECKLIST §1
```

---

## 11. 交接与下一步

| 下一步 | 条件 |
|--------|------|
| **用户拍板 Phase 0（A 或 B）** | 立即 |
| `/plan-create` 附本报告 §9 | 拍板后 |
| revert v0.3 草稿 | 拍板 A，或 B 但在 spike 前 |
| DeepTalk spike（1–2 人日） | 拍板 B |
| `feature-truth-verify` | Phase 4 完成后 |

**plan-create 前置评审追溯**

| # | 类型 | 结论/约束 | 计划应体现 |
|---|------|----------|------------|
| 1 | 纠正后目标 | §7 一句话 | 背景与目标 |
| 2 | 推荐方案 | SYNTH-A→B Phase 0–4 | 改动清单 |
| 3 | 非目标 | §8.2 | 非目标 |
| 4 | 硬约束 | C-01～C-07 | 硬约束 |
| 5 | 验收 | §8.4 / §10 | 验证方案 |
| 6 | 停止项 | §7 应停止 | 非目标/风险 |
| 7 | spike | DeepTalk 宿主 | Phase 3 门控 |
