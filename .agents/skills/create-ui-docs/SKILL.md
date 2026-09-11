---
name: create-ui-docs
description: >
  从当前前端仓提取 UI/UX 壳层、信息架构、页菜谱与设计约定，并钉设计锚（组件库 + token 真源 +
  外部参考锚 + 可信度分级），写入 docs/ui/；规定做页/改页时如何消费该基准以防风格漂移。
  Use when initializing docs/ui, pinning a design anchor, greenfield UI baseline with no page to
  extract, external design-system reference (shadcn/Ant/Material/company spec/sister repo),
  extracting layout/IA/page recipes, designing or optimizing a page against docs/ui,
  提取 UI 体系 / 设计锚 / 绿地建锚 / 做页设计步骤 / 防风格漂移, or before go-fast/ui-ux-reviewer
  needs a docs/ui baseline.
---

# Create UI Docs（提取 UI 体系 → `docs/ui/`）

从**正在开发的仓库**扫前端事实 + **钉外部设计锚**，产出/修订 `docs/ui/`，作为写新页面与 UI 评审的**布局与风格基准**。

Agent 已会读 React/Vue；本 Skill 补：**设计锚与可信度分级**（见 [anchor.md](references/anchor.md)）、**IA vs 视觉分界**、**固定文件分类**、**链代码真源不抄 Token 表**、**先预览后写入**、**做页/改页如何消费 docs/ui**（见 [page-design.md](references/page-design.md)）。

**基准必须有锚。** 无锚点自造的「基准」会形成「AI 造基准 → AI 照它实现 → AI 拿它评审 → 自证合规」的闭环，漂移要到人工验收才暴露。锚有三档可信度（`confirmed` / `inferred` / `assumed`），**禁止**把 `assumed` 当已确认使用。

## 何时启用


| 场景                             | 动作                                |
| ------------------------------ | --------------------------------- |
| 仓内无 `docs/ui/` 或严重过时           | 全量提取 → 预览 → 写入                    |
| 壳层/导航/模板大改后                    | 增量修订对应文                           |
| 用户要「防风格漂移基准」                   | 确保至少有 `anchor.md` + `layout.md` + 主表面 `*-ia.md` |
| **绿地仓（无成熟页可提取）**               | 走 [anchor.md](references/anchor.md) §5 建锚路径：先钉组件库与 token 来源，再取官方示例作骨架锚 |
| go-fast / ui-ux-reviewer 发现缺基准 | 先跑本 Skill，再开工/评审；unattended 见 [anchor.md](references/anchor.md) §4「最小基准」 |
| 要写新页 / 优化旧页但不知从哪对齐             | 基准齐则直接按 [page-design.md](references/page-design.md)；缺基准先提取 |


**不要**：把 Token 色板全文抄进 `docs/ui`；写用户帮助正文（那是 help/user-guide）；未确认覆盖精修文档；照搬参考仓的业务 IA；在无 `docs/ui` 时放任页面自由发挥。

## 与姊妹 skill


| Skill                                              | 关系                                      |
| -------------------------------------------------- | --------------------------------------- |
| [go-fast](../go-fast/SKILL.md)                     | 写前端前**必读** `anchor.md` + `docs/ui/` + page-design；缺锚先本 Skill |
| [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md)       | 先验基准可信度再以 `docs/ui` 为标杆；修复批次按 page-design B 节 |
| [docs-reviewer](../docs-reviewer/SKILL.md)         | 管 docs 分类与模板；本 Skill 专责 **从代码提取 UI 基准** |
| [user-guide-writer](../user-guide-writer/SKILL.md) | 终端帮助；可选 `help-doc-matrix.md` 只做规划矩阵     |
| [product-blueprint](../product-blueprint/SKILL.md) | 文字版页面说明须**引用**本 Skill 产出的菜谱/锚，禁重发明壳；禁套卡见 craft |

## 必读顺序（≤3 次）

1. 本文件「产物树」+「分界」+「流程」+「红线」
2. [references/anchor.md](references/anchor.md)（设计锚 · 可信度 · 最小基准 · 绿地路径）+ [references/taxonomy.md](references/taxonomy.md) + [references/templates.md](references/templates.md)
3. 提取时：[references/scan-workflow.md](references/scan-workflow.md)；**做页/改页时**：[references/page-design.md](references/page-design.md) + [references/craft.md](references/craft.md)

---

## 做页 / 改页（消费契约 · 摘要）

完整步骤见 [page-design.md](references/page-design.md)；密度·交互·卡片·详情只读·用户向文案·抛光见 [craft.md](references/craft.md)。最低要求：读 `anchor.md` + `layout.md`（含**页头形态**）+ 对应 `*-ia.md` + 标杆页源码 → 定菜谱与标杆 → 写设计卡 → 只拼已有壳/模板/基元 → 自检 → 改了约定回写 `docs/ui`。

无基准 → **先本 Skill 提取**，再实现。

## 产物树（写入目标仓）

```text
docs/ui/
├── anchor.md              # 必：设计锚 —— 组件库、token 真源、外部参考锚、已定取舍、可信度
├── layout.md              # 必：壳层规格、域布局表、页面模板索引、禁止项、验收入口
├── <surface>-ia.md        # 必：主产品表面 IA（如 console-ia / app-ia）
├── admin-ia.md            # 有独立管理端时
├── <domain>-ia.md         # 大域子导航（可选，如 release-ia）
└── help-doc-matrix.md     # 可选：帮助 slug 规划（正文仍在产品 help 目录）
```

