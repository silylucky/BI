"""Native column types → BI types, with pandas dtype registry."""

from __future__ import annotations

_ORACLE_TYPE_MAP = {
    "NUMBER": "decimal",
    "VARCHAR2": "string",
    "DATE": "datetime",
}

_SQLSERVER_TYPE_MAP = {
    "nvarchar": "string",
    "datetime2": "datetime",
    "bit": "boolean",
}

_SEARCH_TYPE_MAP = {
    "keyword": "string",
    "text": "string",
    "long": "number",
    "integer": "number",
    "double": "number",
    "float": "number",
    "date": "datetime",
    "boolean": "boolean",
    "object": "json",
    "nested": "json",
}

_BSON_TYPE_MAP = {
    "str": "string",
    "int": "number",
    "float": "number",
    "bool": "boolean",
    "datetime": "datetime",
    "dict": "json",
    "list": "json",
}

BI_TO_PANDAS_DTYPE: dict[str, str] = {
    "string": "string",
    "number": "float64",
    "decimal": "float64",
    "datetime": "datetime64[ns]",
    "boolean": "bool",
    "json": "object",
    "unknown": "object",
}


def normalize_column_type(dialect: str, raw: str) -> str:
    key = raw.strip()
    if dialect == "oracle":
        return _ORACLE_TYPE_MAP.get(key.upper(), key.lower())
    if dialect == "sqlserver":
        return _SQLSERVER_TYPE_MAP.get(key.lower(), key.lower())
    raise ValueError(f"unsupported dialect for normalize_column_type: {dialect}")


def normalize_search_type(raw: str) -> str:
    return _SEARCH_TYPE_MAP.get(raw, "unknown")


def normalize_bson_type_name(type_name: str) -> str:
    return _BSON_TYPE_MAP.get(type_name, "unknown")


def pandas_dtype_for_bi(bi_type: str) -> str:
    return BI_TO_PANDAS_DTYPE.get(bi_type, "object")
