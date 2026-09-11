"""Dataset 出数 LIMIT 取最新时间列，而非无序前 N 行。"""

from app.query.translator.latest_order import pick_latest_order_column
from app.query.translator.schemas import TranslateRequest
from app.query.translator import service as translator_service


def test_pick_latest_prefers_sale_date_over_id():
    assert pick_latest_order_column(["id", "amount", "sale_date"]) == "sale_date"


def test_pick_latest_prefers_updated_at():
    assert pick_latest_order_column(["name", "created_at", "updated_at"]) == "updated_at"


def test_pick_latest_none_without_time_column():
    assert pick_latest_order_column(["region", "amount"]) is None


def test_translate_orders_latest_then_chronological_for_chart():
    req = TranslateRequest(
        connectorType="postgresql",
        schema="public",
        table="orders",
        columns=["amount", "sale_date"],
        limit=1000,
    )
    sql = translator_service.translate_config_to_sql(req).sql
    assert 'ORDER BY "sale_date" DESC' in sql
    assert 'ORDER BY "sale_date" ASC' in sql
    assert "LIMIT 1000" in sql
    desc_at = sql.index('ORDER BY "sale_date" DESC')
    asc_at = sql.index('ORDER BY "sale_date" ASC')
    assert desc_at < asc_at


def test_translate_skips_order_without_time_column():
    req = TranslateRequest(
        connectorType="postgresql",
        schema="public",
        table="t",
        columns=["region", "amount"],
        limit=50,
    )
    sql = translator_service.translate_config_to_sql(req).sql
    assert "ORDER BY" not in sql
    assert "LIMIT 50" in sql
