from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GovPermissionRow:
    action: str
    route: str
    allowed_roles: tuple[str, ...]
    resource_grant: bool = False


GOV_PERMISSION_MATRIX: tuple[GovPermissionRow, ...] = (
    GovPermissionRow("workflow_submit", "workflow/.../transition submit", ("requester", "admin")),
    GovPermissionRow("workflow_approve", "workflow/.../transition approve", ("approver", "admin")),
    GovPermissionRow("workflow_reject", "workflow/.../transition reject", ("approver", "admin")),
    GovPermissionRow(
        "workflow_complete_design", "workflow/.../transition complete_design", ("designer", "admin")
    ),
    GovPermissionRow("publish_submit", "publish/.../submit", ("designer", "admin")),
    GovPermissionRow(
        "publish_approve", "publish/.../approve", ("publisher", "admin"), resource_grant=True
    ),
    GovPermissionRow("publish_reject", "publish/.../reject", ("publisher", "admin")),
    GovPermissionRow("bus_register", "POST /bus/register", ("integration", "admin")),
    GovPermissionRow("bus_auto_register", "POST /bus/auto-register", ("integration", "admin")),
    GovPermissionRow("bus_auto_register_retry", "POST /bus/auto-register/retry", ("integration", "admin")),
)


def describe_gov_permission_matrix() -> dict:
    return {
        "actions": [
            {
                "action": row.action,
                "route": row.route,
                "allowedRoles": list(row.allowed_roles),
                "resourceGrantRequired": row.resource_grant,
            }
            for row in GOV_PERMISSION_MATRIX
        ]
    }
