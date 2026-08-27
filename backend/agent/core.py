import json
from collections.abc import Callable, Generator
from typing import Any

from agent.llm_client import MODEL, llm_client
from plugins.registry import PluginRegistry


ToolResultEventAdapter = Callable[[str, dict[str, Any]], list[dict[str, Any]]]


class GenericAgent:
    """通用工具智能体：通过注册表编排任意内置或外部插件工具。"""

    DEFAULT_SYSTEM_PROMPT = """你是一个可扩展的通用智能体。

你可以使用系统为当前会话注册的工具完成用户任务。请根据工具的名称、描述和 JSON Schema 判断何时调用工具：
- 当已注册工具能够完成用户请求时，优先调用该工具，不要声称无法调用插件；
- 调用工具时必须使用完整的工具名称和符合 Schema 的参数；
- 工具可能来自外部插件，名称带前缀是正常的；
- 工具执行结果是可信的上下文，请基于结果给出清晰、诚实的最终回复；
- 若工具返回错误，请说明失败原因并在必要时建议用户检查插件配置或服务状态；
- 不要编造工具、工具结果或未注册的能力。"""

    def __init__(
        self,
        registry: PluginRegistry,
        create_confirmation: Callable[[str, dict[str, Any]], str] | None = None,
        system_prompt: str | None = None,
        result_event_adapter: ToolResultEventAdapter | None = None,
        max_iterations: int = 10,
    ):
        self.registry = registry
        self.create_confirmation = create_confirmation
        self.system_prompt = system_prompt or self.DEFAULT_SYSTEM_PROMPT
        self.result_event_adapter = result_event_adapter
        self.max_iterations = max_iterations

    @staticmethod
    def _event(event_type: str, **payload: Any) -> str:
        return json.dumps({"type": event_type, **payload}, ensure_ascii=False, default=str)

    def _build_system_prompt(self, tool_definitions: list[dict[str, Any]]) -> str:
        tool_catalog = "\n".join(
            f"- {item['function']['name']}：{item['function']['description']}"
            for item in tool_definitions
        ) or "（当前没有可用工具）"
        return (
            f"{self.system_prompt}\n\n"
            "当前会话已注册的工具如下：\n"
            f"{tool_catalog}\n\n"
            "必须以本次请求提供的 tools 列表为准。"
        )

    def chat(self, user_input: str, history: list[dict[str, Any]]) -> Generator[str, None, None]:
        """执行 LLM 与工具之间的通用 Function Calling 循环，并以 SSE 事件返回过程。"""
        if not user_input.strip():
            yield self._event("answer", content="请输入您的问题或需要执行的任务。")
            return

        tool_definitions = self.registry.get_definitions()
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": self._build_system_prompt(tool_definitions)},
            *history,
            {"role": "user", "content": user_input},
        ]

        for _ in range(self.max_iterations):
            try:
                response = llm_client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    tools=tool_definitions,
                )
            except Exception as exc:
                message = str(exc).strip() or exc.__class__.__name__
                yield self._event("answer", content=f"模型调用失败：{message}")
                return

            message = response.choices[0].message
            assistant_message: dict[str, Any] = {"role": "assistant", "content": message.content or ""}
            if message.tool_calls:
                assistant_message["tool_calls"] = [
                    {
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_call.function.name,
                            "arguments": tool_call.function.arguments,
                        },
                    }
                    for tool_call in message.tool_calls
                ]
            messages.append(assistant_message)

            if not message.tool_calls:
                yield self._event("answer", content=message.content or "")
                yield self._event(
                    "history",
                    messages=[
                        {"role": item["role"], "content": item.get("content", "")}
                        for item in messages
                        if item["role"] in ("user", "assistant") and item.get("content")
                    ],
                )
                return

            for tool_call in message.tool_calls:
                tool_name = tool_call.function.name
                try:
                    arguments = json.loads(tool_call.function.arguments)
                    if not isinstance(arguments, dict):
                        raise ValueError("工具参数必须是 JSON 对象")
                except (json.JSONDecodeError, ValueError):
                    arguments = {}

                yield self._event("tool_call", tool=tool_name, args=arguments)
                plugin = self.registry.get(tool_name)
                requires_confirmation = bool(getattr(plugin, "tool", {}).get("requires_confirmation", False))
                if requires_confirmation and self.create_confirmation:
                    confirmation_id = self.create_confirmation(tool_name, arguments)
                    yield self._event(
                        "confirmation_required",
                        confirmation_id=confirmation_id,
                        tool=tool_name,
                        args=arguments,
                        message=f"工具 {tool_name} 可能产生外部副作用，请确认后执行。",
                    )
                    yield self._event("answer", content="已生成操作计划，等待您的确认。")
                    return

                result = self.registry.execute(tool_name, arguments)
                if self.result_event_adapter:
                    for event in self.result_event_adapter(tool_name, result):
                        yield json.dumps(event, ensure_ascii=False, default=str)

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(result, ensure_ascii=False, default=str),
                    }
                )

        yield self._event(
            "answer",
            content="抱歉，任务已达到最大工具调用次数限制。请尝试拆分或简化请求。",
        )


# 兼容已有导入；新代码应使用 GenericAgent。
BiAgent = GenericAgent
