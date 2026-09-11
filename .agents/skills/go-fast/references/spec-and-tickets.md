# 内嵌：出规格 + 拆工单（仅 go-fast 内部使用）

不开 issue、不发跟踪器。只写仓库文件。

---

## A. 规格模板 → `docs/specs/<slug>.md`

`slug`：短 kebab-case；重名加日期后缀。

**开工就绪（须全满，否则不得进入拆单/红绿）**

- [ ] 可观察成功结果（业务结果，非「代码写完」）
- [ ] **可观察验收**为真实路径句式（禁 mock/stub/假数据验收）
- [ ] **测试决策**写明 seam
- [ ] **范围外**已写
- [ ] 用语与 goal/domain/arch 一致
- [ ] **规格门**：已跑 plan-reviewer `go-fast-spec-gate`（或用户明示 skip）；硬门槛已清

```markdown
## 问题陈述

用户面临的问题，从用户视角描述。

## 方案

解决方案，从用户视角描述。

## 用户故事

1. 作为 <角色>，我想要 <功能>，以便 <收益>
（尽量详尽）

## 可观察验收

1. 在 <入口/角色>，当 <操作>，则 <可见结果>（真实依赖路径；非 mock）
（至少：主成功 + 一个关键失败/拒绝）

## 实现决策

- 模块/接口/架构/Schema/API/交互等已钉决策
- 勿写易过时的具体文件路径；原型比特可例外内联

## 测试决策

- 只测外部行为
- **seam**：测哪些公共边界；不测哪些内部；系统边界谁 fake
- 可参考的仓内既有测试

## 范围外

明确不做的事。

## 补充说明

其他说明。
```

**写法纪律**：不访谈；只综合对话 + 扫仓已掌握信息。信息不足 → 整条 go-fast `BLOCKED`，不写空壳规格。  
若需求来自已确认的 [product-blueprint](../../product-blueprint/SKILL.md)，按该 skill [spec-map.md](../../product-blueprint/references/spec-map.md) 映射章节；蓝图路径写入「补充说明」。流程叙事仍不清 → 见 go-fast「流程叙事不清」，勿编实验室主路径。

**来自 product-reviewer**：综合「处理清单」中 `视觉债=否` 且 `open` 的项（硬门槛=是优先）；报告路径写入规格「补充说明」。  
`docs/material/product-reviewer/**` **不是**本文件的替代品——仍须写出开工就绪的 `docs/specs/<slug>.md`。

**规格门（出规格之后、本节 B 之前）**：按主 Skill 调用 [plan-reviewer](../../plan-reviewer/SKILL.md) `mode: go-fast-spec-gate`，自动修本文件 P0（及清硬门槛所需 P1），再进入拆单。门未过 → 不写 tickets。

---

## B. 工单模板 → `docs/specs/<slug>/tickets/<NN>-<ticket-slug>.md`

从已就绪规格拆 **tracer bullet**。一工单一文件，从 `01` 起按依赖序编号（阻塞者在前）。**禁止**合成单文件总表代替工单目录。

### 竖切规则

- 每片沿各层切出窄而完整通路（schema、API、UI、测试）——纵向，非按层横切
- 完成一片应可单独演示/验收；体量能装进一个新上下文窗口
- prefactor / `refactor-shared` 放在被它解阻的实现片之前；多页前端批次的 S0 壳层工单排最前（见 [parallel.md](parallel.md) §1.2、§1.3）
- 宽重构用 expand → 分批迁移 → contract；勿硬塞进单张竖切却要求全绿

### 工单正文

```markdown
# <NN> — <工单标题>

**要做什么：** 从用户视角描述本单打通的端到端行为——不是按层罗列实现清单。

**阻塞于：** 卡住本单的编号/标题，或「无——可立即开工」。含 API/类型依赖 **与** 共享壳/RBAC/状态机等产品语义前置。

**预计路径白名单：** `glob1`, `glob2`（供并行判定；可粗；优先刺点证据路径）

**对应刺点：** `B-*`（若有；硬门槛项须靠前编号）。本字段即回传 `slices[].finding_ids` 的来源：本批每个 finding 须**恰好**落在一张工单上，不重不漏

**slice-id：** `S3`（派发、`evidence-run --slice`、go-fast 回传 `slices[].id` 用同一个值；红绿工件靠它配对，**禁止**多片共用一个，**禁止**事后改名 —— 编排方 `gate-check batch --slices` 直接吃这个值）

**验证命令：** `$EV --slice S3 --phase green -- <带路径的相关测>`（**禁止**裸 `pnpm test` / 无路径全量；详见 [evidence.md](evidence.md)）

**状态：** ready-for-agent

- [ ] 验收标准 1（真实路径、可观察）
- [ ] 验收标准 2
```

避免易过时文件路径写进验收正文；白名单字段除外（供编排）。

### `refactor-shared` 工单（结构性）

触发条件与完成判定见 [parallel.md](parallel.md) §1.3。与普通工单不同：**没有产品验收句**，验收全是结构性的；编号排在被它解阻的实现片之前。

```markdown
# <NN> — refactor-shared：<被收敛的能力>

**类型：** refactor-shared（独占一波 · 允许跨白名单 · 只搬不改行为）

**重复现状：** 列出 ≥2 个重复位置的实际路径

**收敛目标：** 提取到 `<路径>`，导出 `<名字>`

**受影响调用点：** 现有 N 处 + 本批哪些片将改指过来

**slice-id：** `RS-<slug>`（回传 `slices[]` 中 `kind: refactor_shared`、`finding_ids: []`）

**验证命令：** `$EV --slice RS-<slug> --phase green -- <覆盖全部调用点的相关测>`

**状态：** ready-for-agent

- [ ] N 处重复收敛到 1 处，原位置不再各自实现
- [ ] 原调用点全部改指新位置，搜不到旧实现的残留引用
- [ ] 相关测绿且用例数未下降（`gate-check slice --slice RS-<slug>` PASS）
- [ ] 行为无变化（**禁止**顺手加功能或改接口语义）
```

### 前沿

**可立即开工** = 「阻塞于」为空或所依赖工单均已 DONE。并行判定（白名单相交、产品语义边、S0 与 `refactor-shared` 的独占波次、`fleet_cap` 默认 20）一律以 [parallel.md](parallel.md) 为准；线性链串行推进。
