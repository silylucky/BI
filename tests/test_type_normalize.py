from app.datasources.dialects.relational_hints import normalize_column_type
from app.datasources.type_normalize import (
    normalize_bson_type_name,
    normalize_search_type,
    pandas_dtype_for_bi,
)


def test_normalize_column_type_oracle():
    assert normalize_column_type("oracle", "NUMBER") == "decimal"
    assert normalize_column_type("oracle", "VARCHAR2") == "string"


def test_normalize_search_type_es():
    assert normalize_search_type("keyword") == "string"
    assert normalize_search_type("unknown_field") == "unknown"


def test_normalize_bson_type_name():
    assert normalize_bson_type_name("int") == "number"
    assert normalize_bson_type_name("Unknown") == "unknown"


def test_pandas_dtype_for_bi():
    assert pandas_dtype_for_bi("string") == "string"
    assert pandas_dtype_for_bi("decimal") == "float64"
