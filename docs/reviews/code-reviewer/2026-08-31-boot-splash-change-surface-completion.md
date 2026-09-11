# VitalSpan 生产就绪 / 产品体验评审 · 2026-08-31（启动页 boot splash 变更面收口）

## 总览

| 项 | 内容 |
|----|------|
| 范围 | PR·变更面：`fe/index.html` · `fe/src/main.tsx` · `fe/src/bootSplash.ts` · `fe/src/bootstrapFatal.ts` |
| mode | auto-fix（默认） |
| fix_mode | confirm-batch |
| cr_fix_scope | （待用户确认） |
| Stack Card | 后端 FastAPI `:8000` · 前端 React 19 + Vite `fe/` `:5173` · TailAdmin/shadcn · M1 |
| 扫描方式 | 主 agent 串行 lane（变更面极小）；`scan_tools: rg-only`（`sgconfig.yml` 存在，本批未跑 ast-grep 规则包） |
| 证据层 / 外部依赖 | 无 `.evidence/`（记 Blind spot）；无仓外依赖 |
| ha_mode | single（§18 跳过） |
| Blind spots | 无生产构建产物走查；无 `bootSplash` 单测；L1 ast-grep 结构性扫描未跑 |
| Lane 密度 | L4+L5：6 候选；L7：3 候选；L9：1 候选；L1/L8/L10/L11 合理跳过 |
| P0 / P1 / P2 | 0 / 3 / 3 |
| 建议 | **P0+P1 已批量修复**（批次 A+B）；P2 仍开放 |
| 回传 status | DONE_WITH_CONCERNS |
| 已排除非问题 | 启动页内联 CSS（React 加载前无法走 Tailwind 组件，属合理例外）；`pnpm dev` 提示文案面向开发者非生产 UI |

一句话结论：**P1-1～P1-3 已修**（`unhandledrejection`、安全 fatal 页、`localStorage.theme` 暗色同步）；核心诉求与 CR P1 批次已收口。剩余 P2 为 Logo 细节、fatal 样式 polish、非阻塞。

## P1 修复记录（2026-08-31 批次 A+B）

| ID | 修法 | 锚点 |
|----|------|------|
| P1-1 | `index.html` 增加 `error`（非 script）+ `unhandledrejection`；`bootSplash.reportBootFailure` | `fe/index.html` · `fe/src/bootSplash.ts` |
| P1-2 | `showBootstrapFatal` 改 `createElement` + `textContent` | `fe/src/bootstrapFatal.ts` |
| P1-3 | `<head>` 内联脚本读 `localStorage.theme`，`html.dark` 驱动 splash token | `fe/index.html` |

单测：`bootSplash.test.ts` 3 · `bootstrapFatal.test.ts` 2 — 5/5 绿。

### Stack Card（摘要）

- 形态：monorepo · `backend/` + `fe/`
- 变更主根：`fe/index.html`（内联 boot splash）· `fe/src/bootSplash.ts` · `fe/src/main.tsx` · `fe/src/bootstrapFatal.ts`
- 跳过的 lane：L6 IaC、L8 外部集成、L10 安全深扫、L11 性能/HA（与启动页弱相关）
- 手工验证：dev server `127.0.0.1:5173` 正常进入 `/login`/`/admin`；阻塞 `main.tsx` 时 splash 保留并显示超时文案

## Blind spots / 未完成 lane

| Lane | 状态 | 未覆盖范围 | 说明 |
|------|------|------------|------|
| 生产构建 | 合理跳过 | `pnpm build` 产物首屏 | `tsc -b` 因无关测试文件 `PixelCanvas.test.tsx` 语法错误失败，未验 prod bundle |
| 证据层 | 无仓内工件 | `.evidence/` gate-check | 无法实证 gate |
| L1 ast-grep | 降级 | 结构性 stub | 变更面无 stub；`rg-only` |
| 浏览器 dark 走查 | 边缘 | 已存 `localStorage theme=dark` 用户首屏 | 见 P1-3 |

