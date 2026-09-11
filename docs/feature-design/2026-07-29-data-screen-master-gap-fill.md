# 数据大屏 Master Gap-fill（统一真理源）

| 项 | 值 |
|----|-----|
| 模式 | Gap-fill |
| 日期 | 2026-07-29 |
| 状态 | **P0/P1/P2 计划项已闭合；2026-07-30 复验 vitest 68/68 + playwright e2e 1/1 绿** |
| 分片归档 | [Wave B](./2026-07-29-data-screen-wave-b-gap-fill.md) · [Wave C/D](./2026-07-29-data-screen-wave-cd-gap-fill.md) |

## 1. 问题与目标

数据大屏 Phase 2.5/2.6 主链路已通（编辑 → 预览 → 分享 → embed），但文档分散、部分验收未收口。本页汇总**已闭合**与**仍须补充**项，供发版前核对。

**成功标准**：保存 WYSIWYG、投放三端一致、PRD/执行计划无漂移、P0 回归可复跑。

**非目标**：Phase 3 视频/多屏播放、模板市场、移动端 adapter。

---

## 2. 已闭合矩阵

| 域 | 能力 | 证据 |
|----|------|------|
| Wave A | view/preview/share/embed 投放闭环 | `phase25-execute` Wave A |
| Wave B | 锁定/Tab 轮播/JSON/PNG/图层 Tab | [wave-b-gap-fill](./2026-07-29-data-screen-wave-b-gap-fill.md) |
| Wave C/D | 标题条/21:9/模板导出 | [wave-cd-gap-fill](./2026-07-29-data-screen-wave-cd-gap-fill.md) |
| Phase 2.6 | 视口 hook、十字线、Ctrl+滚轮锚点缩放 | `plans/2026-07-20-data-screen-edit-viewport-de.md` T2–T4 |
| 保存 WYSIWYG | 大屏跳过 `compactPixelLayoutWhenZeroGap` | [BUG-14](../bugs/BUG-14_data-screen-save-gap-compaction_2026-07-29.md) · `layoutSanitize.ts` |
| Share smoke | data-screen 路由 fixture | `DashboardSharePage.smoke.test.tsx` A2 |

### 验证命令（合并）

```bash
cd fe && npx vitest run \
  src/components/dashboard/pixelCanvas/layoutSanitize.test.ts \
  src/components/dashboard/dataScreenPersist.test.ts \
  src/components/dashboard/screen/useDataScreenViewportState.test.ts \
  src/components/dashboard/screen/DataScreenEditViewport.test.tsx \
  src/pages/admin/dashboard/DashboardSharePage.smoke.test.tsx \
  src/lib/screenVisualAssets.test.ts \
  src/lib/surfacePreset.test.ts \
  src/lib/dataScreenTemplates.test.ts \
  src/components/dashboard/ChartEditRail.smoke.test.tsx \
  src/components/dashboard/CanvasEditToolbar.test.tsx \
  src/components/dashboard/createLayoutWidget.test.ts \
  src/components/dashboard/dashboardStyleConfig.test.ts
```

---

## 3. 仍开放缺口（按优先级）

### P0

| ID | 项 | 状态 |
|----|-----|------|
| P0-5 | BUG-12 resize e2e | ✅ `e2e/data-screen-resize-content.spec.ts` 绿（2026-07-30 复验） |

### P1 · 发版前手测

