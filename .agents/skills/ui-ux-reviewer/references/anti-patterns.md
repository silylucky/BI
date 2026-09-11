# Anti-Patterns（验收 fail）

命中即至少 **P1**；导致假交付或易损数据 → **P0**。对照**本仓标杆页**，勿套其他产品审美。

## 布局与视觉

| 反模式 | 为何 | 修法 |
|--------|------|------|
| 卡片套卡片（Card 内再大 Card 堆主内容；**大卡套并排步骤小卡**；内容区再套带边框提示条卡；**列表外卡套表格内框**——外层白卡含筛选项，内层再圆角描边包「表+分页」） | 噪、密度过假、双描边+双 padding | **一层**表面；步骤用编号行/同级条；提示用贴页头的 Alert；列表：筛+表+分页同层，表区**勿**再包第二层 Card/描边框（craft §6 反例 B） |
| **卡片大面积顶部色条 / 厚顶边框着色**当主装饰 | 俗、难主题化、抢内容 | KPI/入口用**语义色 icon**（或小色调 icon 底）；慎用 2～3px 左边语义条且同菜谱一致 |
| 筛选与表格同一扁平层、散装控件 | 扫视成本高 | 工具栏与表**分区**（同表面内 `gap`/分割线/浅底带宽）；**禁止**用「外 Card + 内 Table Card」假装分层（那是套卡） |
| 裸 `<h1>` / 无 description 的页头（当全站为 title-card 或标杆有说明时） | 无上下文、操作散落、**全站漂移** | 统一用 `layout.md` 登记的 PageHeader / TitleCard：**左** icon+标题+说明 · **右** actions |
| **页头形态漂移**：`layout.md` 为 `title-card` 却省略标题卡；或为 `flush`/`minimal` 却硬套独立标题卡 | 破坏全站风格 | 严格跟 `docs/ui/layout.md`「页头形态」；缺文档则先 create-ui-docs 补扫 |
| **页头缺右操作**：标杆/`layout.md` 约定标题卡右侧放主 CTA，本页却把「新建/从模板创建」等只塞进表工具栏、页头右侧空着 | 主入口位置漂移、扫视不一致 | 页头右槽：主 CTA = solid primary（通常 1 个）；次要 = outline/ghost；与标杆对齐 |
| **把页头标题卡误判为套卡而删掉** | 修出更大漂移 | 标题卡是壳层约定；禁的是**标题卡之下**再套内容大卡/步骤小卡/提示条卡/**表格内框** |
| Input / 页头标题区 **单页私改内边距**（绕过共享壳） | 密度漂移、同构页不一致 | 跟设计系统默认与标杆；改间距走 Token/共享组件 |
| 主内容列过窄、大面积无意义空白 | 「未做完」感 | 对齐标杆密度与栅格；有意义的空再用空态组件 |
| 同级页混用无关间距/圆角/阴影/Badge | 产品碎裂 | 只用本仓 Token 与共享壳 |
| 硬编码 `#RRGGBB` / 随意 Tailwind 色 | 主题与无障碍翻车 | 设计 Token / CSS 变量 |
| **同构页平行手写、不复用已有公共壳** | 风格与行为必然漂移 | 引用本仓共享组件；无则先抽再改页（见 component-reuse） |
| Dialog / Sheet / 抽屉 **遮罩过深**（如默认 `bg-black/80`、opacity ≥ 0.5） | 背景发闷、空间感差 | 遮罩约 **20%–30%** 黑（Sheet 可至 `/20`；Token `--overlay-scrim`）；见 shell-interaction §6 |
| **语义色缺失**：页头/入口/KPI/空态图标、Badge、状态点**几乎全蓝**（或全同一 primary） | 扫视无层次，状态难辨 | 按语义分色（见下「语义色」）；走 Token，勿硬编码 |

## 列表行操作（菜谱 B 必查）

| 反模式 | 为何 | 修法 |
|--------|------|------|
| 行末操作用 **实心 Primary / 默认 Button**（多颗蓝钮并排） | 抢主 CTA、表格噪 | 一律 **幽灵按钮**（`ghost` / `variant="ghost"` / 透明底+hover 浅底）；图标或短文案 |
| 行内操作 **>4 个**仍全部平铺 | 挤列、误触、窄屏碎 | 前 ≤3～4 个高频平铺；其余收进 **`…`（MoreHorizontal）** → DropdownMenu |
| **删除 / 移除 / 销毁** 与编辑同色（蓝/灰） | 危险不可辨 | 删除用 **destructive 红**（文字/图标 `text-destructive` 或红 Token）；仍须二次确认 |
| 溢出菜单内仍用实心主色钮堆叠 | 菜单变工具栏 | 菜单项默认中性；危险项单独红色并靠底 |

**约定摘要**：幽灵 · ≤4 平铺 · 超出 `…` · 删除红 · 对齐本仓 `DropdownMenu` / `Button ghost`。细节见 [page-recipes.md](page-recipes.md) 菜谱 B。

## 语义色（图标 · 状态 · 危险）

控制台忌「一片蓝」。对照**本仓 Token / 标杆 Badge**，禁止另造色板。

| 表面 | 反模式 | 修法（语义，非具体 hex） |
|------|--------|--------------------------|
| 页头 / 入口 / KPI 图标 | 每页图标都 `text-primary` / 蓝底 | 按域或指标语义轮换（信息蓝、成功绿、警告琥珀、中性灰、品牌辅色等）；同菜谱内自洽 |
| 任务 / 工单 / 作业 / 运行 **状态** | 全部同一蓝 Badge，或纯文字无色 | **分色 Badge/点**：如待处理=中性/信息、进行中=蓝或品牌、成功/完成=绿、失败/超时=红、暂停/取消=灰、告警=琥珀；文案+色双通道 |
| 删除按钮 / 危险菜单项 | 蓝色或默认主色 | **红色 destructive** |
| 成功 / 错误反馈 | 成功也用蓝、错误仅 toast 无色 | 成功绿、错误红（或本仓 status Token） |

**非问题**：品牌主色用于**唯一主 CTA**、链接、选中态；侧栏激活用 primary。问题是**装饰图标与业务状态全部挤在 primary**。

## 状态与完整度

| 反模式 | 为何 | 修法 |
|--------|------|------|
| 空态仅「暂无数据」无 CTA | 用户卡死 | 说明原因 + 主/次行动（创建、去配置、刷新） |
| 半页空白 / 原始异常串 / 英文堆栈进 UI | 不专业、不可排障 | 统一 Loading / Empty / Error 壳；错误中文化或产品文案 |
| 常驻 Skeleton 且无请求、或失败后仍骨架 | 假加载 | 接真数据或撤入口；失败走 Error |
| 列表无分页且不说明「仅 N 条」 | 误以为全集 | 分页或明确截断文案 |
| KPI/摘要可深链却不可点 | 死胡同 | 可点则必达目标路由；不可达勿做成链接样式 |
| 假数据 / mockData / 写死数组当正式列表或 KPI | 假绿 | 接 API；无数据走空态；禁止演示数默认开 |

## CRUD 与表单

| 反模式 | 为何 | 修法 |
|--------|------|------|
| **已有资源详情一进就是满屏可编辑表单**（无只读态、无「编辑」入口） | 易误改；无「先看再改」心智 | 默认 DescriptionList/只读；点「编辑」再进表单/Sheet/编辑路由；`/new` 除外 |
| 同域 Create 有的 Dialog、有的整页、无约定 | 学习成本 | 填 CRUD 选型：短表 Dialog/Sheet；长表/向导独立页 |
| 危险删除/不可逆操作用普通按钮无确认 | 误触 | AlertDialog / 确认模式；写清后果；按钮/菜单项为 **红色 destructive** |
| 列表行操作非幽灵、或 >4 平铺不收起 | 噪、误触 | ghost + `…` 溢出菜单；见「列表行操作」 |
| 居中 Dialog 做高级筛选或 ≥8 字段建档 | 拥挤、易截断 | Sheet / 独立页 / 分步向导 |
| 主路径手填文件系统路径或贴原始 JSON/YAML | 把用户当编辑器 | 选择器、结构化表单；YAML 仅高级折叠 |
| 主 CTA `onClick` 空、只 toast、不调 API | 半成品 | 补闭环或隐藏入口 |
| 「即将推出」仍展示可点主按钮 | 假交付 | 撤主 CTA 或撤路由 |

## 文案

| 反模式 | 为何 | 修法 |
|--------|------|------|
| 脚手架味标题（`Page`、`Test`、`TODO`、组件名当标题） | 未产品化 | 业务语言；与菜单文案一致 |
| **副标题 / hint / 空态 / toast / Alert 主文案**写内部状态机、后台码（如 `STA-00X`、`ERR_*`）、表名、API path、topic、**查询/请求参数名或代码字段名**（如 `ci_id`）、**合同角色口吻**（**甲方 / 乙方 / 我方 / 贵方**）、对内交付免责句 | 用户不懂；把控制台当运维手册 / OpenAPI / 合同附件 | **用户向**：缺什么对象、从哪进、点哪个按钮；码与字段名仅可进默认收起的「技术详情」；客户产品禁止「甲方」上屏 |
| ISO 原始时间戳无本地化/相对时间 | 难读 | 本仓日期组件或统一格式化 |
| 中英混杂无规范（产品已定简体中文时） | 粗糙 | 跟产品文案规范；错误信息可读 |
| 状态主文案直接甩原始 status code | 不可读 | 人话状态 + 语义色；原始码折叠或仅日志 |

## 组件复用

| 反模式 | 为何 | 修法 |
|--------|------|------|
| 同菜谱 ≥3 页各写一套 PageHeader / 列表壳 / 空态 | 维护成本高，细节必不一致 | S0 抽共享或统一 import 已有壳 |
| 本仓已有 `TableListPage` / `EmptyState` 等，新页仍复制粘贴 | 「第二套真相」 | 改引用；删弱实现 |
| 修复时三页各调样式「对齐观感」却仍不共享 | 下轮又漂 | 先共享后铺页 |

细则与扫法：[component-reuse.md](component-reuse.md)。

## 壳 · 导航 · 交互

| 反模式 | 为何 | 修法 |
|--------|------|------|
| 为侧栏预留宽度但 `sections`/菜单为空 | 大块空白壳 | 填导航或收起布局 |
| 菜单进 404 / 空白 Outlet | 主路径断 | 修路由或撤菜单 |
| 主提交无 loading、可连点 | 双单风险 | pending 禁用 |
| 无权限仍可点主 CTA，点后才原文 403 | 假可点 | 隐藏/禁用 + 统一 forbidden 态 |
| 弹窗/抽屉遮罩偏深或近乎不透明 | 上下文发闷 | 统一调浅到 **20%–30%**（Sheet `/20`）；组件库默认 `/80` 须覆盖 |

细则：[shell-interaction.md](shell-interaction.md)。

## 范围纪律

| 反模式 | 为何 | 修法 |
|--------|------|------|
| 误改锁定标杆页「顺便优化」 | 回归、冲突 | 标杆只读；回归另开最小 diff |
| 为对齐视觉手改 API 生成物 / 绕过本仓契约流程 | 后续生成冲掉 | 走仓内 codegen + 只改允许的 logic/手写层 |

## 快速搜法种子（按栈改写）

```bash
# 空态与半成品
rg -n -i '暂无数据|no data|coming soon|lorem ipsum|mockData|fakeData|Skeleton' \
  --glob '!**/node_modules/**' --glob '!**/*.test.*' --glob '!**/*.spec.*'

# 裸页头 / 危险
rg -n '<h1[ >]|alert\([\'\"]todo|onClick=\{\(\)\s*=>\s*\{\s*\}\}' \
  --glob '!**/node_modules/**'

# 硬编码色（示例；按项目 Token 习惯调整）
rg -n -i '#[0-9a-f]{3,8}\b|rgb\(|hsl\(' --glob '**/pages/**/*.{tsx,vue,svelte}'

