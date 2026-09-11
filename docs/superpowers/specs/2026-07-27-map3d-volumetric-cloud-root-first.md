# Root-First Briefing: 3D 场景云 → 块状体积云

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-27 |
| 主模式 | **Thrash** |
| 子类型 | Feature（视觉形态） |
| 状态 | done |
| 正确性标准 | 开启「场景云」的 map-3d 正常渲染、可开关、密度/速度/高度滑块仍生效、无 WebGL 崩溃 |
| 效果标准 | 远景可见**离散云团**（多块半透明球体叠成体积感），整体自西向东缓慢漂移；俯视/斜视均有「一团一团」而非「一层雾幕/贴图在滑」 |
| 启用维度 | `ui-vertical`、`perf`、`regression`、`offline-asset` |
| 非目标 | 真流体模拟；在线纹理/CDN；改 `sceneFog` 配置键；全屏体积光/后处理；世界地图 |

## 1. 现象 / 诉求（来自对话）

- 用户原意：「还是不够好看，要一块一块的体积云」
- 明确反感：不真实、移动不符合现实（前序多轮反馈）；当前层状雾幕/平面噪声仍不像云
- 期望：**块状、有体积感**的云团，观感更好看
- 现状：`geo3dSceneClouds.ts` 用多层水平 `PlaneGeometry` + `geo3dSceneCloudMaterial.ts` 2D 程序化噪声；无论 UV 滚动还是世界坐标 shader，本质仍是**平面薄片**

## 2. 需求锚定

| 层级 | Must / Nice / Out |
|------|-------------------|
| **对话 Must** | 云呈「一块一块」团状；有体积感；比当前更好看；保留场景云开关与三滑块 |
| **对话 Nice** | 盛行风向西漂移；高层略快；与 3D 地图科技风协调（白/浅蓝） |
| **对话 Out** | 继续微调平面 shader 参数碰运气 |
| **工作区** | 云模块：`geo3dSceneClouds.ts` · `geo3dSceneCloudMaterial.ts`；接入 `renderThreeChoropleth.ts` rAF |
| **文档校验** | GEO-IRON-01：仅离线资产；无在线地图 SDK — 云须**程序化几何**，无外链纹理 |

## 3. 失败迭代复盘（Thrash）

| # | 尝试了什么 | 为何失败/为何差 | 证据 | 下轮禁止 |
|---|------------|-----------------|------|----------|
| 1 | Sprite 贴片云 | 像贴纸、无厚度 | L2 对话 | 再用单面 Sprite 作主形态 |
| 2 | 水平面 + 可平铺噪声 UV 滚动 | 像天花板贴图在滑 | L2 对话 | 不以 UV 平移为主运动 |
| 3 | 世界坐标 2D FBM shader（水平面） | 仍是层状雾幕，无块状体积 | L1 `geo3dSceneCloudMaterial.ts:64-84` + L2「不够好看」 | 不把平面当最终载体 |

**三问：**
1. **根因错位**：前几轮在「平面 + 噪声」策略上优化；用户要的是**3D 团块 primitive**，策略错位。
2. **效果标准**：此前标准偏「层状云/风漂」，未写「团块状体积感」。
3. **沿用旧思路会再失败**：任何平面 shader 调参都无法产生 Z 向厚度与团块轮廓。

## 4. 代码取证

| 发现 | 等级 | 路径 |
|------|------|------|
| 云由水平平面 + ShaderMaterial 构成，无 Z 厚度 | L1 | `geo3dSceneClouds.ts:74-78` |
| Fragment 在 `vWorldXZ` 上采样 2D 噪声 | L1 | `geo3dSceneCloudMaterial.ts:17-19,64-84` |
| 挂载与动画：`applyGeo3dSceneClouds` → rAF `update(deltaSec)` | L1 | `renderThreeChoropleth.ts:538,705-718` |
| 配置：密度/速度/高度 + `sceneFog` 开关 | L1 | `chartDeStyle.ts:106-113` · `ChartGeoStylePanel.tsx:236-275` |
| 仓内尚无 `InstancedMesh` 先例 | L1 | `fe/src` grep 无匹配 |
| 测试覆盖 build/update/dispose/开关 | L1 | `geo3dSceneClouds.test.ts` |

**调用链：** `ChartGeoStylePanel` → `geo3dStyle` → `renderThreeChoropleth` → `applyGeo3dSceneClouds` → `buildGeo3dSceneClouds` → rAF `update`

## 5. 可选维度详情

### 5.a `ui-vertical`

**画面验收：** 科技预设 3D 中国地图，开启场景云后，地图上方可见多团独立云块；旋转 orbit 时云团有前后遮挡与厚度感。

| 序 | 层 | 状态 | 证据 | P0 是否改 |
|----|----|------|------|-----------|
| 6 | fe 渲染 | **坏**（形态不符） | `geo3dSceneClouds.ts` | **是** |
| 5 | 配置编排 | 已有 | `ChartGeoStylePanel` | 仅文案微调 |
| 1–4 | 数据/API | 不涉及 | — | 否 |

### 5.b `perf`

