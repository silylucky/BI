# 扫描工作流

目标：用代码事实填满 `docs/ui`，不是凭印象写设计作文。

## 1. 定位前端根

候选：`fe/`、`web/`、`apps/web`、`apps/console`、`src/`（看 package 与路由入口）。  
多包 monorepo：每个**产品表面**可对应一篇 `*-ia.md`，壳层可共用一篇 `layout.md`。

## 2. 壳层

搜：`layout`、`AppLayout`、`Sidebar`、`Header`、`Shell`。  
记录：文件路径、侧栏宽（class 或常量）、内容区 max-width/padding、是否多域 layout。

无共享壳 → `layout.md` 写明「页级自管」，仍列禁止私造基元。

## 3. 导航 / IA

搜：`nav-config`、`sidebar`、`menu`、`routes`、`createBrowserRouter`、`RouteObject`。  
优先**配置真源**（数组/对象），路由文件作对照。  
每个独立壳（Console / Admin / Settings…）→ 一篇 `*-ia.md`。

## 4. 页菜谱与标杆

1. 有 `components/templates/*` 或 page-craft skill → 建索引表。  
2. 否则按 ui-ux-reviewer 菜谱 A–F 抽样 1～3 个最完整页作标杆，写入 IA 的「页菜谱对照」。  
3. 标杆路径必须可点击到源码。

## 4.1 页头形态（写入 `layout.md` · 必做）

**自动发现，不要猜。** 抽 ≥3 个主表面列表/概览页，看页首标题区：

| 观察 | 记入形态 |
|------|----------|
| 标题区在**独立圆角/浅底卡片**内（常含语义 icon + 标题 + 灰字说明；**右侧常有主/次按钮**） | `title-card` |
| 标题区直接落在内容区，**无**独立卡外包（可有底部分割线；右侧仍可有操作） | `flush` |
| 多数页只有标题、无 description | `minimal`（须多数页一致才成立） |
| 混用两种且都多 | 记「混用，待收敛」+ 各举 1 路径；**默认以出现次数更多者为全站主形态**，少数页进 IA「例外」 |

同时记录：**页头右侧是否放操作**（标杆有则 layout 写「右操作：是」+ 主次按钮样式）。搜共享组件名：`PageHeader`、`*TitleCard*`、`*PageTitle*`、`ConsolePageHeader`、`RepoPageTitleCard` 等，把**真实 import 路径**写入 layout「页头形态 · 共享组件」。

另抽 ≥2 个列表页：行「操作」列是否 **ghost**；写入 layout「列表行操作」约定（与 ui-ux 菜谱 B 一致：ghost · >4→`…` · 删除红）。

**修订已有 docs/ui 时**：若缺「页头形态」节 → 补扫补写；若代码已改形态而文档未改 → 更新并升/降可信度。

## 5. 设计锚素材（产出 `anchor.md`，格式见 [anchor.md](anchor.md)）

- **组件库**：读 `package.json` / 依赖清单，记库名 + 版本 + 图标库；发现两套同类库 → 记为待收敛项。  
- **Token 真源**：读 `index.css` / theme / tailwind config，确定**唯一**真源文件路径（只链，不抄色板）。有 design-system skill / `docs/design-system-pin.md` → 链过去。  
- **外部参考锚**：用户给过的规范链接、姊妹仓路径、竞品截图目录；都没有 → attended 问一句，unattended 取组件库官方示例页。每条必须写**锚定层次**。  
- **已定取舍**：从标杆页反推密度基调、圆角/阴影档位、色彩语义、字号阶梯；反推不出的标 `assumed`。  
- 无 pin 且 Token 分散 → 建议用户补 pin（可起草提纲，**默认不**把色值表写入 ui）。

## 6. 帮助矩阵（可选）

若存在 `content/help` / `docs/help` 规划需求 → `help-doc-matrix.md`（slug + 文型），不写操作步骤正文。

## 7. 对照参考仓（可选）

用户点名 ark/nex 时：只比**文件是否齐全、章节骨架**，输出差距清单（如「缺 layout.md」）。  
**禁止**复制其模块名表与规格数字。

## 8. 写入检查

- [ ] 每篇有元信息表与 `last_verified`  
- [ ] `anchor.md` 存在：组件库 + token 真源 + ≥1 外部锚（带锚定层次）+ 每项可信度  
- [ ] token 真源路径与标杆页路径**真实存在**（编路径 = reviewer 必挂）  
- [ ] 所有 `assumed` 项已进回传 `blockers`；无 `confirmed` 冒充  
- [ ] 壳层/导航数字与标签旁有代码锚点  
- [ ] IA vs 视觉分界节存在  
- [ ] 页菜谱至少抽样标杆（绿地写「无标杆，对照外部锚 #N」）  
- [ ] 无大段 Token 色板  
- [ ] `layout.md` 含 **页头形态**（`title-card` / `flush` / `minimal`）+ 右操作约定 + 共享组件路径 + ≥2 抽样标杆  
- [ ] `layout.md` 含 **列表行操作**（ghost · >4→`…` · 删除红）或链向 ui-ux 菜谱 B  
- [ ] 用户已确认文件列表（unattended：跳过，但须走最小基准范围）  
