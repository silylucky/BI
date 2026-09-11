#!/usr/bin/env python3
"""Validate design-alignment contracts and ledgers without third-party packages."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable


SCHEMA_VERSION = "1.0"
REQ_ID = re.compile(r"^REQ-\d{3,}$")
FINDING_ID = re.compile(r"^ALN-\d{3,}$")
SOURCE_ID = re.compile(r"^SRC-\d{3,}$")
RUN_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$")
SLICE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$")
PLAN_MATRIX_BEGIN = "<!-- ALIGNMENT-MATRIX-BEGIN -->"
PLAN_MATRIX_END = "<!-- ALIGNMENT-MATRIX-END -->"
AUDIT_RESULTS = {"FULL", "PARTIAL", "MISSING", "PROXY", "UNKNOWN", "N/A"}
FINDING_STATUSES = {
    "OPEN",
    "PLANNED",
    "IMPLEMENTED",
    "LOCAL_VERIFIED",
    "EXTERNAL_VERIFIED",
    "BLOCKED",
    "ACCEPTED_RISK",
    "REOPENED",
}
FINAL_CHECK_STATUSES = {
    "OPEN",
    "LOCAL_VERIFIED",
    "EXTERNAL_VERIFIED",
    "BLOCKED",
    "ACCEPTED_RISK",
}
FINAL_VERDICTS = {
    "IN_PROGRESS",
    "LOCALLY_VERIFIED",
    "FULLY_VERIFIED",
    "BLOCKED",
    "ACCEPTED_WITH_RISK",
}
ALLOWED_TRANSITIONS = {
    None: {"OPEN"},
    "OPEN": {"PLANNED", "BLOCKED", "ACCEPTED_RISK"},
    "PLANNED": {"IMPLEMENTED", "BLOCKED", "REOPENED"},
    "IMPLEMENTED": {"LOCAL_VERIFIED", "BLOCKED", "REOPENED"},
    "LOCAL_VERIFIED": {"EXTERNAL_VERIFIED", "BLOCKED", "REOPENED"},
    "EXTERNAL_VERIFIED": {"REOPENED"},
    "BLOCKED": {"OPEN", "PLANNED", "ACCEPTED_RISK"},
    "ACCEPTED_RISK": {"REOPENED"},
    "REOPENED": {"PLANNED", "BLOCKED", "ACCEPTED_RISK"},
}


@dataclass(frozen=True)
class Issue:
    code: str
    path: str
    message: str


def add(issues: list[Issue], code: str, path: str, message: str) -> None:
    issues.append(Issue(code=code, path=path, message=message))


def load_json(path: Path, label: str) -> tuple[dict[str, Any] | None, list[Issue]]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None, [Issue("FILE_NOT_FOUND", label, f"File does not exist: {path}")]
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        return None, [Issue("INVALID_JSON", label, str(exc))]
    if not isinstance(value, dict):
        return None, [Issue("INVALID_TYPE", label, "Top-level JSON value must be an object.")]
    return value, []


def nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def nonempty_list(value: Any) -> bool:
    return isinstance(value, list) and len(value) > 0


def command_option(command: str, name: str) -> str | None:
    match = re.search(
        rf"(?:^|\s)--{re.escape(name)}\s+(?:\"([^\"]+)\"|'([^']+)'|(\S+))",
        command,
    )
    if match is None:
        return None
    return next((value for value in match.groups() if value is not None), None)


def normalized_path_text(value: str) -> str:
    return value.replace("\\", "/").rstrip("/").casefold()


def valid_policy_cwd(value: Any) -> bool:
    if not nonempty_string(value):
        return False
    path = Path(value)
    return not path.is_absolute() and ".." not in path.parts


def evidence_execution_context(record: dict[str, Any]) -> tuple[str, str] | None:
    cwd_value = record.get("cwd")
    workdir_value = record.get("workdir")
    if not nonempty_string(cwd_value) or not nonempty_string(workdir_value):
        return None
    cwd = Path(cwd_value)
    workdir = Path(workdir_value)
    if not cwd.is_absolute() or not workdir.is_absolute():
        return None
    try:
        relative_cwd = cwd.resolve().relative_to(workdir.resolve()).as_posix() or "."
    except ValueError:
        return None
    return normalized_path_text(str(workdir.resolve())), relative_cwd.casefold()


def expected_execution_context(repo_root: Path, policy_cwd: str) -> tuple[str, str]:
    expected_cwd = (repo_root / policy_cwd).resolve()
    if not inside(expected_cwd, repo_root):
        raise ValueError("Frozen policy cwd escapes the target repository.")
    relative_cwd = expected_cwd.relative_to(repo_root.resolve()).as_posix() or "."
    return normalized_path_text(str(repo_root.resolve())), relative_cwd.casefold()


def parse_plan_matrix(plan_text: str) -> dict[str, Any]:
    if plan_text.count(PLAN_MATRIX_BEGIN) != 1 or plan_text.count(PLAN_MATRIX_END) != 1:
        raise ValueError("Plan must contain exactly one ALIGNMENT-MATRIX marker pair.")
    start = plan_text.index(PLAN_MATRIX_BEGIN) + len(PLAN_MATRIX_BEGIN)
    end = plan_text.index(PLAN_MATRIX_END, start)
    raw = plan_text[start:end].strip()
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("Alignment plan matrix must be a JSON object.")
    return value


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inside(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def git_command(repo: Path, *args: str, binary: bool = False) -> str | bytes:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        capture_output=True,
        text=not binary,
        encoding=None if binary else "utf-8",
        check=False,
    )
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace") if binary else result.stderr
        raise OSError(stderr.strip() or f"git {' '.join(args)} exited {result.returncode}")
    return result.stdout


def repository_snapshot(repo: Path, excluded: list[str]) -> dict[str, Any]:
    root = Path(str(git_command(repo, "rev-parse", "--show-toplevel")).strip()).resolve()
    normalized_excludes = [value.replace("\\", "/").strip("/") for value in excluded if value.strip("/")]
    pathspecs = [".", *[f":(exclude){value}/**" for value in normalized_excludes]]
    diff = bytes(git_command(root, "diff", "--binary", "HEAD", "--", *pathspecs, binary=True))
    untracked_raw = bytes(git_command(root, "ls-files", "--others", "--exclude-standard", "-z", binary=True))
    untracked: list[str] = []
    for raw in untracked_raw.split(b"\0"):
        if not raw:
            continue
        rel = raw.decode("utf-8").replace("\\", "/")
        if any(rel == item or rel.startswith(item.rstrip("/") + "/") for item in normalized_excludes):
            continue
        untracked.append(rel)

    head = str(git_command(root, "rev-parse", "HEAD")).strip()
    branch = str(git_command(root, "branch", "--show-current")).strip()
    digest = hashlib.sha256()
    digest.update(head.encode("utf-8"))
    digest.update(b"\0")
    digest.update(diff)
    for rel in sorted(untracked):
        file_path = root / rel
        if not file_path.is_file():
            continue
        digest.update(b"\0")
        digest.update(rel.encode("utf-8"))
        digest.update(b"\0")
        digest.update(file_path.read_bytes())
    return {
        "repo_root": str(root),
        "branch": branch,
        "head": head,
        "status_porcelain": "" if not diff and not untracked else "DIRTY",
        "state_sha256": digest.hexdigest(),
    }


def validate_contract(contract: dict[str, Any]) -> tuple[list[Issue], dict[str, dict[str, Any]]]:
    issues: list[Issue] = []
    if contract.get("schema_version") != SCHEMA_VERSION:
        add(issues, "SCHEMA_VERSION", "contract.schema_version", f"Expected {SCHEMA_VERSION!r}.")
    for field in ("contract_id", "title"):
        if not nonempty_string(contract.get(field)):
            add(issues, "REQUIRED_FIELD", f"contract.{field}", "A non-empty string is required.")

    approval = contract.get("approval")
    if not isinstance(approval, dict):
        add(issues, "CONTRACT_NOT_FROZEN", "contract.approval", "Approval object is required.")
    else:
        if approval.get("status") != "FROZEN":
            add(issues, "CONTRACT_NOT_FROZEN", "contract.approval.status", "Status must be FROZEN.")
        if approval.get("authority") != "user":
            add(issues, "APPROVAL_AUTHORITY", "contract.approval.authority", "Only user authority may freeze a contract.")
        for field in ("approved_by", "approved_at"):
            if not nonempty_string(approval.get(field)):
                add(issues, "REQUIRED_FIELD", f"contract.approval.{field}", "A non-empty string is required.")

    if not nonempty_list(contract.get("source_refs")) or not all(
        nonempty_string(item) for item in contract.get("source_refs", [])
    ):
        add(issues, "REQUIRED_FIELD", "contract.source_refs", "At least one non-empty source reference is required.")

    items = contract.get("items")
    item_map: dict[str, dict[str, Any]] = {}
    if not nonempty_list(items):
        add(issues, "REQUIRED_FIELD", "contract.items", "At least one contract item is required.")
        return issues, item_map

    for index, item in enumerate(items):
        path = f"contract.items[{index}]"
        if not isinstance(item, dict):
            add(issues, "INVALID_TYPE", path, "Item must be an object.")
            continue
        item_id = item.get("id")
        if not nonempty_string(item_id):
            add(issues, "REQUIRED_FIELD", f"{path}.id", "A stable ID is required.")
        elif not REQ_ID.fullmatch(item_id):
            add(issues, "INVALID_ID", f"{path}.id", "Contract item IDs must match REQ-###.")
        elif item_id in item_map:
            add(issues, "DUPLICATE_ID", f"{path}.id", f"Duplicate contract item ID: {item_id}")
        else:
            item_map[item_id] = item
        if not nonempty_string(item.get("statement")):
            add(issues, "REQUIRED_FIELD", f"{path}.statement", "A non-empty statement is required.")
        criteria = item.get("acceptance_criteria")
        if not nonempty_list(criteria) or not all(nonempty_string(value) for value in criteria):
            add(issues, "REQUIRED_FIELD", f"{path}.acceptance_criteria", "At least one acceptance criterion is required.")
        elif len(criteria) != 1:
            add(
                issues,
                "NON_ATOMIC_REQUIREMENT",
                f"{path}.acceptance_criteria",
                "Exactly one acceptance criterion is allowed; split independent behavior into separate REQ IDs.",
            )
        if item.get("required_verification") not in {"local", "external"}:
            add(issues, "INVALID_VALUE", f"{path}.required_verification", "Use local or external.")
        local_policy = item.get("local_verification_policy")
        if not isinstance(local_policy, dict):
            add(
                issues,
                "LOCAL_POLICY_MISSING",
                f"{path}.local_verification_policy",
                "Every requirement needs a frozen local criterion and exact command allowlist.",
            )
        else:
            local_criterion = local_policy.get("criterion")
            commands = local_policy.get("commands")
            policy_cwd = local_policy.get("cwd")
            if not nonempty_string(local_criterion):
                add(
                    issues,
                    "LOCAL_POLICY_MISSING",
                    f"{path}.local_verification_policy.criterion",
                    "A non-empty local verification criterion is required.",
                )
            if (
                not nonempty_list(commands)
                or not all(nonempty_string(command) for command in commands)
                or len(commands) != len(set(commands))
            ):
                add(
                    issues,
                    "LOCAL_POLICY_MISSING",
                    f"{path}.local_verification_policy.commands",
                    "Commands must be a non-empty unique string list.",
                )
            if not valid_policy_cwd(policy_cwd):
                add(
                    issues,
                    "LOCAL_POLICY_MISSING",
                    f"{path}.local_verification_policy.cwd",
                    "cwd must be an explicit repository-relative path without '..'.",
                )
            if (
                item.get("required_verification") == "local"
                and isinstance(criteria, list)
                and len(criteria) == 1
                and local_criterion != criteria[0]
            ):
                add(
                    issues,
                    "LOCAL_POLICY_MISMATCH",
                    f"{path}.local_verification_policy.criterion",
                    "A local requirement must verify its exact frozen acceptance criterion.",
                )
        if item.get("required_verification") == "external":
            policy = item.get("external_acceptance_policy")
            if not isinstance(policy, dict):
                add(
                    issues,
                    "EXTERNAL_POLICY_MISSING",
                    f"{path}.external_acceptance_policy",
                    "External requirements need a frozen environment, authority allowlist, and smoke command.",
                )
            else:
                if (
                    not nonempty_string(policy.get("environment"))
                    or not nonempty_string(policy.get("smoke_command"))
                    or not valid_policy_cwd(policy.get("cwd"))
                ):
                    add(
                        issues,
                        "EXTERNAL_POLICY_MISSING",
                        f"{path}.external_acceptance_policy",
                        "Environment, smoke_command, and an explicit repository-relative cwd are required.",
                    )
                authorities = policy.get("authority_ids")
                if not nonempty_list(authorities) or not all(nonempty_string(value) for value in authorities):
                    add(issues, "EXTERNAL_POLICY_MISSING", f"{path}.external_acceptance_policy.authority_ids", "At least one approved authority ID is required.")

    source_coverage = contract.get("source_coverage")
    covered_requirement_ids: set[str] = set()
    coverage_ids: set[str] = set()
    source_refs = set(contract.get("source_refs", [])) if isinstance(contract.get("source_refs"), list) else set()
    if not nonempty_list(source_coverage):
        add(issues, "SOURCE_COVERAGE", "contract.source_coverage", "A source-to-contract coverage matrix is required.")
        source_coverage = []
    for index, entry in enumerate(source_coverage):
        path = f"contract.source_coverage[{index}]"
        if not isinstance(entry, dict):
            add(issues, "INVALID_TYPE", path, "Source coverage entry must be an object.")
            continue
        source_id = entry.get("id")
        if not nonempty_string(source_id) or not SOURCE_ID.fullmatch(source_id):
            add(issues, "INVALID_ID", f"{path}.id", "Source coverage IDs must match SRC-###.")
        elif source_id in coverage_ids:
            add(issues, "DUPLICATE_ID", f"{path}.id", f"Duplicate source coverage ID: {source_id}")
        else:
            coverage_ids.add(source_id)
        if entry.get("source_ref") not in source_refs:
            add(issues, "SOURCE_COVERAGE", f"{path}.source_ref", "Reference one of contract.source_refs.")
        if not nonempty_string(entry.get("source_item")):
            add(issues, "REQUIRED_FIELD", f"{path}.source_item", "A source item description is required.")
        disposition = entry.get("disposition")
        requirement_ids = entry.get("requirement_ids")
        if disposition == "INCLUDED":
            if not nonempty_list(requirement_ids) or not all(value in item_map for value in requirement_ids):
                add(issues, "SOURCE_COVERAGE", f"{path}.requirement_ids", "INCLUDED source items must map to contract REQ IDs.")
            else:
                covered_requirement_ids.update(requirement_ids)
        elif disposition == "OUT_OF_SCOPE":
            if requirement_ids != []:
                add(issues, "SOURCE_COVERAGE", f"{path}.requirement_ids", "OUT_OF_SCOPE source items must not map REQ IDs.")
            approval = entry.get("user_approval")
            if not isinstance(approval, dict) or approval.get("authority") != "user" or not all(
                nonempty_string(approval.get(field)) for field in ("approved_by", "source_ref", "reason")
            ):
                add(
                    issues,
                    "SOURCE_COVERAGE",
                    f"{path}.user_approval",
                    "OUT_OF_SCOPE requires explicit user approval evidence.",
                )
        else:
            add(issues, "INVALID_VALUE", f"{path}.disposition", "Use INCLUDED or OUT_OF_SCOPE.")

    if covered_requirement_ids != set(item_map):
        add(
            issues,
            "SOURCE_COVERAGE",
            "contract.source_coverage",
            f"Every contract requirement must be derived from a source item; "
            f"missing={sorted(set(item_map) - covered_requirement_ids)}, extra={sorted(covered_requirement_ids - set(item_map))}.",
        )
    return issues, item_map


def validate_evidence_list(issues: list[Issue], values: Any, path: str) -> None:
    if not nonempty_list(values):
        add(issues, "EVIDENCE_MISSING", path, "At least one evidence entry is required.")
        return
    for index, value in enumerate(values):
        if isinstance(value, str):
            if not value.strip():
                add(issues, "EVIDENCE_MISSING", f"{path}[{index}]", "Evidence reference cannot be empty.")
        elif isinstance(value, dict):
            if not nonempty_string(value.get("path")):
                add(issues, "EVIDENCE_MISSING", f"{path}[{index}].path", "Code evidence requires a path.")
        else:
            add(issues, "INVALID_TYPE", f"{path}[{index}]", "Evidence must be a string or object.")


def validate_external_acceptance(issues: list[Issue], values: Any, path: str, required: bool) -> None:
    if not isinstance(values, list):
        add(issues, "INVALID_TYPE", path, "External acceptance must be a list.")
        return
    if required and not values:
        add(issues, "EXTERNAL_ACCEPTANCE_MISSING", path, "A PASS result from a real environment is required.")
    for index, value in enumerate(values):
        item_path = f"{path}[{index}]"
        if not isinstance(value, dict):
            add(issues, "INVALID_TYPE", item_path, "Acceptance entry must be an object.")
            continue
        for field in (
            "environment",
            "command",
            "run_id",
            "slice_id",
            "evidence_ref",
            "evidence_sha256",
            "attestation_ref",
            "attestation_sha256",
            "git_head",
            "accepted_by",
            "accepted_at",
        ):
            if not nonempty_string(value.get(field)):
                add(issues, "REQUIRED_FIELD", f"{item_path}.{field}", "A non-empty string is required.")
        if value.get("kind") != "real-environment" or value.get("environment_class") != "real":
            add(issues, "EXTERNAL_ACCEPTANCE_INVALID", item_path, "Use kind=real-environment and environment_class=real.")
        if value.get("result") != "PASS":
            add(issues, "EXTERNAL_ACCEPTANCE_FAILED", f"{item_path}.result", "Result must be PASS.")
        if value.get("exit_code") != 0:
            add(issues, "EXTERNAL_ACCEPTANCE_FAILED", f"{item_path}.exit_code", "Exit code must be 0.")


def validate_blocker(issues: list[Issue], value: Any, path: str) -> None:
    if not isinstance(value, dict) or not all(nonempty_string(value.get(field)) for field in ("reason", "next_action")):
        add(issues, "BLOCKER_DETAILS_MISSING", path, "BLOCKED requires non-empty reason and next_action.")


def validate_risk_approval(issues: list[Issue], value: Any, path: str) -> None:
    if not isinstance(value, dict):
        add(issues, "RISK_APPROVAL_MISSING", path, "ACCEPTED_RISK requires explicit user approval evidence.")
        return
    if value.get("authority") != "user" or not all(
        nonempty_string(value.get(field)) for field in ("approved_by", "source_ref", "reason")
    ):
        add(
            issues,
            "RISK_APPROVAL_MISSING",
            path,
            "Record authority=user plus approved_by, source_ref, and reason.",
        )


def validate_na_approval(issues: list[Issue], value: Any, path: str) -> None:
    if not isinstance(value, dict) or value.get("authority") != "user" or not all(
        nonempty_string(value.get(field)) for field in ("approved_by", "source_ref", "reason")
    ):
        add(
            issues,
            "NA_APPROVAL_MISSING",
            path,
            "N/A requires authority=user plus approved_by, source_ref, and reason.",
        )


def validate_ledger_structure(
    contract_path: Path,
    ledger_path: Path,
    contract_items: dict[str, dict[str, Any]],
    ledger: dict[str, Any],
) -> list[Issue]:
    issues: list[Issue] = []
    repo_root_for_refs: Path | None = None
    plan_path_for_refs: Path | None = None
    if ledger.get("schema_version") != SCHEMA_VERSION:
        add(issues, "SCHEMA_VERSION", "ledger.schema_version", f"Expected {SCHEMA_VERSION!r}.")
    if not nonempty_string(ledger.get("run_id")):
        add(issues, "REQUIRED_FIELD", "ledger.run_id", "A non-empty run ID is required.")
    elif not RUN_ID.fullmatch(ledger["run_id"]):
        add(issues, "INVALID_ID", "ledger.run_id", "Run ID may contain only letters, digits, dot, underscore, and dash.")

    contract_ref = ledger.get("contract")
    if not isinstance(contract_ref, dict):
        add(issues, "REQUIRED_FIELD", "ledger.contract", "Contract reference is required.")
    else:
        expected_hash = sha256_file(contract_path)
        if contract_ref.get("sha256") != expected_hash:
            add(
                issues,
                "CONTRACT_HASH_MISMATCH",
                "ledger.contract.sha256",
                f"Expected {expected_hash}; contract changed or ledger references the wrong version.",
            )
        if not nonempty_string(contract_ref.get("path")):
            add(issues, "REQUIRED_FIELD", "ledger.contract.path", "Contract path is required.")
        else:
            recorded_path = Path(contract_ref["path"])
            if not recorded_path.is_absolute():
                recorded_path = ledger_path.parent / recorded_path
            if recorded_path.resolve() != contract_path.resolve():
                add(
                    issues,
                    "CONTRACT_PATH_MISMATCH",
                    "ledger.contract.path",
                    f"Recorded path resolves to {recorded_path.resolve()}, not the CLI contract {contract_path.resolve()}.",
                )

    snapshot = ledger.get("snapshot")
    if not isinstance(snapshot, dict):
        add(issues, "REQUIRED_FIELD", "ledger.snapshot", "Git snapshot is required.")
    else:
        for field in ("repo_root", "branch", "head", "state_sha256"):
            if not nonempty_string(snapshot.get(field)):
                add(issues, "REQUIRED_FIELD", f"ledger.snapshot.{field}", "A non-empty string is required.")
        if "status_porcelain" not in snapshot or not isinstance(snapshot.get("status_porcelain"), str):
            add(issues, "REQUIRED_FIELD", "ledger.snapshot.status_porcelain", "Record git status porcelain, including empty.")
        if all(nonempty_string(snapshot.get(field)) for field in ("repo_root", "branch", "head", "state_sha256")):
            try:
                repo_root = Path(snapshot["repo_root"]).resolve()
                actual_root = Path(str(git_command(repo_root, "rev-parse", "--show-toplevel")).strip()).resolve()
                repo_root_for_refs = actual_root
                if not inside(contract_path, actual_root) or not inside(ledger_path, actual_root):
                    raise OSError("Contract and ledger must be inside the recorded repository.")
                expected_run_dir = (
                    actual_root / "docs" / "material" / "design-alignment" / ledger["run_id"]
                ).resolve()
                if contract_path.parent.resolve() != expected_run_dir or ledger_path.parent.resolve() != expected_run_dir:
                    raise OSError(
                        "Contract and ledger must share the canonical "
                        f"docs/material/design-alignment/{ledger['run_id']} run directory."
                    )
                run_rel = contract_path.parent.resolve().relative_to(actual_root).as_posix()
                actual_snapshot = repository_snapshot(actual_root, [run_rel, ".evidence"])
                for field in ("repo_root", "branch", "head", "state_sha256"):
                    expected_value = str(Path(snapshot[field]).resolve()) if field == "repo_root" else snapshot[field]
                    actual_value = str(Path(actual_snapshot[field]).resolve()) if field == "repo_root" else actual_snapshot[field]
                    if expected_value != actual_value:
                        add(
                            issues,
                            "SNAPSHOT_MISMATCH",
                            f"ledger.snapshot.{field}",
                            f"Recorded {expected_value!r}, current repository is {actual_value!r}.",
                        )
                if actual_snapshot["status_porcelain"] != "":
                    add(
                        issues,
                        "SNAPSHOT_MISMATCH",
                        "ledger.snapshot.status_porcelain",
                        "Verification requires a clean committed tree outside the alignment run and .evidence directories.",
                    )
            except (OSError, ValueError) as exc:
                add(issues, "SNAPSHOT_MISMATCH", "ledger.snapshot", str(exc))

    plan = ledger.get("plan")
    if not isinstance(plan, dict):
        add(issues, "PLAN_REF_INVALID", "ledger.plan", "A single executable plan reference is required.")
    else:
        for field in ("path", "contract_sha256"):
            if not nonempty_string(plan.get(field)):
                add(issues, "PLAN_REF_INVALID", f"ledger.plan.{field}", "A non-empty string is required.")
        if nonempty_string(plan.get("path")):
            try:
                if repo_root_for_refs is None:
                    raise ValueError("Repository root is unavailable because the snapshot is invalid.")
                candidate = Path(plan["path"])
                if not candidate.is_absolute():
                    candidate = repo_root_for_refs / candidate
                candidate = candidate.resolve()
                relative_plan = candidate.relative_to(repo_root_for_refs).as_posix()
                if not relative_plan.startswith("docs/specs/"):
                    raise ValueError("Executable plan must live under docs/specs/ for go-fast Path A.")
                plan_text = candidate.read_text(encoding="utf-8")
                expected_contract_hash = ledger.get("contract", {}).get("sha256")
                matrix = parse_plan_matrix(plan_text)
                raw_requirements = {
                    item.get("id"): item
                    for item in ledger.get("requirements", [])
                    if isinstance(item, dict) and nonempty_string(item.get("id"))
                }
                raw_findings = [
                    item
                    for item in ledger.get("findings", [])
                    if isinstance(item, dict) and nonempty_string(item.get("id"))
                ]
                expected_matrix = {
                    "schema": "design-alignment/plan-matrix/v1",
                    "contract_sha256": expected_contract_hash,
                    "requirements": [
                        {
                            "id": requirement_id,
                            "acceptance_criterion": item["acceptance_criteria"][0],
                            "local_criterion": item["local_verification_policy"]["criterion"],
                            "cwd": item["local_verification_policy"]["cwd"],
                            "commands": item["local_verification_policy"]["commands"],
                            "finding_ids": raw_requirements.get(requirement_id, {}).get("finding_ids", []),
                        }
                        for requirement_id, item in contract_items.items()
                    ],
                    "findings": [
                        {
                            "id": item["id"],
                            "requirement_ids": item.get("requirement_ids", []),
                            "anchor": item["id"],
                        }
                        for item in raw_findings
                    ],
                }
                if plan.get("contract_sha256") != expected_contract_hash or matrix != expected_matrix:
                    raise ValueError(
                        "Machine-readable plan matrix must exactly bind the frozen contract, each REQ policy, "
                        "and every REQ/Finding edge in ledger order."
                    )
                missing_headings = [
                    item["id"]
                    for item in raw_findings
                    if re.search(rf"(?m)^##[ \t]+{re.escape(item['id'])}[ \t]*$", plan_text) is None
                ]
                if missing_headings:
                    raise ValueError(f"Plan is missing exact finding headings: {missing_headings}")
                plan_path_for_refs = candidate
            except (KeyError, OSError, UnicodeError, json.JSONDecodeError, TypeError, ValueError) as exc:
                add(issues, "PLAN_REF_INVALID", "ledger.plan.path", str(exc))

    roles = ledger.get("roles")
    if not isinstance(roles, dict):
        add(issues, "REQUIRED_FIELD", "ledger.roles", "Role assignments are required.")
    else:
        for role in ("orchestrator", "auditor", "planner", "code_reviewer", "verifier"):
            if not isinstance(roles.get(role), dict) or not nonempty_string(roles[role].get("id")):
                add(issues, "REQUIRED_FIELD", f"ledger.roles.{role}.id", "A role identity is required.")
        implementers = roles.get("implementers")
        if not isinstance(implementers, list) or not all(
            isinstance(item, dict) and nonempty_string(item.get("id")) for item in implementers
        ):
            add(issues, "REQUIRED_FIELD", "ledger.roles.implementers", "Record zero or more valid implementer identities.")

    requirements = ledger.get("requirements")
    requirement_map: dict[str, dict[str, Any]] = {}
    if not isinstance(requirements, list):
        add(issues, "REQUIRED_FIELD", "ledger.requirements", "Requirements traceability list is required.")
        requirements = []
    for index, requirement in enumerate(requirements):
        path = f"ledger.requirements[{index}]"
        if not isinstance(requirement, dict):
            add(issues, "INVALID_TYPE", path, "Requirement trace must be an object.")
            continue
        requirement_id = requirement.get("id")
        if not nonempty_string(requirement_id):
            add(issues, "REQUIRED_FIELD", f"{path}.id", "Requirement ID is required.")
        elif not REQ_ID.fullmatch(requirement_id):
            add(issues, "INVALID_ID", f"{path}.id", "Requirement IDs must match REQ-###.")
        elif requirement_id in requirement_map:
            add(issues, "DUPLICATE_ID", f"{path}.id", f"Duplicate requirement trace: {requirement_id}")
        else:
            requirement_map[requirement_id] = requirement
        if requirement.get("audit_result") not in AUDIT_RESULTS:
            add(issues, "INVALID_VALUE", f"{path}.audit_result", f"Use one of {sorted(AUDIT_RESULTS)}.")
        finding_ids = requirement.get("finding_ids")
        if not isinstance(finding_ids, list) or not all(nonempty_string(value) for value in finding_ids):
            add(issues, "INVALID_TYPE", f"{path}.finding_ids", "Finding IDs must be a list of strings.")
        elif requirement.get("audit_result") in {"PARTIAL", "MISSING", "PROXY", "UNKNOWN"} and not finding_ids:
            add(issues, "FINDING_REQUIRED", f"{path}.finding_ids", "A non-FULL result must create at least one finding.")
        if requirement.get("audit_result") == "N/A":
            validate_na_approval(issues, requirement.get("na_approval"), f"{path}.na_approval")
        validate_evidence_list(issues, requirement.get("audit_evidence"), f"{path}.audit_evidence")
        final_check = requirement.get("final_check")
        if not isinstance(final_check, dict):
            add(issues, "REQUIRED_FIELD", f"{path}.final_check", "Final check object is required.")
        else:
            status = final_check.get("status")
            if status not in FINAL_CHECK_STATUSES:
                add(issues, "INVALID_VALUE", f"{path}.final_check.status", f"Use one of {sorted(FINAL_CHECK_STATUSES)}.")
            if status in {"LOCAL_VERIFIED", "EXTERNAL_VERIFIED"}:
                if not nonempty_string(final_check.get("verifier_id")):
                    add(issues, "REQUIRED_FIELD", f"{path}.final_check.verifier_id", "Verifier ID is required.")
                validate_evidence_list(issues, final_check.get("evidence"), f"{path}.final_check.evidence")
            if status == "BLOCKED":
                validate_blocker(issues, final_check.get("blocker"), f"{path}.final_check.blocker")
            if status == "ACCEPTED_RISK":
                validate_risk_approval(issues, final_check.get("accepted_risk"), f"{path}.final_check.accepted_risk")
            validate_external_acceptance(
                issues,
                final_check.get("external_acceptance", []),
                f"{path}.final_check.external_acceptance",
                required=status == "EXTERNAL_VERIFIED",
            )

    contract_ids = set(contract_items)
    ledger_ids = set(requirement_map)
    if contract_ids != ledger_ids:
        missing = sorted(contract_ids - ledger_ids)
        extra = sorted(ledger_ids - contract_ids)
        add(
            issues,
            "REQUIREMENT_COVERAGE",
            "ledger.requirements",
            f"Exact coverage required; missing={missing}, extra={extra}.",
        )

    findings = ledger.get("findings")
    finding_map: dict[str, dict[str, Any]] = {}
    if not isinstance(findings, list):
        add(issues, "REQUIRED_FIELD", "ledger.findings", "Findings list is required, even when empty.")
        findings = []
    for index, finding in enumerate(findings):
        path = f"ledger.findings[{index}]"
        if not isinstance(finding, dict):
            add(issues, "INVALID_TYPE", path, "Finding must be an object.")
            continue
        finding_id = finding.get("id")
        if not nonempty_string(finding_id):
            add(issues, "REQUIRED_FIELD", f"{path}.id", "Stable finding ID is required.")
        elif not FINDING_ID.fullmatch(finding_id):
            add(issues, "INVALID_ID", f"{path}.id", "Finding IDs must match ALN-###.")
        elif finding_id in finding_map:
            add(issues, "DUPLICATE_ID", f"{path}.id", f"Duplicate finding ID: {finding_id}")
        else:
            finding_map[finding_id] = finding
        requirement_ids = finding.get("requirement_ids")
        if not nonempty_list(requirement_ids) or not all(value in contract_ids for value in requirement_ids):
            add(issues, "INVALID_REFERENCE", f"{path}.requirement_ids", "Reference one or more contract item IDs.")
        for field in ("summary", "severity"):
            if not nonempty_string(finding.get(field)):
                add(issues, "REQUIRED_FIELD", f"{path}.{field}", "A non-empty string is required.")
        status = finding.get("status")
        if status not in FINDING_STATUSES:
            add(issues, "INVALID_VALUE", f"{path}.status", f"Use one of {sorted(FINDING_STATUSES)}.")
        if status not in {"OPEN", "BLOCKED", "ACCEPTED_RISK", "REOPENED"} and not nonempty_string(finding.get("plan_ref")):
            add(issues, "REQUIRED_FIELD", f"{path}.plan_ref", "A plan reference is required after planning.")
        elif nonempty_string(finding.get("plan_ref")):
            plan_ref = finding["plan_ref"]
            plan_parts = plan_ref.split("#", 1)
            plan_file_ref = plan_parts[0]
            try:
                if len(plan_parts) != 2 or plan_parts[1] != finding_id:
                    raise ValueError(f"Finding plan_ref fragment must be exactly #{finding_id}.")
                if repo_root_for_refs is None:
                    raise ValueError("Repository root is unavailable because the snapshot is invalid.")
                plan_file = Path(plan_file_ref)
                if not plan_file.is_absolute():
                    plan_file = repo_root_for_refs / plan_file
                plan_file = plan_file.resolve()
                if plan_path_for_refs is None or plan_file != plan_path_for_refs:
                    raise ValueError("Finding plan_ref must point to the single ledger.plan file.")
                plan_text = plan_file.read_text(encoding="utf-8")
                contract_hash = ledger.get("contract", {}).get("sha256")
                if (
                    re.search(rf"(?m)^#{{1,6}}[ \t]+{re.escape(finding_id)}[ \t]*$", plan_text) is None
                    or not nonempty_string(contract_hash)
                ):
                    raise ValueError("Plan must contain the exact finding heading and frozen contract matrix.")
            except (OSError, UnicodeError, ValueError) as exc:
                add(issues, "PLAN_REF_INVALID", f"{path}.plan_ref", str(exc))
        if status in {"IMPLEMENTED", "LOCAL_VERIFIED", "EXTERNAL_VERIFIED"}:
            validate_evidence_list(issues, finding.get("implementation_evidence"), f"{path}.implementation_evidence")
        if status == "BLOCKED":
            validate_blocker(issues, finding.get("blocker"), f"{path}.blocker")
        if status == "ACCEPTED_RISK":
            validate_risk_approval(issues, finding.get("accepted_risk"), f"{path}.accepted_risk")
        if status in {"LOCAL_VERIFIED", "EXTERNAL_VERIFIED"}:
            tests = finding.get("tests")
            if not nonempty_list(tests):
                add(issues, "EVIDENCE_MISSING", f"{path}.tests", "Verified findings require test evidence.")
            else:
                for test_index, test in enumerate(tests):
                    test_path = f"{path}.tests[{test_index}]"
                    if not isinstance(test, dict):
                        add(issues, "INVALID_TYPE", test_path, "Test evidence must be an object.")
                        continue
                    for field in ("command", "evidence_ref", "environment"):
                        if not nonempty_string(test.get(field)):
                            add(issues, "REQUIRED_FIELD", f"{test_path}.{field}", "A non-empty string is required.")
                    if test.get("exit_code") != 0:
                        add(issues, "TEST_NOT_PASSING", f"{test_path}.exit_code", "Verified evidence requires exit code 0.")
        validate_external_acceptance(
            issues,
            finding.get("external_acceptance", []),
            f"{path}.external_acceptance",
            required=status == "EXTERNAL_VERIFIED",
        )
        history = finding.get("history")
        if not nonempty_list(history):
            add(issues, "HISTORY_MISSING", f"{path}.history", "State history is required.")
        else:
            previous: str | None = None
            for history_index, transition in enumerate(history):
                history_path = f"{path}.history[{history_index}]"
                if not isinstance(transition, dict):
                    add(issues, "INVALID_TYPE", history_path, "Transition must be an object.")
                    continue
                from_status = transition.get("from")
                to_status = transition.get("to")
                if from_status != previous or to_status not in ALLOWED_TRANSITIONS.get(from_status, set()):
                    add(issues, "INVALID_TRANSITION", history_path, f"Invalid transition {from_status!r} -> {to_status!r}.")
                if not nonempty_string(transition.get("actor_role")) or not nonempty_string(transition.get("actor_id")):
                    add(issues, "REQUIRED_FIELD", history_path, "Actor role and ID are required.")
                previous = to_status
            if previous != status:
                add(issues, "HISTORY_STATUS_MISMATCH", f"{path}.status", f"History ends at {previous!r}, ledger says {status!r}.")
            last_transition = history[-1] if isinstance(history[-1], dict) else {}
            if status == "ACCEPTED_RISK" and last_transition.get("actor_role") != "user":
                add(issues, "RISK_APPROVAL_MISSING", f"{path}.history[-1]", "ACCEPTED_RISK transition must be recorded by user role.")

    requirement_edges: set[tuple[str, str]] = set()
    for requirement_id, requirement in requirement_map.items():
        values = requirement.get("finding_ids")
        if isinstance(values, list):
            requirement_edges.update(
                (requirement_id, finding_id) for finding_id in values if isinstance(finding_id, str)
            )
    referenced_findings = {finding_id for _, finding_id in requirement_edges}
    finding_ids = set(finding_map)
    if referenced_findings != finding_ids:
        add(
            issues,
            "FINDING_COVERAGE",
            "ledger.findings",
            f"Finding references must be exact; unreferenced={sorted(finding_ids - referenced_findings)}, missing={sorted(referenced_findings - finding_ids)}.",
        )

    finding_edges: set[tuple[str, str]] = set()
    for finding_id, finding in finding_map.items():
        values = finding.get("requirement_ids")
        if isinstance(values, list):
            finding_edges.update(
                (requirement_id, finding_id) for requirement_id in values if isinstance(requirement_id, str)
            )
    if requirement_edges != finding_edges:
        add(
            issues,
            "FINDING_EDGE_MISMATCH",
            "ledger.requirements<->ledger.findings",
            f"Edges must be bidirectional; requirement_only={sorted(requirement_edges - finding_edges)}, "
            f"finding_only={sorted(finding_edges - requirement_edges)}.",
        )

    if isinstance(roles, dict):
        collector_specs = (
            ("audit_collectors", "requirement_ids", set(requirement_map)),
            ("plan_collectors", "finding_ids", set(finding_map)),
        )
        for role_key, scope_key, valid_scope_ids in collector_specs:
            collectors = roles.get(role_key, [])
            role_path = f"ledger.roles.{role_key}"
            if not isinstance(collectors, list):
                add(issues, "INVALID_TYPE", role_path, "Parallel collectors must be a list when present.")
                continue
            claimed_scope_ids: set[str] = set()
            for collector_index, collector in enumerate(collectors):
                collector_path = f"{role_path}[{collector_index}]"
                if not isinstance(collector, dict):
                    add(issues, "INVALID_TYPE", collector_path, "Collector must be an object.")
                    continue
                if not nonempty_string(collector.get("id")):
                    add(issues, "REQUIRED_FIELD", f"{collector_path}.id", "Collector runtime identity is required.")
                scope_ids = collector.get(scope_key)
                if not nonempty_list(scope_ids) or not all(nonempty_string(value) for value in scope_ids):
                    add(
                        issues,
                        "COLLECTOR_SCOPE_INVALID",
                        f"{collector_path}.{scope_key}",
                        "Collector scope must contain one or more stable IDs.",
                    )
                    continue
                unknown_scope_ids = sorted(set(scope_ids) - valid_scope_ids)
                if unknown_scope_ids:
                    add(
                        issues,
                        "COLLECTOR_SCOPE_INVALID",
                        f"{collector_path}.{scope_key}",
                        f"Collector scope references unknown IDs: {unknown_scope_ids}.",
                    )
                duplicated_scope_ids = sorted(
                    {value for value in scope_ids if scope_ids.count(value) > 1}
                    | (set(scope_ids) & claimed_scope_ids)
                )
                if duplicated_scope_ids:
                    add(
                        issues,
                        "COLLECTOR_SCOPE_OVERLAP",
                        f"{collector_path}.{scope_key}",
                        f"Parallel collector scopes must be disjoint; duplicates={duplicated_scope_ids}.",
                    )
                claimed_scope_ids.update(scope_ids)

    slices = ledger.get("slices")
    snapshot_repo_root = (
        Path(ledger["snapshot"]["repo_root"]).resolve()
        if isinstance(ledger.get("snapshot"), dict)
        and nonempty_string(ledger["snapshot"].get("repo_root"))
        else None
    )
    if not nonempty_list(slices):
        add(issues, "EVIDENCE_SLICE_COVERAGE", "ledger.slices", "At least one verification slice is required.")
    else:
        for index, slice_item in enumerate(slices):
            path = f"ledger.slices[{index}]"
            if not isinstance(slice_item, dict):
                add(issues, "INVALID_TYPE", path, "Slice must be an object.")
                continue
            worktree = slice_item.get("worktree")
            if not nonempty_string(worktree) or not Path(worktree).is_absolute():
                add(
                    issues,
                    "EVIDENCE_SLICE_COVERAGE",
                    f"{path}.worktree",
                    "Each slice must bind the absolute implementation worktree recorded by the orchestrator.",
                )
            elif snapshot_repo_root is not None and normalized_path_text(str(Path(worktree).resolve())) != normalized_path_text(
                str(snapshot_repo_root)
            ):
                add(
                    issues,
                    "EVIDENCE_SLICE_COVERAGE",
                    f"{path}.worktree",
                    "This alignment workflow accepts only the snapshot main worktree; linked or foreign worktrees are not trusted evidence roots.",
                )

    verdict = ledger.get("final_verdict")
    if not isinstance(verdict, dict):
        add(issues, "REQUIRED_FIELD", "ledger.final_verdict", "Final verdict object is required.")
    else:
        if verdict.get("status") not in FINAL_VERDICTS:
            add(issues, "INVALID_VALUE", "ledger.final_verdict.status", f"Use one of {sorted(FINAL_VERDICTS)}.")
        for field in ("declared_by", "declared_at", "summary"):
            if not nonempty_string(verdict.get(field)):
                add(issues, "REQUIRED_FIELD", f"ledger.final_verdict.{field}", "A non-empty string is required.")
    return issues


def local_evidence_issues(
    values: Any,
    path: str,
    repo_root: Path,
    expected_run_id: str,
    expected_head: str,
    expected_slice_id: str | None,
    expected_cwd: str,
    expected_command: str | None = None,
    expected_criterion: str | None = None,
    allowed_commands: set[str] | None = None,
    approved_plan_text: str | None = None,
) -> list[Issue]:
    issues: list[Issue] = []
    if not isinstance(values, list):
        add(issues, "LOCAL_EVIDENCE_INVALID", path, "Evidence references must be a list.")
        return issues
    for index, value in enumerate(values):
        item_path = f"{path}[{index}]"
        try:
            evidence_ref = value if isinstance(value, str) else value.get("path") if isinstance(value, dict) else None
            if not nonempty_string(evidence_ref):
                raise ValueError("Evidence reference is missing.")
            evidence_path = Path(evidence_ref)
            if not evidence_path.is_absolute():
                evidence_path = repo_root / evidence_path
            evidence_path = evidence_path.resolve()
            relative = evidence_path.relative_to(repo_root).as_posix()
            required_prefix = f".evidence/{expected_run_id}/"
            if not relative.startswith(required_prefix):
                raise ValueError(f"Evidence must be under {required_prefix}.")
            artifact = json.loads(evidence_path.read_text(encoding="utf-8"))
            if not isinstance(artifact, dict):
                raise ValueError("Evidence artifact must be a JSON object.")
            actual_context = evidence_execution_context(artifact)
            expected_context = expected_execution_context(repo_root, expected_cwd)
            if actual_context != expected_context:
                raise ValueError(
                    "Evidence cwd/workdir does not match the exact frozen repository-relative cwd: "
                    f"expected={expected_context}, actual={actual_context}."
                )
            if expected_criterion is not None:
                if not isinstance(value, dict):
                    raise ValueError("Requirement evidence must bind path, SHA-256, command, and acceptance_criterion.")
                if value.get("acceptance_criterion") != expected_criterion:
                    raise ValueError("Evidence is not bound to the exact frozen acceptance criterion.")
                if value.get("command") != artifact.get("cmd"):
                    raise ValueError("Evidence command does not match the artifact command.")
                if value.get("sha256") != sha256_file(evidence_path):
                    raise ValueError("Evidence SHA-256 does not match the artifact.")
            expected = {
                "schema": "evidence/v1",
                "run_id": expected_run_id,
                "slice": expected_slice_id,
                "exit_code": 0,
                "expectation_met": True,
                "git_sha": expected_head,
                "git_dirty": False,
            }
            if expected_command is not None:
                expected["cmd"] = expected_command
            evidence_command = expected_command
            if evidence_command is None and isinstance(value, dict):
                evidence_command = value.get("command")
            if allowed_commands is not None and evidence_command not in allowed_commands:
                raise ValueError(
                    "Evidence command is not in the exact frozen local verification command allowlist."
                )
            if approved_plan_text is not None and (
                not nonempty_string(evidence_command) or evidence_command not in approved_plan_text
            ):
                raise ValueError("Evidence command is not present in the approved executable plan.")
            mismatches = {
                key: {"expected": expected_value, "actual": artifact.get(key)}
                for key, expected_value in expected.items()
                if artifact.get(key) != expected_value
            }
            if artifact.get("phase") not in {"green", "full", "merge", "cr"}:
                mismatches["phase"] = {"expected": "green/full/merge/cr", "actual": artifact.get("phase")}
            if mismatches:
                raise ValueError(f"Evidence artifact fields do not match verification: {mismatches}")
        except (AttributeError, OSError, UnicodeError, json.JSONDecodeError, TypeError, ValueError) as exc:
            add(issues, "LOCAL_EVIDENCE_INVALID", item_path, str(exc))
    return issues


def external_evidence_issues(
    acceptance: dict[str, Any],
    path: str,
    repo_root: Path,
    expected_run_id: str,
    expected_head: str,
    valid_slice_ids: set[str],
    forbidden_actor_ids: set[str],
    acceptance_policies: list[dict[str, Any]],
) -> list[Issue]:
    issues: list[Issue] = []
    try:
        evidence_ref = acceptance["evidence_ref"]
        evidence_path = Path(evidence_ref)
        if not evidence_path.is_absolute():
            evidence_path = repo_root / evidence_path
        evidence_path = evidence_path.resolve()
        relative = evidence_path.relative_to(repo_root).as_posix()
        required_prefix = f".evidence/{expected_run_id}/"
        if not relative.startswith(required_prefix):
            raise ValueError(f"Evidence must be under {required_prefix}.")
        if acceptance.get("run_id") != expected_run_id:
            raise ValueError("Acceptance run_id does not match the alignment run.")
        if acceptance.get("slice_id") not in valid_slice_ids:
            raise ValueError("Acceptance slice_id is not declared in ledger.slices.")
        if acceptance.get("git_head") != expected_head:
            raise ValueError("Acceptance git_head does not match the verified snapshot.")
        if acceptance.get("accepted_by") in forbidden_actor_ids:
            raise ValueError("An internal alignment role cannot be the external acceptance authority.")
        matching_policies = [
            policy
            for policy in acceptance_policies
            if isinstance(policy, dict)
            and acceptance.get("environment") == policy.get("environment")
            and acceptance.get("accepted_by") in policy.get("authority_ids", [])
            and acceptance.get("command") == policy.get("smoke_command")
        ]
        if len(matching_policies) != 1:
            raise ValueError("Environment, authority, or smoke command is not approved by the frozen contract policy.")
        if sha256_file(evidence_path) != acceptance.get("evidence_sha256"):
            raise ValueError("Evidence SHA-256 does not match the referenced artifact.")
        artifact = json.loads(evidence_path.read_text(encoding="utf-8"))
        if not isinstance(artifact, dict):
            raise ValueError("Evidence artifact must be a JSON object.")
        actual_context = evidence_execution_context(artifact)
        expected_context = expected_execution_context(repo_root, matching_policies[0]["cwd"])
        if actual_context != expected_context:
            raise ValueError(
                "External smoke cwd/workdir does not match the exact frozen repository-relative cwd: "
                f"expected={expected_context}, actual={actual_context}."
            )
        expected = {
            "schema": "evidence/v1",
            "run_id": expected_run_id,
            "slice": acceptance.get("slice_id"),
            "phase": "smoke",
            "cmd": acceptance.get("command"),
            "exit_code": 0,
            "expectation_met": True,
            "git_sha": expected_head,
            "git_dirty": False,
        }
        mismatches = {
            key: {"expected": value, "actual": artifact.get(key)}
            for key, value in expected.items()
            if artifact.get(key) != value
        }
        if mismatches:
            raise ValueError(f"Evidence artifact fields do not match acceptance: {mismatches}")
        attestation_path = Path(acceptance["attestation_ref"])
        if not attestation_path.is_absolute():
            attestation_path = repo_root / attestation_path
        attestation_path = attestation_path.resolve()
        attestation_relative = attestation_path.relative_to(repo_root).as_posix()
        if not attestation_relative.startswith(required_prefix):
            raise ValueError(f"External attestation must be under {required_prefix}.")
        if sha256_file(attestation_path) != acceptance.get("attestation_sha256"):
            raise ValueError("External attestation SHA-256 does not match.")
        attestation = json.loads(attestation_path.read_text(encoding="utf-8"))
        if not isinstance(attestation, dict):
            raise ValueError("External attestation must be a JSON object.")
        expected_attestation = {
            "schema": "design-alignment/external-attestation/v1",
            "raw_evidence_ref": evidence_ref,
            "raw_evidence_sha256": acceptance.get("evidence_sha256"),
            "run_id": expected_run_id,
            "slice_id": acceptance.get("slice_id"),
            "command": acceptance.get("command"),
            "git_head": expected_head,
            "environment": acceptance.get("environment"),
            "environment_class": "real",
            "result": "PASS",
            "accepted_by": acceptance.get("accepted_by"),
            "accepted_at": acceptance.get("accepted_at"),
        }
        attestation_mismatches = {
            key: {"expected": value, "actual": attestation.get(key)}
            for key, value in expected_attestation.items()
            if attestation.get(key) != value
        }
        if attestation_mismatches:
            raise ValueError(f"External attestation does not bind the raw smoke evidence: {attestation_mismatches}")
    except (KeyError, OSError, UnicodeError, json.JSONDecodeError, TypeError, ValueError) as exc:
        add(issues, "EXTERNAL_EVIDENCE_INVALID", path, str(exc))
    return issues


def gate_output_issues(
    evidence_gate: dict[str, Any],
    repo_root: Path,
    expected_run_id: str,
    expected_slice_ids: set[str],
) -> list[Issue]:
    issues: list[Issue] = []
    try:
        output_ref = evidence_gate["output_ref"]
        output_sha256 = evidence_gate["output_sha256"]
        if not nonempty_string(output_ref) or not nonempty_string(output_sha256):
            raise ValueError("output_ref and output_sha256 are required.")
        output_path = Path(output_ref)
        if not output_path.is_absolute():
            output_path = repo_root / output_path
        output_path = output_path.resolve()
        relative = output_path.relative_to(repo_root).as_posix()
        required_prefix = f"docs/material/design-alignment/{expected_run_id}/"
        if not relative.startswith(required_prefix):
            raise ValueError(f"Gate output must be under {required_prefix}.")
        if sha256_file(output_path) != output_sha256:
            raise ValueError("Gate output SHA-256 does not match the referenced artifact.")
        report = json.loads(output_path.read_text(encoding="utf-8"))
        if not isinstance(report, dict):
            raise ValueError("Gate output must be a JSON object.")
        report_slices = report.get("slices")
        if not isinstance(report_slices, list) or not all(isinstance(item, dict) for item in report_slices):
            raise ValueError("Gate output slices must be a list of objects.")
        reported_slice_ids = [item.get("slice") for item in report_slices]
        if (
            report.get("gate") != "batch"
            or report.get("status") != "PASS"
            or report.get("run_id") != expected_run_id
            or report.get("reasons") not in ([], None)
            or set(reported_slice_ids) != expected_slice_ids
            or len(reported_slice_ids) != len(set(reported_slice_ids))
            or any(item.get("status") != "PASS" for item in report_slices)
        ):
            raise ValueError("Gate output does not prove PASS for the exact run and slice set.")
    except (KeyError, OSError, UnicodeError, json.JSONDecodeError, TypeError, ValueError) as exc:
        add(issues, "EVIDENCE_GATE_OUTPUT_INVALID", "ledger.evidence_gate.output_ref", str(exc))
    return issues


def code_review_issues(ledger: dict[str, Any]) -> list[Issue]:
    issues: list[Issue] = []
    review = ledger.get("code_review")
    if not isinstance(review, dict):
        add(
            issues,
            "CODE_REVIEW_EVIDENCE_MISSING",
            "ledger.code_review",
            "A read-only production code-review attestation is required before either completion gate can pass.",
        )
        return issues
    try:
        reviewer = ledger["roles"]["code_reviewer"]
        if review.get("status") != "DONE" or review.get("reviewer_id") != reviewer["id"]:
            raise ValueError("Code review must preserve source status DONE and use the assigned code_reviewer.")
        if reviewer.get("read_only") is not True or not nonempty_string(review.get("checked_at")):
            raise ValueError("Code reviewer must be read-only and checked_at is required.")
        repo_root = Path(ledger["snapshot"]["repo_root"]).resolve()
        report_path = Path(review["report_ref"])
        if not report_path.is_absolute():
            report_path = repo_root / report_path
        report_path = report_path.resolve()
        relative = report_path.relative_to(repo_root).as_posix()
        required_prefix = f"docs/material/design-alignment/{ledger['run_id']}/"
        if not relative.startswith(required_prefix):
            raise ValueError(f"Code review report must be under {required_prefix}.")
        if sha256_file(report_path) != review.get("report_sha256"):
            raise ValueError("Code review report SHA-256 does not match.")
        report = json.loads(report_path.read_text(encoding="utf-8"))
        if not isinstance(report, dict):
            raise ValueError("Code review report must be a JSON object.")
        expected = {
            "schema": "design-alignment/code-review/v1",
            "status": "DONE",
            "reviewer_id": reviewer["id"],
            "read_only": True,
            "contract_sha256": ledger["contract"]["sha256"],
            "git_head": ledger["snapshot"]["head"],
            "unresolved_finding_ids": [],
            "coverage": {"blind_spots": [], "evidence_read": True},
            "remaining": [],
        }
        mismatches = {
            key: {"expected": value, "actual": report.get(key)}
            for key, value in expected.items()
            if report.get(key) != value
        }
        requirement_ids = [item["id"] for item in ledger["requirements"]]
        finding_ids = [item["id"] for item in ledger["findings"]]
        if report.get("requirement_ids") != requirement_ids:
            mismatches["requirement_ids"] = {
                "expected": requirement_ids,
                "actual": report.get("requirement_ids"),
            }
        if report.get("finding_ids") != finding_ids:
            mismatches["finding_ids"] = {"expected": finding_ids, "actual": report.get("finding_ids")}
        if mismatches:
            raise ValueError(f"Code review report fields do not match this exact contract/snapshot: {mismatches}")
    except (KeyError, OSError, UnicodeError, json.JSONDecodeError, TypeError, ValueError) as exc:
        add(issues, "CODE_REVIEW_EVIDENCE_INVALID", "ledger.code_review", str(exc))
    return issues


def evidence_command_key(record: dict[str, Any]) -> tuple[tuple[str, ...], str, str] | None:
    cmd = record.get("cmd")
    argv = record.get("argv")
    context = evidence_execution_context(record)
    if (
        not nonempty_string(cmd)
        or not isinstance(argv, list)
        or not argv
        or not all(isinstance(item, str) and item for item in argv)
        or context is None
    ):
        return None
    return tuple(argv), cmd, context[1]


def red_green_pair_issues(ledger: dict[str, Any]) -> list[Issue]:
    issues: list[Issue] = []
    repo_root = Path(ledger["snapshot"]["repo_root"]).resolve()
    run_path = repo_root / ".evidence" / ledger["run_id"]
    try:
        records: list[dict[str, Any]] = []
        for artifact_path in sorted(run_path.glob("*.json")):
            artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
            if isinstance(artifact, dict) and artifact.get("schema") == "evidence/v1":
                records.append(artifact)
        requirement_slices = {
            requirement_id: slice_item["id"]
            for slice_item in ledger["slices"]
            for requirement_id in slice_item["requirement_ids"]
        }
        finding_slices = {
            finding_id: slice_item["id"]
            for slice_item in ledger["slices"]
            for finding_id in slice_item["finding_ids"]
        }
        slice_worktrees = {
            slice_item["id"]: normalized_path_text(str(Path(slice_item["worktree"]).resolve()))
            for slice_item in ledger["slices"]
        }
        main_workdir = normalized_path_text(str(repo_root.resolve()))
        referenced: list[tuple[str, str, str]] = []
        for requirement in ledger["requirements"]:
            for evidence in requirement["final_check"].get("evidence", []):
                evidence_ref = evidence.get("path") if isinstance(evidence, dict) else evidence
                if nonempty_string(evidence_ref):
                    referenced.append(
                        (requirement_slices[requirement["id"]], evidence_ref, f"requirement {requirement['id']}")
                    )
        for finding in ledger["findings"]:
            for test in finding.get("tests", []):
                if isinstance(test, dict) and nonempty_string(test.get("evidence_ref")):
                    referenced.append(
                        (finding_slices[finding["id"]], test["evidence_ref"], f"finding {finding['id']}")
                    )
        referenced_slices = {slice_id for slice_id, _, _ in referenced}
        for slice_item in ledger["slices"]:
            if slice_item["id"] not in referenced_slices:
                add(
                    issues,
                    "RED_GREEN_COMMAND_MISMATCH",
                    f"ledger.slices[{slice_item['id']}]",
                    "Every alignment slice must contain at least one REQ/Finding-referenced local evidence artifact.",
                )
        for slice_id, evidence_ref, owner in referenced:
            evidence_path = Path(evidence_ref)
            if not evidence_path.is_absolute():
                evidence_path = repo_root / evidence_path
            green = json.loads(evidence_path.resolve().read_text(encoding="utf-8"))
            key = evidence_command_key(green) if isinstance(green, dict) else None
            green_context = evidence_execution_context(green) if isinstance(green, dict) else None
            green_valid = (
                isinstance(green, dict)
                and green.get("schema") == "evidence/v1"
                and green.get("run_id") == ledger["run_id"]
                and green.get("slice") == slice_id
                and green.get("phase") in {"green", "slice", "full", "merge", "cr"}
                and isinstance(green.get("seq"), int)
                and green.get("exit_code") == 0
                and green.get("expectation_met") is True
                and key is not None
                and green_context is not None
                and green_context[0] == main_workdir
            )
            matched = green_valid and any(
                red.get("schema") == "evidence/v1"
                and red.get("run_id") == ledger["run_id"]
                and red.get("slice") == slice_id
                and red.get("phase") == "red"
                and isinstance(red.get("seq"), int)
                and red.get("exit_code") != 0
                and red.get("expectation_met") is True
                and evidence_command_key(red) == key
                and evidence_execution_context(red) is not None
                and evidence_execution_context(red)[0] in {main_workdir, slice_worktrees[slice_id]}
                and red["seq"] < green["seq"]
                for red in records
            )
            if not matched:
                add(
                    issues,
                    "RED_GREEN_COMMAND_MISMATCH",
                    f"{owner}.evidence",
                    "Each referenced local evidence artifact requires its own same-argv/cmd/relative-cwd, snapshot-main-worktree, current-run, expectation-met RED(nonzero) before a main-worktree GREEN(zero); foreign/linked worktrees, unrelated pairs, and missing execution context are invalid.",
                )
    except (KeyError, OSError, UnicodeError, json.JSONDecodeError, TypeError, ValueError) as exc:
        add(issues, "RED_GREEN_COMMAND_MISMATCH", "ledger.slices", str(exc))
    return issues


def live_gate_check_issues(ledger: dict[str, Any], gate_check_path: Path) -> list[Issue]:
    issues: list[Issue] = []
    evidence_gate = ledger["evidence_gate"]
    repo_root = Path(ledger["snapshot"]["repo_root"]).resolve()
    try:
        tool_path = gate_check_path.resolve()
        recorded_tool = Path(evidence_gate["tool_path"]).resolve()
        trusted_tool = (Path(__file__).resolve().parents[2] / "_bin" / "gate-check").resolve()
        if tool_path != trusted_tool or recorded_tool != trusted_tool:
            add(
                issues,
                "UNTRUSTED_GATE_CHECK",
                "ledger.evidence_gate.tool_path",
                f"Use the immutable sibling suite gate-check at {trusted_tool}; CLI and ledger must match it.",
            )
            return issues
        if sha256_file(tool_path) != evidence_gate.get("tool_sha256"):
            raise ValueError("gate-check tool SHA-256 does not match the frozen dependency record.")
        slice_ids = evidence_gate["slice_ids"]
        command = [
            sys.executable,
            str(tool_path),
            "batch",
            "--repo",
            str(repo_root),
            "--run",
            ledger["run_id"],
            "--slices",
            ",".join(slice_ids),
            "--strict-red",
            "--json",
        ]
        child_env = os.environ.copy()
        child_env["PYTHONUTF8"] = "1"
        child_env["PYTHONIOENCODING"] = "utf-8"
        result = subprocess.run(
            command,
            cwd=repo_root,
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=child_env,
            check=False,
            timeout=300,
        )
        if result.returncode != 0:
            raise ValueError(f"Live gate-check exited {result.returncode}: {result.stdout.strip() or result.stderr.strip()}")
        report = json.loads(result.stdout)
        if not isinstance(report, dict) or not isinstance(report.get("slices"), list):
            raise ValueError("Live gate-check did not return a batch JSON object.")
        live_slice_ids = [item.get("slice") for item in report["slices"] if isinstance(item, dict)]
        if (
            report.get("gate") != "batch"
            or report.get("status") != "PASS"
            or report.get("run_id") != ledger["run_id"]
            or set(live_slice_ids) != set(slice_ids)
            or len(live_slice_ids) != len(set(live_slice_ids))
            or any(item.get("status") != "PASS" for item in report["slices"] if isinstance(item, dict))
        ):
            raise ValueError("Live gate-check did not prove PASS for the exact run and slices.")
    except (
        KeyError,
        OSError,
        UnicodeError,
        json.JSONDecodeError,
        subprocess.SubprocessError,
        TypeError,
        ValueError,
    ) as exc:
        add(issues, "LIVE_EVIDENCE_GATE_FAILED", "ledger.evidence_gate", str(exc))
    return issues


def gate_issues(contract: dict[str, Any], ledger: dict[str, Any], level: str) -> list[Issue]:
    issues: list[Issue] = []
    roles = ledger["roles"]
    verifier = roles["verifier"]
    verifier_id = verifier["id"]
    implementer_ids = {item["id"] for item in roles.get("implementers", [])}
    audit_collectors = roles.get("audit_collectors", [])
    plan_collectors = roles.get("plan_collectors", [])
    collectors = [*audit_collectors, *plan_collectors]
    all_role_id_values = [
        roles["orchestrator"]["id"],
        roles["auditor"]["id"],
        roles["planner"]["id"],
        *[item["id"] for item in collectors],
        *[item["id"] for item in roles.get("implementers", [])],
        roles["code_reviewer"]["id"],
        verifier_id,
    ]
    reviewers_are_read_only = all(
        roles[role].get("read_only") is True
        for role in ("auditor", "planner", "code_reviewer", "verifier")
    ) and all(item.get("read_only") is True for item in collectors)
    if (
        len(all_role_id_values) != len(set(all_role_id_values))
        or not reviewers_are_read_only
        or verifier.get("fresh_context") is not True
    ):
        add(
            issues,
            "ROLE_SEPARATION",
            "ledger.roles",
            "All role and collector identities must be unique; collectors and auditor/planner/code_reviewer/verifier must be read-only and verifier fresh-context.",
        )
    issues.extend(code_review_issues(ledger))
    forbidden_external_authority_ids = set(all_role_id_values)

    role_ids = {
        "orchestrator": {roles["orchestrator"]["id"]},
        "auditor": {roles["auditor"]["id"]},
        "planner": {roles["planner"]["id"]},
        "implementer": implementer_ids,
        "code_reviewer": {roles["code_reviewer"]["id"]},
        "verifier": {verifier_id},
    }
    registered_actor_pairs = {
        (role_name, role_id) for role_name, ids in role_ids.items() for role_id in ids
    }
    expected_transition_roles = {
        "OPEN": "auditor",
        "PLANNED": "planner",
        "IMPLEMENTED": "implementer",
        "LOCAL_VERIFIED": "verifier",
        "EXTERNAL_VERIFIED": "verifier",
        "REOPENED": "verifier",
        "ACCEPTED_RISK": "user",
    }
    for finding_index, finding in enumerate(ledger["findings"]):
        for history_index, transition in enumerate(finding["history"]):
            if not isinstance(transition, dict):
                continue
            transition_path = f"ledger.findings[{finding_index}].history[{history_index}]"
            actor_pair = (transition.get("actor_role"), transition.get("actor_id"))
            to_status = transition.get("to")
            expected_role = expected_transition_roles.get(to_status)
            if expected_role == "user":
                valid_actor = actor_pair[0] == "user" and nonempty_string(actor_pair[1])
            elif expected_role is not None:
                valid_actor = actor_pair[0] == expected_role and actor_pair[1] in role_ids[expected_role]
            elif to_status == "BLOCKED":
                valid_actor = actor_pair in registered_actor_pairs
            else:
                valid_actor = False
            if not valid_actor:
                add(
                    issues,
                    "TRANSITION_AUTHORITY",
                    transition_path,
                    f"{to_status} transition is not authorized for role/id {actor_pair!r}.",
                )

    finding_ids = {finding["id"] for finding in ledger["findings"]}
    requirement_ids = {requirement["id"] for requirement in ledger["requirements"]}
    slice_ids: list[str] = []
    slices = ledger.get("slices")
    mapped_findings: list[str] = []
    mapped_requirements: list[str] = []
    slice_by_finding: dict[str, str] = {}
    slice_by_requirement: dict[str, str] = {}
    snapshot_repo_root = Path(ledger["snapshot"]["repo_root"]).resolve()
    if not nonempty_list(slices):
        add(issues, "EVIDENCE_SLICE_COVERAGE", "ledger.slices", "At least one verification slice is required.")
        slices = []
    for index, slice_item in enumerate(slices):
        path = f"ledger.slices[{index}]"
        if not isinstance(slice_item, dict) or not nonempty_string(slice_item.get("id")):
            add(issues, "EVIDENCE_SLICE_COVERAGE", path, "Each slice requires a stable ID.")
            continue
        if not SLICE_ID.fullmatch(slice_item["id"]):
            add(issues, "EVIDENCE_SLICE_COVERAGE", f"{path}.id", "Slice ID contains unsupported characters.")
            continue
        slice_ids.append(slice_item["id"])
        worktree = slice_item.get("worktree")
        if not nonempty_string(worktree) or not Path(worktree).is_absolute():
            add(
                issues,
                "EVIDENCE_SLICE_COVERAGE",
                f"{path}.worktree",
                "Each slice must bind the absolute implementation worktree recorded by the orchestrator.",
            )
        elif normalized_path_text(str(Path(worktree).resolve())) != normalized_path_text(str(snapshot_repo_root)):
            add(
                issues,
                "EVIDENCE_SLICE_COVERAGE",
                f"{path}.worktree",
                "This alignment workflow serializes implementation in the snapshot main worktree; linked or foreign worktrees are invalid.",
            )
        slice_findings = slice_item.get("finding_ids")
        slice_requirements = slice_item.get("requirement_ids")
        if not isinstance(slice_findings, list) or not all(nonempty_string(value) for value in slice_findings):
            add(issues, "EVIDENCE_SLICE_COVERAGE", f"{path}.finding_ids", "Finding IDs must be a string list.")
        else:
            mapped_findings.extend(slice_findings)
            for finding_id in slice_findings:
                slice_by_finding[finding_id] = slice_item["id"]
        if not nonempty_list(slice_requirements) or not all(nonempty_string(value) for value in slice_requirements):
            add(
                issues,
                "EVIDENCE_SLICE_COVERAGE",
                f"{path}.requirement_ids",
                "Each slice must map one or more requirement IDs.",
            )
        else:
            mapped_requirements.extend(slice_requirements)
            for requirement_id in slice_requirements:
                slice_by_requirement[requirement_id] = slice_item["id"]

    for label, expected, mapped in (
        ("finding", finding_ids, mapped_findings),
        ("requirement", requirement_ids, mapped_requirements),
    ):
        duplicates = sorted({value for value in mapped if mapped.count(value) > 1})
        if set(mapped) != expected or duplicates:
            add(
                issues,
                "EVIDENCE_SLICE_COVERAGE",
                "ledger.slices",
                f"Every {label} must map to exactly one slice; missing={sorted(expected - set(mapped))}, "
                f"extra={sorted(set(mapped) - expected)}, duplicate={duplicates}.",
            )
    if len(slice_ids) != len(set(slice_ids)):
        add(issues, "EVIDENCE_SLICE_COVERAGE", "ledger.slices", "Slice IDs must be unique.")
    issues.extend(red_green_pair_issues(ledger))

    evidence_gate = ledger.get("evidence_gate")
    if not isinstance(evidence_gate, dict):
        add(issues, "EVIDENCE_GATE_FAILED", "ledger.evidence_gate", "Orchestrator batch gate result is required.")
    else:
        if evidence_gate.get("exit_code") != 0:
            add(issues, "EVIDENCE_GATE_FAILED", "ledger.evidence_gate.exit_code", "gate-check batch must exit 0.")
        for field in ("command", "checked_at"):
            if not nonempty_string(evidence_gate.get(field)):
                add(issues, "EVIDENCE_GATE_FAILED", f"ledger.evidence_gate.{field}", "A non-empty value is required.")
        if evidence_gate.get("checked_by") != roles["orchestrator"]["id"]:
            add(issues, "EVIDENCE_GATE_FAILED", "ledger.evidence_gate.checked_by", "Orchestrator must rerun the batch gate.")
        if evidence_gate.get("run_id") != ledger["run_id"]:
            add(
                issues,
                "EVIDENCE_RUN_MISMATCH",
                "ledger.evidence_gate.run_id",
                "Batch gate run_id must exactly match ledger.run_id.",
            )
        gate_slice_ids = evidence_gate.get("slice_ids")
        if (
            not isinstance(gate_slice_ids, list)
            or set(gate_slice_ids) != set(slice_ids)
            or len(gate_slice_ids) != len(set(gate_slice_ids))
        ):
            add(
                issues,
                "EVIDENCE_SLICE_COVERAGE",
                "ledger.evidence_gate.slice_ids",
                "Batch gate slice IDs must exactly match ledger.slices.",
            )
        command = evidence_gate.get("command", "")
        command_run = command_option(command, "run") if isinstance(command, str) else None
        command_repo = command_option(command, "repo") if isinstance(command, str) else None
        command_slices = command_option(command, "slices") if isinstance(command, str) else None
        parsed_slice_ids = command_slices.split(",") if command_slices else []
        command_valid = (
            isinstance(command, str)
            and "gate-check" in command
            and re.search(r"(?:^|\s)batch(?:\s|$)", command) is not None
            and command_run == ledger["run_id"]
            and command_repo is not None
            and normalized_path_text(command_repo) == normalized_path_text(ledger["snapshot"]["repo_root"])
            and set(parsed_slice_ids) == set(slice_ids)
            and len(parsed_slice_ids) == len(set(parsed_slice_ids))
            and "--strict-red" in command
            and "--json" in command
        )
        if not command_valid:
            add(
                issues,
                "EVIDENCE_GATE_FAILED",
                "ledger.evidence_gate.command",
                "Command must bind gate-check batch to the exact repo, run ID, comma-separated slice IDs, strict-red, and JSON output.",
            )
        issues.extend(
            gate_output_issues(
                evidence_gate,
                Path(ledger["snapshot"]["repo_root"]).resolve(),
                ledger["run_id"],
                set(slice_ids),
            )
        )

    contract_map = {item["id"]: item for item in contract["items"]}
    repo_root = Path(ledger["snapshot"]["repo_root"]).resolve()
    expected_head = ledger["snapshot"]["head"]
    approved_plan_path = Path(ledger["plan"]["path"])
    if not approved_plan_path.is_absolute():
        approved_plan_path = repo_root / approved_plan_path
    approved_plan_text = approved_plan_path.read_text(encoding="utf-8")
    verdict = ledger["final_verdict"]
    claiming_full = verdict["status"] == "FULLY_VERIFIED"
    enforce_external = level == "external" or claiming_full
    for index, requirement in enumerate(ledger["requirements"]):
        path = f"ledger.requirements[{index}].final_check"
        final_check = requirement["final_check"]
        required_level = contract_map[requirement["id"]]["required_verification"]
        status = final_check["status"]
        if status not in {"LOCAL_VERIFIED", "EXTERNAL_VERIFIED"}:
            add(issues, "REQUIREMENT_NOT_VERIFIED", f"{path}.status", f"{requirement['id']} is {status}.")
        if final_check.get("verifier_id") != verifier_id:
            add(issues, "VERIFIER_MISMATCH", f"{path}.verifier_id", "Final check must be recorded by the assigned verifier.")
        if status in {"LOCAL_VERIFIED", "EXTERNAL_VERIFIED"}:
            issues.extend(
                local_evidence_issues(
                    final_check.get("evidence"),
                    f"{path}.evidence",
                    repo_root,
                    ledger["run_id"],
                    expected_head,
                    slice_by_requirement.get(requirement["id"]),
                    contract_map[requirement["id"]]["local_verification_policy"]["cwd"],
                    expected_criterion=contract_map[requirement["id"]]["local_verification_policy"]["criterion"],
                    allowed_commands=set(
                        contract_map[requirement["id"]]["local_verification_policy"]["commands"]
                    ),
                    approved_plan_text=approved_plan_text,
                )
            )
        if status == "EXTERNAL_VERIFIED" and required_level != "external":
            add(issues, "EXTERNAL_STATUS_INVALID", f"{path}.status", "Only external contract requirements may use EXTERNAL_VERIFIED.")
        if required_level == "external":
            if enforce_external and status != "EXTERNAL_VERIFIED":
                add(issues, "EXTERNAL_ACCEPTANCE_MISSING", f"{path}.status", f"{requirement['id']} requires external verification.")
            must_validate_external = enforce_external or status == "EXTERNAL_VERIFIED"
            if must_validate_external and not any(
                item.get("result") == "PASS"
                for item in final_check.get("external_acceptance", [])
                if isinstance(item, dict)
            ):
                add(issues, "EXTERNAL_ACCEPTANCE_MISSING", f"{path}.external_acceptance", "No PASS result is recorded.")
            if must_validate_external:
                for acceptance_index, acceptance in enumerate(final_check.get("external_acceptance", [])):
                    if isinstance(acceptance, dict):
                        issues.extend(
                            external_evidence_issues(
                                acceptance,
                                f"{path}.external_acceptance[{acceptance_index}]",
                                repo_root,
                                ledger["run_id"],
                                expected_head,
                                {slice_by_requirement.get(requirement["id"])},
                                forbidden_external_authority_ids,
                                [contract_map[requirement["id"]].get("external_acceptance_policy", {})],
                            )
                        )

    for index, finding in enumerate(ledger["findings"]):
        path = f"ledger.findings[{index}]"
        required_external = any(
            contract_map[requirement_id]["required_verification"] == "external"
            for requirement_id in finding["requirement_ids"]
        )
        accepted = {"LOCAL_VERIFIED", "EXTERNAL_VERIFIED"}
        if finding["status"] not in accepted:
            add(issues, "FINDING_NOT_VERIFIED", f"{path}.status", f"{finding['id']} is {finding['status']}.")
        if finding["status"] == "EXTERNAL_VERIFIED" and not required_external:
            add(issues, "EXTERNAL_STATUS_INVALID", f"{path}.status", "Finding is not linked to an external contract requirement.")
        if enforce_external and required_external and finding["status"] != "EXTERNAL_VERIFIED":
            add(issues, "EXTERNAL_ACCEPTANCE_MISSING", f"{path}.status", f"{finding['id']} requires external verification.")
        if required_external and (enforce_external or finding["status"] == "EXTERNAL_VERIFIED"):
            for acceptance_index, acceptance in enumerate(finding.get("external_acceptance", [])):
                if isinstance(acceptance, dict):
                    issues.extend(
                        external_evidence_issues(
                            acceptance,
                            f"{path}.external_acceptance[{acceptance_index}]",
                            repo_root,
                            ledger["run_id"],
                            expected_head,
                            {slice_by_finding.get(finding["id"])},
                            forbidden_external_authority_ids,
                            [
                                contract_map[requirement_id].get("external_acceptance_policy", {})
                                for requirement_id in finding["requirement_ids"]
                                if contract_map[requirement_id]["required_verification"] == "external"
                            ],
                        )
                    )
        if finding["status"] in accepted:
            last = finding["history"][-1]
            if last.get("actor_role") != "verifier" or last.get("actor_id") != verifier_id:
                add(issues, "VERIFIER_MISMATCH", f"{path}.history[-1]", "Verification transition must be made by the assigned verifier.")
            for test_index, test in enumerate(finding.get("tests", [])):
                if isinstance(test, dict):
                    matching_cwds = {
                        contract_map[requirement_id]["local_verification_policy"]["cwd"]
                        for requirement_id in finding["requirement_ids"]
                        if test.get("command")
                        in contract_map[requirement_id]["local_verification_policy"]["commands"]
                    }
                    if len(matching_cwds) != 1:
                        add(
                            issues,
                            "LOCAL_POLICY_MISMATCH",
                            f"{path}.tests[{test_index}].command",
                            "A finding test command must resolve to exactly one frozen repository-relative cwd.",
                        )
                        continue
                    issues.extend(
                        local_evidence_issues(
                            [test.get("evidence_ref")],
                            f"{path}.tests[{test_index}].evidence_ref",
                            repo_root,
                            ledger["run_id"],
                            expected_head,
                            slice_by_finding.get(finding["id"]),
                            next(iter(matching_cwds)),
                            test.get("command"),
                            allowed_commands={
                                command
                                for requirement_id in finding["requirement_ids"]
                                for command in contract_map[requirement_id]["local_verification_policy"]["commands"]
                            },
                            approved_plan_text=approved_plan_text,
                        )
                    )

    full_claim_incomplete = any(
        contract_map[requirement["id"]]["required_verification"] == "external"
        and (
            requirement["final_check"]["status"] != "EXTERNAL_VERIFIED"
            or not any(
                item.get("result") == "PASS"
                for item in requirement["final_check"].get("external_acceptance", [])
                if isinstance(item, dict)
            )
        )
        for requirement in ledger["requirements"]
    ) or any(
        any(contract_map[requirement_id]["required_verification"] == "external" for requirement_id in finding["requirement_ids"])
        and finding["status"] != "EXTERNAL_VERIFIED"
        for finding in ledger["findings"]
    )
    if level == "local" and claiming_full and full_claim_incomplete:
        add(
            issues,
            "FINAL_VERDICT_MISMATCH",
            "ledger.final_verdict.status",
            "FULLY_VERIFIED is invalid while any external requirement or finding lacks external verification.",
        )

    expected_verdicts = {"LOCALLY_VERIFIED", "FULLY_VERIFIED"} if level == "local" else {"FULLY_VERIFIED"}
    if verdict["status"] not in expected_verdicts:
        add(issues, "FINAL_VERDICT_MISMATCH", "ledger.final_verdict.status", f"{level} gate requires one of {sorted(expected_verdicts)}.")
    if verdict.get("declared_by") != verifier_id:
        add(issues, "VERIFIER_MISMATCH", "ledger.final_verdict.declared_by", "Final verdict must be declared by the assigned verifier.")
    return issues


def emit(status: str, command: str, issues: Iterable[Issue], as_json: bool, level: str | None = None) -> None:
    issue_list = list(issues)
    payload: dict[str, Any] = {
        "status": status,
        "command": command,
        "issue_count": len(issue_list),
        "issues": [asdict(issue) for issue in issue_list],
    }
    if level is not None:
        payload["level"] = level
    if as_json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return
    print(f"{status}: {command}" + (f" ({level})" if level else ""))
    for issue in issue_list:
        print(f"- [{issue.code}] {issue.path}: {issue.message}")


def configure_utf8_stdio() -> None:
    """Keep the CLI JSON/text protocol deterministic on Windows pipes and redirection."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="replace")


