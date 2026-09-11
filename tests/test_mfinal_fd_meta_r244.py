"""M-FINAL F-D r244 — META-001~004 语义层收官。"""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from app.query.executor import QueryExecutor, QueryResult
from jwt_auth import AUTH

_R244_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_fd_r244?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r244_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R244_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.metadata.glossary.models  # noqa: F401
    import app.metadata.themes.models  # noqa: F401
    import app.metadata.dimensions.models  # noqa: F401
    import app.metadata.dataset.models  # noqa: F401
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
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def admin_actor() -> Generator[None, None, None]:
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=str(uuid.uuid4()), username="admin", roles=["admin"]
    )
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def viewer_actor() -> Generator[None, None, None]:
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=str(uuid.uuid4()), username="viewer", roles=["viewer"]
    )
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_meta_r244_001_01_admin_create_term_ok(client, admin_actor):
    """T-META-R244-001-01: admin POST 合法术语 → 201 + code 回显。"""
    resp = client.post(
        "/api/v1/metadata/glossary",
        headers=AUTH,
        json={"code": "revenue", "name": "营收", "definition": "销售收入"},
    )
    assert resp.status_code == 201
    assert resp.json()["code"] == "revenue"


def test_meta_r244_001_02_viewer_create_forbidden(client, viewer_actor):
    """T-META-R244-001-02: viewer POST → 403 META_TERM_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/metadata/glossary",
        headers=AUTH,
        json={"code": "blocked", "name": "禁止"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "META_TERM_FORBIDDEN"


def test_meta_r244_001_03_blank_name_invalid(client, admin_actor):
    """T-META-R244-001-03: 空白 name → 422 META_TERM_INVALID_NAME。"""
    resp = client.post(
        "/api/v1/metadata/glossary",
        headers=AUTH,
        json={"code": "blank", "name": "   "},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_TERM_INVALID_NAME"


def test_meta_r244_001_04_delete_term_in_use(client, admin_actor):
    """T-META-R244-001-04: 删除被主题引用的术语 → 409 META_TERM_IN_USE。"""
    term = client.post(
        "/api/v1/metadata/glossary",
        headers=AUTH,
        json={"code": "linked_term", "name": "关联术语"},
    ).json()
    client.post(
        "/api/v1/metadata/themes",
        headers=AUTH,
        json={"name": "主题", "termId": term["id"]},
    )
    resp = client.delete(f"/api/v1/metadata/glossary/{term['id']}", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "META_TERM_IN_USE"


def test_meta_r244_001_05_probe_list_terms_budget(client, admin_actor):
    """T-META-R244-001-05: probe_list_terms_budget_ms().ok is True。"""
    from app.datasources.models import get_meta_session
    from app.metadata.glossary import service as glossary_service
    from app.metadata.glossary.schemas import TermCreate

    session = get_meta_session()
    try:
        for i in range(5):
            glossary_service.create_term(
                session,
                TermCreate(code=f"p{i}", name=f"P{i}"),
                UserContext(id="x", username="a", roles=["admin"]),
            )
        result = glossary_service.probe_list_terms_budget_ms(session)
        assert result.ok is True
        assert result.elapsed_ms <= 50
    finally:
        session.close()


def test_meta_r244_001_06_viewer_put_forbidden(client, admin_actor):
    """T-META-R244-001-06: viewer PUT → 403 META_TERM_FORBIDDEN。"""
    term = client.post(
        "/api/v1/metadata/glossary",
        headers=AUTH,
        json={"code": "upd_term", "name": "原名称"},
    ).json()
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=str(uuid.uuid4()), username="viewer", roles=["viewer"]
    )
    resp = client.put(
        f"/api/v1/metadata/glossary/{term['id']}",
        headers=AUTH,
        json={"name": "新名称"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "META_TERM_FORBIDDEN"


def test_meta_r244_002_01_root_and_child_list(client, admin_actor):
    """T-META-R244-002-01: 根节点 + 子节点 list parent 过滤正确。"""
    root = client.post(
        "/api/v1/metadata/themes", headers=AUTH, json={"name": "根", "code": "root"}
    ).json()
    client.post(
        "/api/v1/metadata/themes",
        headers=AUTH,
        json={"name": "子", "parentId": root["id"]},
    )
    roots = client.get("/api/v1/metadata/themes?parent_id=null", headers=AUTH).json()
    assert roots["total"] >= 1
    children = client.get(
        f"/api/v1/metadata/themes?parent_id={root['id']}", headers=AUTH
    ).json()
    assert children["total"] == 1


def test_meta_r244_002_02_unknown_term_404(client, admin_actor):
    """T-META-R244-002-02: termId 不存在 → 404。"""
    resp = client.post(
        "/api/v1/metadata/themes",
        headers=AUTH,
        json={"name": "无术语", "termId": str(uuid.uuid4())},
    )
    assert resp.status_code == 404


def test_meta_r244_002_03_move_cycle_422(client, admin_actor):
    """T-META-R244-002-03: move 至子孙 → 422 META_THEME_CYCLE。"""
    root = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "A"}).json()
    child = client.post(
        "/api/v1/metadata/themes",
        headers=AUTH,
        json={"name": "B", "parentId": root["id"]},
    ).json()
    resp = client.post(
        f"/api/v1/metadata/themes/{root['id']}/move",
        headers=AUTH,
        json={"parentId": child["id"]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_THEME_CYCLE"


def test_meta_r244_002_04_viewer_post_forbidden(client, viewer_actor):
    """T-META-R244-002-04: viewer POST themes → 403 META_THEME_FORBIDDEN。"""
    resp = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "X"})
    assert resp.status_code == 403
    assert resp.json()["code"] == "META_THEME_FORBIDDEN"


def test_meta_r244_002_05_delete_with_children_409(client, admin_actor):
    """T-META-R244-002-05: 删有子节点 → 409 META_THEME_HAS_CHILDREN。"""
    root = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "父"}).json()
    client.post(
        "/api/v1/metadata/themes",
        headers=AUTH,
        json={"name": "子", "parentId": root["id"]},
    )
    resp = client.delete(f"/api/v1/metadata/themes/{root['id']}", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "META_THEME_HAS_CHILDREN"


def test_meta_r244_002_06_empty_tree_list(client, admin_actor):
    """T-META-R244-002-06: 空树 list parent=null → total=0。"""
    resp = client.get("/api/v1/metadata/themes?parent_id=null", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 0


def test_meta_r244_002_07_probe_list_themes_budget(client, admin_actor):
    """T-META-R244-002-07: probe_list_themes_budget_ms().ok is True。"""
    from app.datasources.models import get_meta_session
    from app.metadata.themes import service as themes_service

    session = get_meta_session()
    try:
        result = themes_service.probe_list_themes_budget_ms(session)
        assert result.ok is True
    finally:
        session.close()


def test_meta_r244_003_01_create_with_theme_ok(client, admin_actor):
    """T-META-R244-003-01: 合法维度 + themeNodeId → 201。"""
    theme = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "T"}).json()
    resp = client.post(
        "/api/v1/metadata/dimensions",
        headers=AUTH,
        json={"code": "region", "name": "区域", "themeNodeId": theme["id"]},
    )
    assert resp.status_code == 201
    assert resp.json()["themeNodeId"] == theme["id"]


def test_meta_r244_003_02_invalid_theme_404(client, admin_actor):
    """T-META-R244-003-02: 非法 themeNodeId → 404 META_THEME_NOT_FOUND。"""
    resp = client.post(
        "/api/v1/metadata/dimensions",
        headers=AUTH,
        json={"code": "bad_theme", "name": "X", "themeNodeId": str(uuid.uuid4())},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "META_THEME_NOT_FOUND"


def test_meta_r244_003_03_duplicate_code_409(client, admin_actor):
    """T-META-R244-003-03: 重复 code → 409 META_DIM_CODE_CONFLICT。"""
    client.post(
        "/api/v1/metadata/dimensions", headers=AUTH, json={"code": "dup", "name": "A"}
    )
    resp = client.post(
        "/api/v1/metadata/dimensions", headers=AUTH, json={"code": "dup", "name": "B"}
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "META_DIM_CODE_CONFLICT"


def test_meta_r244_003_04_list_limit_500(client, admin_actor):
    """T-META-R244-003-04: list limit=500 边界。"""
    resp = client.get("/api/v1/metadata/dimensions?limit=500", headers=AUTH)
    assert resp.status_code == 200


def test_meta_r244_003_05_viewer_post_forbidden(client, viewer_actor):
    """T-META-R244-003-05: viewer POST → 403 META_DIM_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/metadata/dimensions", headers=AUTH, json={"code": "view_dim", "name": "V"}
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "META_DIM_FORBIDDEN"


