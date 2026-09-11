#!/usr/bin/env python3
"""生成 VitalSpan JWT SM2 密钥对（hex）。"""

from __future__ import annotations

import os
import sys

_REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_BACKEND = os.path.join(_REPO, "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from app.core.crypto.sm2 import generate_keypair


def main() -> int:
    private_key, public_key = generate_keypair()
    print("# 追加到 backend/.env（勿提交生产私钥）")
    print(f"JWT_SM2_PRIVATE_KEY={private_key}")
    print(f"JWT_SM2_PUBLIC_KEY={public_key}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
