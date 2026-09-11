# 规则目录（按栈裁剪）

生成到目标仓 `.cursor/rules/*.mdc` + 根 `AGENTS.md`。**先做** [stack-detect.md](stack-detect.md)。

## 必产（与框架无关）

| 文件 | 内容 |
|------|------|
| `project.mdc` | 定位、栈、目录、任务路由、必读 arch/goal |
| `production.mdc` | [redlines](redlines.md) 生产向：日志/HA/多库/认证/热改/**国密**/弹性/观测/RBAC/作业/测试/备份… |
| `engineering.mdc` | 体量、信封、分层上浮、超时幂等（代码侧） |
| `delivery.mdc` | 交付门禁**指针** → release-package / deploy-dev（不写打包步骤） |
| `prd-sync.mdc` | docs taxonomy + 可消费深度 + runbook |
| `AGENTS.md` | 长期非显而易见约定 + 技能指针 |

## 后端框架 / 前端 / Go 公共

同前：go-zero · goframe · fastapi · flask · express · hono；FE → fe-ui ± fe-help；Go 多包 → go-common。

## 与姊妹 skill（勿把全文塞进 mdc）

| Skill | rules 中的关系 |
|-------|----------------|
| create-evolution-arch / goal | 缺真理源先补；arch H7 数据目录与 [db-layout.md](db-layout.md) 对齐 |
| **create-evolution-prd** | 功能 PRD；AGENTS 指针；非 `.dev` 台账 |
| **release-package** | 构建产物、打包装、上传 S3；delivery.mdc 只钉门禁并指向它 |
| **deploy-dev** | 演示机部署 |
| **create-dev-config** | **仓库** `.dev`：本项目运行/走查/release/deploy |
| **create-home-dev** | **家目录** `$HOME/.dev`：外部集成 smoke 选源；AGENTS + delivery 双 `.dev` 指针（[project-pointer.md](../create-home-dev/references/project-pointer.md)） |
| code-reviewer / docs-reviewer / create-ui-docs | 假绿、文档深度、UI 基准 |

## 禁止

- 未探测栈默认 go-zero；delivery 里复制一整本 release 手册
- 抄参考仓业务事实；占位符未替换就提交
