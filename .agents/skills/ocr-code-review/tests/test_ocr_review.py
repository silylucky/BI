import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = SKILL_ROOT / "scripts" / "ocr_review.py"


class OcrReviewCliTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.repo = self.root / "repo"
        self.state = self.root / "state"
        self.repo.mkdir()
        self.git("init")
        self.git("config", "user.email", "review@example.com")
        self.git("config", "user.name", "Review Test")

    def tearDown(self):
        self.temp.cleanup()

    def git(self, *args):
        return subprocess.run(
            ["git", *args],
            cwd=self.repo,
            text=True,
            encoding="utf-8",
            capture_output=True,
            check=True,
        ).stdout.strip()

    def write(self, relative, content):
        path = self.repo / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def commit_all(self, message="fixture"):
        self.git("add", ".")
        self.git("commit", "-m", message)

    def cli(self, *args, expect=0, stdin=None):
        proc = subprocess.run(
            [sys.executable, str(SCRIPT), *map(str, args)],
            cwd=self.repo,
            input=stdin,
            text=True,
            encoding="utf-8",
            capture_output=True,
        )
        self.assertEqual(
            expect,
            proc.returncode,
            msg=f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}",
        )
        stream = proc.stdout if proc.returncode == 0 else proc.stderr
        return json.loads(stream)

    def init_scan(self, concurrency="max", yes=True, session_id="scan-test"):
        args = [
            "init",
            "--repo",
            self.repo,
            "--mode",
            "scan",
            "--session-id",
            session_id,
            "--state-root",
            self.state,
            "--concurrency",
            concurrency,
        ]
        if yes:
            args.append("--yes")
        result = self.cli(*args)
        return Path(result["session_dir"])

    def start_task(self, session, task_id, reviewer_context=None):
        return self.cli(
            "task-start",
            "--session",
            session,
            "--task",
            task_id,
            "--reviewer-context",
            reviewer_context or f"reviewer-{task_id}",
        )

    def dispatch_next(self, session):
        return self.cli("dispatch-next", "--session", session)

    def report_capacity(self, session, probe_id, reason=None):
        args = ["capacity-report", "--session", session, "--probe", probe_id]
        if reason:
            args.extend(["--reason", reason])
        return self.cli(*args)

    def report_launch(self, session, launch_id, accepted, rejected=None):
        payload = self.root / f"launch-report-{launch_id}.json"
        payload.write_text(
            json.dumps({"accepted": accepted, "rejected": rejected or []}),
            encoding="utf-8",
        )
        return self.cli(
            "orchestrate-report", "--session", session, "--launch", launch_id,
            "--input", payload,
        )

    def coverage_file(self, name="coverage.json", context_paths=None):
        path = self.root / name
        path.write_text(
            json.dumps(
                {
                    "primary_target_complete": True,
                    "symbols": ["Charge"],
                    "ranges": [],
                    "dimensions": ["correctness"],
                    "skipped": [],
                    "blind_spots": [],
                    "pending_questions": [],
                    "context_paths": context_paths or [],
                }
            ),
            encoding="utf-8",
        )
        return path

    def submit_medium_finding(self, session, task_id, index, impact):
        payload = self.root / f"finding-{index}.json"
        payload.write_text(
            json.dumps(
                {
                    "title": f"Issue {index}",
                    "claim": f"problem_{index} returns an invalid result",
                    "severity": "medium",
                    "category": "bug",
                    "existing_code": f"problem_{index}()",
                    "expected": "return a valid result",
                    "actual": "return an invalid result",
                    "impact": impact,
                    "impact_surface": "runtime",
                    "reachability": "proven",
                    "current_input_reproducible": True,
                    "evidence": [f"problem_{index} is directly reachable"],
                }
            ),
            encoding="utf-8",
        )
        return self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload
        )

    def submit_semantic_finding(
        self,
        session,
        task_id,
        index,
        *,
        root_cause_key,
        fix_scope,
        category="bug",
        claim=None,
        severity="medium",
    ):
        payload = self.root / f"semantic-finding-{index}.json"
        payload.write_text(
            json.dumps(
                {
                    "title": f"Semantic issue {index}",
                    "claim": claim or f"problem_{index} exposes the same failure",
                    "severity": severity,
                    "category": category,
                    "existing_code": f"problem_{index}()",
                    "expected": "the operation remains valid",
                    "actual": "the operation fails",
                    "impact": f"impact {index}",
                    "impact_surface": "runtime",
                    "reachability": "proven",
                    "current_input_reproducible": True,
                    "evidence": [f"problem_{index} is directly reachable"],
                    "root_cause_key": root_cause_key,
                    "fix_scope": fix_scope,
                }
            ),
            encoding="utf-8",
        )
        return self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload
        )

    def complete_all_tasks(self, session):
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        for task_id, task in manifest["tasks"].items():
            if task["status"] == "pending":
                self.start_task(session, task_id)
            self.cli(
                "complete",
                "--session",
                session,
                "--task",
                task_id,
                "--coverage",
                self.coverage_file(f"coverage-{task_id}.json"),
            )

    def test_scan_manifest_uses_ocr_primary_target_filters(self):
        self.write("payment.go", "package pay\n\nfunc Charge() error { return nil }\n")
        self.write("payment_test.go", "package pay\n")
        self.write("account.go", "package pay\n")
        self.write("vendor/generated.go", "package vendor\n")
        self.write("logo.png", "not actually an image")
        self.write("client.gen.go", "package pay\n")
        (self.repo / "binary.go").write_bytes(b"package pay\x00binary")
        self.commit_all()

        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        paths = {task["path"] for task in manifest["tasks"].values()}

        self.assertEqual({"account.go", "payment.go"}, paths)
        self.assertTrue(all(task["status"] == "pending" for task in manifest["tasks"].values()))
        self.assertEqual("max", manifest["scheduling"]["concurrency"])
        self.assertEqual(
            "maximum-host-capacity",
            manifest["scheduling"]["source"],
        )
        session_json = json.loads((session / "session.json").read_text(encoding="utf-8"))
        self.assertIsInstance(session_json["stack_card"], dict)
        self.assertGreaterEqual(session_json["stack_card"]["languages"][".go"], 2)

    def test_standard_test_names_and_directories_are_excluded_without_substring_false_positives(self):
        production_files = {
            "app.py",
            "contest.ts",
            "latest.go",
            "testimony.py",
            "Contest.java",
        }
        test_files = {
            "test_payment.py",
            "payment_test.py",
            "payment_test.go",
            "payment.test.ts",
            "payment.spec.ts",
            "PaymentTest.java",
            "PaymentTest.kt",
            "PaymentTests.cs",
            "payment_test.dart",
            "payment_test.exs",
            "tests/payment.py",
            "test/payment_helper.py",
            "spec/payment.rb",
            "src/__tests__/payment.ts",
        }
        for path in production_files | test_files:
            self.write(path, "placeholder = true\n")
        self.commit_all()

        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        session_json = json.loads((session / "session.json").read_text(encoding="utf-8"))
        paths = {task["path"] for task in manifest["tasks"].values()}

        self.assertEqual(production_files, paths)
        self.assertTrue(test_files.isdisjoint(paths))
        self.assertEqual("0.10.0", session_json["skill_version"])

    def test_user_include_can_restore_a_default_excluded_test_file(self):
        self.write("app.py", "value = True\n")
        self.write("tests/payment.py", "value = False\n")
        self.write(
            ".opencodereview/rule.json",
            json.dumps({"include": ["tests/payment.py"], "rules": []}),
        )
        self.commit_all()

        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        paths = {task["path"] for task in manifest["tasks"].values()}

        self.assertIn("tests/payment.py", paths)
        self.assertIn("app.py", paths)

    def test_project_rule_file_reference_resolves_from_repository_root(self):
        self.write("payment.go", "package pay\nfunc Charge() {}\n")
        self.write("review_rules/go.md", "PROJECT ROOT RULE\n")
        self.write(
            ".opencodereview/rule.json",
            json.dumps(
                {
                    "rules": [
                        {"path": "**/*.go", "rule": "review_rules/go.md"}
                    ]
                }
            ),
        )
        self.commit_all()

        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task = next(task for task in manifest["tasks"].values() if task["path"] == "payment.go")

        self.assertEqual("project", task["rule"]["source"])
        self.assertEqual("**/*.go", task["rule"]["pattern"])
        expected_rule_sha = hashlib.sha256(b"PROJECT ROOT RULE").hexdigest()
        self.assertEqual(expected_rule_sha, task["rule"]["sha256"])

    def test_user_include_is_admission_override_not_whitelist(self):
        self.write("payment.go", "package pay\n")
        self.write("client.gen.go", "package pay\n")
        self.write(
            ".opencodereview/rule.json",
            json.dumps({"include": ["client.gen.go"], "rules": []}),
        )
        self.commit_all()

        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        paths = {task["path"] for task in manifest["tasks"].values()}

        self.assertTrue({"client.gen.go", "payment.go"}.issubset(paths))
        self.assertIn(".opencodereview/rule.json", paths)

    def test_review_task_hash_changes_when_diff_base_changes(self):
        self.write("payment.go", "package pay\nfunc Charge() { oldA() }\n")
        self.commit_all("base-a")
        base_a = self.git("rev-parse", "HEAD")
        self.write("payment.go", "package pay\nfunc Charge() { middleC() }\n")
        self.commit_all("base-c")
        base_c = self.git("rev-parse", "HEAD")
        self.write("payment.go", "package pay\nfunc Charge() { currentB() }\n")
        self.commit_all("head-b")

        first = self.cli(
            "init",
            "--repo",
            self.repo,
            "--mode",
            "review",
            "--base",
            base_a,
            "--session-id",
            "review-a",
            "--state-root",
            self.state,
        )
        second = self.cli(
            "init",
            "--repo",
            self.repo,
            "--mode",
            "review",
            "--base",
            base_c,
            "--session-id",
            "review-c",
            "--state-root",
            self.state,
        )
        first_manifest = json.loads(
            (Path(first["session_dir"]) / "manifest.json").read_text(encoding="utf-8")
        )
        second_manifest = json.loads(
            (Path(second["session_dir"]) / "manifest.json").read_text(encoding="utf-8")
        )
        first_hash = next(iter(first_manifest["tasks"].values()))["input_hash"]
        second_hash = next(iter(second_manifest["tasks"].values()))["input_hash"]

        self.assertNotEqual(first_hash, second_hash)

    def test_submit_derives_path_and_lines_from_unique_existing_code(self):
        self.write(
            "payment.go",
            "package pay\n\nfunc Charge() error {\n\tresult, _ := charge()\n\treturn use(result)\n}\n",
        )
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        payload = self.root / "finding.json"
        payload.write_text(
            json.dumps(
                {
                    "title": "扣款错误被忽略",
                    "claim": "charge 返回的错误被丢弃，失败仍继续使用 result",
                    "severity": "high",
                    "category": "bug",
                    "existing_code": "\tresult, _ := charge()\n\treturn use(result)",
                    "expected": "扣款失败时终止并传播错误",
                    "actual": "错误被丢弃后继续处理结果",
                    "impact": "可能把失败扣款当成成功",
                    "impact_surface": "runtime",
                    "reachability": "proven",
                    "current_input_reproducible": True,
                    "evidence": ["charge 的第二个返回值被 `_` 丢弃"],
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        result = self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload
        )
        finding = json.loads(Path(result["finding_file"]).read_text(encoding="utf-8"))

        self.assertEqual("payment.go", finding["location"]["path"])
        self.assertEqual(4, finding["location"]["start_line"])
        self.assertEqual(5, finding["location"]["end_line"])
        self.assertNotIn("path", finding["model_input"])

    def test_submit_rejects_ambiguous_anchor(self):
        self.write(
            "payment.go",
            "package pay\n\nfunc A() { ignored() }\nfunc B() { ignored() }\n",
        )
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        payload = self.root / "finding.json"
        payload.write_text(
            json.dumps(
                {
                    "title": "ambiguous",
                    "claim": "ignored call",
                    "severity": "medium",
                    "category": "bug",
                    "existing_code": "ignored()",
                    "expected": "handle it",
                    "actual": "ignored",
                    "impact": "unknown result",
                    "impact_surface": "runtime",
                    "reachability": "proven",
                    "current_input_reproducible": True,
                    "evidence": ["direct call"],
                }
            ),
            encoding="utf-8",
        )

        error = self.cli(
            "submit",
            "--session",
            session,
            "--task",
            task_id,
            "--input",
            payload,
            expect=2,
        )

        self.assertEqual("LOCATION_AMBIGUOUS", error["error"])
        self.assertEqual("resubmit_with_larger_existing_code", error["next_action"])

    def test_complete_releases_reviewer_while_verifier_remains_pending(self):
        self.write("payment.go", "package pay\nfunc Charge() {}\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        finding_dir = session / "findings" / task_id
        finding_dir.mkdir(parents=True, exist_ok=True)
        (finding_dir / "f-high.json").write_text(
            json.dumps(
                {
                    "id": "f-high",
                    "task_id": task_id,
                    "severity": "high",
                    "verification": {"required": True, "status": "pending"},
                    "state": "candidate",
                }
            ),
            encoding="utf-8",
        )
        coverage = self.root / "coverage.json"
        coverage.write_text(
            json.dumps(
                {
                    "primary_target_complete": True,
                    "symbols": ["Charge"],
                    "ranges": [],
                    "dimensions": ["correctness"],
                    "skipped": [],
                    "blind_spots": [],
                    "pending_questions": [],
                }
            ),
            encoding="utf-8",
        )

        done = self.cli(
            "complete",
            "--session",
            session,
            "--task",
            task_id,
            "--coverage",
            coverage,
        )
        self.assertEqual("complete", done["status"])
        self.assertEqual(["f-high"], done["verification_pending"])

        self.cli(
            "verify",
            "--session",
            session,
            "--finding",
            "f-high",
            "--decision",
            "confirm",
            "--reason",
            "No counter-evidence found",
        )
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        persisted = manifest["tasks"][task_id]["coverage"]
        self.assertEqual(["Charge"], persisted["symbols"])
        self.assertEqual(["correctness"], persisted["dimensions"])
        self.assertEqual([], persisted["blind_spots"])

    def test_finalize_refuses_to_publish_while_verifier_backlog_exists(self):
        self.write("payment.go", "package pay\nfunc Charge() {}\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        finding_dir = session / "findings" / task_id
        finding_dir.mkdir(parents=True, exist_ok=True)
        (finding_dir / "f-pending.json").write_text(
            json.dumps(
                {
                    "id": "f-pending",
                    "task_id": task_id,
                    "severity": "high",
                    "verification": {"required": True, "status": "pending"},
                    "state": "candidate",
                }
            ),
            encoding="utf-8",
        )
        self.cli(
            "complete", "--session", session, "--task", task_id,
            "--coverage", self.coverage_file("pending-verifier-coverage.json"),
        )

        blocked = self.cli("finalize", "--session", session, expect=2)
        self.assertEqual("VERIFIER_PENDING", blocked["error"])
        self.assertEqual(["f-pending"], blocked["finding_ids"])

    def test_finalize_never_calls_material_blind_spots_clean(self):
        self.write("payment.go", "package pay\nfunc Charge() {}\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        coverage = self.root / "coverage.json"
        coverage.write_text(
            json.dumps(
                {
                    "primary_target_complete": True,
                    "symbols": ["Charge"],
                    "ranges": [],
                    "dimensions": ["correctness"],
                    "skipped": [],
                    "blind_spots": [
                        {
                            "area": "external integration",
                            "reason": "credentials unavailable",
                            "scope": "external-integration",
                            "material": False,
                        }
                    ],
                    "pending_questions": [],
                }
            ),
            encoding="utf-8",
        )
        self.cli(
            "complete",
            "--session",
            session,
            "--task",
            task_id,
            "--coverage",
            coverage,
        )

        result = self.cli("finalize", "--session", session)
        report = json.loads(Path(result["result_json"]).read_text(encoding="utf-8"))

        self.assertEqual("complete", report["completion_status"])
        self.assertEqual("limited", report["assurance"])
        self.assertFalse(report["clean"])
        self.assertIn("覆盖限制", report["conclusion"])

    def test_invalid_coverage_shape_returns_json_error(self):
        self.write("payment.go", "package pay\nfunc Charge() {}\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        invalid = self.root / "coverage-list.json"
        invalid.write_text("[]", encoding="utf-8")

        error = self.cli(
            "complete",
            "--session",
            session,
            "--task",
            task_id,
            "--coverage",
            invalid,
            expect=2,
        )
        self.assertEqual("INVALID_COVERAGE", error["error"])

    def test_resume_marks_changed_completed_task_stale(self):
        self.write("payment.go", "package pay\nfunc Charge() {}\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        coverage = self.root / "coverage.json"
        coverage.write_text(
            json.dumps(
                {
                    "primary_target_complete": True,
                    "symbols": ["Charge"],
                    "ranges": [],
                    "dimensions": ["correctness"],
                    "skipped": [],
                    "blind_spots": [],
                    "pending_questions": [],
                }
            ),
            encoding="utf-8",
        )
        self.cli(
            "complete",
            "--session",
            session,
            "--task",
            task_id,
            "--coverage",
            coverage,
        )
        self.write("payment.go", "package pay\nfunc Charge() { changed() }\n")

        resumed = self.cli("resume", "--session", session)
        self.assertEqual([task_id], resumed["stale_tasks"])
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual("stale", manifest["tasks"][task_id]["status"])

    def test_resume_marks_task_stale_when_context_dependency_changes(self):
        self.write("payment.go", "package pay\nfunc Charge() { ReadAccount() }\n")
        self.write("account.go", "package pay\nfunc ReadAccount() {}\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        payment_task = next(
            task_id for task_id, task in manifest["tasks"].items() if task["path"] == "payment.go"
        )
        self.start_task(session, payment_task)
        coverage = self.root / "coverage-context.json"
        coverage.write_text(
            json.dumps(
                {
                    "primary_target_complete": True,
                    "symbols": ["Charge"],
                    "ranges": [],
                    "dimensions": ["correctness"],
                    "skipped": [],
                    "blind_spots": [],
                    "pending_questions": [],
                    "context_paths": ["account.go"],
                }
            ),
            encoding="utf-8",
        )
        self.cli(
            "complete",
            "--session",
            session,
            "--task",
            payment_task,
            "--coverage",
            coverage,
        )
        self.write("account.go", "package pay\nfunc ReadAccount() { changed() }\n")

        resumed = self.cli("resume", "--session", session)

        self.assertIn(payment_task, resumed["stale_tasks"])
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual("stale", manifest["tasks"][payment_task]["status"])

    def test_finalize_rechecks_task_input_without_explicit_resume(self):
        self.write("payment.go", "package pay\nfunc Charge() {}\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        coverage = self.root / "coverage-finalize.json"
        coverage.write_text(
            json.dumps(
                {
                    "primary_target_complete": True,
                    "symbols": ["Charge"],
                    "ranges": [],
                    "dimensions": ["correctness"],
                    "skipped": [],
                    "blind_spots": [],
                    "pending_questions": [],
                }
            ),
            encoding="utf-8",
        )
        self.cli(
            "complete",
            "--session",
            session,
            "--task",
            task_id,
            "--coverage",
            coverage,
        )
        self.write("payment.go", "package pay\nfunc Charge() { changed() }\n")

        finalized = self.cli("finalize", "--session", session)
        report = json.loads(Path(finalized["result_json"]).read_text(encoding="utf-8"))

        self.assertEqual("partial", report["completion_status"])
        self.assertFalse(report["clean"])
        self.assertIn(task_id, report["stale_tasks"])

    def test_scan_resume_adds_new_tasks_and_marks_deleted_tasks_removed(self):
        self.write("old.go", "package pay\nfunc Old() {}\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        old_task = next(iter(manifest["tasks"]))
        (self.repo / "old.go").unlink()
        self.write("new.go", "package pay\nfunc New() {}\n")

        resumed = self.cli("resume", "--session", session)
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))

        self.assertEqual([old_task], resumed["removed_tasks"])
        self.assertEqual(1, len(resumed["added_tasks"]))
        self.assertEqual("removed", manifest["tasks"][old_task]["status"])
        new_task = manifest["tasks"][resumed["added_tasks"][0]]
        self.assertEqual("new.go", new_task["path"])
        self.assertEqual("pending", new_task["status"])

        new_task_id = resumed["added_tasks"][0]
        self.start_task(session, new_task_id)
        self.cli(
            "complete",
            "--session",
            session,
            "--task",
            new_task_id,
            "--coverage",
            self.coverage_file("coverage-new.json"),
        )
        finalized = self.cli("finalize", "--session", session)
        result = json.loads(Path(finalized["result_json"]).read_text(encoding="utf-8"))
        self.assertEqual("complete", result["completion_status"])
        self.assertNotIn(old_task, result["stale_tasks"])

    def test_parallel_task_start_preserves_every_manifest_update(self):
        for index in range(12):
            self.write(f"file{index}.go", f"package pay\nfunc F{index}() {{}}\n")
        self.commit_all()
        session = self.init_scan(concurrency="12")
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        processes = [
            subprocess.Popen(
                [
                    sys.executable,
                    str(SCRIPT),
                    "task-start",
                    "--session",
                    str(session),
                    "--task",
                    task_id,
                    "--reviewer-context",
                    f"reviewer-{task_id}",
                ],
                cwd=self.repo,
                text=True,
                encoding="utf-8",
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            for task_id in manifest["tasks"]
        ]
        outputs = [process.communicate(timeout=20) + (process.returncode,) for process in processes]
        self.assertTrue(all(code == 0 for _stdout, _stderr, code in outputs), outputs)
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        self.assertTrue(all(task["status"] == "running" for task in manifest["tasks"].values()))

    def test_superseded_finding_can_be_resubmitted_for_new_task_revision(self):
        self.write(
            "payment.go",
            "package pay\nfunc Charge() error {\n\tresult, _ := charge()\n\treturn use(result)\n}\n",
        )
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        payload = self.root / "revision-finding.json"
        payload.write_text(
            json.dumps(
                {
                    "title": "扣款错误被忽略",
                    "claim": "charge 错误被忽略",
                    "severity": "high",
                    "category": "bug",
                    "existing_code": "\tresult, _ := charge()\n\treturn use(result)",
                    "expected": "传播错误",
                    "actual": "继续执行",
                    "impact": "状态错误",
                    "impact_surface": "runtime",
                    "reachability": "proven",
                    "current_input_reproducible": True,
                    "evidence": ["错误值被丢弃"],
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        first = self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload
        )
        self.write(
            "payment.go",
            "package pay\n// revision two\nfunc Charge() error {\n\tresult, _ := charge()\n\treturn use(result)\n}\n",
        )
        self.cli("resume", "--session", session)
        self.start_task(session, task_id)

        invalid = self.cli(
            "verify",
            "--session",
            session,
            "--finding",
            first["finding_id"],
            "--decision",
            "confirm",
            "--reason",
            "late result",
            expect=2,
        )
        self.assertEqual("INVALID_FINDING_STATE", invalid["error"])

        second = self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload
        )
        self.assertNotEqual(first["finding_id"], second["finding_id"])
        self.assertFalse(second.get("duplicate", False))

    def test_context_stale_resubmit_revives_superseded_same_finding_id(self):
        self.write(
            "payment.go",
            "package pay\nfunc Charge() error {\n\tresult, _ := charge()\n\treturn use(result)\n}\n",
        )
        self.write("account.go", "package pay\nfunc ReadAccount() {}\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(
            task_id for task_id, task in manifest["tasks"].items() if task["path"] == "payment.go"
        )
        self.start_task(session, task_id)
        payload = self.root / "context-stale-finding.json"
        payload.write_text(
            json.dumps(
                {
                    "title": "扣款错误被忽略",
                    "claim": "charge 错误被忽略",
                    "severity": "high",
                    "category": "bug",
                    "existing_code": "\tresult, _ := charge()\n\treturn use(result)",
                    "expected": "传播错误",
                    "actual": "继续执行",
                    "impact": "状态错误",
                    "impact_surface": "runtime",
                    "reachability": "proven",
                    "current_input_reproducible": True,
                    "evidence": ["错误值被丢弃"],
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        first = self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload
        )
        self.cli(
            "verify",
            "--session",
            session,
            "--finding",
            first["finding_id"],
            "--decision",
            "confirm",
            "--reason",
            "No counter-evidence",
        )
        coverage = self.root / "coverage-context-stale.json"
        coverage.write_text(
            json.dumps(
                {
                    "primary_target_complete": True,
                    "symbols": ["Charge"],
                    "ranges": [],
                    "dimensions": ["correctness"],
                    "skipped": [],
                    "blind_spots": [],
                    "pending_questions": [],
                    "context_paths": ["account.go"],
                }
            ),
            encoding="utf-8",
        )
        self.cli(
            "complete",
            "--session",
            session,
            "--task",
            task_id,
            "--coverage",
            coverage,
        )
        self.write("account.go", "package pay\nfunc ReadAccount() { changed() }\n")
        resumed = self.cli("resume", "--session", session)
        self.assertIn(task_id, resumed["stale_tasks"])
        finding_path = Path(first["finding_file"])
        superseded = json.loads(finding_path.read_text(encoding="utf-8"))
        self.assertEqual("superseded", superseded["state"])
        self.start_task(session, task_id)

        second = self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload
        )

        self.assertEqual(first["finding_id"], second["finding_id"])
        self.assertTrue(second.get("revived"))
        self.assertFalse(second.get("duplicate", False))
        revived = json.loads(finding_path.read_text(encoding="utf-8"))
        self.assertEqual("candidate", revived["state"])
        self.assertEqual("pending", revived["verification"]["status"])

    def test_superseded_pending_verifier_does_not_block_new_completion(self):
        self.write("payment.go", "package pay\nfunc Charge() { risky() }\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        finding_dir = session / "findings" / task_id
        finding_dir.mkdir(parents=True, exist_ok=True)
        (finding_dir / "old-pending.json").write_text(
            json.dumps(
                {
                    "id": "old-pending",
                    "task_id": task_id,
                    "state": "candidate",
                    "verification": {"required": True, "status": "pending"},
                }
            ),
            encoding="utf-8",
        )
        self.write("payment.go", "package pay\nfunc Charge() { safe() }\n")
        self.cli("resume", "--session", session)
        self.start_task(session, task_id)

        completed = self.cli(
            "complete",
            "--session",
            session,
            "--task",
            task_id,
            "--coverage",
            self.coverage_file("coverage-superseded.json"),
        )
        self.assertEqual("complete", completed["status"])

    def test_submit_is_rejected_after_task_completion(self):
        self.write("payment.go", "package pay\nfunc Charge() { risky() }\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        self.cli(
            "complete",
            "--session",
            session,
            "--task",
            task_id,
            "--coverage",
            self.coverage_file("coverage-state.json"),
        )
        payload = self.root / "late-finding.json"
        payload.write_text(
            json.dumps(
                {
                    "title": "late",
                    "claim": "late claim",
                    "severity": "medium",
                    "category": "bug",
                    "existing_code": "risky()",
                    "expected": "safe",
                    "actual": "risky",
                    "impact": "late",
                    "impact_surface": "runtime",
                    "reachability": "proven",
                    "current_input_reproducible": True,
                    "evidence": ["late"],
                }
            ),
            encoding="utf-8",
        )

        error = self.cli(
            "submit",
            "--session",
            session,
            "--task",
            task_id,
            "--input",
            payload,
            expect=2,
        )
        self.assertEqual("INVALID_TASK_STATE", error["error"])

    def test_review_workspace_includes_tracked_and_untracked_current_changes(self):
        self.write("payment.go", "package pay\nfunc Charge() {}\n")
        self.commit_all()
        self.write("payment.go", "package pay\nfunc Charge() { changed() }\n")
        self.write("helper.go", "package pay\nfunc Helper() {}\n")
        self.write("helper_test.go", "package pay\n")

        initialized = self.cli(
            "init",
            "--repo",
            self.repo,
            "--mode",
            "review",
            "--base",
            "HEAD",
            "--workspace",
            "--session-id",
            "workspace-review",
            "--state-root",
            self.state,
        )
        session = Path(initialized["session_dir"])
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        session_json = json.loads((session / "session.json").read_text(encoding="utf-8"))
        paths = {task["path"] for task in manifest["tasks"].values()}

        self.assertEqual({"helper.go", "payment.go"}, paths)
        self.assertEqual("WORKTREE", session_json["head"])

    def test_project_rule_rejects_absolute_or_missing_reference(self):
        self.write("payment.go", "package pay\n")
        external = self.root / "external-rule.md"
        external.write_text("secret outside rule", encoding="utf-8")
        self.write(
            ".opencodereview/rule.json",
            json.dumps({"rules": [{"path": "**/*.go", "rule": str(external)}]}),
        )
        self.commit_all()

        error = self.cli(
            "init",
            "--repo",
            self.repo,
            "--mode",
            "scan",
            "--session-id",
            "unsafe-rule",
            "--state-root",
            self.state,
            expect=2,
        )
        self.assertEqual("INVALID_RULE", error["error"])

        self.write(
            ".opencodereview/rule.json",
            json.dumps({"rules": [{"path": "**/*.go", "rule": "missing/rule.md"}]}),
        )
        error = self.cli(
            "init",
            "--repo",
            self.repo,
            "--mode",
            "scan",
            "--session-id",
            "missing-rule",
            "--state-root",
            self.state,
            expect=2,
        )
        self.assertEqual("INVALID_RULE", error["error"])

    def test_resume_persists_replacement_custom_rule_and_task_metadata(self):
        self.write("payment.go", "package pay\n")
        self.commit_all()
        first_rule = self.root / "first-rule.json"
        second_rule = self.root / "second-rule.json"
        first_rule.write_text(
            json.dumps({"rules": [{"path": "**/*.go", "rule": "FIRST INLINE RULE"}]}),
            encoding="utf-8",
        )
        second_rule.write_text(
            json.dumps({"rules": [{"path": "**/*.go", "rule": "SECOND INLINE RULE"}]}),
            encoding="utf-8",
        )
        initialized = self.cli(
            "init",
            "--repo",
            self.repo,
            "--mode",
            "scan",
            "--rule",
            first_rule,
            "--session-id",
            "rule-resume",
            "--state-root",
            self.state,
            "--yes",
        )
        session = Path(initialized["session_dir"])
        before = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        before_sha = next(iter(before["tasks"].values()))["rule"]["sha256"]

        self.cli("resume", "--session", session, "--rule", second_rule)
        session_json = json.loads((session / "session.json").read_text(encoding="utf-8"))
        after = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task = next(iter(after["tasks"].values()))

        self.assertEqual(str(second_rule.resolve()), session_json["custom_rule_path"])
        self.assertEqual("custom", task["rule"]["source"])
        self.assertNotEqual(before_sha, task["rule"]["sha256"])

    def test_delivery_impact_is_validated_and_published(self):
        self.write("payment.go", "package pay\nfunc Charge() { risky() }\n")
        self.commit_all()
        initialized = self.cli(
            "init",
            "--repo",
            self.repo,
            "--mode",
            "scan",
            "--profile",
            "production-readiness",
            "--session-id",
            "delivery-impact",
            "--state-root",
            self.state,
            "--yes",
        )
        session = Path(initialized["session_dir"])
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        payload = self.root / "delivery-finding.json"
        finding = {
            "title": "fake success",
            "claim": "operation always reports success",
            "severity": "medium",
            "category": "bug",
            "existing_code": "risky()",
            "expected": "propagate failure",
            "actual": "reports success",
            "impact": "misleading production state",
            "impact_surface": "runtime",
            "reachability": "proven",
            "current_input_reproducible": True,
            "evidence": ["failure result is ignored"],
            "delivery_impact": "P1",
        }
        invalid_finding = dict(finding)
        invalid_finding["delivery_impact"] = "P3"
        payload.write_text(json.dumps(invalid_finding), encoding="utf-8")
        error = self.cli(
            "submit",
            "--session",
            session,
            "--task",
            task_id,
            "--input",
            payload,
            expect=2,
        )
        self.assertEqual("INVALID_DELIVERY_IMPACT", error["error"])

        payload.write_text(json.dumps(finding), encoding="utf-8")
        submitted = self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload
        )
        self.assertEqual("confirmed", submitted["state"])
        self.cli(
            "complete",
            "--session",
            session,
            "--task",
            task_id,
            "--coverage",
            self.coverage_file("coverage-delivery.json"),
        )
        finalized = self.cli("finalize", "--session", session)
        result = json.loads(Path(finalized["result_json"]).read_text(encoding="utf-8"))
        self.assertEqual("P1", result["findings"][0]["delivery_impact"])

    def test_anchor_ending_with_newline_does_not_extend_end_line(self):
        self.write("payment.go", "package pay\nfunc Charge() {\n\trisky()\n}\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        payload = self.root / "newline-finding.json"
        payload.write_text(
            json.dumps(
                {
                    "title": "risky",
                    "claim": "risky call",
                    "severity": "medium",
                    "category": "bug",
                    "existing_code": "\trisky()\n",
                    "expected": "safe",
                    "actual": "risky",
                    "impact": "failure",
                    "impact_surface": "runtime",
                    "reachability": "proven",
                    "current_input_reproducible": True,
                    "evidence": ["direct call"],
                }
            ),
            encoding="utf-8",
        )

        submitted = self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload
        )
        stored = json.loads(Path(submitted["finding_file"]).read_text(encoding="utf-8"))
        self.assertEqual(3, stored["location"]["start_line"])
        self.assertEqual(3, stored["location"]["end_line"])

    def test_review_rejects_invented_deletion_evidence_outside_diff(self):
        self.write(
            "payment.go",
            "package pay\nfunc Charge() {\n\tguard()\n\trisky()\n}\n",
        )
        self.commit_all("base")
        base = self.git("rev-parse", "HEAD")
        self.write(
            "payment.go",
            "package pay\nfunc Charge() {\n\tguard()\n\trisky()\n}\n// unrelated change\n",
        )
        self.commit_all("head")
        initialized = self.cli(
            "init",
            "--repo",
            self.repo,
            "--mode",
            "review",
            "--base",
            base,
            "--session-id",
            "invented-deletion",
            "--state-root",
            self.state,
            "--yes",
        )
        session = Path(initialized["session_dir"])
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        payload = self.root / "invented-deletion.json"
        payload.write_text(
            json.dumps(
                {
                    "title": "guard removed",
                    "claim": "a required guard was removed",
                    "severity": "medium",
                    "category": "bug",
                    "existing_code": "\trisky()",
                    "expected": "guard remains",
                    "actual": "guard removed",
                    "impact": "unsafe call",
                    "impact_surface": "runtime",
                    "reachability": "proven",
                    "current_input_reproducible": True,
                    "evidence": ["claimed deletion"],
                    "change_kind": "deletion",
                    "change_evidence": "guardWasActuallyDeleted()",
                }
            ),
            encoding="utf-8",
        )

        error = self.cli(
            "submit",
            "--session",
            session,
            "--task",
            task_id,
            "--input",
            payload,
            expect=2,
        )
        self.assertEqual("INVALID_DELETION_EVIDENCE", error["error"])

    def test_review_accepts_verbatim_deleted_hunk_evidence(self):
        self.write(
            "payment.go",
            "package pay\nfunc Charge() {\n\tguard()\n\trisky()\n}\n",
        )
        self.commit_all("base")
        base = self.git("rev-parse", "HEAD")
        self.write("payment.go", "package pay\nfunc Charge() {\n\trisky()\n}\n")
        self.commit_all("head")
        initialized = self.cli(
            "init", "--repo", self.repo, "--mode", "review", "--base", base,
            "--session-id", "real-deletion", "--state-root", self.state, "--yes",
        )
        session = Path(initialized["session_dir"])
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        payload = self.root / "real-deletion.json"
        payload.write_text(
            json.dumps(
                {
                    "title": "guard removed",
                    "claim": "a required guard was removed",
                    "severity": "medium",
                    "category": "bug",
                    "existing_code": "\trisky()",
                    "expected": "guard remains",
                    "actual": "guard removed",
                    "impact": "unsafe call",
                    "impact_surface": "runtime",
                    "reachability": "proven",
                    "current_input_reproducible": True,
                    "evidence": ["guard call is deleted"],
                    "change_kind": "deletion",
                    "change_evidence": "\tguard()",
                }
            ),
            encoding="utf-8",
        )

        submitted = self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload
        )
        self.assertEqual("confirmed", submitted["state"])

    def test_review_rejects_partial_line_deletion_evidence(self):
        self.write(
            "payment.go",
            "package pay\nfunc Charge() {\n\tguard()\n\trisky()\n}\n",
        )
        self.commit_all("base")
        base = self.git("rev-parse", "HEAD")
        self.write("payment.go", "package pay\nfunc Charge() {\n\trisky()\n}\n")
        self.commit_all("head")
        initialized = self.cli(
            "init", "--repo", self.repo, "--mode", "review", "--base", base,
            "--session-id", "partial-deletion", "--state-root", self.state, "--yes",
        )
        session = Path(initialized["session_dir"])
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        payload = self.root / "partial-deletion.json"
        payload.write_text(
            json.dumps(
                {
                    "title": "guard removed",
                    "claim": "a required guard was removed",
                    "severity": "medium",
                    "category": "bug",
                    "existing_code": "\trisky()",
                    "expected": "guard remains",
                    "actual": "guard removed",
                    "impact": "unsafe call",
                    "impact_surface": "runtime",
                    "reachability": "proven",
                    "current_input_reproducible": True,
                    "evidence": ["guard call is deleted"],
                    "change_kind": "deletion",
                    "change_evidence": "g",
                }
            ),
            encoding="utf-8",
        )

        error = self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload,
            expect=2,
        )
        self.assertEqual("INVALID_DELETION_EVIDENCE", error["error"])

    def test_task_plan_dimensions_must_be_covered_or_explicitly_skipped(self):
        self.write("payment.go", "package pay\nfunc Charge() {}\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        plan = self.root / "task-plan.json"
        plan.write_text(
            json.dumps(
                {
                    "dimensions": ["correctness", "authorization"],
                    "signals": [
                        {"name": "auth-boundary", "evidence": "Charge is called after auth middleware"}
                    ],
                }
            ),
            encoding="utf-8",
        )
        planned = self.cli(
            "task-plan", "--session", session, "--task", task_id, "--input", plan
        )
        self.assertEqual(["correctness", "authorization"], planned["dimensions"])
        self.start_task(session, task_id)

        incomplete = self.cli(
            "complete",
            "--session",
            session,
            "--task",
            task_id,
            "--coverage",
            self.coverage_file("coverage-plan-incomplete.json"),
            expect=2,
        )
        self.assertEqual("DIMENSION_COVERAGE_MISSING", incomplete["error"])

        coverage = self.root / "coverage-plan-complete.json"
        coverage.write_text(
            json.dumps(
                {
                    "primary_target_complete": True,
                    "symbols": ["Charge"],
                    "ranges": [],
                    "dimensions": ["correctness"],
                    "skipped": [
                        {"dimension": "authorization", "reason": "No authorization decision in target"}
                    ],
                    "blind_spots": [],
                    "pending_questions": [],
                }
            ),
            encoding="utf-8",
        )
        completed = self.cli(
            "complete", "--session", session, "--task", task_id, "--coverage", coverage
        )
        self.assertEqual("complete", completed["status"])

    def test_argparse_errors_are_json(self):
        error = self.cli("task-start", "--session", self.state, expect=2)
        self.assertEqual("INVALID_ARGUMENTS", error["error"])
        self.assertIn("--task", error["message"])

    def test_coverage_ranges_require_positive_ordered_line_pairs(self):
        self.write("payment.go", "package pay\nfunc Charge() {}\n")
        self.commit_all()
        initialized = self.cli(
            "init", "--repo", self.repo, "--mode", "scan", "--session-id", "range-shape",
            "--state-root", self.state, "--segment-threshold", "1", "--yes",
        )
        session = Path(initialized["session_dir"])
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)

        def assert_invalid_ranges(name: str, ranges: list) -> None:
            coverage = self.root / name
            coverage.write_text(
                json.dumps(
                    {
                        "primary_target_complete": True,
                        "symbols": [],
                        "ranges": ranges,
                        "dimensions": ["correctness"],
                        "skipped": [],
                        "blind_spots": [],
                        "pending_questions": [],
                    }
                ),
                encoding="utf-8",
            )
            error = self.cli(
                "complete",
                "--session",
                session,
                "--task",
                task_id,
                "--coverage",
                coverage,
                expect=2,
            )
            self.assertEqual("INVALID_COVERAGE", error["error"])

        assert_invalid_ranges("coverage-invalid-range-none.json", [None])
        assert_invalid_ranges(
            "coverage-invalid-range-zero.json",
            [{"start_line": 0, "end_line": 1}],
        )
        assert_invalid_ranges(
            "coverage-invalid-range-unordered.json",
            [{"start_line": 4, "end_line": 2}],
        )

    def test_init_without_mode_defaults_to_workspace_review(self):
        self.write("payment.go", "package pay\n")
        self.commit_all()
        self.write("payment.go", "package pay\nfunc Charge() {}\n")

        initialized = self.cli(
            "init",
            "--repo",
            self.repo,
            "--session-id",
            "default-mode",
            "--state-root",
            self.state,
        )
        session = Path(initialized["session_dir"])
        session_json = json.loads((session / "session.json").read_text(encoding="utf-8"))
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual("review", initialized["mode"])
        self.assertEqual("review", session_json["mode"])
        self.assertEqual("HEAD", session_json["base"])
        self.assertEqual("WORKTREE", session_json["head"])
        self.assertEqual({"payment.go"}, {task["path"] for task in manifest["tasks"].values()})

    def test_scan_runtime_scope_excludes_docs_and_tooling_but_full_restores_them(self):
        self.write("app/main.py", "def run():\n    return True\n")
        self.write("docs/architecture.md", "# Architecture\n")
        self.write("scripts/one_off.mjs", "export const run = () => true;\n")
        self.commit_all()

        runtime = self.cli(
            "init", "--repo", self.repo, "--mode", "scan",
            "--session-id", "runtime-scope", "--state-root", self.state, "--yes",
        )
        runtime_manifest = json.loads(
            (Path(runtime["session_dir"]) / "manifest.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            {"app/main.py"},
            {task["path"] for task in runtime_manifest["tasks"].values()},
        )
        self.assertEqual("runtime-code", runtime["scope"])
        self.assertGreater(runtime["composition"]["excluded_by_reason"]["scan-scope"], 0)

        full = self.cli(
            "init", "--repo", self.repo, "--mode", "scan", "--scope", "full",
            "--session-id", "full-scope", "--state-root", self.state, "--yes",
        )
        full_manifest = json.loads(
            (Path(full["session_dir"]) / "manifest.json").read_text(encoding="utf-8")
        )
        self.assertTrue(
            {"app/main.py", "docs/architecture.md", "scripts/one_off.mjs"}.issubset(
                {task["path"] for task in full_manifest["tasks"].values()}
            )
        )

    def test_init_returns_composition_and_low_likely_high_token_preflight(self):
        self.write("app.py", "def run():\n    return '" + ("x" * 4000) + "'\n")
        self.commit_all()

        initialized = self.cli(
            "init", "--repo", self.repo, "--mode", "scan",
            "--token-budget", "1", "--session-id", "token-preflight",
            "--state-root", self.state,
        )
        self.assertEqual("awaiting_start", initialized["status"])
        self.assertEqual("present_launch_menu_and_wait_for_start", initialized["next_action"])
        self.assertIn("launch_menu", initialized)
        estimate = initialized["token_estimate"]
        self.assertGreater(estimate["source_tokens"], 0)
        self.assertLessEqual(estimate["low"], estimate["likely"])
        self.assertLessEqual(estimate["likely"], estimate["high"])
        self.assertTrue(estimate["budget"]["likely_exceeds"])
        self.assertIn("top_directories", initialized["composition"])

    def test_pause_stops_new_dispatch_and_resume_preserves_running_reviewers(self):
        self.write("app.py", "def run():\n    return True\n")
        self.commit_all()
        session = self.init_scan()
        task_id = next(iter(json.loads((session / "manifest.json").read_text(encoding="utf-8"))["tasks"]))
        self.start_task(session, task_id)

        paused = self.cli("pause", "--session", session, "--reason", "operator pause")
        self.assertEqual("paused", paused["status"])
        error = self.cli("dispatch-next", "--session", session, expect=2)
        self.assertEqual("SESSION_PAUSED", error["error"])

        resumed = self.cli("resume", "--session", session)
        self.assertEqual("running", resumed["status"])
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual("running", manifest["tasks"][task_id]["status"])

    def test_abort_invalidates_orphan_writes_and_generates_partial_summary(self):
        self.write("app.py", "def run():\n    return True\n")
        self.commit_all()
        session = self.init_scan()
        task_id = next(iter(json.loads((session / "manifest.json").read_text(encoding="utf-8"))["tasks"]))
        self.start_task(session, task_id)

        aborted = self.cli("abort", "--session", session, "--reason", "user requested stop")
        self.assertEqual("aborted", aborted["status"])
        self.assertGreaterEqual(aborted["session_epoch"], 2)
        self.assertTrue((session / "_partial_summary.md").is_file())
        self.assertTrue((session / "result.partial.json").is_file())
        self.assertTrue((session / "fix-queue.json").is_file())
        status = self.cli("status", "--session", session)
        self.assertEqual("inspect_partial_result", status["next_action"])

        error = self.cli(
            "complete", "--session", session, "--task", task_id,
            "--coverage", self.coverage_file("abort-coverage.json"), expect=2,
        )
        self.assertEqual("SESSION_ABORTED", error["error"])
        finalize_error = self.cli("finalize", "--session", session, expect=2)
        self.assertEqual("SESSION_ABORTED", finalize_error["error"])

    def test_orchestrate_tick_reserves_verifier_capacity_before_reviewers(self):
        for index in range(4):
            self.write(f"file{index}.go", f"package pay\nfunc F{index}() {{}}\n")
        self.commit_all()
        session = self.init_scan(concurrency="4")
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        first_task = sorted(manifest["tasks"])[0]
        finding_dir = session / "findings" / first_task
        finding_dir.mkdir(parents=True, exist_ok=True)
        (finding_dir / "finding-high.json").write_text(
            json.dumps({
                "id": "finding-high", "task_id": first_task, "severity": "high",
                "category": "security", "state": "candidate",
                "verification": {"required": True, "status": "pending"},
                "created_at": "2026-01-01T00:00:00+00:00",
            }),
            encoding="utf-8",
        )

        tick = self.cli(
            "orchestrate-tick", "--session", session, "--available-slots", "2"
        )
        self.assertEqual("verify", tick["actions"][0]["kind"])
        self.assertEqual("finding-high", tick["actions"][0]["finding_id"])
        self.assertEqual(1, tick["verifier_backlog"]["leased"])
        self.assertTrue(any(action["kind"] == "review" for action in tick["actions"]))
        self.assertTrue(all(action["session_epoch"] == 1 for action in tick["actions"]))

    def test_adaptive_orchestrate_tick_requests_all_targets_without_controller_slot_guess(self):
        for index in range(40):
            self.write(f"file{index:02d}.go", f"package pay\nfunc F{index}() {{}}\n")
        self.commit_all()
        session = self.init_scan(concurrency="auto")

        tick = self.cli("orchestrate-tick", "--session", session)

        self.assertEqual(40, len(tick["actions"]))
        self.assertEqual(40, tick["requested_concurrency"])
        self.assertIsNotNone(tick["launch_id"])
        self.assertEqual("maximize", tick["phase"])

    def test_init_awaits_start_and_blocks_dispatch_until_confirmed(self):
        self.write("payment.go", "package pay\n\nfunc Charge() error { return nil }\n")
        self.commit_all()
        initialized = self.cli(
            "init",
            "--repo", self.repo,
            "--mode", "scan",
            "--session-id", "await-start",
            "--state-root", self.state,
        )
        self.assertEqual("awaiting_start", initialized["status"])
        self.assertEqual("present_launch_menu_and_wait_for_start", initialized["next_action"])
        self.assertIn("launch_menu", initialized)
        self.assertIn("token_estimate", initialized)
        self.assertTrue(initialized["launch_menu"]["must_confirm_before_dispatch"])
        session = Path(initialized["session_dir"])

        blocked = self.cli("orchestrate-tick", "--session", session, expect=2)
        self.assertEqual("SESSION_AWAITING_START", blocked["error"])
        self.assertEqual("present_launch_menu_and_wait_for_start", blocked["next_action"])

        started = self.cli("start", "--session", session, "--concurrency", "max", "--choice", "scan-runtime")
        self.assertEqual("running", started["status"])
        self.assertEqual("enrich_stack_card_then_orchestrate_tick", started["next_action"])

        tick = self.cli("orchestrate-tick", "--session", session)
        self.assertEqual(1, len(tick["actions"]))

    def test_fleet_plan_opens_shards_and_merges_like_go_fast(self):
        for index in range(20):
            self.write(f"pkg{index:02d}/main.go", f"package p{index}\nfunc F() {{}}\n")
        self.commit_all()
        session = self.init_scan(concurrency="max", yes=False, session_id="fleet-cap")
        started = self.cli("start", "--session", session, "--choice", "scan-runtime")
        self.assertTrue(started.get("fleet_recommendation", {}).get("recommended"))
        self.assertEqual("fleet_plan_then_worktree_shards", started["next_action"])

        planned = self.cli("fleet-plan", "--session", session, "--fleet-cap", "5")
        self.assertEqual(5, planned["shard_count"])
        self.assertEqual(20, planned["runnable_tasks"])
        self.assertEqual("create_worktrees_and_open_fleet_shards", planned["next_action"])

        # Reuse the same repo path as a stand-in worktree for unit tests.
        for shard in planned["shards"]:
            opened = self.cli(
                "fleet-shard-open",
                "--session",
                session,
                "--shard",
                shard["id"],
                "--repo",
                self.repo,
            )
            self.assertEqual(shard["id"], opened["shard_id"])
            child = Path(opened["session_dir"])
            child_manifest = json.loads((child / "manifest.json").read_text(encoding="utf-8"))
            for task_id in child_manifest["tasks"]:
                self.start_task(child, task_id)
                self.cli(
                    "complete",
                    "--session",
                    child,
                    "--task",
                    task_id,
                    "--coverage",
                    self.coverage_file(f"{shard['id']}-{task_id}.json"),
                )

        status = self.cli("fleet-status", "--session", session)
        self.assertTrue(status["all_shards_terminal"])
        self.assertEqual("fleet_merge", status["next_action"])

        merged = self.cli("fleet-merge", "--session", session)
        self.assertEqual(20, merged["merged_tasks"])
        self.assertEqual("dedup_plan_then_finalize_then_fleet_cleanup", merged["next_action"])
        parent_manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(
            20,
            sum(task["status"] == "complete" for task in parent_manifest["tasks"].values()),
        )
        self.assertEqual(
            0,
            sum(task["status"] == "fleeted" for task in parent_manifest["tasks"].values()),
        )

    def test_fleet_cleanup_removes_worktrees_after_merge(self):
        for index in range(8):
            self.write(f"fleetwt{index:02d}/main.go", f"package p{index}\nfunc F() {{}}\n")
        self.commit_all()
        session = self.init_scan(concurrency="max", yes=False, session_id="fleet-cleanup")
        self.cli("start", "--session", session, "--choice", "scan-runtime")
        planned = self.cli("fleet-plan", "--session", session, "--fleet-cap", "2")
        worktree_paths: list[Path] = []
        for shard in planned["shards"]:
            worktree_path = self.repo / ".worktrees" / shard["worktree_name"]
            worktree_path.parent.mkdir(parents=True, exist_ok=True)
            self.git("worktree", "add", str(worktree_path), "-b", shard["branch_name"])
            worktree_paths.append(worktree_path)
            opened = self.cli(
                "fleet-shard-open",
                "--session",
                session,
                "--shard",
                shard["id"],
                "--repo",
                worktree_path,
            )
            child = Path(opened["session_dir"])
            for task_id in json.loads((child / "manifest.json").read_text(encoding="utf-8"))["tasks"]:
                self.start_task(child, task_id)
                self.cli(
                    "complete",
                    "--session",
                    child,
                    "--task",
                    task_id,
                    "--coverage",
                    self.coverage_file(f"{shard['id']}-{task_id}.json"),
                )
        self.cli("fleet-merge", "--session", session)
        cleanup = self.cli("fleet-cleanup", "--session", session)
        self.assertTrue(
            cleanup["cleanup"]["done"],
            msg=json.dumps(cleanup["cleanup"].get("remaining"), ensure_ascii=False),
        )
        self.assertEqual(len(planned["shards"]), len(cleanup["cleanup"]["removed_worktrees"]))
        for worktree_path in worktree_paths:
            self.assertFalse(worktree_path.exists())
        for shard in planned["shards"]:
            proc = subprocess.run(
                ["git", "branch", "--list", shard["branch_name"]],
                cwd=self.repo,
                text=True,
                capture_output=True,
                check=True,
            )
            self.assertEqual("", proc.stdout.strip())

    def test_fleet_parent_dispatch_forbidden_after_plan(self):
        for index in range(20):
            self.write(f"pkg{index:02d}/main.go", f"package p{index}\nfunc F() {{}}\n")
        self.commit_all()
        session = self.init_scan(concurrency="max", yes=False, session_id="fleet-guard-parent")
        self.cli("start", "--session", session, "--choice", "scan-runtime")
        self.cli("fleet-plan", "--session", session, "--fleet-cap", "5")
        blocked = self.cli("orchestrate-tick", "--session", session, expect=2)
        self.assertEqual("FLEET_PARENT_DISPATCH_FORBIDDEN", blocked["error"])
        self.assertEqual(
            "fleet_shard_open_then_shard_controller_tick",
            blocked["next_action"],
        )

    def test_fleet_child_contamination_blocks_tick(self):
        for index in range(20):
            self.write(f"pkg{index:02d}/main.go", f"package p{index}\nfunc F() {{}}\n")
        self.commit_all()
        session = self.init_scan(concurrency="max", yes=False, session_id="fleet-guard-child")
        self.cli("start", "--session", session, "--choice", "scan-runtime")
        planned = self.cli("fleet-plan", "--session", session, "--fleet-cap", "5")
        opened = self.cli(
            "fleet-shard-open",
            "--session",
            session,
            "--shard",
            planned["shards"][0]["id"],
            "--repo",
            self.repo,
        )
        child = Path(opened["session_dir"])
        self.assertTrue(opened["fleet_preflight"]["ok"])
        child_manifest = json.loads((child / "manifest.json").read_text(encoding="utf-8"))
        extra_task = dict(next(iter(child_manifest["tasks"].values())))
        extra_task["id"] = "task-extra-contamination"
        extra_task["path"] = "extra.go"
        child_manifest["tasks"][extra_task["id"]] = extra_task
        (child / "manifest.json").write_text(
            json.dumps(child_manifest, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        blocked = self.cli("orchestrate-tick", "--session", child, expect=2)
        self.assertEqual("FLEET_SHARD_CONTAMINATION", blocked["error"])
        preflight = self.cli("fleet-preflight", "--session", child)
        self.assertFalse(preflight["fleet_preflight"]["ok"])

    def test_fleet_worktree_init_forbidden(self):
        worktree = self.repo / ".worktrees" / "ocr-fleet-shard-99"
        worktree.mkdir(parents=True, exist_ok=True)
        blocked = self.cli(
            "init",
            "--repo",
            worktree,
            "--mode",
            "scan",
            "--session-id",
            "fleet-worktree-init",
            "--state-root",
            self.state,
            expect=2,
        )
        self.assertEqual("FLEET_WORKTREE_INIT_FORBIDDEN", blocked["error"])

    def test_bulk_host_rejection_recommends_fleet(self):
        for index in range(60):
            self.write(f"bulk{index:02d}.go", f"package b{index}\nfunc F{index}() {{}}\n")
        self.commit_all()
        session = self.init_scan(concurrency="max", session_id="fleet-bulk-reject")
        tick = self.cli("orchestrate-tick", "--session", session)
        launch_id = tick["launch_id"]
        report = {
            "accepted": [],
            "rejected": [
                {"lease_id": action["lease_id"], "reason": "host_capacity"}
                for action in tick["actions"]
            ],
        }
        report_path = self.repo / "launch-report-bulk.json"
        report_path.write_text(json.dumps(report), encoding="utf-8")
        result = self.cli(
            "orchestrate-report",
            "--session",
            session,
            "--launch",
            launch_id,
            "--input",
            report_path,
        )
        self.assertEqual(60, result["rejected"])
        self.assertTrue(result.get("fleet_recommendation", {}).get("recommended"))
        self.assertEqual("fleet_plan_then_worktree_shards", result["next_action"])

    def test_launch_menu_includes_budgets_for_every_option_and_reply_guide(self):
        self.write("apps/main.go", "package main\nfunc main() {}\n")
        self.write("packages/lib.go", "package lib\nfunc Help() {}\n")
        self.write("docs/readme.md", "# docs\n")
        self.write("scripts/tool.py", "print('x')\n")
        self.commit_all()
        # Uncommitted workspace change so workspace-review has a target.
        self.write("apps/main.go", "package main\nfunc main() { println(\"x\") }\n")

        initialized = self.cli(
            "init",
            "--repo", self.repo,
            "--mode", "review",
            "--workspace",
            "--session-id", "menu-budgets",
            "--state-root", self.state,
        )
        menu = initialized["launch_menu"]
        self.assertIn("how_to_reply", menu)
        self.assertIn("display_template", menu)
        self.assertIn("option_comparison", menu)
        self.assertIn("scan-runtime", menu["display_template"])
        self.assertIn("如何回复", menu["display_template"])
        by_id = {item["id"]: item for item in menu["options"]}
        self.assertIn("workspace-review", by_id)
        self.assertIn("scan-runtime", by_id)
        self.assertIn("scan-apps-packages", by_id)
        self.assertIn("scan-full", by_id)
        self.assertTrue(by_id["workspace-review"]["matches_current_session"])
        self.assertFalse(by_id["scan-runtime"]["matches_current_session"])
        for option_id in ("workspace-review", "scan-runtime", "scan-apps-packages", "scan-full"):
            option = by_id[option_id]
            self.assertIsNotNone(option.get("primary_targets"))
            self.assertIn("likely", option.get("token_estimate") or {})
            self.assertGreaterEqual(option["primary_targets"], 0)
        self.assertGreaterEqual(by_id["scan-full"]["primary_targets"], by_id["scan-runtime"]["primary_targets"])
        self.assertGreaterEqual(
            by_id["scan-runtime"]["token_estimate"]["likely"],
            by_id["workspace-review"]["token_estimate"]["likely"],
        )

        session = Path(initialized["session_dir"])
        mismatch = self.cli(
            "start",
            "--session",
            session,
            "--choice",
            "scan-runtime",
            expect=2,
        )
        self.assertEqual("LAUNCH_CHOICE_REQUIRES_REINIT", mismatch["error"])
        self.assertIn("init --repo", mismatch["suggested_command"])

        started = self.cli(
            "start",
            "--session",
            session,
            "--choice",
            "workspace-review",
            "--concurrency",
            "max",
        )
        self.assertEqual("running", started["status"])

    def test_orchestrate_report_learns_real_host_capacity_and_releases_rejections(self):
        for index in range(40):
            self.write(f"file{index:02d}.go", f"package pay\nfunc F{index}() {{}}\n")
        self.commit_all()
        session = self.init_scan()
        tick = self.cli("orchestrate-tick", "--session", session)
        accepted_actions = tick["actions"][:4]
        rejected_actions = tick["actions"][4:]
        accepted = []
        for index, action in enumerate(accepted_actions):
            context_id = f"host-reviewer-{index}"
            self.cli(
                "task-start", "--session", session, "--task", action["task_id"],
                "--reviewer-context", context_id, "--lease", action["lease_id"],
            )
            accepted.append({"lease_id": action["lease_id"], "context_id": context_id})
        rejected = [
            {
                "lease_id": action["lease_id"],
                "reason": "Cursor rejected context: host concurrency limit",
            }
            for action in rejected_actions
        ]

        report = self.report_launch(session, tick["launch_id"], accepted, rejected)

        self.assertEqual(4, report["accepted"])
        self.assertEqual(36, report["rejected"])
        self.assertEqual(4, report["host_capacity"])
        self.assertEqual(4, report["desired_concurrency"])
        self.assertEqual("saturated", report["probe_state"])
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(4, sum(task["status"] == "running" for task in manifest["tasks"].values()))
        self.assertEqual(36, sum(task["status"] == "pending" for task in manifest["tasks"].values()))
        self.assertFalse(any(task.get("dispatch_lease") for task in manifest["tasks"].values()))
        waiting = self.cli("orchestrate-tick", "--session", session)
        self.assertEqual([], waiting["actions"])

    def test_adaptive_orchestrator_requests_all_targets_when_host_accepts_everything(self):
        for index in range(40):
            self.write(f"file{index:02d}.go", f"package pay\nfunc F{index}() {{}}\n")
        self.commit_all()
        session = self.init_scan(concurrency="auto")
        first = self.cli("orchestrate-tick", "--session", session)
        self.assertEqual(40, len(first["actions"]))
        accepted = []
        for index, action in enumerate(first["actions"]):
            context_id = f"expansion-reviewer-{index}"
            self.cli(
                "task-start", "--session", session, "--task", action["task_id"],
                "--reviewer-context", context_id, "--lease", action["lease_id"],
            )
            accepted.append({"lease_id": action["lease_id"], "context_id": context_id})
        report = self.report_launch(session, first["launch_id"], accepted)
        self.assertEqual(40, report["accepted"])
        self.assertEqual(0, report["rejected"])
        self.assertEqual(40, report["host_capacity"])
        second = self.cli("orchestrate-tick", "--session", session)
        self.assertEqual([], second["actions"])

    def test_verifier_launch_is_acknowledged_before_capacity_report(self):
        for index in range(4):
            self.write(f"file{index}.go", f"package pay\nfunc F{index}() {{}}\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        first_task = sorted(manifest["tasks"])[0]
        finding_dir = session / "findings" / first_task
        finding_dir.mkdir(parents=True, exist_ok=True)
        (finding_dir / "finding-high.json").write_text(
            json.dumps({
                "id": "finding-high", "task_id": first_task, "severity": "high",
                "category": "security", "state": "candidate",
                "verification": {"required": True, "status": "pending"},
                "created_at": "2026-01-01T00:00:00+00:00",
            }),
            encoding="utf-8",
        )

        tick = self.cli("orchestrate-tick", "--session", session)
        verifier = tick["actions"][0]
        self.assertEqual("verify", verifier["kind"])
        started = self.cli(
            "verifier-start", "--session", session,
            "--finding", verifier["finding_id"],
            "--verifier-context", "host-verifier-1",
            "--lease", verifier["lease_id"],
        )
        self.assertEqual("running", started["status"])
        report = self.report_launch(
            session,
            tick["launch_id"],
            [{"lease_id": verifier["lease_id"], "context_id": "host-verifier-1"}],
            [
                {"lease_id": action["lease_id"], "reason": "host concurrency limit"}
                for action in tick["actions"][1:]
            ],
        )
        self.assertEqual(1, report["accepted"])
        self.assertEqual(1, report["host_capacity"])
        status = self.cli("status", "--session", session)
        self.assertEqual(1, status["verifier_backlog"]["running"])

        verified = self.cli(
            "verify", "--session", session, "--finding", "finding-high",
            "--decision", "confirm", "--reason", "independently reproduced",
            "--lease", verifier["lease_id"], "--verifier-context", "host-verifier-1",
        )
        self.assertEqual("confirmed", verified["state"])
        self.assertEqual(0, self.cli("status", "--session", session)["verifier_backlog"]["total"])

    def test_status_is_compact_by_default_and_verbose_on_request(self):
        self.write("app.py", "def run():\n    return True\n")
        self.commit_all()
        session = self.init_scan()

        compact = self.cli("status", "--session", session)
        self.assertIn("summary", compact)
        self.assertIn("verifier_backlog", compact)
        self.assertNotIn("task_details", compact)

        verbose = self.cli("status", "--session", session, "--verbose")
        self.assertEqual(1, len(verbose["task_details"]))

    def test_task_plan_is_idempotent_after_start_but_conflicts_are_item_local(self):
        self.write("app.py", "def run():\n    return True\n")
        self.commit_all()
        session = self.init_scan()
        task_id = next(iter(json.loads((session / "manifest.json").read_text(encoding="utf-8"))["tasks"]))
        plan = self.root / "plan.json"
        plan.write_text(
            json.dumps({"dimensions": ["correctness"], "signals": []}), encoding="utf-8"
        )
        self.start_task(session, task_id)

        same = self.cli(
            "task-plan", "--session", session, "--task", task_id, "--input", plan
        )
        self.assertEqual("skipped_same_plan", same["status"])

        conflict = self.root / "conflict-plan.json"
        conflict.write_text(
            json.dumps({"dimensions": ["correctness", "security"], "signals": []}),
            encoding="utf-8",
        )
        error = self.cli(
            "task-plan", "--session", session, "--task", task_id,
            "--input", conflict, expect=2,
        )
        self.assertEqual("PLAN_CONFLICT", error["error"])
        self.assertEqual("continue_batch_and_reconcile_task_separately", error["next_action"])

    def test_orchestrate_tick_lease_must_be_acked_by_task_start(self):
        self.write("app.py", "def run():\n    return True\n")
        self.commit_all()
        session = self.init_scan()
        tick = self.cli(
            "orchestrate-tick", "--session", session, "--available-slots", "1"
        )
        action = tick["actions"][0]

        missing = self.cli(
            "task-start", "--session", session, "--task", action["task_id"],
            "--reviewer-context", "reviewer-lease", expect=2,
        )
        self.assertEqual("LEASE_REQUIRED", missing["error"])
        started = self.cli(
            "task-start", "--session", session, "--task", action["task_id"],
            "--reviewer-context", "reviewer-lease", "--lease", action["lease_id"],
        )
        self.assertEqual("running", started["status"])

    def test_finding_requires_impact_surface_reachability_and_reproducibility(self):
        self.write("app.py", "def run():\n    return False\n")
        self.commit_all()
        session = self.init_scan()
        task_id = next(iter(json.loads((session / "manifest.json").read_text(encoding="utf-8"))["tasks"]))
        self.start_task(session, task_id)
        payload = self.root / "missing-impact-surface.json"
        payload.write_text(
            json.dumps({
                "title": "false result", "claim": "run always fails", "severity": "medium",
                "category": "bug", "existing_code": "return False",
                "expected": "successful result", "actual": "failure", "impact": "request fails",
                "evidence": ["the return value is constant"],
            }),
            encoding="utf-8",
        )

        error = self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload,
            expect=2,
        )
        self.assertEqual("INVALID_FINDING", error["error"])
        self.assertIn("impact_surface", error["message"])

    def test_cross_file_is_derived_from_xref_not_model_risk_flag(self):
        self.write("app.py", "def run():\n    return False\n")
        self.commit_all()
        session = self.init_scan()
        task_id = next(iter(json.loads((session / "manifest.json").read_text(encoding="utf-8"))["tasks"]))
        self.start_task(session, task_id)
        payload = self.root / "derived-cross-file.json"
        payload.write_text(
            json.dumps({
                "title": "false result", "claim": "run always fails", "severity": "medium",
                "category": "bug", "existing_code": "return False",
                "expected": "successful result", "actual": "failure", "impact": "request fails",
                "impact_surface": "runtime", "reachability": "proven",
                "current_input_reproducible": True,
                "evidence": ["the return value is constant"], "risk_flags": ["cross-file"],
            }),
            encoding="utf-8",
        )

        submitted = self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload
        )
        finding = json.loads(Path(submitted["finding_file"]).read_text(encoding="utf-8"))
        self.assertFalse(finding["cross_file"])
        self.assertEqual("confirmed", finding["state"])

    def test_correctness_tooling_finding_requires_current_reachability(self):
        self.write("scripts/job.py", "def run():\n    return False\n")
        self.write(
            ".opencodereview/rule.json",
            json.dumps({"include": ["scripts/job.py"], "rules": []}),
        )
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(
            task_id for task_id, task in manifest["tasks"].items() if task["path"] == "scripts/job.py"
        )
        self.start_task(session, task_id)
        payload = self.root / "unreachable-tooling.json"
        payload.write_text(
            json.dumps({
                "title": "job fails", "claim": "job always fails", "severity": "high",
                "category": "bug", "existing_code": "return False",
                "expected": "successful result", "actual": "failure", "impact": "tooling failure",
                "impact_surface": "tooling", "reachability": "unknown",
                "current_input_reproducible": False,
                "evidence": ["the return value is constant"],
            }),
            encoding="utf-8",
        )

        error = self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload,
            expect=2,
        )
        self.assertEqual("IMPACT_NOT_CURRENTLY_REACHABLE", error["error"])

    def test_heartbeat_is_rate_limited_and_can_be_forced(self):
        self.write("app.py", "def run():\n    return True\n")
        self.commit_all()
        session = self.init_scan()

        first = self.cli("heartbeat", "--session", session)
        self.assertTrue(first["emit"])
        second = self.cli("heartbeat", "--session", session)
        self.assertFalse(second["emit"])
        forced = self.cli("heartbeat", "--session", session, "--force")
        self.assertTrue(forced["emit"])

    def test_finalize_exports_verified_fix_queue_without_modifying_code(self):
        self.write("app.py", "def problem_0():\n    return False\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        self.submit_medium_finding(session, task_id, 0, "request fails")
        self.cli(
            "complete", "--session", session, "--task", task_id,
            "--coverage", self.coverage_file("fix-queue-coverage.json"),
        )

        finalized = self.cli("finalize", "--session", session)
        self.assertEqual(str(session / "fix-queue.json"), finalized["fix_queue_json"])
        self.assertEqual("runtime-code", finalized["scope"])
        self.assertIn("top_directories", finalized["composition"])
        self.assertIn("likely", finalized["token_estimate"])
        self.assertTrue((session / "fix-queue.md").is_file())
        queue = json.loads((session / "fix-queue.json").read_text(encoding="utf-8"))
        self.assertEqual(1, queue["count"])
        self.assertEqual("runtime", queue["items"][0]["impact_surface"])
        self.assertEqual("pending", queue["items"][0]["status"])
        report = (session / "result.md").read_text(encoding="utf-8")
        self.assertIn("Impact surface", report)
        self.assertIn("Current input reproducible", report)

        (session / "fix-queue.json").unlink()
        (session / "fix-queue.md").unlink()
        exported = self.cli("export-fix-queue", "--session", session)
        self.assertEqual(1, exported["count"])
        self.assertTrue((session / "fix-queue.json").is_file())

    def test_scan_excludes_installed_copy_of_ocr_skill(self):
        self.write("app.py", "def run():\n    return True\n")
        self.write(
            ".agents/skills/ocr-code-review/scripts/copied_tool.py",
            "def helper():\n    return True\n",
        )
        self.write(
            ".cursor/skills/ocr-code-review/scripts/copied_cursor_tool.py",
            "def helper():\n    return True\n",
        )
        self.commit_all()

        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        paths = {task["path"] for task in manifest["tasks"].values()}
        self.assertEqual({"app.py"}, paths)

    def test_auto_concurrency_maximize_first_has_no_skill_ceiling(self):
        for index in range(16):
            self.write(f"file{index}.go", f"package pay\nfunc F{index}() {{}}\n")
        self.commit_all()
        session = self.init_scan(concurrency="auto")
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(16, manifest["scheduling"]["initial_window"])
        self.assertEqual(16, manifest["scheduling"]["desired_window"])
        self.assertEqual(16, manifest["scheduling"]["limit"])
        self.assertEqual("auto-maximize-then-learn-host-capacity", manifest["scheduling"]["source"])
        tick = self.cli("orchestrate-tick", "--session", session)
        self.assertEqual(16, len(tick["actions"]))
        accepted = []
        for index, action in enumerate(tick["actions"]):
            context_id = f"reviewer-{index}"
            self.cli(
                "task-start",
                "--session",
                session,
                "--task",
                action["task_id"],
                "--reviewer-context",
                context_id,
                "--lease",
                action["lease_id"],
            )
            accepted.append({"lease_id": action["lease_id"], "context_id": context_id})
        self.report_launch(session, tick["launch_id"], accepted)

        status = self.cli("status", "--session", session)
        self.assertEqual(16, status["scheduling"]["running"])
        self.assertEqual(0, status["scheduling"]["available_slots"])

    def test_auto_dispatch_requests_all_targets_on_first_wave(self):
        for index in range(60):
            self.write(f"file{index:02d}.go", f"package pay\nfunc F{index}() {{}}\n")
        self.commit_all()
        session = self.init_scan(concurrency="auto")

        first = self.dispatch_next(session)
        self.assertEqual("maximize", first["phase"])
        self.assertEqual(60, len(first["task_ids"]))
        self.assertEqual(60, first["requested_window"])
        for task_id in first["task_ids"][:20]:
            self.start_task(session, task_id)
        report = self.report_capacity(
            session, first["probe_id"], "Cursor rejected additional reviewer contexts"
        )
        self.assertEqual(20, report["accepted"])
        self.assertEqual(40, report["rejected"])
        self.assertEqual(20, report["observed_capacity"])
        self.assertEqual("saturated", report["probe_state"])
        status = self.cli("status", "--session", session)
        self.assertEqual(20, status["scheduling"]["running"])
        self.assertEqual(40, status["tasks"]["pending"])
    def test_host_rejection_sets_observed_capacity_and_preserves_pending_tasks(self):
        for index in range(40):
            self.write(f"file{index:02d}.go", f"package pay\nfunc F{index}() {{}}\n")
        self.commit_all()
        session = self.init_scan(concurrency="auto")
        initial = self.dispatch_next(session)
        self.assertEqual(40, len(initial["task_ids"]))
        for task_id in initial["task_ids"][:22]:
            self.start_task(session, task_id)

        report = self.report_capacity(
            session, initial["probe_id"], "Cursor rejected the next reviewer context"
        )

        self.assertEqual(22, report["accepted"])
        self.assertEqual(18, report["rejected"])
        self.assertEqual(22, report["observed_capacity"])
        self.assertEqual(22, report["desired_window"])
        self.assertEqual("saturated", report["probe_state"])
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(18, sum(task["status"] == "pending" for task in manifest["tasks"].values()))
        status = self.cli("status", "--session", session)
        self.assertEqual("wait_for_running_tasks", status["next_action"])
        self.assertEqual(0, status["scheduling"]["available_slots"])
        self.assertEqual(18, status["scheduling"]["probe_headroom"])

    def test_auto_capacity_reprobes_after_five_terminal_tasks(self):
        for index in range(40):
            self.write(f"file{index:02d}.go", f"package pay\nfunc F{index}() {{}}\n")
        self.commit_all()
        session = self.init_scan(concurrency="auto")
        initial = self.dispatch_next(session)
        self.assertEqual(40, len(initial["task_ids"]))
        for task_id in initial["task_ids"][:22]:
            self.start_task(session, task_id)
        self.report_capacity(session, initial["probe_id"], "temporary host limit")

        coverage = self.coverage_file("reprobe-coverage.json")
        running_ids = [
            task_id
            for task_id, task in json.loads((session / "manifest.json").read_text(encoding="utf-8"))["tasks"].items()
            if task["status"] == "running"
        ]
        for task_id in running_ids[:5]:
            self.cli("complete", "--session", session, "--task", task_id, "--coverage", coverage)

        refill = self.dispatch_next(session)
        self.assertEqual("refill", refill["phase"])
        self.assertEqual(5, len(refill["task_ids"]))
        for task_id in refill["task_ids"]:
            self.start_task(session, task_id)
        refill_report = self.report_capacity(session, refill["probe_id"])
        self.assertEqual("probing", refill_report["probe_state"])
        self.assertEqual("expand_reviewer_window", refill_report["next_action"])

        reprobe = self.dispatch_next(session)
        self.assertEqual("expand", reprobe["phase"])
        self.assertEqual(13, len(reprobe["task_ids"]))
        self.assertEqual(35, reprobe["requested_window"])

    def test_explicit_concurrency_dispatches_fixed_window_without_expansion(self):
        for index in range(20):
            self.write(f"file{index:02d}.go", f"package pay\nfunc F{index}() {{}}\n")
        self.commit_all()
        session = self.init_scan(concurrency="7")

        first = self.dispatch_next(session)
        self.assertEqual("fixed-fill", first["phase"])
        self.assertEqual(7, len(first["task_ids"]))
        for task_id in first["task_ids"]:
            self.start_task(session, task_id)
        self.report_capacity(session, first["probe_id"])

        waiting = self.dispatch_next(session)
        self.assertEqual([], waiting["task_ids"])
        self.assertEqual("wait_for_running_tasks", waiting["next_action"])

    def test_max_concurrency_requests_every_primary_target_immediately(self):
        for index in range(35):
            self.write(f"file{index:02d}.go", f"package pay\nfunc F{index}() {{}}\n")
        self.commit_all()
        session = self.init_scan(concurrency="max")

        dispatched = self.dispatch_next(session)

        self.assertEqual("maximize", dispatched["phase"])
        self.assertEqual(35, len(dispatched["task_ids"]))
        self.assertEqual(35, dispatched["requested_window"])

    def test_auto_concurrency_does_not_globally_reduce_for_large_files(self):
        self.write("large.py", "value = 1\n" * 7000)
        for index in range(5):
            self.write(f"small{index}.py", f"value_{index} = {index}\n")
        self.commit_all()

        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(6, manifest["scheduling"]["minimum"])
        self.assertEqual(6, manifest["scheduling"]["limit"])

    def test_explicit_concurrency_overrides_auto_minimum(self):
        for index in range(20):
            self.write(f"file{index}.go", f"package pay\nfunc F{index}() {{}}\n")
        self.commit_all()

        session = self.init_scan(concurrency="7")
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(7, manifest["scheduling"]["minimum"])
        self.assertEqual(7, manifest["scheduling"]["limit"])
        self.assertEqual("explicit", manifest["scheduling"]["source"])

    def test_skill_contract_uses_thin_verifier_first_tick_protocol(self):
        skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")
        runbook = (SKILL_ROOT / "references" / "controller-runbook.md").read_text(
            encoding="utf-8"
        )
        self.assertLess(len(skill.splitlines()), 150)
        self.assertIn("orchestrate-tick", skill)
        self.assertIn("orchestrate-report", skill)
        self.assertIn("15 不是并发上限", skill)
        self.assertIn("awaiting_start", skill)
        self.assertIn("launch_menu", skill)
        self.assertIn("fleet-plan", skill)
        self.assertIn("verifier", skill)
        self.assertIn("session_epoch", runbook)
        self.assertIn("lease_id", runbook)
        self.assertIn("verifier_backlog", runbook)
        self.assertIn("desired_concurrency", runbook)
        self.assertIn("accepted_concurrency", runbook)
        self.assertIn("host_capacity", runbook)
        self.assertIn("pause", runbook)
        self.assertIn("abort", runbook)
        self.assertNotIn("--available-slots", skill)
        self.assertNotIn("dispatch-next → task-start → capacity-report", skill)

    def test_skill_contract_defaults_unspecified_review_to_workspace(self):
        skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")
        scan_mode = (SKILL_ROOT / "references" / "scan-mode.md").read_text(
            encoding="utf-8"
        )
        self.assertIn("默认 `review --workspace`", skill)
        self.assertIn("显式", skill)
        self.assertIn("runtime-code", scan_mode)
        self.assertIn("composition", scan_mode)
        self.assertIn("token", scan_mode.lower())

    def test_skill_contract_describes_precise_test_file_filtering(self):
        skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")
        rules = (SKILL_ROOT / "references" / "rules.md").read_text(encoding="utf-8")
        self.assertIn("test/tests/__tests__/spec/specs", skill)
        self.assertIn("不按任意 `test` 子串", skill)
        self.assertIn("test_*.py", rules)
        self.assertIn("用户 include", rules)

    def test_skill_contract_requires_context_safe_sharded_results(self):
        skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")
        lifecycle = (SKILL_ROOT / "references" / "session-lifecycle.md").read_text(
            encoding="utf-8"
        )
        self.assertIn("512 KiB", skill)
        self.assertIn("output_mode=sharded", skill)
        self.assertIn("finding_shards", skill)
        self.assertIn("results/findings-0001.json", lifecycle)
        self.assertIn("stdout", lifecycle)
        self.assertIn("finding_preview", lifecycle)
        self.assertIn("可独立交付", skill)
        self.assertIn("Run summary", lifecycle)
        self.assertIn("Highest-priority preview", lifecycle)

    def test_skill_contract_requires_auditable_semantic_deduplication(self):
        skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")
        finding_contract = (SKILL_ROOT / "references" / "finding-contract.md").read_text(
            encoding="utf-8"
        )
        lifecycle = (SKILL_ROOT / "references" / "session-lifecycle.md").read_text(
            encoding="utf-8"
        )

        self.assertIn("dedup-plan", skill)
        self.assertIn("dedup-verify", skill)
        self.assertIn("root_cause_key", finding_contract)
        self.assertIn("same_root_cause", finding_contract)
        self.assertIn("single_fix_resolves_all", finding_contract)
        self.assertIn("confirmed_finding_count", lifecycle)
        self.assertIn("published_issue_count", lifecycle)
        self.assertIn("duplicate_count", lifecycle)
        self.assertIn("findings/<task-id>/<finding-id>.json", finding_contract)

    def test_reviewer_context_is_required_and_cannot_be_reused_across_files(self):
        self.write("first.go", "package pay\n")
        self.write("second.go", "package pay\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_ids = list(manifest["tasks"])
        missing = self.cli(
            "task-start", "--session", session, "--task", task_ids[0], expect=2
        )
        self.assertEqual("INVALID_ARGUMENTS", missing["error"])
        self.start_task(session, task_ids[0], reviewer_context="subagent-123")
        reused = self.cli(
            "task-start", "--session", session, "--task", task_ids[1],
            "--reviewer-context", "subagent-123", expect=2,
        )
        self.assertEqual("REVIEWER_CONTEXT_REUSED", reused["error"])

    def test_repeated_task_failure_becomes_blocked_and_finalize_returns_full_result(self):
        self.write("payment.go", "package pay\nfunc Charge() {}\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))

        for attempt in range(1, 4):
            self.start_task(session, task_id, reviewer_context=f"subagent-attempt-{attempt}")
            failed = self.cli(
                "task-fail", "--session", session, "--task", task_id,
                "--reason", f"worker interrupted on attempt {attempt}",
            )
            expected = "blocked" if attempt == 3 else "interrupted"
            self.assertEqual(expected, failed["status"])
            self.assertEqual(3 - attempt, failed["retries_remaining"])
            self.assertEqual(
                "continue_other_tasks" if attempt == 3 else "retry_task",
                failed["next_action"],
            )

        finalized = self.cli("finalize", "--session", session)
        self.assertEqual("partial", finalized["completion_status"])
        self.assertEqual("limited", finalized["assurance"])
        self.assertFalse(finalized["clean"])
        self.assertEqual([task_id], finalized["blocked_tasks"])
        self.assertIn("conclusion", finalized)
        self.assertIn("findings", finalized)
        self.assertIn("coverage", finalized)
        self.assertTrue(finalized["blind_spots"][0]["material"])

    def test_status_drives_running_checkpointed_and_terminal_tasks_without_ambiguity(self):
        self.write("payment.go", "package pay\nfunc Charge() {}\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)

        running = self.cli("status", "--session", session)
        self.assertEqual("wait_for_running_tasks", running["next_action"])

        checkpoint = self.root / "status-checkpoint.json"
        checkpoint.write_text(
            json.dumps(
                {
                    "covered_symbols": [],
                    "covered_ranges": [[1, 1]],
                    "finding_ids": [],
                    "rejected_candidates": [],
                    "pending_questions": [],
                    "next_action": "resume payment.go",
                }
            ),
            encoding="utf-8",
        )
        self.cli(
            "checkpoint", "--session", session, "--task", task_id, "--input", checkpoint
        )
        checkpointed = self.cli("status", "--session", session)
        self.assertEqual(1, checkpointed["scheduling"]["runnable"])
        self.assertEqual("dispatch_runnable_tasks", checkpointed["next_action"])

        self.start_task(session, task_id, reviewer_context="reviewer-resumed")
        self.cli(
            "complete", "--session", session, "--task", task_id,
            "--coverage", self.coverage_file("coverage-status-terminal.json"),
        )
        terminal = self.cli("status", "--session", session)
        self.assertEqual("finalize", terminal["next_action"])

    def test_resume_classifies_third_orphan_failure_as_blocked_not_interrupted(self):
        self.write("payment.go", "package pay\nfunc Charge() {}\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))

        for attempt in range(1, 4):
            self.start_task(session, task_id, reviewer_context=f"orphan-{attempt}")
            resumed = self.cli("resume", "--session", session)

        self.assertEqual([], resumed["interrupted_tasks"])
        self.assertEqual([task_id], resumed["blocked_tasks"])
        self.assertEqual("finalize", resumed["next_action"])
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual("blocked", manifest["tasks"][task_id]["status"])

    def test_submit_strictly_deduplicates_same_claim_and_location(self):
        self.write("issues.py", "problem_0()\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)

        first = self.submit_medium_finding(session, task_id, 0, "small impact")
        second = self.submit_medium_finding(session, task_id, 0, "small impact")

        self.assertEqual(first["finding_id"], second["finding_id"])
        self.assertTrue(second["duplicate"])

    def test_submit_does_not_fuzzy_deduplicate_paraphrased_claim(self):
        self.write("issues.py", "problem_0()\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        first = self.submit_medium_finding(session, task_id, 0, "small impact")
        payload = self.root / "finding-0.json"
        changed = json.loads(payload.read_text(encoding="utf-8"))
        changed["claim"] = "the returned result from problem_0 is invalid"
        payload.write_text(json.dumps(changed), encoding="utf-8")

        second = self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload
        )

        self.assertNotEqual(first["finding_id"], second["finding_id"])
        self.assertFalse(second.get("duplicate", False))

    def test_submit_persists_optional_semantic_dedup_hints(self):
        self.write("issues.py", "problem_0()\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)

        submitted = self.submit_semantic_finding(
            session,
            task_id,
            0,
            root_cause_key="missing-idempotency-guard",
            fix_scope="payment request admission",
        )
        finding = json.loads(Path(submitted["finding_file"]).read_text(encoding="utf-8"))

        self.assertEqual("missing-idempotency-guard", finding["root_cause_key"])
        self.assertEqual("payment request admission", finding["fix_scope"])

    def test_submit_rejects_invalid_semantic_dedup_hints(self):
        self.write("issues.py", "problem_0()\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        payload = self.root / "invalid-semantic-finding.json"
        payload.write_text(
            json.dumps(
                {
                    "title": "Invalid hint",
                    "claim": "problem_0 fails",
                    "severity": "medium",
                    "category": "bug",
                    "existing_code": "problem_0()",
                    "expected": "success",
                    "actual": "failure",
                    "impact": "request fails",
                    "impact_surface": "runtime",
                    "reachability": "proven",
                    "current_input_reproducible": True,
                    "evidence": ["direct call"],
                    "root_cause_key": "   ",
                }
            ),
            encoding="utf-8",
        )

        failed = self.cli(
            "submit", "--session", session, "--task", task_id, "--input", payload,
            expect=2,
        )

        self.assertEqual("INVALID_FINDING", failed["error"])

    def test_dedup_plan_groups_only_same_category_and_normalized_root_cause(self):
        self.write("a.py", "problem_0()\n")
        self.write("b.py", "problem_1()\n")
        self.write("c.py", "problem_2()\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_by_path = {task["path"]: task_id for task_id, task in manifest["tasks"].items()}
        for task_id in task_by_path.values():
            self.start_task(session, task_id)
        first = self.submit_semantic_finding(
            session,
            task_by_path["a.py"],
            0,
            root_cause_key=" Missing Idempotency_Guard ",
            fix_scope="request admission",
        )
        second = self.submit_semantic_finding(
            session,
            task_by_path["b.py"],
            1,
            root_cause_key="missing-idempotency-guard",
            fix_scope="request admission",
            claim="problem_1 retries without a stable key",
        )
        self.submit_semantic_finding(
            session,
            task_by_path["c.py"],
            2,
            root_cause_key="missing-idempotency-guard",
            fix_scope="request admission",
            category="performance",
        )
        for task_id in task_by_path.values():
            self.cli(
                "complete", "--session", session, "--task", task_id,
                "--coverage", self.coverage_file(f"coverage-{task_id}.json"),
            )

        planned = self.cli("dedup-plan", "--session", session)

        self.assertEqual(1, planned["candidate_count"])
        self.assertEqual(1, planned["pending_count"])
        candidate = planned["candidates"][0]
        self.assertEqual(
            sorted([first["finding_id"], second["finding_id"]]),
            candidate["finding_ids"],
        )
        self.assertTrue((session / candidate["candidate_file"]).is_file())

        blocked = self.cli("finalize", "--session", session, expect=2)
        self.assertEqual("DEDUP_VERIFIER_PENDING", blocked["error"])
        self.assertEqual([candidate["id"]], blocked["candidate_ids"])

    def test_dedup_verify_requires_independence_complete_partition_and_full_proof(self):
        self.write("a.py", "problem_0()\n")
        self.write("b.py", "problem_1()\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_ids = [
            task_id
            for _path, task_id in sorted(
                (task["path"], task_id) for task_id, task in manifest["tasks"].items()
            )
        ]
        submitted = []
        for index, task_id in enumerate(task_ids):
            self.start_task(session, task_id)
            submitted.append(
                self.submit_semantic_finding(
                    session,
                    task_id,
                    index,
                    root_cause_key="shared-cache-corruption",
                    fix_scope="cache write boundary",
                )["finding_id"]
            )
            self.cli(
                "complete", "--session", session, "--task", task_id,
                "--coverage", self.coverage_file(f"coverage-{task_id}.json"),
            )
        candidate = self.cli("dedup-plan", "--session", session)["candidates"][0]
        decision = self.root / "dedup-decision.json"
        decision.write_text(
            json.dumps(
                {
                    "groups": [
                        {
                            "canonical_finding_id": submitted[0],
                            "duplicate_finding_ids": [submitted[1]],
                            "reason": "Both findings are symptoms of one cache write defect.",
                            "same_root_cause": True,
                            "same_failure_path": False,
                            "single_fix_resolves_all": True,
                        }
                    ],
                    "keep_separate_finding_ids": [],
                    "reason": "All candidate members were evaluated.",
                }
            ),
            encoding="utf-8",
        )

        controller = self.cli(
            "dedup-verify", "--session", session, "--candidate", candidate["id"],
            "--input", decision, "--verifier-context", "controller", expect=2,
        )
        self.assertEqual("CONTROLLER_DEDUP_VERIFY_FORBIDDEN", controller["error"])

        insufficient = self.cli(
            "dedup-verify", "--session", session, "--candidate", candidate["id"],
            "--input", decision, "--verifier-context", "dedup-verifier-1", expect=2,
        )
        self.assertEqual("DEDUP_PROOF_INCOMPLETE", insufficient["error"])

        changed = json.loads(decision.read_text(encoding="utf-8"))
        changed["groups"][0]["same_failure_path"] = True
        changed["keep_separate_finding_ids"] = [submitted[1]]
        decision.write_text(json.dumps(changed), encoding="utf-8")
        invalid_partition = self.cli(
            "dedup-verify", "--session", session, "--candidate", candidate["id"],
            "--input", decision, "--verifier-context", "dedup-verifier-2", expect=2,
        )
        self.assertEqual("INVALID_DEDUP_PARTITION", invalid_partition["error"])

    def test_verified_semantic_merge_publishes_canonical_issue_without_deleting_raw_findings(self):
        self.write("a.py", "problem_0()\n")
        self.write("b.py", "problem_1()\n")
        self.write("c.py", "problem_2()\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_by_path = {task["path"]: task_id for task_id, task in manifest["tasks"].items()}
        ids = []
        for index, path in enumerate(("a.py", "b.py", "c.py")):
            task_id = task_by_path[path]
            self.start_task(session, task_id)
            key = "one-root-cause" if index < 2 else "separate-root-cause"
            ids.append(
                self.submit_semantic_finding(
                    session,
                    task_id,
                    index,
                    root_cause_key=key,
                    fix_scope="shared validation" if index < 2 else "local parsing",
                )["finding_id"]
            )
            self.cli(
                "complete", "--session", session, "--task", task_id,
                "--coverage", self.coverage_file(f"coverage-{task_id}.json"),
            )
        candidate = self.cli("dedup-plan", "--session", session)["candidates"][0]
        decision = self.root / "dedup-merge.json"
        decision.write_text(
            json.dumps(
                {
                    "groups": [
                        {
                            "canonical_finding_id": ids[0],
                            "duplicate_finding_ids": [ids[1]],
                            "reason": "The same validation omission drives both failure paths.",
                            "same_root_cause": True,
                            "same_failure_path": True,
                            "single_fix_resolves_all": True,
                        }
                    ],
                    "keep_separate_finding_ids": [],
                    "reason": "Every candidate member is covered by the merged group.",
                }
            ),
            encoding="utf-8",
        )
        verified = self.cli(
            "dedup-verify", "--session", session, "--candidate", candidate["id"],
            "--input", decision, "--verifier-context", "dedup-verifier-merge",
        )

        finalized = self.cli("finalize", "--session", session)

        self.assertEqual("verified", verified["status"])
        self.assertEqual(3, finalized["confirmed_finding_count"])
        self.assertEqual(2, finalized["published_issue_count"])
        self.assertEqual(1, finalized["duplicate_count"])
        self.assertEqual(2, finalized["finding_count"])
        self.assertEqual(1, len(finalized["dedup_groups"]))
        canonical = next(item for item in finalized["findings"] if item["id"] == ids[0])
        self.assertEqual([ids[1]], canonical["duplicate_finding_ids"])
        self.assertEqual(2, len(canonical["occurrences"]))
        self.assertEqual(3, len(list((session / "findings").glob("*/*.json"))))

    def test_dedup_verifier_can_keep_every_candidate_separate(self):
        self.write("a.py", "problem_0()\n")
        self.write("b.py", "problem_1()\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        ids = []
        task_ids = [
            task_id
            for _path, task_id in sorted(
                (task["path"], task_id) for task_id, task in manifest["tasks"].items()
            )
        ]
        for index, task_id in enumerate(task_ids):
            self.start_task(session, task_id)
            ids.append(
                self.submit_semantic_finding(
                    session,
                    task_id,
                    index,
                    root_cause_key="similar-timeout-symptom",
                    fix_scope=f"independent subsystem {index}",
                )["finding_id"]
            )
            self.cli(
                "complete", "--session", session, "--task", task_id,
                "--coverage", self.coverage_file(f"coverage-{task_id}.json"),
            )
        candidate = self.cli("dedup-plan", "--session", session)["candidates"][0]
        decision = self.root / "dedup-keep.json"
        decision.write_text(
            json.dumps(
                {
                    "groups": [],
                    "keep_separate_finding_ids": ids,
                    "reason": "The symptoms are similar but each subsystem needs an independent fix.",
                }
            ),
            encoding="utf-8",
        )
        self.cli(
            "dedup-verify", "--session", session, "--candidate", candidate["id"],
            "--input", decision, "--verifier-context", "dedup-verifier-keep",
        )

        finalized = self.cli("finalize", "--session", session)

        self.assertEqual(2, finalized["confirmed_finding_count"])
        self.assertEqual(2, finalized["published_issue_count"])
        self.assertEqual(0, finalized["duplicate_count"])
        self.assertEqual([], finalized["dedup_groups"])

    def test_semantic_merge_preserves_highest_occurrence_severity(self):
        self.write("a.py", "problem_0()\n")
        self.write("b.py", "problem_1()\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_by_path = {task["path"]: task_id for task_id, task in manifest["tasks"].items()}
        ids = []
        for index, (path, severity) in enumerate((("a.py", "low"), ("b.py", "medium"))):
            task_id = task_by_path[path]
            self.start_task(session, task_id)
            ids.append(
                self.submit_semantic_finding(
                    session,
                    task_id,
                    index,
                    root_cause_key="shared-severity-root",
                    fix_scope="shared boundary",
                    severity=severity,
                )["finding_id"]
            )
            self.cli(
                "complete", "--session", session, "--task", task_id,
                "--coverage", self.coverage_file(f"coverage-{task_id}.json"),
            )
        candidate = self.cli("dedup-plan", "--session", session)["candidates"][0]
        decision = self.root / "dedup-severity.json"
        decision.write_text(
            json.dumps(
                {
                    "groups": [
                        {
                            "canonical_finding_id": ids[0],
                            "duplicate_finding_ids": [ids[1]],
                            "reason": "Both occurrences are resolved by the shared boundary fix.",
                            "same_root_cause": True,
                            "same_failure_path": True,
                            "single_fix_resolves_all": True,
                        }
                    ],
                    "keep_separate_finding_ids": [],
                    "reason": "All members are covered.",
                }
            ),
            encoding="utf-8",
        )
        self.cli(
            "dedup-verify", "--session", session, "--candidate", candidate["id"],
            "--input", decision, "--verifier-context", "dedup-verifier-severity",
        )

        finalized = self.cli("finalize", "--session", session)

        self.assertEqual("medium", finalized["findings"][0]["severity"])
        self.assertEqual(
            {"critical": 0, "high": 0, "medium": 1, "low": 0},
            finalized["severity_counts"],
        )
        self.assertEqual(
            {"critical": 0, "high": 0, "medium": 1, "low": 1},
            finalized["confirmed_severity_counts"],
        )

    def test_finalize_shards_large_finding_output_by_serialized_bytes(self):
        self.write(
            "issues.py",
            "\n".join(f"problem_{index}()" for index in range(5)) + "\n",
        )
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        for index in range(5):
            self.submit_medium_finding(session, task_id, index, "x" * 140_000)
        self.cli(
            "complete", "--session", session, "--task", task_id,
            "--coverage", self.coverage_file("coverage-sharded.json"),
        )

        finalized = self.cli("finalize", "--session", session)
        index = json.loads(Path(finalized["result_json"]).read_text(encoding="utf-8"))

        self.assertEqual("sharded", finalized["output_mode"])
        self.assertEqual(5, finalized["finding_count"])
        self.assertEqual(
            {"critical": 0, "high": 0, "medium": 5, "low": 0},
            finalized["severity_counts"],
        )
        self.assertEqual([], finalized["findings"])
        self.assertFalse(finalized["findings_complete"])
        self.assertGreater(len(finalized["finding_shards"]), 1)
        self.assertLess(len(json.dumps(finalized).encode("utf-8")), 100_000)
        self.assertEqual("sharded", index["output_mode"])
        report_markdown = Path(finalized["result_markdown"]).read_text(encoding="utf-8")
        self.assertIn("## Run summary", report_markdown)
        self.assertIn("| Mode | `scan` |", report_markdown)
        self.assertIn("## Coverage", report_markdown)
        self.assertIn("## Severity", report_markdown)
        self.assertIn("## Highest-priority preview", report_markdown)
        self.assertIn("Issue 0", report_markdown)
        self.assertIn("## Finding shards", report_markdown)

        published_ids = []
        for shard in finalized["finding_shards"]:
            json_path = session / shard["json_path"]
            markdown_path = session / shard["markdown_path"]
            self.assertTrue(json_path.is_file())
            self.assertTrue(markdown_path.is_file())
            self.assertLessEqual(json_path.stat().st_size, 512 * 1024)
            self.assertLessEqual(markdown_path.stat().st_size, 512 * 1024)
            self.assertEqual(
                shard["sha256"], hashlib.sha256(json_path.read_bytes()).hexdigest()
            )
            shard_markdown = markdown_path.read_text(encoding="utf-8")
            self.assertIn("**Expected**", shard_markdown)
            self.assertIn("**Actual**", shard_markdown)
            self.assertIn("**Evidence**", shard_markdown)
            published_ids.extend(
                finding["id"]
                for finding in json.loads(json_path.read_text(encoding="utf-8"))["findings"]
            )
        self.assertEqual(5, len(published_ids))
        self.assertEqual(5, len(set(published_ids)))

        stale_json = session / "results" / "findings-9999.json"
        stale_markdown = session / "results" / "findings-9999.md"
        stale_json.write_text("{}", encoding="utf-8")
        stale_markdown.write_text("stale", encoding="utf-8")
        self.cli("finalize", "--session", session)
        self.assertFalse(stale_json.exists())
        self.assertFalse(stale_markdown.exists())

    def test_finalize_keeps_small_output_inline(self):
        self.write("issues.py", "problem_0()\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        submitted = self.submit_medium_finding(session, task_id, 0, "small impact")
        self.cli(
            "complete", "--session", session, "--task", task_id,
            "--coverage", self.coverage_file("coverage-inline.json"),
        )

        finalized = self.cli("finalize", "--session", session)

        self.assertEqual("inline", finalized["output_mode"])
        self.assertEqual(1, finalized["finding_count"])
        self.assertTrue(finalized["findings_complete"])
        self.assertEqual(submitted["finding_id"], finalized["findings"][0]["id"])
        self.assertEqual([], finalized["finding_shards"])
        report_markdown = Path(finalized["result_markdown"]).read_text(encoding="utf-8")
        self.assertIn("## Run summary", report_markdown)
        self.assertIn("| Mode | `scan` |", report_markdown)
        self.assertIn("| Profile | `correctness` |", report_markdown)
        self.assertIn("## Coverage", report_markdown)
        self.assertIn("| Files considered at init | `1` |", report_markdown)
        self.assertIn("| Primary Targets at init | `1` |", report_markdown)
        self.assertIn("| Active Primary Targets | `1` |", report_markdown)
        self.assertIn("| Complete | `1` |", report_markdown)
        self.assertIn("| Excluded by filters at init | `0` |", report_markdown)
        self.assertIn("| Removed since init | `0` |", report_markdown)
        self.assertIn("## Severity", report_markdown)
        self.assertIn("| Medium | `1` | `1` |", report_markdown)
        self.assertIn("**Expected**", report_markdown)
        self.assertIn("return a valid result", report_markdown)
        self.assertIn("**Actual**", report_markdown)
        self.assertIn("return an invalid result", report_markdown)
        self.assertIn("**Evidence**", report_markdown)
        self.assertIn("- problem_0 is directly reachable", report_markdown)
        self.assertIn("**Existing code anchor**", report_markdown)
        self.assertIn("- Anchor fingerprint: `", report_markdown)
        self.assertIn("## Coverage limits", report_markdown)
        self.assertIn("No material Blind Spots were recorded.", report_markdown)
        self.assertIn("## Audit artifacts", report_markdown)

    def test_oversized_single_finding_gets_its_own_untruncated_shard(self):
        self.write("issues.py", "problem_0()\n")
        self.commit_all()
        session = self.init_scan()
        manifest = json.loads((session / "manifest.json").read_text(encoding="utf-8"))
        task_id = next(iter(manifest["tasks"]))
        self.start_task(session, task_id)
        self.submit_medium_finding(session, task_id, 0, "z" * 600_000)
        self.cli(
            "complete", "--session", session, "--task", task_id,
            "--coverage", self.coverage_file("coverage-oversized.json"),
        )

        finalized = self.cli("finalize", "--session", session)

        self.assertEqual("sharded", finalized["output_mode"])
        self.assertEqual(1, len(finalized["finding_shards"]))
        shard = finalized["finding_shards"][0]
        self.assertTrue(shard["oversized"])
        shard_payload = json.loads(
            (session / shard["json_path"]).read_text(encoding="utf-8")
        )
        self.assertEqual(600_000, len(shard_payload["findings"][0]["impact"]))


if __name__ == "__main__":
    unittest.main()
