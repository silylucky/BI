# VitalSpan 生产就绪 / 产品体验评审 · 2026-09-01

## 总览

| 项 | 内容 |
|----|------|
| 范围 | PR·变更面：钉钉定时投递改为群机器人 `group_webhook`（主根 `platform_config` / `scheduler/channels` / 平台对接与调度 UI；上追 IM 绑定、delivery-health、smoke） |
| Stack Card | 见下 |
| 扫描方式 | 并行 lane L1–L5、L7、L8（explore）；`scan_tools: ast-grep+codegraph+rg`；L1 补漏 rg；L6 合理跳过 |
| 证据层 / 外部依赖 | 无 `.evidence/`（记 Blind spot）；仓外依赖：钉钉 `oapi.dingtalk.com/robot/send`；`contracts/im-platform-connect.smoke.py` 未覆盖该端点 |
| Blind spots | 无证据层；未对真实机器人 live POST；codegraph 有 1 个 pending 未 sync |
| P0 / P1 / P2 | 2 / 4 / 3 |
| 建议 | 修完 P0 再宣称生产就绪；主路径代码已闭环，探测与 smoke 未完成 |
| 回传 status | `BLOCKED`（P0 + 外部集成无 smoke 工件 + 无证据层） |
| 已排除非问题 | 测试双 mock httpx/SDK；默认超管 seed；`X-Rpt-*-Mock` 既有开发头；飞书 `user_delegated` 字段探测为邻域既有行为未升本批 P0；粘贴 webhook URL 非裸 JSON/路径表单 |

一句话结论：**产品主路径（贴 webhook → 保存 → 定时勾选钉钉 → POST 群）代码已接上，但未完成生产就绪**：探测只认 URL 形态就标「已就绪」，smoke 仍按 gettoken 且可对 webhook 伪 PASS；清空库配置后发信仍可能回落 env。

### Stack Card（摘要）

- 形态 / 语言 / 框架：VitalSpan monorepo；后端 FastAPI + SQLAlchemy + Alembic；前端 `fe/` React 19 + Vite
- 有无 SPA：有 Admin；标杆 UI：`EmailSmtpSlotForm` / `ConnectFormSection`
- 跳过的 lane：L6（本批无 Helm/CI 改动）
- 宣称材料 / 宣称客户端：Admin 平台对接 + 定时报告；`docs/automate/prd/F08-RPT.md` 已勾选钉钉群发；`docs/api/README.md` PUT IM 已实现
- `scan_tools`: ast-grep + codegraph + rg；无 `.evidence/`

## Blind spots / 未完成 lane

| Lane | 状态 | 未覆盖范围 | 说明 |
|------|------|------------|------|
| Phase 2.5 证据层 | 失败（仓内无层） | `.evidence/` | 无 gate-check 工件；不得据此写干净 |
| L8 真机 | 未跑 | 真实 `robot/send` | 静态确认有 httpx POST，无 live 回执 |
| L6 | 合理跳过 | IaC/CI | 本批未改交付编排 |
| codegraph | 部分 | pending 1 file 未 sync | 未单独用 callers 证 MISSING；路由已 rg 复核 |

**判定**：未扫到 ≠ 没问题。外部集成主路径缺 smoke/evidence → 总览不得写可上线；`status` 不得为 `DONE`。

## P0 Findings

### P0-1 · 钉钉群 webhook 探测仅校验 URL 即标已配置

| 字段 | 内容 |
|------|------|
| 类别 | 假绿·stub / 产品表面 |
| 证据 | `backend/app/reports/scheduler/channels/im_sdk/probe.py` — `group_webhook` 时 `is_configured`（`https://` + `oapi.dingtalk.com/robot/send`）即 `ok: True`，无 HTTP。`im_service.probe_im_credentials_bundle_from_payload` 保存门禁相同。FE：`ImDingtalkWebhookForm`「当前通道可用」、`ImChannelPickerCard`「已就绪」、`ImBindingsCard`「群发已就绪」、`SchedulePrecheckPanel` 绿灯。 |
| 为何致命 | 伪造/失效 token 也可保存成功并显示可用；失败推迟到定时执行。与 integrations 简报「探测须厂商成功码、禁 stub 标已配置」冲突。 |
| 建议修法 | 保存/探测走与发信相同的 `post_group_webhook`（短 text）；失败 `PLATFORM_IM_PROBE_FAILED`；UI 未真打过不得写「已就绪」。注意探测会进群，文案写明。 |
| 可批量 | 是（批次 A） |

### P0-2 · smoke 仍按 gettoken，webhook 可伪 PASS

