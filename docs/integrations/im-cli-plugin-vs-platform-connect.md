# IM 投递：DeepTalk CLI 插件方案 vs VitalSpan 平台对接方案

| 字段 | 值 |
|------|-----|
| 状态 | 选型说明（非验收规格） |
| 日期 | 2026-08-30 |
| 关联 | [im-platform-connect.md](./im-platform-connect.md) · DeepTalk `plugins/lark` · `tencent-meeting` |

## 1. 问题从哪来

DeepTalk 飞书/腾讯会议插件采用 **bundled 官方 CLI + 本机用户 OAuth**，用户侧几乎不用填 AppKey/Secret、回调域名，体验上比 VitalSpan「平台对接 + 个人绑定」简单。

本文说明：**不是不想做简单，而是产品运行模型不同**；若强行照搬插件方案，无法满足 BI 定时报告「服务器无人值守、按人投递」的验收。

## 2. 两种方案一句话

| 方案 | 一句话 |
|------|--------|
| **A. CLI 插件（DeepTalk lark / tencent-meeting）** | 用户电脑上 Agent spawn CLI，用**当前扫码用户**的身份，在**对话当场**调厂商 API。 |
| **B. 平台对接（VitalSpan 现行）** | 服务器存**企业应用**凭证，用户 Web OAuth 写入**绑定表**，定时任务用**应用身份**向**指定成员**发工作通知。 |
| **C. 群 Webhook（VitalSpan 已有 env 路径）** | 向**固定群机器人 URL** POST JSON，无用户、无 OAuth，只能群发。 |

## 3. 能力对比表

| 维度 | A CLI 插件 | B 平台对接 | C 群 Webhook |
|------|------------|------------|--------------|
| 典型产品 | DeepTalk 对话助手 | VitalSpan 定时报告 | VitalSpan 群通知（辅） |
| 运行进程 | 用户桌面 Electron + Node | 服务器 FastAPI + 调度器 | 服务器 httpx POST |
| 鉴权载体 | 本机 `~/.lark` / `~/.tmeet` token | DB SM4 凭证 + `user_im_bindings` | env 里 webhook URL |
| 管理员配置 | 无（或仅装插件） | 回调域名 + App 凭证 | 群机器人 URL |
| 用户操作 | 扫码授权 CLI | 个人中心 OAuth 绑定 | 无 |
| 发送身份 | **扫码用户**（`as: user`） | **企业应用** | **群机器人** |
| 收件人 | Agent 搜姓名/群名，交互确认 | 调度收件人 + 绑定 userid | 群内所有人 |
| 凌晨 cron 无人值守 | ❌ | ✅ | ✅ |
| 多 BI 用户各自收自己的报告 | ❌（只有操作者 token） | ✅ | ❌（全员看群） |
| 管理员一键停用通道 | ❌ | ✅（清空 DB 忽略 env） | ✅（删 env） |
| 审计 / 多租户中心库 | ❌ | ✅ | 弱（仅群） |
| 配置「省事」程度 | 高（个人场景） | 低（企业平台） | 最高（仅群） |

## 4. 为什么不能把 A 原样搬进 VitalSpan

### 4.1 运行位置

```
DeepTalk:  用户 PC ──spawn──► lark-cli / tmeet ──HTTPS──► 飞书/腾讯 API
VitalSpan: 服务器 cron ──► im_sdk / httpx ──HTTPS──► 企微/钉钉/飞书 API
```

- 定时任务触发时**没有**用户桌面、**没有** Electron、**没有**本机 CLI。
- 即使在服务器上安装 `lark-cli`，token 也是**某一个运维账号**扫出来的，无法代表「调度里勾选的 50 个业务用户」。

### 4.2 身份模型

| | CLI 插件 | VitalSpan 工作通知 |
|--|----------|-------------------|
| Token 归属 | 本机当前用户 | 企业应用 access_token |
| 发 IM 的 API | 飞书：`im +messages-send` **as user** | 飞书：`im/v1/messages` **tenant + user_id** |
| 企微 | 用户 OAuth 场景不同 | `message/send` + 成员 UserId |
| 钉钉 | 用户 token 查 `/contact/users/me` | `asyncsend_v2` + **userid_list** |

厂商对「用户代发」与「应用工作通知」的 API、权限、可见范围**不是同一套**；DataEase 类「按人发报告」走的是**应用工作通知**，不是「张三用自己的号帮系统发」。

### 4.3 收件人解析

- **插件**：`contact +search-user --query "张三"` → Agent 消歧 → 一次发送。适合对话，不适合批量、不适合无人确认。
- **VitalSpan**：`user_im_bindings` 在 OAuth 回调时写入稳定 `user_id`；调度只读绑定表。适合 cron、可失败点名。

### 4.4 安全与合规

- CLI token 在用户磁盘，平台**无法**统一吊销、轮转、审计「谁改了凭证」。
- 政企交付通常要求：凭证 SM4 入库、管理面权限、清空即停发——插件模型不满足。

