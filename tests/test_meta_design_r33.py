"""M11 META + M12 query/design companion 质量推分 r33 — META-001/002 + QUERY-007 + DESIGN-001/002."""
from __future__ import annotations

import os
import time
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from jwt_auth import AUTH, jwt_auth_headers

_R33_SQLITE_URL = "sqlite+pysqlite:///file:meta_design_r33?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r33_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R33_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.metadata.glossary.models  # noqa: F401
    import app.metadata.themes.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


def test_meta_glossary_definition_too_long_r33(client):
    """T-META-R33-001-01: definition 4001 字符 → 422。"""
    payload = {"code": "long_def", "name": "长定义", "definition": "x" * 4001}
    resp = client.post("/api/v1/metadata/glossary", headers=AUTH, json=payload)
    assert resp.status_code == 422


def test_meta_glossary_blank_name_r33(client):
    """T-META-R33-001-02: name 仅空格 → 422 META_TERM_INVALID_NAME + detail.fields。"""
    resp = client.post(
        "/api/v1/metadata/glossary", headers=AUTH, json={"code": "blank_name", "name": "   "}
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "META_TERM_INVALID_NAME"
    assert body["detail"]["fields"][0]["field"] == "name"


def test_meta_glossary_list_pagination_offset_r33(client):
    """T-META-R33-001-03: limit=50 offset=100 分页正确。"""
    for i in range(120):
        client.post(
            "/api/v1/metadata/glossary",
            headers=AUTH,
            json={"code": f"page_g_{i:03d}", "name": f"术语{i}"},
        )
    resp = client.get(
        "/api/v1/metadata/glossary", headers=AUTH, params={"limit": 50, "offset": 100}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) == 20
    assert body["total"] >= 120


def test_meta_glossary_list_pagination_perf_r33(client):
    """T-META-R33-001-04: 120 术语 list limit=50 elapsed <0.5s。"""
    for i in range(120):
        client.post(
            "/api/v1/metadata/glossary",
            headers=AUTH,
            json={"code": f"perf_g_{i:03d}", "name": f"P{i}"},
        )
    start = time.perf_counter()
    resp = client.get(
        "/api/v1/metadata/glossary", headers=AUTH, params={"limit": 50, "offset": 0}
    )
    elapsed = time.perf_counter() - start
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 50
    assert resp.json()["total"] >= 120
    assert elapsed < 0.5


def test_meta_theme_max_depth_create_r33(client):
    """T-META-R33-002-01: 8 层深链 create 第 9 层 → 422 META_THEME_MAX_DEPTH。"""
    parent_id = None
    for depth in range(8):
        payload = {"name": f"L{depth}"}
        if parent_id:
            payload["parentId"] = parent_id
        resp = client.post("/api/v1/metadata/themes", headers=AUTH, json=payload)
        assert resp.status_code == 201
        parent_id = resp.json()["id"]
    too_deep = client.post(
        "/api/v1/metadata/themes", headers=AUTH, json={"name": "L9", "parentId": parent_id}
    )
    assert too_deep.status_code == 422
    assert too_deep.json()["code"] == "META_THEME_MAX_DEPTH"
    assert too_deep.json()["detail"]["fields"][0]["field"] == "parentId"


def test_meta_theme_move_within_depth_r33(client):
    """T-META-R33-002-02: move 子树到浅层使深度合法 → 200。"""
    root = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "R"}).json()
    deep_parent = root["id"]
    for i in range(6):
        node = client.post(
            "/api/v1/metadata/themes",
            headers=AUTH,
            json={"name": f"D{i}", "parentId": deep_parent},
        ).json()
        deep_parent = node["id"]
    leaf = client.post(
        "/api/v1/metadata/themes",
        headers=AUTH,
        json={"name": "Leaf", "parentId": deep_parent},
    ).json()
    move = client.post(
        f"/api/v1/metadata/themes/{leaf['id']}/move",
        headers=AUTH,
        json={"parentId": root["id"]},
    )
    assert move.status_code == 200


