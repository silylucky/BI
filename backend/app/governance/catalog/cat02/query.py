from __future__ import annotations

from app.auth.deps import UserContext
from app.governance.catalog.cat02.errors import CAT02_FORBIDDEN, CAT02_NOT_FOUND, Cat02Error
from app.governance.catalog.cat02.schemas import AggregateQueryOut
from app.governance.catalog.cat02 import service as cat02_service

_POC_SEED: dict[str, list[dict[str, object]]] = {
    "province": [
        {"province": "北京", "orders": 120, "revenue": 5400},
        {"province": "上海", "orders": 98, "revenue": 4200},
        {"province": "广东", "orders": 210, "revenue": 9800},
        {"province": "浙江", "orders": 156, "revenue": 7100},
    ],
    "city": [
        {"city": "北京", "orders": 120, "revenue": 5400},
        {"city": "上海", "orders": 98, "revenue": 4200},
        {"city": "广州", "orders": 110, "revenue": 5100},
    ],
    "locType": [
        {"locType": "retail", "orders": 280, "revenue": 12400},
        {"locType": "warehouse", "orders": 190, "revenue": 8600},
    ],
}

_POC_DEFAULT_TEMPLATE: dict = {
    "aggregateKey": "AGG_POC",
    "dimensions": ["province", "city", "locType"],
    "metrics": ["orders", "revenue"],
    "aggregationFn": "sum",
}


def _resolve_template(template_key: str) -> dict:
    try:
        row = cat02_service.get_aggregate_template(template_key)
        return row.model_dump(by_alias=True)
    except Cat02Error as exc:
        if exc.code != CAT02_NOT_FOUND:
            raise
    if template_key == _POC_DEFAULT_TEMPLATE["aggregateKey"]:
        return dict(_POC_DEFAULT_TEMPLATE)
    raise Cat02Error(CAT02_NOT_FOUND, f"aggregate template not found: {template_key}", 404)


def _assert_read_access(user: UserContext, template_key: str) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    if "enterprise" in roles:
        prefix = cat02_service.get_user_aggregate_scope_prefix(user.id)
        if not template_key.startswith(prefix):
            raise Cat02Error(CAT02_FORBIDDEN, "enterprise user out of aggregate scope", 403)
        return
    if "viewer" in roles:
        return
    raise Cat02Error(CAT02_FORBIDDEN, "aggregate query access denied", 403)


def query_aggregate(
    template_key: str,
    group_by: str,
    user: UserContext,
) -> AggregateQueryOut:
    if not template_key:
        raise Cat02Error("CAT02_TEMPLATE_REQUIRED", "templateKey is required", 422)
    if not group_by:
        raise Cat02Error("CAT02_GROUP_BY_REQUIRED", "groupBy is required", 422)

    template = _resolve_template(template_key)
    dimensions = list(template.get("dimensions") or [])
    metrics = list(template.get("metrics") or [])
    if group_by not in dimensions:
        raise Cat02Error(
            "CAT02_INVALID_GROUP_BY",
            f"groupBy must be one of template dimensions: {dimensions}",
            422,
            [{"field": "groupBy", "message": group_by}],
        )

    _assert_read_access(user, template_key)
    seed_rows = _POC_SEED.get(group_by, [])
    rows = [{k: v for k, v in row.items() if k in {group_by, *metrics}} for row in seed_rows]
    return AggregateQueryOut(
        templateKey=template_key,
        groupBy=group_by,
        dimensions=[group_by],
        metrics=metrics,
        rows=rows,
        pocReady=True,
    )
