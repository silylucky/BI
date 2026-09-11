# Phase 4 手测指南 — DeepTalk × VitalSpan（5 分钟）

> 补完 spike #4/#10 与 Task 9 真机项 · 对照 [E2E-CHECKLIST §1](../../api/vs-ai-spec/deeptalk-product/E2E-CHECKLIST.md)

---

## 先分清两个界面

| 你在哪 | 长什么样 | 有没有「检测 API 连接」 |
|--------|----------|-------------------------|
| **DeepTalk** 窗口 · 左侧点 **VitalSpan** | 深色插件页 · 标题「VitalSpan BI 工作区」 | ✅ **有** |
| **浏览器 5173** · 侧栏 分析/数据准备 | VitalSpan 管理面（无 health 按钮） | ❌ **没有** |

## 5173 侧栏与 wf 验收入口

| 侧栏 | 菜单 | 路径 | 用途 |
|------|------|------|------|
| **分析** | **组件库** | `/admin/viz-components` | **wf2** publish 后在此看组件 |
| 分析 | 仪表板 | `/admin/dashboards` | **wf3** 仪表板 |
| 分析 | 数据大屏 | `/admin/data-screens` | **wf3** 大屏 |

> 插件「打开管理面」→ `/admin`（默认进仪表板）。验 wf2 请进 **组件库**；插件 home 提供深链。

详细：[5173 对齐记录](./2026-08-25-deeptalk-vitalspan-5173-admin-alignment.md)

「打开 VitalSpan 管理面（5173）」只是**新开浏览器标签**；检测连接必须在 **DeepTalk 里**点。

---

## 步骤

### 0. 前置

- VitalSpan 本机：`:8000/health` ok · `:5173/admin` 可开
- DeepTalk：设置 → 插件 → **vitalspan 0.3.0** loaded

### 1. 新建 VitalSpan BI 工作区

1. DeepTalk → **新建工作区**
2. 选 **「VitalSpan BI」**（不是默认通用工作区）
3. 向导填写：
   - API：`http://127.0.0.1:8000/api/v1`
   - 管理面：`http://127.0.0.1:5173/admin`
4. **完成**向导

### 1b. Task 9 #1 停用分支（一次性 · 约 1 分钟）

1. DeepTalk → **设置 → 插件** → **停用 vitalspan**
2. **新建工作区** 列表应**无**「VitalSpan BI」（或该项不可选/占位）
3. **重新启用** vitalspan → 列表恢复
4. 可选自动化：`TASK9_EXPECT_DISABLED=1 npm run task9:evidence`（在停用状态下跑）

### 2. 打开插件 home

1. 看 DeepTalk **左侧导航**
2. 点 **「VitalSpan」**（在「新智能体」「工作区首页」下面）
3. 中间应出现卡片，含 **「检测 API 连接」** 按钮

### 3. 验收动作

- [x] 点 **检测 API 连接** → 显示绿色「连接检测：正常」
- [x] 点 **打开 VitalSpan 管理面（5173）** → 浏览器打开管理面（正常）
- [x] **VitalSpan** ↔ **新智能体** 切换 ~20 次 → 无白屏/崩溃

### 4. 可选：未绑定横幅

新建工作区时若跳过绑定 → home 应显示红色横幅「未绑定 VitalSpan…」

---

## 完成后回复

请回复其一：

- **「Phase 4 手测全过」**
- 或 **「#X 失败：…」** + DeepTalk 截图

通过后更新契约 §3 为「已交付 v0.3.x」并跑 E2E §2–§5（Agent wf2/wf3）。
