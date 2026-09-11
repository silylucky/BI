from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class SmtpSettings:
    host: str
    port: int
    from_addr: str
    username: str | None
    password: str | None
    source: Literal["db", "env", "none"]

    @property
    def is_configured(self) -> bool:
        return self.source != "none" and bool(self.host.strip()) and bool(self.from_addr.strip())