Token / 组件细则**不**进 `docs/ui` 正文：`anchor.md` 只链真源（`docs/design-system-pin.md` / design-system skill / `fe/src/index.css` / `components/README.md`）。元信息与命名见 [taxonomy.md](references/taxonomy.md)。

## 分界（强制）

| 写在 `docs/ui`           | 不要写进 `docs/ui`    |
| ---------------------- | ----------------- |
| 壳层比例与域布局表（链实现文件）       | 完整 Token 色板复制     |
| 导航/IA 与路由域对应（链 nav 真源） | 逐路由全表（易过时；抽样菜谱即可） |
| 页菜谱对照 + 标杆页路径          | 组件 API 手册         |
| 权限表面、禁止项、验收命令          | 用户操作手册正文          |
| 外部参考锚 + **锚定层次**（骨架/密度/交互/选型） | 照抄外部产品像素、外部业务文案与品牌色 |

---

## 流程（必须）

### Phase 0 · UI System Card

| 项            | 探测                                            |
| ------------ | --------------------------------------------- |
| 前端根          | `fe/` / `web/` / `apps/web` / `src/` …        |
| 框架           | React/Vue/…；路由入口                              |
| **组件库 + 版本** | `package.json` / 依赖清单；有无并存两套同类库               |
| 壳层           | `layouts/*` 或 `components/layout/*`           |
| 导航真源         | `*nav*config*` / `layouts/nav/*`              |
| 模板/菜谱        | `components/templates/*`、page-craft skill、标杆页 |
| Token 真源     | `index.css` / theme；设计系统 skill；是否已有 pin       |
| **外部参考锚**    | 用户给过的规范链接 / 姊妹仓路径 / 竞品截图目录；无则问，unattended 用组件库官方示例 |
| 已有 `docs/ui` | 列表 + 过期嫌疑 + `anchor.md` 是否存在                  |

写出短 Card；模式：`新建` / `体检修订`。

### Phase 1 · 有界扫描 + 钉锚

按 [scan-workflow.md](references/scan-workflow.md) 扫壳、导航、模板、标杆页；**禁止**无锚点臆造规格。  
同时按 [anchor.md](references/anchor.md) 收集设计锚素材；绿地仓走其 §5 建锚路径，**不得**跳过组件库与 token 选型直接即兴。

### Phase 2 · 起草

先起草 `anchor.md`（[anchor.md](references/anchor.md) §2 模板），再按 [templates.md](references/templates.md) 起草 `layout.md` + 各 `*-ia.md`。  
每条规格旁写**实现锚点路径**与**可信度**；无锚点的取舍标 `assumed`，不确定标 `（待确认）`。

### Phase 3 · 预览确认 / unattended 诚实写入

| 模式 | 做法 |
|------|------|
| attended | 展示将新建/覆盖文件列表 + 各文目录 + 结构差异 → 用户确认后写入；确认过的项可标 `confirmed` |
| unattended（go-fast 等调用） | 不停问，直接写；范围收敛到 [anchor.md](references/anchor.md) §4「最小基准」6 项；可信度**一律**只能 `inferred` / `assumed`；所有 `assumed` 项与未钉死项进 `blockers` |

unattended **禁止**：标 `confirmed`；写「已确认 / 已评审」措辞；超出最小基准写整套臆造设计规范。

### Phase 4 · 索引与回传

- 更新或提示更新 `docs/README.md` 的 ui 索引行  
- 若存在 `.cursor/rules/prd-sync.mdc`，确认含 `docs/ui` 触发（缺失则建议补，不擅自大改规则除非用户要）



## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: create-ui-docs
mode: create | revise | minimal-baseline   # minimal-baseline = unattended 缺锚
artifacts:
  - docs/ui/anchor.md
  - docs/ui/layout.md
  - docs/ui/console-ia.md
anchor:
  confidence: confirmed | inferred | assumed   # 取全文最低项
  component_lib: ""            # 库名 + 版本
  token_source: ""             # 真源文件路径（必须真实存在或本批将创建）
  external_refs: []            # 每条：参考 + 锚定层次
  assumed_items: []            # 凭空填的取舍，逐条列出
summary:
  - ""
blockers:
  - ""                         # assumed 项与未钉死项必须在此出现
followups:
  - "go-fast / ui-ux-reviewer 写页或评审前读 docs/ui/anchor.md + layout.md"
  - "Token 变更走 design-system-pin / 设计系统 skill，勿塞进 ui 正文"
```

## 红线

- **禁止**把参考仓（ark/nex）或任何外部产品的业务导航、文案、色值、像素抄进目标仓（锚定层次边界见 [anchor.md](references/anchor.md) §3）
- **禁止**无代码锚点编写「侧栏宽度 / 模板名」等规格
- **禁止**无锚点自造视觉基准冒充事实基准；凭空填的取舍必须标 `assumed` 并进 `blockers`
- **禁止**把 `assumed` 标成 `confirmed`，或让 `assumed` 项充当评审「合规」依据
- **禁止**用 `docs/ui` 代替设计系统 Token 真源
- **禁止**未确认覆盖已有精修 ui 文档
- **禁止**把帮助中心正文写进 `docs/ui`（矩阵除外）

