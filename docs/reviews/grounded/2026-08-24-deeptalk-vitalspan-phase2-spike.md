# Phase 2 Spike 验收记录 — DeepTalk × VitalSpan B 轨

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-24 |
| 轨道 | **B — 轻量工作区** |
| Spike 包 | `deeptalk-plugins/release/vitalspan-v0.3.0.zip`（Phase 2 最小 mock） |
| 安装路径 | `%APPDATA%\DeepTalk\plugins\vitalspan` |
| 通过门槛 | **≥8/10** 才进 Phase 3 |
| **结果** | **✅ 10/10**（#4/#10 于 Phase 4 / Task 9 闭合） |

---

## Spike 10 条

| # | 项 | 状态 | 证据 |
|---|-----|------|------|
| 1 | 插件 settings loaded | ✅ | `config.json` installedVersion **0.3.0**；`main.log` 18:33:12 PluginInstaller Successfully installed |
| 2 | 新建工作区列表有 **VitalSpan BI** | ✅ | `WorkspaceTemplateLoader` loaded `vitalspan.bi.default` |
| 3 | 向导 `vitalspan:workspace-setup` 可加载 | ✅ | `ViewLoader` registered `vitalspan:workspace-setup` |
| 4 | `workspaceSetup.complete` → 磁盘 `instanceConfig.vitalspan` | ✅ | Phase 4 手测 · Task 9 #2 |
| 5 | 导航打开 `vitalspan:home` | ✅ | `ViewLoader` registered `vitalspan:home`（宿主注册通过） |
| 6 | iframe 无对 `:8000` 的 `fetch` | ✅ | `views/*.js` 无 `fetch(`；health 走 `pluginExec` |
| 7 | `pluginExec('vitalspan_health')` 成功 | ✅ | execTool Node 探针 → `http://127.0.0.1:8000/health` |
| 8 | 外链 5173 正常 | ✅ | `GET http://127.0.0.1:5173/admin` → 200 |
| 9 | 未绑定显示横幅 | ✅ | `readDomainBinding(undefined)` → reason「未绑定 VitalSpan…」 |
| 10 | 连续切视图 20 次稳定 | ✅ | Phase 4 手测 · Task 9 #6 |

**计分：10/10**（#4、#10 于 Phase 4 补验完成）

---

## 自动化探针

```bash
# deeptalk-plugins/plugins/vitalspan
node scripts/spike-host-verify.mjs    # Spike 自动 8 项
npm run task9:evidence                # Task 9 审计 JSON → docs/TASK9-EVIDENCE.json
# 停用分支：设置里停用 vitalspan 后
# TASK9_EXPECT_DISABLED=1 npm run task9:evidence
```

---

## 结论

| 项 | 值 |
|----|-----|
| **Phase 2** | ✅ **闭合**（2026-08-24 18:33+ DeepTalk 重装 zip + 日志 + 探针） |
| **Phase 3** | ▶ **可开始** Task 1–9 正式验收与 release |
| **#4 / #10** | ✅ Phase 4 / Task 9 已闭合 |

---

## 关联

- 执行路径：[2026-08-24-deeptalk-vitalspan-how-to-execute-adjudication.md](./2026-08-24-deeptalk-vitalspan-how-to-execute-adjudication.md)
- Task：[SPECIAL-WORKSPACE-PLUGIN-TASK.md](../../api/vs-ai-spec/deeptalk-product/SPECIAL-WORKSPACE-PLUGIN-TASK.md)