| ID | 步骤 | 期望 | 状态 |
|----|------|------|------|
| MT-1 | 图层锁定 → 拖/缩/方向键 | 无位移（Wave B） | 发版抽测 |
| MT-2 | Tab 轮播 → 保存 → preview | 仅预览轮播 | 发版抽测 |
| MT-3 | 布局 JSON 导出 → 导入 | 布局一致 | 发版抽测 |
| MT-4 | 图表放大 → 导出 PNG | 下载成功 | 发版抽测 |
| MT-5 | 图层 Panel Tab 子项 | 缩进 +「Tab 内嵌」 | 发版抽测 |
| **MT-6** | 自由摆放组件（含间隙）→ 保存 | **坐标不变**（BUG-14） | 发版抽测 |
| **MT-7** | 切换 21:9 → 保存 → preview | 等比适配；已有组件不自动缩放 | 发版抽测 |
| **MT-INS-1** | 选中 S2 表格 → resize 20px | content 尺寸跟随 outer | Vitest + 发版抽测 |
| **MT-INS-2** | 样式 Tab 改主题色 | 画布可见 | ✅ Vitest 2026-07-30 |
| **MT-INS-3** | 折叠右栏 → 图层选 chart | 右栏展开且样式可编辑 | 发版抽测 |
| **MT-INS-4** | 选中时钟 | 仅图层名（无 DE 样式 Tab） | 发版抽测 |
| **MT-DEPLOY-1** | 列表 → 查看/preview | 16:9 chromeless | 发版抽测 |
| **MT-DEPLOY-2** | 分享页整屏 embed 链接 | iframe 可展示 | ✅ API smoke 2026-07-30 |
| **MT-DEPLOY-3** | embed token + `/embed/screen/:id` | 整屏投放 | ✅ pytest embed 2026-07-30 |
| **MT-DEPLOY-4** | `refreshIntervalSec=30` | 图表刷新、页面不闪白 | 发版抽测 |
| **MT-DEPLOY-5** | 锁定图层 + 预览 | 与编辑一致 | 发版抽测 |
| **MT-DEPLOY-6** | 导出 JSON → 导入新建 | 成功 | 发版抽测 |
| **MT-BUG2-DS-1** | 大屏编辑拖移组件 | 位置实时更新 | 发版抽测 |
| **MT-BUG2-DS-2** | 八向 resize 手柄 | 外框+内容可见（[BUG-12](../bugs/BUG-12_data-screen-resize-content-vanish_2026-07-20.md)） | ✅ e2e 2026-07-30 |
| **MT-BUG2-DS-3** | 保存 → 刷新 | 位置/尺寸保持 | 发版抽测 |
| **MT-BUG2-DS-4** | 拖移+缩放后保存 | 与 MT-6 叠加验证 BUG-14 | 发版抽测 |

### P2 · Phase 3 挂点

| ID | 项 | 状态 |
|----|-----|------|
| P2-1 | `screenPlaylist` schema | 类型已存在于 `dashboardStyleConfig.ts`；播放逻辑 Phase 3 |
| P2-2 | 视口 pan/zoom 持久化 | 未做；需产品决策 |
| P2-3 | 视频/跑马灯/图层分组 | requirements §3 非目标 |

---

## 4. Playwright 环境 runbook

若 `npx playwright install chromium` 失败或挂起（zip 100% 后解压无输出）：

1. 确认无并行安装进程
2. 删除锁与半成品：`Remove-Item -Recurse -Force "$env:LOCALAPPDATA\ms-playwright\__dirlock","$env:LOCALAPPDATA\ms-playwright\chromium-1148" -ErrorAction SilentlyContinue`
3. **手动安装**（PowerShell）：
   ```powershell
   $zip = "$env:TEMP\chromium-1148-win64.zip"
   $dest = "$env:LOCALAPPDATA\ms-playwright\chromium-1148"
   Invoke-WebRequest -Uri "https://playwright.azureedge.net/builds/chromium/1148/chromium-win64.zip" -OutFile $zip
   Expand-Archive -Path $zip -DestinationPath $dest -Force
   $zip2 = "$env:TEMP\chromium-headless-shell-1148-win64.zip"
   $dest2 = "$env:LOCALAPPDATA\ms-playwright\chromium_headless_shell-1148"
   Invoke-WebRequest -Uri "https://playwright.azureedge.net/builds/chromium/1148/chromium-headless-shell-win64.zip" -OutFile $zip2
   Expand-Archive -Path $zip2 -DestinationPath $dest2 -Force
   ```
4. 跑 e2e：`cd fe; npx playwright test e2e/data-screen-resize-content.spec.ts --project=chromium`

**最近复验**：2026-07-30 — e2e 1 passed（15.7s）。

---

## 5. 分期建议

| 阶段 | 范围 | 说明 |
|------|------|------|
| **P0（本周）** | master 真理源、PRD/执行计划 sync、BUG-14、BUG-12 e2e | ✅ 已闭合 |
| **P1（下一迭代）** | MT 手测 + Inspector/投放 smoke | Vitest/smoke 已绿；MT-* 发版前抽测 |
| **P2（挂 Phase 3）** | `screenPlaylist` 播放、pan/zoom 持久化、视频/跑马灯 | schema 已挂；实现留 Phase 3 land-design |

---

## 6. 验收清单（land-design）

- [x] `master-gap-fill.md` 落盘且旧分片已交叉引用
- [x] PRD / phase25-requirements / phase25-execute 状态一致
- [x] 保存 WYSIWYG：BUG-14 + bug-case + 单测
- [x] BUG-12 e2e 绿（§4 runbook · 2026-07-30 复验 1/1）
- [x] Inspector + 投放手测表可执行（§3 MT-*）

| 决策 | 结论 |
|------|------|
| 保存 WYSIWYG 记 BUG-14 还是扩 BUG-6 | **BUG-14**（大屏专用 `gapCompaction` 路径） |
| pan/zoom 持久化 | 暂缓，不写 `styleConfig` |
