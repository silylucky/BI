"""M11 META + M12 查询设计元数据 L1 r32 — META-001/002 + QUERY-007 + DESIGN-001/002."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from jwt_auth import AUTH, jwt_auth_headers

_R32_SQLITE_URL = "sqlite+pysqlite:///file:meta_design_r32?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r32_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R32_SQLITE_URL
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


def test_r32_fixture_health(client):
    """T-META-R32-000-01: fixture 可用，/health 200。"""
    assert client.get("/health").status_code == 200


def test_meta_term_create_and_list_r32(client):
    """T-META-R32-001-01: POST 合法 term → 201；GET list 含该项。"""
    payload = {"code": "order_amount", "name": "订单金额", "definition": "订单含税金额"}
    created = client.post("/api/v1/metadata/glossary", headers=AUTH, json=payload)
    assert created.status_code == 201
    body = created.json()
    assert body["code"] == "order_amount"
    listed = client.get("/api/v1/metadata/glossary", headers=AUTH)
    assert listed.status_code == 200
    codes = [t["code"] for t in listed.json()["items"]]
    assert "order_amount" in codes


def test_meta_term_duplicate_code_r32(client):
    """T-META-R32-001-02: 重复 code → 409 META_TERM_CODE_CONFLICT。"""
    payload = {"code": "dup_term", "name": "A"}
    assert client.post("/api/v1/metadata/glossary", headers=AUTH, json=payload).status_code == 201
    dup = client.post("/api/v1/metadata/glossary", headers=AUTH, json=payload)
    assert dup.status_code == 409
    assert dup.json()["code"] == "META_TERM_CODE_CONFLICT"


def test_meta_term_invalid_payload_r32(client):
    """T-META-R32-001-03: 缺 name / 非法 code → 422。"""
    bad_code = client.post(
        "/api/v1/metadata/glossary", headers=AUTH, json={"code": "1bad", "name": "X"}
    )
    assert bad_code.status_code == 422
    no_name = client.post("/api/v1/metadata/glossary", headers=AUTH, json={"code": "valid_code"})
    assert no_name.status_code == 422


def test_meta_term_delete_in_use_r32(client):
    """T-META-R32-001-04: DELETE 被 theme 引用 → 409 META_TERM_IN_USE（themes 在 Task 3 实现后完整断言）。"""
    term = client.post(
        "/api/v1/metadata/glossary",
        headers=AUTH,
        json={"code": "linked_term", "name": "关联术语"},
    ).json()
    theme = client.post(
        "/api/v1/metadata/themes",
        headers=AUTH,
        json={"name": "主题", "termId": term["id"]},
    )
    if theme.status_code == 201:
        deleted = client.delete(f"/api/v1/metadata/glossary/{term['id']}", headers=AUTH)
        assert deleted.status_code == 409
        assert deleted.json()["code"] == "META_TERM_IN_USE"


def test_meta_theme_tree_and_filter_r32(client):
    """T-META-R32-002-01: 建根 + 子节点；GET ?parent_id= 过滤正确。"""
    root = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "根主题"}).json()
    child = client.post(
        "/api/v1/metadata/themes",
        headers=AUTH,
        json={"name": "子主题", "parentId": root["id"]},
    )
    assert child.status_code == 201
    roots = client.get("/api/v1/metadata/themes", headers=AUTH, params={"parent_id": "null"})
    assert any(n["id"] == root["id"] for n in roots.json()["items"])


def test_meta_theme_cycle_move_r32(client):
    """T-META-R32-002-02: move 子到孙下形成环 → 422 META_THEME_CYCLE。"""
    root = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "R"}).json()
    child = client.post(
        "/api/v1/metadata/themes", headers=AUTH, json={"name": "C", "parentId": root["id"]}
    ).json()
    grand = client.post(
        "/api/v1/metadata/themes", headers=AUTH, json={"name": "G", "parentId": child["id"]}
    ).json()
    resp = client.post(
        f"/api/v1/metadata/themes/{root['id']}/move",
        headers=AUTH,
        json={"parentId": grand["id"]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_THEME_CYCLE"


def test_meta_theme_self_move_r32(client):
    """T-META-R32-002-03: 自引用 move → 422 META_THEME_CYCLE。"""
    node = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "Solo"}).json()
    resp = client.post(
        f"/api/v1/metadata/themes/{node['id']}/move",
        headers=AUTH,
        json={"parentId": node["id"]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_THEME_CYCLE"


def test_meta_theme_term_link_r32(client):
    """T-META-R32-002-04: 可选 term_id 关联已存在术语 → 200。"""
    term = client.post(
        "/api/v1/metadata/glossary", headers=AUTH, json={"code": "theme_link", "name": "T"}
    ).json()
    node = client.put(
        f"/api/v1/metadata/themes/{client.post('/api/v1/metadata/themes', headers=AUTH, json={'name': 'N'}).json()['id']}",
        headers=AUTH,
        json={"name": "N", "termId": term["id"]},
    )
    assert node.status_code == 200
    assert node.json()["termId"] == term["id"]


REF_ID = "00000000-0000-4000-8000-000000000001"


def test_query_config_roundtrip_r32(client):
    """T-QUERY-R32-007-01: PUT 合法 payload → GET 往返一致。"""
    body = {
        "configType": "query_conditions",
        "schemaVersion": "1.0",
        "refType": "design_draft",
        "refId": REF_ID,
        "payload": {"logic": "AND", "conditions": []},
    }
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert put.status_code == 200
    got = client.get(
        "/api/v1/query/configs",
        headers=AUTH,
        params={"config_type": "query_conditions", "ref_type": "design_draft", "ref_id": REF_ID},
    )
    assert got.status_code == 200
    assert got.json()["items"][0]["payload"]["logic"] == "AND"


def test_query_config_unknown_schema_version_r32(client):
    """T-QUERY-R32-007-02: 未知 schema_version → 422 CONFIG_UNKNOWN_SCHEMA_VERSION。"""
    body = {
        "configType": "query_conditions",
        "schemaVersion": "9.9",
        "refType": "design_draft",
        "refId": REF_ID,
        "payload": {},
    }
    resp = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "CONFIG_UNKNOWN_SCHEMA_VERSION"


def test_query_config_invalid_payload_type_r32(client):
    """T-QUERY-R32-007-03: payload 非 object → 422 CONFIG_INVALID_PAYLOAD。"""
    body = {
        "configType": "query_conditions",
        "schemaVersion": "1.0",
        "refType": "design_draft",
        "refId": REF_ID,
        "payload": "not-an-object",
    }
    resp = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "CONFIG_INVALID_PAYLOAD"


def test_query_config_upsert_idempotent_r32(client):
    """T-QUERY-R32-007-04: 同 key 连续 PUT 两次 → 同 id、revision 2。"""
    body = {
        "configType": "compute_rules",
        "schemaVersion": "1.0",
        "refType": "design_draft",
        "refId": REF_ID,
        "payload": {"rules": []},
    }
    first = client.put("/api/v1/query/configs", headers=AUTH, json=body).json()
    second = client.put("/api/v1/query/configs", headers=AUTH, json=body).json()
    assert first["id"] == second["id"]
    assert second["revision"] == 2


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


def test_design_conditions_save_roundtrip_r32(client):
    """T-DESIGN-R32-001-01: 合法条件 PUT → GET 往返。"""
    ref = str(uuid.uuid4())
    put = client.put("/api/v1/designer/conditions", headers=AUTH, json=_valid_conditions(ref))
    assert put.status_code == 200
    got = client.get(
        "/api/v1/designer/conditions",
        headers=AUTH,
        params={"ref_type": "design_draft", "ref_id": ref},
    )
    assert got.status_code == 200
    assert got.json()["conditions"][0]["fieldId"] == "order_amount"


def test_design_conditions_empty_r32(client):
    """T-DESIGN-R32-001-02: 空 conditions → 422 DESIGN_EMPTY_CONDITIONS。"""
    ref = str(uuid.uuid4())
    body = {"schemaVersion": "1.0", "logic": "AND", "conditions": [], "refType": "design_draft", "refId": ref}
    resp = client.put("/api/v1/designer/conditions", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_EMPTY_CONDITIONS"


def test_design_conditions_unknown_operator_r32(client):
    """T-DESIGN-R32-001-03: 未知 operator → 422 DESIGN_INVALID_OPERATOR。"""
    ref = str(uuid.uuid4())
    body = _valid_conditions(ref)
    body["conditions"][0]["operator"] = "bogus"
    resp = client.put("/api/v1/designer/conditions", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_INVALID_OPERATOR"


def test_design_conditions_type_mismatch_r32(client):
    """T-DESIGN-R32-001-04: valueType=number 但 value='x' → 422 DESIGN_VALUE_TYPE_MISMATCH。"""
    ref = str(uuid.uuid4())
    body = _valid_conditions(ref)
    body["conditions"][0]["value"] = "x"
    resp = client.put("/api/v1/designer/conditions", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_VALUE_TYPE_MISMATCH"


def _valid_compute_rules(ref_id: str) -> dict:
    return {
        "schemaVersion": "1.0",
        "rules": [
            {
                "id": "total_amount",
                "name": "合计金额",
                "ruleType": "sum",
                "targetField": "amount",
                "expression": "sum(amount)",
                "dependsOn": [],
            }
        ],
        "refType": "design_draft",
        "refId": ref_id,
    }


def test_design_compute_rules_roundtrip_r32(client):
    """T-DESIGN-R32-002-01: 规则 PUT → GET 往返。"""
    ref = str(uuid.uuid4())
    put = client.put("/api/v1/designer/compute-rules", headers=AUTH, json=_valid_compute_rules(ref))
    assert put.status_code == 200
    got = client.get(
        "/api/v1/designer/compute-rules",
        headers=AUTH,
        params={"ref_type": "design_draft", "ref_id": ref},
    )
    assert got.json()["rules"][0]["id"] == "total_amount"


def test_design_compute_invalid_expression_r32(client):
    """T-DESIGN-R32-002-02: 非法 expression → 422 DESIGN_INVALID_EXPRESSION。"""
    ref = str(uuid.uuid4())
    body = _valid_compute_rules(ref)
    body["rules"][0]["expression"] = "DROP TABLE x"
    resp = client.put("/api/v1/designer/compute-rules", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_INVALID_EXPRESSION"


def test_design_compute_rule_cycle_r32(client):
    """T-DESIGN-R32-002-03: dependsOn 环 → 422 DESIGN_RULE_CYCLE。"""
    ref = str(uuid.uuid4())
    body = _valid_compute_rules(ref)
    body["rules"] = [
        {"id": "a", "name": "A", "ruleType": "sum", "targetField": "x", "expression": "sum(x)", "dependsOn": ["b"]},
        {"id": "b", "name": "B", "ruleType": "sum", "targetField": "y", "expression": "sum(y)", "dependsOn": ["a"]},
    ]
    resp = client.put("/api/v1/designer/compute-rules", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_RULE_CYCLE"


def test_design_conditions_and_compute_same_ref_r32(client):
    """T-DESIGN-R32-002-04: 同 ref_id 分别读取 conditions + compute_rules。"""
    ref = str(uuid.uuid4())
    assert client.put("/api/v1/designer/conditions", headers=AUTH, json=_valid_conditions(ref)).status_code == 200
    assert client.put("/api/v1/designer/compute-rules", headers=AUTH, json=_valid_compute_rules(ref)).status_code == 200
    cond = client.get("/api/v1/designer/conditions", headers=AUTH, params={"ref_type": "design_draft", "ref_id": ref})
    comp = client.get("/api/v1/designer/compute-rules", headers=AUTH, params={"ref_type": "design_draft", "ref_id": ref})
    assert cond.status_code == 200 and comp.status_code == 200
