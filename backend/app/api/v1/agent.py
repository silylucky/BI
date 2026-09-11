from __future__ import annotations

import shutil
import uuid
from collections.abc import Generator
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.agent.confirmations import ConfirmationStore
from app.agent.plugin_archive import (
    MAX_PLUGIN_ARCHIVE_BYTES,
    PluginArchiveError,
    validate_and_extract_plugin_archive,
)
from app.agent.plugins import PluginInstaller
from app.agent.service import AgentService, new_confirmation_id
from app.auth.deps import UserContext, get_current_user, require_permission
from app.auth.permissions import permission_matches
from app.core.config import get_settings
from app.datasources.models import get_meta_session

router = APIRouter(prefix="/agent", tags=["agent"])

_settings = get_settings()
_agent_service = AgentService(_settings)
_upload_store = _agent_service.upload_store
_confirmation_store = ConfirmationStore(Path(_settings.vitalspan_data_dir).resolve() / "agent" / "confirmations.db")
PLUGIN_MANAGER_DEPENDENCY = require_permission("agent:plugin.manage")


class ChatRequest(BaseModel):
    session_id: str = Field(default="default", alias="sessionId", min_length=1, max_length=128)
    message: str = Field(min_length=1, max_length=12_000)


class MemoryCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=6_000)
    session_id: str | None = Field(default=None, alias="sessionId", max_length=128)
    category: str = Field(default="manual", max_length=64)
    importance: float = Field(default=0.8, ge=0, le=1)
    metadata: dict[str, Any] = Field(default_factory=dict)


class PluginConfigUpdateRequest(BaseModel):
    config: dict[str, Any] = Field(default_factory=dict)


class PluginToolUpdateRequest(BaseModel):
    enabled: bool


def _db() -> Generator[Session, None, None]:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _detail(exc: Exception) -> str:
    return str(exc).strip() or exc.__class__.__name__


def _sse(payload: str) -> str:
    return f"data: {payload}\n\n"


def _plugin_installer() -> PluginInstaller:
    return PluginInstaller(_agent_service.plugin_store)


def _can_manage_plugins(user: UserContext) -> bool:
    return permission_matches(user.permissions, "agent:plugin.manage", user.is_root)


@router.get("/health")
def agent_health(user: Annotated[UserContext, Depends(get_current_user)]) -> dict[str, Any]:
    return _agent_service.health(user)


