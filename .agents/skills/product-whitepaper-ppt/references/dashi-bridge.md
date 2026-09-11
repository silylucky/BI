# 对接 dashiai-ppt（默认出片路径）

`<dashi>` = 本机 `dashiai-ppt` 根目录，优先：

1. `~/.agents/skills/dashiai-ppt`
2. `~/.codex/skills/dashiai-ppt`
3. `~/.claude/skills/dashiai-ppt`
4. 用户指定路径

完整规则读 `<dashi>/SKILL.md`。本文件只写**本 Skill → dashi** 的桥接约定。

## 原则

- **锁模板填文案**：只填 props 可见文字；不改样式/结构/配色（除非用户要求）。
- 输出写在**目标仓** `docs/material/<slug>/`，不要写 `<dashi>/project/output`。
- 长 deck（≥30）必须先 `goal:scaffold`，再按 `goal.fill-plan.json` 分段填。
- 每页 `layout` 全局唯一；封面只能用主题前 5 页之一。

## 角色 → 选页

用 outline 的 `role` 调 layout:query（随机候选里挑，勿永远第一条）：

```bash
npm --prefix <dashi>/project run layout:query -- --theme <themePack> --role <role> --limit 8
```

| 白皮书区块 | 优先 role | **禁止** |
|------------|-----------|----------|
| 封面 | `cover` | — |
| 目录 / 场景地图 | `breakdown` | — |
| 价值主张 / 结论 | `statement` / `observation` / `result` | — |
| **定位 / In·Out 边界** | **`comparison` / `breakdown` / `statement`** | **空坐标、空象限、伪 2×2、metrics 空图** |
| 亮点深挖 | `case` / `result` | — |
| 已披露真实指标 | `metrics` | 编造数值；用 metrics 讲架构/边界；**数据点 <3 的空图** |
| **架构总览 / 拓扑 / 模块关系** | **`relationship` / `breakdown`** | **`metrics` 折线/雷达/假强度曲线** |
| 请求路径 / 业务流 / 步骤 | `process`（无则 `breakdown`/`actions`） | **`bump-rank` / `ranks` 座次图、估值排行、假名次冒充步骤** |
| 部署与运行形态 | `context` / `comparison`（短表） | CLI flag、包路径当主文案 |
| 对比 | `comparison` | — |
| 异常边界 | `risks` | — |
| 章节隔断 | `transition` / `ambient` | — |
| 落地下一步 | `actions` | — |
| 结尾 | `closing` | — |

### 架构页选版硬规则

1. outline 里架构总览页的 `role` 必须是 `relationship` 或 `breakdown`；scaffold / 换页后核对 `layout:query --role` 结果，**不得**因「看起来热闹」改选 metrics。  
2. 选 layout 后**先** `inspect:layout --compact`，确认字段是「盒子 / 关系 / 分层」类，不是 `periods`+`series`+`values` 数值图。  
3. 若唯一候选都是图表页 → 换 theme 或换 role 再查；仍没有 → 拆成两页 breakdown，**不要**硬塞假数据画拓扑。  
4. mermaid 架构图只留在 `diagrams/`；dashi 页用短标签盒子表达，不把整图原文塞进一个 prop。

### 定位 / 边界页选版硬规则

1. In Scope / Out of Scope **必须落成可读条目**（对比两列、卡片列表、或 statement + 条目），每侧至少 **3 条具体能力/非目标**。  
2. **禁止**用几乎无数据点的坐标图、象限图、空矩阵来「表示边界」——读者只看到轴标签和 IN/OUT 字样 = 废页。  
3. 边界原则（如「不做微服务 RPC」「观测外置」）写成短列表或 comparison 行，不要当空图脚注凑数。  
4. 标题必须是产品定位句本身；**禁止**把「定位一句话」这类写作提示留在幻灯片上。

### 媒体槽硬规则（防「点击上传」空页）

与 dashi SKILL 对齐，白皮书额外强制：

