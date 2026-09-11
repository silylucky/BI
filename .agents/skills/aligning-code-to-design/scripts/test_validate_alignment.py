import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path


SCRIPT = Path(__file__).with_name("validate_alignment.py")


def dump_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=repo, capture_output=True, text=True, encoding="utf-8", check=True
    )
    return result.stdout.strip()


def repo_state_sha256(repo: Path, excluded: list[str]) -> str:
    pathspecs = [".", *[f":(exclude){value}/**" for value in excluded]]
    diff = subprocess.run(
        ["git", "diff", "--binary", "HEAD", "--", *pathspecs],
        cwd=repo,
        capture_output=True,
        check=True,
    ).stdout
    untracked_raw = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard", "-z"],
        cwd=repo,
        capture_output=True,
        check=True,
    ).stdout
    untracked = []
    for raw in untracked_raw.split(b"\0"):
        if not raw:
            continue
        rel = raw.decode("utf-8").replace("\\", "/")
        if any(rel == item or rel.startswith(item.rstrip("/") + "/") for item in excluded):
            continue
        untracked.append(rel)
    digest = hashlib.sha256()
    digest.update(git(repo, "rev-parse", "HEAD").encode("utf-8"))
    digest.update(b"\0")
    digest.update(diff)
    for rel in sorted(untracked):
        digest.update(b"\0")
        digest.update(rel.encode("utf-8"))
        digest.update(b"\0")
        digest.update((repo / rel).read_bytes())
    return digest.hexdigest()


