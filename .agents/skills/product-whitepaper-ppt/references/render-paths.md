# 渲染路径

## 路径 Dashi（默认 · 正式交付）

**必需**本机 `dashiai-ppt`。步骤见 [dashi-bridge.md](dashi-bridge.md)。

| 产物 | 位置 |
|------|------|
| 可预览 HTML deck | `docs/material/<slug>/ppt/` |
| PDF | `docs/material/<slug>/export/*.pdf`（dashi `export:pdf`） |
| PPTX | 同目录（用户要可编辑时） |
| 内容源 | `outline.json` / `slides.md` / `diagrams/` / `goal.json` |

用户说「做 PPT / 白皮书 / 宣传材料」→ **一律走本路径**。

## 路径 Fallback（降级 · 须明示）

仅当：dashi 未安装且用户**明确接受**降级草稿。

```bash
node <skill-root>/scripts/build-html-deck.mjs --repo … --slug …
node <skill-root>/scripts/export-pdf.mjs --repo … --slug …
```

交付说明必须写：**「降级自制 HTML，效果不及 dashiai-ppt」**。不得与正式 dashi 成品混称为同一质量。

## 路径选择

| 用户说法 | 路径 |
|----------|------|
| 默认 / PPT / 白皮书 / 漂亮一点 | **Dashi** |
| PDF / PPTX | Dashi + 对应 export |
| 只要大纲审阅 | 只交 outline/slides，不出片 |
| dashi 挂了且接受草稿 | Fallback + 降级声明 |

## 共同约束

- 落盘根：`<repo>/docs/material/<slug>/`  
- 页数 ≥30  
- 内容事实来自仓库扫描  
