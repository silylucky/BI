import json
import os
import shutil
import sys
import uuid
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from agent.core import BiAgent
from agent.session_manager import session_manager
from config import Config
from plugins.chart_generator import ChartGeneratorPlugin
from plugins.data_analysis import DataAnalysisPlugin
from plugins.external_runtime import ExternalToolPlugin, PluginInstaller, PluginStore
from plugins.registry import PluginRegistry
from plugins.sql_query import SqlQueryPlugin

app = FastAPI(title="BI 问数智能体", version="1.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

registry = PluginRegistry()
registry.register(SqlQueryPlugin()).register(DataAnalysisPlugin()).register(ChartGeneratorPlugin())
plugin_store = PluginStore()
plugin_installer = PluginInstaller(plugin_store)
pending_confirmations: dict[str, dict] = {}


def refresh_external_plugins():
    for name in list(registry.list_plugins()):
        plugin = registry.get(name)
        if isinstance(plugin, ExternalToolPlugin):
            registry.unregister(name)
    for tool in plugin_store.enabled_tools():
        registry.register(ExternalToolPlugin(tool, plugin_store))


def create_confirmation(tool_name: str, arguments: dict) -> str:
    confirmation_id = str(uuid.uuid4())
    pending_confirmations[confirmation_id] = {"tool": tool_name, "arguments": arguments}
    return confirmation_id


refresh_external_plugins()
agent = BiAgent(registry, create_confirmation)


class PathInstallRequest(BaseModel):
    path: str
    copy_to_managed: bool = False


class ConfigUpdateRequest(BaseModel):
    config: dict


class ToolUpdateRequest(BaseModel):
    description: str | None = None
    parameters: dict | None = None
    enabled: bool | None = None
    requires_confirmation: bool | None = None
    risk_level: str | None = None
    compatibility_status: str | None = None
    error_message: str | None = None
    agent_name: str | None = None


@app.post("/chat")
async def chat(body: dict):
    session_id = body.get("session_id", "default")
    user_input = body.get("message", "")
    history = session_manager.get_history(session_id)

    def stream():
        result_history = list(history)
        for chunk in agent.chat(user_input, history):
            data = json.loads(chunk)
            if data["type"] == "history":
                result_history = data["messages"]
                session_manager.set_history(session_id, result_history)
            yield f"data: {chunk}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.get("/plugins")
async def list_plugins():
    return {"plugins": plugin_store.list_plugins(), "builtin_tools": registry.list_plugins()}


@app.get("/plugins/{plugin_id}")
async def get_plugin(plugin_id: str):
    plugin = plugin_store.get_plugin(plugin_id)
    if not plugin:
        raise HTTPException(404, "插件不存在")
    return plugin


@app.post("/plugins/install/path")
async def install_plugin_from_path(request: PathInstallRequest):
    try:
        plugin = plugin_installer.install_from_path(request.path, request.copy_to_managed)
        refresh_external_plugins()
        return plugin
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, f"插件安装失败：{exc}") from exc


@app.post("/plugins/install/upload")
async def install_plugin_upload(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(400, "请选择包含 plugin.json 的 ZIP 插件包")
    upload_root = Path(__file__).resolve().parent / "data" / "uploads" / uuid.uuid4().hex
    archive = upload_root.with_suffix(".zip")
    try:
        archive.parent.mkdir(parents=True, exist_ok=True)
        with archive.open("wb") as output:
            shutil.copyfileobj(file.file, output)
        shutil.unpack_archive(str(archive), str(upload_root), "zip")
        candidates = list(upload_root.rglob("plugin.json"))
        if len(candidates) != 1:
            raise ValueError("ZIP 中必须且只能包含一个 plugin.json")
        plugin = plugin_installer.install_from_path(str(candidates[0].parent), copy_to_managed=True)
        refresh_external_plugins()
        return plugin
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, f"上传插件安装失败：{exc}") from exc
    finally:
        archive.unlink(missing_ok=True)
        shutil.rmtree(upload_root, ignore_errors=True)