1. **默认无图**：白皮书多数页用纯文案 layout；`layout:query` **不要**默认加 `--needs-media`。  
2. 仅当用户提供截图/素材目录，或明确要求配图/生图时，才选带 `mediaSlots` 的页，并 `media:stage` → 写入相对路径。  
3. **禁止交付空媒体槽**：预览出现「影像 N」「点击上传」「+」占位框 = 废页。处理：换无媒体 layout，或补真实图后重渲染。  
4. 不要为了「好看」强选双图分栏页却不填图——这是目标用户页常见翻车。  
5. 素材不可访问 / 未同意生图 → 改选无媒体页，并在交付说明写明「本页无配图」。

### 中文排版硬规则（防乱断行 / 大字墙）

1. 主标题优先**一句短主张**（建议 ≤18 字；两行版式则每行是完整意群）。  
2. 禁止把长句硬塞进多行 title 槽导致**词中切开**（如「数据留 / 在内网」）。写不下 → 缩短或换 layout。  
3. 副文/说明句写完整；禁止截断残留。  
4. 多行标题用「意群换行」预拆进 `titleL1`/`titleL2` 等字段。  
5. 填完后在预览里**朗读标题**：读不通或停在半个词上 → 返工。  
6. **`type-statement` / 「大字主张」类 layout（如 theme01_page082）**：  
   - `lines` 每行总汉字建议 **≤12**，全页大字区合计建议 **≤24**  
   - 只放口号级短句；痛点说明放 `sub`，平台收束放 `caption`（遵守 maxChars）  
   - **禁止**把整段产品说明写进大字 `lines`（历史翻车：三行巨字占半屏）  
   - 高亮 `mark` 只标 2–4 字关键词，不要整句加 mark  
   - 若 `inspect`/`props:safe` 要求每行固定 3 段：用短词三元组（如 `一个` / `入口` / `办完日常`），不要为凑长度堆长句  

### 流程 / 场景页选版与填词硬规则

1. 选页后看 `inspect:layout` 的 **`slot` / `roles`**：  
   - 允许：`roadmap`、步骤面板、泳道式 process、breakdown 列表  
   - **禁止**：`bump-rank`、`ranks[]` 座次变化、IPO/估值排行、默认文案含「估值口径 / 1 = 最高」的页  
2. **禁止**给业务流程发明 `ranks: [1,2,3]` 去「适配」排位图——那是投资人座次模板，不是变更步骤。  
3. `process` 页每一步的标题、副文、脚注必须**彼此不同**；填完后对数组字段做「全文去重」：若 ≥3 个兄弟项正文相同 → 未就绪，重写。  
4. 步骤语言 = **角色动作 / 业务结果**（选目标 → 确认护栏 → 提交 → 编排执行 → 回传审计）；禁止每步重复同一句基建词。基建最多在**一步**或页脚出现一次。  
5. 编号卡片 / 阶段块的主标题不得撞名；同名说明没填差异化 props。  
6. **禁止**给流程阶段编造占比条（25%/20%/…）除非来自已披露真实指标。  
7. theme01 若 `layout:query --role process` 候选很少：优先 `theme01_page040` 路线图（≤4 阶段）或拆成两页；**不要**退而求其次去用 page070 排位赛。  
8. 场景「大字叙事」页可以，但主句不得超过 3 行且**不得叠字**。

### 空页与占位检测（填 props 后、渲染前扫 goal.json）

命中任一条 → 该页未就绪，禁止当正式页：

