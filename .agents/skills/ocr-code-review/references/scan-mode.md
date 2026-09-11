# Scan Mode

全仓扫描只在用户明确要求时启动。默认 scope 是 `runtime-code`。

## 初始化

```text
ocr_review.py init --repo <repo> --mode scan --scope runtime-code [--token-budget N]
# → status=awaiting_start，返回 launch_menu / composition / token_estimate
# 立刻展示给用户；确认后再：
ocr_review.py start --session <dir> [--concurrency max|auto|N] [--choice <menu-id>]
```

跳过确认（CI / 用户明确“直接开始”）时用 `init --yes`。

`composition` 按顶层目录、扩展名和 impact surface 给出目标数量；`token_estimate` 给出当前 session 的 low/likely/high。`launch_menu.option_comparison` / 每个 `options[]` 另含**全部启动选项**的预算，便于对比工作区 vs 全仓；Controller 应渲染 `display_template` 与 `how_to_reply`。这是 **dispatch 前** 的范围/成本预检。

Scope：

- `runtime-code`（默认）：排除 docs、Markdown、scripts、examples、代理配置。
- `apps-packages`：常见 app/package/service/lib 根内运行代码。
- `full`：受支持的全部代码、文档和工具脚本；生成物与 OCR 安装副本仍排除。

## 调度

使用不带槽位猜测的 `orchestrate-tick` 主动申请动态租约，并用 `orchestrate-report` 回报宿主实际接受/拒绝结果。默认并发 `max`：首轮请求全部 Primary Target。`auto` 同样 maximize-first；**15 不是上限**，只是宿主饱和后的再探测步长。Tick 优先处理 verifier backlog，防止大量 high/security/cross-file Candidate 堵住最终门禁。

## 完成

全部 Primary Target 终态且 verifier/dedup 门禁排空后 `finalize`。用户中途停止时用 `abort`，生成权威 partial，而不是只写手工说明文件。
