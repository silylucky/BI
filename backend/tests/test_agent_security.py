from __future__ import annotations

import json
from pathlib import Path

from app.agent.confirmations import ConfirmationStore
from app.agent.plugins import ExternalPluginTool, PluginInstaller, PluginStore
from app.agent.session_store import SessionStore
from app.agent.tools import CreateDataScreenTool, ListDataSourcesTool
from app.auth.deps import UserContext


def _user() -> UserContext:
    return UserContext(
        id="user-1",
        username="tester",
        roles=["viewer"],
        permissions=set(),
    )


def _plugin(store: PluginStore) -> dict[str, object]:
    return store.upsert_plugin(
        {
            "name": "sample-plugin",
            "version": "1.0.0",
            "displayName": "Sample plugin",
            "description": "Test plugin",
        },
        store.plugin_dir,
        "managed_copy",
        [
            {
                "original_name": "sample",
                "agent_name": "plugin_sample_plugin_sample",
                "module_path": "tool.cjs",
                "protocol": "standard",
                "description": "Test tool",
                "parameters": {"type": "object", "properties": {}},
                "requires_confirmation": True,
                "risk_level": "high",
                "enabled": False,
                "compatibility_status": "compatible",
                "error_message": None,
            }
        ],
        "ready",
        "ok",
    )


