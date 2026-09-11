# nfr — 非功能横切

| 字段 | 值 |
|------|-----|
| 模块路径 | `backend/app/core/nfr/` |
| PRD | [F15-NFR](../automate/prd/F15-NFR.md) |
| 里程碑 | 横切（L1 kickoff r46） |
| 状态 | **部分（L1 + r51 companion）** |

## 职责

- NFR-005：连接器插件扩展点声明与 `register_connector_plugin` 登记钩子
- NFR-006：浏览器/消息推送配置契约与 `resolve_push_mode` 降级守卫
- NFR-007：信创国产化合规检查清单与 strict 模式守卫
- 国密应用层：`core/crypto/`（SM4 凭证 + SM3 登录密码 + SM2 JWT，见 ADR-06/16/17）

## 边界

| In | Out |
|----|-----|
| 扩展点元数据、推送/信创 env 配置面、合规报告 domain 逻辑 | HTTP 路由（→ `api/v1/nfr.py` entry） |
| `register_connector_plugin` 薄包装 `register_dialect` | 修改 `ConnectorRegistry` 核心（零侵入） |
| `browser_matrix` / `push_channels` mock 降级链 / `probe_compliance_non_blocking` | 真实 WebPush SDK HTTP 发送 |
| `describe_registration_path` / `probe_registry` companion | Admin UI 配置界面 |

## 依赖

- `core/config`：`PUSH_*` webhook、`CREDENTIAL_SM4_KEY` 等密钥/连接 env（**无** `XINCHUANG_MODE` / `NFR08_RUNTIME_MODE` 类产品开关）
- `core/crypto/`：SM4 凭证加解密、SM3 密码哈希、SM2 JWT 签名
- `datasources/registry`：`register_dialect`、类型清单（信创连接器探测）
- `governance/publish/errors`：GOV 发布错误码常量集中出口（`core/nfr/errors.py`）

## 主要类型 / 入口

| 符号 | 说明 | PRD | 状态 |
|------|------|-----|------|
| `PLUGIN_EXTENSION_POINTS` | 冻结扩展点清单 | NFR-005 | 已实现 L1 |
| `register_connector_plugin()` | 插件路径登记 + `registered_via=plugin` 元数据 | NFR-005 | 已实现 L1 |
| `resolve_push_mode()` / `PushConfigOut` | 推送 deliveryMode disabled/degraded/active | NFR-006 | 已实现 L1 |
| `probe_browser_support()` / `dispatch_push_mock()` | 浏览器矩阵 UA 探测 + 推送 mock 降级链 | NFR-006 | 已实现 companion |
| `build_compliance_report()` / `assert_xinchuang_compliant()` | 信创合规清单与 strict 守卫 | NFR-007 | 已实现 L1 |
| `enumerate_non_compliant()` / `probe_compliance_non_blocking()` | fail 项 remediation + 非阻塞 probe | NFR-007 | 已实现 companion |
| `describe_registration_path()` / `probe_registry()` | CONN-019 登记路径 + registry 探测 | NFR-005 | 已实现 companion |
| `GET /api/v1/nfr/*` | 横切只读/守卫 REST | NFR-005/006/007 | 已实现 L1 + companion |

## 关联 API

见 [api/README.md](../api/README.md) §NFR 横切。

## 实现笔记

- r46：`core/nfr/` 五文件（errors、plugin_extension、push_config、xinchuang）；`gbase` 经 `register_connector_plugin` 登记演练扩展点路径
- r51 companion：`browser_matrix.py` / `push_channels.py`；信创 remediation + 非阻塞 probe；`describe_registration_path` + registry probe；内存 `_PUSH_MOCK_LOG` 非生产持久化
- 推送 webhook 仅返回 configured 布尔，不泄露 URL 明文
- 信创合规始终 strict；平台元库须为 postgresql / mysql / sqlite 协议之一，否则 422 `XINCHUANG_NON_COMPLIANT`
