from __future__ import annotations

import json
import re
import uuid
from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy.orm import Session

from app.agent.uploads import UploadedFileStore
from app.auth.deps import UserContext
from app.auth.permissions import permission_matches
from app.dashboard import service as dash_service
from app.dashboard.schemas import DashboardCreate
from app.datasources import service as datasource_service
from app.datasources.acl import assert_visible
from app.datasources.metadata import service as metadata_service
from app.datasources.models import DataSource
from app.metadata.dataset import service as dataset_service
from app.metadata.dataset.schemas import DatasetItemIn
from app.query import service as query_service
from app.query.config_store.schemas import ConfigUpsert
from app.query.config_store.service import upsert_config
from app.query.dataset.execute_config import execute_dataset_from_config
from app.query.dataset.schemas import DatasetExecuteRequest
from app.query.schemas import ExecuteRequest, QueryError
from app.schemas.chart_view import ChartViewConfig
from app.viz.builtin import register_builtin_chart_types
from app.viz.components import service as component_service
from app.viz.components.schemas import VizComponentCreateIn
from app.viz.registry import export_chart_type_catalog


class AgentTool(ABC):
    """Function-calling tool whose execution always receives the authenticated user."""

    requires_confirmation = False
    required_permissions: tuple[str, ...] = ()

    def is_available_to(self, user: UserContext) -> bool:
        return all(permission_matches(user.permissions, permission, user.is_root) for permission in self.required_permissions)

    def missing_permissions(self, user: UserContext) -> list[str]:
        return [
            permission
            for permission in self.required_permissions
            if not permission_matches(user.permissions, permission, user.is_root)
        ]

    @property
    @abstractmethod
    def name(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def description(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def parameters(self) -> dict[str, Any]:
        raise NotImplementedError

    def definition(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }

    @abstractmethod
    def execute(self, db: Session, user: UserContext, arguments: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError


class ListDashboardsTool(AgentTool):
    required_permissions = ("dashboard:read",)

    @property
    def name(self) -> str:
        return "vitalspan_list_dashboards"

    @property
    def description(self) -> str:
        return "列出当前用户有权查看的仪表板或数据大屏，可按关键词和类型筛选。"

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "名称、标识或描述关键词"},
                "surface_kind": {
                    "type": "string",
                    "enum": ["dashboard", "data-screen"],
                    "description": "dashboard 为仪表板，data-screen 为数据大屏",
                },
                "limit": {"type": "integer", "minimum": 1, "maximum": 50, "default": 20},
            },
            "additionalProperties": False,
        }

    def execute(self, db: Session, user: UserContext, arguments: dict[str, Any]) -> dict[str, Any]:
        try:
            limit = max(1, min(int(arguments.get("limit", 20)), 50))
        except (TypeError, ValueError):
            limit = 20
        result = dash_service.list_dashboards(
            db,
            actor=user,
            limit=limit,
            q=str(arguments.get("query") or "").strip() or None,
            surface_kind=arguments.get("surface_kind"),
        )
        return result.model_dump(mode="json", by_alias=True)


class GetDashboardTool(AgentTool):
    required_permissions = ("dashboard:read",)

    @property
    def name(self) -> str:
        return "vitalspan_get_dashboard"

    @property
    def description(self) -> str:
        return "读取一个仪表板或数据大屏的详情与布局。仅在用户已知或确认目标 ID 后使用。"

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {"dashboard_id": {"type": "string", "description": "仪表板 UUID"}},
            "required": ["dashboard_id"],
            "additionalProperties": False,
        }

    def execute(self, db: Session, user: UserContext, arguments: dict[str, Any]) -> dict[str, Any]:
        dashboard_id = _uuid(arguments.get("dashboard_id"), "dashboard_id")
        result = dash_service.get_dashboard(db, dashboard_id)
        _ensure_dashboard_visible(db, user, dashboard_id, result)
        return result.model_dump(mode="json", by_alias=True)


