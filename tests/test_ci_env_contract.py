"""T-CI-01~03: CI workflow env 与 conftest 默认值对齐（BOOT-006）。"""

import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

import pytest
from crypto_test_env import TEST_JWT_SM2_PRIVATE, TEST_JWT_SM2_PUBLIC, TEST_SM4_KEY

CONFTEST_DEFAULTS = {
    "DATABASE_URL": "postgresql+psycopg://vitalspan:vitalspan@localhost:5432/vitalspan",
    "JWT_SM2_PRIVATE_KEY": TEST_JWT_SM2_PRIVATE,
    "JWT_SM2_PUBLIC_KEY": TEST_JWT_SM2_PUBLIC,
    "CREDENTIAL_SM4_KEY": TEST_SM4_KEY,
}

CI_YML = Path(__file__).resolve().parents[1] / ".github" / "workflows" / "ci.yml"


@pytest.fixture(scope="module")
def ci_yml_text() -> str:
    return CI_YML.read_text(encoding="utf-8")


def _extract_backend_env_value(text: str, key: str) -> str:
    """从 backend job env 块提取 KEY: value。"""
    pattern = rf"^\s+{re.escape(key)}:\s+(.+)$"
    match = re.search(pattern, text, re.MULTILINE)
    assert match is not None, f"missing {key} in ci.yml backend env"
    return match.group(1).strip()


def test_ci_yml_backend_env_has_required_keys(ci_yml_text):
    """T-CI-01: ci.yml backend job env 含必填键。"""
    for key in CONFTEST_DEFAULTS:
        assert f"{key}:" in ci_yml_text


def test_ci_env_values_match_conftest_defaults(ci_yml_text):
    """T-CI-02: ci env 默认值与 conftest setdefault 一致。"""
    for key, expected in CONFTEST_DEFAULTS.items():
        actual = _extract_backend_env_value(ci_yml_text, key)
        assert actual == expected, f"{key}: ci={actual!r} conftest={expected!r}"


def test_ci_frontend_job_has_test_build_check_design(ci_yml_text):
    """T-CI-03: frontend job 含 pnpm test、build、check:design。"""
    assert "pnpm test" in ci_yml_text
    assert "pnpm build" in ci_yml_text
    assert "check:design" in ci_yml_text


def test_pytest_collect_minimum_threshold():
    """T-CI-04: pytest --collect-only 收集下限 ≥ 225 tests（基线 207 + 本轮 ~19）。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q", "../tests"],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr
    last_line = result.stdout.strip().splitlines()[-1]
    count_str = last_line.split()[0]
    assert int(count_str) >= 225, f"expected ≥ 225 tests, got: {last_line}"


def test_pytest_collect_includes_r14_modules():
    """T-CI-05: collect 输出含本轮扩展模块 test_me / test_migrations / test_health。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q", "../tests"],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr
    stdout = result.stdout
    for module in ("test_me.py", "test_migrations.py", "test_health.py"):
        assert module in stdout, f"missing {module} in collect output"


def test_pytest_subset_elapsed_under_budget():
    """T-CI-06: pytest 子集 test_me + test_health elapsed < 30s。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    start = time.perf_counter()
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "../tests/test_me.py",
            "../tests/test_health.py",
            "-q",
        ],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        timeout=60,
    )
    elapsed = time.perf_counter() - start
    assert result.returncode == 0, result.stderr
    assert elapsed < 30.0, f"subset took {elapsed:.1f}s"


def test_pytest_collect_minimum_232():
    """T-CI-07: pytest --collect-only 收集下限 ≥ 232。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q", "../tests"],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr
    last_line = result.stdout.strip().splitlines()[-1]
    count_str = last_line.split()[0]
    assert int(count_str) >= 232, f"expected ≥ 232 tests, got: {last_line}"


def test_ci_frontend_job_step_order(ci_yml_text):
    """T-CI-08: frontend job 中 pnpm test 在 build 之前；check:design 在 build 之后。"""
    frontend_block = ci_yml_text.split("frontend:")[1]
    test_idx = frontend_block.index("pnpm test")
    build_idx = frontend_block.index("pnpm build")
    design_idx = frontend_block.index("check:design")
    assert test_idx < build_idx < design_idx


@pytest.mark.skipif(
    shutil.which("pnpm") is None
    or not (Path(__file__).resolve().parents[1] / "fe" / "node_modules").is_dir(),
    reason="T-CI-09: vitest budget smoke requires pnpm + fe deps (frontend CI or local dev)",
)
def test_vitest_routes_smoke_elapsed_under_budget():
    """T-CI-09: vitest 单文件 routes.smoke 子集 elapsed < 45s。"""
    fe_dir = Path(__file__).resolve().parents[1] / "fe"
    start = time.perf_counter()
    result = subprocess.run(
        ["pnpm", "exec", "vitest", "run", "src/routes.smoke.test.tsx"],
        cwd=fe_dir,
        capture_output=True,
        text=True,
        timeout=120,
    )
    elapsed = time.perf_counter() - start
    assert result.returncode == 0, result.stderr
    assert elapsed < 45.0, f"vitest routes smoke took {elapsed:.1f}s"


def test_pytest_collect_minimum_258():
    """T-CI-10: pytest --collect-only 收集下限 ≥ 258。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q", "../tests"],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr
    last_line = result.stdout.strip().splitlines()[-1]
    count_str = last_line.split()[0]
    assert int(count_str) >= 258, f"expected ≥ 258 tests, got: {last_line}"


def test_ci_jobs_have_timeout_minutes(ci_yml_text):
    """T-CI-11: ci.yml backend/frontend job 各含 timeout-minutes。"""
    assert "timeout-minutes:" in ci_yml_text
    backend_block = ci_yml_text.split("frontend:")[0]
    frontend_block = ci_yml_text.split("frontend:")[1]
    assert "timeout-minutes:" in backend_block
    assert "timeout-minutes:" in frontend_block


def test_ci_frontend_cache_dependency_path(ci_yml_text):
    """T-CI-12: frontend job 含 cache-dependency-path: fe/pnpm-lock.yaml。"""
    assert "cache-dependency-path: fe/pnpm-lock.yaml" in ci_yml_text


def test_ingestion_vitest_case_floor():
    """T-CI-13: ingestion.smoke.test.tsx 中 it( 计数 ≥ 35。"""
    smoke_path = (
        Path(__file__).resolve().parents[1]
        / "fe"
        / "src"
        / "pages"
        / "admin"
        / "ingestion"
        / "ingestion.smoke.test.tsx"
    )
    source = smoke_path.read_text(encoding="utf-8")
    count = source.count("it(")
    assert count >= 35, f"expected ≥ 35 vitest cases, got {count}"


@pytest.mark.skipif(
    shutil.which("pnpm") is None
    or not (Path(__file__).resolve().parents[1] / "fe" / "node_modules").is_dir(),
    reason="T-CI-14: ingestion vitest budget requires pnpm + fe deps",
)
def test_ingestion_vitest_elapsed_under_budget():
    """T-CI-14: ingestion vitest 单文件 elapsed < 90s。"""
    fe_dir = Path(__file__).resolve().parents[1] / "fe"
    start = time.perf_counter()
    result = subprocess.run(
        [
            "pnpm",
            "exec",
            "vitest",
            "run",
            "src/pages/admin/ingestion/ingestion.smoke.test.tsx",
        ],
        cwd=fe_dir,
        capture_output=True,
        text=True,
        timeout=120,
    )
    elapsed = time.perf_counter() - start
    assert result.returncode == 0, result.stderr
    assert elapsed < 90.0, f"ingestion vitest took {elapsed:.1f}s"
