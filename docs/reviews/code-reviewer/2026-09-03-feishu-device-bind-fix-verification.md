# VitalSpan 生产就绪评审 · 2026-09-03

## 总览

| 项 | 内容 |
|----|------|
| 范围 | PR·变更面：飞书 `user_delegated` device-code 绑定修复（前端 `ImBindingsCard` · 后端 `device_code/feishu.py` · ORM/迁移 `0064` · 单测） |
| Stack Card | 后端 FastAPI + SQLAlchemy + Alembic + httpx；前端 React 19 + TanStack Query；元库 PostgreSQL（本机已升 0064） |
| scan_tools | `rg-only`（无 ast-grep / codegraph） |
| 扫描方式 | 主 agent 串行 lane：L1/L3/L7/L8（变更面）；L4/L5/L6 合理跳过 |
| 证据层 / 外部依赖 | 无 `.evidence/`；`contracts/im-platform-connect.smoke.py` 仅探测 gettoken，**不含** device-code 全链路 |
| Blind spots | L8：无飞书 device-code 真打 smoke；前端无 E2E/组件测；L1 结构性假绿依赖词法 |
| P0 / P1 / P2 | 0 / 2 / 3 |
| 建议 | **本轮三处根因已修完**；合入前补 P1 集成测 + 确认各环境 `alembic upgrade head` 至 **0064** |
| 回传 status | `DONE_WITH_CONCERNS` |
| 已排除非问题 | 默认超管 seed；单测 mock 外部 httpx 依赖（边界 fake）；无 IaC 跳过 L6 |

一句话结论：**用户报告的「不跳转 / 轮询失败 / 500」三条链路在代码层均已对症修复；当前无未修 P0，但单测 mock 掉 DB 写入导致同类 CHECK 约束回归仍可能漏检，且其它环境未跑迁移会复现 500。**

### Stack Card（摘要）

- 形态：单体 FastAPI + `fe/` SPA
- 变更锚点：
  - `fe/src/pages/admin/account/components/ImBindingsCard.tsx`
  - `backend/app/auth/im_oauth/device_code/feishu.py`
  - `backend/app/auth/im_models.py`
  - `backend/migrations/versions/0064_user_im_bindings_source_device_scan.py`
  - `tests/test_im_user_delegated.py`
- 跳过的 lane：L4/L5（本批无新表单/风格）；L6（无 CI/IaC 变更）

## 修复对账（用户问题 → 代码）

| 现象 | 根因 | 修复状态 | 证据 |
|------|------|----------|------|
| 新标签停在 `about:blank` | `window.open(..., noopener)` 无窗口引用 | ✅ 已修 | `openPendingAuthTab` + `navigateAuthTab` |
| 轮询很快停 / 飞书 token 400 | 轮询用 JSON 而非 `x-www-form-urlencoded` | ✅ 已修 | `poll_feishu_device_token` 改 `data=` + Content-Type |
| `device-auth/complete` 500 | `source='device'` 违反 `ck_user_im_bindings_source` | ✅ 已修 | ORM + Alembic `0064`；本机已 `upgrade head` |
| 重复 complete 请求 | 多轮询未清理 | ✅ 已修 | `devicePollSessionRef` + `clearDevicePollTimer` |

## Blind spots / 未完成 lane

| Lane | 状态 | 未覆盖范围 | 说明 |
|------|------|------------|------|
| L8 | 合理跳过 | 飞书 device-code 授权→落库全链路 | smoke 仅 gettoken；需真实 AppId + 人工浏览器 |
| L7 | 已扫变更面 | 浏览器真机 E2E | 未跑 browser-reviewer |
| L1 | rg-only | 结构性 stub | 无 ast-grep，词法漏报风险保留 |

## P0 Findings

（无）

## P1 Findings

### P1-1 · device-auth 完成路径单测 mock 掉 DB 写入

| 字段 | 内容 |
|------|------|
| 类别 | 假绿·测试 |
| 证据 | `tests/test_im_user_delegated.py` — `test_device_auth_complete_binds_user` patch `upsert_device_binding`，未触达 `user_im_bindings` INSERT |
| 为何严重 | 本次 500 正是 CHECK 约束与 ORM 不一致；同类回归单测无法拦截 |
| 建议修法 | 增 API/集成测：`POST .../device-auth/complete` 在 mock `poll_feishu_device_token` 返回 token 后，断言 DB 行 `source=device` 写入成功（SQLite/Postgres fixture） |
| 可批量 | 是（批次 A） |

### P1-2 · 迁移 0064 为运行时硬依赖

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 |
| 证据 | 终端 `IntegrityError: ck_user_im_bindings_source`；`0061` 仍登记 `oauth/admin` only |
| 为何严重 | 演示/CI/同事库若 head&lt;0064，绑定必 500 |
| 建议修法 | 部署清单写明 `alembic upgrade head`；CI 迁移门禁；README/启动脚本加 head 校验（可选） |
| 可批量 | 是（批次 E） |

## P2 Findings

- **P2-1** `fe/src/lib/apiError.ts` 无 `IM_DEVICE_*` / `IM_BINDING_*` 映射，绑定失败常显示泛化文案（`docs/reviews` 非阻塞）。
- **P2-2** `docs/services/auth.md` 未登记 `0064` / `source=device|scan` 与 device-code 绑定语义（`docs/data/README.md` 已更新）。
- **P2-3** `ImBindingsCard` 无组件/冒烟测，弹窗与轮询逻辑仅靠人工回归。

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| `poll_feishu_device_token` 单测 mock httpx | 测适配器契约，属边界 fake |
| `0061` 迁移文件仍写旧 CHECK | 历史修订；由 `0064` 覆盖，无需改旧文件 |
| 预开 `about:blank` 标签 | 规避弹窗拦截的常规模式；已 `popup.opener = null` |

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 | 说明 |
|------|------------|------|------|
| A 测试补强 | P1-1 | S | 一条集成测覆盖 `source=device` INSERT |
| E 交付门禁 | P1-2 | S | 文档/CI 强调 head=0064 |
| F 体验/文档 | P2-1～P2-3 | S | 可选 |

## 集成研究建议

（无 — 飞书 OAuth 契约已在 `docs/integrations/im-platform-connect.md` 与 `device_code/feishu.py` 对齐，本轮为实现/迁移缺陷而非协议不明。）

---

```yaml
status: DONE_WITH_CONCERNS
phase: code-reviewer
mode: review
fix_mode: confirm
scope: change_surface
report: docs/reviews/code-reviewer/2026-09-03-feishu-device-bind-fix-verification.md
auto_fixed: []
remaining:
  - P1-1（建议补集成测）
  - P1-2（非本机环境确认 alembic head=0064）
coverage:
  blind_spots:
    - "L8 | 飞书 device-code 全链路真打 | smoke 仅 gettoken"
    - "L1 | 结构性假绿 | rg-only"
  evidence_read: false
external_deps:
  - name: feishu-device-oauth
    smoke: contracts/im-platform-connect.smoke.py（仅 gettoken）
    finding: ""
evidence:
  cr: ""
  gate_findings: []
blockers: []
```
