from app.query.table_ref import qualify_table_reference


def test_qualify_table_reference_allows_empty_schema() -> None:
    qualified = qualify_table_reference(
        quote_identifier=lambda name: f"`{name}`",
        schema="",
        table="v_sales_geo",
    )
    assert qualified == "`v_sales_geo`"


def test_qualify_table_reference_keeps_schema_when_present() -> None:
    qualified = qualify_table_reference(
        quote_identifier=lambda name: f"`{name}`",
        schema="sample_db",
        table="v_sales_geo",
    )
    assert qualified == "`sample_db`.`v_sales_geo`"
