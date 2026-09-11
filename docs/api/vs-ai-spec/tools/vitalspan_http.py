"""Shared HTTP helpers for vs-ai-spec CLI tools."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def pack_dir() -> Path:
    here = Path(__file__).resolve().parent
    for candidate in (here.parent, here.parent / "docs" / "api" / "vs-ai-spec"):
        if (candidate / "examples" / "custom-viz-d3-bundle.json").is_file():
            return candidate
    raise SystemExit("cannot find examples/custom-viz-d3-bundle.json")


def resolve_spec_path(pack: Path, file_arg: Path) -> Path:
    if file_arg.is_absolute() and file_arg.is_file():
        return file_arg
    path = file_arg if file_arg.is_absolute() else pack / file_arg
    if not path.is_file():
        path = Path.cwd() / file_arg
    if not path.is_file():
        ws = os.environ.get("VITALSPAN_WORKSPACE")
        if ws and not file_arg.is_absolute():
            path = Path(ws) / file_arg
    if not path.is_file():
        raise SystemExit(f"file not found: {file_arg}")
    return path


def default_api() -> str:
    return os.environ.get("VITALSPAN_API", "http://127.0.0.1:8000/api/v1").rstrip("/")


def health_base_url(api: str | None = None) -> str:
    api_base = (api or default_api()).rstrip("/")
    if api_base.endswith("/api/v1"):
        return api_base[: -len("/api/v1")]
    return api_base.rsplit("/api/", 1)[0]


def default_credentials() -> tuple[str, str]:
    return (
        os.environ.get("VITALSPAN_USERNAME", "admin"),
        os.environ.get("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme"),
    )


def request_json(method: str, url: str, body: dict | None, token: str | None = None) -> dict:
    raw_body = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=raw_body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status == 204:
                return {}
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        err = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"{method} {url} -> {exc.code}\n{err}") from exc


def login(api: str, username: str | None = None, password: str | None = None) -> str:
    user, pwd = default_credentials()
    login_body = request_json(
        "POST",
        f"{api.rstrip('/')}/auth/login",
        {"username": username or user, "password": password or pwd},
    )
    token = login_body.get("accessToken") or login_body.get("access_token")
    if not token:
        raise SystemExit("login missing accessToken; is the API up?")
    return token


def health_check(api: str | None = None) -> None:
    url = f"{health_base_url(api)}/health"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            payload = json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        err = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"GET {url} -> {exc.code}\n{err}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"GET {url} failed: {exc.reason}") from exc
    if payload.get("status") != "ok":
        raise SystemExit(f"health check failed: {payload!r}")
    print(f"ok health {url}")


def list_artifacts(api: str, token: str, *, limit: int = 100, offset: int = 0) -> dict[str, Any]:
    params = f"limit={limit}&offset={offset}"
    return request_json("GET", f"{api.rstrip('/')}/ai-viz/artifacts?{params}", None, token)


def create_artifact(api: str, token: str, bundle: dict[str, Any]) -> dict[str, Any]:
    return request_json("POST", f"{api.rstrip('/')}/ai-viz/artifacts", bundle, token)


def update_artifact(api: str, token: str, artifact_id: str, bundle: dict[str, Any]) -> dict[str, Any]:
    return request_json("PUT", f"{api.rstrip('/')}/ai-viz/artifacts/{artifact_id}", bundle, token)


def delete_artifact(
    api: str,
    token: str,
    artifact_id: str,
    *,
    unlink: bool = False,
) -> dict[str, Any]:
    query = "?unlink=true" if unlink else ""
    return request_json(
        "DELETE",
        f"{api.rstrip('/')}/ai-viz/artifacts/{artifact_id}{query}",
        None,
        token,
    )


def get_artifact_bundle(api: str, token: str, artifact_id: str) -> dict[str, Any]:
    return request_json("GET", f"{api.rstrip('/')}/ai-viz/artifacts/{artifact_id}/bundle", None, token)


def get_artifact_refs(api: str, token: str, artifact_id: str) -> dict[str, Any]:
    return request_json("GET", f"{api.rstrip('/')}/ai-viz/artifacts/{artifact_id}/refs", None, token)


def delete_dashboard(api: str, token: str, dashboard_id: str) -> None:
    request_json("DELETE", f"{api.rstrip('/')}/dashboards/{dashboard_id}", None, token)
