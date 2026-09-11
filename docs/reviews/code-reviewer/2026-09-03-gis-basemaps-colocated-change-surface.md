# VitalSpan 生产就绪 / 产品体验评审 · 2026-09-03

针对用户问题：**「字体和瓦片同机离线」是否完成。**

## 总览

| 项 | 内容 |
|----|------|
| 范围 | PR·变更面：GIS glyphs/sprite 与 PMTiles 同机服务（`tile_services` · `gisPmtilesUrl`/`gisMapStyle`/`GisMapView` · `start/register/sync-pmtiles-*.ps1` · `docker/pmtiles-tile-server`） |
| mode | review |
| fix_mode | confirm |
| Stack Card | 见下 |
| 扫描方式 | 并行 explore：L1/L8 · L7；主 agent 复核；`scan_tools: ast-grep+codegraph 已探测，本面以 rg+读代码` |
| 证据层 / 外部依赖 | 无 `.evidence/`（Blind spot）；仓外：Protomaps `basemaps-assets` 仅 **bootstrap 一次**（git clone），运行时契约为同机 HTTP |
| Blind spots | 无证据层；未再浏览器走查「已连接+缺字体」 |
| P0 / P1 / P2 | **0 / 4 / 3** |
| 建议 | **同机离线主路径已完成**；上线前补健康探活与「已连接」语义，勿宣称「检查器绿标 = 标注字体可用」 |
| 回传 status | DONE_WITH_CONCERNS |
| 已排除非问题 | 测试夹具里的 github.io URL；本机已执行 sync（桌面 `basemaps-assets` + 8080 抽样 200）；127.0.0.1 登记为本地瓦片服务预期；未接全球底图不打 fonts（已门禁） |

一句话结论：**代码与本机部署已把字体和瓦片放到同一服务；产品闭环未完——「已连接」不探 fonts，启动健康检查也不探 fonts。** 不能写可上线。

### Stack Card（摘要）

- 形态：VitalSpan FastAPI + `fe/` React；本批外部进程 Caddy PMTiles
- 范围模式：变更面（非整仓）
- 宣称：GIS 全球底图离线；glyphs 与 `.pmtiles` 同机；未接底图不请求该服务
- 跳过 lane：L4 无新表单；L5 无页级视觉；L6 无把 CDN 打进 prod Helm；L2 无新密钥
- ha_mode：single（本 skill 附件未强制 L11）

## Blind spots / 未完成 lane

| Lane | 状态 | 未覆盖范围 | 说明 |
|------|------|------------|------|
| 证据层 | 未消解 | `.evidence/` | 无 gate-check 工件 |
| BROWSER | 边缘 | 真机绿标+红条对照 | 静态可定位 |
| L4/L5/L6 | 合理跳过 | — | 见 Stack Card |

## 完成度对账（先回答「是否完成」）

| 项 | 状态 |
|----|------|
| resolve 默认同机 `/basemaps-assets`，名单内 CDN 改写 | **完成** |
| 未选 `tileServiceId` 不建 MapLibre、不打 fonts | **完成** |
| 开发代理把 8080 资产改写到 `/dev-pmtiles` | **完成** |
| 本机桌面 `planet-z15*.pmtiles` 旁已有 `basemaps-assets/`，8080 可 200 | **完成**（执行态，非 Git） |
| 「已连接」= 字体可用 | **未完成** |
| 启动/health 探活 fonts/sprite | **未完成** |
| 纯离线环境首次拿到 fonts（不访问 GitHub） | **未完成**（sync 仍 clone GitHub） |

## P0 Findings

无。主路径已去掉默认 jsDelivr；缺字体时画布仍有红条（诚实失败，不是假成功）。

## P1 Findings

### P1-1 · 「已连接」不探 glyphs/sprite

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 |
| 证据 | `ChartGisMapTileServiceSetup.tsx`：命中已启用 `tileServiceId` 即绿标「已连接」；resolve 展示偏 PMTiles。缺 `basemaps-assets` 时 `GisMapView` 仍出字体红条 |
| 建议修法 | 绿标改为「服务已登记」或额外探测 `/basemaps-assets` 抽样；失败不要用成功绿 |
| 可批量 | 是（批次 A） |

### P1-2 · 启动与 health 只验 PMTiles Range

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 / 隐式假通 |
| 证据 | `verify-pmtiles-external.ps1`、compose `healthcheck` 只打 `.pmtiles`；`start-pmtiles-external.ps1` 只要 `basemaps-assets/fonts` 路径存在（空目录也会跳过 sync）仍打印 assets ready |
| 建议修法 | 探活一个 `.pbf` 与 `sprites/v4/light.json`；fonts 空则失败而非 ready |
| 可批量 | 是（批次 A） |

### P1-3 · 首次同步仍依赖 GitHub

| 字段 | 内容 |
|------|------|
| 类别 | 隐式假通 |
| 证据 | `sync-pmtiles-basemaps-assets.ps1`：`git clone https://github.com/protomaps/basemaps-assets.git`。运行时不再打 jsDelivr，但**纯内网第一次部署**拿不到字体 |
| 建议修法 | 制品/内网镜像包进 `PMTILES_DATA_DIR`，sync 只校验本地树；clone 作为可选 |
| 可批量 | 否（需运维制品决策） |

### P1-4 · 失败文案仍写「检查网络或内网镜像」

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 |
| 证据 | `gisMapRuntime.ts` Failed-to-fetch 且命中 fonts/sprite 时仍「请检查网络或配置内网镜像」；glyph 专用分支已改为同机目录 |
| 建议修法 | 与 glyph 分支同一口径：同机 `/basemaps-assets` |
| 可批量 | 是（批次 A） |

## P2 Findings

- **P2-1** `gisProtomapsAssets.ts` 的 `mirrorProtomapsBasemapAssetsUrl` / `resolveDevBasemapAssetsUrl` 已是空 trim，易误导
- **P2-2** `vite.config.ts` 仍保留 `/dev-basemaps-assets` 代理，主路径已走 `/dev-pmtiles`
- **P2-3** `docs/services/pmtiles-tile-server.md` 仍写「失败回退离线省界」，与 ADR-12 / 实现不符

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| 测试夹具 github.io URL | 测试双；并断言会改写到同机 |
| 本机已 clone 到桌面 | 执行完成，不证明每台机器都有 |
| 未接底图不请求 8080 | 代码门禁成立 |
| create 仍可写入 CDN 字段 | resolve 会改写名单 CDN；无管理员 FE 去填公网字体 |

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 |
|------|------------|------|
| A 诚实探活+文案 | P1-1, P1-2, P1-4, P2-3 | S–M |
| B 死代码/代理 | P2-1, P2-2 | S |
| C 离线制品 | P1-3 | 需运维包，本批可不自动修 |

---

是否修批次 A（探活 + 绿标语义 + 文案 + 文档）？P1-3 离线制品包需要另说。
