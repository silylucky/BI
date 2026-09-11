from __future__ import annotations

import re
from dataclasses import dataclass

# 编码格式：domain 段 + ':' + action 段（或运行时通配 '*'）。
# 通配 domain:* 仅用于运行时匹配，不得持久化到 auth_role_permissions。
PERMISSION_CODE_PATTERN = re.compile(r"^[a-z][a-z0-9_]*:(?:\*|[a-z][a-z0-9_.]*)$")


@dataclass(frozen=True)
class PermissionDefinition:
    code: str
    name: str
    domain: str
    description: str | None = None


def _p(code: str, name: str, description: str) -> PermissionDefinition:
    return PermissionDefinition(code=code, name=name, domain=code.split(":", 1)[0], description=description)


PERMISSION_CATALOG: tuple[PermissionDefinition, ...] = (
    _p("system:role.read", "查看角色", "读取角色列表与权限绑定"),
    _p("system:role.manage", "管理角色", "创建、修改、启停、删除角色及权限替换"),
    _p("system:user.read", "查看用户", "读取用户列表与详情"),
    _p("system:user.manage", "管理用户", "创建、修改、启停、解锁用户及绑定角色/组织"),
    _p("system:org_scoped.manage", "组织范围管理", "在本组织子树内管理用户与授权（不含全局用户管理）"),
    _p("system:user.password.reset", "重置用户密码", "管理员重置用户密码"),
    _p("system:grant.read", "查看资源授权", "读取资源授权"),
    _p("system:grant.manage", "管理资源授权", "创建、批量创建与撤销资源授权"),
    _p("system:rls.read", "查看行级权限", "读取维度、分组与角色绑定"),
    _p("system:rls.manage", "管理行级权限", "变更维度、分组、成员值与角色绑定"),
    _p("system:org.read", "查看组织", "读取组织树"),
    _p("system:org.manage", "管理组织", "创建、修改、删除组织节点"),
    _p("system:audit.read", "查看审计", "读取审计事件"),
    _p("system:platform_connect.read", "查看平台对接", "读取邮件与 IM 工作通知通道对接配置摘要"),
    _p("system:platform_connect.manage", "管理平台对接", "保存、探测与清空邮件与 IM 通道对接配置"),
    _p("datasource:read", "查看数据源", "读取数据源列表、详情与元数据浏览"),
    _p("datasource:manage", "管理数据源", "创建、编辑、删除数据源与测试连接"),
    _p("dashboard:read", "查看仪表板", "读取、预览、执行仪表板"),
    _p("dashboard:edit", "编辑仪表板", "编辑与分享仪表板"),
    _p("dashboard:share", "分享仪表板", "生成与管理仪表板分享链接"),
    _p("dashboard:schedule", "管理看板定时推送", "为本人拥有的看板/大屏创建与管理定时报告"),
    _p("dashboard:template.manage", "管理可视化模板", "发布、下架与组织内模板目录管理"),
    _p("viz:component.manage", "管理可视化组件库", "发布、下架与组织内单组件复用库"),
    _p("viz:component.read", "查看可视化组件库", "浏览组织内已发布的可视化组件"),
    _p("report:read", "查看报表", "读取报表目录、模板、预览与导出"),
    _p("report:export", "导出报表", "导出报表与批处理产物"),
    _p("report:manage", "管理报表", "变更报表目录、模板、批处理与调度"),
    _p("dataset:read", "查看数据集", "读取数据集与查询绑定"),
    _p("dataset:manage", "管理数据集", "创建、编辑数据集与查询配置"),
    _p("dataset:mask.manage", "管理列脱敏", "配置数据集列脱敏策略"),
    _p("metadata:read", "查看元数据", "浏览元数据"),
    _p("metadata:manage", "管理元数据", "刷新、同步与主题节点变更"),
    _p("governance:read", "查看治理", "读取治理目录"),
    _p("governance:manage", "管理治理", "发布与治理写路径"),
    _p("theme:read", "查看主题分析", "读取仪表板主题分析"),
    _p("theme:manage", "管理主题分析", "编辑与校验仪表板主题分析"),
    _p("ingestion:read", "查看数据集成", "读取集成任务与状态"),
    _p("ingestion:manage", "管理数据集成", "创建、启动、停止与重跑集成任务"),
    _p("agent:plugin.manage", "管理 AI 助手插件", "安装、配置、启停、审计与卸载共享 AI 助手插件"),
)


def _validate_catalog() -> frozenset[str]:
    codes: set[str] = set()
    for definition in PERMISSION_CATALOG:
        if not PERMISSION_CODE_PATTERN.match(definition.code):
            raise ValueError(f"invalid permission code: {definition.code!r}")
        if definition.code.endswith(":*"):
            raise ValueError(f"wildcard code not allowed in catalog: {definition.code!r}")
        if definition.code in codes:
            raise ValueError(f"duplicate permission code: {definition.code!r}")
        codes.add(definition.code)
    return frozenset(codes)


CATALOG_CODES: frozenset[str] = _validate_catalog()

PERMISSION_BY_CODE: dict[str, PermissionDefinition] = {d.code: d for d in PERMISSION_CATALOG}


def is_catalog_code(code: str) -> bool:
    """精确编码是否在目录中（不含通配）。"""
    return code in CATALOG_CODES


def permission_matches(granted: set[str], required: str, is_root: bool) -> bool:
    """运行时权限匹配：root 直通、精确匹配、全局 '*' 或 domain:* 通配覆盖。"""
    if is_root:
        return True
    if required in granted:
        return True
    if "*" in granted:
        return True
    domain = required.split(":", 1)[0]
    return f"{domain}:*" in granted