def test_root_admin_agent_lists_managed_datasources(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_list_data_sources(_db, **kwargs):
        captured.update(kwargs)
        return type("Response", (), {"model_dump": lambda self, **_kwargs: {"items": []}})()

    monkeypatch.setattr("app.agent.tools.datasource_service.list_data_sources", fake_list_data_sources)

    ListDataSourcesTool().execute(
        db=object(),
        user=UserContext(id="admin", username="admin", roles=["admin"], is_root=True),
        arguments={},
    )

    assert captured["is_root"] is True
    assert captured["include_managed"] is True


def test_agent_data_screen_tool_is_confirmation_gated_and_builds_published_assets(monkeypatch) -> None:
    import uuid

    from app.agent import tools as agent_tools

    actor_id = uuid.uuid4()
    datasource_id = uuid.uuid4()
    config_id = uuid.uuid4()
    component_id = uuid.uuid4()
    dashboard_id = uuid.uuid4()
    created: dict[str, object] = {}

    class FakeDb:
        def get(self, model, identity):
            assert model is agent_tools.DataSource
            assert identity == datasource_id
            return type("DataSourceRow", (), {"deleted_at": None, "type": "mysql"})()

    user = UserContext(
        id=str(actor_id),
        username="admin",
        roles=["admin"],
        permissions={"datasource:read", "dataset:manage", "dashboard:edit", "viz:component.manage"},
        is_root=True,
    )

    monkeypatch.setattr(agent_tools, "assert_visible", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        agent_tools.metadata_service,
        "list_columns",
        lambda *_args, **_kwargs: type("Columns", (), {"items": [type("Column", (), {"name": "sale_date"})(), type("Column", (), {"name": "amount"})()]})(),
    )
    monkeypatch.setattr(
        agent_tools.dataset_service,
        "create_dataset",
        lambda payload, _user: type("Dataset", (), {"dataset_id": payload.dataset_id})(),
    )
    monkeypatch.setattr(
        agent_tools,
        "upsert_config",
        lambda *_args, **_kwargs: type("Config", (), {"id": config_id})(),
    )
    monkeypatch.setattr(
        agent_tools.dataset_service,
        "bind_query_config",
        lambda generated_dataset_id, _config_id, _user: type("Dataset", (), {"dataset_id": generated_dataset_id})(),
    )
    monkeypatch.setattr(
        agent_tools,
        "execute_dataset_from_config",
        lambda *_args, **_kwargs: type("Preview", (), {"row_count": 3})(),
    )
    monkeypatch.setattr(
        agent_tools.component_service,
        "create_component",
        lambda _db, payload, _user: type("Component", (), {"id": component_id, "name": payload.name})(),
    )
    monkeypatch.setattr(
        agent_tools.component_service,
        "publish_component",
        lambda _db, _component_id, _user: type("Component", (), {"id": component_id, "name": "销售趋势"})(),
    )
    monkeypatch.setattr(
        agent_tools.dash_service,
        "create_dashboard",
        lambda _db, payload, **_kwargs: type("Dashboard", (), {"id": dashboard_id, "name": payload.name})(),
    )

    def fake_update_layout(_db, received_dashboard_id, layout):
        created["layout"] = layout
        assert received_dashboard_id == dashboard_id
        return type("Dashboard", (), {"id": dashboard_id, "name": "销售大屏"})()

    monkeypatch.setattr(agent_tools.dash_service, "update_layout", fake_update_layout)

    tool = CreateDataScreenTool()
    assert tool.requires_confirmation is True
    result = tool.execute(
        FakeDb(),
        user,
        {
            "name": "销售大屏",
            "sources": [{"key": "sales", "dataSourceId": str(datasource_id), "schema": "public", "table": "sales", "columns": ["sale_date", "amount"]}],
            "components": [{"name": "销售趋势", "sourceKey": "sales", "chartType": "line", "dimensions": [{"field": "sale_date"}], "metrics": [{"field": "amount"}]}],
        },
    )

    assert result["dataScreen"]["id"] == str(dashboard_id)
    assert result["components"][0]["id"] == str(component_id)
    assert result["components"][0]["name"] == "销售趋势"
    assert result["components"][0]["datasetId"].startswith("agent-")
    assert result["components"][0]["previewRows"] == 3
    assert result["failures"] == []
    layout = created["layout"]
    assert layout["styleConfig"]["surfaceKind"] == "data-screen"
    assert layout["widgets"][0]["chartConfig"]["mode"] == "dataset"


def test_plugin_metadata_and_audit_logs_exclude_secrets(tmp_path: Path) -> None:
    store = PluginStore(tmp_path)
    plugin = _plugin(store)
    plugin_id = str(plugin["id"])
    store.set_config(plugin_id, {"apiToken": "keep-private", "region": "cn"})

    public = store.public_plugin(store.get_plugin(plugin_id) or {})
    assert "config" not in public
    assert "install_path" not in public
    assert store.get_redacted_config(plugin_id) == {"apiToken": "[已脱敏]", "region": "cn"}

    tool = store.enabled_tools()
    assert tool == []
    stored_plugin = store.get_plugin(plugin_id) or {}
    tool_record = stored_plugin["tools"][0]
    store.audit(tool_record, "user-1", {"password": "secret", "query": "select *"}, "approved", "success")
    logs = store.logs(plugin_id)
    assert logs[0]["arguments_summary"] == json.dumps({"summary": "参数已脱敏"}, ensure_ascii=False)
    assert "select" not in logs[0]["arguments_summary"]


def test_plugin_configuration_preserves_redacted_secret_placeholder(tmp_path: Path) -> None:
    store = PluginStore(tmp_path)
    plugin = _plugin(store)
    plugin_id = str(plugin["id"])
    store.set_config(plugin_id, {"apiToken": "original-secret", "region": "cn"})
    store.set_config(plugin_id, {"apiToken": "[已脱敏]", "region": "us"})

    assert (store.get_plugin(plugin_id) or {})["config"] == {
        "apiToken": "original-secret",
        "region": "us",
    }


def test_external_plugin_never_executes_without_approval(tmp_path: Path) -> None:
    store = PluginStore(tmp_path)
    plugin = _plugin(store)
    tool = (plugin["tools"])[0]
    result = ExternalPluginTool(tool, store).execute(
        user=_user(),
        session_id="session-1",
        arguments={"query": "should-not-run"},
        confirmation_status="not_required",
    )

    assert result["error"]["code"] == "TOOL_CONFIRMATION_REQUIRED"
    logs = store.logs(str(plugin["id"]))
    assert logs[0]["status"] == "blocked"


def test_plugin_installer_rejects_unmanaged_source(tmp_path: Path) -> None:
    store = PluginStore(tmp_path / "data")
    source = tmp_path / "plugin"
    source.mkdir()
    (source / "plugin.json").write_text('{"name":"sample"}', encoding="utf-8")

    try:
        PluginInstaller(store).install_from_path(str(source), copy_to_managed=False)
    except ValueError as error:
        assert "受控插件目录" in str(error)
    else:
        raise AssertionError("unmanaged plugin source was accepted")


def test_confirmation_is_user_bound_single_use_and_persistent(tmp_path: Path) -> None:
    path = tmp_path / "confirmations.db"
    store = ConfirmationStore(path, ttl_seconds=60)
    store.create(
        "confirmation-1",
        user_id="user-1",
        session_id="session-1",
        tool="plugin_sample_plugin_sample",
        arguments={"x": 1},
        messages=[{"role": "assistant", "content": "confirm"}],
        tool_call_id="call-1",
    )

    restarted_store = ConfirmationStore(path, ttl_seconds=60)
    assert restarted_store.consume("confirmation-1", "user-2") is None
    pending = restarted_store.consume("confirmation-1", "user-1")
    assert pending is not None
    assert pending.arguments == {"x": 1}
    assert restarted_store.consume("confirmation-1", "user-1") is None


def test_session_history_is_user_scoped_and_persistent(tmp_path: Path) -> None:
    path = tmp_path / "sessions.db"
    store = SessionStore(path, max_messages=2)
    store.set_history(
        "user-1",
        "session-1",
        [
            {"role": "user", "content": "one"},
            {"role": "assistant", "content": "two"},
            {"role": "user", "content": "three"},
        ],
    )

    restarted_store = SessionStore(path, max_messages=2)
    assert restarted_store.get_history("user-1", "session-1") == [
        {"role": "assistant", "content": "two"},
        {"role": "user", "content": "three"},
    ]
    assert restarted_store.get_history("user-2", "session-1") == []
