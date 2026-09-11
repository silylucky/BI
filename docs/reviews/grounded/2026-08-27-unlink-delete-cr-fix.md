# Code Review 修复完成 — unlink 删除全链路

> 范围：变更面（unlink 删除 + Agent/CLI 对齐）  
> 日期：2026-08-27

## 修复项

| ID | 级别 | 状态 | 说明 |
|----|------|------|------|
| P1-1 executor 默认 unlink | ✅ | `agent_tools` 默认 `unlink=True`；CLI 改 `--no-unlink`  opt-out |
| P1-2 | P1 | 已修 | CLI `delete-ai-viz-artifact.py --unlink` + `vitalspan_http.delete_artifact(unlink=)` |
| P2-1 | P2 | 已修 | `scan_artifact_in_layouts` 单次扫表；delete 路径仅 1 次 `select(Dashboard)` |
| P2-2 | P2 | 已修 | `F17-AIVIZ` AIVIZ-018、`AGENT-SYSTEM-PROMPT`、E2E 清单、agent-tools.schema |
| P2-3 | P2 | 已修 | `test_ai_viz_delete_route.py` 路由契约测 + 单扫单测 |

## 回归

- `pytest tests/test_ai_viz_references.py tests/test_ai_viz_delete_route.py` — **7 passed**
- 插件 `npm run build` — ok

## 使用提示

- **5173 图表盘**：重启 backend 后刷新即可（已有 unlink 确认流）
- **DeepTalk Agent**：重装/热更插件后，`vitalspan_delete_artifact` 默认会从看板移除 widget 再删库
- **CLI**：`python delete-ai-viz-artifact.py <uuid> --unlink`
