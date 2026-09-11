#!/usr/bin/env python3
"""One-off: align tests with国密 Settings env."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TESTS = ROOT / "tests"

BLOCK = (
    '        secret_key="ci-test-secret-key-min-32-chars-long!!",\n'
    '        credential_fernet_key="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",\n'
    '        credential_sm4_key="0123456789abcdef0123456789abcdef",\n'
)
REPL = '        **settings_kwargs(),\n'

IMPORT = "from crypto_test_env import settings_kwargs\n"


def patch_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    orig = text
    if BLOCK in text:
        text = text.replace(BLOCK, REPL)
    text = text.replace(
        'env["SECRET_KEY"] = "ci-test-secret-key-min-32-chars-long!!"\n',
        "",
    )
    text = text.replace(
        'env["CREDENTIAL_FERNET_KEY"] = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="\n',
        "",
    )
    text = re.sub(
        r'    env\.setdefault\("SECRET_KEY",[^\n]+\n',
        "",
        text,
    )
    text = re.sub(
        r'    env\.setdefault\("CREDENTIAL_FERNET_KEY",[^\n]+\n',
        "",
        text,
    )
    if "**settings_kwargs()" in text and "from crypto_test_env import settings_kwargs" not in text:
        lines = text.splitlines(keepends=True)
        insert_at = 0
        for i, line in enumerate(lines):
            if line.startswith("import ") or line.startswith("from "):
                insert_at = i + 1
        lines.insert(insert_at, IMPORT)
        text = "".join(lines)
    if text != orig:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    for path in sorted(TESTS.glob("test_*.py")):
        if path.name in {"test_config.py", "test_crypto_sm4.py", "test_crypto_password_sm3.py", "test_crypto_jwt_sm2.py"}:
            continue
        if patch_file(path):
            print("patched", path.name)


if __name__ == "__main__":
    main()
