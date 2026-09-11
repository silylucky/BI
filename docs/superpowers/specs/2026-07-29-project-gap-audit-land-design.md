# Feature Land Design: VitalSpan 项目缺口总览与补齐路线

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-29 |
| 主模式 | **Gap-fill**（全项目 companion 审计） |
| 状态 | draft |
| 成功标准 | 能按优先级列出**可观察、可验收**的缺口；P0 有明确模块触及面与闭合方式；文档与代码无重大漂移 |
| 非目标 | 新立项 SQL Lab / AI 问数；fork DE/SS；扩 PRD 合同面（129 项已勾） |
| 启用维度 | `ui-vertical`、`contract`、`docs-sync`、`regression` |

## 1. 问题与意图（对话优先）

- **用户任务（一句话）**：审视 VitalSpan 当前还有什么要补充或不足，形成可指导落地的补齐路线。
- **Must**
  - 以代码 + `plan.md` + PRD companion `[ ]` 为证据，不凭印象
  - 区分「真缺口 / 已做未勾 / 可选远期」
  - 给出 P0→P2 分期与验收
- **Nice**
  - 对标 DataEase/Superset 仅作体验参照，不扩 scope
  - 标出文档漂移项并建议同步
- **Out**
  - AI/SQLBot、完整 SQL Lab、NFR 生产级 probe 扩面
  - 本方案阶段不写业务代码
- **约束**
  - 129 PRD 合同项已「已实现」；后续均为 **companion 加深**
  - 地图遵守 GEO-IRON-01（仅离线中国）
  - 零第三方 BI 运行时依赖（NFR-08）
- **文档漂移**
  - `plan.md` §M-DEPTH F-A/F-B 已勾，但 `prd/F07-DASH.md` 同批 F-B 仍 `[ ]`
  - `plans/2026-07-10-fe-de-ss-ia-optimization.md` v3 仍写「Dataset 内存 store / GlobalFilterBar 纯 Input」，与现码不符
  - `plan.md` F-C 两项 `[ ]`，但 `ReportSchedulesPage` 已有执行历史/重试基础 UI（**增强未收官**，非从零）

## 2. 现状审计

### 2.1 总览结论

| 层级 | 判断 | 说明 |
|------|------|------|
| 合同面 | ✅ 129/129 | `plan.md` · `prd.md` hub |
| M-DEPTH 主路径 | ✅ F-A/B/E + F-C 大半 | Dataset 持久化、筛选器、RLS/审计 FE 已落地 |
| **当前真缺口** | ⚠️ 6 类 | 见 §4 P0/P1 |
| 体验债 | ⚠️ 看板画布 + 大屏手测 | 多轮修补，缺浏览器级验收收口 |
| 文档 | ⚠️ 漂移 | PRD companion 与 plan 不同步 |

### 2.2 分区审计表

| 区域 | 已有 | 缺口/债 | 证据 |
|------|------|---------|------|
| Dataset 语义层 | ORM 持久化、真实 execute、SchemaBrowser 编辑器、计算字段行编辑 | DE 全量（多表 join 可视化等）为远期 companion | `plan.md` F-A `[x]` · `backend/app/metadata/dataset/` · `fe/.../DatasetListPage.tsx` |
| 仪表板筛选器 | `filter` widget、FilterControl、GlobalFilterBar 下拉/日期/多选、驱动 execute | PRD 分片未回写勾选 | `GlobalFilterBar.tsx` · `FilterWidgetControls` · `prd/F07-DASH.md` 仍 `[ ]` |
| RBAC/RLS/审计 | 后端全栈 + `RlsAdminPage` + `AuditLogPage` | 资源授权体验仍可加深（非阻塞） | `fe/src/pages/admin/system/rls/` · `audit/` |
| 查询服务目录 | 列表 + **试执行**（空参数） | **OpenAPI 片段不可见**；试跑无参数表单；失败态浅 | `QueryServicesPage.tsx` · `backend/.../services.py` `GET /{id}/openapi` · FE 无消费 |
| 报表调度 | API 历史/重试/artifact + `ReportSchedulesPage` 展开历史 | **增强未收官**：无 artifact 下载、状态本地化弱、独立调度中心信息密度低 | `ReportSchedulesPage.tsx` · `executor.py` · `prd/F08-RPT.md` RPT-005 `[ ]` |
| 看板画布交互 | isPlayer 拖缩放、live resize、VitalSpanTable | **8/8 Pointer QA 未勾**；饼/漏斗缩放反馈仍差；DASH-008 配置栏 6/10 占位 | `plans/2026-07-14-dashboard-canvas-ux-de-complete.md` |
| 数据大屏 | Phase 2.5/2.6 主链通；视口 pan/zoom hook | P1 手测 16 项未抽测；BUG-12 e2e **环境阻塞**；pan/zoom 持久化未决策 | `docs/feature-design/2026-07-29-data-screen-master-gap-fill.md` |
| 图表检视器 | ChartConfigPanel、多类型渲染 | 维度/度量列驱动选择未接线 | `prd/F06-VIZ.md` `[ ]` |
| 治理/总线 | 工单 FSM、发布页 OpenAPI 预览 | 真实总线 HTTP、≥2 端点、发布后 RLS 全链 | `prd/F10-GOV.md` companion `[ ]` |
| 3D 地图云 | 块状体积云方案已实施 | 视觉验收清单未勾 | `specs/2026-07-27-map3d-volumetric-cloud-root-first.md` |
| 可选 | embed token 骨架 | 公开/匿名分享、ChartExplore→Palette、设计器 ADR 收敛 | `plan.md` F-D |

