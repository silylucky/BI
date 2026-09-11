# VitalSpan 演示机部署日志（2026-08-04）

## 环境摘要

| 项 | 值 |
|----|-----|
| 主机 | `ontomind@192.168.10.22` |
| 部署形态 | 直接部署（应用 + DB 均在宿主机，零 Docker 跑应用） |
| 代码路径 | `/opt/apps/vitalspan` |
| 备份暂存 | `/opt/apps/vitalspan-restore/20260804-100507/` |
| 访问入口 | **http://192.168.10.22:8088/admin**（Nginx :8088，:80 被 Apache2 占用） |
| 代码 commit | `e325445d2e18511e6f98966f4bd1991ffa251150`（tar 上传，GitLab SSH 未配置） |

---

## 阶段 0：本机备份

```powershell
cd C:\Users\30381\Desktop\VitalSpan
python .tmp\backup_for_deploy.py
# 产出：data\backups\20260804-100507\
```

| 文件 | 大小 |
|------|------|
| `meta-postgres.dump` | ~213 KB |
| `analytics-postgres.dump` | ~1.5 KB |
| `sample-mysql.sql` | ~81 KB |

```powershell
scp -r data\backups\20260804-100507 ontomind@192.168.10.22:/opt/apps/vitalspan-restore/
```

---

## 阶段 1–2：演示机基础设施与数据恢复

```bash
# apt 安装 postgresql mysql-server nginx python3 git 等（已完成）

# PostgreSQL 库与用户
sudo -u postgres psql -c "CREATE USER vitalspan WITH PASSWORD 'vitalspan';"
sudo -u postgres psql -c "CREATE DATABASE vitalspan OWNER vitalspan;"
sudo -u postgres psql -c "CREATE DATABASE analytics OWNER vitalspan;"

# pg_restore（PG17 dump → 宿主机 PG16，用 Docker PG17 客户端）
export PGPASSWORD=vitalspan
docker run --rm -e PGPASSWORD -v /opt/apps/vitalspan-restore/20260804-100507:/b \
  docker.m.daocloud.io/library/postgres:17-alpine \
  pg_restore -h host.docker.internal -U vitalspan -d vitalspan --no-owner --role=vitalspan /b/meta-postgres.dump
# analytics 同理

# MySQL sample_db（root 经 debian.cnf）
sudo mysql --defaults-file=/etc/mysql/debian.cnf -e "
  CREATE DATABASE IF NOT EXISTS sample_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER IF NOT EXISTS 'sample'@'localhost' IDENTIFIED BY 'sample';
  GRANT ALL ON sample_db.* TO 'sample'@'localhost'; FLUSH PRIVILEGES;"
sudo mysql --defaults-file=/etc/mysql/debian.cnf sample_db \
  < /opt/apps/vitalspan-restore/20260804-100507/sample-mysql.sql
```

恢复验收：

- `SELECT count(*) FROM dashboards` → **346**
- `sample_db` 表数量 → **47**

---

## 阶段 3：应用部署

代码经 tar 上传（GitLab SSH 不可用）：

```powershell
# 本机打包上传 .tmp/vitalspan-code.tar.gz → /opt/apps/vitalspan
```

`.env` 关键项（密钥与本机 `backend/.env` 一致）：

- `DATABASE_URL=postgresql+psycopg://vitalspan:vitalspan@localhost:5432/vitalspan`
- `ANALYTICS_DATABASE_URL=postgresql+psycopg://vitalspan:vitalspan@localhost:5432/analytics`
- `SAMPLE_MYSQL_URL=mysql+pymysql://sample:sample@localhost:3306/sample_db`
- `CORS_ORIGINS=http://192.168.10.22:8088`
- `FE_BASE_URL=http://192.168.10.22:8088/admin`

```bash
cd /opt/apps/vitalspan/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[connectors-ext,dev]"
sudo systemctl enable --now vitalspan-backend
```

---

## 阶段 4：前端 + Nginx

前端在本机 Windows 构建（远端 Node 18 + `@tailwindcss/oxide` native binding 失败）：

```powershell
cd fe && pnpm vite build
python .tmp\deploy_finalize.py  # 上传 fe/dist
```

Nginx 监听 **8088**（:80 被 Apache2 + conf.d/nex.conf、ark.conf 占用）。站点配置真源：**`deploy/nginx/vitalspan.conf`**（含 `client_max_body_size 8m`，支持看板内嵌背景图保存）。

