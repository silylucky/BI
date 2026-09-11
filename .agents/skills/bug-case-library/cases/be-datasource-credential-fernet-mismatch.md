# 看板图表 invalid encrypted credential（Fernet 密钥与库内密文不一致）

## 症状

- 看板编辑页多数图表显示 `invalid encrypted credential`，`POST /api/v1/query/dataset/execute` 返回 500
- 切换暗色主题后画布已变深，但组件内仍是错误态浅色底

## 根因

1. `data_sources.password_encrypted` 由历史 `CREDENTIAL_FERNET_KEY` 加密；本地 `.env` 轮换密钥后 `decrypt_credential` 抛 `CredentialDecryptError`
2. `QueryExecutor._connector_kwargs` 将其映射为 500 `CREDENTIAL_DECRYPT_FAILED`，前端原样展示英文 message

## 修复

- `backend/app/datasources/dev_credential_repair.py`：development 启动时检测无法解密的样例源（compose `sample`/`vitalspan` 口令），用当前密钥重加密
- `backend/app/main.py` `_warm_meta_database` 开发环境调用 `repair_dev_datasource_credentials`
- `fe/src/components/charts/useChartExecute.ts`：`CREDENTIAL_DECRYPT_FAILED` 中文提示
- 暗色主题：图表错误态/查询控件/待配置 Badge 在看板作用域内强制深色

## 预防

- 轮换 `CREDENTIAL_FERNET_KEY` 时设置 `CREDENTIAL_FERNET_KEY_PREVIOUS` 或重保存数据源密码
- 开发环境依赖 compose 样例源时，重启后端触发 dev repair

## 锚点

- `backend/app/datasources/dev_credential_repair.py`
- `backend/app/datasources/credentials.py`
- `backend/app/query/executor.py`
- `tests/test_datasources_dev_credential_repair.py`
