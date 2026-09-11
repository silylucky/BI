#!/usr/bin/env python3
"""Sync QQ/SMTP creds from ~/.dev/secrets.env into backend/.env (RPT_SMTP_*)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_ENV = ROOT / "backend" / ".env"
HOME_SECRETS = Path.home() / ".dev" / "secrets.env"
PLACEHOLDER_USERS = {"sss@example.com", "example@qq.com", ""}


def _parse_env(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        out[key.strip()] = value.strip()
    return out


def _upsert_env_lines(text: str, updates: dict[str, str]) -> str:
    lines = text.splitlines()
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        matched = False
        for key, value in updates.items():
            if re.match(rf"^{re.escape(key)}=", line):
                out.append(f"{key}={value}")
                seen.add(key)
                matched = True
                break
        if not matched:
            out.append(line)
    for key, value in updates.items():
        if key not in seen:
            out.append(f"{key}={value}")
    return "\n".join(out).rstrip() + "\n"


def main() -> int:
    secrets = _parse_env(HOME_SECRETS)
    user = secrets.get("SMTP_SMOKE_USER", "")
    password = secrets.get("SMTP_SMOKE_PASS", "")
    if user in PLACEHOLDER_USERS or not password or password == "asdf":
        print(
            "未找到有效 QQ SMTP 凭据。请在 ~/.dev/secrets.env 设置：\n"
            "  SMTP_SMOKE_USER=你的QQ@qq.com\n"
            "  SMTP_SMOKE_PASS=QQ邮箱授权码\n"
            "然后重新运行本脚本。",
            file=sys.stderr,
        )
        return 1
    if not BACKEND_ENV.is_file():
        print(f"缺少 {BACKEND_ENV}", file=sys.stderr)
        return 1
    updates = {
        "RPT_SMTP_HOST": "smtp.qq.com",
        "RPT_SMTP_PORT": "587",
        "RPT_SMTP_FROM": user,
        "RPT_SMTP_USER": user,
        "RPT_SMTP_PASSWORD": password,
    }
    BACKEND_ENV.write_text(_upsert_env_lines(BACKEND_ENV.read_text(encoding="utf-8"), updates), encoding="utf-8")
    print(f"已写入 backend/.env（发件人 {user}）。请重启后端并刷新定时预检。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
