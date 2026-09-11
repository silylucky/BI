# Component Reuse（同构页面应复用公共组件）

同菜谱 / 同交互模式的页面**必须**对齐本仓已有共享壳；禁止每页复制一套略有差异的 Header、列表壳、空态、KPI 卡。本检查独立于「看起来像不像标杆」——即便各自都「好看」，若结构重复却未复用，仍报。

## 何时必查

- 上线前全量扫：Phase 2 菜谱分类后，主 agent 或单独 lane 做**跨页复用审计**
- 同菜谱 ≥3 页、或同域 ≥2 列表/详情页
- FE Card 已标出共享组件目录（`components/`、`templates/`、`ui/`…）

## 判定门槛（报 finding）

下列**同时**成立 → 至少 **P1「应复用未复用」**：

1. **结构同构**：同属一菜谱（如皆为 B 资源目录），或明显同一模式（页头+工具栏+表+分页 / 空态三件套 / KPI 栅格）。
2. **实现分叉**：各页内联或本地复制了该结构，**未**引用本仓已有共享组件；或共享组件存在但本页手写平行实现。
3. **可抽出证据**：能指出「应对齐的共享组件 path」或「建议从标杆抽出的单元名」+ 至少 **2** 个违规页 path。

**升 P0**：分叉导致行为不一致且造成假交付（一页有空态 CTA、同构另一页无；一页分页另一页静默截断等）——按完整度/半成品报，并在证据中注明「复用缺失是根因」。

## 非问题（勿报）

| 情况 | 原因 |
|------|------|
| 仅 1 页使用的独特布局 | 无复用对象 |
| 有意差异且文档/设计说明（如向导 vs 列表） | 不同菜谱 |
| 共享组件尚不存在，仅 2 页轻微相似 | 可记 P2「建议抽取」；≥3 页同构则升 P1 并建议 W1 先抽 |
| Storybook / 测试夹具中的重复 | 非产品路径 |
| 使用共享组件但传不同 props/插槽 | 正当复用 |

## 优先核对的共享面清单

对照 FE Card「已有共享组件」；没有则从标杆页反提：

| 表面 | 典型共享名（举例，以本仓为准） | 未复用症状 |
|------|--------------------------------|------------|
| 页头 | `PageHeader` / `RepoPageTitleCard` / `ConsolePageHeader` | 多页各自 `h1`+散落 Button |
| 列表壳 | `TableListPage` / `ResourceListShell` | 每页自拼 Card+Toolbar+Table+Pagination |
| 空态 | `EmptyState` / `PageState` | 「暂无数据」文案与 CTA 各写各的 |
| 加载/错误 | `QueryShell` / `PageState` | 有的 spinner、有的原文 error |
| KPI/入口卡 | `MetricsKpiCard` / 色调入口 | 同构概览页各写一套 grid+数字 |
| 筛选条 | 共享 FilterBar | 散装 Input 布局每页不同 |
| 表单壳 | `FormPageShell` | 详情/新建页边距与分组不一致 |
| Markdown/帮助阅读 | 文档 `variant` 或 DocShell | 帮助/README 裸 prose 与产品文风两套 |

## 扫法（给 subagent）

1. 从勾选表按菜谱分组，每组取 2～4 个页面文件。  
2. 列出本仓 `components/**`、`templates/**` 中页级壳（import 次数高的优先）。  
3. 对每组：标杆/共享组件是否被 import？若否，对比 JSX 结构是否同构（页头块、工具带、表、空态）。  
4. 搜重复结构种子（按栈改写）：

```bash
# 多页手写页头而非共享组件（把 SharedHeader 换成本仓真实名）
rg -n -i 'PageHeader|RepoPageTitleCard|ConsolePageHeader|TableListPage|EmptyState|PageState|QueryShell|MetricsKpiCard|FormPageShell' \
  --glob '**/pages/**/*.{tsx,vue,svelte}' -c

# 同构手写痕迹：多页同时出现「裸 h1 + 自拼 Card 表」且不 import 上表组件
rg -n '<h1[ >]|暂无数据|Pagination|CardHeader' \
  --glob '**/pages/**/*.{tsx,vue,svelte}'
```

5. 回传格式：

```text
### 复用审计
- 已有共享壳：path…
- P1 应复用未复用：`[P1] 列表壳未复用 TableListPage — pages/A.tsx, pages/B.tsx, pages/C.tsx — 建议 import 或抽到 components/…`
- P2 建议抽取（尚无共享、≥3 页同构）：…
- 通过（已复用）：菜谱 B · n 页
```

## 修复纪律

- **先抽/先对齐共享（S0）**，再改各页引用；禁止三页各改成「看起来像」但仍不共享。  
- 抽出时以**最完整标杆**为源，删掉弱实现，不要平均成三套的大杂烩。  
- 共享文件变更串行；合入后回归同菜谱抽检 ≥2 页。
