from __future__ import annotations

import re
from datetime import date, datetime

from app.auth.deps import UserContext
from app.governance.catalog.cat07.errors import CAT07_FORBIDDEN, Cat07Error
from app.governance.catalog.cat07.schemas import BehaviorRow, WorknoBehaviorOut

_WORKNO_RE = re.compile(r"^[A-Z0-9]{4,16}$")

_USER_WORKNO_SCOPE: dict[str, str] = {}

_SEED: dict[str, list[dict]] = {
    "EMP1001": [
        {"action": "login", "timestamp": "2026-07-01T08:00:00Z", "auditRef": "AUD-1001-1"},
        {"action": "query", "timestamp": "2026-07-02T09:00:00Z", "auditRef": "AUD-1001-2"},
        {"action": "export", "timestamp": "2026-07-03T10:00:00Z", "auditRef": "AUD-1001-3"},
    ],
    "EMP2002": [
        {"action": "login", "timestamp": "2026-07-01T08:30:00Z", "auditRef": "AUD-2002-1"},
        {"action": "view", "timestamp": "2026-07-02T11:00:00Z", "auditRef": "AUD-2002-2"},
        {"action": "approve", "timestamp": "2026-07-03T15:00:00Z", "auditRef": "AUD-2002-3"},
    ],
}


def set_user_workno_scope(user_id: str, workno: str) -> None:
    _USER_WORKNO_SCOPE[user_id] = workno


def _assert_workno_access(user: UserContext, workno: str) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    if "enterprise" in roles or "viewer" in roles:
        expected = _USER_WORKNO_SCOPE.get(user.id, "EMP1001")
        if workno != expected:
            raise Cat07Error(CAT07_FORBIDDEN, "workno access denied", 403)
        return
    raise Cat07Error(CAT07_FORBIDDEN, "workno access denied", 403)


def query_behavior(
    workno: str | None,
    from_date: date | None,
    to_date: date | None,
    limit: int,
    offset: int,
    user: UserContext,
) -> WorknoBehaviorOut:
    if not workno:
        raise Cat07Error("CAT07_WORKNO_REQUIRED", "workno is required", 422)
    if not _WORKNO_RE.match(workno):
        raise Cat07Error("CAT07_WORKNO_INVALID", "Invalid workno format", 422)
    if limit > 200:
        raise Cat07Error("CAT07_LIMIT_EXCEEDED", "limit cannot exceed 200", 422)
    if from_date and to_date and from_date > to_date:
        raise Cat07Error("CAT07_DATE_RANGE_INVALID", "fromDate must be <= toDate", 422)

    rows = _SEED.get(workno)
    if rows is None:
        raise Cat07Error("CAT07_WORKNO_NOT_FOUND", "Workno not found", 404)

    _assert_workno_access(user, workno)

    parsed: list[BehaviorRow] = []
    for row in rows:
        ts = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00"))
        if from_date and ts.date() < from_date:
            continue
        if to_date and ts.date() > to_date:
            continue
        parsed.append(BehaviorRow(action=row["action"], timestamp=ts, auditRef=row["auditRef"]))

    total = len(parsed)
    page = parsed[offset : offset + limit]
    return WorknoBehaviorOut(workno=workno, behaviors=page, total=total, auditLinked=True)
