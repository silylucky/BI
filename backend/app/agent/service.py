from __future__ import annotations

import json
import logging
import threading
import uuid
from collections.abc import Callable, Generator
from pathlib import Path
from typing import Any

from openai import OpenAI
from sqlalchemy.orm import Session

from app.agent.memory_store import MemoryStore
from app.agent.plugins import ExternalPluginTool, PluginStore
from app.agent.session_store import SessionStore
from app.agent.tools import (
    AgentTool,
    CreateDashboardTool,
    CreateDataScreenTool,
    ExecuteQueryTool,
    GetDashboardTool,
    ListChartTypesTool,
    ListColumnsTool,
    ListDashboardsTool,
    ListDataSourcesTool,
    ListSchemasTool,
    ListTablesTool,
    ListUploadedFilesTool,
    ReadUploadedFileTool,
    serialize_tool_result,
)
from app.agent.uploads import UploadedFileStore
from app.auth.deps import UserContext
from app.core.config import Settings

logger = logging.getLogger(__name__)

ConfirmationCreator = Callable[[str, dict[str, Any], list[dict[str, Any]], UserContext, str], str]


class AgentService:
    """Authenticated VitalSpan Agent orchestration with safe built-in tools."""

    DEFAULT_SYSTEM_PROMPT = """你是 VitalSpan AI 助手，帮助用户理解、查询和使用当前 BI 平台。

你只能使用本会话提供的工具和工具结果，不得臆造平台数据、仪表板、数据源或已执行的操作。
- 涉及数据时，先列出数据源、schema、表和字段，再执行只读查询；不要猜测字段名。
- 用户要求分析已上传文件时，先列出已上传附件，再读取目标附件；不得臆造文件内容。
- 查询结果由平台强制只读、行级权限和列脱敏；如结果为空或报错，请如实说明并提出下一步。
- 用户要求“生成数据大屏”时，必须先依次核对数据源、schema、表、字段和内置图表类型；根据业务目标列出完整计划（专用 Dataset、组件、数据大屏），然后只调用 vitalspan_create_data_screen 一次以获取统一确认。
- vitalspan_create_data_screen 会为每个 dataSourceId+schema+table 生成独立 Dataset、预跑查询、发布组织组件库组件和创建大屏。只能传入已经由工具核对过的字段和类型；不得把密码、凭证或未授权数据源写入计划。
- 如果预跑、字段或图表校验失败，优先根据工具返回的错误换用兼容字段或图表；仍失败时如实列出已成功和失败的资源，绝不声称大屏已创建。
- 任何会写入平台的工具都需要用户确认；在最终答复中明确说清创建或变更的结果。
- 给出简明、可操作的中文回答。"""

    def __init__(self, settings: Settings):
        self.settings = settings
        data_dir = Path(settings.vitalspan_data_dir).resolve() / "agent"
        self.memory_store = MemoryStore(data_dir / "memory.db", settings)
        self.plugin_store = PluginStore(data_dir)
        self.upload_store = UploadedFileStore(data_dir)
        self.session_store = SessionStore(data_dir / "sessions.db", settings.agent_max_history_messages)
        self._tools: dict[str, AgentTool] = {
            tool.name: tool
            for tool in (
                ListDashboardsTool(),
                GetDashboardTool(),
                ListDataSourcesTool(),
                ListUploadedFilesTool(self.upload_store),
                ReadUploadedFileTool(self.upload_store),
                ListSchemasTool(),
                ListTablesTool(),
                ListColumnsTool(),
                ExecuteQueryTool(),
                ListChartTypesTool(),
                CreateDashboardTool(),
                CreateDataScreenTool(),
            )
        }
        self._client: OpenAI | None = None
        self._client_lock = threading.Lock()

    def _event(self, event_type: str, **payload: Any) -> str:
        return json.dumps({"type": event_type, **payload}, ensure_ascii=False, default=str)

    def _get_client(self) -> OpenAI | None:
        key = (self.settings.deepseek_api_key or "").strip()
        if not key:
            return None
        with self._client_lock:
            if self._client is None:
                self._client = OpenAI(
                    api_key=key,
                    base_url=self.settings.deepseek_base_url,
                    timeout=90.0,
                )
            return self._client

    def tool_definitions(self, user: UserContext | None = None) -> list[dict[str, Any]]:
        builtin = [
            tool.definition()
            for tool in self._tools.values()
            if user is None or tool.is_available_to(user)
        ]
        external = [
            {
                "type": "function",
                "function": {
                    "name": tool["agent_name"],
                    "description": tool["description"],
                    "parameters": tool["parameters"],
                },
            }
            for tool in self.plugin_store.enabled_tools()
        ]
        return [*builtin, *external]

    def tool_requires_confirmation(self, tool_name: str) -> bool:
        builtin = self._tools.get(tool_name)
        if builtin is not None:
            return builtin.requires_confirmation
        # Third-party plugins are never trusted to opt out of platform approval.
        return any(tool["agent_name"] == tool_name for tool in self.plugin_store.enabled_tools())

    def health(self, user: UserContext | None = None) -> dict[str, Any]:
        return {
            "status": "ok",
            "model": self.settings.deepseek_model,
            "modelConfigured": self._get_client() is not None,
            "tools": [item["function"]["name"] for item in self.tool_definitions(user)],
        }

    def chat(
        self,
        *,
        db: Session,
        user: UserContext,
        session_id: str,
        user_input: str,
        create_confirmation: ConfirmationCreator,
    ) -> Generator[str, None, None]:
        message = user_input.strip()
        if not message:
            yield self._event("answer", content="请输入您的问题或希望我协助完成的操作。")
            return
        client = self._get_client()
        if client is None:
            yield self._event(
                "answer",
                content="AI 助手尚未配置模型。请在后端环境变量中设置 `DEEPSEEK_API_KEY` 后重启服务。",
            )
            return

        tools = self.tool_definitions(user)
        history = self.session_store.get_history(user.id, session_id)
        messages: list[dict[str, Any]] = [
            {
                "role": "system",
                "content": self._system_prompt(message, tools, user.id),
            },
            *history,
            {"role": "user", "content": message},
        ]

        for _ in range(self.settings.agent_max_tool_iterations):
            try:
                response = client.chat.completions.create(
                    model=self.settings.deepseek_model,
                    messages=messages,  # type: ignore[arg-type]
                    tools=tools,  # type: ignore[arg-type]
                )
            except Exception:
                logger.exception("agent_model_call_failed user_id=%s", user.id)
                yield self._event("answer", content="模型调用失败，请稍后重试。")
                return

            model_message = response.choices[0].message
            assistant_message: dict[str, Any] = {
                "role": "assistant",
                "content": model_message.content or "",
            }
            if model_message.tool_calls:
                assistant_message["tool_calls"] = [
                    {
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_call.function.name,
                            "arguments": tool_call.function.arguments,
                        },
                    }
                    for tool_call in model_message.tool_calls
                ]
            messages.append(assistant_message)

            if not model_message.tool_calls:
                answer = model_message.content or "我暂时没有可补充的结论。"
                yield self._event("answer", content=answer)
                self._finalize_history(user.id, session_id, messages, message, answer)
                return

            for call in model_message.tool_calls:
                tool_name = call.function.name
                arguments = self._parse_arguments(call.function.arguments)
                if not self._tool_exists(tool_name):
                    result = {"error": {"code": "TOOL_NOT_FOUND", "message": f"工具 {tool_name} 不存在"}}
                    yield self._event("tool_result", tool=tool_name, result=result)
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": call.id,
                            "content": serialize_tool_result(result),
                        }
                    )
                    continue

                yield self._event("tool_call", tool=tool_name, args=arguments)
                if self.tool_requires_confirmation(tool_name):
                    confirmation_messages = [
                        *messages[:-1],
                        {
                            **assistant_message,
                            "tool_calls": [
                                tool_call
                                for tool_call in assistant_message["tool_calls"]
                                if tool_call["id"] == call.id
                            ],
                        },
                    ]
                    confirmation_id = create_confirmation(
                        tool_name,
                        arguments,
                        confirmation_messages,
                        user,
                        call.id,
                    )
                    yield self._event(
                        "confirmation_required",
                        confirmation_id=confirmation_id,
                        tool=tool_name,
                        args=arguments,
                        message=(
                            "这是一个外部插件调用，将在受控运行时中执行。请核对参数后确认。"
                            if tool_name not in self._tools
                            else "此操作会写入 VitalSpan 平台。请确认后执行。"
                        ),
                    )
                    yield self._event("answer", content="已生成操作计划，等待您的确认。")
                    return

                result = self.execute_tool(db, user, session_id, tool_name, arguments)
                yield self._event("tool_result", tool=tool_name, result=result)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.id,
                        "content": serialize_tool_result(result),
                    }
                )

        yield self._event(
            "answer",
            content="任务已达到最大工具调用次数限制。请将需求拆分得更具体后重试。",
        )

    def execute_tool(
        self,
        db: Session,
        user: UserContext,
        session_id: str,
        tool_name: str,
        arguments: dict[str, Any],
        *,
        confirmation_status: str = "not_required",
    ) -> dict[str, Any]:
        tool = self._tools.get(tool_name)
        if tool is not None and not tool.is_available_to(user):
            return {
                "error": {
                    "code": "TOOL_PERMISSION_DENIED",
                    "message": f"缺少工具所需权限：{', '.join(tool.missing_permissions(user))}",
                }
            }
        if tool is None:
            external = next(
                (item for item in self.plugin_store.enabled_tools() if item["agent_name"] == tool_name),
                None,
            )
            if external is None:
                return {"error": {"code": "TOOL_NOT_FOUND", "message": f"工具 {tool_name} 不存在"}}
            if confirmation_status != "approved":
                return {
                    "error": {
                        "code": "TOOL_CONFIRMATION_REQUIRED",
                        "message": "外部插件调用必须经用户确认后执行",
                    }
                }
            try:
                return ExternalPluginTool(external, self.plugin_store).execute(
                    user=user,
                    session_id=session_id,
                    arguments=arguments,
                    confirmation_status=confirmation_status,
                )
            except Exception as exc:
                logger.exception("agent_external_plugin_failed tool=%s user_id=%s", tool_name, user.id)
                return {"error": {"code": "PLUGIN_EXECUTION_FAILED", "message": str(exc)}}
        try:
            return tool.execute(db, user, arguments)
        except PermissionError as exc:
            return {"error": {"code": "RESOURCE_NOT_VISIBLE", "message": str(exc)}}
        except ValueError as exc:
            return {"error": {"code": "TOOL_ARGUMENT_INVALID", "message": str(exc)}}
        except Exception as exc:
            logger.exception("agent_tool_failed tool=%s user_id=%s", tool_name, user.id)
            return {"error": {"code": "TOOL_EXECUTION_FAILED", "message": str(exc)}}

    def complete_confirmation(
        self,
        *,
        user: UserContext,
        messages: list[dict[str, Any]],
        tool_call_id: str,
        result: dict[str, Any],
    ) -> str:
        client = self._get_client()
        if client is None:
            return "操作已执行，但模型未配置，无法生成补充说明。"
        try:
            response = client.chat.completions.create(
                model=self.settings.deepseek_model,
                messages=[
                    *messages,
                    {
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "content": serialize_tool_result(result),
                    },
                ],  # type: ignore[arg-type]
                tools=self.tool_definitions(user),  # type: ignore[arg-type]
                tool_choice="none",
            )
            return response.choices[0].message.content or "已执行确认的操作。"
        except Exception:
            logger.exception("agent_confirmation_completion_failed")
            return "操作已执行，但生成说明失败，请查看工具调用结果。"

    def _system_prompt(self, user_input: str, tools: list[dict[str, Any]], user_id: str) -> str:
        catalog = "\n".join(
            f"- {item['function']['name']}：{item['function']['description']}" for item in tools
        )
        memory_context = self.memory_store.context_for(user_id, user_input)
        base_prompt = self.settings.agent_system_prompt or self.DEFAULT_SYSTEM_PROMPT
        prompt = (
            f"{base_prompt}\n\n"
            "本次会话允许使用的工具如下：\n"
            f"{catalog}\n\n"
            "必须以本次 tools 列表中的工具名为准。"
        )
        return f"{prompt}\n\n{memory_context}" if memory_context else prompt

    def _tool_exists(self, tool_name: str) -> bool:
        return tool_name in self._tools or any(
            item["agent_name"] == tool_name for item in self.plugin_store.enabled_tools()
        )

    def tool_is_externally_managed(self, tool_name: str) -> bool:
        return tool_name not in self._tools and any(
            item["agent_name"] == tool_name for item in self.plugin_store.enabled_tools()
        )

    def finalize_confirmed_action(
        self,
        *,
        user_id: str,
        session_id: str,
        messages: list[dict[str, Any]],
        answer: str,
    ) -> None:
        user_inputs = [
            str(message.get("content", ""))
            for message in messages
            if message.get("role") == "user" and message.get("content")
        ]
        self._finalize_history(
            user_id,
            session_id,
            messages,
            user_inputs[-1] if user_inputs else "已确认的操作",
            answer,
        )

    @staticmethod
    def _parse_arguments(raw: str) -> dict[str, Any]:
        try:
            value = json.loads(raw)
            return value if isinstance(value, dict) else {}
        except json.JSONDecodeError:
            return {}

    def _finalize_history(
        self,
        user_id: str,
        session_id: str,
        messages: list[dict[str, Any]],
        user_input: str,
        answer: str,
    ) -> None:
        history = [
            {"role": message["role"], "content": message.get("content", "")}
            for message in messages
            if message["role"] in {"user", "assistant"} and message.get("content")
        ]
        self.session_store.set_history(user_id, session_id, history)
        self.memory_store.remember_exchange(user_id, session_id, user_input, answer)


def new_confirmation_id() -> str:
    return str(uuid.uuid4())
