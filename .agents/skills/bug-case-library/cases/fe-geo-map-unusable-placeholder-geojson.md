# FE 地图组件不可用（占位底图 + region_id 维度）

## 症状

- 看板添加「地图」图表后几乎空白，或仅见零散小方块
- 绑定 `region_id` 数值列时全省灰色、无着色
- tooltip 无有效区域数据

## 根因

1. **底图资产**：`regions-simplified.json` 仅为 10 个经纬度占位矩形，非真实省界，ECharts 投影后几乎不可见
2. **区域名不匹配**：底图 `properties.name` 为「北京市」「广东省」等全称，数据若为短名或数值 ID 无法 join
3. **演示库常见误配**：`docker/demo-mysql` 中 `sales.region_id` 为 5/7/8 等内部 ID，需 JOIN `regions.name` 才能映射到地图

## 修复

1. 换用阿里云 DataV 全国省级 GeoJSON：`fe/src/assets/geo/china-provinces.json`（34 省）
2. `resolveMapRegionName`：短名→全称、行政区划 adcode、`regions.code` 别名（BJ/SH/GD…）
3. `buildChartRenderModel`：检测 `region_id` 数值维度时给出明确配置错误
4. `AdvancedEchartsChart`：未匹配区域时展示黄色提示条
5. 地图 series 增加 `layoutCenter` / `layoutSize`，禁用无意义 legend

## 锚点

- `fe/src/lib/geoMapChart.ts`
- `fe/src/assets/geo/china-provinces.json`
- `fe/src/lib/buildChartRenderModel.ts`
- `fe/src/components/charts/adapters/AdvancedEchartsChart.tsx`
- 回归：`fe/src/lib/geoMapChart.test.ts`、`fe/src/lib/buildChartRenderModel.test.ts`

## 修复方式（2026-07-16 补充）

- `chartFieldAssignment`：允许 `region_id` 拖入地图地理槽（不再硬拦截）
- `resolveDemoMysqlRegionId`：演示库 `regions.id` 5–9 → 省级名称
- `resolveEmbeddedGeoRoam`：编辑态保留缩放平移（对标 DE）
- `GEO_MAP_SCALE_LIMIT` + `data-viz-wheel-zoom`：允许缩小；画布滚轮不再抢走地图滚轮
- **省→市→区县下钻**（2026-07-16）：`chartFieldSlots` 三级维度槽；`geoMapLevels.ts` 懒加载 `assets/geo/cities/{adcode}.json`（33 省）与 `districts/{cityAdcode}.json`（演示城市）；预览态点击 + `ChartDrillChrome` 面包屑

## 下钻配置（对标 DataEase）

| 槽位 | 字段示例 |
|------|----------|
| 地理 / 维度 | `province` |
| 钻取 / 市级 | `city` |
| 钻取 / 区县 | `district`（可选） |

预览态点击省/市切换底图；编辑态配置字段。区县边界按城市打包，未打包城市下钻到市后提示「暂无区县边界」。

## Code review 修复（2026-07-17）

- `preflightMapDrillClick`：下钻前校验底图资产，失败不 push 栈
- `geoMapDrill.ts`：直辖市跳过市级槽；`drillLookupRows` 全量行解析过滤值
- `DEMO_MAP_DRILL_SQL`：改为静态 UNION 示例（不依赖演示库 regions 层级）
- `ChartDataSlots`：地图 SQL 提示 + `DEMO_MAP_JOIN_SQL`

## 正确用法（演示库）

**方式 A（省→市→区县下钻，推荐）**：`v_sales_geo` 视图

```sql
SELECT province, city, district, SUM(amount) AS total
FROM v_sales_geo
GROUP BY province, city, district
```

槽位：地区 `province` · 钻取 `city` / `district` · 指标 `total`。预览态点击下钻。

**方式 B（仅省级）**：

```sql
SELECT province AS region, SUM(amount) AS total
FROM v_sales_geo
GROUP BY province
```

地理维度选 `region`，指标选 `total`。

**方式 C**：直接 `region_id`（仅省级 id 5–10 自动映射，**不能下钻**）

## 预防

- 地图维度必须是**可读的行政区域名称**或**行政区划代码**，不要用业务表内部 `region_id`
- 新增底图资产须为真实 GeoJSON，禁止用经纬度占位矩形冒充地图
- **GEO-IRON-01**：仅离线中国；禁止在线瓦片与境外地图（见 `.cursor/rules/geo-map-offline-china.mdc`）
