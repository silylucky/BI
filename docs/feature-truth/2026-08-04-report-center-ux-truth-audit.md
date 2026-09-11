# Feature Truth Audit: 报表中心 · 用户可用性与界面清晰度

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-04 |
| 核验范围 | 报表中心消费/管理主路径 + 同步任务新建（用户视角：好不好用、按钮清不清晰） |
| 锚点 | `fe/src/pages/admin/reports/` · `fe/src/pages/admin/ingestion/SyncJobForm*` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **7.2 / 10 · B** |
| 状态 | approved-fix |
| **sampling** | `full`（Hub / View / Export / Schedule / 模板扩展 / 同步任务表单） |

## 1. 核验标准与预期（用户视角）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| UX-T1 | 业务用户能在 Hub 找到并打开授权报表，无需读文档 | 政企报表消费 |
| UX-T2 | 查看页一键看懂「运行 / 导出 / 返回」，结果可读 | ReportViewPage |
| UX-T3 | 导出区格式与按钮语义明确，状态可理解 | ReportExportCard |
| UX-T4 | 调度草稿→激活路径清晰，不会误以为已定时发送 | SchedulePanel + Banner |
| UX-T5 | 管理员在模板扩展页能完成 SQL/Dataset 指标配置 | TemplateDetailPanel |
| UX-T6 | 导航 IA：报表中心子菜单名称与用户心智一致 | layout.md |
| UX-T7 | 同步任务表单分区清楚，主按钮与禁用原因可理解 | SyncJobFormPage |
| UX-T8 | 无「白屏/空 html」类阻断体验 | 本轮 chartDeAxis 事故 |

- **非目标**：Jasper 设计器 WYSIWYG · 44 型图表样式 Tab · 全站 IA 大改

## 2. 用户旅程（链路）

```
侧栏「报表中心」→ 全部报表 Hub → 打开模板 → 自动运行 + 表格
                                    ↘ 发起导出 → 下载 PDF/Word/Excel
管理员：报表模板 → 扩展配置 / 调度 Tab
数据工程师：数据连接 → 同步任务新建 → 创建 / 立即运行
```

| 序 | 用户任务 | 清晰度 | 证据 |
|----|----------|--------|------|
| 1 | 找到报表 | 较好 | 侧栏 4 子项；Hub 搜索+格式筛选 |
| 2 | 看报表 | 较好 | 自动运行；「运行报表」可重跑 |
| 3 | 导出文件 | 较好 | 「发起导出」「下载」；状态中文 |
| 4 | 配定时邮件 | 中等 | 创建后需「立即激活」— Banner 文案清楚 |
| 5 | 配指标 SQL | **差** | 扩展页无 SQL 表达式输入 |
| 6 | 建同步任务 | 较好 | 分区标题+说明；创建/返回明确 |

## 3. 子能力判定（用户可用性）

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| UX-T1 | Hub 发现与筛选 | REAL | 8/B | 浏览器：搜索/格式/空态文案；vitest 6/6 |
| UX-T2 | 查看页运行反馈 | REAL | 8/B | 自动运行+表格+占位提示分角色 |
| UX-T3 | 导出按钮清晰度 | REAL | 8/B | 「发起导出」「下载」；格式 Select |
| UX-T4 | 调度激活心智 | REAL | 8/B | Banner「点击激活后才会按时发送」 |
| UX-T5 | 模板扩展配置 | **PARTIAL** | 5/C | Dataset 可绑；**SQL 无表达式框**；仅追加不可改删 |
| UX-T6 | 导航 IA | REAL | 7/B | 全部报表/预制/模板/调度命名一致 |
| UX-T7 | 同步任务表单 | REAL | 8/B | 分区+说明；立即运行 disabled+title |
| UX-T8 | 无阻断白屏 | REAL | 9/A | chartDeAxis 导出已修；build 绿 |

**汇总**：6 REAL · 1 PARTIAL · 0 STUB → **总体 PARTIAL（好用但未达「配置闭环清晰」）**

## 3b. 前端控件下钻（用户可见主按钮）

| ID | 文案/位置 | 期望（用户） | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|--------------|------|---|---|---|---|---|------|------|------|
| B1 | Hub「打开」默认报表 | 一键进角色默认 | Link「打开」清晰 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | Metrics 条 |
| B2 | Hub 行「运行」 | 进查看页并出数 | Play 图标+链接 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | TemplateTable |
| B3 | View「运行报表」 | 重跑刷新表格 | 主按钮+loading | 2 | 2 | 2 | 2 | 2 | 10 | REAL | ReportViewPage |
| B4 | View「返回全部报表」 | 回 Hub | outline+箭头 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | smoke |
| B5 | Export「发起导出」 | 知道在干什么 | 文案明确 | 2 | 2 | 2 | 2 | 1 | 9 | REAL | ReportExportCard |
| B6 | Export「下载」 | 出文件 | 有链接后出现 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | smoke |
| B7 | Schedule「立即激活」 | 懂草稿≠已发送 | 黄条+强文案 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | Banner test |
| B8 | 扩展「保存扩展配置」 | 保存指标生效 | toast 成功 | 2 | 1 | 2 | 2 | 2 | 9 | PARTIAL | **SQL 缺 expression** |
| B9 | 扩展查数模式 | SQL/Dataset 可选 | select 有选项 | 2 | 1 | 1 | 2 | 2 | 8 | PARTIAL | Dataset 有 bind；SQL 不完整 |
| B10 | 同步「创建」/「保存」 | 主操作明确 | 顶栏 primary | 2 | 2 | 2 | 2 | 2 | 10 | REAL | SyncJobFormPage |
| B11 | 同步「立即运行」 | 脏数据时知为何禁 | title 提示先保存 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 代码+走查 |
| B12 | 同步「返回列表」 | 回列表 | outline 链接 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 走查 |
| B13 | 离开未保存对话框 | 三选一清楚 | 留/弃/存并离开 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 浏览器 snapshot |

