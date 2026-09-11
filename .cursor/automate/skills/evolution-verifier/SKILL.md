---
name: evolution-verifier
description: >-
  自我演化 P4：运行测试套件、收集 exit code 与摘要，失败则 BLOCKED。
  由 subagent evolution-verifier 执行。
---

# 验证（P4）

## 何时使用

- P3 全部任务完成后
- 合并前 rebase 后需重验时
- 由 **subagent `evolution-verifier`** 执行

## 流程

1. 识别项目测试命令（`package.json` scripts / `Makefile` / `go test ./...` / `pytest` 等）
2. **完整运行**测试套件（非抽样）
3. 若本轮触及前端 UI：运行可用的前端检查（如 lint、typecheck、组件测试、视觉/设计 drift 静态检查）；能启动前端时截 desktop/mobile 图并检查 UI Acceptance
4. 记录 `exit_code`、通过/失败用例数、失败用例名（**不贴完整日志**）
5. 更新 `docs/automate/evolution-state.md`「当前轮次」：`phase=P4_DONE`、`last_verified_command`、`last_verified_exit_code`；若触及 UI，同时记录 `last_ui_verified_command` 与截图路径/未运行原因
6. 任一测试、前端检查或 UI Acceptance 失败 → `BLOCKED`，摘要失败原因，**禁止**进入 P5

## 通过

```yaml
status: DONE
phase: verifier
summary:
  - "exit_code: 0"
  - "命令: npm test"
  - "通过 142，失败 0"
  - "UI: PASS（无 UI 改动时写 UI: N/A）"
next: platform-pr-finisher
```

`platform-pr-finisher` 由当前 SOP 映射：GitHub 流程必须委派 `evolution-pr-finisher-github`；GitLab 流程委派 `evolution-pr-finisher`。Verifier 禁止自行选择平台后缀。

## 失败

```yaml
status: BLOCKED
phase: verifier
blockers:
  - "TestAuthDeviceCode 失败: expected 200 got 401"
summary:
  - "exit_code: 1"
  - "失败 1 / 142"
next: null
```

## 红线

- **禁止**未跑测试声称通过
- **禁止**前端 UI 改动未做可用的 UI 验证就声称通过
- **禁止**向主 agent 回传超过 **20 行** 日志（完整日志写文件或仅保留失败栈顶）