- 目标：单图 **≤12 云团 × 每团 5–8 球**（`InstancedMesh` 合并绘制），密度滑块线性增减团数
- 测量：Chrome 下 orbit + 云动画，目标稳 30fps+
- 降级：`prefers-reduced-motion` 已有停止动画；密度下限保底 2 团

### 5.c `offline-asset` / `regression`

- 仅 `SphereGeometry` + 程序化材质，零外链
- 必跑：`geo3dSceneClouds.test.ts` · `geo3dSceneCloudStyle.test.ts` · `geo3dVisualStyle.test.ts`

## 6. 对标调研（轻量）

| 对标点 | 参考 | 可观察行为 | 借鉴 | 不适用 |
|--------|------|------------|------|--------|
| 数据大屏 3D 远景云 | 常见 Three.js 方案 | 多球叠团 + 半透明 + 风漂 | **团块 primitive** | 真体积光后处理 |
| 游戏天空盒云 | 经典 cotton-ball | 每团 4–10 重叠球 | InstancedMesh 批渲染 | 近景高精度 |

## 7. 根源结论

**一句话根源：** 渲染 primitive 选错——始终用**二维水平面**表达云，与用户要的「块状体积云」维度不匹配；应在 3D 空间用**重叠半透明球体聚团**表达。

**排除：**
- 继续调平面 shader（策略错位）
- 全场景 raymarch 体积云（过重，易拖垮多图表页）
- 引入在线云纹理资产（违反离线铁律）

## 8. 问题分解

| # | 子问题 | 依赖 | 风险 | 优先级 |
|---|--------|------|------|--------|
| 1 | 云团生成：随机布局 + 每团多球偏移/缩放 | layout span | 过密卡顿 | **P0** |
| 2 | 软边球材质（渐变 alpha，depthWrite:false） | — | 排序闪烁 | **P0** |
| 3 | 盛行风漂移 + 边界环绕；速度/高度/密度映射 | P0 | 过快显假 | **P0** |
| 4 | 替换旧平面 shader；更新单测 | P0–2 | 回归 | **P0** |
| 5 | 真 raymarch 体积盒（可选增强） | P0 验收后 | 性能 | P1 |

## 9. 方案

### 推荐（P0）

- **做法：**
  1. 新增 `geo3dSceneCloudClusters.ts`：按 `density` 生成 N 个云团 `Group`；每团含 5–8 个 `SphereGeometry`（或单 `InstancedMesh` 批处理），随机偏移形成「一块一块」轮廓
  2. 新增 `geo3dSceneCloudPuffMaterial.ts`：顶点色或 shader 实现**中心亮、边缘透明**的软球（NormalBlending，`depthWrite: false`）
  3. 重写 `geo3dSceneClouds.ts`：`update` 驱动各团中心沿 `(+X, +0.08Z)` 漂移，出界后环绕；`height` 控制 Y 带，`speed` 控制漂移
  4. **删除** `geo3dSceneCloudMaterial.ts`（平面层状 shader）
  5. 单测改为断言：`Group` 子节点为云团、含 `Mesh`/`InstancedMesh`、漂移后 position 变化

- **废弃旧思路：** 水平 Plane + 2D FBM shader 层

- **触及文件：**
  - 新增：`geo3dSceneCloudClusters.ts`、`geo3dSceneCloudPuffMaterial.ts`
  - 改：`geo3dSceneClouds.ts`、测试文件
  - 删：`geo3dSceneCloudMaterial.ts`
  - 可能微调：`ChartGeoStylePanel` 提示文案（「云团密度」等，可选）

- **风险与回滚：** 球体过多 → 限制 `maxClusters`/`puffsPerCluster`；回滚保留 git 旧文件即可

### 备选

- **A：每团一个 raymarch Box** — 更真体积，GPU 重，多图表面风险高
- **B：保留一层极淡远景平面 + 前景团块** — 纵深更好，P0 先不做以免又变「雾幕」

## 10. 验证计划

**正确性：**
- [ ] `npx vitest run` 云相关 3 个测试文件全绿
- [ ] 关/开场景云无报错；改密度/速度/高度触发 remount 正常

**效果：**
- [ ] 默认科技 3D 地图：可见 **≥6 个可区分云团**，斜视有厚度
- [ ] 观察 15s：团块整体向东漂，非贴图滑动感
- [ ] 密度 0.2 vs 1.0：团数明显变化

**已启用维度：**
- [ ] `ui-vertical`：orbit 360° 云团形态可接受
- [ ] `perf`：动画中无明显卡顿（主观 + 无 rAF 堆积）
- [ ] `offline-asset`：无外链请求
- [ ] `regression`：上述 vitest 通过

## 11. 审批记录

- 决策：**批准**（用户 2026-07-27）
- 变更相对草稿：按 P0 实现，未做 raymarch 备选
- 豁免审批：否

## 12. 收束（实现后）

- **根源**：平面 primitive 无法表达块状体积 → 改为多球叠团 + InstancedMesh
- **改动**：`geo3dSceneCloudClusters.ts` · `geo3dSceneCloudPuffMaterial.ts` · 重写 `geo3dSceneClouds.ts`；删除 `geo3dSceneCloudMaterial.ts`
- **验证**：`vitest` 云相关 18 项全绿（2026-07-27）
