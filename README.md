# VitalSpan

自研 BI 平台（对标 DataEase / Superset 的产品能力，**零第三方 BI 运行时依赖**）。面向政企与行业 IT / 数据团队，提供数据源连接、查询执行、看板与数据大屏、报表、嵌入投放等能力。

> 需求合同见 [`docs/srs/`](docs/srs/) · 功能验收见 [`docs/automate/prd.md`](docs/automate/prd.md) · 架构见 [`docs/arch.md`](docs/arch.md)

---

## 核心能力

| 域 | 说明 |
|----|------|
| 数据源 | 插件式连接器（关系型 / OLAP / 时序 / 文档 / 搜索等），凭证 **SM4** 加密（Fernet 遗留双读） |
| 查询 | SQL 与 Native 双路径；Dataset 路径已可用（四期语义层持续演进） |
| 看板 | v1 栅格 + v2 像素画布；组件库、主题、分享与嵌入 |
| 数据大屏 | 1920×1080 设计稿、编辑视口、预览 / 分享 / 整屏 embed；Phase 2.5/2.6 主链已通 |
| 报表 | 模板、调度、PDF/Word 导出（companion 能力持续完善） |
| 地图 | **仅离线中国 GeoJSON**（GEO-IRON-01）；禁止在线瓦片与地图 Key |
| 嵌入 | iframe / SDK；单图表与整屏大屏投放 |

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 前端 | React 19 · Vite · shadcn/ui · Radix · Tailwind CSS v4 · **`fe/`** |
| 图表 | 自研 ChartEngine（AntV / D3 / Three.js）；地图经 `GeoEnginePort` |
| 后端 | FastAPI · Pydantic v2 · SQLAlchemy 2 · Alembic · **`backend/`** |
| API | REST **`/api/v1/*`** · 健康检查 **`/health`**（无 v1 前缀） |
| 平台库 | PostgreSQL / MySQL 8+ / SQLite（开发） |

---

## 仓库结构

```
VitalSpan/
├── backend/          # FastAPI 应用（app/core、auth、api/v1、dashboard、query…）
├── fe/               # React 单应用前端（禁止 frontend/ 命名）
├── docs/             # SRS · PRD · 架构 · API · 域附录 · 演化计划
├── tests/            # 后端集成 / smoke 测试
├── docker-compose.yml  # 平台库与样例数据源
├── .cursor/rules/    # 项目约定（Agent / 开发纪律）
├── .dev/             # 环境地图与 browser-reviewer 走查配置
├── AGENTS.md         # 代理协作与环境选源
└── .agents/skills/   # 项目级 Agent 技能
```

前端公共组件清单：[`fe/src/components/README.md`](fe/src/components/README.md)

---

## 快速开始

### 环境要求

- **Node.js** 20+ · **pnpm** 9+
- **Python** 3.11+
- **Docker**（可选，用于 PostgreSQL / MySQL 等依赖服务）

### 1. 启动依赖服务

```bash
docker compose up -d postgres sample-mysql
```

`sample-mysql`（3307 / `sample_db`）为**官方演示包必需**：后端启动时会自动增量迁移 `vs_official_*` 视图、注册 code=`demo` 的「示例数据」源，并预置官方示例看板/大屏。

如需 ClickHouse / TimescaleDB 等其它样例库，见 [`docker-compose.yml`](docker-compose.yml) 中对应 service。

### 2. 后端

