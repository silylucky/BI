# Task 9 宿主验收 — DeepTalk × VitalSpan B 轨

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-25（评审修复后复核） |
| 插件 | `vitalspan` **v0.3.0** |
| 安装路径 | `%APPDATA%\DeepTalk\plugins\vitalspan` |
| 轨道 | **B 轻量工作区**（仅 `home` + `workspace-setup` + `vitalspan_health`） |
| 证据工件 | `deeptalk-plugins/plugins/vitalspan/docs/TASK9-EVIDENCE.json`（`npm run task9:evidence`） |

---

## 构建与安装

| 项 | 状态 | 证据 |
|----|------|------|
| assemble 产物可安装 | ✅ | `node scripts/assemble-plugin.mjs` → ok |
| 安装哈希与仓内一致 | ✅ | `TASK9-EVIDENCE.json` · `hashRows` |
| 重启宿主 | ✅ | 重装 zip 后完全退出 DeepTalk |

| 文件 | 仓内 SHA256 前 12 | 安装目录 SHA256 前 12 |
|------|-------------------|------------------------|
| `plugin.json` | FDDD08152AD0 | FDDD08152AD0 |
| `views/home.js` | 9B094D86BE3C | 9B094D86BE3C |
| `views/workspace-setup.js` | CCBEFEBC59F0 | CCBEFEBC59F0 |
| `exec-tools/vitalspan-health.cjs` | 9A5007B59B7A | 9A5007B59B7A |

**自动化探针**

| 脚本 | 覆盖 |
|------|------|
| `spike-host-verify.mjs` | Spike #1,2,3,5,6,7,8,9（8 项） |
| `task9-host-evidence.mjs` | Task 9 可审计项 + 哈希 + main.log + #10 程序目录扫描 |
| `workspace-template-contract.test.mjs` | 停用占位 `fallbackBuiltin` 契约 |

---

## Task 9 十条（真实 DeepTalk 窗口）

| # | 验收项 | 状态 | 证据 / 备注 |
|---|--------|------|-------------|
| 1a | 设置页插件 **loaded** | ✅ | `config.json` `installed_plugins` · v0.3.0 · `T9-1a` |
| 1b | **停用**后模板消失或不可选 | ✅ 手测 | [Phase 4 §1b](./2026-08-25-deeptalk-vitalspan-phase4-handtest.md)；可选 `TASK9_EXPECT_DISABLED=1` |
| 2 | 模板新建 + 向导成功 | ✅ | Phase 4 手测；磁盘 binding 见 `T9-2`（有 workspace 时自动采样） |
| 3 | 打开 `home` 是本页 | ✅ | `main.log` `vitalspan:home` · Phase 4 手测 |
| 4 | 左侧切换 URL/选中态/iframe 一致 | ✅（B） | VitalSpan ↔ 新智能体 ↔ 工作区首页 |
| 5 | 页内入口改父级 URL | ⏸ N/A（B） | 5173 为 `target=_blank` |
| 6 | 连续切换 20 次稳定 | ✅ | Phase 4 手测 |
| 7 | `?id=` 深链 | ⏸ N/A（B） | 无第二业务页 |
| 8 | 未绑定/不可达可见错误 | ✅ | `readDomainBinding` 单测 · spike #9 · health 失败态 |
| 9 | iframe 无 fetch · 取数 pluginExec | ✅ | `T9-9` · `pluginExec('vitalspan_health')` |
| 10 | 引擎未被本插件污染 | ✅ | 本机无 deeptalk **源码**工作树；`Programs\DeepTalk` 无 `vitalspan` 字符串 · `T9-10` |

**B 轨：8 条适用 + 2 条 N/A；#1 拆为 1a/1b**

---

## Task 1–8 自动化回归

```text
npm run smoke                              → exit 0（含 template-contract + task9:evidence）
tests/instanceConfig.test.mjs              → 含无效 vitalspan 字段用例
tests/workspace-template-contract.test.mjs → fallbackBuiltin 契约
```

---

## 结论

| 项 | 值 |
|----|-----|
| **Task 9** | ✅ **通过**（B 轨 · 证据可审计） |
| **制品** | `deeptalk-plugins/release/vitalspan-v0.3.0.zip` |

---

## 关联

- [交付评审（已修复）](./2026-08-25-deeptalk-vitalspan-task1-9-delivery-review.md)
- [SPECIAL-WORKSPACE-PLUGIN-TASK.md §Task 9](../../api/vs-ai-spec/deeptalk-product/SPECIAL-WORKSPACE-PLUGIN-TASK.md)
- [Phase 4 手测](./2026-08-25-deeptalk-vitalspan-phase4-handtest.md)
