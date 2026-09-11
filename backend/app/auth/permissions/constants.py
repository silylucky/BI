from __future__ import annotations

import uuid

# 权限目录 ID 的共享命名空间。catalog.py 与 0025 migration 必须引用同一常量，
# 通过 UUIDv5(code) 生成确定性 ID，禁止各自随机生成。
PERMISSION_NAMESPACE_UUID = uuid.UUID("6f3e2a1b-8c4d-5e6f-9a0b-1c2d3e4f5a6b")


def permission_id_for_code(code: str) -> uuid.UUID:
    """按权限编码生成确定性 UUIDv5，保证代码目录与迁移回填 ID 一致。"""
    return uuid.uuid5(PERMISSION_NAMESPACE_UUID, code)
