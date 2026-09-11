# Headless Automation Plan · IM 方案 2（用户委托投递）

| 字段 | 值 |
|------|-----|
| Plan type | Headless Automation Plan |
| Cursor Build | disabled |
| Execution trigger | dev-autopilot A5 plan-execute |
| 日期 | 2026-08-30 |
| 状态 | 已完成 |

## 1. 需求契约（来自会话 + dev-autopilot）

| 字段 | 值 |
|------|------|
| request | 将 IM 定时投递从方案 1（企业应用工作通知）改为方案 2（用户委托发信），规避备案回调域名与重型企业应用审批 |
| type | feature |
| goal | 用户扫码/device-code 绑定并加密存 refresh_token；定时任务以**调度 owner** 身份向已绑定收件人发 IM；平台对接仅需 OAuth 客户端凭证 |
| scope_include | `im_delivery_mode`、飞书 device-code 绑定、user_access_token 发信、调度 executor 传 owner、个人中心/平台对接 UI、测试 |
| scope_exclude | .spawn 厂商 CLI；企微/钉钉 user_delegated（二期）；多租户 tenant_id 分片；改 PRD 分期里程碑 |
| acceptance | `pytest tests/test_im_user_delegated*.py -q` 绿；`user_delegated` 模式下保存平台对接无需 callback_domain；绑定后可 `deliverable`；调度发信走 owner token |
| risk_level | medium |
| autonomy_policy | auto_accept_low_risk |

### 产品语义（方案 2 定稿）

- **发送方**：调度 `owner_id` 对应 VitalSpan 用户（须已绑定且含有效 user refresh_token）。
- **接收方**：调度收件人解析出的 `user_im_bindings.account_id`（仅需账号，不需各自 token）。
- **平台配置**：`delivery_mode=user_delegated` 时仅校验 OAuth `app_id/app_secret`（飞书），**不要求**回调域名、不要求 corp gettoken 探测。
- **绑定**：飞书 device-code（展示 verification_url，轮询 complete），落库 `account_id` + SM4(`refresh_token`)。
- **兼容**：保留 `corporate_app` 模式（现行工作通知），由 `platform_im_connect_configs.delivery_mode` 切换。

## 2. 整体方案（3–5 句）

在 `platform_im_connect_configs` 增加 `delivery_mode`。`user_delegated` 下简化管理面表单与探测；个人中心改为 device-code 绑定并保存用户 refresh_token。`work_notice` 按 mode 分支：企业应用走现有 SDK；用户委托走 httpx + user_access_token 调飞书发消息 API。调度执行时将 `owner_id` 传入 dispatch，解析 owner 的 token 发信。首期仅飞书 user_delegated 真链路；企微/钉钉在 user_delegated 下返回明确「暂不支持」。

## 3. 关键决策

| 决策 | 选择 | 未选 |
|------|------|------|
| 方案 2 绑定 | device-code（无 redirect 备案） | Web OAuth redirect（方案 1 同源问题） |
| 发信身份 | 调度 owner 的 user token | 每人各自 token 互发（N×N 运维） |
| 首期通道 | 飞书 | 三通道同期（工期） |
| 与方案 1 | 模式开关共存 | 删除 corporate_app |
| CLI | 不引入 | spawn lark-cli |

## 4. 非目标

- DeepTalk 插件形态、本机 CLI
- 群 webhook 冒充按人投递
- 真·多租户 SaaS 租户级 IM 配置分片

## 5. 改动清单

### T1 数据与配置

- `0060_im_user_delegated_delivery.py`：`delivery_mode`；`user_im_bindings.token_encrypted` / `token_expires_at`
- `PlatformImConnectConfig`、`UserImBinding` 模型
- `im_service`：`user_delegated` 校验/探测/输出

### T2 飞书 device-code

- `app/auth/im_oauth/device_code/feishu.py`：start / poll complete
- API：`POST /me/im-bindings/feishu/device-auth/start`，`POST .../complete`

### T3 发信

- `im_user_token.py`：解密 refresh、刷新 access_token
- `im_sdk/feishu_user.py`：`send_feishu_text_as_user`
- `work_notice.py` + `dispatch.py` + `executor.py`：传 `owner_id`，按 mode 分支

### T4 前端

- `ImBindingsCard`：device-code UI（展示链接/轮询）
- `ImChannelForm`：delivery_mode + 简化字段
- `scheduleFormUtils`：开放 IM 通道选择

### T5 测试与文档

- `tests/test_im_user_delegated.py`
- 更新 `docs/integrations/im-cli-plugin-vs-platform-connect.md` §分期

## 6. 八维度自审（摘要）

| 维度 | 评级 |
|------|------|
| 完整性 | 🟢 |
| 可验证性 | 🟢 |
| 必要性 | 🟢 |
| 副作用 | 🟡 双模式并存需文档说明 |
| 可回退 | 🟢 migration downgrade |

## 7. 整体验证

```bash
cd backend && pytest ../tests/test_im_user_delegated.py ../tests/test_im_config_service.py ../tests/test_me_im_bindings.py -q
cd fe && pnpm exec vitest run src/pages/admin/account/components --passWithNoTests
```

## 8. 执行顺序

T1 → T2 → T3 → T4 → T5