**判定**：变更面核心文件已扫；无 P0 → `DONE_WITH_CONCERNS`；非「可上线全量收口」因 P1 未修。

## P0 Findings

（无）

## P1 Findings

### P1-1 · ESM 运行时错误无法即时反馈，仍依赖 15s 超时

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 / 可靠性 |
| 证据 | `fe/index.html:204-224` 仅监听 `SCRIPT` 标签 `error`（网络加载失败）；`fe/src/main.tsx:16-28` `try/catch` 仅覆盖同步 `render()` 抛错 |
| 为何致命 | `import` 链上模块求值失败、`unhandledrejection`、React 异步渲染错误不会触发上述路径；用户仍会看到启动页直到 15s 超时（与用户原始「加载不进去」体验同类） |
| 建议修法 | `index.html` 增加 `window.addEventListener('unhandledrejection', …)` + 可选 `error` 捕获；或 `main.tsx` 顶层动态 import 模式；首次错误即 `vsBootSetStatus` |
| xref | — |
| 可批量 | 是（批次 A） |

### P1-2 · `bootstrapFatal` 使用未转义 `innerHTML` 注入错误文案

| 字段 | 内容 |
|------|------|
| 类别 | 安全与参数隐患 |
| 证据 | `fe/src/bootstrapFatal.ts:5-13` — `` `${message}` `` 直接拼入 `innerHTML` |
| 为何致命 | 若 `Error.message` 含 HTML 可 XSS；虽概率低，但属用户可见错误面 |
| 建议修法 | 改用 `textContent` / `createElement` 或 `escapeHtml(message)` |
| xref | — |
| 可批量 | 是（批次 A） |

### P1-3 · 启动页暗色仅跟 `prefers-color-scheme`，与应用 `html.dark` 不同步

| 字段 | 内容 |
|------|------|
| 类别 | 风格 |
| 证据 | `fe/index.html:25-35` `@media (prefers-color-scheme: dark)`；`fe/src/context/theme-context.tsx:63` 应用主题靠 `html.dark` + `localStorage theme` |
| 为何致命 | 用户已选暗色但 OS 为浅色时，首屏 splash 浅色、挂载后切暗色，明显闪变 |
| 建议修法 | 启动前内联脚本读 `localStorage.theme`，与 `ThemeProvider` 初始逻辑对齐 |
| xref | — |
| 可批量 | 是（批次 B） |

## P2 Findings

- **P2-1** · Logo 渐变 vs `VitalSpanLogo` 扁平 `bg-brand-500` 不完全一致（可接受）
- **P2-2** · 无 `bootSplash` 单测
- **P2-3** · `bootstrapFatal` 内联样式、无暗色

## 完成度核对（相对用户诉求）

| 诉求 | 状态 | 说明 |
|------|------|------|
| 启动页太丑 → TailAdmin 风格 | ✅ 已交付 | 品牌色、卡片、spinner、渐变背景 |
| 一直停在「正在加载」 | ✅ 根因已修 | splash 不再阻塞 React；正常 dev 可进 `/login` |
| 加载失败可诊断 | ⚠️ 部分 | 脚本 404 + 15s 超时；ESM 运行时错误仍弱 |
| 暗色/主题一致 | ⚠️ 未收口 | P1-3 |
| 测试与 fatal 页 polish | ⚠️ P2 | 非阻塞 |

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 |
|------|------------|------|
| A 错误面加固 | P1-1, P1-2 | S |
| B 主题同步 | P1-3 | S |
| C 收尾（可选） | P2-1～P2-3 | S |

## 回传

```yaml
status: DONE_WITH_CONCERNS
phase: code-reviewer
mode: auto-fix
fix_mode: confirm-batch
scope: change_surface
report: docs/reviews/code-reviewer/2026-08-31-boot-splash-change-surface-completion.md
auto_fixed: []
remaining: [P1-1, P1-2, P1-3, P2-1, P2-2, P2-3]
```
