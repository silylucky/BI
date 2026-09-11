# 治理 / 元数据 Stub

| 字段 | 值 |
|------|-----|
| 模块 | `backend/app/metadata/physical/gov_refs.py` · `metadata/physical/service.py` · `governance/bus/adapter.py` |
| 域附录 | [services/governance.md](../services/governance.md) · [services/metadata.md](../services/metadata.md) |

## 行为

### 血缘 / 治理引用占位

- 物理表治理引用、血缘 API 部分字段标记 `"stub": true` 或 `lineage_stub`（空 upstream/downstream）。
- FE 治理页展示诚实横幅（未对接真实总线）；见 [ui/layout.md](../ui/layout.md) H1 治理导航隐藏说明。

### InMemory 总线（默认生产路径）

- `integration/bus_adapter_factory.py` 默认 `InMemoryBusAdapter`；`register` 返回 `status=succeeded` 与随机 `bus_id`，**无真实外部 ESB/MQ**。
- 目录发布 / `POST /gov/bus/*` / `POST /integration/bus/register` 在默认工厂下为进程内注册，非企业总线对接。
- 测试与 NFR probe 可 patch `InMemoryBusAdapter.register`；**非**仅 pytest 路径。

## 非问题

- 测试 fixture 与 Storybook demo 不要求列入本清单。
- 报表调度 mock 须显式 header，见 [reports-scheduler.md](./reports-scheduler.md)。

## 计划

真实 Bus HTTP 适配器配置化接入；默认无适配器时 API 返回 `deferred`/`unconfigured`，禁止对客户报 `succeeded`。
