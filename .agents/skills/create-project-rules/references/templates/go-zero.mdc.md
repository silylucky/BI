---
description: go-zero REST 开发规范（控制面 · goctl）
globs:
  - "**/*.go"
  - "**/*.api"
  - "**/api/**"
  - "cmd/**"
  - "**/internal/**"
  - "**/db/**"
  - "etc/**"
alwaysApply: false
---

# go-zero 开发规范

> 公共 Go 组织见 @.cursor/rules/go-common.mdc · 生产红线 @.cursor/rules/production.mdc · 架构 `docs/arch.md`

## goctl 硬约束

- 一律 `--style go_zero`；**禁止** RPC / `goctl rpc`（除非 arch 明确例外）
- **禁止手改**：`routes.go`、`types.go`
- **禁止手建**：初始 `*_handler.go` / `*_logic.go`（须 goctl 生成后再填 logic）
- **禁止合并**：单文件多个 `*Logic` / `*Handler`（与 goctl 冲突 → redeclared）
- 流程：改 `.api` → `goctl api validate` → `goctl api go … --style go_zero` → 填 logic → envelope 对齐 → `go build`

入口命令（按仓替换）：

```bash
{{GOCTL_VALIDATE}}
{{GOCTL_GENERATE}}
```

## `.api` 拆分

| 文件 | 职责 |
|------|------|
| `{{API_MAIN}}` | info + import；无 type/service |
| `{{API_TYPES}}` | 全部 type |
| `{{API_GROUPS}}` | 各 group 的 `@server`；无 type |

## 配置与数据

- 运维入口：`{{CONFIG_PATH}}`
- `Database.Driver`：`sqlite` \| `mysql` \| `postgres`（见 production）
- 迁移：`{{MIGRATIONS_DIR}}`；种子：`{{SEED_DIR}}`；表定义：`{{SCHEMA_DIR}}`（路径按仓，常见 `db/migrations`·`db/seed`·`db/ddl`）
- 平台种子幂等；demo 种子默认不进生产启动
- 默认管理员若为弱口令 → **强制改密**；见 @.cursor/rules/production.mdc

## API 响应

- **强制信封**：见 @.cursor/rules/engineering.mdc — `{ code, msg, data }`，`code === 0` 成功
- handler 禁止裸 `OkJsonCtx` 直出业务 DTO（按仓内 httpxutil 封装）
- 下载/SSE 等白名单例外须在 `.api` 与 `docs/api` 标明

## 分层

`handler → logic → service/model`；领域逻辑进 `service/<domain>/`（engineering）。依赖经 `ServiceContext` 注入。管理面与业务面前缀/中间件分离。

## 日志 · 测试

- 见 @.cursor/rules/production.mdc §日志
- 新 API 须 logic 单测或等价 smoke；禁空 stub 当完成
