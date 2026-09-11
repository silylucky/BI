from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_sample_api_health_public():
    resp = client.get("/sample-api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_sample_api_orders_returns_rows():
    resp = client.get("/sample-api/orders")
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) >= 3
    assert rows[0]["product_name"] == "Widget A"


def test_sample_api_wrapped_json_path_shape():
    resp = client.get("/sample-api/v1/orders")
    body = resp.json()
    assert "data" in body
    assert len(body["data"]) >= 3


def test_sample_api_protected_requires_basic():
    assert client.get("/sample-api/protected/orders").status_code == 401
    ok = client.get(
        "/sample-api/protected/orders",
        auth=("demo", "demo"),
    )
    assert ok.status_code == 200
    assert len(ok.json()) >= 3
