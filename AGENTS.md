# AGENTS.md — VitalSpan

代理协作说明。真理源：`docs/automate/goal.md` · `docs/arch.md` · `docs/automate/prd.md`。  
规则：`.cursor/rules/*.mdc`。本文件只补**长期、非显而易见**约定。

## 会话启动

1. 读 `docs/arch.md` 与 `docs/automate/goal.md`
2. 扫顶层目录（`backend/` · `fe/` · `docs/`）
3. 红线：`production.mdc` · `engineering.mdc` · `delivery.mdc` · `prd-sync.mdc`

## 交付与发布（勿在本文件写操作手册）

- 打包装、上传制品 → **release-package** + 仓库 release 脚本 + `.dev` `release:`
- 演示机部署 → **deploy-dev**
- 仓内只遵守 `.cursor/rules/delivery.mdc` 门禁（版本、禁 AK 进仓、可回滚）

## 环境与外部集成选源

| 需求 | 查哪里 | 生成 skill |
|------|--------|------------|
| 本项目启动/走查、演示机 SSH、项目已登记的发布参数 | 仓库根 `.dev/config.yaml`（密钥：`.dev/secrets.env`，勿提交） | **create-dev-config** |
| 外部库 / S3 / LDAP / OAuth / 日志·Trace 等跨项目联调与 smoke | **`$HOME/.dev/config.yaml`**（Windows：`C:\Users\<用户名>\.dev\`；密钥：`secrets.env`） | **create-home-dev** |
| 功能是否完成、验收勾选 | `docs/automate/prd.md` + `docs/automate/prd/` | **create-evolution-prd** |

纪律：可提交文件只记主机/URL/**环境变量名**；外部依赖真打优先读家目录台账的 `credential_env`，再与仓库 `.dev` `integrations` 对齐。

## 后端（FastAPI）

- 细则：`.cursor/rules/backend-fastapi.mdc` · `.agents/skills/fastapi/SKILL.md`
- 域边界：`docs/services/<域>.md`
- API 契约：`docs/api/README.md`

## 前端（fe/）

- `docs/ui/layout.md` · `.cursor/rules/fe-ui.mdc`
- 设计系统：`.agents/skills/b-design-system-tailadmin-radix/SKILL.md` — **禁止自由发挥视觉**

## 本地启动（非显而易见）

- 依赖：`docker compose up -d postgres sample-mysql`（官方演示包需 sample-mysql:3307）
- 后端：`backend/` → `alembic upgrade head` → `uvicorn app.main:app --reload --port 8000`
- 前端：`fe/` → `pnpm dev` → <http://localhost:5173/admin>
- 国密密钥：`JWT_SM2_*` · `CREDENTIAL_SM4_KEY`（32 hex）
- **不提供**业务/NFR/mock 功能开关 env

## 技能索引

| 场景 | 路径 |
|------|------|
| 后端 FastAPI | `.agents/skills/fastapi/SKILL.md` |
| 前端视觉 | `.agents/skills/b-design-system-tailadmin-radix/SKILL.md` |
| 代码审查（生产就绪） | `.agents/skills/code-reviewer/SKILL.md` |
| 批量修复（CR 后） | `.agents/skills/go-fast/SKILL.md` |
| 打包装 / 上传制品 | `.agents/skills/release-package/SKILL.md` |
| 代码审查（OCR） | `.agents/skills/ocr-code-review/SKILL.md` |
| Bug 案例库 | `.agents/skills/bug-case-library/` |
| 演化 SOP（只读） | `.cursor/automate/skills/` |
| 架构巡检 | `arch-inspect/` · `arch-inspect.config.yaml` |

## DeepTalk × VitalSpan 一体集成（铁律）

- 真源：`docs/api/vs-ai-spec/IRON-RULES.md` · Cursor：`.cursor/rules/deeptalk-vitalspan-integration.mdc`
- `vs-ai-spec-deeptalk-test` = DeepTalk **正式集成项目**；VitalSpan = **平台能力**（API/组件库/大屏/渲染）
- ② 完成 = **`artifactId`**；③ 完成 = **`dashboardId`**；`write_file`  alone ≠ 打通

## 其他长期约定

- `goal.md` 仅经 **create-evolution-goal** 人工修订
- 代码变更后按 `prd-sync.mdc` 评估文档同步
- 内置图出数走**数据集绑定**（`POST /api/v1/query/dataset/execute`，`dataSourceId` + `configId` + 维/指 encoding）；管理探针可用 `/query/execute`（sql/table/native），非看板主路径
- BI 运行时 **零** Superset/DataEase 依赖（NFR-08）
