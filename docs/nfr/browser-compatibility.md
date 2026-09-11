# VitalSpan 浏览器兼容性声明

> 权威矩阵：`GET /api/v1/nfr/browser-matrix`  
> 运行时检测：`fe/src/lib/browserCompat.ts`

## 支持的主流浏览器（最低版本）

| 浏览器 | 最低主版本 | 状态 | 备注 |
|--------|:----------:|------|------|
| Google Chrome | 90 | 支持 | Chromium 内核 |
| Microsoft Edge | 90 | 支持 | Chromium 内核 |
| Mozilla Firefox | 90 | 支持 | — |
| Apple Safari | 14 | 支持 | macOS / iOS |
| Internet Explorer 11 | — | **不支持** | 请使用 Edge 或 Chrome |

## 关键路径覆盖

以下路径须在声明支持的浏览器上可正常使用：

- 登录与鉴权
- Dashboard 列表与首屏
- 报表模板管理（`/admin/reports/templates`）

## 检测方式

- **服务端**：`browser-matrix` API 根据 `User-Agent` 返回 `overallStatus`（`supported` / `unsupported` / `deprecated`）
- **客户端**：`checkBrowserCompat()` 进行 feature detection（`Promise`、`fetch`、`ResizeObserver`）及 IE UA 拦截

## 非目标

- Playwright 全浏览器矩阵 E2E（本期以 vitest/pytest smoke 替代）
- IE11 兼容垫片或 polyfill 全量支持
