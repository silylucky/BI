from openai import OpenAI
from config import Config

# DeepSeek API 兼容 OpenAI SDK，直接用 OpenAI 客户端
llm_client = OpenAI(
    api_key=Config.DEEPSEEK_API_KEY,
    base_url=Config.DEEPSEEK_BASE_URL,
)

MODEL = Config.MODEL
