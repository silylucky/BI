# VitalSpan 生产就绪 / 产品体验评审 · 2026-09-01

专项：**企业微信通道是否删除干净**（变更面，非整仓）。

## 总览

| 项 | 内容 |
|----|------|
| 范围 | PR·变更面：企微下线。主根 `backend/app/{core/platform_config,auth,reports/scheduler,api/v1,core/nfr}` · `fe/src` IM/调度/平台对接 · Alembic `0063`。上追：`docs/integrations/` · `docs/specs/` · `docs/arch.md` · `docs/api/` · `docs/services/` · NFR push-config |
| Stack Card | FastAPI + `fe/` React/Vite；平台元库 Alembic；IM 仓外：钉钉/飞书（企微 SDK 已删） |
| 扫描方式 | 并行 lane：L1 [残留代码](b86ffcaf-715d-4a0b-b575-1d0e6889740c) · L7 [活文档宣称](6ce3ea14-00c3-4872-aff3-59701914250c) · L8 [出站 HTTP](730aaf98-08f3-4d97-9ab9-c8c3681ad4c4)；主 agent rg 复核。`scan_tools: rg-only`（仓内有 `sgconfig.yml` / `.codegraph/`，本机 PATH 无 `ast-grep`/`codegraph`） |
| 证据层 / 外部依赖 | 无 `.evidence/`。企微出站：**无**。钉钉/飞书 smoke：`contracts/im-platform-connect.smoke.py` 仅这两通道 |
| Blind spots | 无证据层；未对 5173 做浏览器走查；未在本机跑 `alembic upgrade 0063` 验库 |
| P0 / P1 / P2 | 0 / 1 / 5 |
| 建议 | **运行时通道已撤干净**；合入前应修活文档宣称（P1）。不得写「文档侧已干净」 |
| 回传 status | `DONE_WITH_CONCERNS` |
| 已排除非问题 | 测试里 `delenv("PUSH_WECOM_WEBHOOK")`；历史 Alembic `0047`/`0057` CHECK 文案；`docs/superpowers/archive` · `docs/material` · 旧 feature-truth；调度对历史 `wecom` 的诚实 `skipped` |

一句话结论：**产品入口与发信路径已无企业微信；活集成简报/开工规格仍按「要配企微」写，删不干净的是文档与 NFR 字段名，不是还能发出去的代码。**

### Stack Card（摘要）

- 形态 / 语言 / 框架：单仓；后端 Python FastAPI；前端 `fe/` React 19 + Vite
- 有无 SPA：有；标杆：`fe/src/pages/admin/system/platform-connect/`
- 跳过的 lane：L4/L5（变更面已无企微表单/页）；L6（与本次删除无关）
- 宣称材料 / 宣称客户端：Admin `platform-connect` / 调度 / 个人中心；活文档 `docs/integrations/im-platform-connect.md`

## Blind spots / 未完成 lane

| Lane | 状态 | 未覆盖范围 | 说明 |
|------|------|------------|------|
| L1 结构性假绿 | 合理降级 | ast-grep CLI 未装 | 本批用 rg 对 wecom 词法全覆盖生产路径；不据此写「仓内零 stub」 |
| Phase 2.5 | 未消解（边缘） | `.evidence/` 不存在 | 按 skill 记盲区；不据此写可上线 |
| L7 真机 | 合理跳过 | 未开 5173 | FE 源码 + vitest 无企微选项；未截图 |
| L6 | 合理跳过 | IaC | 非本变更 |

## P0 Findings

无。无企微 SDK、无 gettoken、无「已送达」假成功。历史调度 `wecom` 走 `skipped` + 人话「已下线」。

## P1 Findings