@app.post("/plugins/{plugin_id}/enable")
async def enable_plugin(plugin_id: str):
    plugin = plugin_store.get_plugin(plugin_id)
    if not plugin:
        raise HTTPException(404, "插件不存在")
    if plugin["status"] == "unhealthy":
        raise HTTPException(409, "插件预检未通过，请修复配置后重新检查")
    plugin = plugin_store.set_enabled(plugin_id, True)
    refresh_external_plugins()
    return plugin


@app.post("/plugins/{plugin_id}/disable")
async def disable_plugin(plugin_id: str):
    if not plugin_store.get_plugin(plugin_id):
        raise HTTPException(404, "插件不存在")
    plugin = plugin_store.set_enabled(plugin_id, False)
    refresh_external_plugins()
    return plugin


@app.put("/plugins/{plugin_id}/config")
async def update_plugin_config(plugin_id: str, request: ConfigUpdateRequest):
    if not plugin_store.get_plugin(plugin_id):
        raise HTTPException(404, "插件不存在")
    return plugin_store.set_config(plugin_id, request.config)


@app.put("/plugins/{plugin_id}/tools/{tool_id}")
async def update_plugin_tool(plugin_id: str, tool_id: str, request: ToolUpdateRequest):
    if not plugin_store.get_plugin(plugin_id):
        raise HTTPException(404, "插件不存在")
    values = request.model_dump(exclude_none=True)
    plugin = plugin_store.set_tool(plugin_id, tool_id, values)
    refresh_external_plugins()
    return plugin


@app.post("/plugins/{plugin_id}/health-check")
async def health_check(plugin_id: str):
    plugin = plugin_store.get_plugin(plugin_id)
    if not plugin:
        raise HTTPException(404, "插件不存在")
    result = plugin_installer.health_check(Path(plugin["install_path"]), plugin["tools"], plugin["config"])
    plugin_store.set_health(plugin_id, result["ok"], result.get("message", ""))
    refresh_external_plugins()
    return result


@app.get("/plugins/{plugin_id}/audit-logs")
async def plugin_audit_logs(plugin_id: str):
    if not plugin_store.get_plugin(plugin_id):
        raise HTTPException(404, "插件不存在")
    return {"logs": plugin_store.logs(plugin_id)}


@app.delete("/plugins/{plugin_id}")
async def uninstall_plugin(plugin_id: str):
    plugin = plugin_store.delete_plugin(plugin_id)
    if not plugin:
        raise HTTPException(404, "插件不存在")
    if plugin["source_type"] == "managed_copy":
        shutil.rmtree(plugin["install_path"], ignore_errors=True)
    refresh_external_plugins()
    return {"status": "ok", "message": f"已卸载插件 {plugin['display_name']}"}


@app.post("/tool-confirmations/{confirmation_id}/approve")
async def approve_confirmation(confirmation_id: str):
    pending = pending_confirmations.pop(confirmation_id, None)
    if not pending:
        raise HTTPException(404, "确认请求已失效")
    plugin = registry.get(pending["tool"])
    if not plugin:
        raise HTTPException(409, "插件工具已被停用或卸载")
    result = registry.execute(pending["tool"], pending["arguments"])
    return {"status": "executed", "tool": pending["tool"], "result": result}


@app.post("/tool-confirmations/{confirmation_id}/cancel")
async def cancel_confirmation(confirmation_id: str):
    pending = pending_confirmations.pop(confirmation_id, None)
    if not pending:
        raise HTTPException(404, "确认请求已失效")
    return {"status": "cancelled", "tool": pending["tool"]}


@app.delete("/session/{session_id}")
async def clear_session(session_id: str):
    session_manager.clear(session_id)
    return {"status": "ok", "message": f"会话 {session_id} 已清除"}


@app.get("/health")
async def health():
    return {"status": "ok", "model": Config.MODEL}


frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=Config.HOST, port=Config.PORT, reload=True)