| 字段 | 内容 |
|------|------|
| 类别 | 隐式假通 |
| 证据 | `contracts/im-platform-connect.smoke.py` 对任意 `probe_channel_credentials` ok 打印 `PASS {channel} gettoken (sdk)`；缺凭证提示仍是 `DINGTALK_APP_KEY`。env 仅 `PUSH_DINGTALK_WEBHOOK` 时 probe 格式过即 ok → smoke 可 PASS gettoken。仓内无 `.evidence/` live 工件。 |
| 为何致命 | PRD/API 已宣称钉钉群发已实现；验真脚本打错契约，易把「URL 像真的」当成对接成功。 |
| 建议修法 | smoke 钉钉改真 POST `robot/send`；文案与缺凭证提示改为 webhook；无凭据 SKIP/失败，禁止伪 PASS gettoken；有条件则留 `.evidence` 工件。 |
| 可批量 | 是（批次 A2） |

## P1 Findings

### P1-1 · 清空 DB 配置后发信仍回落 `PUSH_DINGTALK_WEBHOOK`

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 |
| 证据 | `dispatch.py` `_dingtalk_group_webhook_url`：creds 无 URL 时 `return settings.push_dingtalk_webhook`。`im_resolve` 在 `cleared` 时返回 empty（无 webhook），随后被该回落绕过。与「清空后忽略 env」SoR 冲突。 |
| 建议修法 | 存在 DB 行（含 cleared）禁止 env 回落；仅 `row is None` 才允许 bootstrap env。 |
| 可批量 | 是（批次 E） |

### P1-2 · 自定义机器人加签 / 关键词未接

| 字段 | 内容 |
|------|------|
| 类别 | 真实缺口 |
| 证据 | `group_webhook.py` 仅 POST JSON，无 HMAC `timestamp`/`sign`，凭证无 robot secret。默认「无安全设置」机器人可用；政企常开加签则全失败。 |
| 建议修法 | 管理面可选加签 Secret（SM4）；按钉钉文档拼 query；关键词写入产品说明或消息模板。非默认必炸，故不升 P0。 |
| 可批量 | 是（批次 A2，需产品是否一期做加签） |

### P1-3 · 首次保存可空点提交

| 字段 | 内容 |
|------|------|
| 类别 | 坏表单 |
| 证据 | `ImDingtalkWebhookForm.tsx` 保存按钮不因空 URL 禁用；仅后端 422。SMTP 表单有「首次保存必填」提示。 |
| 建议修法 | 无已保存且输入为空时禁用保存；必填标记。 |
| 可批量 | 是（批次 C） |

### P1-4 · 出站无重试/退避（有超时）

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 |
| 证据 | `group_webhook.py` `timeout=5.0` 单次 POST；`dispatch` `attempts: 1`。失败语义诚实（非假成功）。 |
| 建议修法 | 仅对超时/5xx/429 有限退避；业务 4xx 不重试；文档接受可能重复群消息。 |
| 可批量 | 是（批次 E） |

## P2 Findings

- 平台对接页头仍写「工作通知应用 / 个人中心绑定」，与钉钉群发及页脚矛盾（`PlatformConnectPage.tsx`）。
- 迁移 `0062` `except Exception: pass` 吞掉 drop constraint 失败，方言间可能残留旧 CHECK。
- 全步骤失败时 `dispatch` overall 仍为 `degraded` 而非 `failed`（既有语义，钉钉群发失败会被算进 degraded）。

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| 粘贴 webhook URL | 厂商 HTTPS 地址，非裸文件系统路径/JSON 主配置 |
| 发信 `httpx.post` | 调度路径真实，非 stub |
| 测试 mock `_send_group_webhook` | mock 的是出站依赖，被测仍是 `deliver_to_channels` 分支 |
| 钉钉不要求个人绑定 | 本批产品拍板 |
| 飞书 user_delegated 字段探测 | 邻域既有，非本批主因 |
| L6 | 本批无 IaC 变更 |

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 | Subagent 建议 |
|------|------------|------|----------------|
| A 探测真打 | P0-1 | S | 保存/probe 复用 `post_group_webhook`；失败不标 configured |
| A2 smoke + 加签裁定 | P0-2，可选 P1-2 | M | 改 smoke 契约；加签若一期不做则文档写清「须关加签」并降宣称 |
| C 表单 | P1-3 | S | 空保存禁用 |
| E SoR + 韧性 | P1-1、P1-4、P2 迁移/overall | S–M | 禁止 cleared 回落 env；可选重试 |
| F 文案 | P2 页头 | S | 对齐群发 |

**confirm**：回复要执行的批次（如「做 A+A2+E」或「全部 P0」）。确认前不改代码。

## 确认后 / auto 计划（预填）

1. 前置：probe 与 `im_service` 共用发送函数，避免双实现
2. 隔离：FE 表单 / smoke / dispatch SoR 文件集合无交集可并行
3. 后置：相关 pytest + vitest；有 webhook 再补 live smoke
