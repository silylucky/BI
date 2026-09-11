from __future__ import annotations

from app.query.dialects.mysql import MySqlDialect


class HiveDialect(MySqlDialect):
    connector_type = "hive"
