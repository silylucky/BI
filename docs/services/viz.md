# viz — 图表类型注册与渲染配置契约

| 字段 | 值 |
|------|-----|
| 模块路径 | `backend/app/viz/` |
| PRD | [F06-VIZ](../automate/prd/F06-VIZ.md) · VIZ-003/004/005/006/008 |
| 里程碑 | M9 |
| 状态 | **L1 kickoff (r61)** |

## 职责

- chart-type 注册表：`ChartTypeRegistry` + 内置 **~40 DE 独立 chartType**（`backend/app/viz/builtin/*`）与 catalog 导出；字段含 `library` / `paletteCategory` / `deprecated` / `migratesTo`；canvas 类型 `renderer: antv`
- 样式变体（`style_variant`）与字段规则（`field_rule`）校验的规则真理源
- 引擎无关 render-spec 归一（`build_render_spec`）
- 图表嵌入配置契约（`ChartEmbedConfig` + origin 白名单校验）

## 边界

| In | Out |
|----|-----|
| 类型注册与 catalog、`style_variant`/`field_rule` 校验规则源 | 具体图表库渲染（`fe/charts/engine/`）；**不含**在线地图 |
| 引擎无关 render-spec 归一（`engine` 字段由 FE registry 填充） | 默认公网在线瓦片底图、境外地图、运行时外链 GeoJSON CDN |
| `gis-map` 管理员登记 PMTiles（`tileServiceId` → `backend/app/viz/tile_services/`） | 128GB 级 PMTiles 打进主 release 包 |
| PMTiles 外部瓦片进程 | 见 [pmtiles-tile-server.md](./pmtiles-tile-server.md)（独立部署，非 `app/viz` 域内） |
| embed origin 白名单/目标唯一性校验 | 图表出数（复用 `query` 链）、嵌入 token 签发与 CSP 响应头 |
| `viz/components/` 组织组件库 CRUD、`componentRef` payload 解析 | 看板 layout 存储、大屏壳层装饰 |

## 组件库（DASH-010）

- 域：`backend/app/viz/components/`（与 `dashboard/templates/` 并列）
- 消费：`fe/src/lib/resolveVizComponent.ts` 在 `ChartRenderer` / `DashboardWidget` 路径合并 `payloadJson`
  - 列表 companion：`referenceCount` 扫描 `dashboards.layout_json` 中未断链的 `componentRef`
| `sdk_portal/` SDK init validate + lifecycle manifest（只读引用 `_ORIGIN_RE`） | npm JS SDK 发布、修改 `embed.py` 校验语义 |

## 依赖

- 上游被 `schemas/chart_view`（函数内惰性 import，避免 shared→domain import-time 反向依赖）与 `api/v1/charts`（entry）消费
- 无下游域依赖

## 主要类型 / 入口

| 符号 | 说明 | PRD | 状态 |
|------|------|-----|------|
| `ChartTypeSpec` / `FieldRule` | frozen dataclass 类型/字段规则 | VIZ-003 | 已实现（骨架） |
| `ChartTypeRegistry` / `registry` | 类型注册表与单例 | VIZ-003 | 已实现（骨架） |
| `get_spec` / `export_chart_type_catalog` | 查规格 / 导出 catalog（含 library·paletteCategory·deprecated） | VIZ-003 | 已实现 |
| `build_render_spec` | render-spec 归一映射 | VIZ-008 | 已实现（骨架） |
| `validate_chart_embed_config` / `ChartEmbedConfig` | 嵌入配置校验与契约 | VIZ-006 | 已实现（骨架） |
| `viz/sdk_portal/` | SDK portal init validate + lifecycle manifest + capabilities | VIZ-007 | L1 已实现 r61 |

## 关联 API

见 [api/README.md](../api/README.md) §图表。

## 错误码

| 码 | 说明 |
|----|------|
| `CHART_INVALID_TYPE` | chartType 未注册 |
| `CHART_INVALID_STYLE_VARIANT` | styleVariant 不属于该类型 |
| `CHART_FIELD_REQUIREMENT` | 维度/度量数量不满足类型字段规则 |
| `EMBED_MISSING_TARGET` | chartId/dashboardId 均缺失 |
| `EMBED_TARGET_CONFLICT` | chartId 与 dashboardId 同存 |
| `EMBED_INVALID_ORIGIN` | allowedOrigins 含非法 origin |
| `EMBED_INVALID` | 嵌入配置结构非法（如 theme 越界） |

## 实现笔记

- r42 L1 kickoff：注册表驱动 `chart_view` 校验；注册 `pie` 后 r28/r30「非法 type」样例改用未注册 `radar`
- **GEO-IRON-01**（ADR-12）：`map`/`map-3d` 仅离线中国 GeoJSON；`gis-map` 允许同页 MapLibre（默认禁公网底图）；见 `.cursor/rules/geo-map-offline-china.mdc`
- **`gis-map` 散点叠加**（FE `fe/src/components/charts/engine/maplibre/gisMapOverlay*.ts`）：经/纬 + 可选指标/标签 → MapLibre GeoJSON `setData`；官方示例 Dataset **`demo-map-scatter`**（`sample_db.de_map_heat`）；区域着色仍用 `map`/`map-3d` + `demo-v-sales-geo`
- `schemas/chart_view` 校验查 registry 用函数内惰性 import，`app.viz` 包内为 submodule-only import，无循环依赖

### DE 命名轴字段模型（2026-07-30）

- **真理源**：`fe/src/lib/chartDeAxis/catalog.ts`（对标 DataEase v2 `axisConfig` 快照）
- **持久化**：`ChartViewConfig.axes`（FE 权威）+ `ChartViewConfigLayout.axes`（BE layout）；`dimensions`/`metrics` 为 buildPlan 兼容投影；提交前 `sanitizeChartFieldsForValidate` 同步并裁剪空槽
- **编码解析**：`fe/src/lib/resolveChartEncoding.ts`（`migrateChartConfigToDeAxes` · `deAxisRenderReady`）
- **Inspector**：`ChartDataSlots` / `SlotTarget { axisId, index }` 与 catalog 槽位一致；`both` 轴支持维/指标混拖
- **buildPlan 读轴**：`fe/src/lib/chartAxisPlanFields.ts` · `fieldFromAxisOrLegacy`；`bar-range` / `stock-line` / `word-cloud` / `multi-scatter` / `chart-mix-dual-line.extBubble` 优先读 `encoding.axes`
- **parity 门禁**：`chartCatalogFieldRules.test.ts` T-VIZ-R32-011 · `chartAxisEncodingPath.test.ts` · `tests/test_viz_chart_catalog_parity.py`

### Companion r63（VIZ-007）

- `viz/sdk_portal/probe.py`：`probe_validate_sdk_budget_ms` / `probe_lifecycle_budget_ms`（50ms 同进程 perf_counter）
- ACL：`VIZ_SDK_TOKEN_REQUIRED`（token 模式缺 embedToken）、`VIZ_SDK_DUPLICATE_ORIGIN`、`VIZ_SDK_FORBIDDEN`（destroy 需 admin/editor）
