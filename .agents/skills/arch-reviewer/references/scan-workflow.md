# Scan Workflow（Arch Card + Explore）

## Phase 0 · Arch Card 提示（主 agent）

快速读（有则读，无则记「缺失」）：

```text
优先路径：
- CONTEXT.md
- docs/arch.md
- docs/domain/**
- docs/adr/**
- README.md（仅域名词与模块地图，不深挖）
```

产出表（写入报告 header / 对话摘要）：

| 字段 | 例 |
|------|-----|
| 范围 | 整仓 / `internal/order` + `apps/api` |
| 域名词 | Order, Pricing, Entitlement… |
| ADR 禁区 | ADR-0007：禁止跨服务共享 DB… |
| 栈摘要 | Go monorepo + React console |
| 用户痛点 | 「改定价要动 8 个包」 |

## Phase 1 · Explore subagent 分工

默认并行 2～3 路 `explore`（readonly）。仓极小可主 agent 自扫。

**有新鲜 `.codegraph/` 时**（先 `codegraph status`，pending → sync；失败则当无图）：主编排或 E2/E3 用 CLI 补事实——`codegraph callers` / `callees` / `impact` 看扇入扇出与跨层边；约定见 [code-scanning](../../code-scanning/SKILL.md)。图的「没找到」不能单独证明无耦合。

| Lane | 焦点 | 回传 |
|------|------|------|
| E1 概念散射 | 同一域名词落在哪些路径；跳转次数 | 摩擦点 F-*（候选草稿：F4） |
| E2 浅包装 / 透传 | Handler→Service→Helper 同名链；deletion test；**有图则对照 callees 是否同名透传** | 摩擦点 F-*（候选草稿：F1） |
| E3 缝与测试 | 跨包依赖、adapter 数量、测试 mock 面宽度；**有图则对照跨层 callers** | 摩擦点 F-*（F2/F5/F6） |

### Subagent 提示词骨架

```text
你在做架构摩擦探索（只读）。项目根：{{ROOT}}
范围：{{SCOPE}}
域名词：{{TERMS}}
已知 ADR 禁区：{{ADRS}}

只使用词汇：module, interface, implementation, depth, shallow, deep, seam, adapter, leverage, locality。
不要报假绿/stub（那是 code-reviewer）；不要建议「再加一层 service」。

请有机阅读代码，寻找：
- shallow module（interface ≈ implementation）
- seam leakage
- 无 locality 的纯函数拆分
- 单 adapter 假想缝
- 难测宽 interface

对每个嫌疑做 deletion test（一句话结论）。
穷尽：凡可判 polish_safe 的摩擦全部进摩擦证据池（禁止只交 Top 候选卡）；主 agent 再聚类成候选卡 3～7。

【密度下限（硬约束）】
- 本 lane 回传摩擦点 ≥ 5；不足 5 时**必须**在末尾加 EXHAUSTED 段：
  - 实际查过的包/目录清单
  - codegraph 查询次数与查询语句
  - 跑过 deletion test 的次数
  - 主观信心：high | medium | low
- 禁止「找到 1～2 个候选就返回」；摩擦点是原材料，越多越好
- 无 EXHAUSTED 段且 < 5 → 视为未完成，进 Blind spot

回传格式（每个摩擦点，**不归并**）：
### F-n · 摩擦一句话标题
- Friction: F1|F2|F3|F4|F5|F6
- Path: 文件:行号
- Evidence: ≥2 个代码引用（关键行 verbatim 或 rg 行号）
- Candidate_hint: 可能归入哪类候选（shallow / seam-leak / locality / leverage / 单 adapter 假缝 / 难测宽 interface）
- Deletion test: …（仅对 shallow 包装类）
- Confidence: high | medium | low
```

## 主 agent 合并

1. 收齐 E1/E2/E3 全部摩擦点 F-*（**不归并、不吞**）
2. 按根因聚类成 3～7 张候选卡；每张挂多个 `evidence_refs: [F-*, …]`；无证据的候选 → 删除
3. 为每张候选卡判定 strength（Strong/Worth exploring/Speculative）+ authorization（polish_safe/local-deepen/structural）
4. 选 Top recommendation（优先 Strong + 用户痛点对齐）
5. 渲染 HTML（候选卡 + **附摩擦证据池表**）→ 打开（`open` macOS / `xdg-open` Linux / `start` 即 PowerShell `Start-Process` Windows）→ 默认 mode=auto-fix 停问（见 SKILL Phase 2/2.5）
6. 落盘 Markdown 主报告：`docs/material/arch-reviewer/<YYYY-MM-DD>-<slug>.md`（必须；含候选 + 摩擦证据池；见 SKILL Phase 2.5）

## 降级

- 无 Task/subagent：主 agent 按 E1→E2→E3 顺序，仍须覆盖三类摩擦；密度下限仍适用（每类 ≥ 5 摩擦点或 EXHAUSTED）
- 某 lane 失败：重试 1 次 → 主 agent 补读入口包 → 报告注明 Blind spot（该区探索不足）
