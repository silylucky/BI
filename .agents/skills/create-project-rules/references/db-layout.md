# 数据目录布局（按技术栈裁剪）

**能力要求（与路径无关，生产系统应具备）**：

| 能力 | 说明 |
|------|------|
| **migrations** | 版本化 schema 变更；可顺序重放；禁仅靠运行时 AutoMigrate 当唯一手段 |
| **seed** | 幂等平台种子（角色、权限、默认配置等）；与可选 demo 种子分离 |
| **schema / 表定义** | 契约真源或生成入口（DDL / ORM model / prisma schema 等） |
| **bootstrap admin** | 首装可有默认管理员（如 `admin` / `admin`）；**首次登录或启动后强制改密**；生产禁长期保留弱口令 |

**路径按栈推荐（写入 arch §7 / rules 时用真实路径，勿盲抄 `db/`）**：

| 栈 / 框架 | 推荐根 | migrations | seed | 表定义 / model |
|-----------|--------|------------|------|----------------|
| Go + go-zero（ark/nex 类） | `db/` | `db/migrations/` | `db/seed/`（平台）· 可选 `db/seed/demo/` | `db/ddl/` + `db/model/`（goctl） |
| Go + GoFrame | 仓内惯例或 `manifest/` / `resource/` | 版本迁移目录（按项目） | 种子脚本/SQL | dao/model 生成约定 |
| FastAPI / SQLAlchemy | 常 `alembic/` 或 `migrations/` | Alembic versions | `scripts/seed*.py` 或 `app/seed/` | models 包；可选独立 DDL |
| Flask | `migrations/`（Flask-Migrate） | 同上 | `seed.py` / `seeds/` | models |
| Prisma / Node | `prisma/` | `prisma/migrations/` | `prisma/seed.ts` | `prisma/schema.prisma` |
| Drizzle / Knex | 项目约定目录 | `drizzle/` 或 `migrations/` | `seeds/` | schema TS |
| Django | 各 app | `<app>/migrations/` | management command / fixtures | models.py |
| 其他 | 先扫仓再问 | 用户确认路径 | 用户确认 | 用户确认 |

**询问话术要点**：先根据 H1 栈给出上表推荐路径，再问「是否采用推荐布局？默认管理员是否 `admin`/`admin` + 强制改密？」

**禁止**：

- 不分栈强行所有项目都叫 `db/`（Prisma/Django 等应跟生态）
- 把 demo 种子默认打进生产启动
- 生产环境永久保留 `admin`/`admin` 且不强制改密
