# 看板列表封面截图链路失败

- **ID**: CASE-2026-08-14-002
- **状态**: 已修复
- **影响**: fe | be | admin-ui
- **首次发现**: 2026-08-14

## 症状

- 保存后列表封面加载失败，或完全不出新截图。
- 后端可能没有任何 `PUT /thumbnail`；或落盘 PNG 为 0 字节。

## 根因

1. **离开页面前未截完**：`handleSave` 用 `setTimeout(600ms)` 异步截图，随后 `resetLayout` /「保存并离开」卸载画布。日志：`editor-save 200` 后立刻 `GET /dashboards`，中间没有 `PUT /thumbnail`。
2. **0×0 空 Blob**：画布卸载或重挂载后 `html-to-image` 对 0×0 节点给出 truthy 空 Blob，曾被当成成功上传。
3. **后置等待过长**：截图前再等图表 drain 2.5s，用户早已离开。

## 错误做法（避免）

- 保存成功后再延迟截图。
- 先 `resetLayout` 再截当前 DOM。
- 改 live `transform` 来截图（编辑页会先放大再缩小）。
- 用 `if (!blob)` 判断截图成败。

## 修复方式

- `editor-save` 成功后、`resetLayout` / 离开之前 **await** `persistDashboardThumbnailBestEffort`。
- 截 **当前已绘制** 的 host 视口，不改 live scale；空图不上传。
- 后端拒绝空文件与非 PNG magic。

## 验证

- 保存（含保存并离开）后 Network 出现 `PUT .../thumbnail` 且状态 200。
- `data/dashboard-thumbnails/{id}.png` 体积 > 256，文件头为 `89 50 4E 47`。
- 列表卡显示封面，不再是破图文案。

## 关联

- `fe/src/pages/admin/dashboard/DashboardEditPage.tsx`
- `fe/src/lib/captureDashboardThumbnail.ts`
- `fe/src/lib/uploadDashboardThumbnail.ts`
- `backend/app/dashboard/thumbnails.py`
