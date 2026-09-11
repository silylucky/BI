# 并发冲突图（loop-goal Phase 2）

在产品地图军团候选之上，判定**谁可同波并行**、**合回顺序**。  
**未完成本步 → 禁止 Phase 3 多 worktree 并行。**

## 边类型（任一成立 → 有冲突边）

| 类型 | 判定 | 同波并行？ | 合回 |
|------|------|-----------|------|
| `path_overlap` | 预期改动 glob / 模块目录相交 | 否 | 先合并一方再开另一方，或合并为同一军团 |
| `shared_shell` | 同改 layout/nav/auth/根路由壳 | 否（壳侧串行） | 壳变更军团先合，或降级为邻域只读 |
| `shared_state` | 同一状态机 / 同一写模型 | 否 | 合并军团或严格串行 |
| `shared_rbac` | 同一权限矩阵 / 角色定义写路径 | 否 | 串行 |
| `doc_truth` | 争写同一份 arch/PRD 真源且会改约束 | 否 | 文档真源变更串行（打磨默认少改） |
| `none` | 上述皆无 | 是（受 `fleet_cap`） | 可并行合入（仍建议一次一个 merge 减冲突） |

软信号（**不自动**否决并行，写入 concerns）：共享只读组件、纯文案 token、测试夹具。

## 算法（务实）

1. 为每个军团候选列出 `touch_globs[]`（来自地图入口 + arch 模块路径 + 路由文件族）。  
2. 两两求交：路径相交 → `path_overlap`。  
3. 任一候选 `touch_globs` 命中壳目录（如 `layouts/`、`shell/`、根 `router`、`auth/`）→ 与其他命中壳者连 `shared_shell`。  
4. 产品地图「交互与引用」里写模型/状态机边 → `shared_state`。  
5. **合并**：若 A↔B 强冲突且 scope 可合成有界名 → 合成一军团，删边。  
6. **着色/波次**：把军团当图节点，冲突边为无向边；同一波 = 独立集，大小 ≤ `fleet_cap`；贪心按「主路径优先」取波。  
7. **合回序**：波内按「无入边优先」；跨波必须等前波合入 `base_branch` 后再切后波分支（默认自最新 base）。

`merge_policy=serial_all` → 每波 `fleet_cap` 强制为 1。

## 产出文件

`docs/material/loop-goal/<YYYY-MM-DD>-<slug>-conflict-graph.md`

```markdown
# Conflict Graph · <slug>

## 节点（军团）
| id | scope | touch_globs | 备注 |
|----|-------|-------------|------|

## 边
| a | b | type | 处置（merge_legions / serial / ok_parallel） |
|---|---|------|-----------------------------------------------|

## 波次
| wave | legion_ids | 并行？ | 合回序 |
|-----:|------------|--------|--------|
| 1 | L1,L3 | yes | L1→L3 或任意（无边） |
| 2 | L2 | — | 待 wave1 合入后 |

## 延期
| id | 原因 |
|----|------|
```

## 禁止

- 有 `path_overlap` / `shared_state` 边仍标 `ok_parallel` 且同时合入 base  
- 用「文件名不一样」忽略共享壳 / RBAC  
- 把冲突分析做成空表却宣称可全速并行
