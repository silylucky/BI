# `.dev/` — 环境地图与走查配置

本目录是 **browser-reviewer / scenario-playbook** 的配置真源，也是 VitalSpan 本项目的运行/走查环境地图。

| 文件 | 说明 |
|------|------|
| `config.yaml` | 多环境 URL、依赖连接摘要、走查边界（可提交，不含密钥） |
| `secrets.env` | 走查用密码（**勿提交**；从 `secrets.env.example` 复制） |
| `walkthrough/` | 走查产物（gitignore） |
| `baselines/` | 可选像素基线（gitignore） |

## 首次 setup

```powershell
cd C:\Users\30381\Desktop\VitalSpan
Copy-Item .dev\secrets.env.example .dev\secrets.env
# 编辑 secrets.env：与 backend/.env 的 VITALSPAN_DEV_ADMIN_PASSWORD 一致
```

## 与 `$HOME/.dev` 的分工

| 需求 | 查哪里 |
|------|--------|
| 本项目 URL、compose 依赖、走查账号 | **本目录** `config.yaml` |
| 跨项目 LDAP / S3 / 远端日志·Trace | **`C:\Users\<你>\.dev\config.yaml`** |

详见 `AGENTS.md` · `.cursor/rules/delivery.mdc`。

## 走查前启动顺序

1. `docker compose up -d postgres sample-mysql`
2. `cd backend` → `alembic upgrade head` → `uvicorn app.main:app --reload --port 8000`
3. `cd fe` → `pnpm dev` → 打开 <http://localhost:5173/admin>

健康检查：<http://localhost:8000/health>

## 修订

交互式补全 staging/prod 地图：使用 skill **create-dev-config**（`.agents/skills/create-dev-config/`）。
