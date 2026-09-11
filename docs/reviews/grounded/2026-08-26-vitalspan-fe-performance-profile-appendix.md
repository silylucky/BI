# Performance 实测附录 — VitalSpan 前端热路径（步 0）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-26 |
| 关联裁决 | [2026-08-26-vitalspan-fe-performance-adjudication.md](./2026-08-26-vitalspan-fe-performance-adjudication.md) |
| 环境 | Win32 · Chrome（Cursor 内嵌浏览器 CDP）· FE `127.0.0.1:5173` · BE `127.0.0.1:8000` |
| 样本看板 | `435f5dc6-a8ba-4bee-9c32-cd35a444f14e`（基层网格化管理·9 图含 `map`） |
| 录制方式 | CDP `Profiler.start/stop` + `fe/scripts/analyze-cdp-profile-src.py` |
| 置信度 | **HIGH**（P2/P3）；**LOW**（P1 像素画布，见下文阻塞） |

---

## 1. 三条路径与录制状态

| ID | 路径 | 状态 | 原始 Profile |
|----|------|------|--------------|
| **P3** | 多 widget 编辑冷进入（导航至看板编辑页，等 9 图挂载） | ✅ 完成 | `~/.cursor/browser-logs/cdp-profile-Profiler.stop-2026-08-26T08-38-49-917Z.json` |
| **P2** | Inspector 打开（选中柱状图 widget → 数据 Tab + 字段库加载） | ✅ 完成 | `~/.cursor/browser-logs/cdp-profile-Profiler.stop-2026-08-26T08-36-10-989Z.json` |
| **P1** | 大屏像素画布 + 区域地图拖缩放 | ⚠️ **阻塞** | 数据大屏路由返回「看板不存在」；网格看板点选地图时触发 `classifyDatasetField is not defined` 崩溃 |

> **P1 替代**：本地可跑 `node fe/scripts/perf-profile-hotpaths.mjs`（需 `pnpm exec playwright install chromium`）对 mock 像素画布 + 地图 widget 补录；或修复数据大屏 ACL / `classifyDatasetField` 后重录。

---

## 2. Top 3 主线程栈（应用相关，inclusive sample time）

### P3 — 多 widget 冷进入（~10s 窗口）

| 排名 | 函数 · 文件 | 约 ms |
|------|-------------|-------|
| 1 | `(anonymous)` · `buildDatasetEncoding.ts` | 32 |
| 2 | `formatMetricValue` · `dashboardStyleConfig.ts` | 26 |
| 3 | `update` · `useTableScrollEdges.ts` | 11 |

**同窗口其他显著帧**（Top 12 内）：`renderD3PieChart` · `renderPie.ts` (8)、`renderD3BarChart` · `renderBar.ts` (8)、`renderD3ChoroplethChart` · `renderChoropleth.ts` (6)、`schedulePersistViewTransform` · `renderChoropleth.ts` (6)、`ChartRenderer2` · `ChartRenderer.tsx` (5)。

**Profile 中亦出现**：`runD3Renderer` · `D3GeoMapView.tsx`、`D3GeoMapViewInner`、`chartExecuteBindingKey` · `chartExecuteProbe.ts`。

**解读**：冷进入瓶颈在 **多图并行 D3 绘制 + 数据集 encoding 构建**，地图 choropleth 与柱/饼同级；**非 Worker 缺口**，而是主线程渲染扇出。

---

### P2 — Inspector 选中 + 数据面板（~2s 窗口）

| 排名 | 函数 · 文件 | 约 ms |
|------|-------------|-------|
| 1 | `renderWithHooks` · `react-dom_client.js` | 23 |
| 2 | `logComponentRender` · `react-dom_client.js` | 18 |
| 3 | `fetchWithTimeout` · `lib/api.ts` | 12 |

**同窗口其他显著帧**：`ChartRenderer2` · `ChartRenderer.tsx` (6)、`apiFetch` · `api.ts` (5)、`buildChartExecuteEncoding` · `chartExecuteProbe.ts` (3)、`ChartFieldMultiSlot` · `ChartFieldMultiSlot.tsx` (3)。

**解读**：打开 Inspector 触发 **React 大范围重渲染 + 字段/数据集 API**；与「全面 Worker」无关，优先 **减少选中态无关 widget 重绘 / 字段请求去抖**。

---

### P1 — 地图 widget 拖缩放（像素画布）

**未得到有效栈**（见 §1）。裁决 §8 步 1 仍建议推广 `D3GeoMapView` live resize 模式；待 P1 环境修复后用同一脚本补录。

---

## 3. 对裁决方案的印证 / 修正

| 原假设 | 实测 |
|--------|------|
| 卡顿主因 = 缺 Worker | **否定**：P3 热点为 `renderD3*` / `buildDatasetEncoding` / React reconcile |
| geo match >50ms 需 Worker spike | **暂无证据**：P3 中 `renderChoropleth` 仅 ~6ms 量级（单窗口 inclusive）；需 P1 拖缩放连续帧再验证 |
| execute 异步已存在 | **印证**：`chartExecuteBindingKey` / `fetchWithTimeout` 出现在栈中，但 **绘制仍在主线程** |
| Inspector 闪 loading | **印证方向**：选中即 `fetchWithTimeout` + 多组件 `renderWithHooks` |

**步 4（geo Worker）门禁**：当前 **不建议启动**；P1 补录后若 `analyzeMatch` 连续 >50ms 再开 spike。

---

## 4. 复现命令

```bash
# 自动化（推荐，需 Playwright Chromium）
cd fe && pnpm exec playwright install chromium   # 首次
node scripts/perf-profile-hotpaths.mjs

# 分析已有 CDP JSON
python fe/scripts/analyze-cdp-profile-src.py <profile.json> P3_cold_enter
```

### 手测（Chrome DevTools）

1. F12 → **Performance** → 勾选 Screenshots + Memory（可选）
2. 录制 10s，执行对应路径后 Stop
3. Main 线程 Bottom-Up 过滤 `127.0.0.1:5173/src`，导出 Top 3

---

## 5. 环境备注

- `GET /api/v1/dashboards?...` 因某看板 `graph` 的 `styleVariant=default` 校验失败返回 500（`CHART_INVALID_STYLE_VARIANT`），**列表 API 不稳定**；单看板 `GET /dashboards/{id}` 正常。
- 数据大屏 `surfaceKind=data-screen` 多条记录在 DB 存在，但当前 admin 会话下 `/admin/data-screens/{id}/edit` 显示不存在，P1 受阻。

---

*下一步：修复 P1 阻塞后重录 → 更新本附录 → 执行裁决 §8 步 1–3*
