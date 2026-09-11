"""T-RUF-01~02: ruff 子进程契约（BOOT-006）。"""

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BAD_SAMPLE = REPO_ROOT / "tests" / "fixtures" / "ruff_bad_sample.py"
CLEAN_SAMPLE = REPO_ROOT / "tests" / "test_health.py"


def test_ruff_rejects_bad_sample():
    """T-RUF-01: 违规样例 ruff check returncode != 0。"""
    result = subprocess.run(
        [sys.executable, "-m", "ruff", "check", str(BAD_SAMPLE)],
        cwd=REPO_ROOT / "backend",
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode != 0, result.stdout


def test_ruff_accepts_clean_file():
    """T-RUF-02: 干净文件 ruff check returncode == 0。"""
    result = subprocess.run(
        [sys.executable, "-m", "ruff", "check", str(CLEAN_SAMPLE)],
        cwd=REPO_ROOT / "backend",
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