class ListDataSourcesTool(AgentTool):
    required_permissions = ("datasource:read",)

    @property
    def name(self) -> str:
        return "vitalspan_list_datasources"

    @property
    def description(self) -> str:
        return "列出当前用户有权访问的数据源，供后续浏览元数据和只读查询使用。"

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "数据源名称或标识关键词"},
                "type": {"type": "string", "description": "可选连接器类型，例如 mysql、postgresql"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 50, "default": 20},
            },
            "additionalProperties": False,
        }

    def execute(self, db: Session, user: UserContext, arguments: dict[str, Any]) -> dict[str, Any]:
        try:
            limit = max(1, min(int(arguments.get("limit", 20)), 50))
        except (TypeError, ValueError):
            limit = 20
        result = datasource_service.list_data_sources(
            db,
            role_codes=user.roles,
            is_root=user.is_root,
            limit=limit,
            q=str(arguments.get("query") or "").strip() or None,
            type=str(arguments.get("type") or "").strip() or None,
            include_managed=True,
        )
        return result.model_dump(mode="json", by_alias=True)


class ListUploadedFilesTool(AgentTool):
    def __init__(self, upload_store: UploadedFileStore):
        self.upload_store = upload_store

    @property
    def name(self) -> str:
        return "vitalspan_list_uploaded_files"

    @property
    def description(self) -> str:
        return "列出当前用户已上传到 AI 助手的附件。需要读取用户上传的文本、CSV、JSON、SQL 或代码文件前，先调用此工具确认文件 ID。"

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        }

    def execute(self, db: Session, user: UserContext, arguments: dict[str, Any]) -> dict[str, Any]:
        del db, arguments
        files = [
            {key: value for key, value in item.items() if key != "storedPath"}
            for item in self.upload_store.list(user.id)
        ]
        return {"files": files}


class ReadUploadedFileTool(AgentTool):
    def __init__(self, upload_store: UploadedFileStore):
        self.upload_store = upload_store

    @property
    def name(self) -> str:
        return "vitalspan_read_uploaded_file"

    @property
    def description(self) -> str:
        return "读取当前用户已上传的一个文本附件内容。仅支持 UTF-8 的文本、CSV、JSON、SQL 和代码类文件，内容会受长度限制。"

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "file_id": {"type": "string", "description": "通过 vitalspan_list_uploaded_files 获取的附件 ID"},
            },
            "required": ["file_id"],
            "additionalProperties": False,
        }

    def execute(self, db: Session, user: UserContext, arguments: dict[str, Any]) -> dict[str, Any]:
        del db
        file_id = str(arguments.get("file_id") or "").strip()
        if not file_id:
            raise ValueError("file_id 不能为空")
        metadata = self.upload_store.get(file_id, user.id)
        if metadata is None:
            raise PermissionError("附件不存在或无权访问")
        return {
            "file": {key: value for key, value in metadata.items() if key != "storedPath"},
            "content": self.upload_store.text_content(file_id, user.id),
        }


class ListSchemasTool(AgentTool):
    required_permissions = ("datasource:read",)

    @property
    def name(self) -> str:
        return "vitalspan_list_schemas"

    @property
    def description(self) -> str:
        return "列出一个可访问数据源中的 schema 或数据库命名空间。"

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {"data_source_id": {"type": "string", "description": "数据源 UUID"}},
            "required": ["data_source_id"],
            "additionalProperties": False,
        }

    def execute(self, db: Session, user: UserContext, arguments: dict[str, Any]) -> dict[str, Any]:
        result = metadata_service.list_schemas(
            db, user.roles, _uuid(arguments.get("data_source_id"), "data_source_id"), is_root=user.is_root
        )
        return result.model_dump(mode="json", by_alias=True)


class ListTablesTool(AgentTool):
    required_permissions = ("datasource:read",)

    @property
    def name(self) -> str:
        return "vitalspan_list_tables"

    @property
    def description(self) -> str:
        return "列出一个可访问数据源的 schema 下的数据表。"

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "data_source_id": {"type": "string", "description": "数据源 UUID"},
                "schema": {"type": "string", "description": "schema 名称；没有 schema 时传空字符串"},
            },
            "required": ["data_source_id"],
            "additionalProperties": False,
        }

    def execute(self, db: Session, user: UserContext, arguments: dict[str, Any]) -> dict[str, Any]:
        result = metadata_service.list_tables(
            db,
            user.roles,
            _uuid(arguments.get("data_source_id"), "data_source_id"),
            str(arguments.get("schema") or ""),
            is_root=user.is_root,
        )
        return result.model_dump(mode="json", by_alias=True)


