# 富文本提交正文时组件背景图被抹掉

- **ID**: CASE-2026-08-07-002
- **状态**: 已修复
- **影响**: fe
- **首次发现**: 2026-08-07

## 症状

- 数据大屏/仪表板选中「富文本」组件 → 右侧「图片」上传本地背景图 → 面板显示「正在使用 / 本地图片」，画布可见
- 双击进入正文编辑后点击其他组件，或切换选中再切回，背景图消失
- 不涉及保存/刷新也会丢；`screenStyle`、数据绑定字段同样可能被抹掉

## 根因

1. `TextWidget.commit` 只构造 `{ content, variant }` 传给 `onTextConfigChange`
2. `DashboardCanvasWidgetRenderer.updateWidget` 做 `{ ...item, textConfig }` **整包替换**，不 merge 子字段
3. `RichTextEditor` 在 document 捕获阶段监听 `pointerdown`，点到编辑器外即 commit

## 错误做法（避免）

- 用 `{ content, variant }` 当 patch 交给整包替换的 setter
- 用 `ws?.backgroundShow !== false` 当「对象存在」判断（见 `fe-webpage-insert-backgroundImage-crash.md`）

## 修复方式

- `fe/src/components/dashboard/TextWidget.tsx`：`commit` 改为 `{ ...widget.textConfig, content, variant }`
- 对照 `ScreenVisualEditRail.patchStyle` 的 `{ ...widget.textConfig, ...patch }` 模式
- BE：`DashboardStyleConfig.canvasBackgroundImageFit/Position` 枚举与 FE `WidgetBackgroundImageFit` 对齐（避免保存 422 或静默丢适应方式）

## 验证

- `cd fe && pnpm vitest run src/components/dashboard/TextWidget.rich-text.test.tsx`
- `pytest tests/test_dashboard_style_config_roundtrip.py::test_canvas_background_image_fit_roundtrip`
- 手测：富文本上传背景 → 双击编辑 → 点别的组件 → 切回，背景仍在

## 关联

- `fe-dashboard-save-style-strip.md`（style 契约静默剥离）
- `be-dashboard-canvas-bg-data-url-limit.md`（data URL 上限）
