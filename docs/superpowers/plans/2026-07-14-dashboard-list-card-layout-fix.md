# 看板列表卡片布局耦合 · 根因与修复方案

日期：2026-07-14  
关联：`DashboardListCard` · `ListPageTableFrame` · `DashboardPreviewThumb`

---

## 1. 现象

| 症状 | 用户感知 |
|------|----------|
| 一个卡片变高/变矮，同排其他卡片跟着变 | 「一个组件变化其他组件都会改变」 |
| 列表页卡片多时无法向下滚动 | 「页面也无法滑动」 |
| 有组件的看板预览区异常高（~460px+） | 与空看板卡片尺寸不一致 |

---

## 2. 根因分层

### R1 — 动态 `aspect-ratio`（主因：卡片互牵）

`DashboardListCard` 预览区：

```tsx
style={{ aspectRatio: dashboardPreviewAspectRatio(dashboard.layoutJson) }}
```

`dashboardPreviewAspectRatio` 对 v2 画布返回 **`canvas.width / canvas.height`**。

- 像素画布 `canvas.height` 随内容向下生长（拖拽、自动撑高），比例可从 16:9 漂到 **1440:8000+**
- 同一 CSS Grid 行高 = **该行最高卡片**
- 默认 `align-items: stretch` → 矮卡片被拉到同行最高高度，footer 区被撑开
- 结果：**一个看板画布变高，整行卡片视觉失衡**

### R2 — `overflow-hidden` 截断（主因：无法滚动）

列表页走 **fill 壳层**（`AdminLayout` + `AdminPageShell layout="list"`）：

```
main [overflow-hidden]
  └ ListPageSection [overflow-hidden]
       └ ListPageTableFrame [overflow-hidden]  ← 无 overflow-y-auto
```

内容超出视口时被裁剪，**没有内部滚动容器**。

### R3 — 缩略图与外壳比例双轨

- 外壳：动态 canvas 比例
- `DashboardPreviewThumb`（`embedded`）：内部 widget 仍按 canvas % 定位

外壳变高时，缩略图 block 被放大，但语义上仍是「列表预览」而非「真实画布比例还原」。

---

## 3. 方案（已采纳）

| 项 | 决策 | 理由 |
|----|------|------|
| 列表卡片预览比例 | **固定 16:10**（与 Skeleton 一致） | DE/列表页惯例；卡片尺寸可预期 |
| 缩略图内容 | 在固定框内按 canvas % 绘制（letterbox） | 不丢布局信息，不牵动态比例 |
| Grid 对齐 | **`items-start`** | 行内卡片顶部对齐，禁止拉伸耦合 |
| 列表滚动 | **`ListPageTableFrame` → `overflow-y-auto`** | fill 路由下由帧内滚动，符合壳层契约 |

**不采用**：继续用动态 canvas 比例 + `max-height` 裁剪（仍会因 grid 行高耦合产生跳动）。

---

## 4. 改动清单

| 文件 | 变更 |
|------|------|
| `DashboardPreviewThumb.tsx` | 导出 `DASHBOARD_LIST_CARD_ASPECT_RATIO` |
| `DashboardListCard.tsx` | 固定比例 + 文档注释 |
| `DashboardListPage.tsx` | grid 加 `items-start` |
| `list-page-kit.tsx` | `ListPageTableFrame` 可纵向滚动 |
| 测试 | 卡片固定比例 + 帧滚动 class |

---

## 5. 验收

- [ ] 同排卡片预览区高度一致（有/无组件、v1/v2）
- [ ] 编辑某看板使 canvas 变高后，列表卡片尺寸不变
- [ ] 看板数量超过一屏时可滚动到底部分页
- [ ] 其他列表页（数据源、Dataset）仍可表格内滚动

---

## 6. 验证命令

```bash
cd fe && npx vitest run \
  src/components/dashboard/DashboardListCard.test.tsx \
  src/components/layout/list-page-kit.test.tsx \
  src/components/dashboard/DashboardPreviewThumb.test.tsx
```
