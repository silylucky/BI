---
description: Go 公共工程规范（pkgs · 跨进程；体量/信封见 engineering）
globs:
  - "**/*.go"
  - "pkgs/**"
alwaysApply: false
---

# Go 公共规范

> 体量 · API 信封 · 分层上浮 → @.cursor/rules/engineering.mdc  
> go-zero / GoFrame 见对应 mdc · 生产红线 @.cursor/rules/production.mdc

## 目录约定（本仓）

- 领域服务：`{{SERVICE_DIR}}`（常见 `internal/service/<domain>/`）
- 无状态库：`pkgs/<name>/`
- 清单：写 logic 前必读 `{{SERVICE_DIR}}/README.md`、`pkgs/README.md`（若有）

## 上浮（Go 落点）

| 规则 | 要求 |
|------|------|
| 复用 | README 已有 service / pkgs 能覆盖 → 必须 import |
| 上浮 service | 同域 ≥2 处 → `service/<domain>/` |
| 上浮 helper | 仅同 API 组 → `logic/<group>/helper/`（或等价） |
| 上浮 pkgs | 跨服务、无状态 → `pkgs/<name>/` |
| 维护 | 变更公共 API：同 PR 更新 README + 测试 |

禁止：`pkgs/` import 业务 `internal/`；handler 写业务 SQL；手写第二套 envelope/mask。

## 跨进程

多二进制时：**禁止**边缘/worker 直接 import 控制面 `internal`；共享经 `pkgs/` 或约定共享库。

## 生成物

goctl / 其他生成器产物的限额豁免与禁止手改：见 engineering §体量 + 框架 mdc。
