from __future__ import annotations

from app.query.dialects.mysql import MySqlDialect


class TdengineDialect(MySqlDialect):
    connector_type = "tdengine"
