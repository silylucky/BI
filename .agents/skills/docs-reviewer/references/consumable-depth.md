# API / Domain 可消费深度闸门

本文件定义 `docs/api`、`docs/domain` 何时算「写够了」——以能否直接支撑 **Postman**、**APISix（或同类网关）**、**业务流程测试** 为准。对账与毕业判定须引用本闸门；模板正文见 [templates/api.md](templates/api.md) · [templates/domain.md](templates/domain.md)（索引 [templates.md](templates.md)）。

## 为何需要

薄文档常见形态：一张端点名表 + 两句领域叙事。结果是：

- Postman 无法建请求（缺 URL/Header/Body 示例）
- APISix 无法配路由（缺 uri/methods/upstream/鉴权插件）
- QA/自动化无法写流程用例（缺步骤触点、状态期望、Given/When/Then）

因此：**有文件 ≠ 合规**；缺深度 = **P1 模板不合规**（对外宣称已交付且文档误导可测性 → 升 P0）。

---

## API 闸门（全部满足才算合规）

| # | 检查项 | 通过标准 |
|---|--------|----------|
| A1 | 环境 | 至少一张 Base URL / 环境表；Postman 变量名写清（`baseUrl`/`token`/…） |
| A2 | 鉴权 | 认证方式、必要 Header、取 token 步骤或链接；匿名路径显式列出 |
| A3 | 网关 | APISix（或仓内网关）uri/methods/upstream/插件要点表；无网关须显式声明 |
| A4 | 索引完整 | 端点索引覆盖本模块**全部对外**路由（与代码/OpenAPI 对账） |
| A5 | 端点详述 | **每个**对外端点有独立小节：参数表 + **完整**请求 JSON + 成功响应 JSON + ≥1 失败示例 + curl |
| A6 | 错误模型 | envelope 形状 + 本模块业务码表（码/HTTP/含义/客户端建议） |
| A7 | 冒烟清单 | ≥3 步联调检查（含鉴权失败或校验失败） |
| A8 | 可导入 | 链到可用 OpenAPI/proto，**或**提供 Postman Collection，**或**详述已自洽到可手建 Collection |

**不合格（直接 P1）**：

- 只有「方法|路径|说明」总表，无逐端点 Body/响应
- 示例为「见 OpenAPI」「见代码」而无任何可复制 JSON
- 无鉴权/无 Base URL
- 有网关却无路由要点（团队使用 APISix/Kong 等时）

**与契约源关系**：

| 情况 | 要求 |
|------|------|
| 有完整 OpenAPI | Markdown 可把巨型 schema 链出去，但 A1–A8 仍须满足；Postman 优先 Import OpenAPI，Markdown 补业务码/网关/冒烟 |
| 无 OpenAPI | Markdown 端点详述 = 联调真源；字段表 + JSON 示例不可省；建议同批补 OpenAPI 或 Collection（P2 可跟踪，不得用「以后再补」跳过 A5） |

---

## Domain 闸门（全部满足才算合规）

| # | 检查项 | 通过标准 |
|---|--------|----------|
| D1 | 角色权限 | 角色 × 可执行动作表 |
| D2 | 夹具 | 前置条件/测试数据准备表（可执行） |
| D3 | 主流程 | **逐步表**：角色、动作、API/UI 触点、期望状态/数据（非纯散文） |
| D4 | 分支异常 | ≥1 条主要失败/补偿路径（域极简单须注明「无分支」理由） |
| D5 | 状态机 | 状态 × 迁移 × 触发 × 守卫；建议附 mermaid |
| D6 | 规则可测 | 业务规则 Given/When/Then 表 |
| D7 | 场景包 | **Process Test Pack** 表：≥1 主路径 + ≥1 异常/非法迁移或权限；每行含断言与 API ID |
| D8 | 溯源 | 链到对应 `docs/api`（端点 ID）、必要 `docs/ui` / `docs/data` |

**不合格（直接 P1）**：

- 仅有「用户下单后支付」类段落，无步骤表/无 API 触点
- 有状态枚举无迁移与触发
- 无 Process Test Pack（或场景无法执行）
- 规则只写口号（「必须安全」）无可断言 Then

---

## 扫描时如何抽查（D1 / D3 lane）

1. 打开目标文档，用上表 A1–A8 / D1–D8 **逐项打勾**。
2. 任选 1 个端点：能否 3 分钟内在 Postman 发出去？不能 → A5 失败。
3. 任选 1 条 PT 场景：步骤是否引用得到真实 API ID / 路径？不能 → D7/D8 失败。
4. 与代码对账：路由数 ≈ 索引行数；状态枚举 ≈ 状态机行。

回传格式建议：

```text
### 可消费深度
- api `docs/api/foo.md`：A1✓ A2✓ A3✗ A4✓ A5✗ … → P1 缺网关与端点 Body
- domain `docs/domain/bar.md`：D1✓ … D7✗ → P1 无 Process Test Pack
```

---

## 写文档时的质量条（批量写）

- **禁止**为赶覆盖矩阵而生成「空壳必填节」（标题有、内容一行废话）。
- 未知字段写 `待确认` 并挂报告 P2，**不得编造**业务码或路径。
- 同批改接口：同步 Markdown + OpenAPI/Collection + domain 场景中的 API ID。
- stub 能力：不得写入 api/domain 当已交付；进 `docs/mock/`。

---

## 严重度速查

| 情况 | 级别 |
|------|------|
| 缺 api/domain 文件 | P1（宣称已交付且无契约可循 → P0） |
| 有文件但闸门多项失败（薄文档） | **P1 模板不合规 / 不可消费** |
| 文档示例与代码严重矛盾导致联调必失败 | P0/P1（视是否对外误导） |
| 有 OpenAPI 且 Markdown 仅缺网关节、有示例 | P1（补网关）或 P2（内网直连已声明） |
| Process Test Pack 只有主路径、无异常 | P2（域简单）/ P1（支付/履约等有补偿却未写） |
