#!/usr/bin/env python3
"""Deterministic state and output guard for the ocr-code-review Skill.

The model decides whether code is defective. This program owns scope, fingerprints,
location, lifecycle, coverage and final output so those facts are never trusted to
free-form model text.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable


SCHEMA_VERSION = 5
SKILL_VERSION = "0.10.0"
PROTOCOL_VERSION = "ocr-code-review-protocol-v11"

SUPPORTED_EXTENSIONS = {
    ".java", ".kt", ".kts", ".scala", ".groovy", ".py", ".pyi", ".js",
    ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".c", ".h", ".cpp", ".cc",
    ".cxx", ".hpp", ".hxx", ".cs", ".vb", ".fs", ".go", ".rs", ".rb",
    ".rake", ".gemspec", ".php", ".phtml", ".swift", ".m", ".mm", ".sh",
    ".bash", ".zsh", ".fish", ".ps1", ".sql", ".css", ".scss", ".sass",
    ".less", ".html", ".htm", ".ftl", ".ftlh", ".ftlx", ".astro", ".vue",
    ".svelte", ".xml", ".yaml", ".yml", ".json", ".toml", ".ini", ".env",
    ".gradle", ".cmake", ".r", ".lua", ".pl", ".pm", ".ex", ".exs",
    ".erl", ".hrl", ".ets", ".json5", ".dart", ".tf", ".graphql", ".gql",
    ".prisma", ".jl", ".hcl", ".tfvars", ".bicep", ".proto", ".nix",
    ".hs", ".lhs", ".nim", ".nims", ".nimble",
}

DEFAULT_EXCLUDES = [
    "**/*_test.go", "**/src/test/java/**/*.java", "**/src/test/**/*.kt",
    "**/*.test.{js,jsx,ts,tsx}", "**/*.spec.{js,jsx,ts,tsx}", "**/__tests__/**",
    "**/test/**/*_test.py", "**/tests/**/*_test.py", "**/*_test.py",
    "**/*_spec.rb", "**/spec/**/*_spec.rb",
    "**/*_test.rs", "**/oh_modules/**", "**/*.test.ets", "**/test/**/*.jl",
    "**/test/**/*.hs", "**/*Spec.hs", "**/test/**/*.lhs", "**/*Spec.lhs",
    "**/tests/**/*.nim", "**/__snapshots__/**", "**/*.snap", "**/testdata/**",
    "**/fixtures/**", "**/*.generated.*", "**/*.gen.go", "**/*.pb.go",
    "**/*.pb.cc", "**/*.pb.h",
]

PROVIDER_EXCLUDED_DIRS = {
    ".idea", ".vscode", ".svn", ".git", "vendor", "node_modules", "target",
    ".happypack", ".cachefile", "_packages", "rpm", "pkgs",
}
SELF_INSTALL_EXCLUDES = [
    "**/.agents/skills/ocr-code-review/**",
    "**/.cursor/skills/ocr-code-review/**",
]
TEST_DIRECTORY_NAMES = {"test", "tests", "__tests__", "spec", "specs"}
CAMEL_CASE_TEST_EXTENSIONS = {
    ".java", ".kt", ".kts", ".groovy", ".cs", ".vb", ".fs",
    ".swift", ".php", ".hs", ".lhs",
}
SCAN_SCOPE_EXCLUDES = {
    "runtime-code": [
        "docs/**", "**/docs/**", "**/*.md", "**/*.markdown",
        "scripts/**", "**/scripts/**", "examples/**", "**/examples/**",
        ".agents/**", "**/.agents/**", ".cursor/**", "**/.cursor/**",
    ],
    "apps-packages": [
        "docs/**", "**/docs/**", "**/*.md", "**/*.markdown",
        "scripts/**", "**/scripts/**", "examples/**", "**/examples/**",
        ".agents/**", "**/.agents/**", ".cursor/**", "**/.cursor/**",
    ],
    "full": [],
}
APPS_PACKAGES_ROOTS = {
    "app", "apps", "package", "packages", "service", "services", "src",
    "cmd", "internal", "lib", "libs", "server", "client", "backend", "frontend",
}
MAX_TASK_RETRIES = 2
# Soft re-probe step only — never a hard launch ceiling. Default/auto first wave
# requests ALL Primary Targets (maximize-first) so Controllers do not stop at 15.
AUTO_CONCURRENCY_MINIMUM = 15
AUTO_PROBE_MIN_STEP = 15
AUTO_REPROBE_COMPLETIONS = 5
DEFAULT_CONCURRENCY = "max"
FLEET_CAP_DEFAULT = 20
FLEET_RECOMMEND_THRESHOLD = 16
FLEET_BULK_REJECT_THRESHOLD = 50
FLEET_BRANCH_PREFIX = "ocr-fleet/"
RESULT_SHARD_MAX_BYTES = 512 * 1024
RESULT_PREVIEW_LIMIT = 20
SEMANTIC_HINT_MAX_CHARS = 512
DEFAULT_LEASE_SECONDS = 15 * 60
VERIFIER_RESERVE_RATIO = 0.25
VERIFIER_BACKPRESSURE_MINIMUM = 4
VALID_IMPACT_SURFACES = {"runtime", "build-deploy", "tooling", "test", "docs"}
VALID_REACHABILITY = {"proven", "likely", "unknown"}

VERIFIER_CATEGORIES = {"security", "concurrency", "transaction", "data-consistency", "data-loss"}
MATERIAL_BLIND_SPOT_SCOPES = {
    "primary-target", "changed-code", "core-path", "external-integration",
    "auth-boundary", "data-boundary",
}
BLIND_SPOT_SCOPES = MATERIAL_BLIND_SPOT_SCOPES | {"optional-tool", "peripheral"}
VALID_SEVERITIES = {"critical", "high", "medium", "low"}
VALID_CATEGORIES = {
    "bug", "security", "performance", "maintainability", "test", "style",
    "documentation", "concurrency", "transaction", "data-consistency", "data-loss", "other",
}
REQUIRED_FINDING_FIELDS = {
    "title", "claim", "severity", "category", "existing_code", "expected",
    "actual", "impact", "evidence", "impact_surface", "reachability",
    "current_input_reproducible",
}


class ReviewError(Exception):
    def __init__(self, code: str, message: str, next_action: str = "inspect_error", **details: Any):
        super().__init__(message)
        self.payload = {
            "error": code,
            "message": message,
            "next_action": next_action,
            **details,
        }


class JsonArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise ReviewError("INVALID_ARGUMENTS", message, "fix_command_arguments")


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


def canonical_hash(value: Any) -> str:
    data = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256_text(data)


def emit_json(stream: Any, value: Any) -> None:
    data = (json.dumps(value, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8")
    buffer = getattr(stream, "buffer", None)
    if buffer is not None:
        buffer.write(data)
        buffer.flush()
    else:
        stream.write(data.decode("utf-8"))
        stream.flush()


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ReviewError("FILE_NOT_FOUND", f"Required file does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ReviewError("INVALID_JSON", f"Invalid JSON in {path}: {exc}") from exc
    except UnicodeError as exc:
        raise ReviewError("INVALID_ENCODING", f"Expected UTF-8 JSON in {path}: {exc}") from exc
    except OSError as exc:
        raise ReviewError("FILE_READ_FAILED", f"Cannot read {path}: {exc}") from exc


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(json_text(value))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def atomic_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(value)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


@contextmanager
def session_lock(session_dir: Path, timeout_seconds: float = 30.0):
    """Serialize manifest mutations across Cursor reviewer processes."""
    lock_path = session_dir / ".session.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    handle = open(lock_path, "a+b")
    if handle.seek(0, os.SEEK_END) == 0:
        handle.write(b"0")
        handle.flush()
    deadline = time.monotonic() + timeout_seconds
    acquired = False
    try:
        while not acquired:
            try:
                handle.seek(0)
                if os.name == "nt":
                    import msvcrt

                    msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl

                    fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                acquired = True
            except OSError:
                if time.monotonic() >= deadline:
                    raise ReviewError(
                        "SESSION_LOCK_TIMEOUT",
                        f"Timed out waiting for session lock: {lock_path}",
                        "retry_command",
                    )
                time.sleep(0.05)
        yield
    finally:
        if acquired:
            handle.seek(0)
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        handle.close()


def git(repo: Path, *args: str, check: bool = True) -> str:
    proc = subprocess.run(
        ["git", "-c", "core.quotepath=false", *args],
        cwd=repo,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
    )
    if check and proc.returncode != 0:
        raise ReviewError("GIT_FAILED", proc.stderr.strip() or "git command failed", "fix_git_state")
    return proc.stdout


def git_root(repo: Path) -> Path:
    root = git(repo, "rev-parse", "--show-toplevel").strip()
    return Path(root).resolve()


def normalize_path(path: str) -> str:
    normalized = path.replace("\\", "/")
    while normalized.startswith("./"):
        normalized = normalized[2:]
    return normalized


def expand_braces(pattern: str) -> list[str]:
    match = re.search(r"\{([^{}]+)\}", pattern)
    if not match:
        return [pattern]
    results: list[str] = []
    for option in match.group(1).split(","):
        expanded = pattern[: match.start()] + option + pattern[match.end() :]
        results.extend(expand_braces(expanded))
    return results


def glob_regex(pattern: str) -> re.Pattern[str]:
    pattern = normalize_path(pattern).lower()
    parts: list[str] = ["^"]
    i = 0
    while i < len(pattern):
        char = pattern[i]
        if char == "*":
            if i + 1 < len(pattern) and pattern[i + 1] == "*":
                i += 2
                if i < len(pattern) and pattern[i] == "/":
                    parts.append("(?:.*/)?")
                    i += 1
                else:
                    parts.append(".*")
                continue
            parts.append("[^/]*")
        elif char == "?":
            parts.append("[^/]")
        else:
            parts.append(re.escape(char))
        i += 1
    parts.append("$")
    return re.compile("".join(parts), re.IGNORECASE)


def glob_match(pattern: str, path: str) -> bool:
    normalized = normalize_path(path).lower()
    return any(glob_regex(item).match(normalized) is not None for item in expand_braces(pattern))


def matches_any(patterns: Iterable[str], path: str) -> bool:
    return any(glob_match(pattern, path) for pattern in patterns)


def excluded_provider_dir(path: str) -> bool:
    parts = normalize_path(path).split("/")[:-1]
    return any(part.lower() in PROVIDER_EXCLUDED_DIRS for part in parts)


def load_rule_file(
    path: Path, reference_root: Path | None = None, source: str = "rule"
) -> dict[str, Any] | None:
    if not path.exists():
        return None
    value = read_json(path)
    if not isinstance(value, dict):
        raise ReviewError("INVALID_RULE", f"Rule file must contain a JSON object: {path}")
    entries = value.get("rules", [])
    if not isinstance(entries, list):
        raise ReviewError("INVALID_RULE", f"rules must be an array: {path}")
    include = value.get("include", []) or []
    exclude = value.get("exclude", []) or []
    if not isinstance(include, list) or not all(isinstance(item, str) for item in include):
        raise ReviewError("INVALID_RULE", f"include must be an array of strings: {path}")
    if not isinstance(exclude, list) or not all(isinstance(item, str) for item in exclude):
        raise ReviewError("INVALID_RULE", f"exclude must be an array of strings: {path}")
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ReviewError("INVALID_RULE", f"rules[{index}] must be an object: {path}")
        if not isinstance(entry.get("path"), str):
            raise ReviewError("INVALID_RULE", f"rules[{index}].path must be a string: {path}")
        rule = entry.get("rule", "")
        if not isinstance(rule, str):
            raise ReviewError("INVALID_RULE", f"rule must be a string: {path}")
        if not isinstance(entry.get("merge_system_rule", False), bool):
            raise ReviewError("INVALID_RULE", f"merge_system_rule must be boolean: {path}")
        if "\n" not in rule and " " not in rule and Path(rule).suffix.lower() in {".md", ".txt", ".markdown"}:
            referenced = Path(rule)
            if referenced.is_absolute():
                raise ReviewError(
                    "INVALID_RULE",
                    f"{source} rule references must be relative to their allowed root: {rule}",
                    "use_relative_rule_reference",
                )
            root = (reference_root or path.parent).resolve()
            referenced = root / referenced
            referenced = referenced.resolve()
            try:
                referenced.relative_to(root)
            except ValueError as exc:
                raise ReviewError("INVALID_RULE", f"Rule reference escapes allowed root: {rule}") from exc
            if not referenced.is_file():
                raise ReviewError("INVALID_RULE", f"Rule reference does not exist: {rule}")
            if referenced.stat().st_size > 512 * 1024:
                raise ReviewError("INVALID_RULE", f"Rule reference exceeds 512 KiB: {rule}")
            try:
                entry["rule"] = referenced.read_text(encoding="utf-8").rstrip("\n")
            except (OSError, UnicodeError) as exc:
                raise ReviewError("INVALID_RULE", f"Cannot read UTF-8 rule reference {rule}: {exc}") from exc
    value["_source_path"] = str(path.resolve())
    return value


def system_rules_root() -> Path:
    return Path(__file__).resolve().parents[1] / "references" / "rules"


def load_system_rules() -> dict[str, Any]:
    config_path = system_rules_root() / "system_rules.json"
    value = read_json(config_path)
    if not isinstance(value, dict) or not isinstance(value.get("path_rule_map", {}), dict):
        raise ReviewError("INVALID_RULE", f"Bundled system rules are invalid: {config_path}")
    return value


def rule_layers(repo: Path, custom_path: str | None) -> list[tuple[str, dict[str, Any]]]:
    layers: list[tuple[str, dict[str, Any]]] = []
    if custom_path:
        custom_path_obj = Path(custom_path).resolve()
        custom = load_rule_file(custom_path_obj, custom_path_obj.parent, "custom")
        if custom:
            layers.append(("custom", custom))
    project = load_rule_file(repo / ".opencodereview" / "rule.json", repo, "project")
    if project:
        layers.append(("project", project))
    global_path = Path.home() / ".opencodereview" / "rule.json"
    global_rule = load_rule_file(global_path, global_path.parent, "global")
    if global_rule:
        layers.append(("global", global_rule))
    return layers


def system_rule_for(path: str, config: dict[str, Any]) -> tuple[str, str]:
    rule_map = config.get("path_rule_map", {})
    for pattern, filename in rule_map.items():
        if glob_match(pattern, path):
            rule_path = system_rules_root() / "rule_docs" / filename
            if not rule_path.is_file():
                raise ReviewError("INVALID_RULE", f"Bundled rule document is missing: {rule_path}")
            text = rule_path.read_text(encoding="utf-8").rstrip("\n")
            return text, pattern
    default_name = config.get("default_rule", "default.md")
    default_path = system_rules_root() / "rule_docs" / default_name
    if not default_path.is_file():
        raise ReviewError("INVALID_RULE", f"Bundled default rule is missing: {default_path}")
    text = default_path.read_text(encoding="utf-8").rstrip("\n")
    return text, "default"


def resolved_rule(path: str, layers: list[tuple[str, dict[str, Any]]], system: dict[str, Any]) -> dict[str, str]:
    system_text, system_pattern = system_rule_for(path, system)
    for source, layer in layers:
        for entry in layer.get("rules", []):
            rule_text = entry.get("rule", "")
            if not rule_text and not entry.get("merge_system_rule", False):
                continue
            if glob_match(entry.get("path", ""), path):
                if entry.get("merge_system_rule", False):
                    if system_text and rule_text:
                        rule_text = (
                            "## System-Specific Rules (Mandatory)\n\n" + system_text
                            + "\n\n---\n\n## User-Specific Rules (Mandatory)\n\n" + rule_text
                        )
                    else:
                        rule_text = system_text or rule_text
                return {"text": rule_text, "source": source, "pattern": entry.get("path", "")}
    return {"text": system_text, "source": "system", "pattern": system_pattern}


def selected_file_filter(layers: list[tuple[str, dict[str, Any]]]) -> dict[str, list[str]] | None:
    for _source, layer in layers:
        include = layer.get("include", []) or []
        exclude = layer.get("exclude", []) or []
        if include or exclude:
            return {"include": [p.lower() for p in include], "exclude": [p.lower() for p in exclude]}
    return None


def is_standard_test_path(path: str) -> bool:
    """Recognize test conventions without treating arbitrary `test` substrings as tests."""
    normalized = normalize_path(path)
    parts = normalized.split("/")
    if any(part.lower() in TEST_DIRECTORY_NAMES for part in parts[:-1]):
        return True

    name = parts[-1]
    lower_name = name.lower()
    suffix = Path(name).suffix.lower()
    stem = name[: -len(suffix)] if suffix else name
    lower_stem = stem.lower()
    if lower_name == "conftest.py":
        return True
    if lower_stem in {"test", "tests", "spec", "specs"}:
        return True
    if lower_stem.startswith(("test_", "spec_")):
        return True
    if lower_stem.endswith(("_test", "_tests", "_spec", "_specs", ".test", ".spec")):
        return True
    if suffix in CAMEL_CASE_TEST_EXTENSIONS and stem.endswith(("Test", "Tests", "Spec")):
        return True
    return False


def impact_surface_for_path(path: str) -> str:
    normalized = normalize_path(path).lower()
    parts = normalized.split("/")
    name = parts[-1]
    if name.endswith((".md", ".markdown")) or "docs" in parts:
        return "docs"
    if is_standard_test_path(normalized) or matches_any(DEFAULT_EXCLUDES, normalized) or any(
        part in {"test", "tests", "spec", "specs", "fixtures", "testdata"}
        for part in parts[:-1]
    ):
        return "test"
    if any(part in {"scripts", "tools", "tooling"} for part in parts[:-1]):
        return "tooling"
    if any(
        part in {"deploy", "deployment", "infra", "infrastructure", ".github", ".gitlab"}
        for part in parts[:-1]
    ) or name in {"dockerfile", "makefile", "jenkinsfile"}:
        return "build-deploy"
    return "runtime"


def review_decision(
    path: str,
    file_filter: dict[str, list[str]] | None,
    scan_scope: str | None = None,
) -> tuple[bool, str]:
    path = normalize_path(path)
    if excluded_provider_dir(path) or matches_any(SELF_INSTALL_EXCLUDES, path):
        return False, "provider-or-self"
    if file_filter and matches_any(file_filter["exclude"], path):
        return False, "user-exclude"
    # OCR include is an admission override, not a whitelist.
    if file_filter and file_filter["include"] and matches_any(file_filter["include"], path):
        return True, "user-include"
    suffix = Path(path).suffix.lower()
    documentation = suffix in {".md", ".markdown"}
    if suffix and suffix not in SUPPORTED_EXTENSIONS and not (
        scan_scope == "full" and documentation
    ):
        return False, "unsupported-extension"
    if is_standard_test_path(path) or matches_any(DEFAULT_EXCLUDES, path):
        return False, "default-exclude"
    if scan_scope:
        if scan_scope not in SCAN_SCOPE_EXCLUDES:
            raise ReviewError("INVALID_SCAN_SCOPE", f"Unsupported scan scope: {scan_scope}")
        if matches_any(SCAN_SCOPE_EXCLUDES[scan_scope], path):
            return False, "scan-scope"
        if scan_scope == "apps-packages":
            first = path.split("/", 1)[0].lower()
            if "/" in path and first not in APPS_PACKAGES_ROOTS:
                return False, "scan-scope"
    return True, "included"


def should_review(
    path: str,
    file_filter: dict[str, list[str]] | None,
    scan_scope: str | None = None,
) -> bool:
    return review_decision(path, file_filter, scan_scope)[0]


def list_scan_files(repo: Path) -> list[str]:
    output = git(repo, "ls-files", "-co", "--exclude-standard", "-z")
    return sorted({normalize_path(item) for item in output.split("\0") if item})


def list_review_files(repo: Path, base: str, head: str) -> list[str]:
    git(repo, "rev-parse", "--verify", base)
    if head == "WORKTREE":
        output = git(repo, "diff", "--name-only", "--diff-filter=ACMRTUXB", "-z", base, "--")
        untracked = git(repo, "ls-files", "--others", "--exclude-standard", "-z")
        output += untracked
    else:
        git(repo, "rev-parse", "--verify", head)
        output = git(repo, "diff", "--name-only", "--diff-filter=ACMRTUXB", "-z", f"{base}...{head}")
    return sorted({normalize_path(item) for item in output.split("\0") if item})


def is_tracked(repo: Path, path: str) -> bool:
    return bool(git(repo, "ls-files", "--error-unmatch", "--", path, check=False).strip())


def review_diff_text(repo: Path, base: str, head: str, path: str, unified: int = 3) -> str:
    if head == "WORKTREE":
        if not is_tracked(repo, path):
            return "UNTRACKED\0" + file_bytes(repo, path).decode("utf-8", errors="replace")
        return git(repo, "diff", "--no-ext-diff", f"--unified={unified}", base, "--", path)
    return git(repo, "diff", "--no-ext-diff", f"--unified={unified}", f"{base}...{head}", "--", path)


def default_state_root(repo: Path) -> Path:
    raw = git(repo, "rev-parse", "--git-dir").strip()
    git_dir = Path(raw)
    if not git_dir.is_absolute():
        git_dir = repo / git_dir
    return git_dir.resolve() / "ocr-code-review" / "sessions"


def task_id_for(path: str) -> str:
    return "task-" + sha256_text(normalize_path(path))[:16]


def file_bytes(repo: Path, path: str) -> bytes:
    target = (repo / path).resolve()
    try:
        target.relative_to(repo.resolve())
    except ValueError as exc:
        raise ReviewError("PATH_ESCAPE", f"Path escapes repository: {path}") from exc
    if not target.exists():
        return b""
    try:
        return target.read_bytes()
    except OSError as exc:
        raise ReviewError("FILE_READ_FAILED", f"Cannot read repository file {path}: {exc}") from exc


def is_binary_file(repo: Path, path: str) -> bool:
    return b"\x00" in file_bytes(repo, path)[:8000]


def is_regular_workspace_file(repo: Path, path: str) -> bool:
    candidate = repo / path
    return candidate.is_file() and not candidate.is_symlink()


def task_input_hash(
    repo: Path,
    path: str,
    mode: str,
    rule: dict[str, str],
    requirement_hash: str,
    base: str | None = None,
    head: str | None = None,
    dimensions: Iterable[str] | None = None,
) -> str:
    diff_sha256 = ""
    if mode == "review":
        if not base or not head:
            raise ReviewError("BASE_REQUIRED", "review task hashing requires base and head")
        diff_text = review_diff_text(repo, base, head, path)
        diff_sha256 = sha256_text(diff_text)
    return canonical_hash(
        {
            "mode": mode,
            "path": normalize_path(path),
            "content_sha256": sha256_bytes(file_bytes(repo, path)),
            "base": base if mode == "review" else None,
            "head": head if mode == "review" else None,
            "diff_sha256": diff_sha256,
            "rule_sha256": sha256_text(rule["text"]),
            "protocol": PROTOCOL_VERSION,
            "requirement_sha256": requirement_hash,
            "dimensions": list(dimensions or ["correctness"]),
        }
    )


def stack_card_for(paths: list[str]) -> dict[str, Any]:
    extensions = Counter(Path(path).suffix.lower() or "[none]" for path in paths)
    build_markers = {
        "go.mod": "Go modules", "package.json": "Node.js", "pom.xml": "Maven",
        "build.gradle": "Gradle", "Cargo.toml": "Cargo", "pyproject.toml": "Python",
        "Dockerfile": "Docker",
    }
    names = {Path(path).name for path in paths}
    return {
        "source": "deterministic-preflight",
        "languages": dict(sorted(extensions.items(), key=lambda item: (-item[1], item[0]))),
        "build_systems": sorted(label for marker, label in build_markers.items() if marker in names),
        "entrypoints": [],
        "data_stores": [],
        "external_integrations": [],
        "auth_boundaries": [],
        "delivery_surfaces": [],
        "scan_tools": {"cursor_native": True, "rg": None, "ast_grep": None, "codegraph": None},
        "signals_pending_model_enrichment": True,
    }


def estimated_text_tokens(data: bytes) -> int:
    """Return a provider-neutral preflight estimate, never billing telemetry."""
    if not data:
        return 0
    return max(1, (len(data) + 3) // 4)


def composition_preview(
    repo: Path,
    paths: list[str],
    primary_paths: list[str],
    file_filter: dict[str, list[str]] | None,
    scan_scope: str | None,
) -> dict[str, Any]:
    primary_set = set(primary_paths)
    top_directories: Counter[str] = Counter()
    surfaces: Counter[str] = Counter()
    excluded: Counter[str] = Counter()
    extensions: Counter[str] = Counter()
    source_bytes = 0
    source_tokens = 0
    for path in paths:
        normalized = normalize_path(path)
        if normalized in primary_set:
            top = normalized.split("/", 1)[0] if "/" in normalized else "[root]"
            top_directories[top] += 1
            surfaces[impact_surface_for_path(normalized)] += 1
            extensions[Path(normalized).suffix.lower() or "[none]"] += 1
            data = file_bytes(repo, normalized)
            source_bytes += len(data)
            source_tokens += estimated_text_tokens(data)
            continue
        if not is_regular_workspace_file(repo, normalized):
            excluded["not-regular"] += 1
        elif is_binary_file(repo, normalized):
            excluded["binary"] += 1
        else:
            _included, reason = review_decision(normalized, file_filter, scan_scope)
            excluded[reason] += 1
    return {
        "scope": scan_scope or "changed-code",
        "candidates": len(paths),
        "primary_targets": len(primary_paths),
        "source_bytes": source_bytes,
        "source_tokens": source_tokens,
        "top_directories": dict(top_directories.most_common(20)),
        "impact_surfaces": dict(sorted(surfaces.items())),
        "extensions": dict(extensions.most_common(20)),
        "excluded_by_reason": dict(sorted(excluded.items())),
    }


def token_preflight(
    source_tokens_by_task: list[int],
    token_budget: int,
) -> dict[str, Any]:
    """Project low/likely/high execution tokens from manifest size.

    Cursor does not expose complete subagent billing telemetry to this script, so
    these values intentionally remain ranges. They include reviewer prompt/tool
    rounds and a verifier reserve, but not hidden host/system prompt tokens.
    """
    files = len(source_tokens_by_task)

    def scenario(rounds: int, verifier_rate: float, verifier_cost: int) -> int:
        reviewer = sum(
            (tokens + 2_000 + 400) + rounds * (tokens + 2_000 + 700)
            for tokens in source_tokens_by_task
        )
        verifiers = int((files * verifier_rate) + 0.999999) if files else 0
        controller = 2_000 + files * 120 if files else 0
        return reviewer + verifiers * verifier_cost + controller

    low = scenario(3, 0.00, 4_000)
    likely = scenario(7, 0.05, 6_000)
    high = scenario(12, 0.20, 10_000)
    return {
        "kind": "preflight-estimate",
        "accuracy": "range-not-billing-accurate",
        "files": files,
        "source_tokens": sum(source_tokens_by_task),
        "low": low,
        "likely": likely,
        "high": high,
        "assumptions": {
            "reviewer_rounds": {"low": 3, "likely": 7, "high": 12},
            "prompt_overhead_per_round": 2_000,
            "output_per_round": 700,
            "verifier_rate": {"low": 0.0, "likely": 0.05, "high": 0.20},
        },
        "budget": {
            "configured": token_budget,
            "low_exceeds": bool(token_budget and low > token_budget),
            "likely_exceeds": bool(token_budget and likely > token_budget),
            "high_exceeds": bool(token_budget and high > token_budget),
            "policy": "warning-only-unless-the-user-explicitly-requests-a-hard-partial-budget",
        },
    }


def build_task(
    repo: Path,
    path: str,
    mode: str,
    rule: dict[str, str],
    requirement_hash: str,
    base: str | None,
    head: str,
    segment_threshold: int,
) -> dict[str, Any]:
    task_id = task_id_for(path)
    content = file_bytes(repo, path)
    dimensions = ["correctness"]
    plan_hash = canonical_hash({"dimensions": dimensions, "signals": []})
    return {
        "id": task_id,
        "path": path,
        "status": "pending",
        "input_hash": task_input_hash(
            repo, path, mode, rule, requirement_hash, base, head, dimensions
        ),
        "content_sha256": sha256_bytes(content),
        "rule": {"source": rule["source"], "pattern": rule["pattern"], "sha256": sha256_text(rule["text"])},
        "segmented": len(content) > segment_threshold,
        "content_size": len(content),
        "estimated_source_tokens": estimated_text_tokens(content),
        "impact_surface": impact_surface_for_path(path),
        "dimensions": dimensions,
        "routing_signals": [],
        "plan_hash": plan_hash,
        "context_dependencies": {},
    }


def load_session(session: str) -> tuple[Path, dict[str, Any], dict[str, Any]]:
    session_dir = Path(session).resolve()
    session_json = read_json(session_dir / "session.json")
    manifest = read_json(session_dir / "manifest.json")
    return session_dir, session_json, manifest


PAUSED_ALLOWED_COMMANDS = {"status", "heartbeat", "resume", "abort", "checkpoint", "complete", "task-fail"}
ABORTED_ALLOWED_COMMANDS = {"status", "abort", "export-fix-queue"}
AWAITING_START_ALLOWED_COMMANDS = {
    "status", "heartbeat", "start", "abort", "stack-card", "task-plan", "resume",
}


def require_session_command(session_json: dict[str, Any], command: str) -> None:
    status = session_json.get("status", "running")
    if status == "aborted" and command not in ABORTED_ALLOWED_COMMANDS:
        raise ReviewError(
            "SESSION_ABORTED",
            f"Session {session_json.get('session_id')} is aborted and rejects {command}",
            "inspect_partial_result",
            partial_result="result.partial.json",
        )
    if status == "paused" and command not in PAUSED_ALLOWED_COMMANDS:
        raise ReviewError(
            "SESSION_PAUSED",
            f"Session {session_json.get('session_id')} is paused and rejects {command}",
            "resume_or_abort_session",
        )
    if status == "awaiting_start" and command not in AWAITING_START_ALLOWED_COMMANDS:
        raise ReviewError(
            "SESSION_AWAITING_START",
            f"Session {session_json.get('session_id')} is awaiting launch confirmation; "
            "present launch_menu / token_estimate to the user, then call start before dispatch",
            "present_launch_menu_and_wait_for_start",
        )


def _primary_paths_for_scope(
    paths: list[str],
    repo: Path,
    file_filter: dict[str, list[str]] | None,
    scan_scope: str | None,
) -> list[str]:
    return [
        path
        for path in paths
        if is_regular_workspace_file(repo, path)
        and not is_binary_file(repo, path)
        and should_review(path, file_filter, scan_scope)
    ]


def _compact_token_estimate(estimate: dict[str, Any]) -> dict[str, Any]:
    return {
        "files": estimate.get("files"),
        "source_tokens": estimate.get("source_tokens"),
        "low": estimate.get("low"),
        "likely": estimate.get("likely"),
        "high": estimate.get("high"),
    }


def estimate_launch_option(
    *,
    repo: Path,
    option_id: str,
    mode: str,
    scope: str | None,
    paths: list[str],
    file_filter: dict[str, list[str]] | None,
    token_budget: int,
    base: str | None = None,
    head: str | None = None,
) -> dict[str, Any]:
    """Preflight composition + token range for one launch-menu option."""
    primary_paths = _primary_paths_for_scope(paths, repo, file_filter, scope)
    composition = composition_preview(repo, paths, primary_paths, file_filter, scope)
    if mode == "review":
        source_tokens_by_task = [
            estimated_text_tokens(
                review_diff_text(repo, base or "HEAD", head or "WORKTREE", path).encode("utf-8")
            )
            for path in primary_paths
        ]
    else:
        source_tokens_by_task = [
            estimated_text_tokens(file_bytes(repo, path)) for path in primary_paths
        ]
    estimate = token_preflight(source_tokens_by_task, token_budget)
    return {
        "option_id": option_id,
        "mode": mode,
        "scope": scope or "changed-code",
        "primary_targets": len(primary_paths),
        "candidates": len(paths),
        "source_tokens": composition.get("source_tokens"),
        "top_directories": composition.get("top_directories"),
        "extensions": composition.get("extensions"),
        "token_estimate": _compact_token_estimate(estimate),
    }


def build_launch_option_estimates(
    *,
    repo: Path,
    file_filter: dict[str, list[str]] | None,
    token_budget: int,
    base: str,
    head: str,
) -> dict[str, dict[str, Any]]:
    """Estimate every menu option so Controllers can compare budgets before start."""
    review_paths = list_review_files(repo, base, head)
    scan_paths = list_scan_files(repo)
    return {
        "workspace-review": estimate_launch_option(
            repo=repo,
            option_id="workspace-review",
            mode="review",
            scope=None,
            paths=review_paths,
            file_filter=file_filter,
            token_budget=token_budget,
            base=base,
            head=head,
        ),
        "scan-runtime": estimate_launch_option(
            repo=repo,
            option_id="scan-runtime",
            mode="scan",
            scope="runtime-code",
            paths=scan_paths,
            file_filter=file_filter,
            token_budget=token_budget,
        ),
        "scan-apps-packages": estimate_launch_option(
            repo=repo,
            option_id="scan-apps-packages",
            mode="scan",
            scope="apps-packages",
            paths=scan_paths,
            file_filter=file_filter,
            token_budget=token_budget,
        ),
        "scan-full": estimate_launch_option(
            repo=repo,
            option_id="scan-full",
            mode="scan",
            scope="full",
            paths=scan_paths,
            file_filter=file_filter,
            token_budget=token_budget,
        ),
    }


def build_launch_menu(
    *,
    mode: str,
    scope: str | None,
    concurrency: str,
    profile: str,
    primary_tasks: int,
    composition: dict[str, Any],
    token_estimate: dict[str, Any],
    option_estimates: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Options the Controller must show before any subagent is created."""
    warnings: list[str] = []
    if token_estimate.get("budget", {}).get("likely_exceeds"):
        warnings.append("current option token_estimate.likely exceeds --token-budget")
    if primary_tasks >= 200:
        warnings.append(
            f"{primary_tasks} Primary Targets — prefer runtime-code/apps-packages unless full was requested"
        )
    if concurrency == "15":
        warnings.append("fixed concurrency 15 is slow; prefer max unless debugging")

    estimates = option_estimates or {}
    current_option_id = (
        "workspace-review"
        if mode == "review"
        else {
            "runtime-code": "scan-runtime",
            "apps-packages": "scan-apps-packages",
            "full": "scan-full",
        }.get(scope or "runtime-code", "scan-runtime")
    )

    def option(
        option_id: str,
        label: str,
        when: str,
        apply: dict[str, Any],
        *,
        recommended: bool = False,
    ) -> dict[str, Any]:
        preview = estimates.get(option_id, {})
        token = preview.get("token_estimate") or {}
        matches_current = option_id == current_option_id
        reinit_bits = ["ocr_review.py init --repo <repo>"]
        if apply.get("mode") == "review":
            reinit_bits.append("--mode review --workspace")
        else:
            reinit_bits.append(f"--mode scan --scope {apply.get('scope')}")
        reinit_bits.append(f"--concurrency {apply.get('concurrency', 'max')}")
        reinit_bits.append(f"--profile {apply.get('profile', 'correctness')}")
        return {
            "id": option_id,
            "label": label,
            "when": when,
            "recommended": recommended,
            "matches_current_session": matches_current,
            "apply": apply,
            "primary_targets": preview.get("primary_targets"),
            "source_tokens": preview.get("source_tokens"),
            "token_estimate": token,
            "top_directories": preview.get("top_directories"),
            "reply": option_id,
            "reply_with_concurrency": f"{option_id} max",
            "confirm_if_same_session": (
                f"ocr_review.py start --session <dir> --choice {option_id} --concurrency max"
            ),
            "reinit_if_different_session": " ".join(reinit_bits),
        }

    options = [
        option(
            "workspace-review",
            "审查当前工作区改动（默认，最快）",
            "用户未明确要求全仓",
            {
                "mode": "review",
                "workspace": True,
                "concurrency": "max",
                "profile": "correctness",
            },
            recommended=mode == "review",
        ),
        option(
            "scan-runtime",
            "全仓 runtime-code（推荐全仓默认）",
            "用户明确要求全仓扫描",
            {
                "mode": "scan",
                "scope": "runtime-code",
                "concurrency": "max",
                "profile": "correctness",
            },
            recommended=mode == "scan" and scope == "runtime-code",
        ),
        option(
            "scan-apps-packages",
            "全仓 apps/packages/services/src",
            "用户只要应用与共享包",
            {
                "mode": "scan",
                "scope": "apps-packages",
                "concurrency": "max",
                "profile": "correctness",
            },
        ),
        option(
            "scan-full",
            "全仓 full（含 docs/scripts，最慢最贵）",
            "用户明确要求连文档和工具脚本",
            {
                "mode": "scan",
                "scope": "full",
                "concurrency": "max",
                "profile": "correctness",
            },
        ),
    ]

    comparison_rows = []
    for item in options:
        token = item.get("token_estimate") or {}
        comparison_rows.append(
            {
                "id": item["id"],
                "primary_targets": item.get("primary_targets"),
                "source_tokens": item.get("source_tokens"),
                "likely_tokens": token.get("likely"),
                "low_tokens": token.get("low"),
                "high_tokens": token.get("high"),
                "matches_current_session": item.get("matches_current_session"),
            }
        )

    how_to_reply = {
        "instruction": (
            "回复一行即可。格式：`<选项ID>` 或 `<选项ID> <并发>`。"
            "也接受「保持默认，开始」。不要只回复「开始」却不说明是否改范围。"
        ),
        "option_ids": [item["id"] for item in options],
        "concurrency_ids": ["max", "auto", "30", "15"],
        "examples": [
            {
                "user_reply": "workspace-review",
                "means": "用工作区改动 + 并发 max；若当前 session 已是该模式则 start，否则按 reinit 命令新建",
            },
            {
                "user_reply": "scan-runtime max",
                "means": "全仓 runtime-code + 并发 max",
            },
            {
                "user_reply": "scan-apps-packages auto",
                "means": "全仓 apps/packages + 并发 auto",
            },
            {
                "user_reply": "保持默认，开始",
                "means": f"确认当前选项 {current_option_id} + 当前并发 {concurrency}",
            },
        ],
        "controller_mapping": (
            "解析出 option_id 与 concurrency 后："
            "若选项 matches_current_session=true → "
            "`start --session <dir> --choice <id> --concurrency <c>`；"
            "若为 false → 不要对旧 session start，改用该选项的 reinit_if_different_session 新建 session。"
        ),
    }

    display_template = (
        "OCR 会话已就绪，等待确认（确认前不派发 reviewer）。\n\n"
        "## 当前 session\n"
        f"- 选项：`{current_option_id}`（mode={mode}, scope={scope or 'changed-code'}）\n"
        f"- Profile：{profile}\n"
        f"- 并发：{concurrency}\n"
        f"- Primary Targets（当前）：{primary_tasks}\n\n"
        "## 各选项预算对比（非账单）\n"
        "| 选项 ID | Primary Targets | 源码 tokens | Likely | Low–High |\n"
        "|---|---:|---:|---:|---|\n"
        + "".join(
            (
                f"| `{row['id']}`"
                f"{' ←当前' if row.get('matches_current_session') else ''} "
                f"| {row.get('primary_targets')} "
                f"| ~{row.get('source_tokens')} "
                f"| ~{row.get('likely_tokens')} "
                f"| ~{row.get('low_tokens')}–~{row.get('high_tokens')} |\n"
            )
            for row in comparison_rows
        )
        + "\n## 如何回复\n"
        "直接回复选项 ID，可附加并发，例如：\n"
        "- `workspace-review`\n"
        "- `scan-runtime max`\n"
        "- `scan-apps-packages auto`\n"
        "- `保持默认，开始`\n"
    )

    return {
        "prompt": (
            "请先选择启动模式与并发策略，并确认各选项 token 预估。"
            "在调用 `start` 之前禁止创建任何 reviewer/verifier subagent。"
        ),
        "must_confirm_before_dispatch": True,
        "current": {
            "option_id": current_option_id,
            "mode": mode,
            "scope": scope or "changed-code",
            "concurrency": concurrency,
            "profile": profile,
            "primary_tasks": primary_tasks,
        },
        "options": options,
        "option_comparison": comparison_rows,
        "how_to_reply": how_to_reply,
        "display_template": display_template,
        "concurrency_presets": [
            {
                "id": "max",
                "label": "尽可能快：首轮请求全部 Primary Target（默认）",
                "recommended": True,
            },
            {
                "id": "auto",
                "label": "自适应：同样首轮全量请求，宿主拒绝后收敛到实测容量",
                "recommended": False,
            },
            {
                "id": "30",
                "label": "固定 30 路并行",
                "recommended": False,
            },
            {
                "id": "15",
                "label": "固定 15 路（慢，仅调试）",
                "recommended": False,
            },
        ],
        "composition": {
            "primary_targets": composition.get("primary_targets"),
            "top_directories": composition.get("top_directories"),
            "impact_surfaces": composition.get("impact_surfaces"),
            "excluded_by_reason": composition.get("excluded_by_reason"),
            "source_tokens": composition.get("source_tokens"),
        },
        "token_estimate": token_estimate,
        "option_estimates": estimates,
        "warnings": warnings,
        "confirm_command": (
            "ocr_review.py start --session <dir> --choice <option-id> "
            "[--concurrency max|auto|N] [--profile ...]"
        ),
        "note": (
            "15 不是并发上限。默认 max/auto 都会在第一轮请求全部 Primary Target；"
            "只有宿主拒绝新建 context 时才收敛。"
            "切换到与当前 session 不同的模式/范围时必须重新 init，不能只改 choice。"
        ),
    }


