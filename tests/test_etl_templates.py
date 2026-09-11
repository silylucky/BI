from app.ingestion.etl_templates import (
    DIRTY_ORDERS_DEMO_ETL_RULES,
    REST_API_SAMPLE_ORDERS_PATH,
    default_etl_rules_for_source,
)


def test_default_etl_rules_for_dirty_orders_mysql() -> None:
    rules = default_etl_rules_for_source("mysql", "dirty_orders")
    assert len(rules) == len(DIRTY_ORDERS_DEMO_ETL_RULES)


def test_default_etl_rules_for_rest_sample_orders() -> None:
    rules = default_etl_rules_for_source("rest_api", REST_API_SAMPLE_ORDERS_PATH)
    assert len(rules) == 2
    assert rules[0]["type"] == "cast_type"


def test_default_etl_rules_empty_for_unknown_source() -> None:
    assert default_etl_rules_for_source("mysql", "other_table") == []
