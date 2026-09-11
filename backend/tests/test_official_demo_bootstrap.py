"""official_demo_bootstrap 单元测试。"""

from __future__ import annotations

from app.dashboard.templates.official_demo_bootstrap import (
    _discover_migration_versions,
    _latest_migration_version,
    _split_sql_statements,
)


def test_discover_migration_versions() -> None:
    versions = _discover_migration_versions()
    assert versions == [1, 2, 3, 4]


def test_latest_migration_version_matches_files() -> None:
    assert _latest_migration_version() == 4


def test_pad_demo_tables_migration_is_idempotent_sql() -> None:
    path = next(
        p for p in __import__("pathlib").Path(__file__).resolve().parents[2].joinpath(
            "docker", "demo-mysql", "migrations"
        ).glob("004_*.sql")
    )
    text = path.read_text(encoding="utf-8")
    assert "n < 600" in text
    assert "WHERE seq.n > (SELECT COUNT(*) FROM sales)" in text


def test_split_sql_statements_skips_empty_and_comments() -> None:
    parts = _split_sql_statements(
        "-- header\nCREATE TABLE t (id INT);\n\n-- tail\nSELECT 1;",
    )
    assert parts == ["CREATE TABLE t (id INT)", "SELECT 1"]
