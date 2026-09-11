---
description: 工程公共约束（体量 · 信封 · 分层 · 复用 · 超时幂等）
alwaysApply: true
---

# 工程公共约束

> 生产交付（含国密/弹性/观测）见 @.cursor/rules/production.mdc · 交付指针 @.cursor/rules/delivery.mdc · 文档 @.cursor/rules/prd-sync.mdc

## 体量（软约束）

| 项 | 上限 |
|----|------|
| 单函数/方法 | ≤ **120** 行 |
| 单手写源文件 | ≤ **300** 行 |
| 同目录手写文件 | ≤ **10** 个 |

**豁免**：框架/codegen 产物、大段生成 schema；禁为凑数搬迁；禁手改生成物冒充源。

## API 信封（强制）

```json
{ "code": 0, "msg": "ok", "data": {} }
```

统一封装写出；`code === 0` 成功；失败人话 `msg`。下载/SSE 等例外须在契约与 `docs/api` 标明。

## 分层（API ≠ 领域）

```text
接口层 →（可选编排）→ service/<domain>/ → model/repo/provider
```

接口禁堆 SQL/业务；领域 service 可被 API/job 复用；pkgs 无业务状态且不 import 业务 internal。出站 SDK ≥2 调用方 → 适配器。

## 复用上浮

改前读 `service`/`pkgs`/`components` README。同域第 2 处 → service；组内共用 → helper；跨服务无状态 → pkgs/lib；FE 同构 → components。公共 API 变更同 PR 更新 README+测试。

## 超时 · 幂等（代码侧）

- 出站与仓储调用带超时上下文/参数，禁无限等
- 可重复提交的写：幂等键或唯一约束 + 409；重试只包幂等路径
- 细则与限流/熔断见 @.cursor/rules/production.mdc §弹性

## 密码学调用

业务加解密/签名走统一封装，算法默认国密（production §国密）；禁止业务文件直接散落 crypto SDK。
