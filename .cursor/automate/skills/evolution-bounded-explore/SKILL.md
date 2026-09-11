---
name: evolution-bounded-explore
description: >-
  有界代码探索：定向 Grep/搜索、更新 evolution-state 待办池，供 evolution-picker 凑满 5 项。
  由 subagent evolution-bounded-explorer 执行。
---

# 有界探索

## 何时使用

- `evolution-picker` 凑不满 3–5 项时
- `evolution-state` 待办池不足时
- **禁止**主 agent 亲自探索

## 预算（强制）

| 限制 | 值 |
|------|-----|
| Grep / SemanticSearch 次数 | ≤ **3** 次 |
| 深入目录数 | ≤ **2** 个 |
| 读取源文件数 | ≤ **10** 个 |
| 全盘遍历 | **禁止** |

## 流程

1. 读 `docs/automate/goal.md`、`docs/automate/prd.md` 薄弱项汇总（只读文档定假设）
2. 立 1–2 个探索假设（如「AUTH 模块测试覆盖薄弱」）
3. 定向搜索，记录**文件路径 + 一行结论**，不贴代码
4. 产出 1–5 条改进候选，每条含：
   - 标题、涉及路径、预估文件数、建议主攻薄弱维
5. 写入 `docs/automate/evolution-state.md`：
   - **待办池**追加项
   - **模块地图**更新
   - **上次扫描摘要**（3–5 条）

## 与 prd-bootstrap 区别

| | bounded-explore | prd-bootstrap |
|--|-----------------|---------------|
| 目的 | 补待办池、凑选题 | 生成完整 prd.md |
| 范围 | 2 目录、有假设 | 3 一级模块、全功能清单 |
| 产出 | docs/automate/evolution-state | docs/automate/prd.md + 8 维初评 |

## 回传

```yaml
status: DONE
phase: bounded-explorer
artifacts: [docs/automate/evolution-state.md]
summary:
  - "新增待办 3 项"
  - "探索目录: src/auth, src/api"
next: evolution-picker
```

**禁止**向主 agent 回传源码内容。
