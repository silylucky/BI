# 仓库扫描工作流

目标：在组稿前得到一份**可引用的产品事实卡**，避免宣传稿脱离仓库。

## 扫描顺序（有则读，无则跳过并记录缺口）

1. **入口叙事**：`README.md` / `README.zh*.md`、官网文案目录（若有）
2. **产品真理源**：`docs/automate/goal.md`、`docs/automate/prd.md`、`docs/automate/prd/*.md`
3. **架构**：`docs/arch.md`、`docs/adr/*.md`、部署 compose/helm/terraform 摘要
4. **用户表面**：前端路由表、侧栏菜单、`docs/ui/*.md`
5. **领域与 API**：`docs/domain/*.md`、`docs/api/*.md`、OpenAPI/proto 摘要
6. **已有物料**：`docs/material/**`（复用图表与表述，避免两套口径）
7. **代码抽样**：主 service 入口、核心状态机、权限中间件（验证亮点是否真实）

单次扫描控制在「能填满大纲」即可；不要为扫描读完全仓。

## 产品事实卡（必填字段）

```markdown
# Product Fact Card

- name:
- one_liner:          # 一句话，来自 README/goal
- audience_roles: []
- in_scope: []
- out_of_scope: []
- highlights:         # 每条: { claim, evidence_path }
- modules: []         # { name, responsibility, path }
- deploy:             # 形态简述
- scenarios:          # 每条: { name, actors, trigger, success, evidence_path }
- metrics_safe: []    # 仅有证据的数字；否则留空
- gaps: []            # 文档缺失、待确认、（推断）项
```

可写入 `docs/material/<slug>/_research.md`（可选；用户未要求可不提交 git）。

## 场景挑选规则

从事实卡 `scenarios` 选 **≥2** 条进入 Deck E 区，优先级：

1. PRD 标明的主成功路径  
2. 侧栏/路由上的高频入口  
3. 跨系统集成（最能体现架构）  
4. 管理端/审批类（能画出角色泳道）

丢弃：纯 CRUD 列表页无业务分支、纯配置页（可作亮点一句，不单独开 4 页流程）。

## 亮点挑选规则

每条亮点必须能回答：「用户多得到什么」+「仓库哪处证明」。

| 合格 | 不合格 |
|------|--------|
| 「支持基于角色的菜单级权限」+ `auth` 模块路径 | 「体验极致流畅」无证据 |
| 「异步任务可观测重试」+ worker 代码 | 「行业领先 AI」无模型/能力边界 |

最多主推 5–6 个；其余进附录或删。

## 架构提炼规则（写入白皮书前先升维）

扫仓得到的是**事实底稿**；写进 PPT 前必须按 [content-voice.md](content-voice.md) 升维成产品语言。

最少输出（产品级）：

1. 一句话系统形态（「控制台 + API 服务 + 数据层」；技术选型可作半句点缀，勿当整页主角）  
2. ≤12 个能力/进程盒子  
3. 一条「业务请求如何被安全处理」的**产品步骤**（不是中间件调用链）  
4. 外部依赖用业务名（登录源、对象存储、通知渠道）  

禁止进白皮书正文：Cookie/Header 名、中间件类名、ADR 编号、JSON 信封字段、函数名。  
禁止：mock/fixture/demo 进对外总览。

## 并行建议

可用 subagent 并行：`docs 树` / `前端路由` / `后端入口与模块`；主会话合并事实卡后再写 outline。
