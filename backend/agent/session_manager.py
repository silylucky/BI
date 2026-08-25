from typing import Dict, List
from config import Config


class SessionManager:
    """会话管理 - 存储对话历史（生产环境建议用 Redis）"""

    def __init__(self):
        self._sessions: Dict[str, List[dict]] = {}

    def get_history(self, session_id: str) -> List[dict]:
        return self._sessions.get(session_id, [])

    def set_history(self, session_id: str, messages: List[dict]):
        # 限制历史长度
        if len(messages) > Config.MAX_HISTORY_MESSAGES:
            messages = messages[-Config.MAX_HISTORY_MESSAGES:]
        self._sessions[session_id] = messages

    def clear(self, session_id: str):
        self._sessions.pop(session_id, None)


session_manager = SessionManager()
