from __future__ import annotations

import json
import os
import shutil
import sqlite3
import subprocess
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.auth.deps import UserContext

HIGH_RISK_WORDS = ("delete", "remove", "clear", "publish", "upload", "deploy", "release", "overwrite")
RUNNER_PATH = Path(__file__).with_name("node_plugin_runner.cjs")
REDACTED_VALUE = "[已脱敏]"
SENSITIVE_FIELD_TOKENS = (
    "secret",
    "password",
    "token",
    "key",
    "authorization",
    "credential",
    "cookie",
)


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _parse_json(value: str | None, default: Any) -> Any:
    try:
        return json.loads(value) if value else default
    except json.JSONDecodeError:
        return default


def _safe_name(name: str) -> str:
    cleaned = "".join(char if char.isalnum() or char in "-_" else "_" for char in name)
    return cleaned.strip("._") or "plugin"


def _needs_confirmation(name: str, metadata: dict[str, Any]) -> bool:
    """External plugin calls always require an explicit user approval.

    Plugin-provided metadata is untrusted and must never disable the platform's
    confirmation safeguard. The parameters are kept for a stable call contract
    and for future risk labelling.
    """
    del name, metadata
    return True


def _is_sensitive_field(name: object) -> bool:
    normalized = str(name).lower()
    return any(token in normalized for token in SENSITIVE_FIELD_TOKENS)


def _redact_config_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            str(key): REDACTED_VALUE if _is_sensitive_field(key) else _redact_config_value(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact_config_value(item) for item in value]
    return value


def _merge_redacted_config(existing: Any, updated: Any) -> Any:
    """Preserve stored secrets when a management UI submits their redacted placeholders."""
    if updated == REDACTED_VALUE:
        return existing
    if isinstance(existing, dict) and isinstance(updated, dict):
        return {
            str(key): _merge_redacted_config(existing.get(key), value)
            for key, value in updated.items()
        }
    if isinstance(existing, list) and isinstance(updated, list):
        return [
            _merge_redacted_config(existing[index], value) if index < len(existing) else value
            for index, value in enumerate(updated)
        ]
    return updated


def _audit_argument_summary(arguments: dict[str, Any]) -> dict[str, Any]:
    """Keep audit records useful without persisting user-supplied argument values."""
    return {"argumentKeys": sorted(str(key) for key in arguments)}


