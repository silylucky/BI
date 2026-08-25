from typing import Dict, List, Any
from plugins.base import BasePlugin


class PluginRegistry:
    """插件注册中心：管理所有已注册的插件"""

    def __init__(self):
        self._plugins: Dict[str, BasePlugin] = {}

    def register(self, plugin: BasePlugin) -> "PluginRegistry":
        """注册插件"""
        self._plugins[plugin.name] = plugin
        return self

    def unregister(self, name: str):
        """卸载插件"""
        self._plugins.pop(name, None)

    def get_definitions(self) -> List[dict]:
        """获取所有插件的工具定义，供 LLM function calling 使用"""
        return [p.get_definition() for p in self._plugins.values()]

    def execute(self, name: str, arguments: dict) -> dict:
        """执行指定插件"""
        if name not in self._plugins:
            return {"error": f"插件 '{name}' 不存在"}
        try:
            return self._plugins[name].execute(**arguments)
        except Exception as e:
            return {"error": f"插件执行异常: {str(e)}"}

    def list_plugins(self) -> List[str]:
        """列出所有已注册插件名"""
        return list(self._plugins.keys())