```bash
sudo mv /etc/nginx/conf.d/*.conf /etc/nginx/conf.d/*.conf.disabled  # 逐个禁用
sudo cp deploy/nginx/vitalspan.conf /etc/nginx/sites-available/vitalspan
sudo ln -sf /etc/nginx/sites-available/vitalspan /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

---

## 阶段 5：验收结果

| 检查 | 结果 |
|------|------|
| `curl http://192.168.10.22:8088/health` | `{"status":"ok"}` |
| `http://192.168.10.22:8088/admin` | HTTP 200 |
| 看板数量（元库） | 346 |
| sample_db 表数量 | 47 |
| 后端 systemd | `vitalspan-backend` active |
| Nginx systemd | active，监听 0.0.0.0:8088 |

---

## 踩坑与处理

| # | 问题 | 处理 |
|---|------|------|
| 1 | 仓库旧备份 meta dump 0 字节 | 用 daocloud PG17 docker 从本机宿主机 PG 导出 |
| 2 | pg_restore 版本 1.16 vs PG16 | Docker PG17 客户端 pg_restore |
| 3 | GitLab SSH 无密钥 | tar 上传代码替代 git clone |
| 4 | :80 被 Apache2 占用 | Nginx 改监听 **8088** |
| 5 | nginx conf.d 也 listen 80 | 禁用 conf.d/*.conf |
| 6 | 远端 fe build tailwind oxide | 本机 `pnpm vite build` 后上传 dist |
| 7 | MySQL root 无法 sudo mysql | 使用 `/etc/mysql/debian.cnf` |
| 8 | sample 用户导入 DEFINER 报错 | root 经 debian.cnf 导入 |
| 9 | 登录报「操作失败」 | 生产 build 默认 API 指向 `localhost:8000`；用 `fe/.env.production.local` 设 `VITE_API_BASE_URL=` 后重建并上传 dist |
| 10 | 「边框装饰」无法渲染（HTTP 非 localhost） | `normalizeScreenBorderSparkleStyle` 在 `enabled=false` 时仍调 `crypto.randomUUID()`；非安全上下文抛错 → 改用 `fe/src/lib/randomId.ts` + 跳过预生成 sparkle |
| 11 | 看板保存「请求失败」/ Nginx 413 | 自定义背景 base64 使 `editor-save` 体 >1MB；Nginx 默认 `client_max_body_size 1m` 拦截 → 仓库 `deploy/nginx/vitalspan.conf` 设 **8m**；前端 `PAYLOAD_TOO_LARGE` 友好提示 |

---

## 部署后常用命令

```bash
# 后端
sudo systemctl status vitalspan-backend
sudo journalctl -u vitalspan-backend -f

# Nginx
sudo nginx -t && sudo systemctl reload nginx

# 健康
curl http://127.0.0.1:8088/health
curl http://127.0.0.1:8088/admin -o /dev/null -w '%{http_code}\n'
```

---

## 报表中心 P3 staging（本地 / 演示机）

> DeepTalk × VitalSpan 测试环境联调：见 [staging-deeptalk-quickstart.md](./staging-deeptalk-quickstart.md)（`vitalspan-v*-staging.zip` + 工作区模板「VitalSpan BI（测试环境）」）。

报表元数据、调度与产物在 **staging/production** 须启用 DB + 文件产物。可复制模板：

```bash
cp backend/.env.staging.example backend/.env
# 填入 JWT_SM2_* / CREDENTIAL_SM4_KEY
```

```env
# backend/.env（staging）
RPT_SCHEDULE_STORE=db
RPT_METADATA_STORE=db
ARTIFACT_STORAGE_BACKEND=fs
ARTIFACT_STORAGE_PATH=./data/artifacts
RPT_SMTP_HOST=localhost
RPT_SMTP_PORT=1025
FE_BASE_URL=http://127.0.0.1:5173
MAILHOG_API=http://127.0.0.1:8025
```

**本地签收启动顺序**：

1. `docker compose up -d postgres mailhog`（Docker 不可用时：`pytest` 会自动起 `tests/local_mailhog.py` 于 1025/8025）
2. `cd backend && alembic upgrade head`
3. `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
4. `cd fe && pnpm dev --host 127.0.0.1 --port 5173`
5. Live 回归：`pytest tests/test_g5_live_export.py -m integration`
6. 自动化签收：`pytest tests/test_report_manual_cases_p3.py`（Case 19/20）
7. 手测（可选复核）：Case 18（看板定时 PDF）· Case 19 · Case 20