# 过深遮罩（shadcn/radix 常见默认；命中后核对是否已调至约 /20–/30）
rg -n -i 'bg-black/(5[0-9]|[6-9][0-9]|80|70|60)|bg-zinc-950/(5[0-9]|[6-9][0-9])|DialogOverlay|SheetOverlay|DrawerOverlay|rgba\(0,\s*0,\s*0,\s*0\.[5-9]' \
  --glob '!**/node_modules/**' --glob '!**/*.test.*' --glob '!**/*.spec.*'

# 行操作：实心钮 / 缺 ghost / 缺溢出菜单（命中后打开行 actions 列核对数量与 variant）
rg -n -i 'variant=["'\''](default|primary|solid)|ActionsColumn|rowActions|操作列|MoreHorizontal|DropdownMenu' \
  --glob '**/pages/**/*.{tsx,vue,svelte}' --glob '**/components/**/*.{tsx,vue,svelte}'

# 删除是否 destructive / 危险色（无命中则抽查删除入口）
rg -n -i 'destructive|text-danger|text-red|危险|删除' \
  --glob '**/pages/**/*.{tsx,vue,svelte}' --glob '**/components/**/*List*.{tsx,vue,svelte}'

# 状态 Badge 是否分色（全是 primary/blue 可疑）
rg -n -i 'Badge|StatusBadge|status.*variant|bg-blue|text-primary' \
  --glob '**/pages/**/*.{tsx,vue,svelte}' --glob '**/components/**/*Status*.{tsx,vue,svelte}'

# 共享壳引用分布（把名字换成本仓真实组件；count 异常低的列表页可疑）
rg -n 'PageHeader|RepoPageTitleCard|TableListPage|EmptyState|PageState|QueryShell|FormPageShell' \
  --glob '**/pages/**/*.{tsx,vue,svelte}' -c
```

命中后**打开页面实现**核对是否主路径；测试双跳过。复用审计见 [component-reuse.md](component-reuse.md)。
