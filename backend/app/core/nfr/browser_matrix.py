from __future__ import annotations

import re
import time
from dataclasses import dataclass

probe_browser_matrix_budget_ms: int = 50

_BROWSER_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("chrome", re.compile(r"Chrome/(\d+)", re.I)),
    ("edge", re.compile(r"Edg/(\d+)", re.I)),
    ("firefox", re.compile(r"Firefox/(\d+)", re.I)),
    ("safari", re.compile(r"Version/(\d+).*Safari", re.I)),
    ("ie", re.compile(r"MSIE (\d+)", re.I)),
)


@dataclass(frozen=True)
class BrowserMatrixEntry:
    name: str
    min_version: int
    status: str  # supported|deprecated|unsupported
    notes: str | None = None


@dataclass(frozen=True)
class DetectedBrowser:
    name: str
    major_version: int | None
    supported: bool
    status: str


@dataclass(frozen=True)
class BrowserMatrixReport:
    items: tuple[BrowserMatrixEntry, ...]
    detected_browser: DetectedBrowser | None
    overall_status: str  # supported|unsupported|deprecated|unknown


SUPPORTED_BROWSER_MATRIX: tuple[BrowserMatrixEntry, ...] = (
    BrowserMatrixEntry("chrome", 90, "supported", "Chromium-based"),
    BrowserMatrixEntry("edge", 90, "supported", "Chromium-based"),
    BrowserMatrixEntry("firefox", 90, "supported", None),
    BrowserMatrixEntry("safari", 14, "supported", None),
    BrowserMatrixEntry("ie", 11, "unsupported", "Legacy IE not supported"),
)


def _lookup_entry(name: str) -> BrowserMatrixEntry | None:
    for entry in SUPPORTED_BROWSER_MATRIX:
        if entry.name == name:
            return entry
    return None


def _parse_user_agent(user_agent: str) -> DetectedBrowser | None:
    for name, pattern in _BROWSER_PATTERNS:
        match = pattern.search(user_agent)
        if not match:
            continue
        major = int(match.group(1))
        entry = _lookup_entry(name)
        if entry is None:
            return DetectedBrowser(name, major, False, "unsupported")
        if entry.status == "unsupported":
            return DetectedBrowser(name, major, False, "unsupported")
        supported = major >= entry.min_version
        status = "supported" if supported else "deprecated"
        return DetectedBrowser(name, major, supported, status)
    return None


def probe_browser_support(user_agent: str | None = None) -> BrowserMatrixReport:
    started = time.perf_counter()
    items = SUPPORTED_BROWSER_MATRIX
    if not user_agent:
        _ = time.perf_counter() - started
        return BrowserMatrixReport(items=items, detected_browser=None, overall_status="unknown")
    detected = _parse_user_agent(user_agent)
    if detected is None:
        overall = "unsupported"
    else:
        overall = detected.status
    _ = time.perf_counter() - started
    return BrowserMatrixReport(items=items, detected_browser=detected, overall_status=overall)
