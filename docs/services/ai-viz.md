# ai-viz — DeepTalk 集成 + 平台 customViz 域

| 字段 | 值 |
|------|-----|
| 模块路径 | `backend/app/ai_viz/` |
| PRD | [F17-AIVIZ](../automate/prd/F17-AIVIZ.md) |
| 集成项目 | `docs/api/vs-ai-spec/` · 桌面包 · [deeptalk-product/](../api/vs-ai-spec/deeptalk-product/) |
| 里程碑 | 试点 |
| 状态 | **部分**（库源码 + 唯一 Base 宿主 + Payload v1 + vsCv/d3） |

## 职责

- 自定义可视化源码存储与校验（HTML bundle 落库）
- 对外规范包索引：`docs/api/vs-ai-spec/`
- 与看板 `customViz` widget 衔接：**一个** Base（`CustomVizWidget`）按 `artifactId` 异步加载 entry HTML；页签重新可见时按 `contentHash` 重拉
- 运行时 Payload v1：`protocolVersion` + `bindingStatus` + execute 结果；宿主挂 `vsCv`（`getPayload` / `onPayload` / 平台 `d3`）
- bundle 体积 ≤2MB；`manifest.runtime` 仅 `html`|`d3`；拒绝内联 d3 整库

## 边界

| In | Out |
|----|-----|
| `POST/PUT/GET/DELETE /api/v1/ai-viz/artifacts` | 内置 chart plugin 注册 |
| bundle 扫描（禁外链脚本、体积上限） | AI 生成 SQL |
| `customViz` layout 契约 | 一组件一 tsx/py 发版 |
| Payload v1 与 `vs-cv-payload-update` 契约 | iframe/沙箱隔离（本产品线不做） |
| `vsCv.d3` 与 html/d3 runtime 指南 | ECharts/AntV runtime；iframe 沙箱；动态注册 chartType |

## 依赖

- 上游：`app/dashboard/schemas`（LayoutWidget）
- 鉴权：写/列表按属主；`GET` meta/entry 有 `dashboard:read` 即可（单租户共享看板）

## 关联 API

见 [api/README.md](../api/README.md) § AI 可视化。
