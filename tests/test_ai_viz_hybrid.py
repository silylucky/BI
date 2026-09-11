"""VS-AI hybrid viz: artifacts API, customViz layout, manual dataBinding."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.chart_view import validate_chart_view_config
from app.views.validate import validate_layout_dict

client = TestClient(app)

DEMO_BUNDLE = {
    "manifest": {
        "id": "demo-ranking-strip",
        "displayName": "演示排名条",
        "entry": "index.html",
        "fieldSlots": {
            "dimensions": {"min": 1, "max": 1, "label": "类别"},
            "metrics": {"min": 1, "max": 1, "label": "数值"},
        },
        "styleSchema": {
            "type": "object",
            "properties": {
                "accentColor": {"type": "string", "format": "color", "title": "强调色"},
                "barHeight": {"type": "number", "minimum": 8, "maximum": 48, "title": "条高度"},
            },
        },
        "defaultStyle": {"accentColor": "#2563eb", "barHeight": 20},
    },
    "files": {
        "index.html": "<!DOCTYPE html><html><body><p>ok</p></body></html>",
    },
}


def test_validate_chart_manual_data_binding() -> None:
    cfg = validate_chart_view_config(
        {
            "chartType": "bar",
            "styleVariant": "default",
            "nativeBody": {"dataBinding": {"status": "manual"}},
        }
    )
    assert cfg.chart_type == "bar"
    assert cfg.data_source_id is None


def test_validate_layout_custom_viz_widget() -> None:
    artifact_id = str(uuid.uuid4())
    layout = validate_layout_dict(
        {
            "version": 2,
            "canvas": {"width": 1440, "height": 1080},
            "widgets": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "customViz",
                    "title": "AI Widget",
                    "x": 0,
                    "y": 0,
                    "width": 400,
                    "height": 300,
                    "order": 0,
                    "customVizConfig": {
                        "artifactId": artifact_id,
                        "dataBinding": {"status": "manual"},
                    },
                }
            ],
            "globalFilters": [],
        }
    )
    assert layout["widgets"][0]["type"] == "customViz"
    assert layout["widgets"][0]["customVizConfig"]["artifactId"] == artifact_id


def test_ai_viz_artifact_create_and_entry(auth_headers: dict[str, str]) -> None:
    resp = client.post("/api/v1/ai-viz/artifacts", json=DEMO_BUNDLE, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    artifact_id = resp.json()["artifactId"]
    meta = client.get(f"/api/v1/ai-viz/artifacts/{artifact_id}", headers=auth_headers)
    assert meta.status_code == 200
    entry = client.get(f"/api/v1/ai-viz/artifacts/{artifact_id}/entry", headers=auth_headers)
    assert entry.status_code == 200
    assert "ok" in entry.text


def test_ai_viz_artifact_update_overwrites_entry(auth_headers: dict[str, str]) -> None:
    created = client.post("/api/v1/ai-viz/artifacts", json=DEMO_BUNDLE, headers=auth_headers)
    assert created.status_code == 201, created.text
    artifact_id = created.json()["artifactId"]
    updated = client.put(
        f"/api/v1/ai-viz/artifacts/{artifact_id}",
        json={
            **DEMO_BUNDLE,
            "files": {"index.html": "<!DOCTYPE html><html><body><p>v2</p></body></html>"},
        },
        headers=auth_headers,
    )
    assert updated.status_code == 200, updated.text
    entry = client.get(f"/api/v1/ai-viz/artifacts/{artifact_id}/entry", headers=auth_headers)
    assert entry.status_code == 200
    assert "v2" in entry.text
    assert "ok" not in entry.text


def test_ai_viz_artifact_list(auth_headers: dict[str, str]) -> None:
    created = client.post("/api/v1/ai-viz/artifacts", json=DEMO_BUNDLE, headers=auth_headers)
    assert created.status_code == 201, created.text
    artifact_id = created.json()["artifactId"]
    listed = client.get("/api/v1/ai-viz/artifacts?limit=50&offset=0", headers=auth_headers)
    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert "items" in body
    ids = [item["artifactId"] for item in body["items"]]
    assert artifact_id in ids


def test_ai_viz_artifact_delete(auth_headers: dict[str, str]) -> None:
    created = client.post("/api/v1/ai-viz/artifacts", json=DEMO_BUNDLE, headers=auth_headers)
    assert created.status_code == 201, created.text
    artifact_id = created.json()["artifactId"]
    deleted = client.delete(f"/api/v1/ai-viz/artifacts/{artifact_id}", headers=auth_headers)
    assert deleted.status_code == 204, deleted.text
    meta = client.get(f"/api/v1/ai-viz/artifacts/{artifact_id}", headers=auth_headers)
    assert meta.status_code == 404


def test_ai_viz_rejects_oversize_bundle(auth_headers: dict[str, str]) -> None:
    from app.ai_viz.models import MAX_BUNDLE_BYTES

    huge = {
        **DEMO_BUNDLE,
        "files": {"index.html": "a" * (MAX_BUNDLE_BYTES + 1)},
    }
    resp = client.post("/api/v1/ai-viz/artifacts", json=huge, headers=auth_headers)
    assert resp.status_code == 413, resp.text
    assert resp.json()["code"] == "AIVIZ_BUNDLE_TOO_LARGE"
    bad = {
        **DEMO_BUNDLE,
        "files": {"index.html": '<script src="https://evil.example/x.js"></script>'},
    }
    resp = client.post("/api/v1/ai-viz/artifacts", json=bad, headers=auth_headers)
    assert resp.status_code == 422
    assert resp.json()["code"] == "AIVIZ_UNSAFE_CONTENT"


def test_ai_viz_allows_js_property_handlers_but_rejects_html_onclick(
    auth_headers: dict[str, str],
) -> None:
    js_handler = {
        **DEMO_BUNDLE,
        "files": {
            "index.html": (
                DEMO_BUNDLE["files"]["index.html"]
                + "<script>el.addEventListener('click',function(){});"
                "w.onmouseenter=function(){};</script>"
            ),
        },
    }
    resp = client.post("/api/v1/ai-viz/artifacts", json=js_handler, headers=auth_headers)
    assert resp.status_code in (200, 201), resp.text

    html_onclick = {
        **DEMO_BUNDLE,
        "files": {"index.html": '<div onclick="alert(1)"></div>'},
    }
    resp = client.post("/api/v1/ai-viz/artifacts", json=html_onclick, headers=auth_headers)
    assert resp.status_code == 422
    assert resp.json()["code"] == "AIVIZ_UNSAFE_CONTENT"


def test_ai_viz_rejects_manifest_without_field_slots(auth_headers: dict[str, str]) -> None:
    bad = {
        **DEMO_BUNDLE,
        "manifest": {
            "id": "incomplete",
            "displayName": "缺槽位",
            "entry": "index.html",
            "styleSchema": DEMO_BUNDLE["manifest"]["styleSchema"],
        },
    }
    resp = client.post("/api/v1/ai-viz/artifacts", json=bad, headers=auth_headers)
    assert resp.status_code == 422
    assert resp.json()["code"] == "AIVIZ_INVALID_MANIFEST"


def test_ai_viz_rejects_manifest_without_style_schema(auth_headers: dict[str, str]) -> None:
    bad = {
        **DEMO_BUNDLE,
        "manifest": {
            "id": "incomplete",
            "displayName": "缺样式",
            "entry": "index.html",
            "fieldSlots": DEMO_BUNDLE["manifest"]["fieldSlots"],
        },
    }
    resp = client.post("/api/v1/ai-viz/artifacts", json=bad, headers=auth_headers)
    assert resp.status_code == 422
    assert resp.json()["code"] == "AIVIZ_INVALID_MANIFEST"
