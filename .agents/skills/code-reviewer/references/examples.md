# Examples（执行样例）

供主 agent 对齐格式；真实评审按 [report-template.md](report-template.md) 出完整报告。

## 合并去重（L1 ∩ L7）

**Lane 原始**

- L1：`[P0] FORCE_STUB 探针假成功 — internal/probe/stub.go — flag 开启返回 connected:true — 删 stub`
- L7：`[P0] 集成页常驻假数据 — fe/src/pages/Integration.tsx — 菜单已挂且列表写死 — 接 API 或撤菜单`

**合并后（一条）**

```markdown
### P0-1 · 集成探测假绿（stub + 已挂入口）

| 字段 | 内容 |
|------|------|
| 类别 | 假绿·stub / 产品表面 |
| 证据 | `internal/probe/stub.go` — FORCE_STUB 返回 connected:true；`fe/src/pages/Integration.tsx` — 菜单可进且列表写死 |
| 为何致命 | 运维/用户以为外部系统已通 |
| 建议修法 | 删 stub 接真探测；页面接 API 或撤菜单与宣称 |
| 可批量 | 是（批次 A） |
```

## 宣称判据

| 事实 | 级别 |
|------|------|
| README 写「支持 SSO」，各端无入口 | P1 |
| 仅内部 issue 规划 SSO，无 README/UI 承诺、无入口 | P2 |
| 侧栏有「SSO」、页为 Skeleton 且无请求 | P0 |

## 报告总览片段

```markdown
| 项 | 内容 |
|----|------|
| 范围 | PR·变更面（主根：`services/bff`, `fe/src/pages/ops`；上追菜单） |
| 扫描方式 | 并行 lane：L1 L2 L3 L4 L7（subagent）；L5 跳过（本 PR 无 UI 壳变更）；L6 跳过（无 IaC diff） |
| 证据层 | 已读 `.evidence/`；`gate-check batch` FAIL（S2 用例数下降）→ 已转 P0-2 |
| Blind spots | L3：worker 子模块未 checkout，队列默认值未核 |
| P0 / P1 / P2 | 2 / 3 / 1 |
| 建议 | 暂缓（存在 Blind spot；且有未修 P0） |
| 回传 status | `BLOCKED`（盲区落在服务端主路径，「没发现更多 P0」不成立） |
```

## API 信封 + 文案（L9 ∩ L12）

**合并前**

- L9：`[P1] handler 直接返回 err.Error() — api/handler/order.go:88`
- L5：`[P1] 空态写「请指定 ci_id」— fe/src/pages/OrderList.tsx`

**合并后（不同根因，保留两条；若同一接口则 L9 优先）**

```markdown
### P1-3 · API 原始错误上屏

| 字段 | 内容 |
|------|------|
| 类别 | API 信封 / 错误暴露 |
| 证据 | `api/handler/order.go:88` — `ctx.JSON(500, err.Error())` |
| 建议修法 | 统一 `{code,message}`；SQL/堆栈仅写 server log |

### P1-4 · 空态文案非人话

| 字段 | 内容 |
|------|------|
| 类别 | 用户向文案 |
| 证据 | `fe/src/pages/OrderList.tsx` — 「请指定 ci_id」 |
| 建议修法 | 「请选择要查看的订单」；字段名不进主路径 |
```

## L11 性能 + HA（`ha_mode: claimed`）

**Lane 原始**

- L11：`[P0] 内存 session 却 replicas=3 — internal/auth/session.go + charts/app/values.yaml`
- L3：`[P1] 多实例部署会话不一致 — 同上`

**合并后（一条）**

```markdown
### P0-3 · 假 HA：内存会话 × 多副本

| 字段 | 内容 |
|------|------|
| 类别 | HA·可靠性 |
| 证据 | `internal/auth/session.go` — 进程内 map；`charts/app/values.yaml` — `replicas: 3`；arch 宣称高可用 |
| 为何致命 | 登录态随实例漂移；滚动发布踢登录 |
| 建议修法 | 共享会话存储，或 replicas=1 并改宣称 |
| 可批量 | 是（批次 G；契约不明则降宣称） |
```

**§17 单独例**：`[P1] 订单列表 FindAll 无分页 — api/order/list.go` → 类别 `性能热点`；禁止写「预估只能扛 100 QPS」而无锚点。