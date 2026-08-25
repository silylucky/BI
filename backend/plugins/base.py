from abc import ABC, abstractmethod
from typing import Any


class BasePlugin(ABC):
    """所有插件的基类，外部工具通过继承此类接入 Agent"""

    @property
    @abstractmethod
    def name(self) -> str:
        """插件唯一标识名"""
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        """插件功能描述，供 LLM 理解何时调用"""
        ...

    @property
    @abstractmethod
    def parameters(self) -> dict:
        """JSON Schema 格式的参数定义"""
        ...

    @abstractmethod
    def execute(self, **kwargs) -> dict:
        """执行插件逻辑，返回结果字典"""
        ...

    def get_definition(self) -> dict:
        """返回 OpenAI function calling 格式的工具定义"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }
