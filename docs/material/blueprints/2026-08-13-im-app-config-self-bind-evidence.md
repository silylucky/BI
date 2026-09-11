# 证据袋 · IM 后台配置 + 自助绑定

- scope: `im-app-config-self-bind`
- scanned_at: 2026-08-13
- domain_strength: mixed
- mode: blueprint

## selection_constraints

| ID | topic | hard_reverse | status | evidence | blocks_flows | action |
|----|-------|--------------|--------|----------|--------------|--------|
| S1 | 发信应用凭证 SoR=管理面 DB（SM4）。从未保存才允许 env 回落；保存或清空后以库为准，清空=禁用且忽略 env | true | assumed | E3, E6, H1 | F1, F3 | assume |
| S2 | 认人：已登录用户授权跳转绑定，自动写入绑定表；不替代 JWT 登录；创建用户不会猜号 | true | assumed | E15, H2 | F2 | assume |
| S3 | 三厂商授权/发信契约不写死 URL；开工前 integration-research | true | assumed | H3 | F2 | assume |
| S4 | 定时投递仍走工作通知（按绑号发），未绑失败且不回落群 webhook | true | anchored | E2, E4, E5 | F3 | none |
| S5 | 应用 Secret 按凭证 SM4 加密，API 不回明文 | true | anchored | E2 ADR-06, E6 | F1 | none |

无 `open`。`assumed` 三项进假设清单，确认面前不得当已裁定交 spec。

## items

| ID | path | kind | note |
|----|------|------|------|
| E1 | docs/automate/goal.md | arch | 对标 DataEase/Superset；G3 展现全链路含报表调度 |
| E2 | docs/arch.md ADR-06 / ADR-19 / §7.2 | adr | 国密 SM4；按人 IM 投递；当前 WECOM_/DINGTALK_/FEISHU_* 仍登记为 env |
| E3 | .cursor/rules/production.mdc R6 | arch | 运行时业务配置进 DB + 管理面热改（分期）；禁 env 开关业务 |
| E4 | docs/automate/prd/F08-RPT.md RPT-005 | prd | 已实现按人 IM 投递 + user_im_bindings；管理员填号 |
| E5 | backend/app/reports/scheduler/channels/work_notice.py | code | 工作通知依赖 Settings 应用凭证；未配置则失败人话 |
| E6 | backend/app/auth/im_models.py · migrations/0047 | code | 绑号表 user_id+channel+account_id；无 bind_method、无应用配置表 |
| E7 | docs/automate/prd/F02-AUTH.md 账户自服务 · AUTH-008 | prd | GET/PATCH /me；个人中心已有；无 IM 绑定；敏感写须审计 |
| E8 | https://dataease.cn/docs/v2/xpack/platform_abutment/ | public | DataEase：系统设置「平台对接」填应用 + 个人信息绑定第三方；检索日 2026-08-13 |
| E9 | https://blog.fit2cloud.com/?p=4780 | public | DataEase v1.15：个人信息绑定三平台；另支持扫码登录（本蓝图有意不做登录替换） |
| E10 | docs/ui/layout.md · docs/ui/anchor.md | ui | 个人资料 `/admin/account/profile`；后台 `/admin/system` 配置向导；无「平台对接」页 |
| E11 | fe/src/pages/admin/system/users/UserImAccountsPanel.tsx | code | 管理员手填 userid；个人中心无对等入口 |
| E12 | fe/src/pages/admin/account/AccountProfilePage.tsx | code | 资料/邮箱编辑；无绑定按钮 |
| E13 | backend/app/auth/permissions/catalog.py | code | 无 system:settings；最近似 system:user.manage |
| E14 | docs/services/auth.md · docs/services/reports.md | domain | 绑号归 auth；发信归 reports；边界已写「管理员填写，非 OAuth」 |
| E15 | 对话意图 2026-08-13 | domain | 用户要「后台配一次 + 谁绑定就自动保存」；拒绝纯 env；拒绝用 OAuth 替代登录 |
| E16 | https://developer.work.weixin.qq.com/document/path/91119 | public | 企微网页授权可拿 UserId；领域席指出与「登录向 API」同族，蓝图不得把扫码当绑定主标签 |

## gaps

- 仓内无 `docs/integrations/` 企微/钉钉/飞书授权简报 → S3 assumed，禁止蓝图写死 token URL（G1）
- 无平台运行时配置表 → S1 新 SoR（H1）
- 无公开自助注册；用户由管理员创建 → 「注册自动填号」不成立（H2）
- LDAP/OIDC 登录 PRD 分期未实现 → 本 scope 不借登录拿 userid
