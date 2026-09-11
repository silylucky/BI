# SOP 索引

本目录存放 Automations 流程指导文档，部署于 `.cursor/automate/sop/`。

| 文件 | 用途 | Automations 入口 |
|------|------|------------------|
| [self-evolution.md](./self-evolution.md) | 无 Issue 的自我演化流水线（G0→P5，文档驱动选题） | `Read .cursor/automate/sop/self-evolution.md` |
| [self-evolution-github.md](./self-evolution-github.md) | 同上，**GitHub MCP** 管理 PR（Automations 无人值守） | `Read .cursor/automate/sop/self-evolution-github.md` |
| [gitlab-issue.md](./gitlab-issue.md) | 仅处理已有 GitLab Open Issue（Bug/功能 → MR 闭环；无 Issue 则结束） | `Read .cursor/automate/sop/gitlab-issue.md` |

各 SOP 可共用 `skills/` 与 `agents/`，按 Automations 任务与代码托管平台选用其一，勿混跑。
