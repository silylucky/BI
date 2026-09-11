from __future__ import annotations

from app.datasources.dialects.trino import TrinoConnector


class PrestoConnector(TrinoConnector):
    type = "presto"
    display_name = "Presto"