def save_session(session_dir: Path, session_json: dict[str, Any], manifest: dict[str, Any]) -> None:
    session_json["updated_at"] = now()
    manifest["updated_at"] = session_json["updated_at"]
    atomic_json(session_dir / "session.json", session_json)
    atomic_json(session_dir / "manifest.json", manifest)


def require_task_state(task: dict[str, Any], allowed: set[str], action: str) -> None:
    status = task.get("status")
    if status not in allowed:
        raise ReviewError(
            "INVALID_TASK_STATE",
            f"Cannot {action} task {task.get('id', '<unknown>')} while its state is {status!r}",
            "follow_task_lifecycle",
            allowed_states=sorted(allowed),
        )


def auto_concurrency_limit(tasks: dict[str, Any]) -> int:
    active_count = sum(task.get("status") != "removed" for task in tasks.values())
    return max(1, active_count)


def scheduling_config(
    value: str,
    tasks: dict[str, Any],
    previous: dict[str, Any] | None = None,
) -> dict[str, Any]:
    active_count = sum(task.get("status") != "removed" for task in tasks.values())
    if value == "auto":
        # Maximize-first: request every runnable Primary Target immediately.
        # 15 is only a re-probe expansion step after the host saturates — never a
        # skill-imposed launch ceiling. Controllers must not stop at 15.
        limit = auto_concurrency_limit(tasks)
        minimum = min(AUTO_CONCURRENCY_MINIMUM, active_count) if active_count else 1
        initial_window = active_count
        source = "auto-maximize-then-learn-host-capacity"
        probe_state = "maximizing"
    elif value == "max":
        limit = auto_concurrency_limit(tasks)
        minimum = active_count
        initial_window = active_count
        source = "maximum-host-capacity"
        probe_state = "maximizing"
    else:
        try:
            requested = int(value)
        except (TypeError, ValueError) as exc:
            raise ReviewError(
                "INVALID_CONCURRENCY",
                "concurrency must be auto, max, or a positive integer",
            ) from exc
        if requested < 1 or requested > 256:
            raise ReviewError("INVALID_CONCURRENCY", "explicit concurrency must be between 1 and 256")
        limit = max(1, min(requested, active_count))
        minimum = min(requested, active_count)
        initial_window = minimum
        source = "explicit"
        probe_state = "fixed"
    config = {
        "concurrency": value,
        "minimum": minimum,
        "limit": limit,
        "initial_window": initial_window,
        "desired_window": initial_window,
        "observed_capacity": 0,
        "probe_step": AUTO_PROBE_MIN_STEP,
        "reprobe_after_completions": AUTO_REPROBE_COMPLETIONS,
        "probe_state": probe_state,
        "host_rejections": 0,
        "last_host_rejection": None,
        "saturation_terminal_count": 0,
        "probe_in_flight": None,
        "probe_history": [],
        "launch_in_flight": None,
        "launch_history": [],
        "host_capacity": 0,
        "source": source,
        "batches": "rolling-window",
        "ordering": "controller-managed",
        "capacity_policy": "probe-host-and-refill",
    }
    if previous and previous.get("concurrency") == value:
        config["desired_window"] = min(
            limit,
            max(0, int(previous.get("desired_window", initial_window))),
        )
        config["observed_capacity"] = min(
            limit,
            max(0, int(previous.get("observed_capacity", 0))),
        )
        config["probe_state"] = previous.get("probe_state", probe_state)
        config["host_rejections"] = max(0, int(previous.get("host_rejections", 0)))
        config["last_host_rejection"] = previous.get("last_host_rejection")
        config["saturation_terminal_count"] = max(
            0, int(previous.get("saturation_terminal_count", 0))
        )
        config["probe_history"] = list(previous.get("probe_history", []))[-100:]
        config["launch_history"] = list(previous.get("launch_history", []))[-100:]
        config["host_capacity"] = min(
            limit,
            max(0, int(previous.get("host_capacity", previous.get("observed_capacity", 0)))),
        )
        # Resume invalidates any unreported launch batch. Tasks themselves are
        # reconciled below, while undispatched task IDs remain runnable.
        config["probe_in_flight"] = None
        config["launch_in_flight"] = None
    return config


RUNNABLE_TASK_STATES = {"pending", "interrupted", "checkpointed", "stale"}
FLEETED_TASK_STATE = "fleeted"
TERMINAL_TASK_STATES = {"complete", "blocked", "removed", "aborted", "orphaned"}


def scheduling_counts(manifest: dict[str, Any]) -> tuple[int, int, int]:
    statuses = [task.get("status") for task in manifest.get("tasks", {}).values()]
    running = sum(status == "running" for status in statuses)
    runnable = sum(status in RUNNABLE_TASK_STATES for status in statuses)
    terminal = sum(status in TERMINAL_TASK_STATES for status in statuses)
    return running, runnable, terminal


def maybe_reopen_capacity_probe(scheduling: dict[str, Any], terminal: int) -> None:
    if scheduling.get("concurrency") not in {"auto", "max"}:
        return
    if scheduling.get("probe_state") != "saturated":
        return
    completed_since_rejection = terminal - int(
        scheduling.get("saturation_terminal_count", terminal)
    )
    if completed_since_rejection >= int(
        scheduling.get("reprobe_after_completions", AUTO_REPROBE_COMPLETIONS)
    ):
        scheduling["probe_state"] = "probing"


def scheduling_next_action(manifest: dict[str, Any]) -> str:
    scheduling = manifest.get("scheduling", {})
    running, runnable, terminal = scheduling_counts(manifest)
    if scheduling.get("launch_in_flight"):
        return "report_orchestrated_launch"
    if scheduling.get("probe_in_flight"):
        return "report_capacity_probe"
    desired = int(scheduling.get("desired_window", scheduling.get("limit", 1)))
    limit = int(scheduling.get("limit", max(1, len(manifest.get("tasks", {})))))
    if runnable and running < desired:
        return "dispatch_runnable_tasks"
    effective_probe_state = scheduling.get("probe_state", "fixed")
    if effective_probe_state == "saturated":
        threshold = int(
            scheduling.get("reprobe_after_completions", AUTO_REPROBE_COMPLETIONS)
        )
        if terminal - int(scheduling.get("saturation_terminal_count", terminal)) >= threshold:
            effective_probe_state = "probing"
    if (
        runnable
        and scheduling.get("concurrency") in {"auto", "max"}
        and effective_probe_state in {"probing", "maximizing"}
        and desired < limit
        and running >= desired
    ):
        return "expand_reviewer_window"
    if running:
        return "wait_for_running_tasks"
    if runnable:
        return "wait_for_host_capacity"
    return "finalize"


def record_task_failure(task: dict[str, Any], reason: str) -> str:
    failures = int(task.get("failure_count", 0)) + 1
    task["failure_count"] = failures
    task.setdefault("failure_history", []).append({"at": now(), "reason": reason})
    if failures > MAX_TASK_RETRIES:
        task["status"] = "blocked"
        task["blocked_at"] = now()
        task["blocking_blind_spot"] = {
            "area": task["path"],
            "reason": f"Reviewer failed after {failures} attempts: {reason}",
            "scope": "primary-target",
            "material": True,
        }
    else:
        task["status"] = "interrupted"
        task["interrupted_at"] = now()
    return task["status"]


def is_fleet_worktree_repo(repo: Path) -> bool:
    return any(
        part.startswith("ocr-fleet-shard-") or part.startswith("ocr-fleet-")
        for part in repo.resolve().parts
    )


def fleet_plan_file_exists(session_dir: Path) -> bool:
    return fleet_plan_path(session_dir).is_file()


def expected_shard_task_count(session_dir: Path, session_json: dict[str, Any]) -> int | None:
    if not session_json.get("fleet_shard_id"):
        return None
    shard_meta = session_dir.parent / "shard.json"
    if shard_meta.is_file():
        return len(read_json(shard_meta).get("task_ids", []))
    return None


def evaluate_fleet_preflight(
    session_dir: Path,
    session_json: dict[str, Any],
    manifest: dict[str, Any],
) -> dict[str, Any]:
    tasks = manifest.get("tasks", {})
    actual = sum(1 for task in tasks.values() if task.get("status") != "removed")
    runnable = sum(1 for task in tasks.values() if task.get("status") in RUNNABLE_TASK_STATES)
    shard_id = session_json.get("fleet_shard_id")
    parent_session_id = session_json.get("parent_session_id")
    expected = expected_shard_task_count(session_dir, session_json)
    issues: list[dict[str, Any]] = []

    if shard_id:
        if not parent_session_id:
            issues.append(
                {
                    "code": "MISSING_PARENT_SESSION",
                    "message": "Shard child session must set parent_session_id",
                }
            )
        if expected is None:
            issues.append(
                {
                    "code": "MISSING_SHARD_METADATA",
                    "message": "Cannot read expected task_ids from shard.json",
                }
            )
        elif actual != expected:
            issues.append(
                {
                    "code": "FLEET_SHARD_CONTAMINATION",
                    "message": (
                        f"Child session task count {actual} does not match shard expected {expected}"
                    ),
                    "actual_tasks": actual,
                    "expected_tasks": expected,
                }
            )
        if session_json.get("dispatch_strategy") != "shard-window":
            issues.append(
                {
                    "code": "UNEXPECTED_DISPATCH_STRATEGY",
                    "severity": "warning",
                    "message": "Shard session should use dispatch_strategy=shard-window",
                }
            )
    elif fleet_plan_file_exists(session_dir):
        issues.append(
            {
                "code": "PARENT_FLEET_PLAN_ACTIVE",
                "severity": "info",
                "message": (
                    "Parent session has a fleet plan; open shards and orchestrate-tick child sessions only"
                ),
            }
        )

    blocking = {
        issue["code"]
        for issue in issues
        if issue.get("code")
        in {
            "MISSING_PARENT_SESSION",
            "MISSING_SHARD_METADATA",
            "FLEET_SHARD_CONTAMINATION",
        }
    }
    ok = not blocking
    if shard_id and ok:
        next_action = "shard_controller_orchestrate_tick"
    elif shard_id:
        next_action = "abort_child_session_and_reopen_shard"
    elif fleet_plan_file_exists(session_dir):
        next_action = "fleet_shard_open_then_preflight"
    else:
        next_action = "dispatch_runnable_tasks"
    return {
        "ok": ok,
        "role": "shard" if shard_id else ("parent" if fleet_plan_file_exists(session_dir) else "single"),
        "fleet_shard_id": shard_id,
        "parent_session_id": parent_session_id,
        "actual_tasks": actual,
        "expected_tasks": expected,
        "runnable_tasks": runnable,
        "issues": issues,
        "next_action": next_action,
    }


def assert_fleet_dispatch_allowed(
    session_dir: Path,
    session_json: dict[str, Any],
    manifest: dict[str, Any],
) -> None:
    if session_json.get("fleet_shard_id"):
        preflight = evaluate_fleet_preflight(session_dir, session_json, manifest)
        if not preflight["ok"]:
            contamination = next(
                (
                    issue
                    for issue in preflight["issues"]
                    if issue.get("code") == "FLEET_SHARD_CONTAMINATION"
                ),
                preflight["issues"][0] if preflight["issues"] else None,
            )
            if contamination:
                raise ReviewError(
                    contamination.get("code", "FLEET_SHARD_CONTAMINATION"),
                    contamination["message"],
                    "abort_child_session_and_reopen_shard",
                    actual_tasks=contamination.get("actual_tasks"),
                    expected_tasks=contamination.get("expected_tasks"),
                    fleet_preflight=preflight,
                )
            raise ReviewError(
                "FLEET_SHARD_INVALID",
                "Shard child session failed fleet preflight",
                "abort_child_session_and_reopen_shard",
                fleet_preflight=preflight,
            )
        return
    if fleet_plan_file_exists(session_dir):
        raise ReviewError(
            "FLEET_PARENT_DISPATCH_FORBIDDEN",
            "Parent session with fleet plan must not orchestrate-tick; open shards and tick child sessions only",
            "fleet_shard_open_then_shard_controller_tick",
            fleet_plan=str(fleet_plan_path(session_dir)),
        )


