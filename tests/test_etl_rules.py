import pytest

from app.ingestion.etl_rules import apply_rules

DIRTY_ROWS = [
    {"product_name": "A", "amount": "12.5", "status": "active", "note": None},
    {"product_name": "B", "amount": "x", "status": "deleted", "note": "x"},
]

RULES = [
    {"type": "rename_column", "from": "product_name", "to": "product"},
    {"type": "cast_type", "column": "amount", "to": "float"},
    {"type": "fill_null", "column": "note", "value": "无备注"},
    {"type": "filter_rows", "column": "status", "op": "ne", "value": "deleted"},
]


def test_apply_rules_renames_casts_fills_and_filters():
    result = apply_rules(DIRTY_ROWS, RULES)
    assert len(result) == 1
    row = result[0]
    assert row["product"] == "A"
    assert row["amount"] == 12.5
    assert row["note"] == "无备注"
    assert "product_name" not in row


def test_cast_type_invalid_becomes_none():
    rows = [{"amount": "bad"}]
    rules = [{"type": "cast_type", "column": "amount", "to": "float"}]
    assert apply_rules(rows, rules)[0]["amount"] is None


DIRTY_ORDERS_SUBSET = [
    {"product_name": "Widget A", "amount": "12.5", "status": "active", "note": None},
    {"product_name": "Widget B", "amount": "not-a-number", "status": "active", "note": "脏金额"},
    {"product_name": "Widget C", "amount": "99", "status": "deleted", "note": "应过滤"},
    {"product_name": "Widget D", "amount": "0", "status": "active", "note": None},
]

L1_RULE_CHAIN = [
    {"type": "rename_column", "from": "product_name", "to": "product"},
    {"type": "cast_type", "column": "amount", "to": "float"},
    {"type": "fill_null", "column": "note", "value": "无备注"},
    {"type": "filter_rows", "column": "status", "op": "ne", "value": "deleted"},
]


def test_rename_column_only():
    rows = [{"a": 1, "b": 2}]
    rules = [{"type": "rename_column", "from": "a", "to": "x"}]
    result = apply_rules(rows, rules)
    assert result[0]["x"] == 1
    assert "a" not in result[0]


def test_cast_type_integer():
    rows = [{"amount": "42.0"}]
    rules = [{"type": "cast_type", "column": "amount", "to": "integer"}]
    assert apply_rules(rows, rules)[0]["amount"] == 42


def test_fill_null_only():
    rows = [{"note": None}, {"note": ""}]
    rules = [{"type": "fill_null", "column": "note", "value": "无备注"}]
    result = apply_rules(rows, rules)
    assert result[0]["note"] == "无备注"
    assert result[1]["note"] == "无备注"


def test_filter_rows_eq():
    rows = [{"status": "active"}, {"status": "deleted"}]
    rules = [{"type": "filter_rows", "column": "status", "op": "eq", "value": "active"}]
    assert len(apply_rules(rows, rules)) == 1


def test_filter_rows_is_null():
    rows = [{"note": None}, {"note": ""}, {"note": "ok"}]
    rules = [{"type": "filter_rows", "column": "note", "op": "is_null", "value": None}]
    assert len(apply_rules(rows, rules)) == 2


def test_rule_chain_dirty_orders_subset():
    result = apply_rules(DIRTY_ORDERS_SUBSET, L1_RULE_CHAIN)
    assert len(result) == 3
    widget_a = next(r for r in result if r["product"] == "Widget A")
    assert widget_a["note"] == "无备注"
    assert widget_a["amount"] == 12.5
    widget_b = next(r for r in result if r["product"] == "Widget B")
    assert widget_b["amount"] is None
    assert all(r["product"] != "Widget C" for r in result)


def test_unknown_rule_type_is_ignored():
    """T-ETL-05: 未知 type 不抛异常，行不变。"""
    rows = [{"a": 1, "b": 2}]
    rules = [{"type": "drop_table", "table": "users"}]
    assert apply_rules(rows, rules) == [{"a": 1, "b": 2}]


