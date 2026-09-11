---
name: product-whitepaper-ppt
description: >
  指定仓库扫描产品事实，按产品白皮书口径组 ≥30 页宣传文案（价值、亮点、产品级架构、业务场景流程），
  再调用 dashiai-ppt 渲染并落盘 docs/material/。禁止把 Cookie/中间件/ADR/API 信封等研发手册细节写成正文。
  Use when 产品介绍 PPT、产品白皮书、宣传/售前材料、从仓库生成路演稿；not for engineering handbooks.
---

# Product Whitepaper PPT（扫仓组稿 · Dashi 出片）

本 Skill 负责：**扫代码仓 → 白皮书级内容（≥30 页）→ 调 dashiai-ppt 出片 → 落 `docs/material/`**。

视觉与版式**不要用自制 HTML 冒充成品**。成品渲染以本机已装的 [`dashiai-ppt`](../dashiai-ppt/SKILL.md) 为准（主题库、可编辑预览、PDF/PPTX）。自制 `build-html-deck` 仅作 dashi 不可用时的降级草稿，交付时必须标明「降级」。

```text
本 Skill = 内容编排（事实 / 结构 / 流程文案）
dashiai-ppt = 视觉渲染（默认、强制优先）
```

## 何时启用

| 场景 | 动作 |
|------|------|
| 指定仓库做产品介绍 / 白皮书 PPT | 扫描 → ≥30 页 outline+文案 → **dashi 渲染** → `docs/material` |
| 只要 PDF / PPTX | 仍先 dashi HTML，再按其 `export:pdf` / `export:pptx` |
| 修订已有物料 | 改 outline/slides/goal，重跑 dashi，覆盖 `docs/material/<slug>/` |

**不要**：用自制 deck 冒充 dashi 成品；假数据凑页；<30 页；跳过扫描空写；**把研发手册（Cookie、中间件、ADR、JSON 信封）写成白皮书正文**。

## 依赖

| 依赖 | 要求 |
|------|------|
| `dashiai-ppt` | **必需**。默认路径 `~/.agents/skills/dashiai-ppt`（或 `~/.codex` / `~/.claude` 下同名） |
| Node 20+ / npm | dashi 生成器需要 |
| Chrome/Edge | dashi 导出 PDF/PPTX 需要 |

探测不到 dashi → 先提示安装（`npx dashi-ppt-skill@latest`），**不要**默默用自制 HTML 交差。用户明确接受「降级草稿」才可走 fallback。

## 必读顺序（≤3 次）

1. 本文件工作流 + 硬规则 + **内容口径** + **架构页门禁**
2. [references/content-voice.md](references/content-voice.md) + [references/deck-outline.md](references/deck-outline.md) + [references/scan-workflow.md](references/scan-workflow.md)
3. [references/dashi-bridge.md](references/dashi-bridge.md)（含架构选版）+ [references/visual-quality.md](references/visual-quality.md) + 交稿 [references/delivery-checklist.md](references/delivery-checklist.md)

操作 dashi 的版式/校验细节以 `../dashiai-ppt/SKILL.md` 为准。

## 硬规则

1. **页数 ≥30**；核心块：开场、亮点、**产品级**架构、业务流（≥2 场景）、收束。
2. **事实来自仓库**（扫仓核对）；推断标 `（推断）`；禁止编造指标。
3. **口径是产品白皮书**：禁止把 Cookie/Header/中间件类名/ADR 编号/`code===0`/函数调用链写进主叙事。见 [content-voice.md](references/content-voice.md)。
4. **渲染默认 dashiai-ppt**；输出在 `<repo>/docs/material/<slug>/`。
5. **一页一主题**；流程节点用角色与业务动作；`diagrams/*.mmd` 作设计源，props 写产品步骤。
6. 主题未指定：按 dashi 展示风格图；白皮书默认偏 `theme07`。
7. PDF/PPTX：dashi export → `export/`。
8. `sourceRefs` 留在 outline 自检，默认不印满幻灯片。
9. **架构页门禁（防翻车）**：总览/拓扑/模块关系**只**用 `relationship` / `breakdown`；**禁止**用 `metrics` 图表版式、假强度曲线、雷达图冒充架构。部署页可用 `context` / 对比表，**禁止**把 `--role=`、CLI、包路径、二进制名串进主标题区。
10. **空页 / 占位门禁**：禁止大面积空白坐标、空 In/Out 象限、只剩坐标轴标签的「伪矩阵」；禁止残留模板占位文案（如「定位一句话」「标题」「副标题」「待补充」）。定位与边界页必须列出**具体** In / Out 条目（或对比表），不得用空图撑版面。
11. **流程/场景页门禁**：同页多步骤/多卡片的正文**不得互相复制**；编号卡片标题不得重复；禁止假百分比条；禁止叠字。每步必须是**不同的业务动作**。**禁止**用 `bump-rank` / `ranks` 座次变化图（常残留「估值口径，1=最高」）冒充变更/作业步骤。
12. **媒体与排版门禁**：无真实截图/素材时，**优先选无图片槽 layout**；禁止交付「影像 N / 点击上传」空槽。标题宜短；**大字主张页**每行建议 ≤12 字、细节放 `sub`/`caption`，禁止巨字墙。禁止词中切开、半截截断。
13. **出片后视觉闸**：正式交稿前必须预览抽检；出现叠字、空象限、空图槽、步骤复制粘贴、**排位图当流程、估值模板脚注残留、巨字墙** → **换 layout 重填，禁止交付**。

