# 点击网页组件白屏：Cannot read properties of undefined (reading 'backgroundImage')

- **ID**: CASE-2026-08-06-002
- **状态**: 已修复
- **影响**: fe
- **首次发现**: 2026-08-06

## 症状

- 大屏「更多」插入「网页」素材后整页崩溃
- 错误：`Cannot read properties of undefined (reading 'backgroundImage')`
- 路由错误边界显示「页面加载失败」

## 根因

`collectDashboardImageUrls` 对 media/tabs：

```ts
const ws = widget.mediaConfig?.widgetStyle;
if (ws?.backgroundShow !== false) pushImageUrl(urls, ws.backgroundImage);
```

网页组件默认无 `widgetStyle` → `ws` 为 `undefined`；`ws?.backgroundShow !== false` 仍为 true，随后访问 `ws.backgroundImage` 抛错。编辑页 `useMemo` 依赖 widgets 调用该函数，一点击插入即崩。

## 错误做法（避免）

- 用 `ws?.foo !== false` 当「有对象」判断——`undefined !== false` 为 true

## 修复方式

- 改为 `if (ws && ws.backgroundShow !== false)`
- 相关背景面板对 `value` 做可选链兜底

## 验证

- `vitest run src/lib/collectDashboardImageUrls.test.ts`
- 手测：更多 → 网页 → 画布出现组件，右侧可配 URL
