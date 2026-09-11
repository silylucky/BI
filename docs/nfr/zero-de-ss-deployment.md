# 零第三方 BI 部署验收（NFR-008）

## 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/nfr/runtime-compliance/deployment-report` | JSON 部署验收报告 |
| GET | `/api/v1/nfr/runtime-compliance/deployment-report?format=markdown` | Markdown 运维报告 |
| POST | `/api/v1/nfr/runtime-compliance/assert` | strict 模式阻断（503 `NFR_RUNTIME_VIOLATION`） |

## 环境变量

| 变量 | 值 | 说明 |
|------|-----|------|
| 门禁 | 始终 strict | runtime 或 compose 违规 → `rejected` / assert 503 |

> 本项目不提供 `NFR08_RUNTIME_MODE` 等运行时功能开关。

## Compose 禁入规则

解析仓库根 `docker-compose.yml` 服务名与 `image:` 行；命中以下子串（大小写不敏感）记入 `forbiddenComposeHits`：

- `superset`
- `dataease`
- `apache-superset`

## goal §5 对账

| 指标 | 探针 |
|------|------|
| 生产部署无 Superset/DataEase 容器 | `composeServices` + `forbiddenComposeHits` |
| 运行时无第三方 BI 模块 | `runtime.zeroThirdPartyBiRuntime` |
| CI 可执行 | `tests/test_mfinal_ff_fg_batch1_r249.py` `T-NFR-R249-008-*` |

## pytest

```bash
cd backend && python -m pytest tests/test_mfinal_ff_fg_batch1_r249.py -k "008" -v
```
