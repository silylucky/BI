"""Report center final form: contract, jobs, center prefs, artifact download."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH

_SQLITE = "sqlite+pysqlite:///file:report_center_final?mode=memory&cache=shared&uri=true"


def _seed_template(client: TestClient, key: str) -> None:
    resp = client.put(
        f"/api/v1/reports/templates/{key}",
        headers=AUTH,
        json={
            "templateKey": key,
            "format": "pdf",
            "displayName": key,
            "blocks": [{"blockType": "table", "tableRef": "metrics"}],
        },
    )
    assert resp.status_code == 200, resp.text


def _create_template_node(client: TestClient, *, name: str, template_key: str) -> str:
    _seed_template(client, template_key)
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={
            "name": name,
            "nodeType": "template",
            "templateKind": "pdf",
            "templateKey": template_key,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


@pytest.fixture(scope="module", autouse=True)
def _sqlite():
    prev = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE
    os.environ["ARTIFACT_STORAGE_BACKEND"] = "memory"
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.reports.models  # noqa: F401
    import app.reports.persistence.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    os.environ["DATABASE_URL"] = prev if prev else os.environ.pop("DATABASE_URL", None)
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset():
    from app.reports.center_prefs import reset_center_prefs_for_tests
    from app.reports.jobs.store import reset_jobs_for_tests
    from app.reports.persistence.store import reset_metadata_for_tests
    from app.reports.scheduler.store import reset_schedules_for_tests

    reset_metadata_for_tests()
    reset_schedules_for_tests()
    reset_jobs_for_tests()
    reset_center_prefs_for_tests()
    yield
    reset_metadata_for_tests()
    reset_schedules_for_tests()
    reset_jobs_for_tests()
    reset_center_prefs_for_tests()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def test_center_preferences_roundtrip(client: TestClient):
    favorites = [{"resourceType": "standard", "resourceId": "equipment-overview"}]
    put = client.put(
        "/api/v1/reports/center/preferences",
        headers=AUTH,
        json={"favorites": favorites, "recent": []},
    )
    assert put.status_code == 200
    got = client.get("/api/v1/reports/center/preferences", headers=AUTH)
    assert got.status_code == 200
    body = got.json()
    assert body["favorites"][0]["resourceId"] == "lifecycle-overview"


def test_batch_export_job_produces_download(client: TestClient):
    node_id = _create_template_node(client, name="导出模板", template_key="demo-pdf")
    submit = client.post(
        "/api/v1/reports/batch/export",
        headers=AUTH,
        json={"nodeIds": [node_id], "format": "pdf"},
    )
    assert submit.status_code in {200, 201, 202}
    job_id = submit.json()["jobId"]
    poll = client.get(f"/api/v1/reports/jobs/{job_id}", headers=AUTH)
    assert poll.status_code == 200, poll.text
    body = poll.json()
    assert body["status"] in {"ready", "processing", "pending"}, body.get("errorMessage") or body
    if poll.json()["status"] == "ready":
        download = client.get(f"/api/v1/reports/jobs/{job_id}/download", headers=AUTH)
        assert download.status_code == 200
        assert len(download.content) > 0


def test_catalog_duplicate(client: TestClient):
    node_id = _create_template_node(client, name="原模板", template_key="dup-demo")
    dup = client.post(f"/api/v1/reports/catalog/nodes/{node_id}/duplicate", headers=AUTH)
    assert dup.status_code == 200
    assert "副本" in dup.json()["name"]


def test_template_versions_publish(client: TestClient):
    _seed_template(client, "final-demo")
    published = client.post(
        "/api/v1/reports/templates/final-demo/publish?changeNote=v1",
        headers=AUTH,
    )
    assert published.status_code == 200
    assert published.json()["version"] == 1
    versions = client.get("/api/v1/reports/templates/final-demo/versions", headers=AUTH)
    assert versions.status_code == 200
    assert versions.json()["total"] >= 1
