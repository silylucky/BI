# P4 Verification — M1 Backend Bootstrap

| 字段 | 值 |
|------|-----|
| branch | `feat/m1-backend-bootstrap` |
| base_branch | `dev-auto` |
| prd_ids | BOOT-004, BOOT-001, BOOT-005, BOOT-003 |
| verified_at | 2026-07-03T04:15:00Z |
| verifier | evolution-verifier (P4) |

## 环境

| 项 | 状态 |
|----|------|
| Docker Compose | **不可用** — `docker compose up` → `permission denied` on `/var/run/docker.sock` |
| PostgreSQL 16 | **宿主机** `localhost:5432`，`pg_isready` accepting；库 `vitalspan` 可连 |
| pytest 用例 | **0**（本轮计划明确不建 `tests/`，BOOT-006 顺延） |
| UI | N/A（纯后端轮次） |

## Docker 豁免评估

- **原因**：VM 无 Docker daemon 写权限，无法 `docker compose up -d postgres:16-alpine`。
- **替代证据**：宿主机 PostgreSQL 16 已在线；`alembic upgrade head` exit 0；`alembic_version.version_num = 0001`；与 `DATABASE_URL=postgresql+psycopg://vitalspan:vitalspan@localhost:5432/vitalspan` 一致。
- **结论**：**可豁免** — 迁移与运行时 DB 依赖已用等价环境验证；`docker-compose.yml` 文件存在但未在本 VM 执行。

## 验证命令与结果

| # | 命令 | exit_code | 结果 |
|---|------|-----------|------|
| 1 | `cd backend && python3 -m ruff check .` | 0 | All checks passed |
| 2 | `cd backend && python3 -m alembic upgrade head` | 0 | PostgresqlImpl, transactional DDL |
| 3 | `curl -sf http://localhost:8000/health \| grep '"status":"ok"'` | 0 | HTTP 200 |
| 4 | `curl /api/v1/me`（无 Bearer） | 0 | HTTP 401 |
| 5 | `curl -H "Authorization: Bearer dev" /api/v1/me` | 0 | 含 `"username":"dev"` |
| 6 | `curl /docs` | 0 | HTTP 200 |
| 7 | CORS OPTIONS `Origin: http://localhost:5173` | 0 | HTTP 200 |
| 8 | `SELECT version_num FROM alembic_version` | 0 | `0001` |

**主验收脚本**（plan 全链路）：exit_code **0**

## 未执行 / 不适用

- `pytest`：无 `tests/` 目录；`pytest -q` 会 exit 5（no tests collected），属计划范围外，非本轮阻塞项。
- `docker compose up`：daemon 权限不足，已用宿主机 PG 替代。
- 前端 lint/typecheck/UI：本轮无 UI 改动。

## 结论

**PASS**（exit_code=0），附带 Docker 环境 concern（已豁免）。
