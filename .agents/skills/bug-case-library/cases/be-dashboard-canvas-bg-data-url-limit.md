# 上传本地背景图后保存失败（canvasBackgroundImage 校验）

- **ID**: CASE-2026-08-06-001
- **状态**: 已修复
- **影响**: be | fe
- **首次发现**: 2026-08-06

## 症状

- 大屏「自定义背景图」选择本地图片后，保存提示「表单校验失败（styleConfig.canvasBackgroundImage）」
- 画布上能预览背景，但无法落库

## 根因

1. FE `readImageFileAsDataUrl` 把本地图写成 `data:image/...;base64,...` 写入 `styleConfig.canvasBackgroundImage`
2. BE `DashboardStyleConfig.canvasBackgroundImage`（及主题变体/组件背景图）`max_length=2048`
3. 任意真实图片 base64 远超 2048 → Pydantic 422

## 错误做法（避免）

- 仅放宽 toast 文案却不改 `max_length`
- 前端允许 2MB 上传却与后端字段上限脱节

## 修复方式

- BE：`IMAGE_DATA_URL_MAX_LENGTH = 3_145_728`，用于 `canvasBackgroundImage` / `backgroundImage` / media `url`
- FE：同步 `MAX_IMAGE_DATA_URL_CHARS`；校验失败文案改为「自定义背景图」人话提示

## 验证

- `pytest backend/tests/test_dashboard_image_data_url_limit.py`
- 手测：上传 <2MB PNG 作大屏背景 → 保存成功 → 刷新仍在

## 关联

- `fe-dashboard-save-style-strip.md`（style 契约类保存问题）
