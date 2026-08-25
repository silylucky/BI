import json
from typing import Generator
from plugins.registry import PluginRegistry
from agent.llm_client import llm_client, MODEL


class BiAgent:
    """BI 问数智能体核心 - 支持工具调用循环"""

    SYSTEM_PROMPT = """你是一个专业的 BI 数据分析智能体。你的任务是帮助用户查询和分析业务数据。

你可以使用以下工具：
1. query_database - 查询业务数据库（仅支持 SELECT）
2. analyze_data - 对数据进行分析统计（求和、平均值、最大/最小值、分组统计等）
3. generate_chart - 生成可视化图表（柱状图、折线图、饼图）

工作流程：
- 当用户提出数据问题时，先用 query_database 查询数据
- 如果需要统计分析，用 analyze_data 处理查询结果
- 如果适合可视化，用 generate_chart 生成图表
- 最后用自然语言总结分析结论，给出业务洞察

注意事项：
- SQL 查询只支持 SELECT 语句
- 生成图表时，data 参数应传入查询结果的 rows 数组
- 回答要简洁专业，重点突出数据洞察"""

    def __init__(self, registry: PluginRegistry):
        self.registry = registry

    def chat(self, user_input: str, history: list) -> Generator[str, None]:
        """
        Agent 主循环：调用 LLM → 判断是否需要工具 → 执行工具 → 结果送回 LLM → 最终回答

        通过 Generator 以 SSE 流式返回中间过程和最终结果。
        """
        if not user_input.strip():
            yield json.dumps({
                "type": "answer",
                "content": "请输入需要分析的数据问题。"
            }, ensure_ascii=False)
            return

        messages = [{"role": "system", "content": self.SYSTEM_PROMPT}] + history
        messages.append({"role": "user", "content": user_input})

        max_iterations = 10  # 防止无限循环
        iteration = 0

        while iteration < max_iterations:
            iteration += 1

            try:
                response = llm_client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    tools=self.registry.get_definitions(),
                )
            except Exception as exc:
                # 让前端获得明确错误，而不是 SSE 流意外中断后持续加载。
                message = str(exc).strip() or exc.__class__.__name__
                yield json.dumps({
                    "type": "answer",
                    "content": f"调用 DeepSeek 失败：{message}"
                }, ensure_ascii=False)
                return

            choice = response.choices[0]
            msg = choice.message

            # 将 assistant 消息加入上下文
            assistant_msg = {"role": "assistant", "content": msg.content or ""}
            if msg.tool_calls:
                assistant_msg["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        }
                    }
                    for tc in msg.tool_calls
                ]
            messages.append(assistant_msg)

            # 如果 LLM 决定调用工具
            if msg.tool_calls:
                for tool_call in msg.tool_calls:
                    func_name = tool_call.function.name
                    try:
                        func_args = json.loads(tool_call.function.arguments)
                    except json.JSONDecodeError:
                        func_args = {}

                    # 流式返回工具调用信息
                    yield json.dumps({
                        "type": "tool_call",
                        "tool": func_name,
                        "args": func_args
                    }, ensure_ascii=False)

                    # 执行插件
                    result = self.registry.execute(func_name, func_args)

                    # 如果生成了图表，流式返回图表配置
                    if func_name == "generate_chart" and "echarts_option" in result:
                        yield json.dumps({
                            "type": "chart",
                            "data": result
                        }, ensure_ascii=False)

                    # 如果是 SQL 查询，返回表格数据
                    if func_name == "query_database" and "rows" in result:
                        yield json.dumps({
                            "type": "table",
                            "data": result
                        }, ensure_ascii=False)

                    # 工具结果送回 LLM
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(result, ensure_ascii=False),
                    })
                # 继续循环让 LLM 处理工具结果
            else:
                # LLM 返回最终自然语言回答
                yield json.dumps({
                    "type": "answer",
                    "content": msg.content or ""
                }, ensure_ascii=False)

                # 返回精简的对话历史供前端保存
                yield json.dumps({
                    "type": "history",
                    "messages": [
                        {"role": m["role"], "content": m.get("content", "")}
                        for m in messages
                        if m["role"] in ("user", "assistant") and m.get("content")
                    ]
                }, ensure_ascii=False)
                break

        if iteration >= max_iterations:
            yield json.dumps({
                "type": "answer",
                "content": "抱歉，分析过程过于复杂，已达到最大工具调用次数限制。请尝试简化您的问题。"
            }, ensure_ascii=False)
