"""Headless FE capture → PDF bytes for dashboard/data-screen export."""

from __future__ import annotations

import logging
import time
import urllib.error
import urllib.request
from uuid import UUID

from urllib.parse import urlsplit, urlunsplit

from app.core.config import get_settings
from app.dashboard import service as dash_service
from app.dashboard.export_fe_url import build_export_snapshot_url
from app.dashboard.export_layout_mode import (
    EXPORT_LAYOUT_COMBINED,
    EXPORT_LAYOUT_FULL_PAGE,
    EXPORT_LAYOUT_PER_WIDGET,
    MODE_LABELS,
    ExportLayoutMode,
    normalize_export_layout_mode,
)

logger = logging.getLogger(__name__)

PLAYWRIGHT_INSTALL_HINT = "pip install -e \".[dev]\" && python -m playwright install chromium"

CAPTURE_SELECTOR = '[data-export-ready="true"]'
CAPTURE_ROOT_SELECTOR = "[data-export-snapshot]"
SETTLE_MS = 2200
NAV_TIMEOUT_MS = 30_000
HEALTH_PROBE_CACHE_SECONDS = 60
HEALTH_BROWSER_TIMEOUT_MS = 8_000
HEALTH_FE_TIMEOUT_SECONDS = 3
VIEWPORT_WIDTH = 1920
VIEWPORT_HEIGHT = 1080
DEVICE_SCALE_FACTOR = 2
MIN_PAGE_WIDTH = 1920
MAX_PDF_PAGE_HEIGHT_PX = 19200

_health_cache: dict | None = None
_health_cache_at: float = 0.0


def _redact_export_url(url: str) -> str:
    parts = urlsplit(url)
    if not parts.query:
        return url
    query_parts = []
    for segment in parts.query.split("&"):
        if segment.startswith("token="):
            query_parts.append("token=***")
        else:
            query_parts.append(segment)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "&".join(query_parts), parts.fragment))


def _fe_probe_url() -> str:
    settings = get_settings()
    base = settings.fe_base_url.rstrip("/")
    path = settings.fe_base_path.strip("/")
    if path:
        base = f"{base}/{path}"
    return f"{base}/"


def _fe_reachable() -> tuple[bool, str | None]:
    url = _fe_probe_url()
    try:
        with urllib.request.urlopen(url, timeout=HEALTH_FE_TIMEOUT_SECONDS) as resp:
            if resp.status != 200:
                return False, f"前端导出服务不可达（{url} 返回 {resp.status}）"
    except (OSError, urllib.error.URLError) as exc:
        return False, f"前端导出服务不可达（{url}）：{exc}"
    return True, None


def probe_export_render_health(*, force_refresh: bool = False) -> dict:
    """Playwright + Chromium + FE reachability probe for schedule pre-check UI."""
    global _health_cache, _health_cache_at

    now = time.monotonic()
    if (
        not force_refresh
        and _health_cache is not None
        and now - _health_cache_at < HEALTH_PROBE_CACHE_SECONDS
    ):
        return _health_cache

    try:
        from playwright.sync_api import Error as PlaywrightError
        from playwright.sync_api import sync_playwright
    except ImportError:
        result = {
            "status": "unavailable",
            "error": f"Playwright 未安装；请 {PLAYWRIGHT_INSTALL_HINT}",
        }
        _health_cache = result
        _health_cache_at = now
        return result

    fe_ok, fe_error = _fe_reachable()
    if not fe_ok:
        result = {"status": "unavailable", "error": fe_error}
        _health_cache = result
        _health_cache_at = now
        return result

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                timeout=HEALTH_BROWSER_TIMEOUT_MS,
            )
            browser.close()
    except PlaywrightError as exc:
        message = str(exc)
        if "Executable doesn't exist" in message or "browserType.launch" in message:
            error = f"Chromium 未安装；请 {PLAYWRIGHT_INSTALL_HINT}"
        else:
            error = f"Playwright/Chromium 不可用：{message}"
        result = {"status": "unavailable", "error": error}
        _health_cache = result
        _health_cache_at = now
        return result

    result = {"status": "available", "error": None}
    _health_cache = result
    _health_cache_at = now
    return result


def reset_export_render_health_cache_for_tests() -> None:
    global _health_cache, _health_cache_at
    _health_cache = None
    _health_cache_at = 0.0


def _measure_page_size(page) -> tuple[int, int]:
    dims = page.evaluate(
        f"""() => {{
            const root = document.querySelector({CAPTURE_ROOT_SELECTOR!r});
            const scope = root ?? document.documentElement;
            const rect = scope.getBoundingClientRect();
            const width = Math.max(
                scope.scrollWidth,
                scope.offsetWidth,
                Math.ceil(rect.width),
                document.documentElement.scrollWidth,
                {MIN_PAGE_WIDTH},
            );
            const height = Math.max(
                scope.scrollHeight,
                scope.offsetHeight,
                Math.ceil(rect.height),
                document.documentElement.scrollHeight,
                document.body?.scrollHeight ?? 0,
                900,
            );
            return {{ width: Math.ceil(width), height: Math.ceil(height) }};
        }}""",
    )
    return int(dims["width"]), int(dims["height"])