def test_meta_theme_list_children_perf_r33(client):
    """T-META-R33-002-03: 80 子节点 list elapsed <0.5s。"""
    root = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "PerfRoot"}).json()
    for i in range(80):
        client.post(
            "/api/v1/metadata/themes",
            headers=AUTH,
            json={"name": f"C{i}", "parentId": root["id"], "sortOrder": i},
        )
    start = time.perf_counter()
    resp = client.get(
        "/api/v1/metadata/themes",
        headers=AUTH,
        params={"parent_id": root["id"], "limit": 100},
    )
    elapsed = time.perf_counter() - start
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 80
    assert elapsed < 0.5


REF_ID = str(uuid.uuid4())


def _oversized_payload() -> dict:
    chunk = "x" * 1024
    return {"data": [chunk for _ in range(260)]}


def test_query_config_payload_too_large_r33(client):
    """T-QUERY-R33-007-01: payload >256KB → 413 CONFIG_PAYLOAD_TOO_LARGE。"""
    body = {
        "configType": "query_conditions",
        "schemaVersion": "1.0",
        "refType": "design_draft",
        "refId": REF_ID,
        "payload": _oversized_payload(),
    }
    resp = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert resp.status_code == 413
    assert resp.json()["code"] == "CONFIG_PAYLOAD_TOO_LARGE"
    assert resp.json()["detail"]["fields"][0]["field"] == "payload"


def test_query_config_revision_conflict_r33(client):
    """T-QUERY-R33-007-02: expectedRevision 过期 → 409 CONFIG_VERSION_CONFLICT。"""
    body = {
        "configType": "query_conditions",
        "schemaVersion": "1.0",
        "refType": "design_draft",
        "refId": str(uuid.uuid4()),
        "payload": {"logic": "AND", "conditions": []},
    }
    first = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert first.status_code == 200
    assert first.json()["revision"] == 1
    body["expectedRevision"] = 0
    conflict = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "CONFIG_VERSION_CONFLICT"


def test_query_config_large_roundtrip_perf_r33(client):
    """T-QUERY-R33-007-03: ~200KB payload PUT+GET elapsed <1.0s。"""
    ref = str(uuid.uuid4())
    payload = {"blob": "y" * 200_000}
    body = {
        "configType": "compute_rules",
        "schemaVersion": "1.0",
        "refType": "design_draft",
        "refId": ref,
        "payload": payload,
    }
    start = time.perf_counter()
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    got = client.get(f"/api/v1/query/configs/{put.json()['id']}", headers=AUTH)
    elapsed = time.perf_counter() - start
    assert put.status_code == 200
    assert got.status_code == 200
    assert got.json()["payload"]["blob"] == payload["blob"]
    assert elapsed < 1.0


def _valid_conditions(ref_id: str) -> dict:
    return {
        "schemaVersion": "1.0",
        "logic": "AND",
        "conditions": [
            {"fieldId": "order_amount", "operator": "gte", "value": 100, "valueType": "number"}
        ],
        "refType": "design_draft",
        "refId": ref_id,
    }


