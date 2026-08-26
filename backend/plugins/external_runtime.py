import json
import os
import shutil
import sqlite3
import subprocess
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from plugins.base import BasePlugin

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data"
PLUGIN_DIR = DATA_DIR / "plugins"
DB_PATH = DATA_DIR / "plugins.db"
RUNNER_PATH = Path(__file__).with_name("node_plugin_runner.cjs")
HIGH_RISK_WORDS = ("delete", "remove", "clear", "publish", "upload", "deploy", "release", "overwrite")


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_value(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def parse_json(value: str | None, default: Any) -> Any:
    try:
        return json.loads(value) if value else default
    except json.JSONDecodeError:
        return default


def require_safe_name(name: str) -> str:
    cleaned = "".join(char if char.isalnum() or char in "-_" else "_" for char in name)
    return cleaned.strip("._") or "plugin"


class PluginStore:
    def __init__(self, db_path: Path = DB_PATH):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        PLUGIN_DIR.mkdir(parents=True, exist_ok=True)
        self.db_path = db_path
        self.initialize()

    def connect(self):
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def initialize(self):
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS plugins (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, version TEXT NOT NULL,
                    display_name TEXT NOT NULL, description TEXT NOT NULL, install_path TEXT NOT NULL,
                    source_type TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL, manifest_json TEXT NOT NULL, config_json TEXT NOT NULL DEFAULT '{}',
                    health_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS plugin_tools (
                    id TEXT PRIMARY KEY, plugin_id TEXT NOT NULL, original_name TEXT,
                    agent_name TEXT NOT NULL UNIQUE, module_path TEXT NOT NULL, protocol TEXT NOT NULL,
                    description TEXT NOT NULL, parameters_json TEXT NOT NULL, requires_confirmation INTEGER NOT NULL DEFAULT 0,
                    risk_level TEXT NOT NULL DEFAULT 'low', enabled INTEGER NOT NULL DEFAULT 1,
                    compatibility_status TEXT NOT NULL, error_message TEXT,
                    FOREIGN KEY(plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS plugin_audit_logs (
                    id TEXT PRIMARY KEY, plugin_id TEXT, tool_id TEXT, tool_name TEXT NOT NULL,
                    arguments_summary TEXT NOT NULL, requires_confirmation INTEGER NOT NULL,
                    confirmation_status TEXT NOT NULL, status TEXT NOT NULL, duration_ms INTEGER,
                    error_message TEXT, created_at TEXT NOT NULL
                );
                """
            )

    def list_plugins(self) -> list[dict]:
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM plugins ORDER BY updated_at DESC").fetchall()
        return [self.plugin_dict(row, include_tools=True) for row in rows]

    def get_plugin(self, plugin_id: str) -> dict | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM plugins WHERE id = ?", (plugin_id,)).fetchone()
        return self.plugin_dict(row, include_tools=True) if row else None

    def get_plugin_by_name(self, name: str) -> dict | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM plugins WHERE name = ?", (name,)).fetchone()
        return self.plugin_dict(row, include_tools=True) if row else None

    def plugin_dict(self, row, include_tools: bool = False) -> dict:
        plugin = dict(row)
        plugin["enabled"] = bool(plugin["enabled"])
        plugin["manifest"] = parse_json(plugin.pop("manifest_json"), {})
        plugin["config"] = parse_json(plugin.pop("config_json"), {})
        if include_tools:
            with self.connect() as conn:
                tool_rows = conn.execute("SELECT * FROM plugin_tools WHERE plugin_id = ? ORDER BY agent_name", (plugin["id"],)).fetchall()
            plugin["tools"] = [self.tool_dict(tool) for tool in tool_rows]
        return plugin

    @staticmethod
    def tool_dict(row) -> dict:
        tool = dict(row)
        tool["enabled"] = bool(tool["enabled"])
        tool["requires_confirmation"] = bool(tool["requires_confirmation"])
        tool["parameters"] = parse_json(tool.pop("parameters_json"), {"type": "object", "properties": {}})
        return tool

    def upsert_plugin(self, manifest: dict, install_path: Path, source_type: str, tools: list[dict], status: str, health_message: str):
        existing = self.get_plugin_by_name(manifest["name"])
        plugin_id = existing["id"] if existing else str(uuid.uuid4())
        timestamp = now()
        with self.connect() as conn:
            conn.execute(
                """INSERT INTO plugins(id,name,version,display_name,description,install_path,source_type,enabled,status,manifest_json,config_json,health_message,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(name) DO UPDATE SET version=excluded.version,display_name=excluded.display_name,description=excluded.description,
                install_path=excluded.install_path,source_type=excluded.source_type,status=excluded.status,manifest_json=excluded.manifest_json,
                health_message=excluded.health_message,updated_at=excluded.updated_at""",
                (plugin_id, manifest["name"], manifest.get("version", "0.0.0"), manifest.get("displayName", manifest["name"]),
                 manifest.get("description", ""), str(install_path), source_type, int(not existing and status == "ready"), status, json_value(manifest), "{}" if not existing else json_value(existing["config"]), health_message, timestamp, timestamp),
            )
            conn.execute("DELETE FROM plugin_tools WHERE plugin_id = ?", (plugin_id,))
            for tool in tools:
                conn.execute(
                    """INSERT INTO plugin_tools(id,plugin_id,original_name,agent_name,module_path,protocol,description,parameters_json,requires_confirmation,risk_level,enabled,compatibility_status,error_message)
                    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (str(uuid.uuid4()), plugin_id, tool.get("original_name"), tool["agent_name"], tool["module_path"], tool["protocol"],
                     tool.get("description", ""), json_value(tool.get("parameters", {"type": "object", "properties": {}})), int(tool["requires_confirmation"]), tool["risk_level"], int(tool.get("enabled", True)), tool["compatibility_status"], tool.get("error_message")),
                )
        return self.get_plugin(plugin_id)

    def set_enabled(self, plugin_id: str, enabled: bool):
        with self.connect() as conn:
            conn.execute("UPDATE plugins SET enabled=?, status=?, updated_at=? WHERE id=?", (int(enabled), "ready" if enabled else "disabled", now(), plugin_id))
        return self.get_plugin(plugin_id)

    def set_health(self, plugin_id: str, ok: bool, message: str):
        with self.connect() as conn:
            conn.execute("UPDATE plugins SET status=?, health_message=?, updated_at=? WHERE id=?", ("ready" if ok else "unhealthy", message, now(), plugin_id))
        return self.get_plugin(plugin_id)

    def set_config(self, plugin_id: str, config: dict):
        with self.connect() as conn:
            conn.execute("UPDATE plugins SET config_json=?, updated_at=? WHERE id=?", (json_value(config), now(), plugin_id))
        return self.get_plugin(plugin_id)

    def set_tool(self, plugin_id: str, tool_id: str, values: dict):
        fields, params = [], []
        for field in ("description", "enabled", "requires_confirmation", "risk_level", "compatibility_status", "error_message", "agent_name"):
            if field in values:
                fields.append(f"{field}=?")
                params.append(int(values[field]) if field in ("enabled", "requires_confirmation") else values[field])
        if "parameters" in values:
            fields.append("parameters_json=?")
            params.append(json_value(values["parameters"]))
        if fields:
            with self.connect() as conn:
                conn.execute(f"UPDATE plugin_tools SET {', '.join(fields)} WHERE id=? AND plugin_id=?", (*params, tool_id, plugin_id))
        return self.get_plugin(plugin_id)

    def delete_plugin(self, plugin_id: str):
        plugin = self.get_plugin(plugin_id)
        if not plugin:
            return None
        with self.connect() as conn:
            conn.execute("DELETE FROM plugin_tools WHERE plugin_id=?", (plugin_id,))
            conn.execute("DELETE FROM plugins WHERE id=?", (plugin_id,))
        return plugin

    def enabled_tools(self) -> list[dict]:
        with self.connect() as conn:
            rows = conn.execute("""SELECT t.*, p.install_path, p.config_json, p.name AS plugin_name FROM plugin_tools t
              JOIN plugins p ON p.id=t.plugin_id WHERE p.enabled=1 AND t.enabled=1 AND t.compatibility_status='compatible'""").fetchall()
        tools = []
        for row in rows:
            tool = self.tool_dict(row)
            tool["install_path"] = row["install_path"]
            tool["plugin_name"] = row["plugin_name"]
            tool["config"] = parse_json(row["config_json"], {})
            tools.append(tool)
        return tools

    def audit(self, tool: dict, arguments: dict, confirmation_status: str, status: str, duration_ms: int | None = None, error: str | None = None):
        with self.connect() as conn:
            conn.execute("INSERT INTO plugin_audit_logs VALUES(?,?,?,?,?,?,?,?,?,?,?)", (str(uuid.uuid4()), tool.get("plugin_id"), tool.get("id"), tool["agent_name"], json_value(arguments)[:2000], int(tool["requires_confirmation"]), confirmation_status, status, duration_ms, error, now()))

    def logs(self, plugin_id: str) -> list[dict]:
        with self.connect() as conn:
            return [dict(row) for row in conn.execute("SELECT * FROM plugin_audit_logs WHERE plugin_id=? ORDER BY created_at DESC LIMIT 200", (plugin_id,))]


class NodePluginRuntime:
    @staticmethod
    def run(command: str, payload: dict, timeout: int = 30) -> dict:
        try:
            process = subprocess.run(["node", str(RUNNER_PATH), command], input=json_value(payload), text=True, encoding="utf-8", errors="replace", capture_output=True, timeout=timeout, cwd=payload.get("pluginRoot") or None, env={**os.environ, "PLUGIN_RUNTIME": "1"})
        except FileNotFoundError:
            return {"ok": False, "error": "未找到 Node.js，请安装并配置 Node.js 后重试。"}
        except subprocess.TimeoutExpired:
            return {"ok": False, "error": f"插件执行超时（{timeout} 秒）"}
        if process.returncode != 0:
            return {"ok": False, "error": (process.stderr or process.stdout or "Node 执行失败").strip()[-2000:]}
        try:
            return json.loads(process.stdout or "")
        except (json.JSONDecodeError, TypeError):
            return {"ok": False, "error": f"插件未返回有效 JSON：{(process.stdout or '')[-500:]}"}


class ExternalToolPlugin(BasePlugin):
    def __init__(self, tool: dict, store: PluginStore):
        self.tool = tool
        self.store = store

    @property
    def name(self) -> str:
        return self.tool["agent_name"]

    @property
    def description(self) -> str:
        return self.tool["description"]

    @property
    def parameters(self) -> dict:
        return self.tool["parameters"]

    def execute(self, **kwargs) -> dict:
        started = time.monotonic()
        payload = {"pluginRoot": self.tool["install_path"], "modulePath": self.tool["module_path"], "protocol": self.tool["protocol"], "args": kwargs, "context": {"pluginConfig": self.tool["config"], "workspaceRoot": str(BACKEND_DIR.parent), "sessionId": "default"}}
        response = NodePluginRuntime.run("invoke", payload, timeout=60)
        elapsed = int((time.monotonic() - started) * 1000)
        self.store.audit(self.tool, kwargs, "not_required", "success" if response.get("ok") else "failed", elapsed, response.get("error"))
        return response.get("result", response)


def needs_confirmation(name: str, metadata: dict) -> bool:
    if "requiresConfirmation" in metadata:
        return bool(metadata["requiresConfirmation"])
    lower = name.lower()
    return any(word in lower for word in HIGH_RISK_WORDS)


class PluginInstaller:
    def __init__(self, store: PluginStore):
        self.store = store

    def install_from_path(self, source_path: str, copy_to_managed: bool = False) -> dict:
        source = Path(source_path).expanduser().resolve()
        manifest_path = source / "plugin.json"
        if not source.is_dir() or not manifest_path.is_file():
            raise ValueError("插件目录必须存在且包含 plugin.json")
        manifest = parse_json(manifest_path.read_text(encoding="utf-8"), None)
        if not isinstance(manifest, dict) or not isinstance(manifest.get("name"), str):
            raise ValueError("plugin.json 缺少有效的 name")
        root = source
        if copy_to_managed:
            target = PLUGIN_DIR / f"{require_safe_name(manifest['name'])}-{require_safe_name(str(manifest.get('version', '0.0.0')))}"
            temporary = target.with_name(f".{target.name}-{uuid.uuid4().hex}")
            shutil.copytree(source, temporary, ignore=shutil.ignore_patterns("node_modules", ".git"))
            if target.exists():
                shutil.rmtree(target)
            temporary.replace(target)
            root = target
            self.install_dependencies(root)
        tools = self.discover_tools(root, manifest)
        health = self.health_check(root, tools)
        status = "ready" if health["ok"] else "unhealthy"
        return self.store.upsert_plugin(manifest, root, "managed_copy" if copy_to_managed else "local_path", tools, status, health.get("message", ""))

    def install_dependencies(self, root: Path):
        package_json = root / "package.json"
        if not package_json.exists():
            return
        result = subprocess.run(["npm", "install", "--no-audit", "--no-fund"], cwd=root, text=True, capture_output=True, timeout=300)
        if result.returncode != 0:
            raise ValueError(f"npm install 失败：{(result.stderr or result.stdout)[-1000:]}")

    def discover_tools(self, root: Path, manifest: dict) -> list[dict]:
        components = manifest.get("components", {}) if isinstance(manifest.get("components"), dict) else {}
        modules = [(path, "tool") for path in components.get("tools", []) if isinstance(path, str)]
        for item in components.get("execTools", []):
            if isinstance(item, dict) and isinstance(item.get("module"), str):
                modules.append((item["module"], "exec"))
        tools = []
        for module_path, declared_kind in modules:
            file_path = (root / module_path).resolve()
            if not str(file_path).startswith(str(root.resolve())) or not file_path.is_file():
                tools.append(self.failed_tool(manifest["name"], module_path, "模块文件不存在或越出插件目录"))
                continue
            result = NodePluginRuntime.run("discover", {"pluginRoot": str(root), "modulePath": module_path}, timeout=20)
            if not result.get("ok"):
                tools.append(self.failed_tool(manifest["name"], module_path, result.get("error", "无法识别模块")))
                continue
            metadata = result["tool"]
            original_name = str(metadata.get("name") or Path(module_path).stem)
            tools.append({"original_name": original_name, "agent_name": f"{require_safe_name(manifest['name'])}_{require_safe_name(original_name)}", "module_path": module_path, "protocol": result["protocol"], "description": str(metadata.get("description") or original_name), "parameters": metadata.get("parameters") or {"type": "object", "properties": {}}, "requires_confirmation": needs_confirmation(original_name, metadata), "risk_level": "high" if needs_confirmation(original_name, metadata) else "low", "enabled": declared_kind == "tool", "compatibility_status": "compatible", "error_message": None})
        return tools

    @staticmethod
    def failed_tool(plugin_name: str, module_path: str, error: str) -> dict:
        name = Path(module_path).stem
        return {"original_name": name, "agent_name": f"{require_safe_name(plugin_name)}_{require_safe_name(name)}", "module_path": module_path, "protocol": "unknown", "description": f"未识别工具：{name}", "parameters": {"type": "object", "properties": {}}, "requires_confirmation": True, "risk_level": "high", "enabled": False, "compatibility_status": "manual_required", "error_message": error}

    def health_check(self, root: Path, tools: list[dict], config: dict | None = None) -> dict:
        health_tools = [tool for tool in tools if tool["compatibility_status"] == "compatible" and "health" in tool["agent_name"].lower()]
        if not health_tools:
            return {"ok": True, "message": "未发现健康检查工具，已完成静态校验"}

        # 优先使用 manifests 中声明的 execTools：它们是独立运行时入口，
        # 不依赖 DeepTalk 工作区上下文，更适合作为安装阶段的连通性检查。
        tool = next((item for item in health_tools if item["protocol"] == "exec_tool"), health_tools[0])
        result = NodePluginRuntime.run("invoke", {"pluginRoot": str(root), "modulePath": tool["module_path"], "protocol": tool["protocol"], "args": {}, "context": {"pluginConfig": config or {}, "workspaceRoot": str(BACKEND_DIR.parent)}}, timeout=30)
        if result.get("ok"):
            execution = result.get("result", {})
            if isinstance(execution, dict) and execution.get("ok") is False:
                return {"ok": False, "message": execution.get("error", "健康检查失败")}
            return {"ok": True, "message": "健康检查通过"}
        return {"ok": False, "message": result.get("error", "健康检查失败")}
