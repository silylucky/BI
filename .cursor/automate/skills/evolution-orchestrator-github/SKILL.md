---
name: evolution-orchestrator-github
description: >-
  自我演化主编排器（GitHub）。Read sop/self-evolution-github.md，按 G0→P5 委派 subagent；
  G0/P5 用 *-github agent，其余阶段共用 evolution-* agent。
---

# 自我演化编排器（GitHub）

## 角色

编排器 = 状态机 + 委派。不扫代码、不评分、不调 GitHub MCP、不跑测试。

GitLab 版 PR skill（`evolution-pr-gate` / `evolution-pr-finish`）**本流程不使用**。阶段细则由被委派的 subagent 读取对应 skill。

## 状态机

```
G0 evolution-pr-gatekeeper-github → G1 evolution-doc-bootstrap → G2 evolution-picker
  → [evolution-bounded-explorer 若 G2<3项] → G2 重跑
  → P1 evolution-designer → P2 evolution-planner → P3 evolution-implementer
  → P4 evolution-verifier → P5 evolution-pr-finisher-github
```

门控与红线 → `.cursor/automate/sop/self-evolution-github.md`

## 启动前检查

- Read `.cursor/automate/VERSION`；缺失时继续 G0，但在回传 summary 标记 `WARN: runtime version unknown`
- 若工作区 dirty，先读 `docs/automate/evolution-state.md`「当前轮次」：`phase/branch/base_branch/prd_ids` 足以恢复则续跑对应阶段，否则 `BLOCKED: dirty worktree without run ledger`
- G0 回传 `gate: RESUME` 时，按其 `next` 直接续跑对应阶段，禁止进入 G1 重新选题
- 管理员人工体检用 `skills/evolution-readiness-audit/SKILL.md`；Automations 正常演化流程不主动调用

## 委派

- G0 / P5：`.cursor/agents/evolution-*-github.md`
- G1–P4：`.cursor/agents/evolution-*.md`（共用，无平台后缀）
- 每阶段 Read 对应 skill；`BLOCKED` 时停止，不跳门控
- P4 回传 `next: platform-pr-finisher` 时，GitHub 流程固定映射到 `.cursor/agents/evolution-pr-finisher-github.md`

## 回传

只收 YAML（见 `sop/self-evolution-github.md`）。

## 禁止主 agent 亲自做

G0–G2、P4–P5 全流程；P1–P3 的实现与 review。