class ListColumnsTool(AgentTool):
    required_permissions = ("datasource:read",)

    @property
    def name(self) -> str:
        return "vitalspan_list_columns"

    @property
    def description(self) -> str:
        return "列出一个可访问数据表的字段、类型和元数据。在编写查询前应优先使用它确认字段。"

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "data_source_id": {"type": "string", "description": "数据源 UUID"},
                "schema": {"type": "string", "description": "schema 名称；没有 schema 时传空字符串"},
                "table": {"type": "string", "description": "数据表名称"},
            },
            "required": ["data_source_id", "table"],
            "additionalProperties": False,
        }

    def execute(self, db: Session, user: UserContext, arguments: dict[str, Any]) -> dict[str, Any]:
        result = metadata_service.list_columns(
            db,
            user.roles,
            _uuid(arguments.get("data_source_id"), "data_source_id"),
            str(arguments.get("schema") or ""),
            str(arguments["table"]),
            is_root=user.is_root,
        )
        return result.model_dump(mode="json", by_alias=True)


class ExecuteQueryTool(AgentTool):
    required_permissions = ("datasource:read",)

    @property
    def name(self) -> str:
        return "vitalspan_execute_readonly_query"

    @property
    def description(self) -> str:
        return "在当前用户有权访问的数据源上执行只读 SQL 或表查询。平台会强制只读校验、行级权限和列脱敏；在没有核对字段前不要编造 SQL。"

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "data_source_id": {"type": "string", "description": "数据源 UUID"},
                "sql": {"type": "string", "description": "只读 SQL，仅可执行 SELECT / WITH 查询"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 1000, "default": 100},
            },
            "required": ["data_source_id", "sql"],
            "additionalProperties": False,
        }

    def execute(self, db: Session, user: UserContext, arguments: dict[str, Any]) -> dict[str, Any]:
        try:
            payload = ExecuteRequest.model_validate(
                {
                    "dataSourceId": arguments["data_source_id"],
                    "mode": "sql",
                    "sql": arguments["sql"],
                    "limit": arguments.get("limit", 100),
                    "rls": {"enabled": True},
                }
            )
        except ValidationError as exc:
            return {"error": {"code": "QUERY_ARGUMENT_INVALID", "message": str(exc)}}
        try:
            return query_service.execute_query(db, user, payload).model_dump(mode="json", by_alias=True)
        except QueryError as exc:
            return {"error": {"code": exc.code, "message": exc.message}}


class ListChartTypesTool(AgentTool):
    required_permissions = ("dashboard:read",)

    @property
    def name(self) -> str:
        return "vitalspan_list_chart_types"

    @property
    def description(self) -> str:
        return "列出平台已注册的内置图表类型、样式变体和维度/指标字段要求。创建图表组件前必须用此工具核对类型，不能编造 chartType。"

    @property
    def parameters(self) -> dict[str, Any]:
        return {"type": "object", "properties": {}, "additionalProperties": False}

    def execute(self, db: Session, user: UserContext, arguments: dict[str, Any]) -> dict[str, Any]:
        del db, user, arguments
        register_builtin_chart_types()
        return {"items": export_chart_type_catalog()}


class AgentScreenSource(BaseModel):
    """A physical table that receives one isolated generated Dataset."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    key: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z][a-zA-Z0-9_-]*$")
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    schema_name: str = Field(default="", alias="schema", max_length=128)
    table: str = Field(min_length=1, max_length=128)
    columns: list[str] = Field(min_length=1, max_length=128)
    display_name: str | None = Field(default=None, alias="displayName", max_length=120)


class AgentScreenComponent(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    source_key: str = Field(alias="sourceKey", min_length=1, max_length=64)
    chart_type: str = Field(alias="chartType", min_length=1, max_length=80)
    style_variant: str = Field(default="default", alias="styleVariant", min_length=1, max_length=80)
    dimensions: list[dict[str, Any]] = Field(default_factory=list, max_length=8)
    metrics: list[dict[str, Any]] = Field(default_factory=list, max_length=8)
    axes: dict[str, list[dict[str, Any]]] | None = None
    filters: list[dict[str, Any]] = Field(default_factory=list, max_length=16)
    time_range: dict[str, Any] | None = Field(default=None, alias="timeRange")
    category_key: str = Field(default="agent-generated", alias="categoryKey", max_length=64)
    tags: list[str] = Field(default_factory=list, max_length=16)
    title: str | None = Field(default=None, max_length=120)


class AgentCreateDataScreenPlan(BaseModel):
    """Confirmation-gated asset plan generated by the assistant after metadata discovery."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    sources: list[AgentScreenSource] = Field(min_length=1, max_length=32)
    components: list[AgentScreenComponent] = Field(min_length=1, max_length=32)
    theme: str = Field(default="dark", max_length=64)
    layout_template: str | None = Field(default=None, alias="layoutTemplate", max_length=64)