## 3. 外部调研（按需 · 对标摘要）

| 对标点 | 参考 | 可观察行为 | 借鉴 | 不抄 |
|--------|------|------------|------|------|
| 服务目录 | DE 数据 API / SS REST | 列表 + 试跑 + 文档片段 | `QueryServicesPage` 加 OpenAPI Sheet + 参数试跑 | 不引入 SS Swagger UI 运行时 |
| 调度运维 | DE 定时报告 / SS Alerts | 执行历史、失败重试、产物下载 | 调度页补 artifact 链路与状态 Badge | 不抄 DE 报告引擎 |
| 看板编辑 | DE CanvasCore | 拖缩放手感、表格随框、配置栏分组 | Pointer QA 清单 + DASH-008 分期 | 不引入 S2/AntV 表格运行时 |
| 大屏编辑 | DE 数据大屏 | 视口相机模型、投放一致 | 手测收口 + BUG-12 e2e 环境修复 | 不做无限画布（已决策） |

## 4. 方案比选

### 推荐：Companion 收官三部曲（不扩 PRD）

**做法**：在 129 合同已闭合前提下，按「文档同步 → M-DEPTH 余项 → 体验债收口」三条线并行，每线 3–5 项可验收切片。

**为何优于备选**：
- **备选 A（新开里程碑扩 PRD）**：与 `goal.md` G2 禁止选题冲突，工期不可控
- **备选 B（只做文档不同步）**：不解决用户可感知的体验落差

## 5. 架构与边界

| 线 | 模块落点 | 依赖 | 不碰 |
|----|----------|------|------|
| M-DEPTH F-C 余项 | `fe/.../QueryServicesPage.tsx` · `useReportSchedules.ts` | `services.py` openapi · `reports/scheduler/executor.py` | 不改发布 FSM |
| 看板画布 | `fe/.../pixelCanvas/` · `ChartRenderer` · `ChartConfigPanel` | 现有 layout schema | 不引 S2；不大改后端 |
| 大屏收口 | `fe/.../screen/` · `layoutSanitize.ts` | 现有 dashboard API | 不做 pan/zoom 持久化（除非 P2 拍板） |
| 文档同步 | `prd/F07-DASH.md` · `plan.md` · `fe-de-ss-ia-optimization.md` | prd-sync 规则 | 不写 SRS 新需求 |

## 6. 数据与契约（`contract` 维度）

### API-003 补齐要点

- **已有**：`GET /api/v1/services` · `POST /{id}/execute`
- **待消费**：`GET /api/v1/services/{id}/openapi` → FE Sheet 展示 JSON；试跑支持 `parameters` 表单（读 openapi `parameters` 或 catalog 元数据）
- **错误**：execute 失败经 `mapApiError` 展示中文 + 保留 trace 供排障

### RPT-005 增强要点

- **已有**：`GET .../executions` · `POST .../executions/{id}/retry` · `GET .../executions/{id}/artifact`
- **待补**：历史表「下载产物」链；执行状态 Badge 本地化；失败行展开详情；`SchedulePanel` 与 `ReportSchedulesPage` 行为对齐

## 7. 体验路径（`ui-vertical`）

### 7.1 查询服务试跑闭环（P0）

| 序 | 层 | 状态 | P0 |
|----|----|------|-----|
| 1 | 后端 catalog + openapi fragment | 已有 | — |
| 2 | entry `GET/POST services*` | 已有 | — |
| 3 | FE `QueryServicesPage` 列表 | 已有 | — |
| 4 | FE 试跑 mutation | 半成品（空参数） | 参数表单 |
| 5 | FE OpenAPI Sheet | **缺** | 接 `/{id}/openapi` |
| 6 | 失败/空态 | 浅 | toast + 行内错误 |

