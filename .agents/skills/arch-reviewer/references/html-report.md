# HTML Report Format

架构审计主交付物：OS temp 下**单文件自包含 HTML**。Tailwind + Mermaid 均走 CDN。图承载论证；文案稀疏。

## 路径与打开

```bash
# unix（macOS / Linux）：禁止写死 /tmp
TMP="$(mktemp -d)"
OUT="$TMP/architecture-review-$(date +%Y%m%d-%H%M%S).html"
open "$OUT"        # macOS
# xdg-open "$OUT"  # Linux
```

```powershell
# Windows PowerShell
$OUT = Join-Path $env:TEMP ("architecture-review-{0}.html" -f (Get-Date -Format yyyyMMdd-HHmmss))
Start-Process $OUT     # 等价于 cmd 的 start "" "%OUT%"
```

**禁止**默认把 HTML 写入仓库。用户明确要求归档时，再复制到约定路径（如 `docs/reviews/`）。  
注意：这条只管 HTML；**Markdown 主报告必须**落 `docs/material/arch-reviewer/<YYYY-MM-DD>-<slug>.md`（见 SKILL Phase 2.5）。

## Scaffold

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>Architecture review — {{repo name}}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      .seam { stroke-dasharray: 4 4; }
      .leak { stroke: #dc2626; }
      .deep { background: linear-gradient(135deg, #0f172a, #1e293b); }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header><!-- repo, date, legend --></header>
      <section id="candidates" class="space-y-10"><!-- articles --></section>
      <section id="top-recommendation"><!-- one card --></section>
    </main>
  </body>
</html>
```

## Header

- 仓库名、日期、范围（整仓 / 模块…）
- 图例：实线框 = module；虚线 = seam；红箭头 = leakage；厚深色框 = deep module
- **不要**写长引言；直接进入 candidates

## Candidate card（每张 `<article>`）

| 块 | 要求 |
|----|------|
| Title | 短；点名加深（如「Collapse the Order intake pipeline」） |
| Badge | 强度：`Strong` emerald / `Worth exploring` amber / `Speculative` slate；**授权级：`polish_safe` sky / `local-deepen` violet / `structural` rose`**；依赖标签：`in-process` 等 |
| Files | `font-mono text-sm` 路径列表 |
| Before / After | 并排；见下图模式 |
| Problem | **一句** |
| Solution | **一句** |
| Wins | ≤6 词/条；用 locality / leverage / depth 词汇 |
| **Evidence refs** | 挂摩擦证据池 F-* 列表（每条可点开看代码引用）|
| ADR callout | 可选；琥珀底一句 |

禁止大段解释。图需要段落才能懂 → **重画图**。

## 摩擦证据池（Friction pool）— 候选卡下方的整表

候选画册下方**必须**有一张可折叠的「摩擦证据池」表，列出 subagent 探索发现的**全部**摩擦点（不限数，不归并）。这张表是候选卡的证据原材料，也供用户决定「先做哪个」时看全貌。

| 列 | 内容 |
|----|------|
| F-ID | F-1, F-2, … |
| Friction | F1～F6 类别（shallow / seam leakage / locality / leverage / 单 adapter 假缝 / 难测宽 interface）|
| Path + Line | 精确文件:行号 |
| Evidence | ≥2 个代码引用（verbatim 关键行 + 行号）|
| Candidate | 关联候选卡 ID（如 C-1）；unassigned 表示尚未归入候选 |
| Confidence | high / medium / low |

## Diagram patterns（混用，勿张张同款）

### Mermaid flowchart（依赖 / 调用）

泄漏边标红；加深后的 deep module 用深色 classDef。

```html
<div class="rounded-lg border border-slate-200 bg-white p-4">
  <pre class="mermaid">
    flowchart LR
      A[OrderHandler] --> B[OrderValidator]
      B --> C[OrderRepo]
      C -.leak.-> D[PricingClient]
      classDef leak stroke:#dc2626,stroke-width:2px;
  </pre>
</div>
```

### Hand-built boxes + SVG arrows

适合 after：一个厚边 deep module，内部灰显。Mermaid 摆不好时用这个。

### Cross-section（层层浅包装）

横向色带：Before 多条细带；After 一条厚带标职责。

### Mass diagram（interface vs implementation）

两矩形比高度：Before 接口≈实现；After 接口矮、实现高。

### Call-graph collapse

Before 调用树；After 收进一盒，内部调用淡化。

## Style

- 编辑感，非看板：留白、石色/slate；标题可用 `font-serif`
- 颜色克制：一主色（emerald 或 indigo）+ 红泄漏 + 琥珀警告
- 图高约 320px，保证 before/after 并排少滚屏
- 模块标签：`text-xs uppercase tracking-wider`
- 除 Tailwind/Mermaid 外无业务脚本、无交互态

## Top recommendation

更大卡片：候选名 + 一句 why + 锚点链到该 article。仅此。

## Tone / 词汇

**必用**：module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, locality  

**禁用替词**：component, service（当 module）, API/signature（当 interface）, boundary（当 seam）

无套话、无「值得注意的是」。能 bullet 就不要段落。