def test_rename_column_missing_from_key_no_crash():
    """T-ETL-06: 缺必填键（无 from）不崩溃。"""
    rows = [{"a": 1}]
    rules = [{"type": "rename_column", "to": "x"}]
    assert apply_rules(rows, rules) == [{"a": 1}]


def test_cast_type_boolean():
    """T-ETL-07: cast_type → boolean。"""
    rows = [{"flag": "true"}, {"flag": "no"}, {"flag": "1"}]
    rules = [{"type": "cast_type", "column": "flag", "to": "boolean"}]
    result = apply_rules(rows, rules)
    assert result[0]["flag"] is True
    assert result[1]["flag"] is False
    assert result[2]["flag"] is True


def test_cast_type_integer_overflow_becomes_none():
    """T-ETL-07: 超大整数 → None（记录现状）。"""
    rows = [{"n": "999999999999999999999999999999999"}]
    rules = [{"type": "cast_type", "column": "n", "to": "integer"}]
    assert apply_rules(rows, rules)[0]["n"] is None


def test_filter_rows_is_not_null():
    """T-ETL-04: filter_rows is_not_null。"""
    rows = [{"note": None}, {"note": ""}, {"note": "ok"}]
    rules = [{"type": "filter_rows", "column": "note", "op": "is_not_null", "value": None}]
    assert len(apply_rules(rows, rules)) == 1
    assert apply_rules(rows, rules)[0]["note"] == "ok"


def test_malicious_nested_json_rule_value_no_crash():
    """T-ETL-05/06: 恶意嵌套 JSON 作 filter value 不崩溃。"""
    rows = [{"a": 1}, {"a": 2}]
    nested = {"level": {"deep": [{"x": 1}]}}
    rules = [{"type": "filter_rows", "column": "a", "op": "eq", "value": nested}]
    result = apply_rules(rows, rules)
    assert result == []


def test_filter_rows_unknown_op_drops_rows():
    """T-ETL-09: filter_rows 未知 op 剔除全部行，避免静默放行。"""
    rows = [{"status": "active"}]
    rules = [{"type": "filter_rows", "column": "status", "op": "regex", "value": "active"}]
    assert apply_rules(rows, rules) == []


def test_cast_type_unknown_to_falls_back_to_str():
    """T-ETL-10: cast_type 未知 to 回退 str()。"""
    rows = [{"amount": 42}]
    rules = [{"type": "cast_type", "column": "amount", "to": "decimal"}]
    assert apply_rules(rows, rules)[0]["amount"] == "42"


def test_empty_rules_chain_preserves_rows_without_profile_triggers():
    """无 status/字符串列时，空规则链 + 默认 profile 不改变简单数值行。"""
    rows = [{"a": 1}, {"a": 2}]
    assert apply_rules(rows, []) == [{"a": 1}, {"a": 2}]


def test_auto_profile_filters_deleted_status_with_empty_rules():
    rows = [{"status": "active"}, {"status": "deleted"}]
    assert len(apply_rules(rows, [])) == 1


def test_auto_profile_coerces_numeric_strings_with_empty_rules():
    rows = [{"amount": "12.5"}, {"amount": "3"}]
    result = apply_rules(rows, [])
    assert result[0]["amount"] == 12.5
    assert result[1]["amount"] == 3.0


import time


DEEP_RULE_CHAIN = [
    *L1_RULE_CHAIN,
    {"type": "filter_rows", "column": "amount", "op": "is_not_null", "value": None},
    {"type": "rename_column", "from": "note", "to": "remark"},
]


def test_deep_six_rule_chain_perf_under_300ms():
    """T-ETL-13: 6 规则深链在 DIRTY_ORDERS_SUBSET 上 <0.3s。"""
    start = time.perf_counter()
    result = apply_rules(DIRTY_ORDERS_SUBSET, DEEP_RULE_CHAIN)
    elapsed = time.perf_counter() - start
    assert len(result) >= 1
    assert elapsed < 0.3