class CreateDataScreenTool(AgentTool):
    """Create isolated Datasets, published chart components, and one data-screen in one confirmation."""

    requires_confirmation = True
    required_permissions = ("datasource:read", "dataset:manage", "dashboard:edit", "viz:component.manage")

    @property
    def name(self) -> str:
        return "vitalspan_create_data_screen"

    @property
    def description(self) -> str:
        return (
            "按已确认的完整方案创建数据大屏：每个 dataSourceId+schema+table 建立独立专用 Dataset，"
            "预跑只读查询校验数据，创建并直接发布内置图表组件到组织组件库，再按与人工编辑器相同的快照复用规则拼装 1920×1080 数据大屏。"
            "只能使用已存在且当前用户有权访问的数据源；调用前必须完成 schema、表、字段和 chartType 核对。"
        )

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "数据大屏名称"},
                "description": {"type": "string", "description": "业务用途说明"},
                "sources": {
                    "type": "array",
                    "description": "每项为一个已核对的数据源表；每个表会创建独立专用 Dataset。",
                    "items": {
                        "type": "object",
                        "properties": {
                            "key": {"type": "string"},
                            "dataSourceId": {"type": "string"},
                            "schema": {"type": "string"},
                            "table": {"type": "string"},
                            "columns": {"type": "array", "items": {"type": "string"}},
                            "displayName": {"type": "string"},
                        },
                        "required": ["key", "dataSourceId", "table", "columns"],
                        "additionalProperties": False,
                    },
                },
                "components": {
                    "type": "array",
                    "description": "要入组织组件库并放进大屏的内置图表。字段需来自对应 sourceKey 的 columns。",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "description": {"type": "string"},
                            "sourceKey": {"type": "string"},
                            "chartType": {"type": "string"},
                            "styleVariant": {"type": "string"},
                            "dimensions": {"type": "array", "items": {"type": "object"}},
                            "metrics": {"type": "array", "items": {"type": "object"}},
                            "axes": {"type": "object"},
                            "filters": {"type": "array", "items": {"type": "object"}},
                            "timeRange": {"type": "object"},
                            "categoryKey": {"type": "string"},
                            "tags": {"type": "array", "items": {"type": "string"}},
                            "title": {"type": "string"},
                        },
                        "required": ["name", "sourceKey", "chartType"],
                        "additionalProperties": False,
                    },
                },
                "theme": {"type": "string", "description": "主题，例如 dark"},
                "layoutTemplate": {"type": "string", "description": "仅作为选择记录；系统会按组件数量生成不越界布局"},
            },
            "required": ["name", "sources", "components"],
            "additionalProperties": False,
        }

    def execute(self, db: Session, user: UserContext, arguments: dict[str, Any]) -> dict[str, Any]:
        try:
            plan = AgentCreateDataScreenPlan.model_validate(arguments)
        except ValidationError as exc:
            return {"error": {"code": "AGENT_SCREEN_PLAN_INVALID", "message": str(exc)}}

        try:
            actor_id = _uuid(user.id, "current user")
        except ValueError as exc:
            return {"error": {"code": "AGENT_USER_INVALID", "message": str(exc)}}

        source_by_key: dict[str, AgentScreenSource] = {}
        source_runtime: dict[str, dict[str, Any]] = {}
        failures: list[dict[str, str]] = []
        for source in plan.sources:
            if source.key in source_by_key:
                return {"error": {"code": "AGENT_SCREEN_DUPLICATE_SOURCE", "message": f"重复 source key: {source.key}"}}
            source_by_key[source.key] = source
            row = db.get(DataSource, source.data_source_id)
            if row is None or row.deleted_at is not None:
                failures.append({"sourceKey": source.key, "code": "DATASOURCE_NOT_FOUND", "message": "数据源不存在或已删除"})
                continue
            try:
                assert_visible(db, user.roles, source.data_source_id, is_root=user.is_root, user_id=user.id)
                # Do not trust a generated plan blindly: the source columns must match live metadata.
                if not source.schema_name:
                    failures.append(
                        {
                            "sourceKey": source.key,
                            "code": "AGENT_SCREEN_SCHEMA_REQUIRED",
                            "message": "生成 Dataset 前必须通过 schema 浏览确认 schema 名称",
                        }
                    )
                    continue
                metadata = metadata_service.list_columns(
                    db,
                    user.roles,
                    source.data_source_id,
                    source.schema_name,
                    source.table,
                    is_root=user.is_root,
                )
                actual_columns = {item.name for item in metadata.items}
                missing_columns = set(source.columns) - actual_columns
                if missing_columns:
                    failures.append(
                        {
                            "sourceKey": source.key,
                            "code": "AGENT_SCREEN_UNKNOWN_SOURCE_COLUMN",
                            "message": f"字段不在当前数据表中: {', '.join(sorted(missing_columns))}",
                        }
                    )
                    continue
            except Exception as exc:
                failures.append({"sourceKey": source.key, "code": "RESOURCE_FORBIDDEN", "message": str(exc)})
                continue
            source_runtime[source.key] = {"source": source, "connectorType": row.type, "actualColumns": actual_columns}

        if not source_runtime:
            return {"error": {"code": "AGENT_SCREEN_NO_ACCESSIBLE_SOURCE", "message": "方案中没有可访问的数据源表"}, "failures": failures}

        datasets: dict[str, dict[str, Any]] = {}
        for key, runtime in source_runtime.items():
            source: AgentScreenSource = runtime["source"]
            dataset_id = _generated_dataset_id(plan.name, source)
            dataset_payload = DatasetItemIn(
                datasetId=dataset_id,
                displayName=source.display_name or f"{plan.name} · {source.table}",
                tables=[{"name": _qualified_table(source.schema_name, source.table)}],
                allowedRoles=list(dict.fromkeys(user.roles)) or ["analyst"],
                tableSourceDataSourceId=source.data_source_id,
            )
            try:
                dataset = dataset_service.create_dataset(dataset_payload, user)
                config = upsert_config(
                    db,
                    ConfigUpsert(
                        configType="dataset_query",
                        schemaVersion="1.0",
                        refType="dataset",
                        refId=uuid.uuid5(uuid.NAMESPACE_URL, f"vitalspan.agent.dataset:{dataset_id}"),
                        payload={
                            "dataSourceId": str(source.data_source_id),
                            "connectorType": runtime["connectorType"],
                            "schema": source.schema_name,
                            "table": source.table,
                            "columns": source.columns,
                            "limit": 1000,
                        },
                    ),
                    owner_id=actor_id,
                )
                dataset = dataset_service.bind_query_config(dataset.dataset_id, config.id, user)
                preview = execute_dataset_from_config(
                    db,
                    user,
                    DatasetExecuteRequest(dataSourceId=source.data_source_id, configId=config.id, limit=10),
                )
                datasets[key] = {
                    "datasetId": dataset.dataset_id,
                    "configId": config.id,
                    "dataSourceId": source.data_source_id,
                    "columns": runtime["actualColumns"],
                    "previewRows": preview.row_count,
                }
            except Exception as exc:
                failures.append({"sourceKey": key, "code": "AGENT_DATASET_CREATE_FAILED", "message": str(exc)})

        created_components: list[dict[str, Any]] = []
        screen_widgets: list[dict[str, Any]] = []
        register_builtin_chart_types()
        for component in plan.components:
            binding = datasets.get(component.source_key)
            if binding is None:
                failures.append({"component": component.name, "code": "AGENT_COMPONENT_SOURCE_UNAVAILABLE", "message": "对应专用 Dataset 未创建成功"})
                continue
            unknown_fields = _unknown_component_fields(component, binding["columns"])
            if unknown_fields:
                failures.append({"component": component.name, "code": "AGENT_COMPONENT_UNKNOWN_FIELD", "message": f"字段不在已确认的表字段中: {', '.join(sorted(unknown_fields))}"})
                continue
            chart_config = {
                "chartType": component.chart_type,
                "styleVariant": component.style_variant,
                "dataSourceId": str(binding["dataSourceId"]),
                "mode": "dataset",
                "datasetId": binding["datasetId"],
                "configId": str(binding["configId"]),
                "dimensions": component.dimensions,
                "metrics": component.metrics,
                "axes": component.axes,
                "filters": component.filters,
                "timeRange": component.time_range,
            }
            chart_config = {key: value for key, value in chart_config.items() if value is not None}
            try:
                validated_chart = ChartViewConfig.model_validate(chart_config)
                # Validate the generated field encoding against actual query execution before publishing.
                execute_dataset_from_config(
                    db,
                    user,
                    DatasetExecuteRequest(
                        dataSourceId=binding["dataSourceId"],
                        configId=binding["configId"],
                        limit=10,
                        encoding={
                            "chartType": validated_chart.chart_type,
                            "dimensions": [field.field for field in validated_chart.dimensions],
                            "metrics": [{"field": field.field, "agg": "sum"} for field in validated_chart.metrics],
                        },
                    ),
                )
                payload = VizComponentCreateIn(
                    name=component.name,
                    description=component.description,
                    categoryKey=component.category_key,
                    widgetType="chart",
                    surfaceKinds=["dashboard", "data-screen"],
                    payloadJson={"chartConfig": validated_chart.model_dump(by_alias=True, mode="json", exclude_none=True)},
                    visibility="org",
                    tags=component.tags,
                )
                stored = component_service.create_component(db, payload, user)
                published = component_service.publish_component(db, stored.id, user)
                inline_config = validated_chart.model_dump(by_alias=True, mode="json", exclude_none=True)
                created_components.append({"id": str(published.id), "name": published.name, "datasetId": binding["datasetId"], "previewRows": binding["previewRows"]})
                screen_widgets.append({"name": component.title or component.name, "chartConfig": inline_config})
            except Exception as exc:
                failures.append({"component": component.name, "code": "AGENT_COMPONENT_CREATE_FAILED", "message": str(exc)})

        if not screen_widgets:
            return {
                "error": {"code": "AGENT_SCREEN_NO_VALID_COMPONENT", "message": "没有可校验并发布的图表组件，未创建大屏"},
                "datasets": _serialize_datasets(datasets),
                "components": created_components,
                "failures": failures,
            }

        try:
            dashboard = dash_service.create_dashboard(
                db,
                DashboardCreate(name=plan.name, description=plan.description),
                created_by=actor_id,
            )
            layout = _build_data_screen_layout(screen_widgets, theme=plan.theme)
            dashboard = dash_service.update_layout(db, dashboard.id, layout)
        except Exception as exc:
            return {
                "error": {"code": "AGENT_SCREEN_CREATE_FAILED", "message": str(exc)},
                "datasets": _serialize_datasets(datasets),
                "components": created_components,
                "failures": failures,
            }

        return {
            "dataScreen": {"id": str(dashboard.id), "name": dashboard.name, "surfaceKind": "data-screen", "widgetCount": len(screen_widgets)},
            "datasets": _serialize_datasets(datasets),
            "components": created_components,
            "layoutPolicy": "组件库已发布；大屏按人工“复用”规则保存图表配置快照，后续组件库更新不会改写本次大屏。",
            "failures": failures,
        }


