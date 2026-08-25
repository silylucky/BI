import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
BASE_DIR = BACKEND_DIR.parent

# 启动时自动加载 backend/.env；系统环境变量中的同名值优先。
load_dotenv(BACKEND_DIR / ".env")


class Config:
    # DeepSeek API 配置
    DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_BASE_URL = "https://api.deepseek.com"
    MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")  # 官方 API 支持工具调用的模型

    # 数据库
    DB_PATH = str(BASE_DIR / "data" / "business.db")

    # 服务
    HOST = "0.0.0.0"
    PORT = 8000

    # 会话
    MAX_HISTORY_MESSAGES = 50  # 保留最近 50 条对话