### 4.5 产品验收边界（已定）

`docs/integrations/im-platform-connect.md` · `docs/specs/im-app-config-self-bind.md`：

- **In**：三通道 gettoken、浏览器授权绑定、工作通知按人发。
- **Out**：群 webhook **当**按人投递；用 IM 登录 VitalSpan；CLI 在本机代服务器发。

## 5. 实现差异（架构级）

### 5.1 DeepTalk lark 插件（参考实现）

```
Agent
  ├─ lark_status      → detect @larksuite/cli, auth state
  ├─ lark_auth        → device-code OAuth → local token store
  └─ lark_run         → spawn CLI argv e.g. ["im","+messages-send",...]
```

- 依赖：`plugins/lark` + workspace `node_modules/@larksuite/cli`
- 配置：`LARK_CLI_PATH` / bundled `run.js`（可选）
- 无服务端 DB 绑定表；无企业应用 Secret 管理面

### 5.2 VitalSpan 平台对接（现行）

```
管理员 UI ──PUT──► platform_im_connect_configs (SM4)
                      │
探测/发信 ◄───────────┘ im_sdk.probe / feishu|dingtalk|wecom send
                      │
用户 UI ──OAuth──► im_oauth ──► user_im_bindings
                      │
调度 executor ──► work_notice.send_work_notices(account_ids)
```

- 后端：`backend/app/core/platform_config/` · `backend/app/auth/im_oauth/` · `backend/app/reports/scheduler/channels/`
- 前端：平台对接页、个人中心 `ImBindingsCard`
- 探测与发信同栈（SDK）；OAuth 单独 httpx

### 5.3 若强行做「VitalSpan 版 CLI 插件」需要什么

仅在 **DeepTalk × VitalSpan 一体**、且接受 **对话触发、非 cron** 时可考虑：

| 项 | 额外工作 |
|----|----------|
| 新插件 tools | 封装 `lark_run` 发报告链接（复用 deeptalk-plugins 模式） |
| 鉴权 | 仍为本机扫码，与 VitalSpan JWT 用户**无自动映射** |
| 定时报告 | **不能**替代 `work_notice`；最多「用户让 Agent 现在发一次」 |
| 部署 | 每客户端装 CLI + 插件，与服务器发信双轨 |

这不是简化平台对接，而是**第二条产品能力**，不减少 B 方案的必要性。

## 6. 群 Webhook 在其中的位置

VitalSpan **已实现** C 路径（`PUSH_*_WEBHOOK` + `notify_group`），与 B **并列**：

- `deliveryChannels: ["wecom"]` → 按人 `work_notice`（要 B）
- `notifyGroup: true` → 额外 POST 群 webhook（要 C）
- **禁止**：按人失败却用群成功冒充送达

若产品可接受「只发一个群」，应主推 C，而不是硬做 B。

## 7. 决策建议

| 产品目标 | 推荐方案 |
|----------|----------|
| 对标 DataEase：定时按人 IM | **B 平台对接**（现行） |
| 报告进固定群即可 | **C Webhook** + 简化 UI |
| DeepTalk 里口头「发给某某」 | **A 插件**（独立产品线） |
| 既要 cron 按人又要对话发 | **B + A 并存**，不互相替代 |

## 8. VitalSpan 待闭合项（与选型无关的缺口）

照搬插件简单体验前，应先闭合 B 方案产品链：

1. ~~个人中心 authorize 须带 Bearer~~ → **user_delegated** 下飞书改 device-code API（Bearer 发 POST）
2. ~~调度 UI 开放 IM 通道~~ → 已移除 `EMAIL_ONLY_DELIVERY` 硬编码，表单可选 IM
3. 钉钉绑定 userid 与 `asyncsend_v2` 对齐（仍属 corporate_app）

## 9. 方案 2：`user_delegated`（2026-08-30）

| 项 | 说明 |
|----|------|
| 配置 | `platform_im_connect_configs.delivery_mode=user_delegated`；飞书仅需 AppId/Secret |
| 绑定 | RFC 8628 device-code（`accounts.feishu.cn/oauth/v1/device_authorization`） |
| 发信 | 调度 **owner** 的 `user_access_token` → 收件人 `account_id` |
| 兼容 | `corporate_app` 保留；企微/钉钉 user_delegated 二期 |
| 迁移 | `0060_im_user_delegated_delivery.py` |

## 10. 参考路径

| 材料 | 路径 |
|------|------|
| VitalSpan IM 集成简报 | `docs/integrations/im-platform-connect.md` |
| DeepTalk lark 插件 | `deeptalk-plugins/plugins/lark/` |
| DeepTalk 腾讯会议插件 | `deeptalk-plugins/plugins/tencent-meeting/` |
| VitalSpan 发信调度 | `backend/app/reports/scheduler/channels/dispatch.py` |