class CreateDashboardTool(AgentTool):
    requires_confirmation = True
    required_permissions = ("dashboard:edit",)

    @property
    def name(self) -> str:
        return "vitalspan_create_dashboard"

    @property
    def description(self) -> str:
        return "创建一个空白仪表板。该操作会写入平台，因此只能在用户确认创建名称和用途后调用。"

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "仪表板名称"},
                "description": {"type": "string", "description": "仪表板用途说明"},
            },
            "required": ["name"],
            "additionalProperties": False,
        }

    def execute(self, db: Session, user: UserContext, arguments: dict[str, Any]) -> dict[str, Any]:
        try:
            payload = DashboardCreate(
                name=str(arguments["name"]).strip(),
                description=str(arguments.get("description") or "").strip() or None,
            )
            return dash_service.create_dashboard(
                db,
                payload,
                created_by=_uuid(user.id, "current user"),
            ).model_dump(mode="json", by_alias=True)
        except dash_service.DashboardError as exc:
            return {"error": {"code": exc.code, "message": exc.message}}
        except ValueError as exc:
            return {"error": {"code": "DASH_ARGUMENT_INVALID", "message": str(exc)}}


def _qualified_table(schema: str, table: str) -> str:
    return f"{schema}.{table}" if schema else table


def _generated_dataset_id(screen_name: str, source: AgentScreenSource) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", screen_name.lower()).strip("-") or "screen"
    # Each generation owns its Dataset even when users reuse the same screen name and source table.
    fingerprint = uuid.uuid4().hex[:10]
    return f"agent-{slug[:42]}-{fingerprint}"[:64].rstrip("-")


