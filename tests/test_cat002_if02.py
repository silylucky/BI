"""CAT-002 IF-02 — GET /api/v1/stats/aggregate companion."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.governance.catalog.cat02 import service as cat02_service
from app.governance.catalog.cat02.schemas import AggregateTemplateIn
from app.main import app as fastapi_app
from jwt_auth import AUTH


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture(autouse=True)
def clear_cat02_store():
    cat02_service._store.clear()
    cat02_service._USER_AGGREGATE_SCOPE.clear()
    yield
    cat02_service._store.clear()
    cat02_service._USER_AGGREGATE_SCOPE.clear()


def _seed_template(key: str = "AGG_SALES") -> None:
    cat02_service.create_aggregate_template(
        AggregateTemplateIn.model_validate(
            {
                "aggregateKey": key,
                "displayName": "Sales",
                "dimensions": ["province", "city"],
                "metrics": ["orders", "revenue"],
                "aggregationFn": "sum",
                "attributionLabel": "sales-agg",
            }
        ),
        UserContext(id="admin", username="admin", roles=["admin"]),
    )


def test_cat002_if02_01_poc_template_returns_rows(client: TestClient):
    """T-CAT-002-IF02-01: AGG_POC + groupBy=province → 200 rows."""
    resp = client.get(
        "/api/v1/stats/aggregate",
        headers=AUTH,
        params={"templateKey": "AGG_POC", "groupBy": "province"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["templateKey"] == "AGG_POC"
    assert body["groupBy"] == "province"
    assert body["pocReady"] is True
    assert len(body["rows"]) >= 3


def test_cat002_if02_02_registered_template(client: TestClient):
    """T-CAT-002-IF02-02: registered templateKey works."""
    _seed_template("AGG_SALES")
    resp = client.get(
        "/api/v1/stats/aggregate",
        headers=AUTH,
        params={"templateKey": "AGG_SALES", "groupBy": "province"},
    )
    assert resp.status_code == 200
    assert resp.json()["metrics"] == ["orders", "revenue"]


def test_cat002_if02_03_invalid_group_by(client: TestClient):
    """T-CAT-002-IF02-03: invalid groupBy → 422."""
    resp = client.get(
        "/api/v1/stats/aggregate",
        headers=AUTH,
        params={"templateKey": "AGG_POC", "groupBy": "unknown"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT02_INVALID_GROUP_BY"


def test_cat002_if02_04_unknown_template(client: TestClient):
    """T-CAT-002-IF02-04: unknown templateKey → 404."""
    resp = client.get(
        "/api/v1/stats/aggregate",
        headers=AUTH,
        params={"templateKey": "AGG_MISSING", "groupBy": "province"},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT02_NOT_FOUND"


@pytest.fixture
def enterprise_aggregate_scope(monkeypatch):
    def _enterprise() -> UserContext:
        return UserContext(id="enterprise-cat002", username="enterprise", roles=["enterprise"])

    fastapi_app.dependency_overrides[get_current_user] = _enterprise
    cat02_service.set_user_aggregate_scope("enterprise-cat002", "AGG")
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_cat002_if02_05_enterprise_scope_forbidden(client: TestClient, enterprise_aggregate_scope):
    """T-CAT-002-IF02-05: enterprise out-of-scope template → 403."""
    _seed_template("OTHER_SCOPE")
    resp = client.get(
        "/api/v1/stats/aggregate",
        headers=AUTH,
        params={"templateKey": "OTHER_SCOPE", "groupBy": "province"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT02_FORBIDDEN"