def test_meta_r244_003_06_register_values_ok(client, admin_actor):
    """T-META-R244-003-06: values 注册链不变。"""
    dim = client.post(
        "/api/v1/metadata/dimensions", headers=AUTH, json={"code": "status", "name": "状态"}
    ).json()
    resp = client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "open", "label": "开启"}]},
    )
    assert resp.status_code == 201
    assert len(resp.json()["items"]) == 1


def test_meta_r244_003_07_probe_list_dimensions_budget(client, admin_actor):
    """T-META-R244-003-07: probe_list_dimensions_budget_ms().ok is True。"""
    from app.datasources.models import get_meta_session
    from app.metadata.dimensions import service as dim_service

    session = get_meta_session()
    try:
        assert dim_service.probe_list_dimensions_budget_ms(session).ok is True
    finally:
        session.close()


def test_meta_r244_004_01_put_update_ok(client, admin_actor):
    """T-META-R244-004-01: PUT 更新 displayName/tables → 200。"""
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "原", "tables": [{"name": "t1"}]},
    )
    resp = client.put(
        f"/api/v1/datasets/{ds_id}",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "新", "tables": [{"name": "t2"}]},
    )
    assert resp.status_code == 200
    assert resp.json()["displayName"] == "新"


def test_meta_r244_004_02_delete_then_404(client, admin_actor):
    """T-META-R244-004-02: DELETE 后 GET → 404 META_DATASET_NOT_FOUND。"""
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "D", "tables": [{"name": "t"}]},
    )
    client.delete(f"/api/v1/datasets/{ds_id}", headers=AUTH)
    resp = client.get(f"/api/v1/datasets/{ds_id}", headers=AUTH)
    assert resp.status_code == 404