def bulk_reject_fleet_recommendation(
    session_dir: Path,
    session_json: dict[str, Any],
    manifest: dict[str, Any],
    rejected: int,
) -> dict[str, Any] | None:
    if session_json.get("fleet_shard_id") or fleet_plan_file_exists(session_dir):
        return None
    primary = len(manifest.get("tasks", {}))
    if rejected < FLEET_BULK_REJECT_THRESHOLD or primary < FLEET_RECOMMEND_THRESHOLD:
        return None
    return {
        "recommended": True,
        "fleet_cap": FLEET_CAP_DEFAULT,
        "reason": (
            f"Single-window rejected {rejected} leases while {primary} Primary Targets remain; "
            "switch to fleet-worktree sharding instead of bulk host_capacity rejection"
        ),
        "command": "ocr_review.py fleet-plan --session <dir> --fleet-cap 20",
    }


def cmd_init(args: argparse.Namespace) -> dict[str, Any]:
    requested_repo = Path(args.repo).resolve()
    if is_fleet_worktree_repo(requested_repo) and not getattr(
        args, "allow_fleet_worktree_init", False
    ):
        raise ReviewError(
            "FLEET_WORKTREE_INIT_FORBIDDEN",
            "Do not init a new scan session inside an ocr-fleet worktree; use fleet-shard-open on the parent session",
            "fleet_shard_open_then_shard_controller_tick",
            repo_root=str(requested_repo),
        )
    repo = git_root(requested_repo)
    if args.token_budget < 0:
        raise ReviewError("INVALID_TOKEN_BUDGET", "token-budget must be non-negative")
    if args.mode is None:
        args.mode = "review"
        args.workspace = True
    if args.mode == "review" and not args.base:
        args.base = "HEAD"
        args.workspace = True
    if args.mode == "scan" and args.workspace:
        raise ReviewError("INVALID_MODE_OPTIONS", "--workspace is only valid with --mode review")
    head = "WORKTREE" if args.workspace else (args.head or "HEAD")
    paths = list_scan_files(repo) if args.mode == "scan" else list_review_files(repo, args.base, head)
    layers = rule_layers(repo, args.rule)
    file_filter = selected_file_filter(layers)
    scan_scope = args.scope if args.mode == "scan" else None
    primary_paths = [
        path
        for path in paths
        if is_regular_workspace_file(repo, path)
        and not is_binary_file(repo, path)
        and should_review(path, file_filter, scan_scope)
    ]
    system = load_system_rules()
    requirement_hash = sha256_text(args.requirement or "")
    session_id = args.session_id or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", session_id) or session_id in {".", ".."}:
        raise ReviewError("INVALID_SESSION_ID", "Session ID may contain only letters, digits, dot, underscore and hyphen")
    state_root = Path(args.state_root).resolve() if args.state_root else default_state_root(repo)
    session_dir = state_root / session_id

    tasks: dict[str, Any] = {}
    for path in primary_paths:
        rule = resolved_rule(path, layers, system)
        task = build_task(
            repo, path, args.mode, rule, requirement_hash, args.base, head, args.segment_threshold
        )
        tasks[task["id"]] = task

    composition = composition_preview(repo, paths, primary_paths, file_filter, scan_scope)
    if args.mode == "review":
        source_tokens_by_task = [
            estimated_text_tokens(review_diff_text(repo, args.base, head, task["path"]).encode("utf-8"))
            for task in tasks.values()
        ]
    else:
        source_tokens_by_task = [int(task.get("estimated_source_tokens", 0)) for task in tasks.values()]
    estimate = token_preflight(source_tokens_by_task, args.token_budget)
    concurrency = args.concurrency or DEFAULT_CONCURRENCY
    start_immediately = bool(getattr(args, "yes", False))
    option_estimates = build_launch_option_estimates(
        repo=repo,
        file_filter=file_filter,
        token_budget=args.token_budget,
        base=args.base or "HEAD",
        head=head,
    )
    launch_menu = build_launch_menu(
        mode=args.mode,
        scope=scan_scope,
        concurrency=concurrency,
        profile=args.profile,
        primary_tasks=len(tasks),
        composition=composition,
        token_estimate=estimate,
        option_estimates=option_estimates,
    )

    config_hashes = {
        "rules": canonical_hash([layer for _source, layer in layers] + [system]),
        "file_filter": canonical_hash(file_filter or {}),
        "protocol": sha256_text(PROTOCOL_VERSION),
        "requirement": requirement_hash,
    }
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "session_id": session_id,
        "mode": args.mode,
        "scope": args.scope if args.mode == "scan" else "changed-code",
        "tasks": tasks,
        "scheduling": scheduling_config(concurrency, tasks),
        "filter": file_filter,
        "scope_candidates_at_init": len(paths),
        "primary_targets_at_init": len(tasks),
        "excluded_count": len(paths) - len(primary_paths),
        "composition": composition,
        "token_estimate": estimate,
        "launch_menu": launch_menu,
        "created_at": now(),
        "updated_at": now(),
    }
    session_status = "running" if start_immediately else "awaiting_start"
    session_json = {
        "schema_version": SCHEMA_VERSION,
        "skill_version": SKILL_VERSION,
        "session_id": session_id,
        "repo_root": str(repo),
        "repo_identity": git(repo, "config", "--get", "remote.origin.url", check=False).strip() or str(repo),
        "mode": args.mode,
        "scope": args.scope if args.mode == "scan" else "changed-code",
        "profile": args.profile,
        "base": args.base,
        "head": head,
        "status": session_status,
        "session_epoch": 1,
        "assurance": "full",
        "requirement": args.requirement or "",
        "custom_rule_path": str(Path(args.rule).resolve()) if args.rule else None,
        "segment_threshold": args.segment_threshold,
        "token_budget": args.token_budget,
        "composition": composition,
        "token_estimate": estimate,
        "launch_menu": launch_menu,
        "config_hashes": config_hashes,
        "stack_card": stack_card_for(paths),
        "created_at": now(),
        "updated_at": now(),
    }
    if start_immediately:
        session_json["started_at"] = now()
        session_json["start_choice"] = "yes-flag"
    try:
        session_dir.mkdir(parents=True, exist_ok=False)
    except FileExistsError as exc:
        raise ReviewError(
            "SESSION_EXISTS", f"Session already exists: {session_dir}", "choose_new_session_or_resume"
        ) from exc
    save_session(session_dir, session_json, manifest)
    return {
        "session_id": session_id,
        "session_dir": str(session_dir),
        "status": session_status,
        "mode": args.mode,
        "scope": args.scope if args.mode == "scan" else "changed-code",
        "concurrency": concurrency,
        "primary_tasks": len(tasks),
        "excluded": len(paths) - len(primary_paths),
        "composition": composition,
        "token_estimate": estimate,
        "launch_menu": launch_menu,
        "next_action": (
            "enrich_stack_card_then_orchestrate_tick"
            if start_immediately
            else "present_launch_menu_and_wait_for_start"
        ),
    }