def test_design_unknown_field_r33(client):
    """T-DESIGN-R33-001-01: unknown fieldId → 422 DESIGN_UNKNOWN_FIELD + detail.fields。"""
    ref = str(uuid.uuid4())
    body = _valid_conditions(ref)
    body["conditions"][0]["fieldId"] = "order_amt"
    resp = client.put("/api/v1/designer/conditions", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_UNKNOWN_FIELD"
    assert "conditions[0].fieldId" in resp.json()["detail"]["fields"][0]["field"]


def test_design_cross_field_self_ref_r33(client):
    """T-DESIGN-R33-001-02: 跨字段自引用 value → 422 DESIGN_INVALID_CROSS_FIELD。"""
    ref = str(uuid.uuid4())
    body = _valid_conditions(ref)
    body["conditions"][0]["value"] = "order_amount"
    body["conditions"][0]["valueType"] = "string"
    resp = client.put("/api/v1/designer/conditions", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_INVALID_CROSS_FIELD"


def test_design_validate_returns_fields_r33(client):
    """T-DESIGN-R33-001-03: validate 端点返回 detail.fields。"""
    ref = str(uuid.uuid4())
    body = _valid_conditions(ref)
    body["conditions"][0]["fieldId"] = "bad_field"
    resp = client.post("/api/v1/designer/conditions/validate", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["detail"]["fields"]


def test_design_conditions_save_revision_conflict_r33(client):
    """T-DESIGN-R33-001-04: save 后 revision=1；带 expectedRevision=0 再 save → 409。"""
    ref = str(uuid.uuid4())
    first = client.put("/api/v1/designer/conditions", headers=AUTH, json=_valid_conditions(ref))
    assert first.status_code == 200
    body = _valid_conditions(ref)
    body["expectedRevision"] = 0
    conflict = client.put("/api/v1/designer/conditions", headers=AUTH, json=body)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "CONFIG_VERSION_CONFLICT"


def _valid_compute_rules(ref_id: str) -> dict:
    return {
        "schemaVersion": "1.0",
        "rules": [
            {
                "id": "total_amount",
                "name": "合计",
                "ruleType": "sum",
                "targetField": "order_amount",
                "expression": "sum(order_amount)",
                "dependsOn": [],
            }
        ],
        "refType": "design_draft",
        "refId": ref_id,
    }


def test_design_rule_type_mismatch_r33(client):
    """T-DESIGN-R33-002-01: ruleType=sum expression=avg(x) → 422 DESIGN_RULE_TYPE_MISMATCH。"""
    ref = str(uuid.uuid4())
    body = _valid_compute_rules(ref)
    body["rules"][0]["expression"] = "avg(order_amount)"
    resp = client.put("/api/v1/designer/compute-rules", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_RULE_TYPE_MISMATCH"


def test_design_rule_broken_chain_r33(client):
    """T-DESIGN-R33-002-02: dependsOn 未知 id → 422 DESIGN_RULE_BROKEN_CHAIN。"""
    ref = str(uuid.uuid4())
    body = _valid_compute_rules(ref)
    body["rules"][0]["dependsOn"] = ["missing_rule"]
    resp = client.put("/api/v1/designer/compute-rules", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_RULE_BROKEN_CHAIN"


def test_design_invalid_aggregate_r33(client):
    """T-DESIGN-R33-002-03: median(x) → 422 DESIGN_INVALID_AGGREGATE。"""
    ref = str(uuid.uuid4())
    body = _valid_compute_rules(ref)
    body["rules"][0]["expression"] = "median(order_amount)"
    resp = client.put("/api/v1/designer/compute-rules", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_INVALID_AGGREGATE"


def test_design_invalid_rules_no_store_pollution_r33(client):
    """T-DESIGN-R33-002-04: 非法规则 save 后 GET config revision 未变。"""
    ref = str(uuid.uuid4())
    ok = client.put("/api/v1/designer/compute-rules", headers=AUTH, json=_valid_compute_rules(ref))
    assert ok.status_code == 200
    listed = client.get(
        "/api/v1/query/configs",
        headers=AUTH,
        params={"config_type": "compute_rules", "ref_type": "design_draft", "ref_id": ref},
    )
    before_rev = listed.json()["items"][0]["revision"]
    bad = _valid_compute_rules(ref)
    bad["rules"][0]["expression"] = "median(order_amount)"
    assert client.put("/api/v1/designer/compute-rules", headers=AUTH, json=bad).status_code == 422
    after = client.get(
        "/api/v1/query/configs",
        headers=AUTH,
        params={"config_type": "compute_rules", "ref_type": "design_draft", "ref_id": ref},
    )
    assert after.json()["items"][0]["revision"] == before_rev


def test_design_conditions_and_compute_joint_save_r33(client):
    """联合回归: 同 ref save conditions + compute_rules 均 200。"""
    ref = str(uuid.uuid4())
    assert client.put("/api/v1/designer/conditions", headers=AUTH, json=_valid_conditions(ref)).status_code == 200
    assert client.put("/api/v1/designer/compute-rules", headers=AUTH, json=_valid_compute_rules(ref)).status_code == 200
    cond = client.get("/api/v1/designer/conditions", headers=AUTH, params={"ref_type": "design_draft", "ref_id": ref})
    comp = client.get("/api/v1/designer/compute-rules", headers=AUTH, params={"ref_type": "design_draft", "ref_id": ref})
    assert cond.status_code == 200 and comp.status_code == 200
