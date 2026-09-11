"""国密 / 遗留加密可插拔层。

请从子模块直接导入，例如 ``app.core.crypto.credentials``、``app.core.crypto.sm2``，
避免经本包 ``__init__`` 聚合导入（防止与 ``app.core.config`` 循环依赖）。
"""
