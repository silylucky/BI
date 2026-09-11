# Headless Automation Plan — ingestion/连接器类型归一化迁 pandas

> Plan type: Headless Automation Plan  
> Cursor Build: disabled  
> Execution trigger: dev-autopilot A5 plan-execute  
> Created: 2026-07-15

## 需求契约

- **goal**: 用 pandas 替代自研 `etl_rules` 行循环与分散的连接器类型映射
- **scope_include**: `etl_rules.py`、`type_normalize.py`、`relational_hints`、ES/OS/Mongo 类型映射、`pyproject.toml`、相关测试
- **scope_exclude**: `QueryExecutor`、Dashboard、Dataset 语义层
- **acceptance**: `pytest tests/test_etl_rules.py` + `tests/test_connectors_m7_r228.py` 类型段 + ingestion 相关测试通过

## 方案

1. 添加 `pandas` 依赖
2. 新建 `app/datasources/type_normalize.py` 集中原生类型 → BI 类型映射，并登记对应 pandas dtype
3. `etl_rules.apply_rules` 改为 DataFrame 管道（rename / astype+校验 / fillna / 布尔过滤），输出前 NaN→None
4. 连接器委托 `type_normalize`，保持对外函数签名不变

## 改动清单

| # | 文件 | 改动 |
|---|------|------|
| T1 | `backend/pyproject.toml` | 添加 `pandas>=2.2.0` |
| T2 | `backend/app/datasources/type_normalize.py` | 新建集中映射 |
| T3 | `backend/app/datasources/dialects/relational_hints.py` | 委托 type_normalize |
| T4 | ES/OS/Mongo dialect | 委托 type_normalize |
| T5 | `backend/app/ingestion/etl_rules.py` | pandas DataFrame 实现 |
| T6 | `tests/test_type_normalize.py` | 映射回归测试 |

## 验证

```bash
cd backend && pip install -e ".[dev]" && pytest ../tests/test_etl_rules.py ../tests/test_connectors_m7_r228.py -q
```

## 八维度自审

| 维度 | 评级 |
|------|------|
| 完整性 | 🟢 |
| 必要性 | 🟢 |
| 可验证性 | 🟢 |
| 风险 | 🟡 新依赖体积 |
