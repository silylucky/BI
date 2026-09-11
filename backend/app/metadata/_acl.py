from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

from app.auth.deps import UserContext

E = TypeVar("E", bound=Exception)


def _assert_meta_write(user: UserContext, *, raise_forbidden: Callable[[], E]) -> E | None:
    if set(user.roles).intersection({"admin", "analyst"}):
        return None
    raise raise_forbidden()
