"""BUG-001 browser acceptance screenshots (Task 8)."""
from __future__ import annotations

import json
import time
from pathlib import Path

from dotenv import dotenv_values
from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[4]
ARTIFACT_DIR = Path(__file__).resolve().parent
BASE_URL = "http://127.0.0.1:5173"
BACKEND = "http://127.0.0.1:8000"


def _login_token() -> str:
    cfg = dotenv_values(ROOT / "backend" / ".env")
    password = cfg.get("VITALSPAN_DEV_ADMIN_PASSWORD") or "changeme"
    import urllib.request

    body = json.dumps({"username": "admin", "password": password}).encode()
    req = urllib.request.Request(
        f"{BACKEND}/api/v1/auth/login",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        data = json.load(resp)
    return data["accessToken"]


def _seed_session(page: Page, token: str, theme: str) -> None:
    page.goto(f"{BASE_URL}/login")
    page.evaluate(
        """([token, theme]) => {
          localStorage.setItem('vitalspan:access_token', token);
          localStorage.setItem('theme', theme);
        }""",
        [token, theme],
    )


def _open_security(page: Page, theme: str) -> None:
    page.goto(f"{BASE_URL}/admin/account/security")
    page.wait_for_selector("#current-password", timeout=20000)
    page.evaluate(
        """(theme) => {
          localStorage.setItem('theme', theme);
          document.documentElement.classList.toggle('dark', theme === 'dark');
        }""",
        theme,
    )
    page.wait_for_timeout(400)


def _shot(page: Page, name: str) -> None:
    path = ARTIFACT_DIR / name
    page.screenshot(path=str(path), full_page=False)
    print(f"saved {path.name}")


def main() -> None:
    token = _login_token()
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    defaults = [
        (1440, 1000, "1440x1000"),
        (1024, 768, "1024x768"),
        (390, 844, "390x844"),
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for width, height, label in defaults:
            for theme in ("light", "dark"):
                context = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=1,
                )
                page = context.new_page()
                _seed_session(page, token, theme)
                _open_security(page, theme)
                _shot(page, f"password-security-{label}-{theme}-default.png")
                context.close()

        # Error + focus (desktop dark)
        ctx = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = ctx.new_page()
        _seed_session(page, token, "dark")
        _open_security(page, "dark")
        page.fill("#current-password", "wrongpass1")
        page.fill("#new-password", "newpass123")
        page.fill("#confirm-password", "newpass123")
        page.get_by_role("button", name="更新密码").click()
        page.wait_for_selector("text=当前密码不正确", timeout=10000)
        page.wait_for_timeout(300)
        assert "/login" not in page.url
        _shot(page, "password-security-1440x1000-dark-error-focus.png")
        ctx.close()

        # Loading (desktop dark) — delay change-password response
        ctx = browser.new_context(viewport={"width": 1440, "height": 1000})

        def slow_change_password(route, request):
            if request.method == "POST" and request.url.endswith("/api/v1/auth/change-password"):
                time.sleep(2.5)
                route.fulfill(
                    status=401,
                    content_type="application/json",
                    body=json.dumps(
                        {
                            "code": "AUTH_INVALID_CURRENT_PASSWORD",
                            "message": "当前密码不正确",
                            "detail": None,
                        }
                    ),
                )
            else:
                route.continue_()

        ctx.route("**/api/v1/**", slow_change_password)
        page = ctx.new_page()
        _seed_session(page, token, "dark")
        _open_security(page, "dark")
        page.fill("#current-password", "wrongpass1")
        page.fill("#new-password", "newpass123")
        page.fill("#confirm-password", "newpass123")
        page.get_by_role("button", name="更新密码").click()
        page.wait_for_selector("button:has-text('保存中')", timeout=5000)
        _shot(page, "password-security-1440x1000-dark-loading.png")
        ctx.close()

        # Password visible (mobile dark)
        ctx = browser.new_context(viewport={"width": 390, "height": 844})
        page = ctx.new_page()
        _seed_session(page, token, "dark")
        _open_security(page, "dark")
        page.get_by_role("button", name="显示当前密码").click()
        page.get_by_role("button", name="显示新密码").click()
        assert page.locator("#current-password").get_attribute("type") == "text"
        _shot(page, "password-security-390x844-dark-password-visible.png")
        ctx.close()

        browser.close()

    print("acceptance_complete")


if __name__ == "__main__":
    main()