def test_five_hundred_noop_rename_rules_under_one_second():
    """T-ETL-16: 500 条 noop rename 规则不挂起且行数不变。"""
    rows = [{"col_a": f"v{i}", "col_b": i} for i in range(50)]
    rules = [{"type": "rename_column", "from": "missing_col", "to": "missing_col2"} for _ in range(500)]
    start = time.perf_counter()
    result = apply_rules(rows, rules)
    elapsed = time.perf_counter() - start
    assert len(result) == len(rows)
    assert elapsed < 1.0


EIGHT_RULE_CHAIN = [
    *DEEP_RULE_CHAIN,
    {"type": "rename_column", "from": "remark", "to": "remark_copy"},
    {"type": "filter_rows", "column": "status", "op": "ne", "value": "deleted"},
]


def test_eight_rule_chain_100_rows_under_400ms():
    """T-ETL-17: 8 规则深链在 100 行上 <0.4s。"""
    rows = [
        {
            "product_name": f"Item{i}",
            "amount": str(i),
            "status": "active",
            "note": None if i % 2 else f"n{i}",
        }
        for i in range(100)
    ]
    start = time.perf_counter()
    result = apply_rules(rows, EIGHT_RULE_CHAIN)
    elapsed = time.perf_counter() - start
    assert len(result) >= 1
    assert elapsed < 0.4


def test_dirty_cast_null_observable_with_fill_null():
    """T-ETL-18: amount='not-a-number' cast 失败变 None；fill_null 补默认；行保留。"""
    rows = [{"amount": "not-a-number", "note": None, "status": "active"}]
    rules = [
        {"type": "cast_type", "column": "amount", "to": "float"},
        {"type": "fill_null", "column": "note", "value": "默认备注"},
    ]
    result = apply_rules(rows, rules)
    assert len(result) == 1
    assert result[0]["amount"] is None
    assert result[0]["note"] == "默认备注"


def test_rename_column_chain_deterministic_last_wins():
    """T-ETL-20: 同列双 rename_column 顺序应用 → 最终列 sku。"""
    rows = [{"product_name": "Widget", "amount": "1"}]
    rules = [
        {"type": "rename_column", "from": "product_name", "to": "product"},
        {"type": "rename_column", "from": "product", "to": "sku"},
    ]
    result = apply_rules(rows, rules)
    assert len(result) == 1
    assert "sku" in result[0]
    assert result[0]["sku"] == "Widget"
    assert "product_name" not in result[0]
    assert "product" not in result[0]


def test_apply_rules_oversized_column_name_does_not_crash():
    """T-ETL-21: 超长 column 名（260+ 字符）apply 不崩且行数不变。"""
    long_col = "c" * 260
    rows = [{"amount": "bad", long_col: None}]
    rules = [{"type": "fill_null", "column": long_col, "value": "filled"}]
    result = apply_rules(rows, rules)
    assert len(result) == 1


def test_numeric_rule_type_ignored():
    """T-ETL-23: 规则 type 为数字 → apply_rules 不抛；无效规则忽略，默认 profile 仍生效。"""
    rows = [{"amount": "1"}]
    rules = [{"type": 123}]
    assert apply_rules(rows, rules) == [{"amount": 1}]


def test_cast_type_missing_column_raises_keyerror():
    """T-ETL-24: cast_type 缺 column 键 → KeyError（与 executor failed 路径一致）。"""
    rows = [{"amount": "bad"}]
    rules = [{"type": "cast_type", "to": "float"}]
    with pytest.raises(KeyError):
        apply_rules(rows, rules)


def test_filter_rows_unknown_op_excludes_all_rows():
    rows = [{"status": "active"}, {"status": "pending"}]
    rules = [{"type": "filter_rows", "column": "status", "op": "unknown_op", "value": "active"}]
    assert apply_rules(rows, rules) == []
