from __future__ import annotations

import uuid

from fastapi.testclient import TestClient


def test_dashboard_thumbnail_upload_and_list(client: TestClient, auth_headers: dict) -> None:
    name = f"Thumb Test {uuid.uuid4().hex[:8]}"
    created = client.post(
        "/api/v1/dashboards",
        headers=auth_headers,
        json={"name": name},
    )
    assert created.status_code == 201
    dash_id = created.json()["id"]
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    put = client.put(
        f"/api/v1/dashboards/{dash_id}/thumbnail",
        headers={**auth_headers, "Content-Type": "image/png"},
        content=png,
    )
    assert put.status_code == 200
    body = put.json()
    assert body.get("thumbnailUrl")

    get_img = client.get(
        f"/api/v1/dashboards/{dash_id}/thumbnail",
        headers=auth_headers,
    )
    assert get_img.status_code == 200
    assert get_img.content.startswith(b"\x89PNG")

    listed = client.get("/api/v1/dashboards?limit=10&offset=0", headers=auth_headers)
    assert listed.status_code == 200
    item = next(i for i in listed.json()["items"] if i["id"] == dash_id)
    assert item.get("thumbnailUrl")