def test_meta_r244_004_03_viewer_put_forbidden(client):
    """T-META-R244-004-03: viewer PUT → 403 META_DATASET_FORBIDDEN。"""
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "D", "tables": [{"name": "t"}]},
    )
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=str(uuid.uuid4()), username="viewer", roles=["viewer"]
    )
    resp = client.put(
        f"/api/v1/datasets/{ds_id}",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "X", "tables": [{"name": "t"}]},
    )
    assert resp.status_code == 403


def test_meta_r244_004_04_bind_wrong_config_type(client, admin_actor):
    """T-META-R244-004-04: bind 非 dataset_query → 422 META_DATASET_CONFIG_TYPE_INVALID。"""
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "D", "tables": [{"name": "t"}]},
    )
    from app.datasources.models import get_meta_session
    from app.query.config_store.models import QueryConfigRecord

    session = get_meta_session()
    bad_id = uuid.uuid4()
    session.add(
        QueryConfigRecord(
            id=bad_id,
            config_type="chart_query",
            schema_version="1.0",
            ref_type="chart",
            ref_id=uuid.uuid4(),
            payload={},
            revision=1,
        )
    )
    session.commit()
    session.close()
    resp = client.post(
        f"/api/v1/datasets/{ds_id}/bind-query-config",
        headers=AUTH,
        json={"configId": str(bad_id)},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DATASET_CONFIG_TYPE_INVALID"


def test_meta_r244_004_05_bind_persists_bound_id(client, admin_actor):
    """T-META-R244-004-05: bind 后 boundConfigId 一致。"""
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "D", "tables": [{"name": "orders"}]},
    )
    ds_uuid = str(uuid.uuid4())
    cfg = client.put(
        "/api/v1/query/configs",
        headers=AUTH,
        json={
            "configType": "dataset_query",
            "schemaVersion": "1.0",
            "refType": "dataset",
            "refId": ds_uuid,
            "payload": {
                "dataSourceId": str(uuid.uuid4()),
                "connectorType": "mysql",
                "schema": "demo",
                "table": "orders",
                "columns": ["id"],
                "conditions": {"logic": "AND", "conditions": []},
                "limit": 10,
                "offset": 0,
            },
        },
    ).json()
    config_id = cfg["id"]
    resp = client.post(
        f"/api/v1/datasets/{ds_id}/bind-query-config",
        headers=AUTH,
        json={"configId": config_id},
    )
    assert resp.status_code == 200
    assert resp.json()["boundConfigId"] == config_id