def _unknown_component_fields(component: AgentScreenComponent, available: set[str]) -> set[str]:
    fields: set[str] = set()
    for item in [*component.dimensions, *component.metrics, *component.filters]:
        if isinstance(item, dict) and item.get("field"):
            fields.add(str(item["field"]))
    for refs in (component.axes or {}).values():
        for item in refs:
            if isinstance(item, dict) and item.get("field"):
                fields.add(str(item["field"]))
    if component.time_range and component.time_range.get("field"):
        fields.add(str(component.time_range["field"]))
    return fields - available


def _build_data_screen_layout(widgets: list[dict[str, Any]], *, theme: str) -> dict[str, Any]:
    count = len(widgets)
    columns = 1 if count == 1 else 2 if count <= 4 else 3
    rows = (count + columns - 1) // columns
    gap = 24
    top = 36
    bottom = 24
    width = (1920 - gap * (columns + 1)) // columns
    height = (1080 - top - bottom - gap * (rows - 1)) // rows
    packed: list[dict[str, Any]] = []
    for index, widget in enumerate(widgets):
        row, column = divmod(index, columns)
        widget_id = uuid.uuid4()
        chart_config = dict(widget["chartConfig"])
        chart_config["chartId"] = str(widget_id)
        packed.append(
            {
                "id": str(widget_id),
                "type": "chart",
                "title": widget["name"],
                "x": gap + column * (width + gap),
                "y": top + row * (height + gap),
                "width": width,
                "height": height,
                "order": index,
                "chartConfig": chart_config,
            }
        )
    return {
        "version": 2,
        "canvas": {"width": 1920, "height": 1080},
        "widgets": packed,
        "globalFilters": [],
        "styleConfig": {"surfaceKind": "data-screen", "colorScheme": theme or "dark", "gapPreset": "none"},
    }


