# NFR 推送通道 Mock

| 字段 | 值 |
|------|-----|
| 模块 | `backend/app/core/nfr/push_channels.py` |
| 关联 | `core/nfr/notifications.py` · `core/nfr/push_config.py` · `api/v1/nfr.py` · `governance/publish/notifications.py` |
| 域附录 | [services/nfr.md](../services/nfr.md) |

## 行为

- `dispatch_push_mock`：配置 `PUSH_DINGTALK_WEBHOOK` 后仅校验 URL 格式、写 `_PUSH_MOCK_LOG`，**不发起 HTTP**，仍返回 `delivered`。
- 治理发布通知（`governance/publish/notifications.py`）走同 mock 路径，审计可显示「已投递」但无外发。

## 双轨推送（勿混淆）

| 路径 | 行为 | 代码锚点 |
|------|------|----------|
| **NFR / 治理 mock** | 配置 webhook 仍不发 HTTP | `core/nfr/push_channels.py` |
| **报表调度真实投递** | 钉钉群机器人 / 飞书工作通知 | `reports/scheduler/channels/dispatch.py` |

同一环境变量名在两路径语义不同；联调与验收须区分调用面。

## 非 mock 路径

生产 SMTP 配置就绪且 `rpt_delivery_mode` 非 mock 时，报表调度投递走 `scheduler/delivery.py` 真实 SMTP（见 [reports-scheduler.md](./reports-scheduler.md)）。

## 计划

收敛为单一 HTTP 出站层，或 NFR 探针响应显式 `deliveryMode: mock`；未配通道返回 `failed`/`unconfigured`。
