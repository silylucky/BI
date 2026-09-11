# Playbooks · 2026-08-09

| 项 | 内容 |
|----|------|
| 模式 | **specified**（来自已确认蓝图 `docs/material/blueprints/2026-08-09-system-admin-audit.md` F1～F4） |
| 主剧本 | [critical.md](./critical.md) |
| 可选 | [optional.md](./optional.md) |
| 场景数 | S0～S6（ready 3 / needs_confirm 3 / draft 0 / blocked 0） |
| `.dev` | 有 · `active_env: local` |
| allow_writes | **false**（默认只读走查；写步打开对话框后关闭，不提交） |
| allow_destructive | **false** |
| 交接摘要 | `docs/material/browser-reviewer/2026-08-09-system-admin-walkthrough-r3.md` |

## 场景一览

| 场景 ID | 标题 | 优先级 | 状态 | 写操作 |
|---------|------|--------|------|--------|
| S0 | 预检与健康检查 | P0 | ready | 否 |
| S1 | 登录并进入配置向导 | P0 | ready | 否 |
| S2 | 组织架构（新建对话框） | P0 | ready | needs_confirm |
| S3 | 角色与权限矩阵 | P0 | ready | needs_confirm |
| S4 | 用户创建与角色/组织绑定 | P0 | ready | needs_confirm |
| S5 | 资源授权 | P1 | ready | needs_confirm |
| S6 | 侧栏导航单项高亮 | P1 | ready | 否 |

可选场景见 [optional.md](./optional.md)（业务用户登录、审计、RLS、停用账号）。

## 走查前准备

1. `docker compose up -d postgres sample-mysql mailhog`
2. `cd backend && alembic upgrade head && uvicorn app.main:app --reload --port 8000`
3. `cd fe && pnpm dev`（默认 `http://localhost:5173/admin`）
4. 密码：`.dev/secrets.env` 中 `VITALSPAN_DEV_ADMIN_PASSWORD`（与 `config.yaml` `auth.username: admin` 配对）

## 两种执行模式

| 模式 | 条件 | 行为 |
|------|------|------|
| **只读走查**（默认） | `allow_writes: false` | S0/S1/S6 全跑；S2～S5 打开表单/对话框、填写示例值后点「取消」关闭，**不**点创建/保存/确认 |
| **完整首租户闭环** | 临时将 `walkthrough.allow_writes` 设为 `true` | 按 critical.md 写步执行；夹具示例见 critical「完整闭环夹具」表 |

## 下一步

使用 **browser-reviewer**，剧本目录：

```
.dev/playbooks/2026-08-09/critical.md
```

用户仅要剧本、不跑浏览器时，阅读本目录 Markdown 即可。