class PluginStore:
    """Global plugin registry. Plugin runtime receives only scoped user/session context."""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.plugin_dir = data_dir / "plugins"
        self.db_path = data_dir / "plugins.db"
        self.plugin_dir.mkdir(parents=True, exist_ok=True)
        self.initialize()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS agent_plugins (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    version TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    install_path TEXT NOT NULL,
                    source_type TEXT NOT NULL,
                    enabled INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL,
                    manifest_json TEXT NOT NULL,
                    config_json TEXT NOT NULL DEFAULT '{}',
                    health_message TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS agent_plugin_tools (
                    id TEXT PRIMARY KEY,
                    plugin_id TEXT NOT NULL,
                    original_name TEXT,
                    agent_name TEXT NOT NULL UNIQUE,
                    module_path TEXT NOT NULL,
                    protocol TEXT NOT NULL,
                    description TEXT NOT NULL,
                    parameters_json TEXT NOT NULL,
                    requires_confirmation INTEGER NOT NULL DEFAULT 0,
                    risk_level TEXT NOT NULL DEFAULT 'low',
                    enabled INTEGER NOT NULL DEFAULT 1,
                    compatibility_status TEXT NOT NULL,
                    error_message TEXT,
                    FOREIGN KEY(plugin_id) REFERENCES agent_plugins(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS agent_plugin_audit_logs (
                    id TEXT PRIMARY KEY,
                    plugin_id TEXT,
                    tool_id TEXT,
                    tool_name TEXT NOT NULL,
                    actor_id TEXT NOT NULL,
                    arguments_summary TEXT NOT NULL,
                    requires_confirmation INTEGER NOT NULL,
                    confirmation_status TEXT NOT NULL,
                    status TEXT NOT NULL,
                    duration_ms INTEGER,
                    error_message TEXT,
                    created_at TEXT NOT NULL
                );
                """
            )

    def list_plugins(self) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM agent_plugins ORDER BY updated_at DESC").fetchall()
        return [self._plugin_dict(row, include_tools=True) for row in rows]

    def get_plugin(self, plugin_id: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM agent_plugins WHERE id=?", (plugin_id,)).fetchone()
        return self._plugin_dict(row, include_tools=True) if row else None

    def get_plugin_by_name(self, name: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM agent_plugins WHERE name=?", (name,)).fetchone()
        return self._plugin_dict(row, include_tools=True) if row else None

    def list_public_plugins(self) -> list[dict[str, Any]]:
        return [self.public_plugin(plugin) for plugin in self.list_plugins()]

    def get_public_plugin(self, plugin_id: str) -> dict[str, Any] | None:
        plugin = self.get_plugin(plugin_id)
        return self.public_plugin(plugin) if plugin else None

    @staticmethod
    def public_plugin(plugin: dict[str, Any]) -> dict[str, Any]:
        """Return shareable metadata without paths, configuration, or raw errors."""
        return {
            "id": plugin["id"],
            "display_name": plugin["display_name"],
            "version": plugin["version"],
            "description": plugin["description"],
            "enabled": plugin["enabled"],
            "status": plugin["status"],
            "health_message": (
                "插件预检未通过"
                if plugin["status"] == "unhealthy"
                else "健康检查通过"
                if plugin["status"] == "ready"
                else None
            ),
            "tools": [
                {
                    "id": tool["id"],
                    "agent_name": tool["agent_name"],
                    "description": tool["description"],
                    "enabled": tool["enabled"],
                    "requires_confirmation": True,
                    "compatibility_status": tool["compatibility_status"],
                    "error_message": "插件工具不可用" if tool.get("error_message") else None,
                }
                for tool in plugin["tools"]
            ],
        }

    def _plugin_dict(self, row: sqlite3.Row, *, include_tools: bool) -> dict[str, Any]:
        plugin = dict(row)
        plugin["enabled"] = bool(plugin["enabled"])
        plugin["manifest"] = _parse_json(plugin.pop("manifest_json"), {})
        plugin["config"] = _parse_json(plugin.pop("config_json"), {})
        if include_tools:
            with self.connect() as conn:
                tool_rows = conn.execute(
                    "SELECT * FROM agent_plugin_tools WHERE plugin_id=? ORDER BY agent_name",
                    (plugin["id"],),
                ).fetchall()
            plugin["tools"] = [self._tool_dict(tool) for tool in tool_rows]
        return plugin

    @staticmethod
    def _tool_dict(row: sqlite3.Row) -> dict[str, Any]:
        tool = dict(row)
        tool["enabled"] = bool(tool["enabled"])
        tool["requires_confirmation"] = bool(tool["requires_confirmation"])
        tool["parameters"] = _parse_json(tool.pop("parameters_json"), {"type": "object", "properties": {}})
        return tool

    def upsert_plugin(
        self,
        manifest: dict[str, Any],
        install_path: Path,
        source_type: str,
        tools: list[dict[str, Any]],
        status: str,
        health_message: str,
    ) -> dict[str, Any]:
        existing = self.get_plugin_by_name(manifest["name"])
        plugin_id = existing["id"] if existing else str(uuid.uuid4())
        timestamp = _utc_now()
        with self.connect() as conn:
            conn.execute(
                """INSERT INTO agent_plugins(
                id,name,version,display_name,description,install_path,source_type,enabled,status,
                manifest_json,config_json,health_message,created_at,updated_at
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(name) DO UPDATE SET
                    version=excluded.version, display_name=excluded.display_name,
                    description=excluded.description, install_path=excluded.install_path,
                    source_type=excluded.source_type, status=excluded.status,
                    manifest_json=excluded.manifest_json, health_message=excluded.health_message,
                    updated_at=excluded.updated_at""",
                (
                    plugin_id,
                    manifest["name"],
                    str(manifest.get("version", "0.0.0")),
                    str(manifest.get("displayName", manifest["name"])),
                    str(manifest.get("description", "")),
                    str(install_path),
                    source_type,
                    int(not existing and status == "ready"),
                    status,
                    _json(manifest),
                    "{}" if not existing else _json(existing["config"]),
                    health_message,
                    timestamp,
                    timestamp,
                ),
            )
            conn.execute("DELETE FROM agent_plugin_tools WHERE plugin_id=?", (plugin_id,))
            for tool in tools:
                conn.execute(
                    """INSERT INTO agent_plugin_tools(
                    id,plugin_id,original_name,agent_name,module_path,protocol,description,parameters_json,
                    requires_confirmation,risk_level,enabled,compatibility_status,error_message
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        str(uuid.uuid4()),
                        plugin_id,
                        tool.get("original_name"),
                        tool["agent_name"],
                        tool["module_path"],
                        tool["protocol"],
                        tool.get("description", ""),
                        _json(tool.get("parameters", {"type": "object", "properties": {}})),
                        int(tool["requires_confirmation"]),
                        tool["risk_level"],
                        int(tool.get("enabled", True)),
                        tool["compatibility_status"],
                        tool.get("error_message"),
                    ),
                )
        return self.get_plugin(plugin_id) or {}

    def set_enabled(self, plugin_id: str, enabled: bool) -> dict[str, Any] | None:
        with self.connect() as conn:
            if enabled:
                conn.execute(
                    "UPDATE agent_plugins SET enabled=1,status='ready',updated_at=? WHERE id=?",
                    (_utc_now(), plugin_id),
                )
            else:
                conn.execute(
                    "UPDATE agent_plugins SET enabled=0,status='disabled',updated_at=? WHERE id=?",
                    (_utc_now(), plugin_id),
                )
        return self.get_plugin(plugin_id)

    def set_health(self, plugin_id: str, ok: bool, message: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            conn.execute(
                "UPDATE agent_plugins SET status=?,health_message=?,updated_at=? WHERE id=?",
                ("ready" if ok else "unhealthy", message, _utc_now(), plugin_id),
            )
        return self.get_plugin(plugin_id)

    def get_redacted_config(self, plugin_id: str) -> dict[str, Any] | None:
        plugin = self.get_plugin(plugin_id)
        return _redact_config_value(plugin["config"]) if plugin else None

    def set_config(self, plugin_id: str, config: dict[str, Any]) -> dict[str, Any] | None:
        plugin = self.get_plugin(plugin_id)
        if plugin is None:
            return None
        merged_config = _merge_redacted_config(plugin["config"], config)
        if not isinstance(merged_config, dict):
            raise TypeError("插件配置必须是 JSON 对象")
        with self.connect() as conn:
            conn.execute(
                "UPDATE agent_plugins SET config_json=?,updated_at=? WHERE id=?",
                (_json(merged_config), _utc_now(), plugin_id),
            )
        return self.get_plugin(plugin_id)

    def set_tool_enabled(self, plugin_id: str, tool_id: str, enabled: bool) -> dict[str, Any] | None:
        """Only allow activation changes; compatibility and confirmation are platform controlled."""
        with self.connect() as conn:
            conn.execute(
                "UPDATE agent_plugin_tools SET enabled=? WHERE id=? AND plugin_id=?",
                (int(enabled), tool_id, plugin_id),
            )
        return self.get_plugin(plugin_id)

    def delete_plugin(self, plugin_id: str) -> dict[str, Any] | None:
        plugin = self.get_plugin(plugin_id)
        if plugin is None:
            return None
        with self.connect() as conn:
            conn.execute("DELETE FROM agent_plugin_tools WHERE plugin_id=?", (plugin_id,))
            conn.execute("DELETE FROM agent_plugins WHERE id=?", (plugin_id,))
        return plugin

    def enabled_tools(self) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """SELECT t.*, p.install_path,p.config_json,p.name AS plugin_name
                FROM agent_plugin_tools t
                JOIN agent_plugins p ON p.id=t.plugin_id
                WHERE p.enabled=1 AND t.enabled=1 AND t.compatibility_status='compatible'"""
            ).fetchall()
        tools: list[dict[str, Any]] = []
        for row in rows:
            tool = self._tool_dict(row)
            tool["install_path"] = row["install_path"]
            tool["plugin_name"] = row["plugin_name"]
            tool["config"] = _parse_json(row["config_json"], {})
            tools.append(tool)
        return tools

    def audit(
        self,
        tool: dict[str, Any],
        actor_id: str,
        arguments: dict[str, Any],
        confirmation_status: str,
        status: str,
        duration_ms: int | None = None,
        error: str | None = None,
    ) -> None:
        with self.connect() as conn:
            conn.execute(
                """INSERT INTO agent_plugin_audit_logs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    str(uuid.uuid4()),
                    tool.get("plugin_id"),
                    tool.get("id"),
                    tool["agent_name"],
                    actor_id,
                    _json(_audit_argument_summary(arguments)),
                    1,
                    confirmation_status,
                    status,
                    duration_ms,
                    "插件执行失败" if error else None,
                    _utc_now(),
                ),
            )

    def logs(self, plugin_id: str) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """SELECT * FROM agent_plugin_audit_logs
                WHERE plugin_id=? ORDER BY created_at DESC LIMIT 200""",
                (plugin_id,),
            ).fetchall()
        logs: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            # Older records may predate value-free audit summaries; never re-expose them.
            item["arguments_summary"] = _json({"summary": "参数已脱敏"})
            item["error_message"] = "插件执行失败" if item.get("error_message") else None
            logs.append(item)
        return logs


class NodePluginRuntime:
    @staticmethod
    def run(command: str, payload: dict[str, Any], timeout: int = 30) -> dict[str, Any]:
        root_value = payload.get("pluginRoot")
        if not isinstance(root_value, str) or not root_value.strip():
            return {"ok": False, "error": "插件根目录无效"}
        root = Path(root_value).resolve()
        if not root.is_dir():
            return {"ok": False, "error": "插件根目录不存在"}
        try:
            process = subprocess.run(
                [
                    "node",
                    "--permission",
                    f"--allow-fs-read={root}{os.pathsep}{RUNNER_PATH.parent}",
                    str(RUNNER_PATH),
                    command,
                ],
                input=_json(payload),
                check=False,
                text=True,
                encoding="utf-8",
                errors="replace",
                capture_output=True,
                timeout=timeout,
                cwd=root,
                env={"PATH": os.environ.get("PATH", ""), "PLUGIN_RUNTIME": "1"},
            )
        except FileNotFoundError:
            return {"ok": False, "error": "未找到 Node.js，请安装并配置 Node.js 后重试。"}
        except subprocess.TimeoutExpired:
            return {"ok": False, "error": f"插件执行超时（{timeout} 秒）"}
        if process.returncode != 0:
            return {"ok": False, "error": "插件运行失败"}
        try:
            return json.loads(process.stdout or "")
        except (json.JSONDecodeError, TypeError):
            return {"ok": False, "error": "插件未返回有效响应"}


class PluginInstaller:
    def __init__(self, store: PluginStore):
        self.store = store

    def install_from_path(self, source_path: str, copy_to_managed: bool = True) -> dict[str, Any]:
        if not copy_to_managed:
            raise ValueError("插件必须复制到受控插件目录")
        source = Path(source_path).expanduser().resolve()
        manifest_path = source / "plugin.json"
        if not source.is_dir() or not manifest_path.is_file():
            raise ValueError("插件目录必须存在且包含 plugin.json")
        manifest = _parse_json(manifest_path.read_text(encoding="utf-8"), None)
        if not isinstance(manifest, dict) or not isinstance(manifest.get("name"), str):
            raise TypeError("plugin.json 缺少有效的 name")
        root = source
        if copy_to_managed:
            target = self.store.plugin_dir / f"{_safe_name(manifest['name'])}-{_safe_name(str(manifest.get('version', '0.0.0')))}"
            temporary = target.with_name(f".{target.name}-{uuid.uuid4().hex}")
            shutil.copytree(source, temporary, ignore=shutil.ignore_patterns("node_modules", ".git"))
            if target.exists():
                shutil.rmtree(target)
            temporary.replace(target)
            root = target
            self.install_dependencies(root)
        tools = self.discover_tools(root, manifest)
        health = self.health_check(root, tools)
        return self.store.upsert_plugin(
            manifest,
            root,
            "managed_copy" if copy_to_managed else "local_path",
            tools,
            "ready" if health["ok"] else "unhealthy",
            health.get("message", ""),
        )

    @staticmethod
    def install_dependencies(root: Path) -> None:
        if not (root / "package.json").exists():
            return
        result = subprocess.run(
            ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"],
            cwd=root,
            text=True,
            capture_output=True,
            check=False,
            timeout=300,
        )
        if result.returncode != 0:
            raise ValueError(f"npm install 失败：{(result.stderr or result.stdout)[-1000:]}")

    def discover_tools(self, root: Path, manifest: dict[str, Any]) -> list[dict[str, Any]]:
        components = manifest.get("components", {}) if isinstance(manifest.get("components"), dict) else {}
        modules = [(path, "tool") for path in components.get("tools", []) if isinstance(path, str)]
        for item in components.get("execTools", []):
            if isinstance(item, dict) and isinstance(item.get("module"), str):
                modules.append((item["module"], "exec"))
        tools: list[dict[str, Any]] = []
        for module_path, kind in modules:
            file_path = (root / module_path).resolve()
            if not file_path.is_relative_to(root.resolve()) or not file_path.is_file():
                tools.append(self.failed_tool(manifest["name"], module_path, "模块文件不存在或越出插件目录"))
                continue
            result = NodePluginRuntime.run(
                "discover", {"pluginRoot": str(root), "modulePath": module_path}, timeout=20
            )
            if not result.get("ok"):
                tools.append(self.failed_tool(manifest["name"], module_path, result.get("error", "无法识别模块")))
                continue
            metadata = result["tool"]
            original_name = str(metadata.get("name") or Path(module_path).stem)
            needs_confirmation = _needs_confirmation(original_name, metadata)
            tools.append(
                {
                    "original_name": original_name,
                    "agent_name": f"plugin_{_safe_name(manifest['name'])}_{_safe_name(original_name)}",
                    "module_path": module_path,
                    "protocol": result["protocol"],
                    "description": str(metadata.get("description") or original_name),
                    "parameters": metadata.get("parameters") or {"type": "object", "properties": {}},
                    "requires_confirmation": needs_confirmation,
                    "risk_level": "high" if needs_confirmation else "low",
                    "enabled": False,
                    "compatibility_status": "compatible",
                    "error_message": None,
                }
            )
        return tools

    @staticmethod
    def failed_tool(plugin_name: str, module_path: str, error: str) -> dict[str, Any]:
        name = Path(module_path).stem
        return {
            "original_name": name,
            "agent_name": f"plugin_{_safe_name(plugin_name)}_{_safe_name(name)}",
            "module_path": module_path,
            "protocol": "unknown",
            "description": f"未识别工具：{name}",
            "parameters": {"type": "object", "properties": {}},
            "requires_confirmation": True,
            "risk_level": "high",
            "enabled": False,
            "compatibility_status": "manual_required",
            "error_message": error,
        }

    def health_check(
        self, root: Path, tools: list[dict[str, Any]], config: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        health_tools = [
            tool
            for tool in tools
            if tool["compatibility_status"] == "compatible" and "health" in tool["agent_name"].lower()
        ]
        if not health_tools:
            return {"ok": True, "message": "未发现健康检查工具，已完成静态校验"}
        tool = next((item for item in health_tools if item["protocol"] == "exec_tool"), health_tools[0])
        result = NodePluginRuntime.run(
            "invoke",
            {
                "pluginRoot": str(root),
                "modulePath": tool["module_path"],
                "protocol": tool["protocol"],
                "args": {},
                "context": {"pluginConfig": config or {}, "workspaceRoot": str(root)},
            },
            timeout=30,
        )
        if not result.get("ok"):
            return {"ok": False, "message": result.get("error", "健康检查失败")}
        execution = result.get("result", {})
        if isinstance(execution, dict) and execution.get("ok") is False:
            return {"ok": False, "message": str(execution.get("error", "健康检查失败"))}
        return {"ok": True, "message": "健康检查通过"}


class ExternalPluginTool:
    def __init__(self, tool: dict[str, Any], store: PluginStore):
        self.tool = tool
        self.store = store

    def execute(
        self,
        *,
        user: UserContext,
        session_id: str,
        arguments: dict[str, Any],
        confirmation_status: str,
    ) -> dict[str, Any]:
        if confirmation_status != "approved":
            blocked = {
                "error": {
                    "code": "TOOL_CONFIRMATION_REQUIRED",
                    "message": "外部插件调用必须经用户确认后执行",
                }
            }
            self.store.audit(
                self.tool,
                user.id,
                arguments,
                confirmation_status,
                "blocked",
                error="confirmation_required",
            )
            return blocked

        started = time.monotonic()
        response = NodePluginRuntime.run(
            "invoke",
            {
                "pluginRoot": self.tool["install_path"],
                "modulePath": self.tool["module_path"],
                "protocol": self.tool["protocol"],
                "args": arguments,
                "context": {
                    "pluginConfig": self.tool["config"],
                    # Plugins are sandboxed to their own managed directory. Do not disclose
                    # the server workspace or the caller's profile beyond an opaque ID.
                    "workspaceRoot": self.tool["install_path"],
                    "sessionId": session_id,
                    "user": {"id": user.id},
                },
            },
            timeout=180,
        )
        elapsed = int((time.monotonic() - started) * 1000)
        self.store.audit(
            self.tool,
            user.id,
            arguments,
            confirmation_status,
            "success" if response.get("ok") else "failed",
            elapsed,
            response.get("error"),
        )
        return response.get("result", response)