def _serialize_datasets(datasets: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "sourceKey": key,
            "datasetId": item["datasetId"],
            "configId": str(item["configId"]),
            "dataSourceId": str(item["dataSourceId"]),
            "previewRows": item["previewRows"],
        }
        for key, item in datasets.items()
    ]


def _uuid(value: Any, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError) as exc:
        raise ValueError(f"{field_name} must be a UUID") from exc


def _ensure_dashboard_visible(
    db: Session,
    user: UserContext,
    dashboard_id: uuid.UUID,
    dashboard: Any,
) -> None:
    if user.is_root:
        return
    user_id = _uuid(user.id, "current user")
    if getattr(dashboard, "created_by", None) == user_id:
        return
    from app.dashboard import acl
    from app.dashboard.service import _official_demo_slugs

    if getattr(dashboard, "slug", None) in _official_demo_slugs():
        return
    if dashboard_id in acl.list_granted_ids(db, user):
        return
    raise PermissionError("当前用户无权查看此仪表板")


def serialize_tool_result(result: dict[str, Any], *, max_chars: int = 15_000) -> str:
    text = json.dumps(result, ensure_ascii=False, default=str)
    if len(text) <= max_chars:
        return text
    return json.dumps(
        {
            "truncated": True,
            "message": "工具结果过长，已截断；请使用更精确的筛选条件或更小的 limit。",
            "preview": text[:max_chars],
        },
        ensure_ascii=False,
    )