### P1-1 · 活集成文档仍教配置企业微信

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 / 文档宣称漂移 |
| 证据 | `docs/integrations/im-platform-connect.md` §5/§7–§9 仍列企微 gettoken、Web 登录、`message/send`，并要求 `WECOM_CORP_ID`/`WECOM_SECRET`/`WECOM_AGENT_ID`。`docs/integrations/im-cli-plugin-vs-platform-connect.md` 仍写 `deliveryChannels: ["wecom"]` 与 `im_sdk…wecom send`。`docs/specs/im-app-config-self-bind.md` 顶栏已写下线，正文用户故事/验收仍绑定企微 |
| 为何致命 | 运维/Agent 按活简报会去建企微应用；与实现（仅钉钉+飞书）矛盾。标题已下线、正文未 scrub = 半成品文档 |
| 建议修法 | 三份活文档按现行通道重写：删企微 API 表与 `WECOM_*` 清单；CLI 对照文去掉 wecom 投递；规格正文与顶栏对齐 |
| 可批量 | 是（批次 A） |

## P2 Findings

- **P2-1** NFR `wecomConfigured` 恒 `false`：`backend/app/core/nfr/push_config.py` · `backend/app/api/v1/nfr.py`。OpenAPI 仍像有企微推送面。建议删字段或改 deprecated 注释（破坏性需评估客户端）。
- **P2-2** IM schema 死字段：`ImDeliveryConfigPut/Out.corpId`、`ImCredentials.corp_id`（已无 wecom 写入路径）。
- **P2-3** `backend/.env.example` L40 注释仍写「须与企微/钉钉开放平台登记一致」。
- **P2-4** 边角活文档：`docs/mock/nfr-perf-probe.md`「SMTP/企微 httpx」；`docs/services/designer.md` companion Out「企微通知」。
- **P2-5** SRS NFR-05 仍写「企微/钉钉消息推送」（`docs/srs/全生命周期系统需求规格说明书.md` · 附录 F）。属合同与实现偏离，改 SRS 需产品裁定，禁止当普通文案顺手改。

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| `dispatch.py` `channel=="wecom"` skip | 诚实失败语义，禁止当 stub 假绿 |
| Alembic `0047`/`0057` 含 wecom 的 CHECK | 历史 revision 不可改写；`0063` 收紧 |
| `tests/test_nfr_*` `PUSH_WECOM_WEBHOOK` pop/setenv | 测试双；settings 已无该字段，env 被 ignore |
| `PlatformConnectPage.smoke.test.tsx` `queryByText("企业微信")` | 断言通道已消失 |
| archive / material / 旧 truth-audit | 非现行运维真理 |
| 默认超管 seed | 与本次无关 |

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 | Subagent 建议 |
|------|------------|------|----------------|
| A 活文档 scrub | P1-1, P2-3, P2-4 | S | 只改 integrations/specs/mock/.env.example/designer；不动 SRS |
| B API 死字段 | P2-1, P2-2 | S | 删 `wecomConfigured`/`corpId` 或标废弃；需确认无外部客户端依赖 |
| C 合同 | P2-5 | — | 产品裁定后再改 `docs/srs/` |

请回复修哪些批次（A / A+B / 全部可修 / 不修）。确认前不改代码。

```yaml
status: DONE_WITH_CONCERNS
phase: code-reviewer
mode: review
fix_mode: confirm
scope: change_surface
report: docs/reviews/code-reviewer/2026-09-01-wecom-deletion-cleanliness.md
auto_fixed: []
remaining:
  - P2-5 SRS NFR-05 需产品裁定
coverage:
  blind_spots:
    - "Phase 2.5 | 无 .evidence/ | 仓内无证据层"
    - "L1 结构性 | ast-grep 未在 PATH | 已用 rg 覆盖 wecom 生产路径"
  evidence_read: false
external_deps:
  - {name: 企业微信, smoke: none, finding: ""}
  - {name: 钉钉群机器人, smoke: contracts/im-platform-connect.smoke.py, finding: ""}
  - {name: 飞书, smoke: contracts/im-platform-connect.smoke.py, finding: ""}
evidence:
  cr: ""
  gate_findings: []
blockers: []
```
