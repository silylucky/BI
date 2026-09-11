# gis-map chartType（Phase 0+1）— Headless Automation Plan

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
Date: 2026-08-17

## 目标

看板可添加 `gis-map` 图表类型；同页 MapLibre 以空白或离线中国省界出图；`map`/`map-3d` 行为不变。

## 范围

### In

- ADR-12 双路径 + geo mdc + viz / vs-ai-spec 红线
- BE/FE 注册 `gis-map`（50th chartType）
- `GisMapView` + `maplibre-gl` 懒加载 + 离线省界 style
- `gisProject` 最小 schema（`blank` | `china-provinces`）
- 单测：gisProject / gisMapStyle / transformRequest

### Out

- `goal.md` 修订
- WMS/XYZ 登记、Dataset→GeoJSON、楼块 3D、iframe/GeoLibre、Playwright 导出改造

## 改动清单

| 区域 | 文件 |
|------|------|
| 架构 | `docs/arch.md` ADR-12 |
| 铁律 | `.cursor/rules/geo-map-offline-china.mdc` |
| 域 | `docs/services/viz.md` |
| AI 规范 | `docs/api/vs-ai-spec/README.md` · `capability-manifest.json` |
| BE | `backend/app/viz/builtin/map.py` |
| FE 引擎 | `fe/src/components/charts/engine/maplibre/*` |
| FE 注册 | metadata · register · d3ViewRouter · buildPlan · chartTypeStyleProfiles |
| 测试 | `gisMapStyle.test.ts` · catalog count 50 |

## 验证方案

```bash
cd fe && pnpm exec vitest run src/components/charts/engine/maplibre/gisMapStyle.test.ts src/components/charts/engine/plugins/catalogParity.test.ts
cd .. && python -m pytest tests/test_viz_chart_catalog_parity.py -q
```

## 验收标准

- [x] `gis-map` 出现在 BE/FE catalog（50 types）
- [x] `GisMapView` 默认 `china-provinces` style 含 fill/line 层
- [x] 未知 basemap 回落 `china-provinces`
- [x] transformRequest 不附加 Authorization
- [x] 上述测试命令 exit 0