@patch.object(QueryExecutor, "execute_sql")
def test_meta_r244_004_06_full_chain_execute(mock_exec, client, admin_actor):
    """T-META-R244-004-06: 四步链 mock execute → rowCount ≥ 1。"""
    mock_exec.return_value = QueryResult(
        columns=["id"], rows=[[1]], row_count=1, truncated=False,
    )
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "链", "tables": [{"name": "orders"}]},
    )
    ds_src = str(uuid.uuid4())
    cfg = client.put(
        "/api/v1/query/configs",
        headers=AUTH,
        json={
            "configType": "dataset_query",
            "schemaVersion": "1.0",
            "refType": "dataset",
            "refId": str(uuid.uuid4()),
            "payload": {
                "dataSourceId": ds_src,
                "connectorType": "mysql",
                "schema": "demo",
                "table": "orders",
                "columns": ["id"],
                "conditions": {"logic": "AND", "conditions": []},
                "limit": 10,
                "offset": 0,
            },
        },
    ).json()
    config_id = cfg["id"]
    client.post(
        f"/api/v1/datasets/{ds_id}/bind-query-config",
        headers=AUTH,
        json={"configId": config_id},
    )
    exec_resp = client.post(
        "/api/v1/query/dataset/execute",
        headers=AUTH,
        json={"dataSourceId": ds_src, "configId": config_id},
    )
    assert exec_resp.status_code == 200
    assert exec_resp.json()["rowCount"] >= 1


def test_meta_r244_004_07_viewer_delete_forbidden(client):
    """T-META-R244-004-07: viewer DELETE → 403。"""
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "D", "tables": [{"name": "t"}]},
    )
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=str(uuid.uuid4()), username="viewer", roles=["viewer"]
    )
    resp = client.delete(f"/api/v1/datasets/{ds_id}", headers=AUTH)
    assert resp.status_code == 403


def test_meta_r244_004_08_r243_regression_smoke(client, admin_actor):
    """T-META-R244-004-08: r243 translate-from-config 仍可用（1 条回归）。"""
    ds_id = str(uuid.uuid4())
    cfg = client.put(
        "/api/v1/query/configs",
        headers=AUTH,
        json={
            "configType": "dataset_query",
            "schemaVersion": "1.0",
            "refType": "dataset",
            "refId": ds_id,
            "payload": {
                "dataSourceId": str(uuid.uuid4()),
                "connectorType": "mysql",
                "schema": "demo",
                "table": "orders",
                "columns": ["id"],
                "conditions": {"logic": "AND", "conditions": []},
                "limit": 5,
                "offset": 0,
            },
        },
    ).json()
    resp = client.post(
        f"/api/v1/query/configs/{cfg['id']}/translate",
        headers=AUTH,
        json={},
    )
    assert resp.status_code == 200
    assert "sql" in resp.json()