def cmd_start(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    status = session_json.get("status")
    if status == "running":
        return {
            "session_id": session_json["session_id"],
            "status": "running",
            "concurrency": manifest.get("scheduling", {}).get("concurrency"),
            "next_action": "enrich_stack_card_then_orchestrate_tick",
            "idempotent": True,
        }
    if status != "awaiting_start":
        raise ReviewError(
            "INVALID_SESSION_STATE",
            f"Cannot start session while status is {status!r}",
            "inspect_session_status",
        )

    concurrency = args.concurrency or manifest.get("scheduling", {}).get("concurrency") or DEFAULT_CONCURRENCY
    if args.choice:
        menu = manifest.get("launch_menu") or session_json.get("launch_menu") or {}
        options = {item.get("id"): item for item in menu.get("options", []) if item.get("id")}
        chosen = options.get(args.choice)
        if chosen is None:
            raise ReviewError(
                "INVALID_LAUNCH_CHOICE",
                f"Unknown launch option {args.choice!r}; reply with one of: "
                + ", ".join(sorted(options) or ["workspace-review", "scan-runtime"]),
                "present_launch_menu_and_wait_for_start",
                valid_choices=sorted(options),
            )
        if not chosen.get("matches_current_session", True):
            raise ReviewError(
                "LAUNCH_CHOICE_REQUIRES_REINIT",
                (
                    f"Option {args.choice!r} does not match this session's frozen scope. "
                    "Do not start the current session; create a new one with the suggested command."
                ),
                "reinit_with_selected_option",
                choice=args.choice,
                suggested_command=chosen.get("reinit_if_different_session"),
                current=menu.get("current"),
            )
        session_json["start_choice"] = args.choice
    manifest["scheduling"] = scheduling_config(concurrency, manifest.get("tasks", {}))
    if args.profile:
        session_json["profile"] = args.profile
    session_json["status"] = "running"
    session_json["started_at"] = now()
    session_json["launch_menu"] = manifest.get("launch_menu")
    # Re-bind menu current concurrency for audit.
    menu = dict(manifest.get("launch_menu") or {})
    current = dict(menu.get("current") or {})
    current["concurrency"] = concurrency
    current["profile"] = session_json.get("profile")
    menu["current"] = current
    manifest["launch_menu"] = menu
    session_json["launch_menu"] = menu
    save_session(session_dir, session_json, manifest)
    return {
        "session_id": session_json["session_id"],
        "status": "running",
        "concurrency": concurrency,
        "profile": session_json.get("profile"),
        "choice": session_json.get("start_choice"),
        "primary_tasks": sum(
            task.get("status") != "removed" for task in manifest.get("tasks", {}).values()
        ),
        "composition": session_json.get("composition"),
        "token_estimate": session_json.get("token_estimate"),
        "next_action": (
            "fleet_plan_then_worktree_shards"
            if sum(
                task.get("status") != "removed"
                for task in manifest.get("tasks", {}).values()
            )
            >= FLEET_RECOMMEND_THRESHOLD
            else "enrich_stack_card_then_orchestrate_tick"
        ),
        "fleet_recommendation": (
            {
                "recommended": True,
                "fleet_cap": FLEET_CAP_DEFAULT,
                "reason": (
                    "Primary Target count exceeds single-window comfort; "
                    "use go-fast-style worktree fleet to raise product concurrency"
                ),
                "command": "ocr_review.py fleet-plan --session <dir> --fleet-cap 20",
            }
            if sum(
                task.get("status") != "removed"
                for task in manifest.get("tasks", {}).values()
            )
            >= FLEET_RECOMMEND_THRESHOLD
            else {"recommended": False}
        ),
    }


def partition_fleet_shards(
    tasks: dict[str, Any],
    fleet_cap: int,
) -> list[dict[str, Any]]:
    """Balance runnable Primary Targets across ≤ fleet_cap shards (go-fast style)."""
    if fleet_cap < 1 or fleet_cap > 64:
        raise ReviewError("INVALID_FLEET_CAP", "fleet-cap must be between 1 and 64")
    candidates: list[tuple[str, dict[str, Any], int]] = []
    for task_id, task in sorted(
        tasks.items(), key=lambda item: (item[1].get("path", ""), item[0])
    ):
        if task.get("status") not in RUNNABLE_TASK_STATES:
            continue
        weight = max(1, int(task.get("estimated_source_tokens") or 1))
        candidates.append((task_id, task, weight))
    if not candidates:
        return []
    shard_count = min(fleet_cap, len(candidates))
    shards: list[dict[str, Any]] = [
        {
            "id": f"shard-{index + 1:02d}",
            "task_ids": [],
            "paths": [],
            "weight": 0,
            "top_directories": Counter(),
        }
        for index in range(shard_count)
    ]
    for task_id, task, weight in sorted(
        candidates, key=lambda item: (-item[2], item[1].get("path", ""))
    ):
        target = min(
            shards, key=lambda shard: (shard["weight"], len(shard["task_ids"]), shard["id"])
        )
        path = normalize_path(task["path"])
        top = path.split("/", 1)[0] if "/" in path else "[root]"
        target["task_ids"].append(task_id)
        target["paths"].append(path)
        target["weight"] += weight
        target["top_directories"][top] += 1
    return [
        {
            "id": shard["id"],
            "task_ids": shard["task_ids"],
            "paths": shard["paths"],
            "primary_targets": len(shard["task_ids"]),
            "source_tokens": shard["weight"],
            "top_directories": dict(shard["top_directories"].most_common(12)),
            "worktree_name": f"ocr-fleet-{shard['id']}",
            "branch_name": f"ocr-fleet/{shard['id']}",
            "status": "planned",
        }
        for shard in shards
        if shard["task_ids"]
    ]


def fleet_plan_path(session_dir: Path) -> Path:
    return session_dir / "fleet" / "plan.json"


def load_fleet_plan(session_dir: Path) -> dict[str, Any]:
    path = fleet_plan_path(session_dir)
    if not path.is_file():
        raise ReviewError(
            "FLEET_PLAN_REQUIRED",
            "No fleet plan exists; run fleet-plan before opening shards",
            "run_fleet_plan",
        )
    return read_json(path)


def is_safe_fleet_branch(branch_name: str) -> bool:
    normalized = branch_name.strip()
    return normalized.startswith(FLEET_BRANCH_PREFIX) or normalized.startswith("ocr-fleet-")


def git_command(
    repo: Path, *args: str, check: bool = True
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-c", "core.quotepath=false", *args],
        cwd=repo,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        check=False,
    )


def worktree_path_key(path: Path | str) -> str:
    return os.path.normcase(str(Path(path).resolve()))


def git_worktree_paths(repo: Path) -> dict[str, str]:
    proc = git_command(repo, "worktree", "list", "--porcelain")
    if proc.returncode != 0:
        raise ReviewError(
            "GIT_FAILED",
            proc.stderr.strip() or "git worktree list failed",
            "fix_git_state",
        )
    paths: dict[str, str] = {}
    for line in proc.stdout.splitlines():
        if line.startswith("worktree "):
            raw = line.split(" ", 1)[1]
            paths[worktree_path_key(raw)] = raw
    return paths


def remove_fleet_worktree(repo_root: Path, worktree_path: Path) -> dict[str, Any]:
    resolved = worktree_path.resolve()
    registered_paths = git_worktree_paths(repo_root)
    registered_raw = registered_paths.get(worktree_path_key(resolved))
    if registered_raw:
        proc = git_command(repo_root, "worktree", "remove", "--force", registered_raw)
        if proc.returncode != 0:
            return {
                "path": str(resolved),
                "status": "failed",
                "error": proc.stderr.strip() or "git worktree remove failed",
            }
        return {"path": str(resolved), "status": "removed"}
    if not resolved.is_dir():
        return {"path": str(resolved), "status": "already_removed"}
    shutil.rmtree(resolved, ignore_errors=True)
    return {"path": str(resolved), "status": "removed"}


def delete_fleet_branch(repo_root: Path, branch_name: str) -> dict[str, Any]:
    branch = branch_name.strip()
    if not branch:
        return {"branch": branch, "status": "skipped", "reason": "empty"}
    if not is_safe_fleet_branch(branch):
        return {
            "branch": branch,
            "status": "skipped",
            "reason": "not_a_fleet_branch",
        }
    proc = git_command(repo_root, "branch", "-D", branch)
    if proc.returncode == 0:
        return {"branch": branch, "status": "removed"}
    stderr = proc.stderr.strip()
    if "not found" in stderr.lower():
        return {"branch": branch, "status": "already_removed"}
    return {"branch": branch, "status": "failed", "error": stderr or "git branch -D failed"}


def perform_fleet_cleanup(
    session_dir: Path,
    session_json: dict[str, Any],
    plan: dict[str, Any],
    *,
    allow_partial: bool = False,
    keep_worktrees: bool = False,
) -> dict[str, Any]:
    fleet = session_json.get("fleet") or {}
    fleet_status = fleet.get("status")
    if fleet_status not in {"merged", "partial-merged"}:
        raise ReviewError(
            "FLEET_NOT_MERGED",
            "Fleet worktrees can only be cleaned up after fleet-merge",
            "run_fleet_merge",
            fleet_status=fleet_status,
        )
    if fleet_status == "partial-merged" and not allow_partial:
        raise ReviewError(
            "FLEET_MERGE_INCOMPLETE",
            "Partial fleet merge still has open shards; pass --partial to cleanup anyway",
            "wait_for_shard_controllers_or_fleet_merge_partial",
        )
    if fleet.get("cleanup", {}).get("done"):
        return {
            **fleet["cleanup"],
            "idempotent": True,
        }

    repo_root = Path(session_json["repo_root"]).resolve()
    removed_worktrees: list[dict[str, Any]] = []
    removed_branches: list[dict[str, Any]] = []
    remaining: list[dict[str, Any]] = []
    kept: list[dict[str, Any]] = []

    for shard in plan.get("shards", []):
        worktree_raw = shard.get("worktree")
        branch_name = str(shard.get("branch_name") or "")
        if not worktree_raw:
            worktree_name = shard.get("worktree_name")
            if worktree_name:
                worktree_raw = str(repo_root / ".worktrees" / worktree_name)
        if keep_worktrees:
            if worktree_raw:
                kept.append({"shard": shard.get("id"), "worktree": worktree_raw})
            continue
        if worktree_raw:
            outcome = remove_fleet_worktree(repo_root, Path(worktree_raw))
            outcome["shard"] = shard.get("id")
            if outcome["status"] == "failed":
                remaining.append(outcome)
            else:
                removed_worktrees.append(outcome)
        if branch_name:
            branch_outcome = delete_fleet_branch(repo_root, branch_name)
            branch_outcome["shard"] = shard.get("id")
            if branch_outcome["status"] == "failed":
                remaining.append(branch_outcome)
            elif branch_outcome["status"] != "skipped":
                removed_branches.append(branch_outcome)

    cleanup = {
        "done": not remaining,
        "at": now(),
        "removed_worktrees": removed_worktrees,
        "removed_branches": removed_branches,
        "remaining": remaining,
        "kept": kept,
    }
    plan["cleanup"] = cleanup
    atomic_json(fleet_plan_path(session_dir), plan)
    fleet["cleanup"] = cleanup
    if cleanup["done"]:
        fleet["status"] = "cleaned"
    session_json["fleet"] = fleet
    return cleanup


def cmd_fleet_plan(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    if session_json.get("status") not in {"running", "paused", "awaiting_start"}:
        raise ReviewError(
            "INVALID_SESSION_STATE",
            f"Cannot plan a fleet while status is {session_json.get('status')!r}",
            "inspect_session_status",
        )
    fleet_cap = int(args.fleet_cap or FLEET_CAP_DEFAULT)
    existing = session_json.get("fleet") or {}
    if existing.get("shards") and any(
        shard.get("status") in {"opened", "running", "merged"}
        for shard in existing.get("shards", [])
    ):
        raise ReviewError(
            "FLEET_ALREADY_ACTIVE",
            "Fleet shards are already opened; abort or merge before replanning",
            "inspect_fleet_status",
        )
    shards = partition_fleet_shards(manifest.get("tasks", {}), fleet_cap)
    runnable = sum(
        task.get("status") in RUNNABLE_TASK_STATES
        for task in manifest.get("tasks", {}).values()
    )
    plan = {
        "schema_version": SCHEMA_VERSION,
        "parent_session_id": session_json["session_id"],
        "fleet_cap": fleet_cap,
        "inspired_by": "go-fast fleet_cap + worktree subagents",
        "created_at": now(),
        "runnable_tasks": runnable,
        "shard_count": len(shards),
        "shards": shards,
        "worktree_root_hint": ".worktrees/",
        "controller_protocol": [
            "Ensure .worktrees/ is gitignored",
            "For each shard: git worktree add .worktrees/<worktree_name> -b <branch_name>",
            "fleet-shard-open --shard <id> --repo <worktree-abs-path>",
            "Spawn ≤ fleet_cap shard-controller subagents in one wave (cwd=worktree)",
            "Each shard runs orchestrate-tick loop with concurrency=max inside its worktree",
            "Parent polls fleet-status; when all terminal → fleet-merge → dedup-plan → finalize → fleet-cleanup",
            "Cleanup removes .worktrees/ocr-fleet-* and ocr-fleet/* branches after merge (auto on finalize)",
        ],
    }
    (session_dir / "fleet").mkdir(parents=True, exist_ok=True)
    atomic_json(fleet_plan_path(session_dir), plan)
    session_json["fleet"] = {
        "fleet_cap": fleet_cap,
        "shard_count": len(shards),
        "status": "planned",
        "plan_path": "fleet/plan.json",
        "shards": [
            {
                "id": shard["id"],
                "primary_targets": shard["primary_targets"],
                "status": "planned",
                "worktree_name": shard["worktree_name"],
                "branch_name": shard["branch_name"],
            }
            for shard in shards
        ],
    }
    session_json["dispatch_strategy"] = (
        "fleet-worktree" if runnable >= FLEET_RECOMMEND_THRESHOLD else "single-window-or-fleet"
    )
    save_session(session_dir, session_json, manifest)
    return {
        "session_id": session_json["session_id"],
        "fleet_cap": fleet_cap,
        "shard_count": len(shards),
        "runnable_tasks": runnable,
        "shards": [
            {
                "id": shard["id"],
                "primary_targets": shard["primary_targets"],
                "source_tokens": shard["source_tokens"],
                "top_directories": shard["top_directories"],
                "worktree_name": shard["worktree_name"],
                "branch_name": shard["branch_name"],
                "open_command": (
                    f"ocr_review.py fleet-shard-open --session <parent> --shard {shard['id']} "
                    f"--repo <abs-path-to-.worktrees/{shard['worktree_name']}>"
                ),
            }
            for shard in shards
        ],
        "controller_protocol": plan["controller_protocol"],
        "next_action": "create_worktrees_and_open_fleet_shards",
        "note": (
            f"Product concurrency ceiling is fleet_cap={fleet_cap} shard controllers "
            "(go-fast style), each maximizing reviewers inside its own worktree."
        ),
    }


def cmd_fleet_shard_open(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    if session_json.get("status") not in {"running", "paused"}:
        raise ReviewError(
            "INVALID_SESSION_STATE",
            "fleet-shard-open requires a started (running) parent session",
            "start_parent_session_first",
        )
    plan = load_fleet_plan(session_dir)
    shard = next((item for item in plan.get("shards", []) if item.get("id") == args.shard), None)
    if shard is None:
        raise ReviewError(
            "UNKNOWN_FLEET_SHARD",
            f"Shard {args.shard!r} is not in the fleet plan",
            "run_fleet_plan",
            valid_shards=[item.get("id") for item in plan.get("shards", [])],
        )
    worktree = Path(args.repo).resolve()
    if not worktree.is_dir():
        raise ReviewError(
            "INVALID_WORKTREE",
            f"Worktree path does not exist: {worktree}",
            "create_git_worktree_for_shard",
        )
    try:
        repo = git_root(worktree)
    except ReviewError as exc:
        raise ReviewError(
            "INVALID_WORKTREE",
            f"Path is not a git worktree/repo: {worktree}",
            "create_git_worktree_for_shard",
        ) from exc

    child_root = session_dir / "fleet" / "shards" / shard["id"]
    child_session_dir = child_root / "session"
    if child_session_dir.is_dir() and (child_session_dir / "session.json").is_file():
        child_session = read_json(child_session_dir / "session.json")
        return {
            "session_id": child_session.get("session_id"),
            "shard_id": shard["id"],
            "session_dir": str(child_session_dir),
            "repo_root": child_session.get("repo_root"),
            "primary_tasks": len(shard.get("task_ids", [])),
            "idempotent": True,
            "next_action": "fleet_preflight_then_shard_controller_tick",
            "fleet_preflight": evaluate_fleet_preflight(
                child_session_dir,
                child_session,
                read_json(child_session_dir / "manifest.json"),
            ),
        }

    child_tasks: dict[str, Any] = {}
    for task_id in shard.get("task_ids", []):
        parent_task = manifest["tasks"].get(task_id)
        if parent_task is None:
            continue
        if parent_task.get("status") not in RUNNABLE_TASK_STATES | {FLEETED_TASK_STATE}:
            continue
        task = copy.deepcopy(parent_task)
        task["status"] = "pending"
        task.pop("dispatch_lease", None)
        task.pop("reviewer_context", None)
        task.pop("fleet_shard", None)
        task["attempt_count"] = int(task.get("attempt_count", 0))
        child_tasks[task_id] = task
        parent_task["status"] = FLEETED_TASK_STATE
        parent_task["fleet_shard"] = shard["id"]
        parent_task["fleeted_at"] = now()

    if not child_tasks:
        raise ReviewError(
            "EMPTY_FLEET_SHARD",
            f"Shard {shard['id']} has no runnable tasks left to open",
            "inspect_fleet_status",
        )

    child_session_id = f"{session_json['session_id']}-{shard['id']}"
    child_manifest = {
        "schema_version": SCHEMA_VERSION,
        "session_id": child_session_id,
        "mode": session_json.get("mode"),
        "scope": session_json.get("scope"),
        "tasks": child_tasks,
        "scheduling": scheduling_config("max", child_tasks),
        "parent_session_id": session_json["session_id"],
        "fleet_shard_id": shard["id"],
        "created_at": now(),
        "updated_at": now(),
    }
    child_session = {
        "schema_version": SCHEMA_VERSION,
        "skill_version": SKILL_VERSION,
        "session_id": child_session_id,
        "repo_root": str(repo),
        "repo_identity": session_json.get("repo_identity"),
        "mode": session_json.get("mode"),
        "scope": session_json.get("scope"),
        "profile": session_json.get("profile"),
        "base": session_json.get("base"),
        "head": session_json.get("head"),
        "status": "running",
        "session_epoch": 1,
        "assurance": session_json.get("assurance", "full"),
        "parent_session_id": session_json["session_id"],
        "fleet_shard_id": shard["id"],
        "dispatch_strategy": "shard-window",
        "started_at": now(),
        "created_at": now(),
        "updated_at": now(),
        "config_hashes": session_json.get("config_hashes"),
        "stack_card": session_json.get("stack_card"),
        "segment_threshold": session_json.get("segment_threshold", 0),
        "token_budget": session_json.get("token_budget", 0),
    }
    child_root.mkdir(parents=True, exist_ok=True)
    child_session_dir.mkdir(parents=True, exist_ok=True)
    (child_session_dir / "findings").mkdir(exist_ok=True)
    atomic_json(child_session_dir / "session.json", child_session)
    atomic_json(child_session_dir / "manifest.json", child_manifest)
    atomic_json(
        child_root / "shard.json",
        {
            "id": shard["id"],
            "parent_session_id": session_json["session_id"],
            "session_dir": str(child_session_dir),
            "repo_root": str(repo),
            "worktree": str(worktree),
            "task_ids": list(child_tasks),
            "opened_at": now(),
            "status": "opened",
        },
    )

    for item in plan["shards"]:
        if item["id"] == shard["id"]:
            item["status"] = "opened"
            item["session_dir"] = str(child_session_dir)
            item["repo_root"] = str(repo)
            item["worktree"] = str(worktree)
            item["opened_at"] = now()
    atomic_json(fleet_plan_path(session_dir), plan)

    fleet = session_json.setdefault("fleet", {})
    fleet["status"] = "running"
    registry = {item.get("id"): item for item in fleet.get("shards", [])}
    entry = registry.get(shard["id"], {"id": shard["id"]})
    entry.update(
        {
            "status": "opened",
            "session_dir": str(child_session_dir),
            "repo_root": str(repo),
            "worktree": str(worktree),
            "primary_targets": len(child_tasks),
        }
    )
    registry[shard["id"]] = entry
    fleet["shards"] = list(registry.values())
    session_json["dispatch_strategy"] = "fleet-worktree"
    save_session(session_dir, session_json, manifest)
    preflight = evaluate_fleet_preflight(child_session_dir, child_session, child_manifest)
    return {
        "session_id": child_session_id,
        "shard_id": shard["id"],
        "session_dir": str(child_session_dir),
        "repo_root": str(repo),
        "primary_tasks": len(child_tasks),
        "concurrency": "max",
        "next_action": "fleet_preflight_then_shard_controller_tick",
        "fleet_preflight": preflight,
        "shard_controller_hint": (
            "In this worktree, run fleet-preflight → orchestrate-tick on THIS session_dir only → "
            "create reviewer contexts → orchestrate-report → submit/complete until shard tasks are terminal. "
            "Never init or orchestrate-tick the parent session."
        ),
    }


def cmd_fleet_status(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    plan = (
        read_json(fleet_plan_path(session_dir))
        if fleet_plan_path(session_dir).is_file()
        else None
    )
    shards_out = []
    opened = 0
    terminal_shards = 0
    source_shards = (
        plan.get("shards", [])
        if plan
        else (session_json.get("fleet") or {}).get("shards", [])
    )
    for shard in source_shards:
        shard_id = shard.get("id")
        child_dir = Path(shard.get("session_dir") or "")
        if not child_dir.is_dir():
            alt = session_dir / "fleet" / "shards" / str(shard_id) / "session"
            child_dir = alt if alt.is_dir() else child_dir
        entry: dict[str, Any] = {
            "id": shard_id,
            "status": shard.get("status", "planned"),
            "primary_targets": shard.get("primary_targets")
            or len(shard.get("task_ids") or []),
            "session_dir": str(child_dir) if child_dir else None,
        }
        if child_dir.is_dir() and (child_dir / "manifest.json").is_file():
            opened += 1
            child_manifest = read_json(child_dir / "manifest.json")
            child_session = read_json(child_dir / "session.json")
            child_preflight = evaluate_fleet_preflight(child_dir, child_session, child_manifest)
            statuses = Counter(
                task.get("status") for task in child_manifest.get("tasks", {}).values()
            )
            entry["task_status"] = dict(statuses)
            entry["child_status"] = child_session.get("status")
            entry["fleet_preflight"] = child_preflight
            if not child_preflight.get("ok"):
                entry["status"] = "contaminated"
            runnable = sum(statuses.get(state, 0) for state in RUNNABLE_TASK_STATES)
            running = statuses.get("running", 0)
            done = sum(statuses.get(state, 0) for state in TERMINAL_TASK_STATES)
            total = sum(statuses.values())
            entry["progress"] = {
                "runnable": runnable,
                "running": running,
                "terminal": done,
                "total": total,
            }
            if total and runnable == 0 and running == 0 and done == total:
                entry["status"] = "terminal"
                terminal_shards += 1
            else:
                entry["status"] = "running"
        shards_out.append(entry)

    parent_counts = Counter(
        task.get("status") for task in manifest.get("tasks", {}).values()
    )
    all_terminal = bool(shards_out) and terminal_shards == len(shards_out)
    if all_terminal:
        next_action = "fleet_merge"
    elif opened:
        next_action = "wait_for_shard_controllers_or_open_remaining"
    else:
        next_action = "create_worktrees_and_open_fleet_shards"
    return {
        "session_id": session_json["session_id"],
        "dispatch_strategy": session_json.get("dispatch_strategy"),
        "fleet": session_json.get("fleet"),
        "parent_task_status": dict(parent_counts),
        "shards": shards_out,
        "opened_shards": opened,
        "terminal_shards": terminal_shards,
        "all_shards_terminal": all_terminal,
        "next_action": next_action,
    }


def cmd_fleet_merge(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    plan = load_fleet_plan(session_dir)
    merged_shards = 0
    merged_tasks = 0
    incomplete: list[dict[str, Any]] = []
    for shard in plan.get("shards", []):
        shard_id = shard["id"]
        child_dir = Path(
            shard.get("session_dir")
            or session_dir / "fleet" / "shards" / shard_id / "session"
        )
        if not (child_dir / "manifest.json").is_file():
            incomplete.append({"shard": shard_id, "reason": "not_opened"})
            continue
        child_manifest = read_json(child_dir / "manifest.json")
        child_findings_root = child_dir / "findings"
        for task_id, child_task in child_manifest.get("tasks", {}).items():
            status = child_task.get("status")
            if status not in TERMINAL_TASK_STATES:
                incomplete.append(
                    {"shard": shard_id, "task": task_id, "status": status}
                )
                continue
            parent_task = manifest["tasks"].get(task_id)
            if parent_task is None:
                continue
            src_dir = child_findings_root / task_id
            dst_dir = session_dir / "findings" / task_id
            if src_dir.is_dir():
                dst_dir.mkdir(parents=True, exist_ok=True)
                for finding_file in src_dir.glob("*.json"):
                    shutil.copy2(finding_file, dst_dir / finding_file.name)
            parent_task["status"] = status
            for key in (
                "completed_at",
                "blocked_at",
                "blocking_blind_spot",
                "failure_count",
                "coverage",
                "reviewer_context",
            ):
                if key in child_task:
                    parent_task[key] = child_task[key]
            parent_task["merged_from_fleet_shard"] = shard_id
            parent_task.pop("fleet_shard", None)
            merged_tasks += 1
        shard["status"] = "merged"
        shard["merged_at"] = now()
        merged_shards += 1

    if incomplete and not getattr(args, "partial", False):
        raise ReviewError(
            "FLEET_SHARDS_INCOMPLETE",
            "One or more fleet shards still have non-terminal tasks",
            "wait_for_shard_controllers",
            incomplete=incomplete[:50],
            incomplete_count=len(incomplete),
        )

    atomic_json(fleet_plan_path(session_dir), plan)
    fleet = session_json.setdefault("fleet", {})
    fleet["status"] = "merged" if not incomplete else "partial-merged"
    for entry in fleet.get("shards", []):
        match = next(
            (shard for shard in plan["shards"] if shard["id"] == entry.get("id")),
            None,
        )
        if match:
            entry["status"] = match.get("status")
    save_session(session_dir, session_json, manifest)
    return {
        "session_id": session_json["session_id"],
        "merged_shards": merged_shards,
        "merged_tasks": merged_tasks,
        "incomplete_count": len(incomplete),
        "incomplete": incomplete[:20],
        "next_action": (
            "dedup_plan_then_finalize_then_fleet_cleanup"
            if not incomplete
            else "wait_for_shard_controllers"
        ),
    }


def cmd_fleet_cleanup(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    if session_json.get("fleet_shard_id"):
        raise ReviewError(
            "FLEET_CLEANUP_PARENT_ONLY",
            "fleet-cleanup must run on the parent session, not a shard child session",
            "run_fleet_cleanup_on_parent_session",
        )
    plan = load_fleet_plan(session_dir)
    cleanup = perform_fleet_cleanup(
        session_dir,
        session_json,
        plan,
        allow_partial=bool(getattr(args, "partial", False)),
        keep_worktrees=bool(getattr(args, "keep_worktrees", False)),
    )
    save_session(session_dir, session_json, manifest)
    return {
        "session_id": session_json["session_id"],
        "cleanup": cleanup,
        "next_action": (
            "inspect_cleanup_remaining"
            if cleanup.get("remaining")
            else "fleet_worktrees_cleaned"
        ),
    }


def cmd_fleet_preflight(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    preflight = evaluate_fleet_preflight(session_dir, session_json, manifest)
    return {
        "session_id": session_json["session_id"],
        "fleet_preflight": preflight,
        "next_action": preflight["next_action"],
    }


def cmd_dispatch_next(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    scheduling = manifest.setdefault(
        "scheduling", scheduling_config("auto", manifest.get("tasks", {}))
    )
    in_flight = scheduling.get("probe_in_flight")
    if in_flight:
        raise ReviewError(
            "CAPACITY_REPORT_PENDING",
            f"Capacity probe {in_flight.get('id')} must be reported before another dispatch",
            "report_capacity_probe",
            probe_id=in_flight.get("id"),
        )

    running, runnable_count, terminal = scheduling_counts(manifest)
    maybe_reopen_capacity_probe(scheduling, terminal)
    desired = int(scheduling.get("desired_window", scheduling.get("limit", 1)))
    limit = int(scheduling.get("limit", max(1, len(manifest.get("tasks", {})))))
    concurrency = scheduling.get("concurrency", "auto")
    phase: str | None = None
    request_count = 0
    requested_window = desired

    if runnable_count and running < desired:
        request_count = desired - running
        if concurrency not in {"auto", "max"}:
            phase = "fixed-fill"
        elif not scheduling.get("probe_history") and int(
            scheduling.get("observed_capacity", 0)
        ) == 0:
            # auto and max both maximize-first; do not label the first wave "initial"
            # in a way that Controllers misread as a 15-slot probe ceiling.
            phase = "maximize"
        else:
            phase = "refill"
    elif (
        runnable_count
        and concurrency in {"auto", "max"}
        and scheduling.get("probe_state") in {"probing", "maximizing"}
        and desired < limit
        and running >= desired
    ):
        step = max(
            int(scheduling.get("probe_step", AUTO_PROBE_MIN_STEP)),
            (max(1, desired) + 3) // 4,
        )
        requested_window = min(limit, desired + step)
        request_count = requested_window - running
        phase = "expand" if concurrency == "auto" else "maximize"

    runnable_ids = [
        task_id
        for task_id, task in sorted(
            manifest.get("tasks", {}).items(), key=lambda item: (item[1].get("path", ""), item[0])
        )
        if task.get("status") in RUNNABLE_TASK_STATES
    ]
    task_ids = runnable_ids[: max(0, request_count)]
    if not task_ids:
        save_session(session_dir, session_json, manifest)
        return {
            "probe_id": None,
            "phase": None,
            "task_ids": [],
            "requested_window": desired,
            "next_action": scheduling_next_action(manifest),
        }

    # Capacity is measured from contexts actually requested, not from an
    # aspirational expansion step that may exceed the remaining task count.
    requested_window = running + len(task_ids)
    probe_id = "probe-" + sha256_text(
        f"{session_json['session_id']}:{now()}:{len(scheduling.get('probe_history', []))}:{','.join(task_ids)}"
    )[:12]
    probe = {
        "id": probe_id,
        "phase": phase,
        "task_ids": task_ids,
        "attempt_counts": {
            task_id: int(manifest["tasks"][task_id].get("attempt_count", 0))
            for task_id in task_ids
        },
        "running_at_request": running,
        "desired_before": desired,
        "probe_state_before": scheduling.get("probe_state"),
        "requested_window": requested_window,
        "requested_at": now(),
    }
    scheduling["probe_in_flight"] = probe
    save_session(session_dir, session_json, manifest)
    return {
        "probe_id": probe_id,
        "phase": phase,
        "task_ids": task_ids,
        "requested_window": requested_window,
        "next_action": "create_reviewer_contexts",
    }


def cmd_capacity_report(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    scheduling = manifest.get("scheduling", {})
    probe = scheduling.get("probe_in_flight")
    if not probe or probe.get("id") != args.probe:
        raise ReviewError(
            "CAPACITY_PROBE_NOT_FOUND",
            f"No in-flight capacity probe matches {args.probe}",
            "run_dispatch_next",
        )
    accepted_ids = [
        task_id
        for task_id in probe["task_ids"]
        if int(manifest["tasks"].get(task_id, {}).get("attempt_count", 0))
        > int(probe.get("attempt_counts", {}).get(task_id, 0))
    ]
    accepted = len(accepted_ids)
    rejected = len(probe["task_ids"]) - accepted
    reason = args.reason.strip()
    if rejected and not reason:
        raise ReviewError(
            "CAPACITY_REJECTION_REASON_REQUIRED",
            "A partial or rejected launch batch requires the host rejection reason",
            "repeat_capacity_report_with_reason",
            accepted=accepted,
            rejected=rejected,
        )

    requested_window = int(probe["requested_window"])
    limit = int(scheduling.get("limit", max(1, len(manifest.get("tasks", {})))))
    _running, _runnable, terminal = scheduling_counts(manifest)
    if rejected:
        capacity_at_attempt = min(
            limit, int(probe.get("running_at_request", 0)) + accepted
        )
        scheduling["desired_window"] = max(1, capacity_at_attempt)
        scheduling["observed_capacity"] = max(
            int(scheduling.get("observed_capacity", 0)), capacity_at_attempt
        )
        scheduling["probe_state"] = "saturated"
        scheduling["host_rejections"] = int(scheduling.get("host_rejections", 0)) + rejected
        scheduling["last_host_rejection"] = {"at": now(), "reason": reason}
        scheduling["saturation_terminal_count"] = terminal
    else:
        scheduling["desired_window"] = min(
            limit, max(int(scheduling.get("desired_window", 0)), requested_window)
        )
        scheduling["observed_capacity"] = min(
            limit, max(int(scheduling.get("observed_capacity", 0)), requested_window)
        )
        concurrency = scheduling.get("concurrency", "auto")
        if concurrency not in {"auto", "max"}:
            scheduling["probe_state"] = "fixed"
        elif (
            probe.get("phase") == "refill"
            and probe.get("probe_state_before") == "saturated"
        ):
            scheduling["probe_state"] = "saturated"
        else:
            scheduling["probe_state"] = "probing" if concurrency == "auto" else "maximizing"

    history_entry = {
        "id": probe["id"],
        "phase": probe.get("phase"),
        "requested": len(probe["task_ids"]),
        "accepted": accepted,
        "rejected": rejected,
        "requested_window": requested_window,
        "reported_at": now(),
    }
    if reason:
        history_entry["reason"] = reason
    scheduling.setdefault("probe_history", []).append(history_entry)
    scheduling["probe_history"] = scheduling["probe_history"][-100:]
    scheduling["probe_in_flight"] = None
    save_session(session_dir, session_json, manifest)
    return {
        "probe_id": probe["id"],
        "accepted": accepted,
        "rejected": rejected,
        "accepted_task_ids": accepted_ids,
        "observed_capacity": int(scheduling.get("observed_capacity", 0)),
        "desired_window": int(scheduling.get("desired_window", 0)),
        "probe_state": scheduling.get("probe_state"),
        "next_action": scheduling_next_action(manifest),
    }


def cmd_task_start(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    task = manifest["tasks"].get(args.task)
    if not task:
        raise ReviewError("TASK_NOT_FOUND", f"Unknown task: {args.task}")
    require_task_state(task, {"pending", "interrupted", "checkpointed", "stale"}, "start")
    lease = task.get("dispatch_lease")
    supplied_lease = (getattr(args, "lease", None) or "").strip()
    if lease:
        if lease_expired(lease):
            task.pop("dispatch_lease", None)
            save_session(session_dir, session_json, manifest)
            raise ReviewError("LEASE_EXPIRED", f"Reviewer lease for {args.task} expired", "run_orchestrate_tick")
        if not supplied_lease:
            raise ReviewError("LEASE_REQUIRED", f"Task {args.task} was reserved by orchestrate-tick", "ack_reserved_lease")
        if supplied_lease != lease.get("id") or int(lease.get("session_epoch", 0)) != int(
            session_json.get("session_epoch", 1)
        ):
            raise ReviewError("LEASE_MISMATCH", f"Reviewer lease does not match task {args.task}", "run_orchestrate_tick")
    elif supplied_lease:
        raise ReviewError("LEASE_NOT_FOUND", f"Task {args.task} has no reserved reviewer lease", "run_orchestrate_tick")
    reviewer_context = args.reviewer_context.strip()
    if not reviewer_context:
        raise ReviewError("INVALID_REVIEWER_CONTEXT", "reviewer-context must not be empty")
    if reviewer_context.lower() in {"controller", "current", "main", "root"}:
        raise ReviewError(
            "CONTROLLER_REVIEW_FORBIDDEN",
            "Primary Targets require a real isolated reviewer context, not the Controller context",
            "dispatch_reviewer_subagent",
        )
    for other_id, other in manifest["tasks"].items():
        if other_id != args.task and reviewer_context in other.get("reviewer_contexts", []):
            raise ReviewError(
                "REVIEWER_CONTEXT_REUSED",
                "One reviewer context cannot own multiple Primary Targets",
                "dispatch_fresh_reviewer_subagent",
                existing_task=other_id,
            )
    running = [
        task_id
        for task_id, candidate in manifest["tasks"].items()
        if candidate.get("status") == "running" and task_id != args.task
    ]
    limit = int(
        manifest.get("scheduling", {}).get(
            "limit", max(1, len(manifest.get("tasks", {})))
        )
    )
    if len(running) >= limit:
        raise ReviewError(
            "CONCURRENCY_LIMIT",
            f"Running reviewer window is full ({len(running)}/{limit})",
            "wait_for_running_task_then_retry",
            running_tasks=running,
            limit=limit,
        )
    task["status"] = "running"
    task["started_at"] = now()
    task["attempt_count"] = int(task.get("attempt_count", 0)) + 1
    task.setdefault("reviewer_contexts", []).append(reviewer_context)
    task["reviewer_context"] = reviewer_context
    if lease:
        task["accepted_lease"] = lease
        task.pop("dispatch_lease", None)
    scheduling = manifest.get("scheduling", {})
    if not scheduling.get("probe_in_flight") and not scheduling.get("launch_in_flight"):
        direct_running = len(running) + 1
        scheduling["desired_window"] = min(
            int(scheduling.get("limit", direct_running)),
            max(int(scheduling.get("desired_window", 0)), direct_running),
        )
        scheduling["observed_capacity"] = max(
            int(scheduling.get("observed_capacity", 0)), direct_running
        )
    task_file = session_dir / "tasks" / f"{args.task}.json"
    atomic_json(task_file, task)
    save_session(session_dir, session_json, manifest)
    return {
        "task_id": args.task,
        "status": "running",
        "primary_path": task["path"],
        "reviewer_context": reviewer_context,
    }


def cmd_task_fail(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    task = manifest["tasks"].get(args.task)
    if not task:
        raise ReviewError("TASK_NOT_FOUND", f"Unknown task: {args.task}")
    require_task_state(task, {"running"}, "record failure for")
    reason = args.reason.strip()
    if not reason:
        raise ReviewError("INVALID_FAILURE_REASON", "Failure reason must not be empty")
    status = record_task_failure(task, reason)
    atomic_json(session_dir / "tasks" / f"{args.task}.json", task)
    save_session(session_dir, session_json, manifest)
    return {
        "task_id": args.task,
        "status": status,
        "failure_count": task["failure_count"],
        "retries_remaining": max(0, MAX_TASK_RETRIES - task["failure_count"] + 1),
        "next_action": "retry_task" if status == "interrupted" else "continue_other_tasks",
    }


def cmd_task_plan(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    task = manifest["tasks"].get(args.task)
    if not task:
        raise ReviewError("TASK_NOT_FOUND", f"Unknown task: {args.task}")
    payload = read_json(Path(args.input))
    if not isinstance(payload, dict):
        raise ReviewError("INVALID_TASK_PLAN", "Task plan must be a JSON object")
    dimensions = payload.get("dimensions")
    if (
        not isinstance(dimensions, list)
        or not dimensions
        or not all(isinstance(item, str) and item.strip() for item in dimensions)
        or len(set(dimensions)) != len(dimensions)
    ):
        raise ReviewError("INVALID_TASK_PLAN", "dimensions must be unique non-empty strings")
    if "correctness" not in dimensions:
        raise ReviewError("INVALID_TASK_PLAN", "Every task plan must retain the correctness dimension")
    signals = payload.get("signals", [])
    if not isinstance(signals, list) or not all(
        isinstance(item, dict)
        and isinstance(item.get("name"), str)
        and bool(item.get("name"))
        and isinstance(item.get("evidence"), str)
        and bool(item.get("evidence"))
        for item in signals
    ):
        raise ReviewError("INVALID_TASK_PLAN", "signals require non-empty name and evidence strings")
    plan_hash = canonical_hash({"dimensions": dimensions, "signals": signals})
    current_plan_hash = task.get("plan_hash") or canonical_hash(
        {
            "dimensions": task.get("dimensions", ["correctness"]),
            "signals": task.get("routing_signals", []),
        }
    )
    if task.get("status") not in {"pending", "stale"}:
        if current_plan_hash == plan_hash:
            return {
                "task_id": args.task,
                "status": "skipped_same_plan",
                "task_status": task.get("status"),
                "plan_hash": plan_hash,
            }
        raise ReviewError(
            "PLAN_CONFLICT",
            f"Task {args.task} already left the planning state with a different plan",
            "continue_batch_and_reconcile_task_separately",
            task_status=task.get("status"),
            existing_plan_hash=current_plan_hash,
            requested_plan_hash=plan_hash,
        )
    repo = Path(session_json["repo_root"])
    layers = rule_layers(repo, session_json.get("custom_rule_path"))
    rule = resolved_rule(task["path"], layers, load_system_rules())
    task["dimensions"] = dimensions
    task["routing_signals"] = signals
    task["plan_hash"] = plan_hash
    task["rule"] = {
        "source": rule["source"],
        "pattern": rule["pattern"],
        "sha256": sha256_text(rule["text"]),
    }
    task["input_hash"] = task_input_hash(
        repo,
        task["path"],
        session_json["mode"],
        rule,
        session_json["config_hashes"]["requirement"],
        session_json.get("base"),
        session_json.get("head"),
        dimensions,
    )
    task["planned_at"] = now()
    atomic_json(session_dir / "tasks" / f"{args.task}.json", task)
    save_session(session_dir, session_json, manifest)
    return {
        "task_id": args.task,
        "status": "planned",
        "dimensions": dimensions,
        "signals": len(signals),
        "plan_hash": plan_hash,
    }


def exact_anchor(content: str, snippet: str) -> tuple[int, int, int]:
    if not snippet:
        raise ReviewError("LOCATION_FAILED", "existing_code must not be empty", "resubmit_with_exact_existing_code")
    starts: list[int] = []
    position = content.find(snippet)
    while position >= 0:
        starts.append(position)
        position = content.find(snippet, position + 1)
    if not starts:
        raise ReviewError("LOCATION_FAILED", "existing_code was not found verbatim in the primary target", "resubmit_with_exact_existing_code")
    if len(starts) != 1:
        raise ReviewError(
            "LOCATION_AMBIGUOUS",
            "existing_code occurs more than once in the primary target",
            "resubmit_with_larger_existing_code",
            occurrences=len(starts),
        )
    start = starts[0]
    start_line = content.count("\n", 0, start) + 1
    line_count = snippet.count("\n") + (0 if snippet.endswith("\n") else 1)
    end_line = start_line + max(line_count - 1, 0)
    return start, start_line, end_line


def changed_new_ranges(repo: Path, base: str, head: str, path: str) -> list[tuple[int, int]]:
    if head == "WORKTREE" and not is_tracked(repo, path):
        line_count = len(file_bytes(repo, path).decode("utf-8", errors="replace").splitlines())
        return [(1, max(line_count, 1))]
    diff = review_diff_text(repo, base, head, path, unified=0)
    ranges: list[tuple[int, int]] = []
    for line in diff.splitlines():
        match = re.match(r"@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@", line)
        if match:
            start = int(match.group(1))
            count = int(match.group(2) or "1")
            if count > 0:
                ranges.append((start, start + count - 1))
    return ranges


def deleted_hunk_texts(repo: Path, base: str, head: str, path: str) -> list[str]:
    if head == "WORKTREE" and not is_tracked(repo, path):
        return []
    diff = review_diff_text(repo, base, head, path, unified=0).replace("\r\n", "\n")
    hunks: list[str] = []
    current: list[str] = []
    inside_hunk = False
    for line in diff.splitlines():
        if line.startswith("@@"):
            if current:
                hunks.append("\n".join(current))
                current = []
            inside_hunk = True
        elif inside_hunk and line.startswith("-") and not line.startswith("---"):
            current.append(line[1:])
        elif current:
            hunks.append("\n".join(current))
            current = []
    if current:
        hunks.append("\n".join(current))
    return hunks


def matches_deleted_line_sequence(evidence: str, hunks: Iterable[str]) -> bool:
    evidence_lines = evidence.split("\n")
    for hunk in hunks:
        deleted_lines = hunk.split("\n")
        width = len(evidence_lines)
        for index in range(len(deleted_lines) - width + 1):
            if deleted_lines[index : index + width] == evidence_lines:
                return True
    return False


def verification_required(payload: dict[str, Any]) -> bool:
    if payload["severity"] in {"critical", "high"}:
        return True
    if payload["category"] in VERIFIER_CATEGORIES:
        return True
    flags = payload.get("risk_flags", [])
    return any(flag in {"cross-file", "framework-dependent", "version-dependent", "uncertain-evidence"} for flag in flags)


def finding_files(session_dir: Path, task_id: str | None = None) -> list[Path]:
    root = session_dir / "findings"
    if not root.exists():
        return []
    pattern = f"{task_id}/*.json" if task_id else "*/*.json"
    return sorted(root.glob(pattern))


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def lease_expired(lease: dict[str, Any] | None) -> bool:
    if not lease:
        return False
    expires_at = parse_timestamp(lease.get("expires_at"))
    return expires_at is None or expires_at <= datetime.now(timezone.utc)


def make_lease(
    session_json: dict[str, Any], kind: str, subject_id: str, lease_seconds: int
) -> dict[str, Any]:
    created = datetime.now(timezone.utc)
    epoch = int(session_json.get("session_epoch", 1))
    lease_id = "lease-" + sha256_text(
        f"{session_json['session_id']}:{epoch}:{kind}:{subject_id}:{created.isoformat()}"
    )[:16]
    return {
        "id": lease_id,
        "kind": kind,
        "subject_id": subject_id,
        "session_epoch": epoch,
        "created_at": created.isoformat(),
        "expires_at": (created + timedelta(seconds=lease_seconds)).isoformat(),
    }


def expire_unaccepted_leases(
    session_dir: Path, manifest: dict[str, Any]
) -> dict[str, int]:
    expired_reviewers = 0
    expired_verifiers = 0
    for task in manifest.get("tasks", {}).values():
        lease = task.get("dispatch_lease")
        if lease and lease_expired(lease):
            task.pop("dispatch_lease", None)
            expired_reviewers += 1
    for path in finding_files(session_dir):
        finding = read_json(path)
        verification = finding.get("verification", {})
        lease = verification.get("lease")
        if lease and lease_expired(lease):
            verification.pop("lease", None)
            finding["verification"] = verification
            atomic_json(path, finding)
            expired_verifiers += 1
    return {"reviewers": expired_reviewers, "verifiers": expired_verifiers}


def pending_verifier_records(session_dir: Path) -> list[tuple[Path, dict[str, Any]]]:
    records: list[tuple[Path, dict[str, Any]]] = []
    for path in finding_files(session_dir):
        finding = read_json(path)
        verification = finding.get("verification", {})
        if (
            finding.get("state") == "candidate"
            and verification.get("required")
            and verification.get("status") in {"pending", "running"}
        ):
            records.append((path, finding))
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    records.sort(
        key=lambda item: (
            severity_order.get(item[1].get("severity"), 9),
            item[1].get("created_at", ""),
            item[1].get("id", item[0].stem),
        )
    )
    return records


def verifier_backlog(session_dir: Path) -> dict[str, int]:
    pending = 0
    leased = 0
    running = 0
    for _path, finding in pending_verifier_records(session_dir):
        verification = finding.get("verification", {})
        if verification.get("status") == "running":
            running += 1
        elif verification.get("lease") and not lease_expired(verification["lease"]):
            leased += 1
        else:
            pending += 1
    return {
        "pending": pending,
        "leased": leased,
        "running": running,
        "total": pending + leased + running,
    }


def active_context_count(session_dir: Path, manifest: dict[str, Any]) -> int:
    reviewers = sum(
        task.get("status") == "running" for task in manifest.get("tasks", {}).values()
    )
    verifiers = sum(
        finding.get("verification", {}).get("status") == "running"
        for _path, finding in pending_verifier_records(session_dir)
    )
    return reviewers + verifiers


def lease_orchestration_actions(
    session_dir: Path,
    session_json: dict[str, Any],
    manifest: dict[str, Any],
    slots: int,
    lease_seconds: int,
) -> list[dict[str, Any]]:
    records = pending_verifier_records(session_dir)
    unleased_verifiers = [
        (path, finding)
        for path, finding in records
        if finding.get("verification", {}).get("status") == "pending"
        and not finding.get("verification", {}).get("lease")
    ]
    backlog_before = len(unleased_verifiers)
    verifier_slots = 0
    if slots and backlog_before:
        verifier_slots = max(1, int(slots * VERIFIER_RESERVE_RATIO + 0.999999))
        if backlog_before >= max(VERIFIER_BACKPRESSURE_MINIMUM, slots):
            verifier_slots = slots
        verifier_slots = min(verifier_slots, backlog_before, slots)

    actions: list[dict[str, Any]] = []
    for path, finding in unleased_verifiers[:verifier_slots]:
        lease = make_lease(session_json, "verify", finding["id"], lease_seconds)
        finding["verification"]["lease"] = lease
        atomic_json(path, finding)
        actions.append(
            {
                "kind": "verify",
                "finding_id": finding["id"],
                "task_id": finding.get("task_id"),
                "severity": finding.get("severity"),
                "category": finding.get("category"),
                "lease_id": lease["id"],
                "session_epoch": lease["session_epoch"],
                "expires_at": lease["expires_at"],
            }
        )

    reviewer_slots = slots - len(actions)
    runnable = [
        (task_id, task)
        for task_id, task in sorted(
            manifest.get("tasks", {}).items(),
            key=lambda item: (item[1].get("path", ""), item[0]),
        )
        if task.get("status") in RUNNABLE_TASK_STATES and not task.get("dispatch_lease")
    ]
    for task_id, task in runnable[:reviewer_slots]:
        lease = make_lease(session_json, "review", task_id, lease_seconds)
        task["dispatch_lease"] = lease
        actions.append(
            {
                "kind": "review",
                "task_id": task_id,
                "primary_path": task["path"],
                "lease_id": lease["id"],
                "session_epoch": lease["session_epoch"],
                "expires_at": lease["expires_at"],
            }
        )
    return actions


def cmd_orchestrate_tick(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    assert_fleet_dispatch_allowed(session_dir, session_json, manifest)
    lease_seconds = int(args.lease_seconds)
    if lease_seconds < 30 or lease_seconds > 86_400:
        raise ReviewError("INVALID_LEASE_SECONDS", "lease-seconds must be between 30 and 86400")
    scheduling = manifest.setdefault(
        "scheduling", scheduling_config("auto", manifest.get("tasks", {}))
    )
    if scheduling.get("probe_in_flight"):
        raise ReviewError(
            "LEGACY_CAPACITY_PROBE_PENDING",
            "Resolve the legacy capacity probe before using orchestrate-tick",
            "report_capacity_probe",
        )
    in_flight = scheduling.get("launch_in_flight")
    if in_flight:
        raise ReviewError(
            "LAUNCH_REPORT_PENDING",
            f"Orchestrated launch {in_flight.get('id')} must be reported before another tick",
            "run_orchestrate_report",
            launch_id=in_flight.get("id"),
        )

    expired = expire_unaccepted_leases(session_dir, manifest)
    supplied_slots = getattr(args, "available_slots", None)
    if supplied_slots is not None:
        slots = int(supplied_slots)
        if slots < 0 or slots > 256:
            raise ReviewError(
                "INVALID_AVAILABLE_SLOTS", "available-slots must be between 0 and 256"
            )
        actions = lease_orchestration_actions(
            session_dir, session_json, manifest, slots, lease_seconds
        )
        save_session(session_dir, session_json, manifest)
        return {
            "session_id": session_json["session_id"],
            "session_epoch": int(session_json.get("session_epoch", 1)),
            "actions": actions,
            "expired_leases": expired,
            "verifier_backlog": verifier_backlog(session_dir),
            "reviewer_leases": sum(
                bool(task.get("dispatch_lease"))
                for task in manifest.get("tasks", {}).values()
            ),
            "legacy_slot_hint": True,
            "next_action": (
                "create_contexts_and_ack_leases"
                if actions
                else scheduling_next_action(manifest)
            ),
        }

    _reviewers_running, runnable_count, terminal = scheduling_counts(manifest)
    maybe_reopen_capacity_probe(scheduling, terminal)
    active = active_context_count(session_dir, manifest)
    desired = int(scheduling.get("desired_window", scheduling.get("limit", 1)))
    limit = int(scheduling.get("limit", max(1, len(manifest.get("tasks", {})))))
    concurrency = scheduling.get("concurrency", "auto")
    unleased_verifiers = sum(
        finding.get("verification", {}).get("status") == "pending"
        and not finding.get("verification", {}).get("lease")
        for _path, finding in pending_verifier_records(session_dir)
    )
    available_work = runnable_count + unleased_verifiers
    requested_window = desired
    phase: str | None = None

    if available_work and active < desired:
        if concurrency not in {"auto", "max"}:
            phase = "fixed-fill"
        elif not scheduling.get("launch_history") and int(
            scheduling.get("host_capacity", 0)
        ) == 0:
            # auto and max both maximize-first on the first wave.
            phase = "maximize"
        else:
            phase = "refill"
    elif (
        available_work
        and concurrency in {"auto", "max"}
        and scheduling.get("probe_state") in {"probing", "maximizing"}
        and desired < limit
        and active >= desired
    ):
        step = max(
            int(scheduling.get("probe_step", AUTO_PROBE_MIN_STEP)),
            (max(1, desired) + 3) // 4,
        )
        requested_window = min(limit, desired + step)
        phase = "expand" if concurrency == "auto" else "maximize"

    request_count = max(0, min(available_work, requested_window - active))
    actions = lease_orchestration_actions(
        session_dir, session_json, manifest, request_count, lease_seconds
    )
    launch_id: str | None = None
    if actions:
        requested_window = active + len(actions)
        launch_id = "launch-" + sha256_text(
            f"{session_json['session_id']}:{session_json.get('session_epoch', 1)}:"
            f"{now()}:{','.join(action['lease_id'] for action in actions)}"
        )[:16]
        scheduling["launch_in_flight"] = {
            "id": launch_id,
            "phase": phase,
            "actions": [
                {
                    "kind": action["kind"],
                    "subject_id": action.get("task_id")
                    if action["kind"] == "review"
                    else action.get("finding_id"),
                    "lease_id": action["lease_id"],
                }
                for action in actions
            ],
            "active_at_request": active,
            "desired_before": desired,
            "probe_state_before": scheduling.get("probe_state"),
            "requested_window": requested_window,
            "requested_at": now(),
        }

    save_session(session_dir, session_json, manifest)
    return {
        "session_id": session_json["session_id"],
        "session_epoch": int(session_json.get("session_epoch", 1)),
        "launch_id": launch_id,
        "phase": phase if actions else None,
        "requested_concurrency": requested_window if actions else desired,
        "accepted_concurrency": active,
        "host_capacity": int(scheduling.get("host_capacity", 0)) or None,
        "actions": actions,
        "expired_leases": expired,
        "verifier_backlog": verifier_backlog(session_dir),
        "reviewer_leases": sum(
            bool(task.get("dispatch_lease"))
            for task in manifest.get("tasks", {}).values()
        ),
        "next_action": (
            "create_contexts_ack_leases_then_report_launch"
            if actions
            else scheduling_next_action(manifest)
        ),
    }


def cmd_orchestrate_report(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    scheduling = manifest.get("scheduling", {})
    launch = scheduling.get("launch_in_flight")
    if not launch or launch.get("id") != args.launch:
        raise ReviewError(
            "ORCHESTRATED_LAUNCH_NOT_FOUND",
            f"No in-flight orchestrated launch matches {args.launch}",
            "run_orchestrate_tick",
        )
    payload = read_json(Path(args.input))
    if not isinstance(payload, dict):
        raise ReviewError("INVALID_LAUNCH_REPORT", "Launch report must be a JSON object")
    accepted_entries = payload.get("accepted", [])
    rejected_entries = payload.get("rejected", [])
    if not isinstance(accepted_entries, list) or not isinstance(rejected_entries, list):
        raise ReviewError(
            "INVALID_LAUNCH_REPORT", "accepted and rejected must be arrays"
        )
    if not all(isinstance(entry, dict) for entry in accepted_entries + rejected_entries):
        raise ReviewError(
            "INVALID_LAUNCH_REPORT", "Each accepted or rejected entry must be an object"
        )

    actions = {action["lease_id"]: action for action in launch.get("actions", [])}
    accepted_by_lease: dict[str, dict[str, Any]] = {}
    rejected_by_lease: dict[str, dict[str, Any]] = {}
    for entry in accepted_entries:
        lease_id = str(entry.get("lease_id", "")).strip()
        context_id = str(entry.get("context_id", "")).strip()
        if not lease_id or not context_id:
            raise ReviewError(
                "INVALID_LAUNCH_REPORT",
                "Accepted entries require non-empty lease_id and context_id",
            )
        if lease_id in accepted_by_lease:
            raise ReviewError("INVALID_LAUNCH_REPORT", f"Duplicate accepted lease: {lease_id}")
        accepted_by_lease[lease_id] = {**entry, "context_id": context_id}
    for entry in rejected_entries:
        lease_id = str(entry.get("lease_id", "")).strip()
        reason = str(entry.get("reason", "")).strip()
        if not lease_id or not reason:
            raise ReviewError(
                "INVALID_LAUNCH_REPORT",
                "Rejected entries require non-empty lease_id and reason",
            )
        if lease_id in rejected_by_lease:
            raise ReviewError("INVALID_LAUNCH_REPORT", f"Duplicate rejected lease: {lease_id}")
        rejected_by_lease[lease_id] = {**entry, "reason": reason}

    reported = set(accepted_by_lease) | set(rejected_by_lease)
    overlap = set(accepted_by_lease) & set(rejected_by_lease)
    if overlap or reported != set(actions):
        raise ReviewError(
            "INCOMPLETE_LAUNCH_REPORT",
            "Every launched lease must be reported exactly once as accepted or rejected",
            missing_lease_ids=sorted(set(actions) - reported),
            unknown_lease_ids=sorted(reported - set(actions)),
            conflicting_lease_ids=sorted(overlap),
        )

    finding_cache: dict[str, tuple[Path, dict[str, Any]]] = {}
    for lease_id, entry in accepted_by_lease.items():
        action = actions[lease_id]
        context_id = entry["context_id"]
        if action["kind"] == "review":
            task = manifest.get("tasks", {}).get(action["subject_id"], {})
            accepted_lease = task.get("accepted_lease", {})
            if (
                task.get("status") != "running"
                or accepted_lease.get("id") != lease_id
                or task.get("reviewer_context") != context_id
            ):
                raise ReviewError(
                    "LAUNCH_ACK_MISSING",
                    f"Reviewer lease {lease_id} must be acknowledged by task-start first",
                    "run_task_start",
                )
        else:
            path, finding = find_finding(session_dir, action["subject_id"])
            finding_cache[action["subject_id"]] = (path, finding)
            verification = finding.get("verification", {})
            if (
                verification.get("status") != "running"
                or verification.get("accepted_lease", {}).get("id") != lease_id
                or verification.get("verifier_context") != context_id
            ):
                raise ReviewError(
                    "LAUNCH_ACK_MISSING",
                    f"Verifier lease {lease_id} must be acknowledged by verifier-start first",
                    "run_verifier_start",
                )

    rejection_reasons: list[str] = []
    for lease_id, entry in rejected_by_lease.items():
        action = actions[lease_id]
        rejection_reasons.append(entry["reason"])
        if action["kind"] == "review":
            task = manifest.get("tasks", {}).get(action["subject_id"], {})
            if task.get("accepted_lease", {}).get("id") == lease_id:
                raise ReviewError(
                    "INVALID_LAUNCH_REPORT",
                    f"Started reviewer lease {lease_id} cannot be reported as rejected",
                )
            if task.get("dispatch_lease", {}).get("id") == lease_id:
                task.pop("dispatch_lease", None)
        else:
            path, finding = finding_cache.get(action["subject_id"], (None, None))
            if finding is None:
                path, finding = find_finding(session_dir, action["subject_id"])
            verification = finding.get("verification", {})
            if verification.get("accepted_lease", {}).get("id") == lease_id:
                raise ReviewError(
                    "INVALID_LAUNCH_REPORT",
                    f"Started verifier lease {lease_id} cannot be reported as rejected",
                )
            if verification.get("lease", {}).get("id") == lease_id:
                verification.pop("lease", None)
                finding["verification"] = verification
                atomic_json(path, finding)

    accepted = len(accepted_by_lease)
    rejected = len(rejected_by_lease)
    requested_window = int(launch.get("requested_window", accepted))
    active_at_request = int(launch.get("active_at_request", 0))
    limit = int(scheduling.get("limit", max(1, len(manifest.get("tasks", {})))))
    _running, _runnable, terminal = scheduling_counts(manifest)
    if rejected:
        capacity_at_attempt = min(limit, active_at_request + accepted)
        scheduling["desired_window"] = max(1, capacity_at_attempt)
        scheduling["observed_capacity"] = max(
            int(scheduling.get("observed_capacity", 0)), capacity_at_attempt
        )
        scheduling["host_capacity"] = capacity_at_attempt
        scheduling["probe_state"] = "saturated"
        scheduling["host_rejections"] = int(scheduling.get("host_rejections", 0)) + rejected
        scheduling["last_host_rejection"] = {
            "at": now(),
            "reason": "; ".join(sorted(set(rejection_reasons))),
        }
        scheduling["saturation_terminal_count"] = terminal
    else:
        scheduling["desired_window"] = min(
            limit, max(int(scheduling.get("desired_window", 0)), requested_window)
        )
        scheduling["observed_capacity"] = min(
            limit, max(int(scheduling.get("observed_capacity", 0)), requested_window)
        )
        scheduling["host_capacity"] = min(
            limit, max(int(scheduling.get("host_capacity", 0)), requested_window)
        )
        concurrency = scheduling.get("concurrency", "auto")
        if concurrency not in {"auto", "max"}:
            scheduling["probe_state"] = "fixed"
        elif (
            launch.get("phase") == "refill"
            and launch.get("probe_state_before") == "saturated"
        ):
            scheduling["probe_state"] = "saturated"
        else:
            scheduling["probe_state"] = (
                "probing" if concurrency == "auto" else "maximizing"
            )

    history_entry = {
        "id": launch["id"],
        "phase": launch.get("phase"),
        "requested": len(actions),
        "accepted": accepted,
        "rejected": rejected,
        "requested_window": requested_window,
        "reported_at": now(),
    }
    if rejection_reasons:
        history_entry["reasons"] = sorted(set(rejection_reasons))
    scheduling.setdefault("launch_history", []).append(history_entry)
    scheduling["launch_history"] = scheduling["launch_history"][-100:]
    scheduling["launch_in_flight"] = None
    save_session(session_dir, session_json, manifest)
    accepted_concurrency = active_context_count(session_dir, manifest)
    result = {
        "launch_id": launch["id"],
        "accepted": accepted,
        "rejected": rejected,
        "accepted_lease_ids": sorted(accepted_by_lease),
        "host_capacity": int(scheduling.get("host_capacity", 0)),
        "desired_concurrency": int(scheduling.get("desired_window", 0)),
        "accepted_concurrency": accepted_concurrency,
        "probe_state": scheduling.get("probe_state"),
        "next_action": scheduling_next_action(manifest),
    }
    fleet_recommendation = bulk_reject_fleet_recommendation(
        session_dir, session_json, manifest, rejected
    )
    if fleet_recommendation:
        result["fleet_recommendation"] = fleet_recommendation
        result["next_action"] = "fleet_plan_then_worktree_shards"
    return result


def cmd_submit(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    task = manifest["tasks"].get(args.task)
    if not task:
        raise ReviewError("TASK_NOT_FOUND", f"Unknown task: {args.task}")
    require_task_state(task, {"running"}, "submit a finding for")
    payload = read_json(Path(args.input))
    if not isinstance(payload, dict):
        raise ReviewError("INVALID_FINDING", "Finding input must be a JSON object", "resubmit_finding")
    missing = sorted(REQUIRED_FINDING_FIELDS - payload.keys())
    if missing:
        raise ReviewError("INVALID_FINDING", f"Missing required fields: {', '.join(missing)}", "resubmit_finding")
    if any(key in payload for key in ("path", "file", "start_line", "end_line", "line")):
        raise ReviewError("MODEL_LOCATION_FORBIDDEN", "Model input must not provide trusted path or line fields", "remove_location_fields")
    if payload["severity"] not in VALID_SEVERITIES:
        raise ReviewError("INVALID_SEVERITY", f"Unsupported severity: {payload['severity']}")
    if payload["category"] not in VALID_CATEGORIES:
        raise ReviewError("INVALID_CATEGORY", f"Unsupported category: {payload['category']}")
    if payload["impact_surface"] not in VALID_IMPACT_SURFACES:
        raise ReviewError(
            "INVALID_IMPACT_SURFACE",
            f"Unsupported impact_surface: {payload['impact_surface']}",
            "resubmit_finding",
        )
    if payload["reachability"] not in VALID_REACHABILITY:
        raise ReviewError(
            "INVALID_REACHABILITY",
            f"Unsupported reachability: {payload['reachability']}",
            "resubmit_finding",
        )
    if not isinstance(payload["current_input_reproducible"], bool):
        raise ReviewError(
            "INVALID_REPRODUCIBILITY",
            "current_input_reproducible must be boolean",
            "resubmit_finding",
        )
    string_fields = REQUIRED_FINDING_FIELDS - {"evidence", "current_input_reproducible"}
    if any(not isinstance(payload[field], str) or not payload[field].strip() for field in string_fields):
        raise ReviewError("INVALID_FINDING", "Finding text fields must be non-empty strings", "resubmit_finding")
    if (
        not isinstance(payload["evidence"], list)
        or not payload["evidence"]
        or not all(isinstance(item, str) and item.strip() for item in payload["evidence"])
    ):
        raise ReviewError("EVIDENCE_REQUIRED", "A finding requires at least one evidence item", "investigate_candidate")
    risk_flags = payload.get("risk_flags", [])
    if not isinstance(risk_flags, list) or not all(isinstance(item, str) for item in risk_flags):
        raise ReviewError("INVALID_FINDING", "risk_flags must be an array of strings", "resubmit_finding")
    xref = payload.get("xref", [])
    if not isinstance(xref, list):
        raise ReviewError("INVALID_FINDING", "xref must be an array", "resubmit_finding")
    cross_file = bool(xref)
    risk_flags = [flag for flag in risk_flags if flag != "cross-file"]
    if cross_file:
        risk_flags.append("cross-file")
    payload["risk_flags"] = sorted(set(risk_flags))
    if (
        session_json.get("profile") == "correctness"
        and payload["impact_surface"] in {"tooling", "docs"}
        and (payload["reachability"] != "proven" or not payload["current_input_reproducible"])
    ):
        raise ReviewError(
            "IMPACT_NOT_CURRENTLY_REACHABLE",
            "Correctness review requires tooling/docs findings to be proven reachable and reproducible from current inputs",
            "record_rejected_candidate",
        )
    delivery_impact = payload.get("delivery_impact")
    if delivery_impact is not None and delivery_impact not in {"P0", "P1", "P2"}:
        raise ReviewError(
            "INVALID_DELIVERY_IMPACT",
            "delivery_impact must be P0, P1 or P2 when supplied",
            "resubmit_finding",
        )
    semantic_hints: dict[str, str | None] = {}
    for field in ("root_cause_key", "fix_scope"):
        value = payload.get(field)
        if value is not None and (
            not isinstance(value, str)
            or not value.strip()
            or len(value.strip()) > SEMANTIC_HINT_MAX_CHARS
        ):
            raise ReviewError(
                "INVALID_FINDING",
                f"{field} must be a non-empty string of at most {SEMANTIC_HINT_MAX_CHARS} characters when supplied",
                "resubmit_finding",
            )
        semantic_hints[field] = value.strip() if isinstance(value, str) else None
    repo = Path(session_json["repo_root"])
    path = task["path"]
    content = file_bytes(repo, path).decode("utf-8", errors="replace").replace("\r\n", "\n")
    snippet = str(payload["existing_code"]).replace("\r\n", "\n")
    _offset, start_line, end_line = exact_anchor(content, snippet)

    if session_json["mode"] == "review":
        ranges = changed_new_ranges(repo, session_json["base"], session_json["head"], path)
        overlaps = any(start_line <= right and end_line >= left for left, right in ranges)
        deletion_evidence = False
        if payload.get("change_kind") == "deletion":
            raw_evidence = payload.get("change_evidence")
            if not isinstance(raw_evidence, str) or not raw_evidence.strip():
                raise ReviewError(
                    "INVALID_DELETION_EVIDENCE",
                    "Deletion findings require non-empty verbatim change_evidence",
                    "resubmit_with_deleted_hunk_evidence",
                )
            evidence = raw_evidence.replace("\r\n", "\n").strip("\n")
            deletion_evidence = matches_deleted_line_sequence(
                evidence,
                deleted_hunk_texts(repo, session_json["base"], session_json["head"], path),
            )
            if not deletion_evidence:
                raise ReviewError(
                    "INVALID_DELETION_EVIDENCE",
                    "change_evidence was not found verbatim in a deleted diff hunk",
                    "resubmit_with_deleted_hunk_evidence",
                )
        if not overlaps and not deletion_evidence:
            raise ReviewError(
                "OUTSIDE_DIFF",
                "Anchor does not overlap a new-side diff hunk and has no deletion change evidence",
                "investigate_diff_relation",
            )

    location_fingerprint = sha256_text(f"{path}\0{snippet}")
    finding_id = "finding-" + sha256_text(
        f"{args.task}\0{task['input_hash']}\0{payload['claim']}\0{location_fingerprint}"
    )[:16]
    required = verification_required(payload)
    finding = {
        "schema_version": SCHEMA_VERSION,
        "id": finding_id,
        "task_id": args.task,
        "state": "candidate" if required else "confirmed",
        "model_input": payload,
        "title": payload["title"],
        "claim": payload["claim"],
        "severity": payload["severity"],
        "category": payload["category"],
        "expected": payload["expected"],
        "actual": payload["actual"],
        "impact": payload["impact"],
        "impact_surface": payload["impact_surface"],
        "reachability": payload["reachability"],
        "current_input_reproducible": payload["current_input_reproducible"],
        "cross_file": cross_file,
        "delivery_impact": delivery_impact,
        "evidence": payload["evidence"],
        "change_evidence": payload.get("change_evidence"),
        "location": {
            "path": path,
            "start_line": start_line,
            "end_line": end_line,
            "existing_code": snippet,
            "fingerprint": location_fingerprint,
        },
        "verification": {"required": required, "status": "pending" if required else "not-required"},
        "input_hash": task["input_hash"],
        "revision": task["input_hash"][:16],
        "created_at": now(),
        "xref": xref,
        "root_cause_key": semantic_hints["root_cause_key"],
        "fix_scope": semantic_hints["fix_scope"],
    }
    target = session_dir / "findings" / args.task / f"{finding_id}.json"
    if target.exists():
        existing = read_json(target)
        # Context-only stale keeps input_hash/finding_id stable while resume marks
        # prior findings superseded. Treat that as a revival, not a silent duplicate.
        if existing.get("state") == "superseded":
            finding["revived_from"] = existing.get("id", finding_id)
            finding["revived_at"] = now()
            atomic_json(target, finding)
            return {
                "finding_id": finding_id,
                "finding_file": str(target),
                "state": finding["state"],
                "revived": True,
                "next_action": "verify_finding" if required else "continue_review",
            }
        return {"finding_id": finding_id, "finding_file": str(target), "duplicate": True}
    atomic_json(target, finding)
    return {
        "finding_id": finding_id,
        "finding_file": str(target),
        "state": finding["state"],
        "next_action": "verify_finding" if required else "continue_review",
    }


def find_finding(session_dir: Path, finding_id: str) -> tuple[Path, dict[str, Any]]:
    matches = [path for path in finding_files(session_dir) if path.stem == finding_id]
    if len(matches) != 1:
        raise ReviewError("FINDING_NOT_FOUND", f"Expected one finding named {finding_id}, found {len(matches)}")
    return matches[0], read_json(matches[0])


def cmd_verifier_start(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    path, finding = find_finding(session_dir, args.finding)
    verification = finding.get("verification", {})
    if (
        finding.get("state") != "candidate"
        or verification.get("status") != "pending"
    ):
        raise ReviewError(
            "INVALID_FINDING_STATE",
            f"Finding {args.finding} is not awaiting a verifier start",
            "choose_pending_finding",
        )
    lease = verification.get("lease")
    supplied_lease = (getattr(args, "lease", None) or "").strip()
    if not lease:
        raise ReviewError(
            "LEASE_NOT_FOUND",
            f"Finding {args.finding} has no reserved verifier lease",
            "run_orchestrate_tick",
        )
    if lease_expired(lease):
        verification.pop("lease", None)
        finding["verification"] = verification
        atomic_json(path, finding)
        raise ReviewError(
            "LEASE_EXPIRED", f"Verifier lease for {args.finding} expired", "run_orchestrate_tick"
        )
    if supplied_lease != lease.get("id") or int(lease.get("session_epoch", 0)) != int(
        session_json.get("session_epoch", 1)
    ):
        raise ReviewError(
            "LEASE_MISMATCH", f"Verifier lease does not match {args.finding}", "run_orchestrate_tick"
        )
    verifier_context = args.verifier_context.strip()
    if not verifier_context or verifier_context.lower() in {"controller", "current", "main", "root"}:
        raise ReviewError(
            "INVALID_VERIFIER_CONTEXT",
            "A reserved verification requires a fresh independent verifier context",
            "dispatch_verifier_subagent",
        )
    if any(
        verifier_context in task.get("reviewer_contexts", [])
        for task in manifest.get("tasks", {}).values()
    ):
        raise ReviewError(
            "VERIFIER_CONTEXT_REUSED",
            "Verifier context must be independent from every reviewer context",
            "dispatch_fresh_verifier_subagent",
        )
    for _other_path, other in pending_verifier_records(session_dir):
        if (
            other.get("id") != args.finding
            and other.get("verification", {}).get("verifier_context") == verifier_context
        ):
            raise ReviewError(
                "VERIFIER_CONTEXT_REUSED",
                "One verifier context cannot own multiple active findings",
                "dispatch_fresh_verifier_subagent",
            )
    verification.pop("lease", None)
    verification.update(
        {
            "status": "running",
            "accepted_lease": lease,
            "verifier_context": verifier_context,
            "started_at": now(),
        }
    )
    finding["verification"] = verification
    atomic_json(path, finding)
    save_session(session_dir, session_json, manifest)
    return {
        "finding_id": args.finding,
        "status": "running",
        "verifier_context": verifier_context,
    }


def cmd_verify(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, _manifest = load_session(args.session)
    path, finding = find_finding(session_dir, args.finding)
    verification = finding.get("verification", {})
    verification_status = verification.get("status")
    if finding.get("state") != "candidate" or verification_status not in {"pending", "running"}:
        raise ReviewError(
            "INVALID_FINDING_STATE",
            f"Finding {args.finding} is not awaiting verification",
            "choose_pending_finding",
        )
    lease = (
        verification.get("accepted_lease")
        if verification_status == "running"
        else verification.get("lease")
    )
    supplied_lease = (getattr(args, "lease", None) or "").strip()
    verifier_context = (getattr(args, "verifier_context", None) or "").strip()
    if lease:
        if verification_status == "pending" and lease_expired(lease):
            verification.pop("lease", None)
            finding["verification"] = verification
            atomic_json(path, finding)
            raise ReviewError("LEASE_EXPIRED", f"Verifier lease for {args.finding} expired", "run_orchestrate_tick")
        if supplied_lease != lease.get("id") or int(lease.get("session_epoch", 0)) != int(
            session_json.get("session_epoch", 1)
        ):
            raise ReviewError("LEASE_MISMATCH", f"Verifier lease does not match {args.finding}", "run_orchestrate_tick")
        if not verifier_context or verifier_context.lower() in {"controller", "current", "main", "root"}:
            raise ReviewError(
                "INVALID_VERIFIER_CONTEXT",
                "A reserved verification requires a fresh independent verifier context",
                "dispatch_verifier_subagent",
            )
        if (
            verification_status == "running"
            and verification.get("verifier_context") != verifier_context
        ):
            raise ReviewError(
                "VERIFIER_CONTEXT_MISMATCH",
                f"Verifier context does not match the started verifier for {args.finding}",
                "use_started_verifier_context",
            )
    elif supplied_lease:
        raise ReviewError("LEASE_NOT_FOUND", f"Finding {args.finding} has no verifier lease", "run_orchestrate_tick")
    finding["verification"] = {
        "required": True,
        "status": "confirmed" if args.decision == "confirm" else "rejected",
        "reason": args.reason,
        "verified_at": now(),
        "verifier_context": verifier_context or None,
        "accepted_lease": lease,
    }
    finding["state"] = "confirmed" if args.decision == "confirm" else "rejected"
    atomic_json(path, finding)
    return {"finding_id": args.finding, "state": finding["state"]}


def normalize_coverage(coverage: Any, segmented: bool) -> dict[str, Any]:
    if not isinstance(coverage, dict):
        raise ReviewError("INVALID_COVERAGE", "Coverage must be a JSON object", "complete_coverage_ledger")
    required = {"primary_target_complete", "symbols", "ranges", "dimensions", "skipped", "blind_spots", "pending_questions"}
    missing = sorted(required - coverage.keys())
    if missing:
        raise ReviewError("INVALID_COVERAGE", f"Coverage is missing: {', '.join(missing)}", "complete_coverage_ledger")
    if coverage["primary_target_complete"] is not True:
        raise ReviewError("PRIMARY_TARGET_INCOMPLETE", "Primary target is not completely reviewed", "continue_review")
    if not isinstance(coverage["symbols"], list) or not all(
        isinstance(item, str) and item.strip() for item in coverage["symbols"]
    ):
        raise ReviewError("INVALID_COVERAGE", "symbols must be an array of strings", "complete_coverage_ledger")
    if not isinstance(coverage["ranges"], list):
        raise ReviewError("INVALID_COVERAGE", "ranges must be an array", "complete_coverage_ledger")
    normalized_ranges: list[dict[str, int]] = []
    for item in coverage["ranges"]:
        if isinstance(item, (list, tuple)) and len(item) == 2:
            start_line, end_line = item
        elif isinstance(item, dict):
            start_line, end_line = item.get("start_line"), item.get("end_line")
        else:
            raise ReviewError(
                "INVALID_COVERAGE",
                "Each range must be [start_line, end_line] or an object with those fields",
                "complete_coverage_ledger",
            )
        if (
            not isinstance(start_line, int)
            or isinstance(start_line, bool)
            or not isinstance(end_line, int)
            or isinstance(end_line, bool)
            or start_line < 1
            or end_line < start_line
        ):
            raise ReviewError(
                "INVALID_COVERAGE",
                "Coverage ranges require positive ordered integer line numbers",
                "complete_coverage_ledger",
            )
        normalized_ranges.append({"start_line": start_line, "end_line": end_line})
    if (
        not isinstance(coverage["dimensions"], list)
        or not coverage["dimensions"]
        or not all(isinstance(item, str) and item.strip() for item in coverage["dimensions"])
    ):
        raise ReviewError("DIMENSIONS_MISSING", "At least one completed review dimension is required", "record_review_dimensions")
    if not isinstance(coverage["skipped"], list) or not all(
        isinstance(item, dict)
        and isinstance(item.get("dimension"), str)
        and isinstance(item.get("reason"), str)
        for item in coverage["skipped"]
    ):
        raise ReviewError("INVALID_COVERAGE", "skipped entries require string dimension and reason", "complete_coverage_ledger")
    if not isinstance(coverage["blind_spots"], list):
        raise ReviewError("INVALID_COVERAGE", "blind_spots must be an array", "complete_coverage_ledger")
    normalized_blind_spots: list[dict[str, Any]] = []
    for item in coverage["blind_spots"]:
        if not isinstance(item, dict) or not all(isinstance(item.get(key), str) and item.get(key) for key in ("area", "reason", "scope")):
            raise ReviewError(
                "INVALID_COVERAGE",
                "Each blind spot requires non-empty area, reason and scope strings",
                "complete_coverage_ledger",
            )
        if item["scope"] not in BLIND_SPOT_SCOPES:
            raise ReviewError("INVALID_COVERAGE", f"Unsupported blind spot scope: {item['scope']}")
        normalized = dict(item)
        normalized["material"] = item["scope"] in MATERIAL_BLIND_SPOT_SCOPES
        normalized_blind_spots.append(normalized)
    if not isinstance(coverage["pending_questions"], list) or not all(
        isinstance(item, str) for item in coverage["pending_questions"]
    ):
        raise ReviewError("INVALID_COVERAGE", "pending_questions must be an array of strings", "complete_coverage_ledger")
    if coverage["pending_questions"]:
        raise ReviewError("PENDING_QUESTIONS", "Coverage still has pending questions", "resolve_pending_questions")
    if segmented and not coverage["symbols"] and not coverage["ranges"]:
        raise ReviewError("SEGMENT_COVERAGE_MISSING", "Segmented tasks require symbol or range coverage", "continue_segmented_review")
    context_paths = coverage.get("context_paths", [])
    if not isinstance(context_paths, list) or not all(isinstance(item, str) for item in context_paths):
        raise ReviewError("INVALID_COVERAGE", "context_paths must be an array of strings", "complete_coverage_ledger")
    rejected = coverage.get("rejected_candidates", [])
    if not isinstance(rejected, list):
        raise ReviewError("INVALID_COVERAGE", "rejected_candidates must be an array", "complete_coverage_ledger")
    normalized_coverage = dict(coverage)
    normalized_coverage["ranges"] = normalized_ranges
    normalized_coverage["blind_spots"] = normalized_blind_spots
    normalized_coverage["context_paths"] = context_paths
    normalized_coverage["rejected_candidates"] = rejected
    return normalized_coverage


def context_dependency_hashes(repo: Path, paths: Iterable[str]) -> dict[str, str]:
    hashes: dict[str, str] = {}
    root = repo.resolve()
    for raw_path in paths:
        path = normalize_path(str(raw_path))
        target = (root / path).resolve()
        try:
            target.relative_to(root)
        except ValueError as exc:
            raise ReviewError("PATH_ESCAPE", f"Context path escapes repository: {raw_path}") from exc
        if not target.is_file():
            raise ReviewError("CONTEXT_NOT_FOUND", f"Context dependency does not exist: {path}", "fix_coverage_context_paths")
        try:
            hashes[path] = sha256_bytes(target.read_bytes())
        except OSError as exc:
            raise ReviewError("FILE_READ_FAILED", f"Cannot read context dependency {path}: {exc}") from exc
    return hashes


def cmd_checkpoint(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    task = manifest["tasks"].get(args.task)
    if not task:
        raise ReviewError("TASK_NOT_FOUND", f"Unknown task: {args.task}")
    require_task_state(task, {"running"}, "checkpoint")
    payload = read_json(Path(args.input))
    if not isinstance(payload, dict):
        raise ReviewError("INVALID_CHECKPOINT", "Checkpoint input must be a JSON object")
    required = {"covered_symbols", "covered_ranges", "finding_ids", "rejected_candidates", "pending_questions", "next_action"}
    missing = sorted(required - payload.keys())
    if missing:
        raise ReviewError("INVALID_CHECKPOINT", f"Checkpoint is missing: {', '.join(missing)}")
    payload.update({"task_id": args.task, "input_hash": task["input_hash"], "updated_at": now()})
    atomic_json(session_dir / "checkpoints" / f"{args.task}.json", payload)
    task["status"] = "checkpointed"
    save_session(session_dir, session_json, manifest)
    return {"task_id": args.task, "status": "checkpointed", "next_action": payload["next_action"]}


def cmd_complete(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    task = manifest["tasks"].get(args.task)
    if not task:
        raise ReviewError("TASK_NOT_FOUND", f"Unknown task: {args.task}")
    require_task_state(task, {"running"}, "complete")
    coverage = normalize_coverage(read_json(Path(args.coverage)), bool(task.get("segmented")))
    accounted_dimensions = set(coverage["dimensions"]) | {
        item["dimension"] for item in coverage["skipped"]
    }
    missing_dimensions = sorted(set(task.get("dimensions", ["correctness"])) - accounted_dimensions)
    if missing_dimensions:
        raise ReviewError(
            "DIMENSION_COVERAGE_MISSING",
            "Planned review dimensions are neither covered nor explicitly skipped",
            "complete_coverage_ledger",
            dimensions=missing_dimensions,
        )
    pending = []
    for path in finding_files(session_dir, args.task):
        finding = read_json(path)
        if (
            finding.get("state") == "candidate"
            and finding.get("verification", {}).get("required")
            and finding.get("verification", {}).get("status") in {"pending", "running"}
        ):
            pending.append(finding["id"])
    task["status"] = "complete"
    task["coverage"] = coverage
    task["context_dependencies"] = context_dependency_hashes(
        Path(session_json["repo_root"]), coverage.get("context_paths", [])
    )
    task["completed_at"] = now()
    task["completed_input_hash"] = task["input_hash"]
    atomic_json(session_dir / "tasks" / f"{args.task}.json", task)
    checkpoint = session_dir / "checkpoints" / f"{args.task}.json"
    if checkpoint.exists():
        checkpoint.unlink()
    save_session(session_dir, session_json, manifest)
    return {
        "task_id": args.task,
        "status": "complete",
        "blind_spots": coverage["blind_spots"],
        "verification_pending": sorted(pending),
        "next_action": "drain_verifier_queue" if pending else "orchestrate_tick",
    }


def cmd_stack_card(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    card = read_json(Path(args.input))
    if not isinstance(card, dict):
        raise ReviewError("INVALID_STACK_CARD", "Stack Card must be a JSON object")
    required = {"languages", "build_systems", "entrypoints", "data_stores", "external_integrations", "auth_boundaries", "delivery_surfaces", "scan_tools"}
    missing = sorted(required - card.keys())
    if missing:
        raise ReviewError("INVALID_STACK_CARD", f"Stack Card is missing: {', '.join(missing)}")
    card["source"] = "review-preflight"
    card["signals_pending_model_enrichment"] = False
    session_json["stack_card"] = card
    save_session(session_dir, session_json, manifest)
    return {"session_id": session_json["session_id"], "stack_card": "updated"}


def mark_findings_superseded(session_dir: Path, task_id: str, reason: str) -> None:
    for path in finding_files(session_dir, task_id):
        finding = read_json(path)
        if finding.get("state") in {"candidate", "confirmed"}:
            finding["state"] = "superseded"
            finding["superseded_reason"] = reason
            finding["superseded_at"] = now()
            atomic_json(path, finding)


def cmd_resume(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    was_paused = session_json.get("status") == "paused"
    for task in manifest.get("tasks", {}).values():
        task.pop("dispatch_lease", None)
    for finding_path, finding in pending_verifier_records(session_dir):
        verification = finding.get("verification", {})
        verification.pop("lease", None)
        if verification.get("status") == "running" and not was_paused:
            verification["status"] = "pending"
            verification["interrupted_at"] = now()
            verification.pop("accepted_lease", None)
            verification.pop("verifier_context", None)
            verification.pop("started_at", None)
        finding["verification"] = verification
        atomic_json(finding_path, finding)
    repo = Path(session_json["repo_root"])
    replacement_rule = getattr(args, "rule", None)
    custom_rule_path = replacement_rule or session_json.get("custom_rule_path")
    if replacement_rule:
        session_json["custom_rule_path"] = str(Path(replacement_rule).resolve())
        custom_rule_path = session_json["custom_rule_path"]
    layers = rule_layers(repo, custom_rule_path)
    system = load_system_rules()
    file_filter = selected_file_filter(layers)
    listed_paths = (
        list_scan_files(repo)
        if session_json["mode"] == "scan"
        else list_review_files(repo, session_json["base"], session_json["head"])
    )
    primary_paths = {
        path
        for path in listed_paths
        if is_regular_workspace_file(repo, path)
        and not is_binary_file(repo, path)
        and should_review(
            path,
            file_filter,
            session_json.get("scope", "runtime-code") if session_json["mode"] == "scan" else None,
        )
    }
    stale: list[str] = []
    interrupted: list[str] = []
    blocked: list[str] = []
    removed: list[str] = []
    added: list[str] = []
    by_path = {task["path"]: task_id for task_id, task in manifest["tasks"].items()}
    for path, task_id in by_path.items():
        if path not in primary_paths and manifest["tasks"][task_id]["status"] != "removed":
            manifest["tasks"][task_id]["status"] = "removed"
            manifest["tasks"][task_id]["removed_at"] = now()
            removed.append(task_id)
            mark_findings_superseded(session_dir, task_id, "Primary Target removed or filtered")
    for path in sorted(primary_paths):
        task_id = by_path.get(path)
        if task_id is None or manifest["tasks"][task_id]["status"] == "removed":
            rule = resolved_rule(path, layers, system)
            task = build_task(
                repo,
                path,
                session_json["mode"],
                rule,
                session_json["config_hashes"]["requirement"],
                session_json.get("base"),
                session_json.get("head", "HEAD"),
                int(session_json.get("segment_threshold", 256 * 1024)),
            )
            manifest["tasks"][task["id"]] = task
            added.append(task["id"])
    for task_id, task in manifest["tasks"].items():
        if task["status"] == "removed" or task_id in added:
            continue
        rule = resolved_rule(task["path"], layers, system)
        current_hash = task_input_hash(
            repo,
            task["path"],
            session_json["mode"],
            rule,
            session_json["config_hashes"]["requirement"],
            session_json.get("base"),
            session_json.get("head"),
            task.get("dimensions", ["correctness"]),
        )
        changed_context = [
            path
            for path, fingerprint in task.get("context_dependencies", {}).items()
            if sha256_bytes(file_bytes(repo, path)) != fingerprint
        ]
        if current_hash != task["input_hash"] or changed_context:
            task["status"] = "stale"
            task["input_hash"] = current_hash
            task["content_sha256"] = sha256_bytes(file_bytes(repo, task["path"]))
            task["failure_count"] = 0
            task.pop("blocking_blind_spot", None)
            task["stale_reason"] = (
                "context dependency changed: " + ", ".join(changed_context)
                if changed_context
                else "task input fingerprint changed"
            )
            stale.append(task_id)
            mark_findings_superseded(session_dir, task_id, task["stale_reason"])
        elif task["status"] == "running" and not was_paused:
            recovered_status = record_task_failure(task, "orphan running task recovered by resume")
            if recovered_status == "blocked":
                blocked.append(task_id)
            else:
                interrupted.append(task_id)
        task["rule"] = {
            "source": rule["source"],
            "pattern": rule["pattern"],
            "sha256": sha256_text(rule["text"]),
        }
    session_json["status"] = "running"
    session_json["config_hashes"]["rules"] = canonical_hash([layer for _source, layer in layers] + [system])
    session_json["config_hashes"]["file_filter"] = canonical_hash(file_filter or {})
    manifest["filter"] = file_filter
    previous_scheduling = manifest.get("scheduling", {})
    concurrency = previous_scheduling.get("concurrency", "auto")
    manifest["scheduling"] = scheduling_config(
        concurrency, manifest["tasks"], previous=previous_scheduling
    )
    next_action = scheduling_next_action(manifest)
    save_session(session_dir, session_json, manifest)
    return {
        "status": "running",
        "stale_tasks": stale,
        "interrupted_tasks": interrupted,
        "blocked_tasks": blocked,
        "removed_tasks": removed,
        "added_tasks": added,
        "next_action": next_action,
    }


def write_partial_result(
    session_dir: Path,
    session_json: dict[str, Any],
    manifest: dict[str, Any],
    reason: str,
) -> dict[str, Any]:
    counts = Counter(task.get("status", "unknown") for task in manifest.get("tasks", {}).values())
    confirmed: list[dict[str, Any]] = []
    for path in finding_files(session_dir):
        finding = read_json(path)
        if finding.get("state") == "confirmed" and all(
            key in finding for key in ("id", "task_id", "title", "claim", "severity", "category", "expected", "actual", "impact", "evidence", "location")
        ):
            confirmed.append(public_finding(finding))
    result = {
        "schema_version": SCHEMA_VERSION,
        "session_id": session_json["session_id"],
        "mode": session_json["mode"],
        "scope": session_json.get("scope", "changed-code"),
        "completion_status": "aborted",
        "assurance": "limited",
        "clean": False,
        "reason": reason,
        "session_epoch": int(session_json.get("session_epoch", 1)),
        "task_counts": dict(sorted(counts.items())),
        "verifier_backlog": verifier_backlog(session_dir),
        "confirmed_finding_count": len(confirmed),
        "findings": sorted(confirmed, key=finding_sort_key),
        "generated_at": now(),
    }
    fix_queue = write_fix_queue(session_dir, session_json["session_id"], result["findings"])
    result["fix_queue_path"] = "fix-queue.json"
    result["fix_queue_markdown_path"] = "fix-queue.md"
    atomic_json(session_dir / "result.partial.json", result)
    lines = [
        "# OCR Code Review Partial Result",
        "",
        "The review was aborted by an explicit user or operator request.",
        "",
        f"- Session: `{result['session_id']}`",
        f"- Mode: `{result['mode']}`",
        f"- Scope: `{result['scope']}`",
        f"- Reason: {reason}",
        f"- Session epoch: `{result['session_epoch']}`",
        f"- Confirmed findings retained: `{len(confirmed)}`",
        f"- Task states: `{json.dumps(result['task_counts'], ensure_ascii=False, sort_keys=True)}`",
        f"- Verifier backlog: `{json.dumps(result['verifier_backlog'], ensure_ascii=False, sort_keys=True)}`",
        "",
        "This is a partial result and must not be interpreted as a clean review.",
        "",
        "- Machine-readable partial result: `result.partial.json`",
        "- Confirmed issues prepared for later remediation: `fix-queue.json`",
        "- Scope and lifecycle manifest: `manifest.json`",
    ]
    atomic_text(session_dir / "_partial_summary.md", "\n".join(lines) + "\n")
    return result


def cmd_pause(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    reason = args.reason.strip()
    if not reason:
        raise ReviewError("INVALID_PAUSE_REASON", "Pause reason must not be empty")
    if session_json.get("status") == "paused":
        return {
            "session_id": session_json["session_id"],
            "status": "paused",
            "reason": session_json.get("pause", {}).get("reason", reason),
            "idempotent": True,
        }
    if session_json.get("status") not in {"running"}:
        raise ReviewError(
            "INVALID_SESSION_STATE",
            f"Cannot pause session while status is {session_json.get('status')!r}",
        )
    session_json["status"] = "paused"
    session_json["pause"] = {"reason": reason, "paused_at": now()}
    save_session(session_dir, session_json, manifest)
    return {
        "session_id": session_json["session_id"],
        "status": "paused",
        "reason": reason,
        "running_reviewers": sum(
            task.get("status") == "running" for task in manifest.get("tasks", {}).values()
        ),
        "next_action": "resume_or_abort_session",
    }


def cmd_abort(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    reason = args.reason.strip()
    if not reason:
        raise ReviewError("INVALID_ABORT_REASON", "Abort reason must not be empty")
    if session_json.get("status") == "aborted":
        return {
            "session_id": session_json["session_id"],
            "status": "aborted",
            "reason": session_json.get("abort", {}).get("reason", reason),
            "session_epoch": int(session_json.get("session_epoch", 1)),
            "partial_result": str(session_dir / "result.partial.json"),
            "partial_summary": str(session_dir / "_partial_summary.md"),
            "idempotent": True,
        }
    if session_json.get("status") not in {"running", "paused", "awaiting_start"}:
        raise ReviewError(
            "INVALID_SESSION_STATE",
            f"Cannot abort session while status is {session_json.get('status')!r}",
        )
    session_json["session_epoch"] = int(session_json.get("session_epoch", 1)) + 1
    aborted_at = now()
    for task in manifest.get("tasks", {}).values():
        task.pop("dispatch_lease", None)
        if task.get("status") == "running":
            task["status"] = "orphaned"
            task["orphaned_at"] = aborted_at
        elif task.get("status") in RUNNABLE_TASK_STATES:
            task["status"] = "aborted"
            task["aborted_at"] = aborted_at
    for path, finding in pending_verifier_records(session_dir):
        verification = finding.get("verification", {})
        verification.pop("lease", None)
        verification.pop("accepted_lease", None)
        if verification.get("status") == "running":
            verification["status"] = "orphaned"
            verification["orphaned_at"] = aborted_at
        finding["verification"] = verification
        atomic_json(path, finding)
    scheduling = manifest.get("scheduling", {})
    scheduling["probe_in_flight"] = None
    scheduling["launch_in_flight"] = None
    manifest["abort"] = {
        "reason": reason,
        "aborted_at": aborted_at,
        "session_epoch": session_json["session_epoch"],
    }
    session_json["status"] = "aborted"
    session_json["assurance"] = "limited"
    session_json["abort"] = manifest["abort"]
    save_session(session_dir, session_json, manifest)
    write_partial_result(session_dir, session_json, manifest, reason)
    return {
        "session_id": session_json["session_id"],
        "status": "aborted",
        "reason": reason,
        "session_epoch": session_json["session_epoch"],
        "partial_result": str(session_dir / "result.partial.json"),
        "partial_summary": str(session_dir / "_partial_summary.md"),
    }


def cmd_status(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    counts = Counter(task["status"] for task in manifest["tasks"].values())
    scheduling = manifest.get("scheduling", {})
    limit = int(scheduling.get("limit", max(1, len(manifest.get("tasks", {})))))
    minimum = int(scheduling.get("minimum", min(AUTO_CONCURRENCY_MINIMUM, len(manifest.get("tasks", {})))))
    desired = int(scheduling.get("desired_window", limit))
    observed = int(scheduling.get("observed_capacity", 0))
    running_reviewers = counts.get("running", 0)
    backlog = verifier_backlog(session_dir)
    running_verifiers = backlog["running"]
    accepted_concurrency = running_reviewers + running_verifiers
    runnable = (
        counts.get("pending", 0)
        + counts.get("interrupted", 0)
        + counts.get("checkpointed", 0)
        + counts.get("stale", 0)
    )
    available_slots = max(0, desired - accepted_concurrency)
    next_action = scheduling_next_action(manifest)
    in_flight = scheduling.get("probe_in_flight")
    launch_in_flight = scheduling.get("launch_in_flight")
    if session_json.get("status") == "aborted":
        next_action = "inspect_partial_result"
    elif session_json.get("status") == "awaiting_start":
        next_action = "present_launch_menu_and_wait_for_start"
    elif session_json.get("status") == "paused":
        next_action = "resume_or_abort_session"
    elif launch_in_flight:
        next_action = "report_orchestrated_launch"
    elif backlog["total"]:
        next_action = "drain_verifier_queue"
    complete_count = counts.get("complete", 0)
    total_active = sum(status != "removed" for status in (task.get("status") for task in manifest["tasks"].values()))
    summary = (
        f"{complete_count}/{total_active} complete | {running_reviewers} reviewing | "
        f"{backlog['total']} verifying | {runnable} pending"
    )
    result = {
        "session_id": session_json["session_id"],
        "status": session_json["status"],
        "assurance": session_json.get("assurance", "full"),
        "tasks": dict(sorted(counts.items())),
        "summary": summary,
        "verifier_backlog": backlog,
        "launch_menu": session_json.get("launch_menu") if session_json.get("status") == "awaiting_start" else None,
        "composition": session_json.get("composition") if session_json.get("status") == "awaiting_start" else None,
        "token_estimate": session_json.get("token_estimate") if session_json.get("status") == "awaiting_start" else None,
        "scheduling": {
            "minimum": minimum,
            "limit": limit,
            "desired_window": desired,
            "desired_concurrency": desired,
            "requested_concurrency": (
                int(launch_in_flight.get("requested_window", desired))
                if launch_in_flight
                else desired
            ),
            "accepted_concurrency": accepted_concurrency,
            "host_capacity": int(scheduling.get("host_capacity", observed)) or None,
            "observed_capacity": observed,
            "probe_state": scheduling.get("probe_state", "fixed"),
            "running": running_reviewers,
            "running_reviewers": running_reviewers,
            "running_verifiers": running_verifiers,
            "available_slots": available_slots,
            "probe_headroom": max(0, limit - desired),
            "runnable": runnable,
            "host_rejections": int(scheduling.get("host_rejections", 0)),
            "probe_in_flight": (
                {
                    "id": in_flight.get("id"),
                    "phase": in_flight.get("phase"),
                    "requested_window": in_flight.get("requested_window"),
                    "task_count": len(in_flight.get("task_ids", [])),
                }
                if in_flight
                else None
            ),
            "launch_in_flight": (
                {
                    "id": launch_in_flight.get("id"),
                    "phase": launch_in_flight.get("phase"),
                    "requested_concurrency": launch_in_flight.get("requested_window"),
                    "action_count": len(launch_in_flight.get("actions", [])),
                }
                if launch_in_flight
                else None
            ),
            "source": scheduling.get("source", "legacy"),
            "capacity_policy": scheduling.get("capacity_policy", "probe-host-and-refill"),
        },
        "next_action": next_action,
    }
    result["fleet_preflight"] = evaluate_fleet_preflight(session_dir, session_json, manifest)
    if not result["fleet_preflight"].get("ok"):
        result["next_action"] = result["fleet_preflight"]["next_action"]
    if getattr(args, "verbose", False):
        result["task_details"] = [
            {
                "task_id": task_id,
                "path": task.get("path"),
                "status": task.get("status"),
                "reviewer_context": task.get("reviewer_context"),
                "lease_id": task.get("dispatch_lease", {}).get("id"),
            }
            for task_id, task in sorted(
                manifest.get("tasks", {}).items(), key=lambda item: (item[1].get("path", ""), item[0])
            )
        ]
    return result


def cmd_heartbeat(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    status_payload = cmd_status(argparse.Namespace(session=args.session, verbose=False))
    terminal = sum(
        task.get("status") in TERMINAL_TASK_STATES | {"aborted", "orphaned"}
        for task in manifest.get("tasks", {}).values()
    )
    previous = session_json.get("heartbeat", {})
    previous_at = parse_timestamp(previous.get("emitted_at"))
    elapsed = (
        (datetime.now(timezone.utc) - previous_at).total_seconds()
        if previous_at
        else float("inf")
    )
    completed_delta = terminal - int(previous.get("terminal_count", 0))
    emit = bool(
        args.force
        or completed_delta >= int(args.every_completions)
        or elapsed >= int(args.every_seconds)
    )
    if emit:
        session_json["heartbeat"] = {
            "emitted_at": now(),
            "terminal_count": terminal,
            "summary": status_payload["summary"],
        }
        save_session(session_dir, session_json, manifest)
    return {
        "session_id": session_json["session_id"],
        "emit": emit,
        "summary": status_payload["summary"],
        "completed_since_last": completed_delta,
        "seconds_since_last": None if elapsed == float("inf") else int(elapsed),
    }


def finding_is_fresh(repo: Path, finding: dict[str, Any]) -> bool:
    location = finding.get("location", {})
    path = location.get("path", "")
    snippet = location.get("existing_code", "")
    if not path or not snippet:
        return False
    content = file_bytes(repo, path).decode("utf-8", errors="replace").replace("\r\n", "\n")
    try:
        _offset, start, end = exact_anchor(content, snippet)
    except ReviewError:
        return False
    return start == location.get("start_line") and end == location.get("end_line")


def normalize_semantic_key(value: str) -> str:
    """Normalize a reviewer hint for deterministic candidate bucketing only."""
    return re.sub(r"[\W_]+", "-", value.casefold(), flags=re.UNICODE).strip("-")


def dedup_candidate_files(session_dir: Path) -> list[Path]:
    root = session_dir / "dedup" / "candidates"
    if not root.exists():
        return []
    return sorted(root.glob("dedup-*.json"))


def dedup_card(finding: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": finding["id"],
        "task_id": finding["task_id"],
        "title": finding["title"],
        "claim": finding["claim"],
        "severity": finding["severity"],
        "category": finding["category"],
        "expected": finding["expected"],
        "actual": finding["actual"],
        "impact": finding["impact"],
        "impact_surface": finding.get("impact_surface", "runtime"),
        "reachability": finding.get("reachability", "unknown"),
        "current_input_reproducible": finding.get("current_input_reproducible", False),
        "cross_file": bool(finding.get("cross_file", finding.get("xref"))),
        "evidence": finding["evidence"],
        "location": finding["location"],
        "root_cause_key": finding.get("root_cause_key"),
        "fix_scope": finding.get("fix_scope"),
    }


def materialize_dedup_candidates(
    session_dir: Path, session_id: str, findings: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    buckets: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for finding in findings:
        raw_key = finding.get("root_cause_key")
        if not isinstance(raw_key, str) or not raw_key.strip():
            continue
        normalized_key = normalize_semantic_key(raw_key)
        if not normalized_key:
            continue
        buckets.setdefault((finding["category"], normalized_key), []).append(finding)

    current_ids: set[str] = set()
    candidates: list[dict[str, Any]] = []
    for (category, normalized_key), members in sorted(buckets.items()):
        if len(members) < 2:
            continue
        members = sorted(members, key=lambda item: item["id"])
        member_ids = [member["id"] for member in members]
        candidate_id = "dedup-" + sha256_text(
            f"{category}\0{normalized_key}\0" + "\0".join(member_ids)
        )[:16]
        fingerprint = canonical_hash(
            {
                "category": category,
                "normalized_root_cause_key": normalized_key,
                "finding_ids": member_ids,
            }
        )
        path = session_dir / "dedup" / "candidates" / f"{candidate_id}.json"
        previous = read_json(path) if path.exists() else None
        candidate = {
            "schema_version": SCHEMA_VERSION,
            "session_id": session_id,
            "id": candidate_id,
            "status": "pending",
            "category": category,
            "normalized_root_cause_key": normalized_key,
            "finding_ids": member_ids,
            "finding_cards": [dedup_card(member) for member in members],
            "fingerprint": fingerprint,
            "created_at": (
                previous.get("created_at")
                if isinstance(previous, dict) and previous.get("created_at")
                else now()
            ),
        }
        if (
            isinstance(previous, dict)
            and previous.get("fingerprint") == fingerprint
            and previous.get("status") == "verified"
            and isinstance(previous.get("decision"), dict)
        ):
            for field in ("status", "verifier_context", "decision", "decision_hash", "verified_at"):
                if field in previous:
                    candidate[field] = previous[field]
        atomic_json(path, candidate)
        current_ids.add(candidate_id)
        candidates.append(candidate)

    for path in dedup_candidate_files(session_dir):
        if path.stem in current_ids:
            continue
        obsolete = read_json(path)
        if obsolete.get("status") != "obsolete":
            obsolete["status"] = "obsolete"
            obsolete["obsolete_at"] = now()
            atomic_json(path, obsolete)
    return candidates


def terminal_review_tasks(manifest: dict[str, Any]) -> list[str]:
    return sorted(
        task_id
        for task_id, task in manifest["tasks"].items()
        if task.get("status") not in {"complete", "blocked", "removed"}
    )


def fresh_confirmed_findings(session_dir: Path, repo: Path) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for path in finding_files(session_dir):
        finding = read_json(path)
        if finding.get("state") == "confirmed" and finding_is_fresh(repo, finding):
            findings.append(finding)
    return findings


def cmd_dedup_plan(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, manifest = load_session(args.session)
    nonterminal = terminal_review_tasks(manifest)
    if nonterminal:
        raise ReviewError(
            "DEDUP_TASKS_PENDING",
            "Semantic duplicate candidates can only be frozen after all Primary Targets are terminal",
            "finish_primary_targets",
            task_ids=nonterminal,
        )
    findings = fresh_confirmed_findings(session_dir, Path(session_json["repo_root"]))
    candidates = materialize_dedup_candidates(
        session_dir, session_json["session_id"], findings
    )
    summaries = [
        {
            "id": candidate["id"],
            "status": candidate["status"],
            "finding_ids": candidate["finding_ids"],
            "candidate_file": f"dedup/candidates/{candidate['id']}.json",
        }
        for candidate in candidates
    ]
    pending = [item["id"] for item in summaries if item["status"] == "pending"]
    return {
        "candidate_count": len(summaries),
        "pending_count": len(pending),
        "candidates": summaries,
        "next_action": "dispatch_dedup_verifiers" if pending else "finalize",
    }


def validate_dedup_verifier_context(
    session_dir: Path,
    manifest: dict[str, Any],
    candidate_id: str,
    verifier_context: str,
) -> str:
    context = verifier_context.strip()
    if not context:
        raise ReviewError("INVALID_DEDUP_VERIFIER_CONTEXT", "verifier-context must not be empty")
    if context.lower() in {"controller", "current", "main", "root"}:
        raise ReviewError(
            "CONTROLLER_DEDUP_VERIFY_FORBIDDEN",
            "Semantic duplicate decisions require an independent verifier context",
            "dispatch_fresh_dedup_verifier",
        )
    for task_id, task in manifest["tasks"].items():
        if context in task.get("reviewer_contexts", []):
            raise ReviewError(
                "DEDUP_REVIEWER_CONTEXT_REUSED",
                "A Primary Target reviewer cannot verify semantic duplicate groups",
                "dispatch_fresh_dedup_verifier",
                existing_task=task_id,
            )
    for path in dedup_candidate_files(session_dir):
        candidate = read_json(path)
        if candidate.get("id") != candidate_id and candidate.get("verifier_context") == context:
            raise ReviewError(
                "DEDUP_VERIFIER_CONTEXT_REUSED",
                "One verifier context cannot decide multiple semantic duplicate candidates",
                "dispatch_fresh_dedup_verifier",
                existing_candidate=candidate.get("id"),
            )
    return context


def normalize_dedup_decision(payload: Any, candidate: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ReviewError("INVALID_DEDUP_DECISION", "Dedup decision must be a JSON object")
    groups = payload.get("groups")
    keep = payload.get("keep_separate_finding_ids")
    overall_reason = payload.get("reason")
    if not isinstance(groups, list) or not isinstance(keep, list):
        raise ReviewError(
            "INVALID_DEDUP_DECISION",
            "groups and keep_separate_finding_ids must be arrays",
            "resubmit_dedup_decision",
        )
    if not isinstance(overall_reason, str) or not overall_reason.strip():
        raise ReviewError(
            "INVALID_DEDUP_DECISION",
            "A non-empty overall reason is required",
            "resubmit_dedup_decision",
        )
    if not all(isinstance(item, str) and item for item in keep):
        raise ReviewError(
            "INVALID_DEDUP_PARTITION",
            "keep_separate_finding_ids must contain Finding IDs",
            "resubmit_complete_partition",
        )

    normalized_groups: list[dict[str, Any]] = []
    accounted: list[str] = list(keep)
    for group in groups:
        if not isinstance(group, dict):
            raise ReviewError("INVALID_DEDUP_DECISION", "Each group must be an object")
        canonical = group.get("canonical_finding_id")
        duplicates = group.get("duplicate_finding_ids")
        reason = group.get("reason")
        if (
            not isinstance(canonical, str)
            or not canonical
            or not isinstance(duplicates, list)
            or not duplicates
            or not all(isinstance(item, str) and item for item in duplicates)
            or not isinstance(reason, str)
            or not reason.strip()
        ):
            raise ReviewError(
                "INVALID_DEDUP_DECISION",
                "Each merge group requires a canonical ID, duplicate IDs and a reason",
                "resubmit_dedup_decision",
            )
        if not all(
            group.get(field) is True
            for field in ("same_root_cause", "same_failure_path", "single_fix_resolves_all")
        ):
            raise ReviewError(
                "DEDUP_PROOF_INCOMPLETE",
                "Merge requires same root cause, same failure path/impact and one fix resolving every occurrence",
                "keep_uncertain_findings_separate",
            )
        normalized_group = {
            "canonical_finding_id": canonical,
            "duplicate_finding_ids": sorted(duplicates),
            "reason": reason.strip(),
            "same_root_cause": True,
            "same_failure_path": True,
            "single_fix_resolves_all": True,
        }
        normalized_groups.append(normalized_group)
        accounted.extend([canonical, *duplicates])

    members = candidate["finding_ids"]
    if (
        len(accounted) != len(set(accounted))
        or set(accounted) != set(members)
    ):
        raise ReviewError(
            "INVALID_DEDUP_PARTITION",
            "Every candidate Finding must be accounted for exactly once",
            "resubmit_complete_partition",
            candidate_finding_ids=members,
            accounted_finding_ids=sorted(set(accounted)),
        )
    return {
        "groups": normalized_groups,
        "keep_separate_finding_ids": sorted(keep),
        "reason": overall_reason.strip(),
    }


def cmd_dedup_verify(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, _session_json, manifest = load_session(args.session)
    if not re.fullmatch(r"dedup-[0-9a-f]{16}", args.candidate):
        raise ReviewError("DEDUP_CANDIDATE_NOT_FOUND", f"Unknown candidate: {args.candidate}")
    path = session_dir / "dedup" / "candidates" / f"{args.candidate}.json"
    candidate = read_json(path)
    if candidate.get("status") != "pending":
        raise ReviewError(
            "INVALID_DEDUP_CANDIDATE_STATE",
            f"Candidate {args.candidate} is not awaiting verification",
            "choose_pending_dedup_candidate",
        )
    context = validate_dedup_verifier_context(
        session_dir, manifest, args.candidate, args.verifier_context
    )
    decision = normalize_dedup_decision(read_json(Path(args.input)), candidate)
    candidate["status"] = "verified"
    candidate["verifier_context"] = context
    candidate["decision"] = decision
    candidate["decision_hash"] = canonical_hash(decision)
    candidate["verified_at"] = now()
    atomic_json(path, candidate)
    duplicate_count = sum(len(group["duplicate_finding_ids"]) for group in decision["groups"])
    return {
        "candidate_id": args.candidate,
        "status": "verified",
        "merged_groups": len(decision["groups"]),
        "duplicate_count": duplicate_count,
        "next_action": "verify_next_candidate_or_finalize",
    }


def public_finding(finding: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": finding["id"],
        "task_id": finding["task_id"],
        "title": finding["title"],
        "claim": finding["claim"],
        "severity": finding["severity"],
        "category": finding["category"],
        "expected": finding["expected"],
        "actual": finding["actual"],
        "impact": finding["impact"],
        "delivery_impact": finding.get("delivery_impact"),
        "evidence": finding["evidence"],
        "location": finding["location"],
        "xref": finding.get("xref", []),
        "root_cause_key": finding.get("root_cause_key"),
        "fix_scope": finding.get("fix_scope"),
    }


def finding_sort_key(finding: dict[str, Any]) -> tuple[Any, ...]:
    return (
        ["critical", "high", "medium", "low"].index(finding["severity"]),
        finding["location"]["path"],
        finding["location"]["start_line"],
        finding["id"],
    )


def publish_deduplicated_findings(
    findings: list[dict[str, Any]], candidates: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int]:
    by_id = {finding["id"]: finding for finding in findings}
    duplicate_to_canonical: dict[str, str] = {}
    group_by_canonical: dict[str, dict[str, Any]] = {}
    dedup_groups: list[dict[str, Any]] = []
    for candidate in candidates:
        if candidate.get("status") != "verified":
            continue
        decision = candidate.get("decision", {})
        for group in decision.get("groups", []):
            canonical_id = group["canonical_finding_id"]
            duplicate_ids = sorted(group["duplicate_finding_ids"])
            if canonical_id not in by_id or any(item not in by_id for item in duplicate_ids):
                raise ReviewError(
                    "STALE_DEDUP_DECISION",
                    f"Candidate {candidate['id']} references a Finding outside the current result set",
                    "rerun_dedup_plan",
                )
            for duplicate_id in duplicate_ids:
                if duplicate_id in duplicate_to_canonical or duplicate_id in group_by_canonical:
                    raise ReviewError(
                        "INVALID_DEDUP_OVERLAP",
                        f"Finding {duplicate_id} belongs to multiple semantic merge groups",
                        "rerun_dedup_verifiers",
                    )
                duplicate_to_canonical[duplicate_id] = canonical_id
            if canonical_id in duplicate_to_canonical or canonical_id in group_by_canonical:
                raise ReviewError(
                    "INVALID_DEDUP_OVERLAP",
                    f"Finding {canonical_id} belongs to multiple semantic merge groups",
                    "rerun_dedup_verifiers",
                )
            public_group = {
                "candidate_id": candidate["id"],
                "canonical_finding_id": canonical_id,
                "duplicate_finding_ids": duplicate_ids,
                "reason": group["reason"],
            }
            group_by_canonical[canonical_id] = public_group
            dedup_groups.append(public_group)

    published: list[dict[str, Any]] = []
    for finding in sorted(findings, key=finding_sort_key):
        finding_id = finding["id"]
        if finding_id in duplicate_to_canonical:
            continue
        issue = dict(finding)
        group = group_by_canonical.get(finding_id)
        duplicate_ids = group["duplicate_finding_ids"] if group else []
        occurrence_ids = [finding_id, *duplicate_ids]
        issue["duplicate_finding_ids"] = duplicate_ids
        issue["severity"] = min(
            (by_id[occurrence_id]["severity"] for occurrence_id in occurrence_ids),
            key=("critical", "high", "medium", "low").index,
        )
        issue["occurrences"] = [
            {
                "finding_id": occurrence_id,
                "task_id": by_id[occurrence_id]["task_id"],
                "location": by_id[occurrence_id]["location"],
            }
            for occurrence_id in sorted(
                occurrence_ids,
                key=lambda item: (
                    by_id[item]["location"]["path"],
                    by_id[item]["location"]["start_line"],
                    item,
                ),
            )
        ]
        if group:
            issue["dedup_reason"] = group["reason"]
            issue["dedup_candidate_id"] = group["candidate_id"]
        published.append(issue)
    dedup_groups.sort(key=lambda item: (item["canonical_finding_id"], item["candidate_id"]))
    return published, dedup_groups, len(duplicate_to_canonical)


def markdown_value(value: Any) -> str:
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)


def markdown_location(location: dict[str, Any]) -> str:
    start = location["start_line"]
    end = location["end_line"]
    suffix = str(start) if start == end else f"{start}-{end}"
    return f"{location['path']}:{suffix}"


def markdown_code_block(value: str) -> str:
    longest_run = max((len(match.group(0)) for match in re.finditer(r"`+", value)), default=0)
    fence = "`" * max(3, longest_run + 1)
    closing_separator = "" if value.endswith("\n") else "\n"
    return f"{fence}\n{value}{closing_separator}{fence}"


def render_findings_markdown(findings: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for finding in findings:
        loc = finding["location"]
        lines.extend([
            f"### {finding['id']} · {finding['severity']} · {finding['title']}",
            "",
            f"- Category: `{finding['category']}`",
            f"- Location: `{markdown_location(loc)}`",
            f"- Impact surface: `{finding.get('impact_surface', 'runtime')}`",
            f"- Reachability: `{finding.get('reachability', 'unknown')}`",
            f"- Current input reproducible: `{str(finding.get('current_input_reproducible', False)).lower()}`",
            f"- Cross-file: `{str(bool(finding.get('cross_file', finding.get('xref')))).lower()}`",
            f"- Occurrences: `{len(finding.get('occurrences', [])) or 1}`",
            "",
            "**Claim**",
            "",
            finding["claim"],
            "",
            "**Expected**",
            "",
            finding["expected"],
            "",
            "**Actual**",
            "",
            finding["actual"],
            "",
            "**Impact**",
            "",
            finding["impact"],
            "",
        ])
        if finding.get("delivery_impact"):
            lines.extend([
                "**Delivery impact**",
                "",
                str(finding["delivery_impact"]),
                "",
            ])
        lines.extend(["**Evidence**", ""])
        lines.extend(f"- {markdown_value(item)}" for item in finding.get("evidence", []))
        lines.append("")
        if loc.get("existing_code"):
            lines.extend([
                "**Existing code anchor**",
                "",
                markdown_code_block(loc["existing_code"]),
                "",
                f"- Anchor fingerprint: `{loc.get('fingerprint', 'not recorded')}`",
                "",
            ])
        if finding.get("root_cause_key") or finding.get("fix_scope"):
            lines.extend(["**Root cause and fix scope**", ""])
            if finding.get("root_cause_key"):
                lines.append(f"- Root cause key: `{finding['root_cause_key']}`")
            if finding.get("fix_scope"):
                lines.append(f"- Fix scope: {finding['fix_scope']}")
            lines.append("")
        if finding.get("occurrences"):
            lines.extend(["**Occurrences**", ""])
            for occurrence in finding["occurrences"]:
                lines.append(
                    f"- `{markdown_location(occurrence['location'])}` · "
                    f"`{occurrence['finding_id']}`"
                )
            lines.append("")
        if finding.get("duplicate_finding_ids"):
            lines.extend([
                "**Verified semantic deduplication**",
                "",
                f"- Folded duplicates: `{len(finding['duplicate_finding_ids'])}`",
                f"- Reason: {finding.get('dedup_reason', 'not recorded')}",
                "",
            ])
        if finding.get("xref"):
            lines.extend(["**Cross references**", ""])
            lines.extend(f"- {markdown_value(item)}" for item in finding["xref"])
            lines.append("")
    return "\n".join(lines)


def render_finding_shard(part: int, findings: list[dict[str, Any]]) -> str:
    body = render_findings_markdown(findings)
    return "\n".join([
        f"# OCR Code Review Findings · Part {part:04d}",
        "",
        f"- Findings: `{len(findings)}`",
        "",
        body,
    ])


def render_markdown(result: dict[str, Any]) -> str:
    lines = ["# OCR Code Review Result", "", result["conclusion"], ""]
    lines.extend([
        "## Run summary",
        "",
        "| Item | Value |",
        "| --- | --- |",
        f"| Session | `{result['session_id']}` |",
        f"| Mode | `{result['mode']}` |",
        f"| Scope | `{result.get('scope', 'changed-code')}` |",
        f"| Profile | `{result['profile']}` |",
        f"| Completion | `{result['completion_status']}` |",
        f"| Assurance | `{result['assurance']}` |",
        f"| Clean | `{str(result['clean']).lower()}` |",
        f"| Output mode | `{result['output_mode']}` |",
        f"| Generated at | `{result['generated_at']}` |",
        "",
        "## Coverage",
        "",
        "| Item | Value |",
        "| --- | ---: |",
        f"| Files considered at init | `{result['coverage']['scope_candidates_at_init']}` |",
        f"| Primary Targets at init | `{result['coverage']['primary_targets_at_init']}` |",
        f"| Excluded by filters at init | `{result['coverage']['excluded_at_init']}` |",
        f"| Current Manifest tasks | `{result['coverage']['total_tasks']}` |",
        f"| Active Primary Targets | `{result['coverage']['active_tasks']}` |",
        f"| Complete | `{result['coverage']['complete_tasks']}` |",
        f"| Blocked | `{result['coverage']['blocked_tasks']}` |",
        f"| Removed since init | `{result['coverage']['removed_tasks']}` |",
        "",
        "## Findings summary",
        "",
        "| Metric | Count |",
        "| --- | ---: |",
        f"| Confirmed raw Findings | `{result['confirmed_finding_count']}` |",
        f"| Published independent issues | `{result['published_issue_count']}` |",
        f"| Verified duplicates | `{result['duplicate_count']}` |",
        f"| Verified dedup groups | `{result['dedup_group_count']}` |",
        "",
        "## Severity",
        "",
        "| Severity | Published | Confirmed raw |",
        "| --- | ---: | ---: |",
    ])
    for severity in ("critical", "high", "medium", "low"):
        lines.append(
            f"| {severity.title()} | `{result['severity_counts'][severity]}` | "
            f"`{result['confirmed_severity_counts'][severity]}` |"
        )
    lines.append("")
    if result.get("dedup_groups"):
        lines.extend(["## Verified semantic duplicates", ""])
        for group in result["dedup_groups"]:
            duplicates = ", ".join(group["duplicate_finding_ids"])
            lines.append(
                f"- `{group['canonical_finding_id']}` folds `{duplicates}`: {group['reason']}"
            )
        if not result.get("dedup_groups_complete", True):
            lines.append("- Additional verified groups remain in `dedup/candidates/`.")
        lines.append("")
    if result["output_mode"] == "inline" and result["findings"]:
        lines.extend(["## Findings", "", render_findings_markdown(result["findings"])])
    elif result["output_mode"] == "sharded" and result.get("finding_preview"):
        lines.extend(["## Highest-priority preview", ""])
        for finding in result["finding_preview"]:
            lines.append(
                f"- `{finding['severity']}` · {finding['title']} · "
                f"`{markdown_location(finding['location'])}` · `{finding['id']}`"
            )
        lines.append("")
    elif not result["findings"]:
        lines.extend(["## Findings", "", "No confirmed Findings were published.", ""])
    if result["finding_shards"]:
        lines.extend(["## Finding shards", ""])
        for shard in result["finding_shards"]:
            counts = ", ".join(
                f"{severity}={count}"
                for severity, count in shard["severity_counts"].items()
                if count
            )
            oversized = " · oversized single Finding" if shard["oversized"] else ""
            lines.append(
                f"- [{shard['markdown_path']}]({shard['markdown_path']}) · "
                f"{shard['count']} findings · {counts}{oversized}"
            )
        lines.append("")
    incomplete_items = [
        ("Pending verifier", result.get("pending_verifier", [])),
        ("Stale Findings", result.get("stale_findings", [])),
        ("Stale tasks", result.get("stale_tasks", [])),
        ("Blocked tasks", result.get("blocked_tasks", [])),
    ]
    if any(items for _label, items in incomplete_items):
        lines.extend(["## Incomplete or blocked state", ""])
        for label, items in incomplete_items:
            if items:
                lines.append(f"- {label}: " + ", ".join(f"`{item}`" for item in items))
        lines.append("")
    if result["blind_spots"]:
        lines.extend(["## Coverage limits", ""])
        for blind in result["blind_spots"]:
            lines.append(f"- {blind.get('area', 'unknown')}: {blind.get('reason', 'not specified')}")
        lines.append("")
    else:
        lines.extend([
            "## Coverage limits",
            "",
            "No material Blind Spots were recorded.",
            "",
        ])
    lines.extend([
        "## Audit artifacts",
        "",
        "- Machine-readable report: `result.json`",
        "- Scope and lifecycle manifest: `manifest.json`",
        f"- Raw Findings: `{result['raw_findings_path']}`",
        f"- Semantic dedup decisions: `{result['dedup_candidates_path']}`",
        "- Remediation export: `fix-queue.json` / `fix-queue.md`",
    ])
    if result["finding_shards"]:
        lines.append("- Complete published issues: `results/findings-NNNN.json/.md`")
    lines.append("")
    return "\n".join(lines)


def compact_finding_preview(finding: dict[str, Any]) -> dict[str, Any]:
    location = finding["location"]
    title = finding["title"]
    if len(title) > 240:
        title = title[:237] + "..."
    return {
        "id": finding["id"],
        "severity": finding["severity"],
        "category": finding["category"],
        "title": title,
        "duplicate_count": len(finding.get("duplicate_finding_ids", [])),
        "location": {
            "path": location["path"],
            "start_line": location["start_line"],
            "end_line": location["end_line"],
        },
    }


def finding_shard_document(
    session_id: str, part: int, findings: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "session_id": session_id,
        "part": part,
        "finding_count": len(findings),
        "findings": findings,
    }


def shard_payload_sizes(
    session_id: str, part: int, findings: list[dict[str, Any]]
) -> tuple[int, int]:
    json_size = len(json_text(finding_shard_document(session_id, part, findings)).encode("utf-8"))
    markdown_size = len(render_finding_shard(part, findings).encode("utf-8"))
    return json_size, markdown_size


def partition_findings(
    session_id: str, findings: list[dict[str, Any]]
) -> list[list[dict[str, Any]]]:
    parts: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    for finding in findings:
        candidate = [*current, finding]
        part = len(parts) + 1
        json_size, markdown_size = shard_payload_sizes(session_id, part, candidate)
        if current and max(json_size, markdown_size) > RESULT_SHARD_MAX_BYTES:
            parts.append(current)
            current = [finding]
        else:
            current = candidate
    if current:
        parts.append(current)
    return parts


def remove_stale_result_shards(results_dir: Path, keep: set[str]) -> None:
    if not results_dir.exists():
        return
    for pattern in ("findings-*.json", "findings-*.md"):
        for path in results_dir.glob(pattern):
            if path.name not in keep:
                path.unlink()


def write_finding_shards(
    session_dir: Path, session_id: str, findings: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    results_dir = session_dir / "results"
    manifests: list[dict[str, Any]] = []
    keep: set[str] = set()
    for part, shard_findings in enumerate(partition_findings(session_id, findings), start=1):
        json_name = f"findings-{part:04d}.json"
        markdown_name = f"findings-{part:04d}.md"
        json_path = results_dir / json_name
        markdown_path = results_dir / markdown_name
        document = finding_shard_document(session_id, part, shard_findings)
        markdown = render_finding_shard(part, shard_findings)
        atomic_json(json_path, document)
        atomic_text(markdown_path, markdown)
        json_bytes = json_path.read_bytes()
        markdown_bytes = markdown_path.read_bytes()
        severity_counts = Counter(finding["severity"] for finding in shard_findings)
        manifests.append({
            "part": part,
            "json_path": f"results/{json_name}",
            "markdown_path": f"results/{markdown_name}",
            "count": len(shard_findings),
            "json_bytes": len(json_bytes),
            "markdown_bytes": len(markdown_bytes),
            "sha256": sha256_bytes(json_bytes),
            "markdown_sha256": sha256_bytes(markdown_bytes),
            "first_finding_id": shard_findings[0]["id"],
            "last_finding_id": shard_findings[-1]["id"],
            "severity_counts": {
                severity: severity_counts.get(severity, 0)
                for severity in ("critical", "high", "medium", "low")
            },
            "oversized": max(len(json_bytes), len(markdown_bytes)) > RESULT_SHARD_MAX_BYTES,
        })
        keep.update({json_name, markdown_name})
    remove_stale_result_shards(results_dir, keep)
    return manifests


def write_fix_queue(
    session_dir: Path, session_id: str, findings: list[dict[str, Any]]
) -> dict[str, Any]:
    """Export verified issues as data for a later, explicitly authorized fix pass."""
    items = [
        {
            "id": finding["id"],
            "severity": finding["severity"],
            "category": finding["category"],
            "impact_surface": finding.get("impact_surface", "runtime"),
            "path": finding["location"]["path"],
            "start_line": finding["location"]["start_line"],
            "end_line": finding["location"]["end_line"],
            "claim": finding["claim"],
            "fix_scope": finding.get("fix_scope", ""),
            "dependencies": finding.get("xref", []),
            "status": "pending",
        }
        for finding in findings
    ]
    queue = {
        "schema_version": SCHEMA_VERSION,
        "session_id": session_id,
        "count": len(items),
        "items": items,
        "generated_at": now(),
    }
    json_path = session_dir / "fix-queue.json"
    markdown_path = session_dir / "fix-queue.md"
    atomic_json(json_path, queue)
    lines = [
        "# OCR Code Review Fix Queue",
        "",
        "This file is an export only. The review did not modify source code.",
        "",
        f"- Session: `{session_id}`",
        f"- Pending issues: `{len(items)}`",
        "",
    ]
    for item in items:
        location = f"{item['path']}:{item['start_line']}"
        if item["end_line"] != item["start_line"]:
            location += f"-{item['end_line']}"
        lines.extend([
            f"## {item['id']} · {item['severity']}",
            "",
            f"- Location: `{location}`",
            f"- Category: `{item['category']}`",
            f"- Impact surface: `{item['impact_surface']}`",
            f"- Status: `{item['status']}`",
            "",
            item["claim"],
            "",
        ])
        if item["fix_scope"]:
            lines.extend([f"Fix scope: {item['fix_scope']}", ""])
    atomic_text(markdown_path, "\n".join(lines))
    return {
        "json": str(json_path),
        "markdown": str(markdown_path),
        "count": len(items),
    }


def published_findings_from_result(session_dir: Path) -> list[dict[str, Any]]:
    result_path = session_dir / "result.json"
    if not result_path.is_file():
        result_path = session_dir / "result.partial.json"
    result = read_json(result_path)
    if result.get("findings_complete", True):
        return list(result.get("findings", []))
    findings: list[dict[str, Any]] = []
    for shard in result.get("finding_shards", []):
        shard_path = session_dir / shard["json_path"]
        findings.extend(read_json(shard_path).get("findings", []))
    return findings


def cmd_export_fix_queue(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, _manifest = load_session(args.session)
    findings = published_findings_from_result(session_dir)
    exported = write_fix_queue(session_dir, session_json["session_id"], findings)
    return {
        "session_id": session_json["session_id"],
        "count": exported["count"],
        "fix_queue_json": exported["json"],
        "fix_queue_markdown": exported["markdown"],
        "source_code_modified": False,
    }


def cmd_finalize(args: argparse.Namespace) -> dict[str, Any]:
    session_dir, session_json, _manifest = load_session(args.session)
    if session_json.get("fleet_shard_id"):
        reconciled = {
            "status": session_json.get("status", "running"),
            "stale_tasks": [],
            "interrupted_tasks": [],
            "blocked_tasks": [],
            "removed_tasks": [],
            "added_tasks": [],
            "next_action": "finalize",
        }
    else:
        reconciled = cmd_resume(argparse.Namespace(session=args.session, rule=None))
    session_dir, session_json, manifest = load_session(args.session)
    repo = Path(session_json["repo_root"])
    stale_tasks = reconciled["stale_tasks"]
    active_tasks = [task for task in manifest["tasks"].values() if task["status"] != "removed"]
    task_states = {task["status"] for task in active_tasks}
    complete = bool(active_tasks) and task_states == {"complete"}
    blind_spots: list[dict[str, Any]] = []
    for task in active_tasks:
        blind_spots.extend(task.get("coverage", {}).get("blind_spots", []))
        if task.get("status") == "blocked" and task.get("blocking_blind_spot"):
            blind_spots.append(task["blocking_blind_spot"])
    blocked_tasks = sorted(task["id"] for task in active_tasks if task.get("status") == "blocked")
    material_blind = any(item.get("material", True) for item in blind_spots)

    confirmed: list[dict[str, Any]] = []
    stale_findings: list[str] = []
    pending_verifier: list[str] = []
    for path in finding_files(session_dir):
        finding = read_json(path)
        if (
            finding.get("state") == "candidate"
            and finding.get("verification", {}).get("required")
            and finding.get("verification", {}).get("status") in {"pending", "running"}
        ):
            pending_verifier.append(finding.get("id", path.stem))
        if finding.get("state") == "confirmed":
            if finding_is_fresh(repo, finding):
                confirmed.append(finding)
            else:
                stale_findings.append(finding["id"])
    if pending_verifier:
        raise ReviewError(
            "VERIFIER_PENDING",
            "Independent verification must finish before authoritative publication",
            "drain_verifier_queue",
            finding_ids=sorted(pending_verifier),
        )
    if stale_findings:
        complete = False
    dedup_candidates: list[dict[str, Any]] = []
    if not pending_verifier and not stale_findings and not terminal_review_tasks(manifest):
        dedup_candidates = materialize_dedup_candidates(
            session_dir, session_json["session_id"], confirmed
        )
        pending_dedup = sorted(
            candidate["id"]
            for candidate in dedup_candidates
            if candidate.get("status") == "pending"
        )
        if pending_dedup:
            raise ReviewError(
                "DEDUP_VERIFIER_PENDING",
                "Semantic duplicate candidates require independent verification before publication",
                "run_dedup_verifiers",
                candidate_ids=pending_dedup,
            )
    completion_status = "complete" if complete else "partial"
    assurance = "limited" if material_blind else "full"
    clean = complete and not confirmed and not material_blind
    if clean:
        conclusion = "在当前范围和 OCR 规则下，没有发现已确认问题。"
    elif blocked_tasks:
        conclusion = f"审查已完成可执行范围，但有 {len(blocked_tasks)} 个 Primary Target 多次重试后仍被阻塞；不能给出 clean 结论。"
    elif not complete:
        conclusion = "审查尚未完整结束，不能给出 clean 结论。"
    elif material_blind:
        conclusion = "审查任务已完成，但存在实质性覆盖限制，不能给出 clean 结论。"
    else:
        conclusion = f"审查完成，共发现 {len(confirmed)} 个已确认问题。"

    confirmed_findings = [public_finding(finding) for finding in confirmed]
    public_findings, dedup_groups, duplicate_count = publish_deduplicated_findings(
        confirmed_findings, dedup_candidates
    )
    if complete and not material_blind and duplicate_count:
        conclusion = (
            f"审查完成，共发现 {len(confirmed_findings)} 个已确认 Finding，"
            f"经独立验证后归并为 {len(public_findings)} 个独立问题。"
        )
    total_severity_counts = Counter(finding["severity"] for finding in public_findings)
    confirmed_severity_counts = Counter(
        finding["severity"] for finding in confirmed_findings
    )
    base_result = {
        "schema_version": SCHEMA_VERSION,
        "session_id": session_json["session_id"],
        "mode": session_json["mode"],
        "scope": session_json.get("scope", "changed-code"),
        "profile": session_json["profile"],
        "composition": session_json.get("composition", manifest.get("composition", {})),
        "token_estimate": session_json.get("token_estimate", manifest.get("token_estimate", {})),
        "completion_status": completion_status,
        "assurance": assurance,
        "clean": clean,
        "conclusion": conclusion,
        "severity_counts": {
            severity: total_severity_counts.get(severity, 0)
            for severity in ("critical", "high", "medium", "low")
        },
        "confirmed_severity_counts": {
            severity: confirmed_severity_counts.get(severity, 0)
            for severity in ("critical", "high", "medium", "low")
        },
        "confirmed_finding_count": len(confirmed_findings),
        "published_issue_count": len(public_findings),
        "duplicate_count": duplicate_count,
        "dedup_groups": dedup_groups,
        "dedup_group_count": len(dedup_groups),
        "dedup_groups_complete": True,
        "raw_findings_path": "findings/",
        "dedup_candidates_path": "dedup/candidates/",
        "blind_spots": blind_spots,
        "pending_verifier": pending_verifier,
        "stale_findings": stale_findings,
        "stale_tasks": stale_tasks,
        "blocked_tasks": blocked_tasks,
        "coverage": {
            "scope_candidates_at_init": int(
                manifest.get(
                    "scope_candidates_at_init",
                    len(manifest["tasks"]) + int(manifest.get("excluded_count", 0)),
                )
            ),
            "primary_targets_at_init": int(
                manifest.get("primary_targets_at_init", len(manifest["tasks"]))
            ),
            "total_tasks": len(manifest["tasks"]),
            "active_tasks": len(active_tasks),
            "excluded_at_init": int(manifest.get("excluded_count", 0)),
            "removed_tasks": len(manifest["tasks"]) - len(active_tasks),
            "complete_tasks": sum(task["status"] == "complete" for task in active_tasks),
            "blocked_tasks": len(blocked_tasks),
        },
        "generated_at": now(),
    }
    inline_result = {
        **base_result,
        "output_mode": "inline",
        "finding_count": len(public_findings),
        "findings_complete": True,
        "findings": public_findings,
        "finding_preview": [],
        "finding_shards": [],
    }
    inline_markdown = render_markdown(inline_result)
    inline_size = max(
        len(json_text(inline_result).encode("utf-8")),
        len(inline_markdown.encode("utf-8")),
    )
    if inline_size <= RESULT_SHARD_MAX_BYTES:
        result = inline_result
        result_markdown = inline_markdown
        remove_stale_result_shards(session_dir / "results", set())
    else:
        finding_shards = write_finding_shards(
            session_dir, session_json["session_id"], public_findings
        )
        result = {
            **base_result,
            "output_mode": "sharded",
            "finding_count": len(public_findings),
            "findings_complete": False,
            "findings": [],
            "finding_preview": [
                compact_finding_preview(finding)
                for finding in public_findings[:RESULT_PREVIEW_LIMIT]
            ],
            "finding_shards": finding_shards,
            "dedup_groups": dedup_groups[:RESULT_PREVIEW_LIMIT],
            "dedup_groups_complete": len(dedup_groups) <= RESULT_PREVIEW_LIMIT,
        }
        result_markdown = render_markdown(result)
    fix_queue = write_fix_queue(session_dir, session_json["session_id"], public_findings)
    result["fix_queue_path"] = "fix-queue.json"
    result["fix_queue_markdown_path"] = "fix-queue.md"
    atomic_json(session_dir / "result.json", result)
    atomic_text(session_dir / "result.md", result_markdown)
    session_json["status"] = completion_status
    session_json["assurance"] = assurance
    fleet_cleanup: dict[str, Any] | None = None
    if (
        not session_json.get("fleet_shard_id")
        and fleet_plan_path(session_dir).is_file()
        and not getattr(args, "no_fleet_cleanup", False)
    ):
        fleet = session_json.get("fleet") or {}
        if fleet.get("status") in {"merged", "partial-merged"} and not fleet.get("cleanup", {}).get(
            "done"
        ):
            try:
                plan = load_fleet_plan(session_dir)
                fleet_cleanup = perform_fleet_cleanup(
                    session_dir,
                    session_json,
                    plan,
                    allow_partial=fleet.get("status") == "partial-merged",
                )
            except ReviewError as exc:
                fleet_cleanup = {
                    "done": False,
                    "skipped": True,
                    "reason": exc.payload.get("error"),
                    "message": str(exc),
                }
    save_session(session_dir, session_json, manifest)
    response = {
        **result,
        "result_json": str(session_dir / "result.json"),
        "result_markdown": str(session_dir / "result.md"),
        "fix_queue_json": fix_queue["json"],
        "fix_queue_markdown": fix_queue["markdown"],
    }
    if fleet_cleanup is not None:
        response["fleet_cleanup"] = fleet_cleanup
    return response


def add_session_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--session", required=True, help="Session directory returned by init")


def build_parser() -> argparse.ArgumentParser:
    parser = JsonArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    init = sub.add_parser("init", help="Create a review or scan session")
    init.add_argument("--repo", default=".")
    init.add_argument("--mode", choices=["review", "scan"], default=None)
    init.add_argument("--base")
    init.add_argument("--head", default="HEAD")
    init.add_argument("--workspace", action="store_true", help="Review current tracked and untracked workspace changes since --base")
    init.add_argument("--profile", choices=["correctness", "production-readiness"], default="correctness")
    init.add_argument("--rule")
    init.add_argument("--requirement", default="")
    init.add_argument("--session-id")
    init.add_argument("--state-root")
    init.add_argument("--concurrency", default=DEFAULT_CONCURRENCY)
    init.add_argument("--scope", choices=["runtime-code", "apps-packages", "full"], default="runtime-code")
    init.add_argument("--token-budget", type=int, default=0, help="warning-only aggregate token estimate budget")
    init.add_argument("--segment-threshold", type=int, default=256 * 1024)
    init.add_argument(
        "--yes",
        action="store_true",
        help="Skip launch menu confirmation and start immediately (CI / explicit go-ahead)",
    )
    init.add_argument(
        "--allow-fleet-worktree-init",
        action="store_true",
        help="Test-only escape hatch: allow init inside an ocr-fleet worktree",
    )
    init.set_defaults(func=cmd_init)

    confirm_start = sub.add_parser(
        "start",
        help="Confirm launch menu selection and allow orchestrate-tick to dispatch subagents",
    )
    add_session_argument(confirm_start)
    confirm_start.add_argument("--concurrency", help="Override concurrency: max|auto|N")
    confirm_start.add_argument("--profile", choices=["correctness", "production-readiness"])
    confirm_start.add_argument("--choice", help="Selected launch_menu option id for audit")
    confirm_start.set_defaults(func=cmd_start)

    tick = sub.add_parser(
        "orchestrate-tick", help="Actively request an adaptive verifier-first launch batch"
    )
    add_session_argument(tick)
    tick.add_argument(
        "--available-slots",
        type=int,
        help="deprecated compatibility hint; omit to probe and learn real host capacity",
    )
    tick.add_argument("--lease-seconds", type=int, default=DEFAULT_LEASE_SECONDS)
    tick.set_defaults(func=cmd_orchestrate_tick)

    launch_report = sub.add_parser(
        "orchestrate-report",
        help="Report which actively requested reviewer/verifier contexts the host accepted",
    )
    add_session_argument(launch_report)
    launch_report.add_argument("--launch", required=True)
    launch_report.add_argument("--input", required=True)
    launch_report.set_defaults(func=cmd_orchestrate_report)

    dispatch = sub.add_parser(
        "dispatch-next", help="Reserve the next adaptive reviewer launch batch"
    )
    add_session_argument(dispatch)
    dispatch.set_defaults(func=cmd_dispatch_next)

    capacity = sub.add_parser(
        "capacity-report", help="Record how many reviewer contexts the host accepted"
    )
    add_session_argument(capacity)
    capacity.add_argument("--probe", required=True)
    capacity.add_argument("--reason", default="")
    capacity.set_defaults(func=cmd_capacity_report)

    start = sub.add_parser("task-start", help="Mark one Primary Target task running")
    add_session_argument(start)
    start.add_argument("--task", required=True)
    start.add_argument("--reviewer-context", required=True)
    start.add_argument("--lease")
    start.set_defaults(func=cmd_task_start)

    fail = sub.add_parser("task-fail", help="Record one failed reviewer attempt and apply retry policy")
    add_session_argument(fail)
    fail.add_argument("--task", required=True)
    fail.add_argument("--reason", required=True)
    fail.set_defaults(func=cmd_task_fail)

    plan = sub.add_parser("task-plan", help="Attach signal-routed review dimensions to one task")
    add_session_argument(plan)
    plan.add_argument("--task", required=True)
    plan.add_argument("--input", required=True)
    plan.set_defaults(func=cmd_task_plan)

    submit = sub.add_parser("submit", help="Validate and store one model-proposed Finding")
    add_session_argument(submit)
    submit.add_argument("--task", required=True)
    submit.add_argument("--input", required=True)
    submit.set_defaults(func=cmd_submit)

    verify = sub.add_parser("verify", help="Record an independent verifier decision")
    add_session_argument(verify)
    verify.add_argument("--finding", required=True)
    verify.add_argument("--decision", choices=["confirm", "reject"], required=True)
    verify.add_argument("--reason", required=True)
    verify.add_argument("--lease")
    verify.add_argument("--verifier-context")
    verify.set_defaults(func=cmd_verify)

    verifier_start = sub.add_parser(
        "verifier-start", help="Acknowledge one accepted verifier launch lease"
    )
    add_session_argument(verifier_start)
    verifier_start.add_argument("--finding", required=True)
    verifier_start.add_argument("--verifier-context", required=True)
    verifier_start.add_argument("--lease", required=True)
    verifier_start.set_defaults(func=cmd_verifier_start)

    dedup_plan = sub.add_parser("dedup-plan", help="Freeze deterministic semantic duplicate candidate groups")
    add_session_argument(dedup_plan)
    dedup_plan.set_defaults(func=cmd_dedup_plan)

    dedup_verify = sub.add_parser("dedup-verify", help="Record an independent semantic duplicate decision")
    add_session_argument(dedup_verify)
    dedup_verify.add_argument("--candidate", required=True)
    dedup_verify.add_argument("--input", required=True)
    dedup_verify.add_argument("--verifier-context", required=True)
    dedup_verify.set_defaults(func=cmd_dedup_verify)

    checkpoint = sub.add_parser("checkpoint", help="Save continuation state for a large or interrupted task")
    add_session_argument(checkpoint)
    checkpoint.add_argument("--task", required=True)
    checkpoint.add_argument("--input", required=True)
    checkpoint.set_defaults(func=cmd_checkpoint)

    complete = sub.add_parser("complete", help="Equivalent of OCR task_done with coverage gates")
    add_session_argument(complete)
    complete.add_argument("--task", required=True)
    complete.add_argument("--coverage", required=True)
    complete.set_defaults(func=cmd_complete)

    card = sub.add_parser("stack-card", help="Store the enriched repository capability profile")
    add_session_argument(card)
    card.add_argument("--input", required=True)
    card.set_defaults(func=cmd_stack_card)

    resume = sub.add_parser("resume", help="Revalidate task fingerprints and recover interrupted work")
    add_session_argument(resume)
    resume.add_argument("--rule")
    resume.set_defaults(func=cmd_resume)

    pause = sub.add_parser("pause", help="Stop new dispatch while allowing in-flight tasks to drain")
    add_session_argument(pause)
    pause.add_argument("--reason", required=True)
    pause.set_defaults(func=cmd_pause)

    abort = sub.add_parser("abort", help="Hard-stop a session and write an authoritative partial result")
    add_session_argument(abort)
    abort.add_argument("--reason", required=True)
    abort.set_defaults(func=cmd_abort)

    status = sub.add_parser("status", help="Show machine-owned lifecycle state")
    add_session_argument(status)
    status.add_argument("--verbose", action="store_true")
    status.set_defaults(func=cmd_status)

    heartbeat = sub.add_parser("heartbeat", help="Emit a rate-limited compact progress heartbeat")
    add_session_argument(heartbeat)
    heartbeat.add_argument("--every-completions", type=int, default=50)
    heartbeat.add_argument("--every-seconds", type=int, default=300)
    heartbeat.add_argument("--force", action="store_true")
    heartbeat.set_defaults(func=cmd_heartbeat)

    finalize = sub.add_parser("finalize", help="Freshness-check and render authoritative output")
    add_session_argument(finalize)
    finalize.add_argument(
        "--no-fleet-cleanup",
        action="store_true",
        help="Skip automatic removal of fleet scan worktrees after finalize",
    )
    finalize.set_defaults(func=cmd_finalize)

    export_fix_queue = sub.add_parser(
        "export-fix-queue", help="Re-export confirmed published issues for a later fix pass"
    )
    add_session_argument(export_fix_queue)
    export_fix_queue.set_defaults(func=cmd_export_fix_queue)

    fleet_plan = sub.add_parser(
        "fleet-plan",
        help="Partition runnable Primary Targets into go-fast-style worktree shards",
    )
    add_session_argument(fleet_plan)
    fleet_plan.add_argument(
        "--fleet-cap",
        type=int,
        default=FLEET_CAP_DEFAULT,
        help=f"Max shard controllers in one wave (default {FLEET_CAP_DEFAULT}, go-fast fleet_cap)",
    )
    fleet_plan.set_defaults(func=cmd_fleet_plan)

    fleet_open = sub.add_parser(
        "fleet-shard-open",
        help="Open one fleet shard session bound to a git worktree",
    )
    add_session_argument(fleet_open)
    fleet_open.add_argument("--shard", required=True)
    fleet_open.add_argument("--repo", required=True, help="Absolute path to the shard worktree")
    fleet_open.set_defaults(func=cmd_fleet_shard_open)

    fleet_status = sub.add_parser("fleet-status", help="Aggregate parent + shard progress")
    add_session_argument(fleet_status)
    fleet_status.set_defaults(func=cmd_fleet_status)

    fleet_preflight = sub.add_parser(
        "fleet-preflight",
        help="Validate shard child session task budget before dispatching reviewers",
    )
    add_session_argument(fleet_preflight)
    fleet_preflight.set_defaults(func=cmd_fleet_preflight)

    fleet_merge = sub.add_parser(
        "fleet-merge",
        help="Merge terminal shard findings/task states back into the parent session",
    )
    add_session_argument(fleet_merge)
    fleet_merge.add_argument(
        "--partial",
        action="store_true",
        help="Allow merge while some shards are still incomplete",
    )
    fleet_merge.set_defaults(func=cmd_fleet_merge)

    fleet_cleanup = sub.add_parser(
        "fleet-cleanup",
        help="Remove fleet scan git worktrees and ocr-fleet/* branches after fleet-merge",
    )
    add_session_argument(fleet_cleanup)
    fleet_cleanup.add_argument(
        "--partial",
        action="store_true",
        help="Allow cleanup after a partial fleet-merge",
    )
    fleet_cleanup.add_argument(
        "--keep-worktrees",
        action="store_true",
        help="Record cleanup without deleting worktrees (debug / user retain)",
    )
    fleet_cleanup.set_defaults(func=cmd_fleet_cleanup)
    return parser


def main() -> int:
    parser = build_parser()
    try:
        args = parser.parse_args()
        if args.command in {
            "orchestrate-tick", "orchestrate-report", "dispatch-next", "capacity-report",
            "task-start", "task-fail", "task-plan", "submit", "verifier-start", "verify",
            "checkpoint", "complete", "pause", "abort", "heartbeat", "start",
            "dedup-plan", "dedup-verify", "stack-card", "resume", "finalize",
            "export-fix-queue",
            "fleet-plan", "fleet-shard-open", "fleet-status", "fleet-preflight", "fleet-merge",
            "fleet-cleanup",
        }:
            with session_lock(Path(args.session).resolve()):
                _session_dir, session_json, _manifest = load_session(args.session)
                require_session_command(session_json, args.command)
                result = args.func(args)
        else:
            result = args.func(args)
        emit_json(sys.stdout, result)
        return 0
    except ReviewError as exc:
        emit_json(sys.stderr, exc.payload)
        return 2
    except KeyboardInterrupt:
        emit_json(sys.stderr, {"error": "INTERRUPTED", "message": "Interrupted", "next_action": "resume"})
        return 130
    except Exception as exc:  # Defensive JSON-only CLI boundary.
        emit_json(
            sys.stderr,
            {
                "error": "INTERNAL_ERROR",
                "message": f"{type(exc).__name__}: {exc}",
                "next_action": "inspect_error",
            },
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