class AlignmentGateTests(unittest.TestCase):
    def setUp(self) -> None:
        temp_root = Path(__file__).with_name(".test-tmp")
        temp_root.mkdir(exist_ok=True)
        self.tempdir = tempfile.TemporaryDirectory(prefix="alignment repo ", dir=temp_root, ignore_cleanup_errors=True)
        self.root = Path(self.tempdir.name)
        git(self.root, "init")
        git(self.root, "config", "user.email", "alignment@example.test")
        git(self.root, "config", "user.name", "Alignment Test")
        (self.root / "app.txt").write_text("baseline\n", encoding="utf-8")
        git(self.root, "add", "app.txt")
        git(self.root, "commit", "-m", "baseline")

        self.run_id = "20260804-canopy-resource-model"
        self.run_rel = f"docs/material/design-alignment/{self.run_id}"
        self.run_dir = self.root / self.run_rel
        self.run_dir.mkdir(parents=True)
        self.contract_path = self.run_dir / "contract.json"
        self.ledger_path = self.run_dir / "ledger.json"
        self.plan_path = self.root / "docs/specs/canopy-resource-model-alignment.md"
        self.plan_path.parent.mkdir(parents=True)

        self.contract = {
            "schema_version": "1.0",
            "contract_id": "canopy-resource-model-v1",
            "title": "Canopy resource model alignment",
            "approval": {
                "status": "FROZEN",
                "authority": "user",
                "approved_by": "user",
                "approved_at": "2026-08-04T10:00:00+08:00",
            },
            "source_refs": ["conversation:approved-design"],
            "source_coverage": [
                {
                    "id": "SRC-001",
                    "source_ref": "conversation:approved-design",
                    "source_item": "Provider-neutral tenant request",
                    "disposition": "INCLUDED",
                    "requirement_ids": ["REQ-001"],
                },
                {
                    "id": "SRC-002",
                    "source_ref": "conversation:approved-design",
                    "source_item": "Real OpenStack project isolation",
                    "disposition": "INCLUDED",
                    "requirement_ids": ["REQ-002"],
                },
            ],
            "items": [
                {
                    "id": "REQ-001",
                    "statement": "Tenant-facing resources are provider-neutral.",
                    "acceptance_criteria": ["API does not require a provider type."],
                    "required_verification": "local",
                    "local_verification_policy": {
                        "criterion": "API does not require a provider type.",
                        "cwd": ".",
                        "commands": ["go test ./adapter/..."],
                    },
                },
                {
                    "id": "REQ-002",
                    "statement": "OpenStack project mapping is accepted in a real environment.",
                    "acceptance_criteria": ["Create and query a scoped resource."],
                    "required_verification": "external",
                    "local_verification_policy": {
                        "criterion": "OpenStack adapter contract tests pass.",
                        "cwd": ".",
                        "commands": ["go test ./adapter/..."],
                    },
                    "external_acceptance_policy": {
                        "environment": "openstack-staging",
                        "authority_ids": ["environment-owner"],
                        "smoke_command": "python contracts/openstack_smoke.py",
                        "cwd": ".",
                    },
                },
            ],
        }
        dump_json(self.contract_path, self.contract)
        self.contract_hash = sha256(self.contract_path)
        self.plan_matrix = {
            "schema": "design-alignment/plan-matrix/v1",
            "contract_sha256": self.contract_hash,
            "requirements": [
                {
                    "id": "REQ-001",
                    "acceptance_criterion": "API does not require a provider type.",
                    "local_criterion": "API does not require a provider type.",
                    "cwd": ".",
                    "commands": ["go test ./adapter/..."],
                    "finding_ids": [],
                },
                {
                    "id": "REQ-002",
                    "acceptance_criterion": "Create and query a scoped resource.",
                    "local_criterion": "OpenStack adapter contract tests pass.",
                    "cwd": ".",
                    "commands": ["go test ./adapter/..."],
                    "finding_ids": ["ALN-001"],
                },
            ],
            "findings": [
                {"id": "ALN-001", "requirement_ids": ["REQ-002"], "anchor": "ALN-001"}
            ],
        }
        self.plan_path.write_text(
            f"# Canopy resource alignment\n\ncontract_sha256: {self.contract_hash}\n\n"
            "<!-- ALIGNMENT-MATRIX-BEGIN -->\n"
            f"{json.dumps(self.plan_matrix, ensure_ascii=False, indent=2)}\n"
            "<!-- ALIGNMENT-MATRIX-END -->\n\n"
            "## Requirement verification matrix\n\n"
            "- REQ-001 | API does not require a provider type. | go test ./adapter/...\n"
            "- REQ-002 | Create and query a scoped resource. | OpenStack adapter contract tests pass. | go test ./adapter/...\n\n"
            "## ALN-001\n\n"
            "## Unrelated appendix\n\npython -c pass\n",
            encoding="utf-8",
        )
        git(self.root, "add", "docs/specs/canopy-resource-model-alignment.md")
        git(self.root, "commit", "-m", "add alignment spec")
        self.repo_head = git(self.root, "rev-parse", "HEAD")
        self.repo_branch = git(self.root, "branch", "--show-current")
        self.state_sha256 = repo_state_sha256(self.root, [self.run_rel, ".evidence"])
        self.red_evidence_path = self.root / ".evidence" / self.run_id / "001-align-001-red-tests.json"
        self.local_evidence_path = self.root / ".evidence" / self.run_id / "002-align-001-green-tests.json"
        self.local_evidence_path.parent.mkdir(parents=True, exist_ok=True)
        dump_json(
            self.red_evidence_path,
            {
                "schema": "evidence/v1",
                "run_id": self.run_id,
                "seq": 1,
                "slice": "align-001",
                "phase": "red",
                "label": "adapter contract tests fail before implementation",
                "cmd": "go test ./adapter/...",
                "argv": ["go", "test", "./adapter/..."],
                "cwd": str(self.root),
                "workdir": str(self.root),
                "exit_code": 1,
                "expect_fail": True,
                "expectation_met": True,
                "git_sha": self.repo_head,
                "git_branch": self.repo_branch,
                "git_dirty": False,
                "test_stats": {"total": 2, "passed": 0, "failed": 2},
            },
        )
        dump_json(
            self.local_evidence_path,
            {
                "schema": "evidence/v1",
                "run_id": self.run_id,
                "seq": 2,
                "slice": "align-001",
                "phase": "green",
                "label": "adapter contract tests pass after implementation",
                "cmd": "go test ./adapter/...",
                "argv": ["go", "test", "./adapter/..."],
                "cwd": str(self.root),
                "workdir": str(self.root),
                "exit_code": 0,
                "expect_fail": False,
                "expectation_met": True,
                "git_sha": self.repo_head,
                "git_branch": self.repo_branch,
                "git_dirty": False,
                "test_stats": {"total": 2, "passed": 2, "failed": 0},
            },
        )
        self.local_evidence_ref = str(self.local_evidence_path.relative_to(self.root)).replace("\\", "/")
        self.gate_report_path = self.run_dir / "gate-check-batch.json"
        dump_json(
            self.gate_report_path,
            {
                "gate": "batch",
                "status": "PASS",
                "reasons": [],
                "evidence": ["align-001: PASS"],
                "slices": [
                    {"gate": "slice", "slice": "align-001", "status": "PASS", "reasons": [], "evidence": []}
                ],
                "run_id": self.run_id,
            },
        )
        self.gate_report_ref = str(self.gate_report_path.relative_to(self.root)).replace("\\", "/")
        self.gate_check_tool = SCRIPT.resolve().parents[2] / "_bin" / "gate-check"
        self.assertTrue(self.gate_check_tool.is_file(), f"Missing real suite gate-check: {self.gate_check_tool}")
        self.code_review_path = self.run_dir / "code-review.json"
        dump_json(
            self.code_review_path,
            {
                "schema": "design-alignment/code-review/v1",
                "status": "DONE",
                "reviewer_id": "session-code-reviewer",
                "read_only": True,
                "contract_sha256": self.contract_hash,
                "git_head": self.repo_head,
                "requirement_ids": ["REQ-001", "REQ-002"],
                "finding_ids": ["ALN-001"],
                "unresolved_finding_ids": [],
                "coverage": {"blind_spots": [], "evidence_read": True},
                "remaining": [],
            },
        )
        self.code_review_ref = str(self.code_review_path.relative_to(self.root)).replace("\\", "/")

        self.ledger = {
            "schema_version": "1.0",
            "run_id": self.run_id,
            "contract": {"path": "contract.json", "sha256": self.contract_hash},
            "plan": {
                "path": "docs/specs/canopy-resource-model-alignment.md",
                "contract_sha256": self.contract_hash,
            },
            "snapshot": {
                "repo_root": str(self.root),
                "branch": self.repo_branch,
                "head": self.repo_head,
                "status_porcelain": "",
                "state_sha256": self.state_sha256,
            },
            "roles": {
                "orchestrator": {"id": "session-orchestrator"},
                "auditor": {"id": "session-auditor", "read_only": True},
                "planner": {"id": "session-planner", "read_only": True},
                "implementers": [{"id": "session-implementer"}],
                "code_reviewer": {"id": "session-code-reviewer", "read_only": True},
                "verifier": {
                    "id": "session-verifier",
                    "read_only": True,
                    "fresh_context": True,
                },
            },
            "requirements": [
                {
                    "id": "REQ-001",
                    "audit_result": "FULL",
                    "finding_ids": [],
                    "audit_evidence": [{"path": "api/resource.api", "line": 10, "claim": "Provider-neutral request."}],
                    "final_check": {
                        "status": "LOCAL_VERIFIED",
                        "verifier_id": "session-verifier",
                        "evidence": [
                            {
                                "path": self.local_evidence_ref,
                                "sha256": sha256(self.local_evidence_path),
                                "command": "go test ./adapter/...",
                                "acceptance_criterion": "API does not require a provider type.",
                            }
                        ],
                        "external_acceptance": [],
                    },
                },
                {
                    "id": "REQ-002",
                    "audit_result": "PARTIAL",
                    "finding_ids": ["ALN-001"],
                    "audit_evidence": [{"path": "adapter/openstack.go", "line": 20, "claim": "Mapping exists but lacks external acceptance."}],
                    "final_check": {
                        "status": "LOCAL_VERIFIED",
                        "verifier_id": "session-verifier",
                        "evidence": [
                            {
                                "path": self.local_evidence_ref,
                                "sha256": sha256(self.local_evidence_path),
                                "command": "go test ./adapter/...",
                                "acceptance_criterion": "OpenStack adapter contract tests pass.",
                            }
                        ],
                        "external_acceptance": [],
                    },
                },
            ],
            "findings": [
                {
                    "id": "ALN-001",
                    "requirement_ids": ["REQ-002"],
                    "summary": "External OpenStack acceptance is missing.",
                    "severity": "P1",
                    "status": "LOCAL_VERIFIED",
                    "plan_ref": "docs/specs/canopy-resource-model-alignment.md#ALN-001",
                    "implementation_evidence": [{"path": "adapter/openstack.go", "line": 20}],
                    "tests": [
                        {
                            "command": "go test ./adapter/...",
                            "exit_code": 0,
                            "evidence_ref": self.local_evidence_ref,
                            "environment": "local",
                        }
                    ],
                    "external_acceptance": [],
                    "history": [
                        {"from": None, "to": "OPEN", "actor_role": "auditor", "actor_id": "session-auditor"},
                        {"from": "OPEN", "to": "PLANNED", "actor_role": "planner", "actor_id": "session-planner"},
                        {"from": "PLANNED", "to": "IMPLEMENTED", "actor_role": "implementer", "actor_id": "session-implementer"},
                        {"from": "IMPLEMENTED", "to": "LOCAL_VERIFIED", "actor_role": "verifier", "actor_id": "session-verifier"},
                    ],
                }
            ],
            "slices": [
                {
                    "id": "align-001",
                    "worktree": str(self.root),
                    "requirement_ids": ["REQ-001", "REQ-002"],
                    "finding_ids": ["ALN-001"],
                }
            ],
            "evidence_gate": {
                "command": f"python <suite-root>/skills/_bin/gate-check batch --repo '{self.root}' --run {self.run_id} --slices align-001 --strict-red --json",
                "exit_code": 0,
                "checked_by": "session-orchestrator",
                "checked_at": "2026-08-04T11:50:00+08:00",
                "run_id": self.run_id,
                "slice_ids": ["align-001"],
                "output_ref": self.gate_report_ref,
                "output_sha256": sha256(self.gate_report_path),
                "tool_path": str(self.gate_check_tool),
                "tool_sha256": sha256(self.gate_check_tool),
            },
            "code_review": {
                "status": "DONE",
                "reviewer_id": "session-code-reviewer",
                "checked_at": "2026-08-04T11:58:00+08:00",
                "report_ref": self.code_review_ref,
                "report_sha256": sha256(self.code_review_path),
            },
            "final_verdict": {
                "status": "LOCALLY_VERIFIED",
                "declared_by": "session-verifier",
                "declared_at": "2026-08-04T12:00:00+08:00",
                "summary": "Local chain verified; external acceptance remains.",
            },
        }
        dump_json(self.ledger_path, self.ledger)

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def run_cli(self, *args: str) -> subprocess.CompletedProcess[str]:
        command = [sys.executable, str(SCRIPT), *args]
        if args and args[0] == "gate":
            command.extend(["--gate-check", str(self.gate_check_tool)])
        command.append("--json")
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )

    def write_ledger(self, ledger: dict) -> None:
        dump_json(self.ledger_path, ledger)

    def make_external_acceptance(self, slice_id: str = "align-001") -> dict:
        artifact_path = self.root / ".evidence" / self.run_id / f"002-{slice_id}-smoke-openstack.json"
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        artifact = {
            "schema": "evidence/v1",
            "run_id": self.run_id,
            "slice": slice_id,
            "phase": "smoke",
            "cmd": "python contracts/openstack_smoke.py",
            "argv": ["python", "contracts/openstack_smoke.py"],
            "cwd": str(self.root),
            "workdir": str(self.root),
            "exit_code": 0,
            "expect_fail": False,
            "expectation_met": True,
            "git_sha": self.repo_head,
            "git_branch": self.repo_branch,
            "git_dirty": False,
        }
        dump_json(artifact_path, artifact)
        artifact_ref = str(artifact_path.relative_to(self.root)).replace("\\", "/")
        artifact_hash = sha256(artifact_path)
        attestation_path = self.root / ".evidence" / self.run_id / f"900-{slice_id}-external-attestation.json"
        attestation = {
            "schema": "design-alignment/external-attestation/v1",
            "raw_evidence_ref": artifact_ref,
            "raw_evidence_sha256": artifact_hash,
            "run_id": self.run_id,
            "slice_id": slice_id,
            "command": artifact["cmd"],
            "git_head": self.repo_head,
            "environment": "openstack-staging",
            "environment_class": "real",
            "result": "PASS",
            "accepted_by": "environment-owner",
            "accepted_at": "2026-08-04T11:55:00+08:00",
        }
        dump_json(attestation_path, attestation)
        return {
            "kind": "real-environment",
            "environment": "openstack-staging",
            "environment_class": "real",
            "result": "PASS",
            "command": artifact["cmd"],
            "exit_code": 0,
            "run_id": self.run_id,
            "slice_id": slice_id,
            "evidence_ref": artifact_ref,
            "evidence_sha256": artifact_hash,
            "attestation_ref": str(attestation_path.relative_to(self.root)).replace("\\", "/"),
            "attestation_sha256": sha256(attestation_path),
            "git_head": self.repo_head,
            "accepted_by": "environment-owner",
            "accepted_at": "2026-08-04T11:55:00+08:00",
        }

    def test_check_accepts_complete_traceability_structure(self) -> None:
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_check_rejects_contract_hash_drift(self) -> None:
        self.contract["items"][0]["statement"] = "Silently changed scope"
        dump_json(self.contract_path, self.contract)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("CONTRACT_HASH_MISMATCH", result.stdout)

    def test_check_rejects_missing_requirement_mapping(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["requirements"] = ledger["requirements"][:1]
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("REQUIREMENT_COVERAGE", result.stdout)

    def test_check_rejects_source_coverage_missing_contract_requirement(self) -> None:
        self.contract["source_coverage"] = self.contract["source_coverage"][1:]
        dump_json(self.contract_path, self.contract)
        ledger = deepcopy(self.ledger)
        ledger["contract"]["sha256"] = sha256(self.contract_path)
        ledger["plan"]["contract_sha256"] = ledger["contract"]["sha256"]
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("SOURCE_COVERAGE", result.stdout)

    def test_check_rejects_wrong_contract_path_even_when_hash_matches(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["contract"]["path"] = "wrong-contract.json"
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("CONTRACT_PATH_MISMATCH", result.stdout)

    def test_check_rejects_missing_plan_artifact(self) -> None:
        self.plan_path.unlink()
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("PLAN_REF_INVALID", result.stdout)

    def test_check_rejects_plan_missing_contract_requirement(self) -> None:
        self.plan_path.write_text(
            f"# Canopy resource alignment\n\ncontract_sha256: {self.contract_hash}\n\n- REQ-002\n\n## ALN-001\n",
            encoding="utf-8",
        )
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("PLAN_REF_INVALID", result.stdout)

    def test_check_rejects_requirement_tokens_only_in_wrong_matrix_entry_or_appendix(self) -> None:
        text = self.plan_path.read_text(encoding="utf-8")
        text = text.replace('"id": "REQ-001"', '"id": "REQ-0010"', 1)
        self.plan_path.write_text(text, encoding="utf-8")
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("PLAN_REF_INVALID", result.stdout)

    def test_check_rejects_wrong_finding_plan_anchor(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["findings"][0]["plan_ref"] = "docs/specs/canopy-resource-model-alignment.md#wrong-anchor"
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("PLAN_REF_INVALID", result.stdout)

    def test_check_rejects_finding_heading_with_anchor_suffix(self) -> None:
        text = self.plan_path.read_text(encoding="utf-8")
        text = text.replace("## ALN-001\n", "## ALN-001 extra text\n", 1)
        self.plan_path.write_text(text, encoding="utf-8")
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("PLAN_REF_INVALID", result.stdout)

    def test_check_rejects_finding_heading_at_wrong_level(self) -> None:
        for heading in ("# ALN-001\n", "### ALN-001\n"):
            with self.subTest(heading=heading.strip()):
                original = self.plan_path.read_text(encoding="utf-8")
                try:
                    self.plan_path.write_text(original.replace("## ALN-001\n", heading, 1), encoding="utf-8")
                    result = self.run_cli(
                        "check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
                    )
                    self.assertEqual(result.returncode, 2)
                    self.assertIn("PLAN_REF_INVALID", result.stdout)
                finally:
                    self.plan_path.write_text(original, encoding="utf-8")

    def test_check_rejects_non_atomic_acceptance_criteria(self) -> None:
        self.contract["items"][0]["acceptance_criteria"].append("A second independent behavior.")
        dump_json(self.contract_path, self.contract)
        ledger = deepcopy(self.ledger)
        ledger["contract"]["sha256"] = sha256(self.contract_path)
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("NON_ATOMIC_REQUIREMENT", result.stdout)

    def test_check_rejects_local_policy_without_cwd(self) -> None:
        contract = deepcopy(self.contract)
        contract["items"][0]["local_verification_policy"].pop("cwd")
        dump_json(self.contract_path, contract)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("LOCAL_POLICY_MISSING", result.stdout)

    def test_check_rejects_external_policy_without_cwd(self) -> None:
        contract = deepcopy(self.contract)
        contract["items"][1]["external_acceptance_policy"].pop("cwd")
        dump_json(self.contract_path, contract)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("EXTERNAL_POLICY_MISSING", result.stdout)

    def test_check_rejects_slice_without_worktree_binding(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["slices"][0].pop("worktree")
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("EVIDENCE_SLICE_COVERAGE", result.stdout)

    def test_check_rejects_invalid_stable_id_shapes(self) -> None:
        self.contract["items"][0]["id"] = "R1"
        dump_json(self.contract_path, self.contract)
        ledger = deepcopy(self.ledger)
        ledger["contract"]["sha256"] = sha256(self.contract_path)
        ledger["requirements"][0]["id"] = "R1"
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("INVALID_ID", result.stdout)

    def test_check_rejects_path_traversal_run_id(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["run_id"] = "../old-run"
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("INVALID_ID", result.stdout)

    def test_check_rejects_non_bidirectional_req_finding_edge(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["findings"][0]["requirement_ids"] = ["REQ-001"]
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("FINDING_EDGE_MISMATCH", result.stdout)

    def test_check_rejects_na_without_user_approval(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["requirements"][1]["audit_result"] = "N/A"
        ledger["requirements"][1]["finding_ids"] = []
        ledger["findings"] = []
        ledger["slices"] = []
        ledger["evidence_gate"] = {}
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("NA_APPROVAL_MISSING", result.stdout)

    def test_check_rejects_non_user_contract_authority(self) -> None:
        self.contract["approval"]["authority"] = "agent"
        dump_json(self.contract_path, self.contract)
        ledger = deepcopy(self.ledger)
        ledger["contract"]["sha256"] = sha256(self.contract_path)
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("APPROVAL_AUTHORITY", result.stdout)

    def test_check_requires_blocker_details(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["requirements"][1]["final_check"] = {
            "status": "BLOCKED",
            "verifier_id": "",
            "evidence": [],
            "external_acceptance": [],
        }
        ledger["findings"][0]["status"] = "BLOCKED"
        ledger["findings"][0]["history"] = [
            {"from": None, "to": "OPEN", "actor_role": "auditor", "actor_id": "session-auditor"},
            {"from": "OPEN", "to": "BLOCKED", "actor_role": "orchestrator", "actor_id": "session-orchestrator"},
        ]
        ledger["final_verdict"]["status"] = "BLOCKED"
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("BLOCKER_DETAILS_MISSING", result.stdout)

    def test_check_requires_user_evidence_for_accepted_risk(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["requirements"][1]["final_check"] = {
            "status": "ACCEPTED_RISK",
            "verifier_id": "",
            "evidence": [],
            "external_acceptance": [],
        }
        ledger["findings"][0]["status"] = "ACCEPTED_RISK"
        ledger["findings"][0]["history"] = [
            {"from": None, "to": "OPEN", "actor_role": "auditor", "actor_id": "session-auditor"},
            {"from": "OPEN", "to": "ACCEPTED_RISK", "actor_role": "orchestrator", "actor_id": "session-orchestrator"},
        ]
        ledger["final_verdict"]["status"] = "ACCEPTED_WITH_RISK"
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("RISK_APPROVAL_MISSING", result.stdout)

    def test_check_rejects_reopened_to_implemented_without_replanning(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["findings"][0]["status"] = "IMPLEMENTED"
        ledger["findings"][0]["history"].extend(
            [
                {"from": "LOCAL_VERIFIED", "to": "REOPENED", "actor_role": "verifier", "actor_id": "session-verifier"},
                {"from": "REOPENED", "to": "IMPLEMENTED", "actor_role": "implementer", "actor_id": "session-implementer"},
            ]
        )
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("INVALID_TRANSITION", result.stdout)

    def test_check_returns_two_not_traceback_for_bad_finding_ids_type(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["requirements"][1]["finding_ids"] = 7
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("INVALID_TYPE", result.stdout)
        self.assertNotIn("Traceback", result.stderr)

    def test_check_accepts_disjoint_read_only_parallel_collectors(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["roles"]["audit_collectors"] = [
            {"id": "session-audit-collector-1", "read_only": True, "requirement_ids": ["REQ-001"]},
            {"id": "session-audit-collector-2", "read_only": True, "requirement_ids": ["REQ-002"]},
        ]
        ledger["roles"]["plan_collectors"] = [
            {"id": "session-plan-collector-1", "read_only": True, "finding_ids": ["ALN-001"]},
        ]
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_check_rejects_parallel_collector_with_unknown_scope(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["roles"]["audit_collectors"] = [
            {"id": "session-audit-collector", "read_only": True, "requirement_ids": ["REQ-999"]},
        ]
        ledger["roles"]["plan_collectors"] = [
            {"id": "session-plan-collector", "read_only": True, "finding_ids": ["ALN-999"]},
        ]
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("COLLECTOR_SCOPE_INVALID", result.stdout)

    def test_check_rejects_overlapping_parallel_collector_scopes(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["roles"]["audit_collectors"] = [
            {"id": "session-audit-collector-1", "read_only": True, "requirement_ids": ["REQ-001"]},
            {"id": "session-audit-collector-2", "read_only": True, "requirement_ids": ["REQ-001"]},
        ]
        ledger["roles"]["plan_collectors"] = [
            {"id": "session-plan-collector-1", "read_only": True, "finding_ids": ["ALN-001"]},
            {"id": "session-plan-collector-2", "read_only": True, "finding_ids": ["ALN-001"]},
        ]
        self.write_ledger(ledger)
        result = self.run_cli("check", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("COLLECTOR_SCOPE_OVERLAP", result.stdout)

    def test_local_gate_rejects_self_verification(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["roles"]["verifier"]["id"] = "session-implementer"
        for requirement in ledger["requirements"]:
            requirement["final_check"]["verifier_id"] = "session-implementer"
        ledger["findings"][0]["history"][-1]["actor_id"] = "session-implementer"
        ledger["final_verdict"]["declared_by"] = "session-implementer"
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("ROLE_SEPARATION", result.stdout)

    def test_local_gate_rejects_reusing_auditor_as_verifier(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["roles"]["verifier"]["id"] = "session-auditor"
        for requirement in ledger["requirements"]:
            requirement["final_check"]["verifier_id"] = "session-auditor"
        ledger["findings"][0]["history"][-1]["actor_id"] = "session-auditor"
        ledger["final_verdict"]["declared_by"] = "session-auditor"
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("ROLE_SEPARATION", result.stdout)

    def test_local_gate_rejects_unauthorized_state_actors(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["findings"][0]["history"][0] = {
            "from": None,
            "to": "OPEN",
            "actor_role": "implementer",
            "actor_id": "session-implementer",
        }
        ledger["findings"][0]["history"][1] = {
            "from": "OPEN",
            "to": "PLANNED",
            "actor_role": "implementer",
            "actor_id": "session-implementer",
        }
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("TRANSITION_AUTHORITY", result.stdout)

    def test_local_gate_rejects_shared_role_identity_and_writable_reviewers(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["roles"]["auditor"] = {"id": "shared-session", "read_only": False}
        ledger["roles"]["planner"] = {"id": "shared-session", "read_only": False}
        ledger["roles"]["implementers"] = [{"id": "shared-session"}]
        ledger["findings"][0]["history"][0]["actor_id"] = "shared-session"
        ledger["findings"][0]["history"][1]["actor_id"] = "shared-session"
        ledger["findings"][0]["history"][2]["actor_id"] = "shared-session"
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("ROLE_SEPARATION", result.stdout)

    def test_local_gate_rejects_writable_or_reused_parallel_collector_identity(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["roles"]["audit_collectors"] = [
            {"id": "session-implementer", "read_only": True, "requirement_ids": ["REQ-001"]},
        ]
        ledger["roles"]["plan_collectors"] = [
            {"id": "session-plan-collector", "read_only": False, "finding_ids": ["ALN-001"]},
        ]
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("ROLE_SEPARATION", result.stdout)

    def test_local_gate_rejects_parallel_collector_as_formal_state_actor(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["roles"]["audit_collectors"] = [
            {"id": "session-audit-collector", "read_only": True, "requirement_ids": ["REQ-002"]},
        ]
        ledger["findings"][0]["history"][0] = {
            "from": None,
            "to": "OPEN",
            "actor_role": "audit_collector",
            "actor_id": "session-audit-collector",
        }
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("TRANSITION_AUTHORITY", result.stdout)

    def test_local_gate_rejects_evidence_not_bound_to_requirement_criterion(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["requirements"][0]["final_check"]["evidence"][0]["acceptance_criterion"] = "Unrelated exit-zero check."
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("LOCAL_EVIDENCE_INVALID", result.stdout)

    def test_local_gate_rejects_unrelated_exit_zero_command_even_when_mentioned_in_plan(self) -> None:
        ledger = deepcopy(self.ledger)
        artifact = json.loads(self.local_evidence_path.read_text(encoding="utf-8"))
        artifact["cmd"] = "python -c pass"
        artifact["argv"] = ["python", "-c", "pass"]
        dump_json(self.local_evidence_path, artifact)
        artifact_hash = sha256(self.local_evidence_path)
        for requirement in ledger["requirements"]:
            requirement["final_check"]["evidence"][0]["command"] = "python -c pass"
            requirement["final_check"]["evidence"][0]["sha256"] = artifact_hash
        ledger["findings"][0]["tests"][0]["command"] = "python -c pass"
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("LOCAL_EVIDENCE_INVALID", result.stdout)

    def test_local_gate_rejects_matching_hash_for_non_sibling_gate_check(self) -> None:
        fake_tool = self.root / ".evidence" / "test-tools" / "gate-check"
        fake_tool.parent.mkdir(parents=True, exist_ok=True)
        fake_tool.write_text(
            "import json, sys\n"
            "print(json.dumps({'gate':'batch','status':'PASS','reasons':[],"
            "'slices':[{'gate':'slice','slice':'align-001','status':'PASS','reasons':[]}],"
            f"'run_id':'{self.run_id}'}})); sys.exit(0)\n",
            encoding="utf-8",
        )
        ledger = deepcopy(self.ledger)
        ledger["evidence_gate"]["tool_path"] = str(fake_tool)
        ledger["evidence_gate"]["tool_sha256"] = sha256(fake_tool)
        self.write_ledger(ledger)
        self.gate_check_tool = fake_tool
        result = self.run_cli(
            "gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("UNTRUSTED_GATE_CHECK", result.stdout)

    def test_local_gate_rejects_fully_verified_verdict(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["final_verdict"]["status"] = "FULLY_VERIFIED"
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("FINAL_VERDICT_MISMATCH", result.stdout)

    def test_gate_rejects_repository_state_drift(self) -> None:
        (self.root / "app.txt").write_text("changed after verification\n", encoding="utf-8")
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("SNAPSHOT_MISMATCH", result.stdout)

    def test_local_gate_rejects_open_finding_despite_green_tests(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["findings"][0]["status"] = "IMPLEMENTED"
        ledger["findings"][0]["history"] = ledger["findings"][0]["history"][:-1]
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("FINDING_NOT_VERIFIED", result.stdout)

    def test_local_gate_passes_with_independent_evidence(self) -> None:
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('"status": "PASS"', result.stdout)

    def test_local_gate_rejects_red_and_green_from_different_commands(self) -> None:
        red = json.loads(self.red_evidence_path.read_text(encoding="utf-8"))
        red["cmd"] = "python -c raise_expected_failure"
        red["argv"] = ["python", "-c", "raise SystemExit(1)"]
        dump_json(self.red_evidence_path, red)
        result = self.run_cli(
            "gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("RED_GREEN_COMMAND_MISMATCH", result.stdout)

    def test_local_gate_rejects_smoke_only_shortcut(self) -> None:
        self.red_evidence_path.unlink()
        green = json.loads(self.local_evidence_path.read_text(encoding="utf-8"))
        green["phase"] = "smoke"
        dump_json(self.local_evidence_path, green)
        artifact_hash = sha256(self.local_evidence_path)
        ledger = deepcopy(self.ledger)
        for requirement in ledger["requirements"]:
            requirement["final_check"]["evidence"][0]["sha256"] = artifact_hash
        self.write_ledger(ledger)
        result = self.run_cli(
            "gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("RED_GREEN_COMMAND_MISMATCH", result.stdout)

    def test_local_gate_rejects_unrelated_pair_that_does_not_cover_referenced_green(self) -> None:
        red = json.loads(self.red_evidence_path.read_text(encoding="utf-8"))
        red["cmd"] = "go test ./unrelated/..."
        red["argv"] = ["go", "test", "./unrelated/..."]
        dump_json(self.red_evidence_path, red)
        unrelated_green_path = self.red_evidence_path.with_name("002-align-001-green-unrelated.json")
        unrelated_green = deepcopy(red)
        unrelated_green.update(
            {
                "seq": 2,
                "phase": "green",
                "label": "unrelated command passes",
                "argv": ["go", "test", "./unrelated/..."],
                "exit_code": 0,
                "expect_fail": False,
                "expectation_met": True,
                "test_stats": {"total": 2, "passed": 2, "failed": 0},
            }
        )
        dump_json(unrelated_green_path, unrelated_green)
        approved_green = json.loads(self.local_evidence_path.read_text(encoding="utf-8"))
        approved_green["seq"] = 3
        dump_json(self.local_evidence_path, approved_green)
        ledger = deepcopy(self.ledger)
        approved_hash = sha256(self.local_evidence_path)
        for requirement in ledger["requirements"]:
            requirement["final_check"]["evidence"][0]["sha256"] = approved_hash
        self.write_ledger(ledger)
        result = self.run_cli(
            "gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("RED_GREEN_COMMAND_MISMATCH", result.stdout)

    def test_local_gate_rejects_pair_without_argv(self) -> None:
        red = json.loads(self.red_evidence_path.read_text(encoding="utf-8"))
        green = json.loads(self.local_evidence_path.read_text(encoding="utf-8"))
        red.pop("argv")
        green.pop("argv")
        dump_json(self.red_evidence_path, red)
        dump_json(self.local_evidence_path, green)
        ledger = deepcopy(self.ledger)
        green_hash = sha256(self.local_evidence_path)
        for requirement in ledger["requirements"]:
            requirement["final_check"]["evidence"][0]["sha256"] = green_hash
        self.write_ledger(ledger)
        result = self.run_cli(
            "gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("RED_GREEN_COMMAND_MISMATCH", result.stdout)

    def test_local_gate_rejects_red_artifact_from_other_run(self) -> None:
        red = json.loads(self.red_evidence_path.read_text(encoding="utf-8"))
        red["run_id"] = "stale-other-run"
        dump_json(self.red_evidence_path, red)
        result = self.run_cli(
            "gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("RED_GREEN_COMMAND_MISMATCH", result.stdout)

    def test_local_gate_rejects_red_from_unapproved_worktree(self) -> None:
        red = json.loads(self.red_evidence_path.read_text(encoding="utf-8"))
        other_worktree = self.root.parent / "unrelated-worktree"
        red["cwd"] = str(other_worktree)
        red["workdir"] = str(other_worktree)
        dump_json(self.red_evidence_path, red)
        result = self.run_cli(
            "gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("RED_GREEN_COMMAND_MISMATCH", result.stdout)

    def test_local_gate_rejects_registered_foreign_repository_as_worktree(self) -> None:
        foreign_repo = self.root.parent / f"{self.root.name}-foreign-clone"
        git(self.root.parent, "clone", "--quiet", str(self.root), str(foreign_repo))
        red = json.loads(self.red_evidence_path.read_text(encoding="utf-8"))
        red["cwd"] = str(foreign_repo)
        red["workdir"] = str(foreign_repo)
        dump_json(self.red_evidence_path, red)
        ledger = deepcopy(self.ledger)
        ledger["slices"][0]["worktree"] = str(foreign_repo)
        self.write_ledger(ledger)
        result = self.run_cli(
            "gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("EVIDENCE_SLICE_COVERAGE", result.stdout)

    def test_local_gate_rejects_red_from_different_relative_cwd(self) -> None:
        red = json.loads(self.red_evidence_path.read_text(encoding="utf-8"))
        red["cwd"] = str(self.root / "backend")
        dump_json(self.red_evidence_path, red)
        result = self.run_cli(
            "gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("RED_GREEN_COMMAND_MISMATCH", result.stdout)

    def test_local_gate_rejects_referenced_green_from_wrong_workdir(self) -> None:
        green = json.loads(self.local_evidence_path.read_text(encoding="utf-8"))
        other_repo = self.root.parent / "other-repo"
        green["cwd"] = str(other_repo)
        green["workdir"] = str(other_repo)
        dump_json(self.local_evidence_path, green)
        ledger = deepcopy(self.ledger)
        green_hash = sha256(self.local_evidence_path)
        for requirement in ledger["requirements"]:
            requirement["final_check"]["evidence"][0]["sha256"] = green_hash
        self.write_ledger(ledger)
        result = self.run_cli(
            "gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("LOCAL_EVIDENCE_INVALID", result.stdout)

    def test_local_gate_rejects_missing_code_review_attestation(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger.pop("code_review")
        self.write_ledger(ledger)
        result = self.run_cli(
            "gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("CODE_REVIEW_EVIDENCE_MISSING", result.stdout)

    def test_local_gate_rejects_code_review_blind_spots(self) -> None:
        report = json.loads(self.code_review_path.read_text(encoding="utf-8"))
        report["coverage"]["blind_spots"] = ["UI route was not reviewed"]
        dump_json(self.code_review_path, report)
        ledger = deepcopy(self.ledger)
        ledger["code_review"]["report_sha256"] = sha256(self.code_review_path)
        self.write_ledger(ledger)
        result = self.run_cli(
            "gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("CODE_REVIEW_EVIDENCE_INVALID", result.stdout)

    def test_local_gate_rejects_missing_slice_to_finding_mapping(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["slices"] = []
        ledger["evidence_gate"]["slice_ids"] = []
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("EVIDENCE_SLICE_COVERAGE", result.stdout)

    def test_local_gate_rejects_missing_slice_to_requirement_mapping(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["slices"][0]["requirement_ids"] = ["REQ-002"]
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("EVIDENCE_SLICE_COVERAGE", result.stdout)

    def test_local_gate_rejects_duplicate_evidence_gate_slice_ids(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["evidence_gate"]["slice_ids"] = ["align-001", "align-001"]
        self.write_ledger(ledger)
        result = self.run_cli(
            "gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("EVIDENCE_SLICE_COVERAGE", result.stdout)

    def test_local_gate_rejects_failed_evidence_gate(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["evidence_gate"]["exit_code"] = 1
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("EVIDENCE_GATE_FAILED", result.stdout)

    def test_local_gate_rejects_missing_gate_output_artifact(self) -> None:
        self.gate_report_path.unlink()
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("EVIDENCE_GATE_OUTPUT_INVALID", result.stdout)

    def test_local_gate_rejects_live_gate_check_failure_despite_stored_pass(self) -> None:
        self.red_evidence_path.unlink()
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("LIVE_EVIDENCE_GATE_FAILED", result.stdout)

    def test_local_gate_rejects_missing_local_evidence_artifact(self) -> None:
        self.local_evidence_path.unlink()
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("LOCAL_EVIDENCE_INVALID", result.stdout)

    def test_local_gate_rejects_evidence_run_mismatch(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["evidence_gate"]["run_id"] = "old-unrelated-run"
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("EVIDENCE_RUN_MISMATCH", result.stdout)

    def test_local_gate_rejects_evidence_command_for_other_repo(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["evidence_gate"]["command"] = (
            f"python <suite-root>/skills/_bin/gate-check batch --repo C:/other-repo "
            f"--run {self.run_id} --slices align-001 --strict-red --json"
        )
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("EVIDENCE_GATE_FAILED", result.stdout)

    def test_external_gate_rejects_local_only_acceptance(self) -> None:
        result = self.run_cli("gate", "--level", "external", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("EXTERNAL_ACCEPTANCE_MISSING", result.stdout)

    def test_local_gate_rejects_invalid_artifacts_behind_external_verified_status(self) -> None:
        ledger = deepcopy(self.ledger)
        acceptance = self.make_external_acceptance()
        (self.root / acceptance["attestation_ref"]).unlink()
        ledger["requirements"][1]["final_check"]["status"] = "EXTERNAL_VERIFIED"
        ledger["requirements"][1]["final_check"]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["status"] = "EXTERNAL_VERIFIED"
        ledger["findings"][0]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["history"].append(
            {"from": "LOCAL_VERIFIED", "to": "EXTERNAL_VERIFIED", "actor_role": "verifier", "actor_id": "session-verifier"}
        )
        self.write_ledger(ledger)
        result = self.run_cli(
            "gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("EXTERNAL_EVIDENCE_INVALID", result.stdout)

    def test_external_gate_passes_only_with_external_evidence(self) -> None:
        ledger = deepcopy(self.ledger)
        acceptance = self.make_external_acceptance()
        ledger["requirements"][1]["final_check"]["status"] = "EXTERNAL_VERIFIED"
        ledger["requirements"][1]["final_check"]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["status"] = "EXTERNAL_VERIFIED"
        ledger["findings"][0]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["history"].append(
            {"from": "LOCAL_VERIFIED", "to": "EXTERNAL_VERIFIED", "actor_role": "verifier", "actor_id": "session-verifier"}
        )
        ledger["final_verdict"]["status"] = "FULLY_VERIFIED"
        ledger["final_verdict"]["summary"] = "Local and external acceptance passed."
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "external", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        local_result = self.run_cli("gate", "--level", "local", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(local_result.returncode, 0, local_result.stdout + local_result.stderr)

    def test_external_gate_rejects_smoke_from_wrong_workdir(self) -> None:
        ledger = deepcopy(self.ledger)
        acceptance = self.make_external_acceptance()
        artifact_path = self.root / acceptance["evidence_ref"]
        artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
        other_repo = self.root.parent / "other-repo"
        artifact["cwd"] = str(other_repo)
        artifact["workdir"] = str(other_repo)
        dump_json(artifact_path, artifact)
        acceptance["evidence_sha256"] = sha256(artifact_path)
        attestation_path = self.root / acceptance["attestation_ref"]
        attestation = json.loads(attestation_path.read_text(encoding="utf-8"))
        attestation["raw_evidence_sha256"] = acceptance["evidence_sha256"]
        dump_json(attestation_path, attestation)
        acceptance["attestation_sha256"] = sha256(attestation_path)
        ledger["requirements"][1]["final_check"]["status"] = "EXTERNAL_VERIFIED"
        ledger["requirements"][1]["final_check"]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["status"] = "EXTERNAL_VERIFIED"
        ledger["findings"][0]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["history"].append(
            {"from": "LOCAL_VERIFIED", "to": "EXTERNAL_VERIFIED", "actor_role": "verifier", "actor_id": "session-verifier"}
        )
        ledger["final_verdict"]["status"] = "FULLY_VERIFIED"
        ledger["final_verdict"]["summary"] = "Local and external acceptance passed."
        self.write_ledger(ledger)
        result = self.run_cli(
            "gate", "--level", "external", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("EXTERNAL_EVIDENCE_INVALID", result.stdout)

    def test_external_gate_rejects_smoke_artifact_relabelled_by_ledger(self) -> None:
        ledger = deepcopy(self.ledger)
        acceptance = self.make_external_acceptance()
        attestation_path = self.root / acceptance["attestation_ref"]
        attestation = json.loads(attestation_path.read_text(encoding="utf-8"))
        attestation["accepted_by"] = "different-environment-owner"
        dump_json(attestation_path, attestation)
        acceptance["attestation_sha256"] = sha256(attestation_path)
        ledger["requirements"][1]["final_check"]["status"] = "EXTERNAL_VERIFIED"
        ledger["requirements"][1]["final_check"]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["status"] = "EXTERNAL_VERIFIED"
        ledger["findings"][0]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["history"].append(
            {"from": "LOCAL_VERIFIED", "to": "EXTERNAL_VERIFIED", "actor_role": "verifier", "actor_id": "session-verifier"}
        )
        ledger["final_verdict"]["status"] = "FULLY_VERIFIED"
        self.write_ledger(ledger)
        result = self.run_cli(
            "gate", "--level", "external", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path)
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("EXTERNAL_EVIDENCE_INVALID", result.stdout)

    def test_external_gate_rejects_missing_external_artifact(self) -> None:
        ledger = deepcopy(self.ledger)
        acceptance = self.make_external_acceptance()
        (self.root / acceptance["evidence_ref"]).unlink()
        ledger["requirements"][1]["final_check"]["status"] = "EXTERNAL_VERIFIED"
        ledger["requirements"][1]["final_check"]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["status"] = "EXTERNAL_VERIFIED"
        ledger["findings"][0]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["history"].append(
            {"from": "LOCAL_VERIFIED", "to": "EXTERNAL_VERIFIED", "actor_role": "verifier", "actor_id": "session-verifier"}
        )
        ledger["final_verdict"]["status"] = "FULLY_VERIFIED"
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "external", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("EXTERNAL_EVIDENCE_INVALID", result.stdout)

    def test_external_gate_rejects_acceptance_from_another_valid_slice(self) -> None:
        ledger = deepcopy(self.ledger)
        local_artifact = json.loads(self.local_evidence_path.read_text(encoding="utf-8"))
        local_artifact["slice"] = "align-local"
        dump_json(self.local_evidence_path, local_artifact)
        external_local_path = self.local_evidence_path.with_name("003-align-external-green-tests.json")
        external_local_artifact = deepcopy(local_artifact)
        external_local_artifact["slice"] = "align-external"
        dump_json(external_local_path, external_local_artifact)
        external_local_ref = str(external_local_path.relative_to(self.root)).replace("\\", "/")

        ledger["slices"] = [
            {"id": "align-local", "worktree": str(self.root), "requirement_ids": ["REQ-001"], "finding_ids": []},
            {
                "id": "align-external",
                "worktree": str(self.root),
                "requirement_ids": ["REQ-002"],
                "finding_ids": ["ALN-001"],
            },
        ]
        ledger["requirements"][1]["final_check"]["evidence"] = [external_local_ref]
        ledger["findings"][0]["tests"][0]["evidence_ref"] = external_local_ref
        ledger["evidence_gate"]["command"] = (
            f"python <suite-root>/skills/_bin/gate-check batch --repo '{self.root}' --run {self.run_id} "
            "--slices align-local,align-external --strict-red --json"
        )
        ledger["evidence_gate"]["slice_ids"] = ["align-local", "align-external"]
        dump_json(
            self.gate_report_path,
            {
                "gate": "batch",
                "status": "PASS",
                "reasons": [],
                "evidence": ["align-local: PASS", "align-external: PASS"],
                "slices": [
                    {"gate": "slice", "slice": "align-local", "status": "PASS", "reasons": [], "evidence": []},
                    {"gate": "slice", "slice": "align-external", "status": "PASS", "reasons": [], "evidence": []},
                ],
                "run_id": self.run_id,
            },
        )
        ledger["evidence_gate"]["output_sha256"] = sha256(self.gate_report_path)

        acceptance = self.make_external_acceptance("align-local")
        ledger["requirements"][1]["final_check"]["status"] = "EXTERNAL_VERIFIED"
        ledger["requirements"][1]["final_check"]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["status"] = "EXTERNAL_VERIFIED"
        ledger["findings"][0]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["history"].append(
            {"from": "LOCAL_VERIFIED", "to": "EXTERNAL_VERIFIED", "actor_role": "verifier", "actor_id": "session-verifier"}
        )
        ledger["final_verdict"]["status"] = "FULLY_VERIFIED"
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "external", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("EXTERNAL_EVIDENCE_INVALID", result.stdout)

    def test_external_gate_rejects_external_artifact_hash_mismatch(self) -> None:
        ledger = deepcopy(self.ledger)
        acceptance = self.make_external_acceptance()
        acceptance["evidence_sha256"] = "0" * 64
        ledger["requirements"][1]["final_check"]["status"] = "EXTERNAL_VERIFIED"
        ledger["requirements"][1]["final_check"]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["status"] = "EXTERNAL_VERIFIED"
        ledger["findings"][0]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["history"].append(
            {"from": "LOCAL_VERIFIED", "to": "EXTERNAL_VERIFIED", "actor_role": "verifier", "actor_id": "session-verifier"}
        )
        ledger["final_verdict"]["status"] = "FULLY_VERIFIED"
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "external", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("EXTERNAL_EVIDENCE_INVALID", result.stdout)

    def test_external_gate_rejects_unapproved_external_authority(self) -> None:
        ledger = deepcopy(self.ledger)
        acceptance = self.make_external_acceptance()
        acceptance["accepted_by"] = "invented-environment-owner"
        ledger["requirements"][1]["final_check"]["status"] = "EXTERNAL_VERIFIED"
        ledger["requirements"][1]["final_check"]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["status"] = "EXTERNAL_VERIFIED"
        ledger["findings"][0]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["history"].append(
            {"from": "LOCAL_VERIFIED", "to": "EXTERNAL_VERIFIED", "actor_role": "verifier", "actor_id": "session-verifier"}
        )
        ledger["final_verdict"]["status"] = "FULLY_VERIFIED"
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "external", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("EXTERNAL_EVIDENCE_INVALID", result.stdout)

    def test_external_gate_rejects_parallel_collector_as_external_authority(self) -> None:
        ledger = deepcopy(self.ledger)
        ledger["roles"]["audit_collectors"] = [
            {"id": "environment-owner", "read_only": True, "requirement_ids": ["REQ-002"]},
        ]
        acceptance = self.make_external_acceptance()
        ledger["requirements"][1]["final_check"]["status"] = "EXTERNAL_VERIFIED"
        ledger["requirements"][1]["final_check"]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["status"] = "EXTERNAL_VERIFIED"
        ledger["findings"][0]["external_acceptance"] = [acceptance]
        ledger["findings"][0]["history"].append(
            {"from": "LOCAL_VERIFIED", "to": "EXTERNAL_VERIFIED", "actor_role": "verifier", "actor_id": "session-verifier"}
        )
        ledger["final_verdict"]["status"] = "FULLY_VERIFIED"
        self.write_ledger(ledger)
        result = self.run_cli("gate", "--level", "external", "--contract", str(self.contract_path), "--ledger", str(self.ledger_path))
        self.assertEqual(result.returncode, 1)
        self.assertIn("EXTERNAL_EVIDENCE_INVALID", result.stdout)

    def test_snapshot_command_captures_current_clean_repository(self) -> None:
        result = self.run_cli(
            "snapshot",
            "--repo",
            str(self.root),
            "--exclude",
            self.run_rel,
            "--exclude",
            ".evidence",
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["snapshot"]["head"], self.repo_head)
        self.assertEqual(payload["snapshot"]["state_sha256"], self.state_sha256)


if __name__ == "__main__":
    unittest.main()