## 交付目录

```text
<repo>/docs/material/<deck-slug>/
├── README.md
├── _research.md          # 可选事实卡
├── outline.json          # 本 Skill 页级大纲 + sourceRefs
├── slides.md             # 审阅用全文案
├── diagrams/             # mermaid 源（流程设计底稿）
├── goal.json             # dashi 渲染输入（必有）
├── ppt/                  # dashi 输出（index.html + assets）
└── export/               # .pdf / .pptx
```

## 工作流

```text
1. 确认仓库、受众、页数、主题（dashi 12 选；可委托）
2. 扫描 → 事实卡（scan-workflow）
3. 按 deck-outline 写 outline.json + slides.md + diagrams/
   · 架构章每页先定 role（relationship/breakdown/process/context/risks）
4. 按 dashi-bridge：goal:scaffold → 按 role 选 layout（**默认无媒体**）→ inspect 后填 props
   · 架构总览禁止 metrics；有图才 media:stage；填完 props:safe + validate
5. render_goal_deck.sh → 打开预览 → **视觉抽检（必做）**
   · 空图槽 / 乱断行 / 架构·边界·场景不合格 → 换 layout 返工（最多 2 轮）后再 export
6. delivery-checklist 全勾 → 回复预览 URL / 文件路径
```

### Step 1 — 确认

| 项 | 默认 |
|----|------|
| 仓库 | 当前工作区 |
| 受众 | 客户 / 技术决策者 |
| 页数 | 32–40（≥30） |
| 主题 | 询问；白皮书偏 `theme07` |
| 交付 | dashi HTML 预览；默认同出 PDF |

### Step 2–3 — 内容

只做本 Skill 擅长的：事实、结构、流程文案、sourceRefs。不要在自制 HTML 上打磨视觉。

### Step 4–5 — 出片（dashi）

见 [dashi-bridge.md](references/dashi-bridge.md)。关键命令形态：

```bash
DASHI=~/.agents/skills/dashiai-ppt
OUT=<repo>/docs/material/<slug>

npm --prefix "$DASHI/project" run goal:scaffold -- \
  --title "…" --goal "…" --theme theme07 --pages 36 \
  --chunk-size 5 --out "$OUT/goal.json"

# 按 slides.md / outline 填 props 后：
npm --prefix "$DASHI/project" run props:safe -- --goal "$OUT/goal.json" --write
"$DASHI/scripts/render_goal_deck.sh" "$OUT/goal.json" "$OUT/ppt/index.html"

npm --prefix "$DASHI/project" run export:pdf -- "$OUT/ppt" "$OUT/export/<slug>.pdf"
```

长 deck 分段填 props；每页 `layout` 唯一；只改文案 props。

### Step 6 — 回复

1. 页数、两业务场景名、主题  
2. 预览 `http://127.0.0.1:<port>/`（dashi 预览服务）  
3. `docs/material/<slug>/` 与 PDF/PPTX 路径  
4. `（推断）` 清单  

## 分工

| 能力 | 谁做 |
|------|------|
| 扫仓、事实卡、≥30 页白皮书结构、业务流设计 | **本 Skill** |
| 主题、版式、动画、浏览器编辑、PDF/PPTX | **dashiai-ppt** |
| 自制 HTML | 仅降级，默认不用 |

## 禁止

- 用自制 HTML 冒充与 dashi 同级正式交付  
- <30 页或空白凑页  
- 无仓库依据的宣传口号  
- **工程说明书式正文**（Cookie/Header/中间件/ADR/API 信封当主句）  
- **用假图表 / 错 layout 冒充架构拓扑**（历史翻车：叠字、CLI 串进主视觉）  
- **空象限 / 空坐标撑版**（历史翻车：产品边界只剩 IN/OUT 轴标签 +「定位一句话」占位）  
- **流程列复制粘贴 / 卡片撞名 / 叠字**（历史翻车：五步同一句「鉴权写 JOB」；多框同名「活动告警」；「工单或自愈」叠成一团）  
- **无披露数据的流程假百分比**  
- **空图槽交付**（「影像 1/2 · 点击上传」）——无素材就换无媒体页  
- **标题乱断行 / 半截截断**（词从中切开、句意读不通）  
- 未做视觉抽检就交正式稿  
- 改 dashi 组件源码硬凑  
- 输出不落 `docs/material`  

## 附加资源

- [references/content-voice.md](references/content-voice.md) ← **先读：什么叫白皮书**
- [references/deck-outline.md](references/deck-outline.md)
- [references/scan-workflow.md](references/scan-workflow.md)
- [references/flowchart-spec.md](references/flowchart-spec.md)
- [references/dashi-bridge.md](references/dashi-bridge.md) ← 架构选版硬规则
- [references/visual-quality.md](references/visual-quality.md) ← 出片后视觉闸
- [references/render-paths.md](references/render-paths.md)
- [references/delivery-checklist.md](references/delivery-checklist.md)
- 姐妹 skill：[../dashiai-ppt/SKILL.md](../dashiai-ppt/SKILL.md)