def load_and_check(contract_path: Path, ledger_path: Path) -> tuple[dict[str, Any] | None, dict[str, Any] | None, list[Issue]]:
    contract, contract_load_issues = load_json(contract_path, "contract")
    ledger, ledger_load_issues = load_json(ledger_path, "ledger")
    issues = contract_load_issues + ledger_load_issues
    if contract is None or ledger is None:
        return contract, ledger, issues
    contract_issues, contract_items = validate_contract(contract)
    issues.extend(contract_issues)
    if contract_items:
        issues.extend(validate_ledger_structure(contract_path, ledger_path, contract_items, ledger))
    return contract, ledger, issues


def make_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    hash_parser = subparsers.add_parser("hash", help="Print the SHA-256 of a frozen contract file.")
    hash_parser.add_argument("--contract", type=Path, required=True)
    hash_parser.add_argument("--json", action="store_true")

    snapshot_parser = subparsers.add_parser("snapshot", help="Capture the current Git state used by final verification.")
    snapshot_parser.add_argument("--repo", type=Path, required=True)
    snapshot_parser.add_argument("--exclude", action="append", default=[])
    snapshot_parser.add_argument("--json", action="store_true")

    check_parser = subparsers.add_parser("check", help="Validate contract and ledger structure.")
    check_parser.add_argument("--contract", type=Path, required=True)
    check_parser.add_argument("--ledger", type=Path, required=True)
    check_parser.add_argument("--json", action="store_true")

    gate_parser = subparsers.add_parser("gate", help="Evaluate local or external completion.")
    gate_parser.add_argument("--level", choices=("local", "external"), required=True)
    gate_parser.add_argument("--contract", type=Path, required=True)
    gate_parser.add_argument("--ledger", type=Path, required=True)
    gate_parser.add_argument("--gate-check", type=Path, required=True, help="Path to this suite's skills/_bin/gate-check.")
    gate_parser.add_argument("--json", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    configure_utf8_stdio()
    args = make_parser().parse_args(argv)
    if args.command == "hash":
        try:
            digest = sha256_file(args.contract)
        except OSError as exc:
            emit("INVALID", "hash", [Issue("FILE_ERROR", "contract", str(exc))], args.json)
            return 2
        if args.json:
            print(json.dumps({"status": "PASS", "command": "hash", "sha256": digest}, indent=2))
        else:
            print(digest)
        return 0

    if args.command == "snapshot":
        try:
            snapshot = repository_snapshot(args.repo, args.exclude)
        except (OSError, UnicodeError, ValueError) as exc:
            emit("INVALID", "snapshot", [Issue("SNAPSHOT_ERROR", "repo", str(exc))], args.json)
            return 2
        payload = {"status": "PASS", "command": "snapshot", "snapshot": snapshot}
        if args.json:
            print(json.dumps(payload, ensure_ascii=False, indent=2))
        else:
            print(json.dumps(snapshot, ensure_ascii=False, indent=2))
        return 0

    try:
        contract, ledger, structural_issues = load_and_check(args.contract, args.ledger)
    except (KeyError, OSError, TypeError, UnicodeError, ValueError) as exc:
        emit(
            "INVALID",
            args.command,
            [Issue("MALFORMED_INPUT", "ledger", f"Input could not be validated safely: {exc}")],
            args.json,
            getattr(args, "level", None),
        )
        return 2
    if structural_issues:
        emit("INVALID", args.command, structural_issues, args.json, getattr(args, "level", None))
        return 2
    if args.command == "check":
        emit("PASS", "check", [], args.json)
        return 0

    assert contract is not None and ledger is not None
    completion_issues = gate_issues(contract, ledger, args.level)
    completion_issues.extend(live_gate_check_issues(ledger, args.gate_check))
    if completion_issues:
        emit("FAIL", "gate", completion_issues, args.json, args.level)
        return 1
    emit("PASS", "gate", [], args.json, args.level)
    return 0


if __name__ == "__main__":
    sys.exit(main())
