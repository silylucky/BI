# 数据源与 Dataset 模块 — 产品体验待优化 · 2026-07-30

> **Skill**：`~/.cursor/skills/product-experience-critique/` · **dry-run**（仅读码，未改 fe）  
> **Persona**：IT 数据管理员 · **范围**：`/admin/datasources` · `/admin/datasets`

## 总览

| 项 | 内容 |
|----|------|
| Persona | IT 数据管理员（配连接、维护语义层 Dataset） |
| 范围 | `DatasourceListPage` · `DatasetListPage` |
| 主任务 | 查找/筛选连接 · 新建与维护 Dataset · 批量删除 |
| 综合分 | **7.0 / 10**（**capped**：未 browser 走查，见 Blind spots） |
| P0 / P1 / P2 / P3 | 0 / 0 / 5 / 1 |
| Blind spots | 未起 `.dev` + browser；**无 P0/P1**；补走查后可上调/新增严重项 |
| 评审方式 | 读码 + 同模块页面对照 |

一句话：数据源列表较完整，Dataset 列表在同模块下像「半成品」——缺搜索、加载反馈弱、术语不友好，维护多条数据时效率明显偏低。

## 维度得分

| 维度 | 权重 | 得分 | 一句话 |
|------|------|------|--------|
| 任务可完成度 | 20% | 8 | 主路径可闭环；Dataset 找条目更费劲（ISSUE-001） |
| 操作效率 | 15% | 7 | Dataset 无搜索，数据量上来只能翻页（ISSUE-001） |
| 按钮与布局 | 15% | 7 | 批量入口依赖工具栏开关，不够显眼（ISSUE-004） |
| 视觉与舒适度 | 15% | 7 | Dataset 加载无骨架行，易误判空白（ISSUE-002） |
| 反馈与容错 | 15% | 8 | 两页均有 PageErrorBanner；删除有确认框 |
| 信息架构与文案 | 10% | 6 | 页标题「Dataset」+ 描述含 META-004，对管理员不友好（ISSUE-003） |
| 一致性与可预期 | 10% | 6 | 同模块两列表能力不对齐（ISSUE-001、ISSUE-005） |

**加权演算**：7.2 → **cap 7.0**（Blind spot 规则）

## 用户旅程痛点

### 任务：在 admin 里维护多个 Dataset

1. 侧栏进入 Dataset 列表 → 页标题是英文「Dataset」，新手不确定是不是「数据集」（ISSUE-003）
2. 列表变长后找某一个 → **没有搜索框**，只能分页翻（ISSUE-001）
3. 等待加载 → 表格区域可能长时间空白，不像数据源页有骨架行（ISSUE-002）
4. 想批量删测试数据 → 要先找「批量模式」开关，不如数据源页工具栏直观（ISSUE-004）
5. 看「绑定配置」列 → 只显示 UUID 前 8 位，鼠标无完整提示时猜不出绑的是谁（ISSUE-005）

### 任务：对照维护数据源（标杆体验）

1. 数据源列表有搜索 + 类型筛选 + 「筛选结果 N 条」→ Dataset 侧无对等能力（ISSUE-001）
2. 行操作：数据源有「查看/编辑/删除」，Dataset 仅「编辑/删除」，无只读查看入口（ISSUE-006）

## 问题清单

| ID | 严重度 | 维度 | 用户场景 | 问题描述 | 建议优化 | 证据 | 置信度 |
|----|--------|------|----------|----------|----------|------|--------|
| ISSUE-001 | P2 | 一致 / 效率 | 管理员在几十条 Dataset 里找名称 | 「数据源列表能搜名称，Dataset 列表却搜不了，感觉像没做完」 | Toolbar 增加 SearchField（对齐 DatasourceListPage）；可选客户端过滤或 API query | code: `DatasetListPage.tsx:115-126` 无 filters；对比 `DatasourceListPage.tsx:236-247` | 高 |
| ISSUE-002 | P2 | 视觉 / 反馈 | 进入 Dataset 列表等待 API | 「点进来表格一片空白，不知道是在加载还是坏了」 | DataTable 增加 `loadingRows={5}`（与数据源页一致） | code: `DatasetListPage.tsx:133-134` 无 loadingRows；对比 `DatasourceListPage.tsx:301` | 高 |
| ISSUE-003 | P2 | 文案 | 新管理员首次进入 | 「页面叫 Dataset，描述里还有 META-004，我不知道这是不是给我用的」 | 标题改为「数据集」或「语义数据集」；描述改用户语言，内部编号移入帮助/文档 | code: `DatasetListPage.tsx:108-111` | 高 |
| ISSUE-004 | P2 | 布局 | 需批量清理测试 Dataset | 「批量删除藏在一个开关里，不点批量模式根本看不到删多个的入口」 | 工具栏左侧保留 filters 区；批量区与数据源页相同布局；可选默认提示文案 | code: 两页 Toolbar 结构对比 | 中 |
| ISSUE-005 | P3 | 效率 | 核对 Dataset 绑定的配置 | 「绑定配置只显示一截 ID，我对不上是哪个环境」 | 列展示可读名或 TruncateHint 悬停完整 ID | code: `DatasetListPage.tsx:181` | 中 |
| ISSUE-006 | P2 | 一致 | 只想查看 Dataset 详情不编辑 | 「数据源可以点眼睛查看，Dataset 只能直接进编辑，怕误改」 | 增加只读详情路由或查看 IconButton（若产品允许） | code: `DatasetListPage.tsx:183-197` vs `DatasourceListPage.tsx:388-391` | 中 |

## 待优化 backlog

| 优先级 | ISSUE | 用户价值 | 建议改什么 | 建议不改什么 |
|--------|-------|----------|------------|--------------|
| 1 | ISSUE-001, ISSUE-002 | 日常找数、加载可预期 | Dataset 列表补 Search + loadingRows | 不改 datasets API 契约（除非后端本就有 search 参数） |
| 2 | ISSUE-003 | 降低学习成本 | 页标题/描述中文化 | 不改 META-004 需求范围本身 |
| 3 | ISSUE-004 | 批量运维效率 | Toolbar 布局对齐数据源页 | 不改批量删除 API |
| 4 | ISSUE-006 | 防误改、与数据源一致 | 评估是否加只读详情页 | 不在本 backlog 强开新路由（需产品确认） |
| 5 | ISSUE-005 | 核对绑定关系 | 列展示/Tooltip 增强 | — |

## 相邻 skill 交接

| 发现 | 建议 skill |
|------|------------|
| ListKit 壳层不一致（Search、loadingRows、error 位置） | `page-style-sync`（金标准 `DatasourceListPage`） |
| 行操作/幽灵按钮/删除红等毕业项 | 仓内 `ui-ux-reviewer` |
| Dataset CRUD 是否假绿 | `feature-truth-verify` |
| 补 P0/P1 运行时证据 | `browser-reviewer` + `.dev` |

## 下一轮

- [ ] browser 走查 `/admin/datasets`、`/admin/datasources` 验证 ISSUE-001/002 主观感受
- [ ] 用户回复「按 backlog 修」→ 优先项 1 可交 `page-style-sync` batch1