```bash
cd backend
cp .env.example .env
# 生成密钥：
# python -c "import secrets; print(secrets.token_hex(16))"   # CREDENTIAL_SM4_KEY
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

pip install -e ".[dev]"   # 含 gmssl（国密 SM4/SM3）
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**国密相关环境变量**（见 `backend/.env.example`）：

| 变量 | 说明 |
|------|------|
| `JWT_SM2_PRIVATE_KEY` / `JWT_SM2_PUBLIC_KEY` | SM2 JWT 签名密钥对（`python scripts/generate-jwt-sm2-keys.py`） |
| `CREDENTIAL_SM4_KEY` | SM4 凭证加密密钥（32 位 hex，固定算法） |

> 部署 SM2 JWT 后须重新登录。凭证/密码仅 SM4/SM3 路径。

**数据库备份**：

```powershell
# Windows / Linux 均可
python scripts/backup-databases.py
# 或 .\scripts\backup-databases.ps1
```

恢复须同时保管备份目录内 `keys-checklist.txt` 所列密钥。

- API 文档：<http://localhost:8000/docs>
- 健康检查：<http://localhost:8000/health>

### 3. 前端

```bash
cd fe
pnpm install
cp .env.example .env
pnpm dev
```

- 管理端：<http://localhost:5173/admin>
- 本地 dev 默认通过 Vite proxy 转发 `/api`，无需设置 `VITE_API_BASE_URL`

### 4. 默认开发账号

环境变量 `VITALSPAN_DEV_ADMIN_PASSWORD`（见 `backend/.env.example`）控制开发态管理员密码。  
开发 RBAC 演示账号：`admin` / `analyst` / `viewer`（同密码）。

### 5. 环境地图（Agent / 走查）

仓库 [`.dev/`](.dev/README.md) 登记本机 URL、compose 依赖与走查账号；密钥复制 [`.dev/secrets.env.example`](.dev/secrets.env.example) → `.dev/secrets.env`。  
跨项目 LDAP/S3/日志验真读家目录 **`$HOME/.dev`**（见 [`AGENTS.md`](AGENTS.md)）。

---

## 官方演示包 FAQ

| 现象 | 处理 |
|------|------|
| Hub 横幅「尚未就绪」、schema 未迁移 | 确认 `docker compose up -d sample-mysql` 后**重启后端**（启动时会跑 `docker/demo-mysql/migrations/`） |
| 有 `sample-mysql` 源但无 `demo` | 重启后端；legacy `official-demo-mysql` 会自动 rename 为 `demo` |
| 看板列表无「官方示例」 | 运行 `python scripts/seed-demo-package.py` 或重启后端；再调 `GET /api/v1/demo-package/status?refresh=true` |
| 在 **Dataset** 页找不到官方数据 | **正常**：演示包不经 Dataset，请去 **数据连接 → 示例数据** 与 **看板/大屏列表** |
| 迁移仍失败 | 检查 3307 端口与 `backend/.env` 中 `SAMPLE_MYSQL_URL`；必要时备份后重建 sample-mysql 卷 |

---

## 常用命令

### 前端（`fe/`）

```bash
pnpm dev              # 开发服务器
pnpm build            # 生产构建
pnpm test             # Vitest + 设计/引擎检查
pnpm test:smoke       # 路由 smoke
pnpm test:e2e         # Playwright（需先 npx playwright install chromium）
pnpm test:chart-catalog  # 图表目录与引擎回归
```

### 后端（`backend/`）

```bash
pytest                # 单元 / 集成测试
python ../scripts/test-data-connectivity.py   # 元库 + 数据源连通性
ruff check .          # 静态检查（若已配置）
```

### 数据大屏回归（示例）

```bash
cd fe && npx vitest run \
  src/components/dashboard/dataScreenPersist.test.ts \
  src/components/dashboard/pixelCanvas/layoutSanitize.test.ts \
  src/pages/admin/dashboard/DashboardSharePage.smoke.test.tsx

cd fe && npx playwright test e2e/data-screen-resize-content.spec.ts --project=chromium
```

完整清单见 [`docs/feature-design/2026-07-29-data-screen-master-gap-fill.md`](docs/feature-design/2026-07-29-data-screen-master-gap-fill.md) §2。

---

## 文档索引

| 文档 | 路径 | 用途 |
|------|------|------|
| 需求规格（SRS） | [`docs/srs/`](docs/srs/) | 需求合同与分期边界 |
| PRD 索引 | [`docs/automate/prd.md`](docs/automate/prd.md) | 功能 ID、验收标准、代码锚点 |
| 架构 | [`docs/arch.md`](docs/arch.md) | ADR、目录、环境变量 |
| API 契约 | [`docs/api/README.md`](docs/api/README.md) | REST 路由登记 |
| 业务域 | [`docs/services/README.md`](docs/services/README.md) | 域职责与边界 |
| 壳层 IA | [`docs/ui/layout.md`](docs/ui/layout.md) | 路由与导航 |
| 演化计划 | [`docs/automate/plan.md`](docs/automate/plan.md) | 里程碑与 companion backlog |
| Bug 登记 | [`docs/bugs/README.md`](docs/bugs/README.md) | 已知问题与修复追溯 |
| 数据大屏 gap-fill | [`docs/feature-design/2026-07-29-data-screen-master-gap-fill.md`](docs/feature-design/2026-07-29-data-screen-master-gap-fill.md) | 大屏已闭合项与发版手测 |

---

## 开发约定（摘要）

- 前端根目录固定为 **`fe/`**，API 前缀 **`/api/v1/`**，鉴权模块 **`backend/app/auth/`**
- 地图仅离线中国；不引入 Superset / DataEase 运行时依赖
- 代码变更后按 [`.cursor/rules/prd-sync.mdc`](.cursor/rules/prd-sync.mdc) 评估文档同步
- 修 bug 前先检索 [`.agents/skills/bug-case-library/cases/`](.agents/skills/bug-case-library/cases/)

详细纪律见 [`.cursor/rules/vitalspan-project.mdc`](.cursor/rules/vitalspan-project.mdc)。

---

## 项目状态

- **PRD 合同 129 项**：已实现（2026-07-30）
- **当前活跃 companion**：发版 QA 抽测（看板 Pointer、数据大屏 MT 手测等），见 [`docs/automate/plan.md`](docs/automate/plan.md) 与 [project master gap-fill](docs/feature-design/2026-07-29-vitalspan-project-master-gap-fill.md)

---

## 许可证

内部项目；对外分发策略以组织规定为准。
