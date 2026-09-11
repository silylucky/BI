#!/usr/bin/env python3
"""MVP 一键上传：无 DeepTalk 源码也能 POST 入库（给接口即用）。

  python tools/mvp-upload.py --file examples/my-widget.json
  python tools/mvp-upload.py --from output/deeptalk-widget.json
  python tools/mvp-upload.py --list
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))

from artifact_cli import pack_dir, print_publish_result, publish_bundle
from vitalspan_http import default_api, health_check, list_artifacts, login

ARTIFACT_ID_RE = re.compile(r"artifactId=([0-9a-fA-F-]{36})", re.I)
LOCAL_CONFIG_NAMES = ("local.config.json", "local.config.yaml")


def pack_root() -> Path:
    return pack_dir()


def load_local_config(pack: Path) -> dict:
    for name in LOCAL_CONFIG_NAMES:
        path = pack / name
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        if name.endswith(".json"):
            return json.loads(text)
        # minimal yaml: only read vitalspan.api_base / vitalspan_root lines
        data: dict = {"vitalspan": {}}
        for line in text.splitlines():
            line = line.strip()
            if line.startswith("api_base:"):
                data["vitalspan"]["api_base"] = line.split(":", 1)[1].strip().strip('"')
            if line.startswith("vitalspan_root:"):
                data["vitalspan"]["vitalspan_root"] = line.split(":", 1)[1].strip().strip('"')
        return data
    return {}


def auto_vitalspan_root(pack: Path, cfg: dict) -> str | None:
    explicit = (cfg.get("vitalspan") or {}).get("vitalspan_root")
    if explicit and Path(explicit).joinpath("backend", "app").is_dir():
        return str(Path(explicit).resolve())
    if os.environ.get("VITALSPAN_ROOT"):
        root = Path(os.environ["VITALSPAN_ROOT"])
        if root.joinpath("backend", "app").is_dir():
            return str(root.resolve())
    # walk up from pack
    for parent in (pack, *pack.parents):
        if (parent / "backend" / "app").is_dir() and (parent / "docs" / "api" / "vs-ai-spec").is_dir():
            return str(parent.resolve())
        if parent.name == "VitalSpan" and (parent / "backend" / "app").is_dir():
            return str(parent.resolve())
    return None


def apply_local_env(pack: Path) -> str:
    cfg = load_local_config(pack)
    vs = cfg.get("vitalspan") or {}
    api = str(vs.get("api_base") or default_api()).rstrip("/")
    os.environ["VITALSPAN_API"] = api
    root = auto_vitalspan_root(pack, cfg)
    if root:
        os.environ["VITALSPAN_ROOT"] = root
    return api


def resolve_upload_path(pack: Path, file_arg: str, from_arg: str | None) -> Path:
    if from_arg:
        src = Path(from_arg)
        if not src.is_file():
            src = pack / from_arg
        if not src.is_file():
            raise SystemExit(f"source not found: {from_arg}")
        if "output" not in src.parts and "dist" not in src.parts:
            print(f"note: --from used; copying {src.name} -> examples/")
        dest = pack / "examples" / src.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        print(f"ok draft examples/{src.name} (from {src})")
        return dest
    path = pack / file_arg if not Path(file_arg).is_absolute() else Path(file_arg)
    if not path.is_file():
        path = Path.cwd() / file_arg
    if not path.is_file():
        raise SystemExit(f"file not found: {file_arg}")
    rel = path.resolve().relative_to(pack.resolve())
    parts = rel.parts
    if parts[0] in ("output", "dist"):
        raise SystemExit(
            f"refusing publish directly from {parts[0]}/; use --from {rel.as_posix()} to copy into examples/ first"
        )
    return path


def cmd_list(api: str) -> int:
    token = login(api, None, None)
    data = list_artifacts(api, token, limit=100, offset=0)
    items = data.get("items") or []
    print(f"count {len(items)}")
    for item in items:
        aid = item.get("artifactId") or item.get("artifact_id")
        name = item.get("displayName") or item.get("display_name") or "?"
        tier = item.get("styleComplianceTier") or item.get("style_compliance_tier") or "-"
        print(f"  {aid}  {name}  tier={tier}")
    return 0


def main() -> None:
    pack = pack_root()
    parser = argparse.ArgumentParser(
        description="MVP upload to VitalSpan (no DeepTalk source required)",
    )
    parser.add_argument("--file", help="bundle under pack, e.g. examples/my.json")
    parser.add_argument(
        "--from",
        dest="from_path",
        help="copy from output/ or elsewhere into examples/ then publish",
    )
    parser.add_argument("--artifact-id", default=None, help="PUT update existing uuid")
    parser.add_argument("--list", action="store_true", help="list platform library")
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--skip-health", action="store_true")
    parser.add_argument("--api", default=None, help="override API base")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    api = apply_local_env(pack)
    if args.api:
        api = str(args.api).rstrip("/")
        os.environ["VITALSPAN_API"] = api

    if args.list:
        raise SystemExit(cmd_list(api))

    if not args.file and not args.from_path:
        parser.error("--file or --from required (or use --list)")

    if not args.skip_health:
        health_check(api)

    rel_path = resolve_upload_path(pack, args.file or "", args.from_path)
    rel = rel_path.relative_to(pack).as_posix()

    publish_args = argparse.Namespace(
        file=Path(rel),
        artifact_id=args.artifact_id,
        api=api,
        username=os.environ.get("VITALSPAN_USERNAME", "admin"),
        password=os.environ.get("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme"),
        health_first=False,
        validate_only=args.validate_only,
        skip_preflight=False,
        json=False,
    )
    result = publish_bundle(publish_args)
    if args.validate_only:
        print("mvp ok validate-only (no POST)")
        return

    print_publish_result(result, api, json_out=args.json)
    combined = json.dumps(result) if args.json else ""
    aid = result.get("artifactId") or result.get("artifact_id")
    if aid:
        fe = os.environ.get("VITALSPAN_FE", "http://127.0.0.1:5173/admin")
        print("--- MVP 验收 ---")
        print(f"1. 打开 {fe} → 大屏编辑 → 图表盘 → 自定义")
        print(f"2. 应看到组件 artifactId={aid}")
        print("3. 拖入画布后样式面板改色应生效")


if __name__ == "__main__":
    main()
