# VitalSpan 文档索引

> **阅读顺序**：SRS 边界 → PRD 功能 ID → 域附录 → API 契约 → 架构 → 代码。  
> 文档分层与同步规则：`.cursor/rules/docs-layer.mdc` · `.cursor/rules/prd-sync.mdc`

## 真理源（按层）

| 层 | 路径 | 回答什么问题 |
|----|------|--------------|
| **SRS** | [srs/README.md](srs/README.md) | 需求合同、分期、附录 |
| **Goal / Plan** | [automate/goal.md](automate/goal.md) · [automate/plan.md](automate/plan.md) | 产品方向、活跃里程碑 |
| **PRD** | [automate/prd.md](automate/prd.md) · [automate/prd/](automate/prd/) | 做什么、验收标准、代码锚点 |
| **业务域** | [services/README.md](services/README.md) | 后端域职责、边界、依赖 |
| **API** | [api/README.md](api/README.md) · [api/auth.md](api/auth.md) 等 | REST 路由、状态、联调可消费附录 |
| **数据模型** | [data/README.md](data/README.md) | Alembic head、revision → 域表导航 |
| **运维** | [service/backend.md](service/backend.md) | 健康探针、配置、本地启动 |
| **架构** | [arch.md](arch.md) | 分层、模块、环境变量、部署；**ADR 内嵌 §2**（无独立 `docs/adr/`） |
| **壳层 IA** | [ui/layout.md](ui/layout.md) · [ui/anchor.md](ui/anchor.md) | 路由、导航、页面组件锚点 |

## 演化与归档

| 路径 | 说明 |
|------|------|
| [automate/plan.archive.md](automate/plan.archive.md) | M1–M13 全量里程碑映射（只读参考） |
| [superpowers/README.md](superpowers/README.md) | 演化轮次 design/plan 产出 |
| [automate/plans/](automate/plans/) | 实施计划归档 |

## 质量与体验（研发辅助）

| 路径 | 说明 |
|------|------|
| [bugs/README.md](bugs/README.md) | Bug 登记 |
| [features/](features/) | 手动测试用例等功能文档 |
| [feature-truth/](feature-truth/) | 实现真值审计 |
| [feature-design/](feature-design/) | 功能落地方案 |
| [ux-critique/](ux-critique/) | UX 待办与评审 |
| [mock/](mock/) | 非测试 stub/mock 诚实清单 |
| [user-guide/](user-guide/) | 面向用户的操作说明 |
| [ui/page-style-sync/](ui/page-style-sync/) | 页面样式对齐矩阵 |

## Agent 与工程约定

| 路径 | 说明 |
|------|------|
| [../AGENTS.md](../AGENTS.md) | 代理协作、环境选源、技能索引 |
| [../.cursor/rules/](../.cursor/rules/) | Cursor 规则（project · production · engineering · delivery） |
| [../.dev/README.md](../.dev/README.md) | 本项目环境地图与走查配置 |
| [../.agents/skills/](../.agents/skills/) | 项目级 Agent 技能 |

## 快速跳转

- 当前里程碑：**M1 工程基线** → [automate/plan.md](automate/plan.md)
- 后端域状态一览 → [services/README.md](services/README.md)
- 本地启动 → [../README.md](../README.md)
- 架构 ADR 与环境变量 → [arch.md](arch.md) §5–§9
