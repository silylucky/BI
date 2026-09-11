from __future__ import annotations

from app.query.dialects.oracle import OracleDialect


class Db2Dialect(OracleDialect):
    connector_type = "db2"
