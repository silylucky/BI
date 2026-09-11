# 政企风模板素材包 `gov-enterprise-v1`

> 由 `npm run generate:gov-assets` 自动生成，请勿手改 SVG（可改脚本后重新生成）。

## 统计

| 类别 | 数量 | 尺寸 | 用途 |
|------|------|------|------|
| canvas-dark | 154 | 1920×1080 | 数据大屏整体背景 |
| canvas-light | 154 | 1920×1080 | 看板/报表浅色背景 |
| component-panel | 52 | 800×480 | 组件卡片底图（可拉伸） |
| title-strip | 30 | 720×64 | 标题装饰条（半透明底） |
| screen-header | 30 | 1920×100 | 大屏顶栏（DE 梯形+电路翼） |
| top-decor-clear | 60 | 720×64 / 1920×100 | **透明底**顶部装饰（叠加大屏画布） |
| **合计** | **480** | | |

## 视觉特性（v5）

- **screen-header / de-platform-header**：对标 DataEase workbranch 大屏顶栏——梯形标题牌、双侧电路翼、霓虹发光
- 深色 canvas 新增 `de-platform-header` / `de-circuit-wing` / `de-cloud-center` 整屏背景
- 政务模板默认 **clean-header**：浅灰底 + 顶栏细线，无图标/纹理
- 浅色 **pattern**：clean-header / header-band / card-float / watermark / corner-fold / dot-matrix / ribbon
- 深色 canvas 仍保留供选用，内置模板已切换为浅色

## 命名规则

- `canvas-dark-{palette}-{pattern}.svg`
- `canvas-light-{palette}-{pattern}.svg`
- `panel-{style}-{color}.svg`
- `title-{style}-{color}.svg`
- `screen-header-{style}-{color}.svg`

## 引用方式

```python
# presets_gov_screens.py
bg_image="/template-assets/packs/gov-enterprise-v1/backgrounds/dark/canvas-dark-cyan-command.svg"
```

```typescript
canvasBackgroundImage: "/template-assets/packs/gov-enterprise-v1/backgrounds/dark/canvas-dark-indigo-hud-scan.svg"
```

## 重新生成

```bash
cd fe && npm run generate:gov-assets
```
