"""Load deeptalk-product config for vs-ai-spec tools and CI helpers."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class VitalSpanConfig:
    api_base: str
    fe_base: str
    vitalspan_root: str
    username_env: str
    password_env: str
    spec_pack_dir: str
    forbidden_delivery_dirs: tuple[str, ...]


def integration_root() -> Path:
    return Path(__file__).resolve().parent.parent


def find_integration_root(start: Path | None = None) -> Path:
    here = start or Path.cwd()
    for candidate in (here, *here.parents):
        if (candidate / "config.yaml.example").is_file() and (
            candidate / "lib" / "completion_gate.py"
        ).is_file():
            return candidate
        if (candidate / "integrations" / "vitalspan" / "lib" / "completion_gate.py").is_file():
            return candidate / "integrations" / "vitalspan"
    return integration_root()


def _parse_simple_yaml(text: str) -> dict:
    root: dict = {}
    stack: list[tuple[int, dict]] = [(-1, root)]
    for line in text.splitlines():
        if not line.strip() or line.strip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        while stack and indent <= stack[-1][0]:
            stack.pop()
        parent = stack[-1][1]
        match = re.match(r"^(\w+):\s*(.*)$", line.strip())
        if not match:
            continue
        key, raw = match.group(1), match.group(2).strip()
        if raw == "":
            child: dict = {}
            parent[key] = child
            stack.append((indent, child))
        elif raw.startswith("[") and raw.endswith("]"):
            items = [x.strip().strip('"').strip("'") for x in raw[1:-1].split(",") if x.strip()]
            parent[key] = items
        else:
            parent[key] = raw.strip('"').strip("'")
    return root


def load_config(int_root: Path | None = None) -> VitalSpanConfig:
    root = int_root or find_integration_root()
    data: dict = {}
    for name in ("config.json", "config.yaml"):
        path = root / name
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        if name.endswith(".json"):
            data = json.loads(text)
        else:
            data = _parse_simple_yaml(text)
        break

    vs = data.get("vitalspan") or {}
    agent = data.get("agent") or {}
    cred = vs.get("credential_env") or {}
    if isinstance(cred, str):
        cred = {"username": "VITALSPAN_USERNAME", "password": cred}
    forbidden = agent.get("forbidden_delivery_dirs") or ["output", "dist"]
    return VitalSpanConfig(
        api_base=str(vs.get("api_base") or "http://127.0.0.1:8000/api/v1"),
        fe_base=str(vs.get("fe_base") or "http://127.0.0.1:5173/admin"),
        vitalspan_root=str(vs.get("vitalspan_root") or ""),
        username_env=str(cred.get("username") or "VITALSPAN_USERNAME"),
        password_env=str(cred.get("password") or "VITALSPAN_DEV_ADMIN_PASSWORD"),
        spec_pack_dir=str(agent.get("spec_pack_dir") or "vs-ai-spec"),
        forbidden_delivery_dirs=tuple(str(x) for x in forbidden),
    )


def spec_pack_path(int_root: Path | None = None) -> Path:
    root = int_root or find_integration_root()
    cfg = load_config(root)
    pack = root / cfg.spec_pack_dir
    if pack.is_dir() and (pack / "tools" / "publish-ai-viz-artifact.py").is_file():
        return pack
    dev_pack = root.parent
    if (dev_pack / "tools" / "publish-ai-viz-artifact.py").is_file():
        return dev_pack
    cwd = Path.cwd()
    if (cwd / "tools" / "publish-ai-viz-artifact.py").is_file():
        return cwd
    raise SystemExit(f"vs-ai-spec pack not found under {root / cfg.spec_pack_dir}")


def apply_env(cfg: VitalSpanConfig, int_root: Path | None = None) -> dict[str, str]:
    env = os.environ.copy()
    env["VITALSPAN_API"] = cfg.api_base.rstrip("/")
    if cfg.vitalspan_root:
        env["VITALSPAN_ROOT"] = cfg.vitalspan_root
    elif "VITALSPAN_ROOT" not in env:
        int_root = find_integration_root(int_root)
        for guess in (int_root.parent, *int_root.parents):
            if (guess / "backend" / "app").is_dir():
                env["VITALSPAN_ROOT"] = str(guess.resolve())
                break
    user = env.get(cfg.username_env) or env.get("VITALSPAN_USERNAME", "admin")
    pwd = env.get(cfg.password_env) or env.get("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme")
    env["VITALSPAN_USERNAME"] = user
    env["VITALSPAN_DEV_ADMIN_PASSWORD"] = pwd
    return env
