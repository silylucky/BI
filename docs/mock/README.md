# Mock / Stub 诚实清单

> **定位**：非测试主路径上的占位、探针与假成功能力；**禁止**在 [api/README.md](../api/README.md) 或 [services/](../services/) 中写成已交付正式能力。  
> 详细域边界见各 [services](../services/) 附录；本目录仅作**集中索引**。

| 文档 | 模块 | 级别 | 说明 |
|------|------|------|------|
| [nfr-push.md](./nfr-push.md) | `core/nfr/push_channels` | probe / 假投递 | 推送 mock；与报表调度 httpx 双轨 |
| [nfr-perf-probe.md](./nfr-perf-probe.md) | `core/nfr/dashboard_*` · `report_perf` | probe / 假 SLO | 首屏/SLA/可用性/报表性能硬编码探针 |
| [reports-scheduler.md](./reports-scheduler.md) | `reports/scheduler` | probe / 显式 header | 调度执行与投递 mock |
| [query-dataset.md](./query-dataset.md) | `query/dataset` | stub plan | Dataset execute-plan 非真实 SQL |
| [governance.md](./governance.md) | `metadata/physical` · `governance/bus` | stub / InMemory | 血缘占位 + 默认 InMemory 总线假注册 |

**启用原则**：须显式 env、HTTP header 或管理探针；默认客户路径不得静默 mock 成功。