Out：批量导入细项块 · 模板块 JSON 编辑器 · 预览 Tab 内 JSON 折叠（见修复项）

## 3d. 覆盖矩阵

| 实体 ID | 深度 | L | C | 判定 | 证据 |
|---------|------|---|---|------|------|
| UX-T1 Hub | BROWSER+UI | 2 | 2 | REAL | 浏览器 + vitest |
| UX-T2 View | BROWSER+UI | 2 | 2 | REAL | 源码 + smoke |
| UX-T3 Export | UI | 2 | 2 | REAL | 组件文案 |
| UX-T4 Schedule | UI | 2 | 2 | REAL | Banner |
| UX-T5 扩展配置 | UI | 2 | 1 | PARTIAL | 缺 SQL expression |
| UX-T6 导航 | BROWSER | 2 | 2 | REAL | 侧栏 snapshot |
| UX-T7 同步表单 | UI | 2 | 2 | REAL | SyncJobForm 分区 |
| UX-T8 无白屏 | CHAIN | 2 | 2 | REAL | vite build |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 8 |
| REAL 达标 | 7 / 8 |
| PARTIAL | 1（UX-T5） |
| **逐一校验** | **是**（8 项均有 L1） |
| 打通但不对 | **1**（B8/B9：能点保存但 SQL 配置不完整） |
| 总体可否 REAL | **否** — UX-T5 未闭环 |

## 4. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | vitest reports | 主流程控件可点 | **31 passed** | ✅ | 2026-08-04 19:06 |
| 2 | 浏览器 Hub | 见标题/搜索/表 | 侧栏+「全部报表」路由 | ✅ | `:5173/admin/reports/center` |
| 3 | 浏览器离开守卫 | 三按钮清晰 | 留/弃/存并离开 | ✅ | 组件库编辑页跳转 |
| 4 | 扩展页源码审阅 | SQL 可配 expression | **无输入框** | ❌ | TemplateDetailPanel.tsx |
| 5 | vite build | 无白屏根因 | **通过**（MULTI_DIM_OPTS 已 export） | ✅ | build 11.6s |

## 5. 修复文档（用户可用性）

### UX-T5 / B8 — 扩展配置 SQL 模式缺表达式（P0）

**判定**：PARTIAL 5/10，C=1  
**期望 vs 实际**：用户选 SQL 模式后应能填 `SELECT …`；实际只有指标键/显示名，保存的 metric **无 expression**，运行易占位或失败。  
**根因**：`TemplateDetailPanel.tsx` 扩展表单未渲染 SQL 表达式字段。  
**修复方向**：`queryMode=sql` 时增加「SQL 表达式」Textarea + `defaultDataSourceId` 选择；保存时写入 `expression`。  
**修后验收**：手测 Case 20 SQL 分支 + vitest 保存 body 含 expression。

### UX-T5 — 已添加指标不可编辑/删除（P1）

**期望 vs 实际**：列表只读，只能追加，误配无法改正。  
**修复方向**：行内编辑/删除 + 保存时替换 metrics 数组。

### B5 附属 — 预览 Tab 展示原始 JSON（P2）

**期望 vs 实际**：管理员预览应接近表格或摘要；实际 `JSON.stringify(renderSpec)`。  
**修复方向**：复用 `ReportResultTable` 或折叠「开发者 JSON」。

### 文案 — 中英混用（P2）

| 位置 | 现状 | 建议 |
|------|------|------|
| 模板块空态 | `templateKey` | 「模板键」 |
| Badge | `Dataset` | 「数据集」 |
| select option | `SQL` / `Dataset` | 「SQL 查询」/「数据集」 |

### UX-T8 — 白屏事故（已修，P0 回归）

**根因**：`chartDeAxis/builders.ts` 未 export `MULTI_DIM_OPTS` → 整站 JS 加载失败。  
**建议**：CI 增加 `vite build` 门禁，避免 dev 能跑、首屏静默失败。

## 6. 用户视角总评

### 做得好的地方

- **消费路径短**：Hub → 打开 → 自动出数 → 导出，按钮动词清楚（运行/导出/下载）。
- **调度心智模型**：草稿与激活分离，黄条文案直接说明后果。
- **同步任务表单**：按「基本信息 / 业务源 / 目标表 / 调度」分区，说明文字帮助首次用户。
- **空态与错误**：Hub、View 有中文空态与 `PageErrorBanner`，不是沉默失败。

### 主要不顺手之处

1. **配报表指标（管理员）**：SQL 模式缺核心字段，是配置闭环最大短板。
2. **术语**：技术词（templateKey、Dataset）露给业务管理员。
3. **预览**：扩展预览像开发者工具，不像「给用户看的样张」。

## 7. 交接

- **结论**：**业务用户「看报表、导出、定时」路径好用、按钮清晰（REAL）**；**管理员「配 SQL 指标」不顺手（PARTIAL）**，拉低整体。
- 建议优先修 **P0：扩展页 SQL 表达式**；其余 P1/P2 可排期。
- 用户批准修复：**否**（本轮仅 UX 审计）