| 检测 | 示例 |
|------|------|
| 写作提示残留 | `定位一句话`、`标题`、`副标题`、`待补充`、`TODO`、`lorem` |
| 图表无实质数据 | `series`/`values` 全 0、点数 <3、或只有轴名无点 |
| 边界无条目 | 声称 In/Out 但两侧列表为空或各 <3 条 |
| 模板默认未替换 | dashi 默认英文/中文样例句仍在 |
| **步骤/卡片复制粘贴** | 同页 ≥3 个兄弟项 `title`/`body`/`sub`/`note` 完全相同 |
| **卡片标题撞名** | 编号不同但主标签相同（多框「活动告警」） |
| **假流程百分比** | 场景步骤带 `%` 但 outline/sourceRefs 无真实指标来源 |
| **排位/估值图冒充步骤** | props 含 `ranks`，或文案残留「估值口径」「1 = 最高」「座次」 |
| **空媒体槽** | layout 有 mediaSlots 但未写入真实相对路径 |
| **半截文案** | 标题/正文以单字残缺收尾，或明显被截断 |

字段形状不清时：

```bash
npm --prefix <dashi>/project run inspect:layout -- --compact <layout...>
```

## 从 slides.md 填 props

1. `goal:scaffold` 生成骨架 layouts。  
2. **按 outline.role 核对每页 layout**；架构章不符 → 立刻换页，勿先填文案。  
3. 按页把 `slides.md` 的标题、kicker、列表映射进该 layout 的 `copyKeys` / 数组字段。  
4. **流程页**：mermaid 节点改写成短步骤数组（dashi 吃文字步骤，不吃 mermaid）。  
5. **异常页**：症状 / 系统行为 / 下一步 → risks 条目数组，勿塞 Markdown 表原文。  
6. **架构 / 部署 / 边界页文案过滤器**（写入前扫一眼 props）：  
   - 禁止：`--flag`、`--role=`、`go build`、包路径、`pkgs/`、中间件类名  
   - 禁止：把多字段拼进单一 title（防 `ark-serverrole=server…` 类串味）  
   - 禁止：写作提示当标题（`定位一句话`、`标题`、`待补充`）  
   - 禁止：空 In/Out、空坐标轴撑满一页  
   - 允许：产品层名称（控制台、API 服务、边缘代理、消息总线、观测后端）  
   - 数字：仅已披露真实指标；拓扑/边界页**不要**发明「路径强度 / 成熟度」假分数  
7. 整份规范化：

```bash
npm --prefix <dashi>/project run props:safe -- --goal <repo>/docs/material/<slug>/goal.json --write
```

8. 渲染前 `validate:goal-spec`；渲染后 `validate:swiss` + `validate:goal-copy`（由 render 脚本或按 dashi SKILL 执行）。  
9. **视觉闸**（见 [visual-quality.md](visual-quality.md)）：预览抽检不合格 → 换 layout 返工，最多 2 轮。

## 渲染与导出

```bash
<dashi>/scripts/render_goal_deck.sh \
  <repo>/docs/material/<slug>/goal.json \
  <repo>/docs/material/<slug>/ppt/index.html
```

预览地址用脚本打印的 `http://127.0.0.1:<port>/`。

```bash
npm --prefix <dashi>/project run export:pdf -- \
  <repo>/docs/material/<slug>/ppt \
  <repo>/docs/material/<slug>/export/<slug>.pdf

npm --prefix <dashi>/project run export:pptx -- \
  <repo>/docs/material/<slug>/ppt \
  <repo>/docs/material/<slug>/export/<slug>.pptx
```

## 主题建议（可被用户覆盖）

| 产品气质 | themePack |
|----------|-----------|
| 白皮书 / 调研 / B2B | `theme07` |
| 技术方案 / 架构向 | `theme03` |
| 通用产品介绍 | `theme01` |
| 科技发布感 | `theme02` |
| 高端品牌 | `theme08` |

询问风格时按 dashi 要求展示 `assets/skill/theme-style-grid.png`。

## 失败时

| 情况 | 处理 |
|------|------|
| 无 dashi | 提示安装；勿用自制 HTML 冒充正式稿 |
| 渲染/校验失败 | 最多按 dashi 规范返工 2 轮；换 layout，不改组件源码 |
| 用户只要「先看结构」 | 可交 outline.json + slides.md 审阅，声明尚未出片 |