### 7.2 看板 Pointer QA（P1）

编辑页 → 拖/缩表格/饼图/漏斗 → 保存刷新 → 尺寸保持；壳层主题与看板主题隔离。

## 8. 分期落地

| 期 | 范围 | 可验收结果 | 依赖 |
|----|------|------------|------|
| **P0** | M-DEPTH F-C 余 2 项实质收官 + PRD/plan 回写 F-B | 服务页可看 OpenAPI + 带参试跑；调度历史可下 artifact；`F07-DASH` F-B 与 plan 一致 | — |
| **P1** | 看板画布 Pointer QA 8/8 + DASH-008 再勾 2–3 组 | 手工表全勾；vitest 绿；配置栏占位减少 | P0 可并行 |
| **P1** | 数据大屏 master gap-fill 手测 MT-1~MT-DEPLOY-6 | 发版前抽检通过；BUG-14 MT-6 确认 | — |
| **P1** | BUG-12 Playwright 环境修复 + e2e 绿 | `data-screen-resize-content.spec.ts` 通过 | 本机 ms-playwright |
| **P2** | F06 检视器列驱动；F-D 可选（分享/IA/ADR）；大屏 pan/zoom 持久化 | 按人工点名单独立项 | 产品决策 |
| **远期** | F10 真实总线、F15 生产 NFR、Dataset DE 全量 | companion，不挡当期 | 运维/客户环境 |

## 9. 风险与回滚

| 风险 | 影响 | 缓解 |
|------|------|------|
| 文档与代码双轨 | 选题误判、重复劳动 | P0 先 docs-sync 再开发 |
| 看板拖缩放回归 | 用户感知「又坏了」 | 8 项 QA 清单 + vitest；分 Phase revert |
| 公开分享（F-D） | 越权泄露 | 默认不做；须安全评审 + origin 白名单 |
| Playwright 环境 | e2e 假红 | 按 master gap-fill §4 runbook |

## 10. 验收清单

**正确性**
- [ ] `QueryServicesPage` 可调 `GET /services/{id}/openapi` 并展示
- [ ] 试跑可传非空 `parameters` 且错误可读
- [ ] 调度历史可重试失败项并下载 artifact（若后端返回）
- [ ] `prd/F07-DASH.md` M-DEPTH F-B 与 `plan.md` 勾选一致

**效果**
- [ ] 看板 Pointer QA 8/8 通过（`dashboard-canvas-ux-de-complete.md` §6.2）
- [ ] 大屏 MT-6 保存后坐标不变（BUG-14）
- [ ] 3D 场景云视觉抽检（可选，见 map3d spec §验收）

**已启用维度**
- [ ] `contract`：services openapi FE 消费闭合
- [ ] `docs-sync`：漂移文档已更新
- [ ] `regression`：相关 vitest + 约定 e2e 命令绿

## 11. 开放问题（待拍板）

1. **M-DEPTH 是否宣告收官**：F-C 余 2 项做完即勾 plan，还是等看板 QA 一并收官？
2. **大屏 pan/zoom 持久化（P2-2）**：是否纳入下一 companion？
3. **F-D 公开分享**：是否有政企客户明确需求？无则继续 Out。
4. **DASH-008 占位分组**：P1 优先哪 2–3 组（风格/背景/高级样式）？

## 12. 审批与交接

- **决策**：批准 / 修改后批准 / 驳回
- **相对草稿变更**：（审批时填写）
- **豁免审批直接实现**：否
- **交接**：批准后 → 拆 `writing-plans` 或按 P0 直接实现

---

## 附录：优先级速查（给用户）

| 优先级 | 项 | 类型 | 工作量感 |
|--------|-----|------|----------|
| P0 | 查询服务 OpenAPI + 带参试跑 | 真缺口 | 小 |
| P0 | 调度历史增强（artifact/状态） | 增强 | 小 |
| P0 | PRD/plan 文档漂移修复 |  housekeeping | 极小 |
| P1 | 看板拖缩放 Pointer QA | 体验债 | 中 |
| P1 | DASH-008 配置栏占位减少 | 体验债 | 中 |
| P1 | 数据大屏手测 + BUG-12 e2e | 回归 | 中（含环境） |
| P2 | 图表检视器列驱动 | companion | 中 |
| 可选 | 公开分享 / 设计器 ADR | 需决策 | 中–大 |
| 远期 | 真实总线 / 生产 NFR | 差异化深化 | 大 |
