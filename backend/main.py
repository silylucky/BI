import json
import os
import sys

# 确保能找到 backend 包
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from agent.core import BiAgent
from agent.session_manager import session_manager
from plugins.registry import PluginRegistry
from plugins.sql_query import SqlQueryPlugin
from plugins.data_analysis import DataAnalysisPlugin
from plugins.chart_generator import ChartGeneratorPlugin
from config import Config

app = FastAPI(title="BI 问数智能体", version="1.0.0")

# CORS 允许前端跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== 初始化插件 =====
registry = PluginRegistry()
registry.register(SqlQueryPlugin())
registry.register(DataAnalysisPlugin())
registry.register(ChartGeneratorPlugin())

# ===== 创建 Agent =====
agent = BiAgent(registry)


@app.post("/chat")
async def chat(body: dict):
    """对话接口 - SSE 流式返回"""
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
    """返回已注册的插件列表"""
    return {"plugins": registry.get_definitions()}


@app.delete("/session/{session_id}")
async def clear_session(session_id: str):
    """清除会话历史"""
    session_manager.clear(session_id)
    return {"status": "ok", "message": f"会话 {session_id} 已清除"}


@app.get("/health")
async def health():
    return {"status": "ok", "model": Config.MODEL}


# 挂载前端静态文件（如果存在 dist 目录）
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=Config.HOST, port=Config.PORT, reload=True)