@router.post("/chat")
def chat(
    payload: ChatRequest,
    user: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> StreamingResponse:
    def create_confirmation(
        tool_name: str,
        arguments: dict[str, Any],
        messages: list[dict[str, Any]],
        actor: UserContext,
        tool_call_id: str,
    ) -> str:
        confirmation_id = new_confirmation_id()
        _confirmation_store.create(
            confirmation_id,
            user_id=actor.id,
            session_id=payload.session_id,
            tool=tool_name,
            arguments=arguments,
            messages=messages,
            tool_call_id=tool_call_id,
        )
        return confirmation_id

    def stream() -> Generator[str, None, None]:
        for event in _agent_service.chat(
            db=db,
            user=user,
            session_id=payload.session_id,
            user_input=payload.message,
            create_confirmation=create_confirmation,
        ):
            yield _sse(event)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/tool-confirmations/{confirmation_id}/approve")
def approve_confirmation(
    confirmation_id: str,
    user: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> dict[str, Any]:
    pending = _confirmation_store.consume(confirmation_id, user.id)
    if pending is None:
        raise HTTPException(status_code=404, detail="确认请求已失效")
    result = _agent_service.execute_tool(
        db,
        user,
        pending.session_id,
        pending.tool,
        pending.arguments,
        confirmation_status="approved",
    )
    answer = _agent_service.complete_confirmation(
        user=user,
        messages=pending.messages,
        tool_call_id=pending.tool_call_id,
        result=result,
    )
    _agent_service.finalize_confirmed_action(
        user_id=user.id,
        session_id=pending.session_id,
        messages=pending.messages,
        answer=answer,
    )
    return {"status": "executed", "tool": pending.tool, "result": result, "answer": answer}


@router.post("/tool-confirmations/{confirmation_id}/cancel")
def cancel_confirmation(
    confirmation_id: str,
    user: Annotated[UserContext, Depends(get_current_user)],
) -> dict[str, Any]:
    pending = _confirmation_store.consume(confirmation_id, user.id)
    if pending is None:
        raise HTTPException(status_code=404, detail="确认请求已失效")
    return {"status": "cancelled", "tool": pending.tool}


@router.delete("/sessions/{session_id}")
def clear_session(
    session_id: str,
    user: Annotated[UserContext, Depends(get_current_user)],
) -> dict[str, str]:
    _agent_service.session_store.clear(user.id, session_id)
    _confirmation_store.discard_session(user.id, session_id)
    return {"status": "ok", "message": "会话已清除"}


@router.get("/memories")
def list_memories(
    user: Annotated[UserContext, Depends(get_current_user)],
    limit: int = Query(default=100, ge=1, le=100),
) -> dict[str, Any]:
    return {"memories": _agent_service.memory_store.list(user.id, limit)}


@router.get("/memories/recall")
def recall_memories(
    query: str,
    user: Annotated[UserContext, Depends(get_current_user)],
    limit: int | None = Query(default=None, ge=1, le=100),
) -> dict[str, Any]:
    return {"memories": _agent_service.memory_store.recall(user.id, query, limit)}


@router.post("/memories")
def create_memory(
    payload: MemoryCreateRequest,
    user: Annotated[UserContext, Depends(get_current_user)],
) -> dict[str, Any]:
    memory = _agent_service.memory_store.remember(
        user.id,
        payload.content,
        session_id=payload.session_id,
        category=payload.category,
        importance=payload.importance,
        metadata=payload.metadata,
    )
    if memory is None:
        raise HTTPException(status_code=400, detail="记忆内容不能为空")
    return memory


@router.delete("/memories/{memory_id}")
def delete_memory(
    memory_id: str,
    user: Annotated[UserContext, Depends(get_current_user)],
) -> dict[str, str]:
    if not _agent_service.memory_store.delete(memory_id, user.id):
        raise HTTPException(status_code=404, detail="记忆不存在")
    return {"status": "ok", "message": "记忆已删除"}


@router.delete("/memories")
def clear_memories(user: Annotated[UserContext, Depends(get_current_user)]) -> dict[str, Any]:
    return {"status": "ok", "deleted": _agent_service.memory_store.clear_user(user.id)}


@router.get("/uploads")
def list_uploads(user: Annotated[UserContext, Depends(get_current_user)]) -> dict[str, Any]:
    return {"files": _upload_store.list(user.id)}


@router.post("/uploads")
async def upload_file(
    user: Annotated[UserContext, Depends(get_current_user)],
    file: Annotated[UploadFile, File()],
) -> dict[str, Any]:
    try:
        uploaded = await _upload_store.save(user.id, file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {key: value for key, value in uploaded.items() if key != "storedPath"}


@router.get("/uploads/{file_id}/content")
def read_upload_content(
    file_id: str,
    user: Annotated[UserContext, Depends(get_current_user)],
) -> dict[str, Any]:
    try:
        metadata = _upload_store.get(file_id, user.id)
        if metadata is None:
            raise HTTPException(status_code=404, detail="附件不存在")
        return {"file": {key: value for key, value in metadata.items() if key != "storedPath"}, "content": _upload_store.text_content(file_id, user.id)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/uploads/{file_id}")
def delete_upload(
    file_id: str,
    user: Annotated[UserContext, Depends(get_current_user)],
) -> dict[str, str]:
    if not _upload_store.delete(file_id, user.id):
        raise HTTPException(status_code=404, detail="附件不存在")
    return {"status": "ok", "message": "附件已删除"}


@router.get("/plugins")
def list_plugins(
    user: Annotated[UserContext, Depends(get_current_user)],
) -> dict[str, Any]:
    if _can_manage_plugins(user):
        return {
            "plugins": _agent_service.plugin_store.list_public_plugins(),
            "registeredTools": _agent_service.health(user)["tools"],
            "canManage": True,
        }
    return {
        "plugins": _agent_service.plugin_store.list_public_plugins(),
        "registeredTools": _agent_service.health(user)["tools"],
        "canManage": False,
    }


@router.get("/plugins/{plugin_id}")
def get_plugin(
    plugin_id: str,
    user: Annotated[UserContext, Depends(PLUGIN_MANAGER_DEPENDENCY)],
) -> dict[str, Any]:
    del user
    plugin = _agent_service.plugin_store.get_plugin(plugin_id)
    if plugin is None:
        raise HTTPException(status_code=404, detail="插件不存在")
    public = _agent_service.plugin_store.public_plugin(plugin)
    public["config"] = _agent_service.plugin_store.get_redacted_config(plugin_id) or {}
    return public


@router.post("/plugins/install/upload")
async def install_plugin_upload(
    _: Annotated[UserContext, Depends(PLUGIN_MANAGER_DEPENDENCY)],
    file: Annotated[UploadFile, File()],
) -> dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="请选择包含 plugin.json 的 ZIP 插件包")
    staging_root = Path(_settings.vitalspan_data_dir).resolve() / "agent" / "plugin-staging" / uuid.uuid4().hex
    archive = staging_root.with_suffix(".zip")
    try:
        staging_root.parent.mkdir(parents=True, exist_ok=True)
        uploaded_bytes = 0
        with archive.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                uploaded_bytes += len(chunk)
                if uploaded_bytes > MAX_PLUGIN_ARCHIVE_BYTES:
                    raise PluginArchiveError("插件包压缩后的大小不能超过 25 MB")
                output.write(chunk)
        validate_and_extract_plugin_archive(archive, staging_root)
        manifests = list(staging_root.rglob("plugin.json"))
        if len(manifests) != 1:
            raise ValueError("ZIP 中必须且只能包含一个 plugin.json")
        plugin = _plugin_installer().install_from_path(str(manifests[0].parent), True)
        return _agent_service.plugin_store.public_plugin(plugin)
    except (PluginArchiveError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"上传插件安装失败：{_detail(exc)}") from exc
    finally:
        await file.close()
        archive.unlink(missing_ok=True)
        shutil.rmtree(staging_root, ignore_errors=True)


@router.post("/plugins/{plugin_id}/enable")
def enable_plugin(
    plugin_id: str,
    _: Annotated[UserContext, Depends(PLUGIN_MANAGER_DEPENDENCY)],
) -> dict[str, Any]:
    plugin = _agent_service.plugin_store.get_plugin(plugin_id)
    if plugin is None:
        raise HTTPException(status_code=404, detail="插件不存在")
    if plugin["status"] == "unhealthy":
        raise HTTPException(status_code=409, detail="插件预检未通过，请修复配置后重新检查")
    plugin = _agent_service.plugin_store.set_enabled(plugin_id, True)
    return _agent_service.plugin_store.public_plugin(plugin) if plugin else {}


@router.post("/plugins/{plugin_id}/disable")
def disable_plugin(
    plugin_id: str,
    _: Annotated[UserContext, Depends(PLUGIN_MANAGER_DEPENDENCY)],
) -> dict[str, Any]:
    if _agent_service.plugin_store.get_plugin(plugin_id) is None:
        raise HTTPException(status_code=404, detail="插件不存在")
    plugin = _agent_service.plugin_store.set_enabled(plugin_id, False)
    return _agent_service.plugin_store.public_plugin(plugin) if plugin else {}


@router.put("/plugins/{plugin_id}/config")
def update_plugin_config(
    plugin_id: str,
    payload: PluginConfigUpdateRequest,
    _: Annotated[UserContext, Depends(PLUGIN_MANAGER_DEPENDENCY)],
) -> dict[str, Any]:
    if _agent_service.plugin_store.get_plugin(plugin_id) is None:
        raise HTTPException(status_code=404, detail="插件不存在")
    _agent_service.plugin_store.set_config(plugin_id, payload.config)
    config = _agent_service.plugin_store.get_redacted_config(plugin_id)
    return {"status": "ok", "config": config or {}}


@router.put("/plugins/{plugin_id}/tools/{tool_id}")
def update_plugin_tool(
    plugin_id: str,
    tool_id: str,
    payload: PluginToolUpdateRequest,
    _: Annotated[UserContext, Depends(PLUGIN_MANAGER_DEPENDENCY)],
) -> dict[str, Any]:
    if _agent_service.plugin_store.get_plugin(plugin_id) is None:
        raise HTTPException(status_code=404, detail="插件不存在")
    plugin = _agent_service.plugin_store.set_tool_enabled(plugin_id, tool_id, payload.enabled)
    return _agent_service.plugin_store.public_plugin(plugin) if plugin else {}


@router.post("/plugins/{plugin_id}/health-check")
def health_check_plugin(
    plugin_id: str,
    _: Annotated[UserContext, Depends(PLUGIN_MANAGER_DEPENDENCY)],
) -> dict[str, Any]:
    plugin = _agent_service.plugin_store.get_plugin(plugin_id)
    if plugin is None:
        raise HTTPException(status_code=404, detail="插件不存在")
    result = _plugin_installer().health_check(Path(plugin["install_path"]), plugin["tools"], plugin["config"])
    _agent_service.plugin_store.set_health(plugin_id, bool(result["ok"]), str(result.get("message", "")))
    return {"ok": bool(result["ok"]), "message": "健康检查通过" if result["ok"] else "插件预检未通过"}


@router.get("/plugins/{plugin_id}/audit-logs")
def plugin_audit_logs(
    plugin_id: str,
    _: Annotated[UserContext, Depends(PLUGIN_MANAGER_DEPENDENCY)],
) -> dict[str, Any]:
    if _agent_service.plugin_store.get_plugin(plugin_id) is None:
        raise HTTPException(status_code=404, detail="插件不存在")
    return {"logs": _agent_service.plugin_store.logs(plugin_id)}


@router.delete("/plugins/{plugin_id}")
def uninstall_plugin(
    plugin_id: str,
    _: Annotated[UserContext, Depends(PLUGIN_MANAGER_DEPENDENCY)],
) -> dict[str, str]:
    plugin = _agent_service.plugin_store.delete_plugin(plugin_id)
    if plugin is None:
        raise HTTPException(status_code=404, detail="插件不存在")
    if plugin["source_type"] == "managed_copy":
        shutil.rmtree(plugin["install_path"], ignore_errors=True)
    return {"status": "ok", "message": f"已卸载插件 {plugin['display_name']}"}


@router.get("/plugins/{plugin_id}/resources")
def plugin_resources(
    plugin_id: str,
    _: Annotated[UserContext, Depends(PLUGIN_MANAGER_DEPENDENCY)],
) -> dict[str, Any]:
    plugin = _agent_service.plugin_store.get_plugin(plugin_id)
    if plugin is None:
        raise HTTPException(status_code=404, detail="插件不存在")
    root = Path(plugin["install_path"]).resolve()
    components = plugin["manifest"].get("components", {})
    if not isinstance(components, dict):
        components = {}
    resources: dict[str, list[dict[str, str]]] = {}
    for category in ("skills", "views", "workspaceTemplates", "resources"):
        entries: list[dict[str, str]] = []
        for value in components.get(category, []):
            if not isinstance(value, str):
                continue
            path = (root / value).resolve()
            if not path.is_relative_to(root):
                continue
            if path.is_dir():
                entries.extend({"path": str(child.relative_to(root)), "kind": "file"} for child in sorted(path.rglob("*")) if child.is_file())
            elif path.is_file():
                entries.append({"path": str(path.relative_to(root)), "kind": "file"})
        resources[category] = entries
    return {"pluginId": plugin_id, "resources": resources}
