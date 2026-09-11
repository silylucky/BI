from app.metadata.dataset.suggest_bind_columns import suggest_bind_columns


def test_suggest_bind_columns_picks_dimensions_and_metrics() -> None:
    cols = ["id", "product_name", "amount", "status", "region", "updated_at", "internal_flag"]
    picked = suggest_bind_columns(cols)
    assert "amount" in picked
    assert "product_name" in picked
    assert "id" in picked
    assert "internal_flag" in picked


def test_suggest_bind_columns_fallback_all_when_empty_input() -> None:
    assert suggest_bind_columns([]) == []