def _full_page_pdf_options(page) -> dict:
    width, height = _measure_page_size(page)
    scale = 1.0
    if height > MAX_PDF_PAGE_HEIGHT_PX:
        scale = MAX_PDF_PAGE_HEIGHT_PX / height
        height = MAX_PDF_PAGE_HEIGHT_PX
    return {
        "width": f"{width}px",
        "height": f"{height}px",
        "print_background": True,
        "prefer_css_page_size": False,
        "margin": {"top": "0", "bottom": "0", "left": "0", "right": "0"},
        "scale": scale,
    }


def _pdf_options(layout_mode: ExportLayoutMode, page) -> dict:
    if layout_mode == EXPORT_LAYOUT_PER_WIDGET:
        return {
            "format": "A4",
            "print_background": True,
            "landscape": True,
            "margin": {"top": "12mm", "bottom": "12mm", "left": "10mm", "right": "10mm"},
        }
    if layout_mode == EXPORT_LAYOUT_FULL_PAGE:
        return _full_page_pdf_options(page)
    if layout_mode == EXPORT_LAYOUT_COMBINED:
        return _full_page_pdf_options(page)
    width, height = _measure_page_size(page)
    return {
        "width": f"{width}px",
        "height": f"{height}px",
        "print_background": True,
        "margin": {"top": "8px", "bottom": "8px", "left": "8px", "right": "8px"},
    }


def _validate_pdf_bytes(pdf_bytes: bytes | None) -> bytes:
    if not pdf_bytes or len(pdf_bytes) < 512:
        raise dash_service.DashboardError(
            "DASH_EXPORT_RENDER_EMPTY",
            "可视化导出产物为空",
            502,
        )
    if b"LAYOUT INVENTORY PREVIEW" in pdf_bytes[:4096]:
        raise dash_service.DashboardError(
            "DASH_EXPORT_RENDER_INVENTORY_LEAK",
            "导出产物仍为布局清单，请检查 export 路由",
            502,
        )
    return pdf_bytes


def render_dashboard_visual_pdf(
    dashboard_id: UUID,
    *,
    token: str,
    surface: str = "dashboard",
    layout_mode: ExportLayoutMode | str | None = EXPORT_LAYOUT_FULL_PAGE,
) -> bytes:
    mode = normalize_export_layout_mode(layout_mode if isinstance(layout_mode, str) else layout_mode)
    settings = get_settings()
    url = build_export_snapshot_url(
        dashboard_id, token=token, surface=surface, layout_mode=mode, settings=settings,
    )

    try:
        from playwright.sync_api import Error as PlaywrightError
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise dash_service.DashboardError(
            "DASH_EXPORT_RENDER_UNAVAILABLE",
            f"Playwright 未安装；请 {PLAYWRIGHT_INSTALL_HINT}",
            503,
        ) from exc

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, timeout=HEALTH_BROWSER_TIMEOUT_MS)
            try:
                context = browser.new_context(
                    viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
                    device_scale_factor=DEVICE_SCALE_FACTOR,
                )
                page = context.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
                page.wait_for_selector(CAPTURE_SELECTOR, timeout=NAV_TIMEOUT_MS)
                page.wait_for_timeout(SETTLE_MS)
                if mode in {EXPORT_LAYOUT_FULL_PAGE, EXPORT_LAYOUT_COMBINED}:
                    width, height = _measure_page_size(page)
                    page.set_viewport_size({"width": width, "height": height})
                    page.wait_for_timeout(500)
                    if mode == EXPORT_LAYOUT_FULL_PAGE:
                        width, height = _measure_page_size(page)
                        page.set_viewport_size({"width": width, "height": height})
                        page.wait_for_timeout(300)
                pdf_bytes = page.pdf(**_pdf_options(mode, page))
                context.close()
            finally:
                browser.close()
    except PlaywrightError as exc:
        safe_url = _redact_export_url(url)
        logger.warning(
            "dashboard_visual_export_failed id=%s mode=%s url=%s err=%s",
            dashboard_id,
            mode,
            safe_url,
            exc,
        )
        raise dash_service.DashboardError(
            "DASH_EXPORT_RENDER_FAILED",
            f"可视化导出渲染失败（{MODE_LABELS[mode]}，{safe_url}）：{exc}",
            502,
        ) from exc

    return _validate_pdf_bytes(pdf_bytes)
