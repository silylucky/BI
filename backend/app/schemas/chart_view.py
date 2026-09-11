from __future__ import annotations

import re
import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator


class ChartViewError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status: int = 422,
        fields: list[dict[str, str]] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)


ChartTypeL1 = Literal["table", "line", "bar"]  # 文档常量：r28 最小集，registry 为真理源
StyleVariantL1 = Literal["default"]  # 文档常量


class ChartFieldRef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    field: str = Field(min_length=1, max_length=128)
    label: str | None = Field(default=None, max_length=128)


_DE_AXIS_IDS = frozenset(
    {"xAxis", "yAxis", "yAxisExt", "xAxisExt", "extBubble", "extColor", "drill", "extStack", "filter"}
)


def _validate_axes_payload(axes: dict[str, list[ChartFieldRef]] | None) -> dict[str, list[ChartFieldRef]] | None:
    if axes is None:
        return None
    out: dict[str, list[ChartFieldRef]] = {}
    for key, refs in axes.items():
        if key not in _DE_AXIS_IDS:
            raise ValueError(f"CHART_INVALID_AXIS:未知命名轴「{key}」")
        if len(refs) > 8:
            raise ValueError(f"CHART_INVALID_AXIS:命名轴「{key}」最多 8 个字段")
        cleaned = [r for r in refs if r.field.strip()]
        if cleaned:
            out[key] = cleaned
    return out or None


class ChartFilterRef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    field: str = Field(min_length=1, max_length=128)
    operator: Literal["eq", "neq", "gt", "gte", "lt", "lte", "in"] = "eq"
    value: str | int | float | bool | list[str]


ChartTimeRangePreset = Literal["last_7d", "last_30d", "last_90d", "mtd", "ytd"]

_CHART_TYPE_ZH: dict[str, str] = {
    "table": "表格",
    "line": "折线图",
    "bar": "柱状图",
    "pie": "饼图",
    "gauge": "仪表盘",
    "map": "地图",
    "map-3d": "3D 区域地图",
    "heatmap": "热力图",
    "kpi": "KPI 指标",
    "timeline": "时间轴",
    "sankey": "桑基图",
    "funnel": "漏斗图",
    "graph": "关系图",
}


def _field_count_message(
    chart_type: str,
    kind: Literal["dimensions", "metrics"],
    rule_min: int,
    rule_max: int,
    got: int,
    note: str | None,
) -> str:
    name = _CHART_TYPE_ZH.get(chart_type, chart_type)
    kind_zh = "维度" if kind == "dimensions" else "指标"
    if got > rule_max:
        detail = f"当前配置了 {got} 个{kind_zh}，最多允许 {rule_max} 个"
        action = f"请移除多余的{kind_zh}槽位中的字段"
    elif got < rule_min:
        detail = f"当前仅有 {got} 个{kind_zh}，至少需要 {rule_min} 个"
        action = f"请在「数据」页签向{kind_zh}槽位拖入字段"
    else:
        detail = f"需要 {rule_min}–{rule_max} 个{kind_zh}，当前有 {got} 个"
        action = f"请调整{kind_zh}字段数量"
    suffix = f"。{note}" if note else ""
    return f"{name}：{detail}。{action}{suffix}"

_EMPTY_UUID_KEYS = ("dataSourceId", "bindingId", "chartId", "configId")


def is_manual_data_binding(native_body: dict[str, Any] | None) -> bool:
    if not native_body or not isinstance(native_body, dict):
        return False
    binding = native_body.get("dataBinding")
    return isinstance(binding, dict) and binding.get("status") == "manual"


def coerce_chart_config_ids(data: Any) -> Any:
    """FE 草稿常传 \"\"；layout 持久化时视为未配置。"""
    if not isinstance(data, dict):
        return data
    out = dict(data)
    for key in _EMPTY_UUID_KEYS:
        if out.get(key) == "":
            out[key] = None
    return out


def normalize_chart_config_input(data: Any) -> Any:
    """UUID 空串归一 + 存量 chartType/styleVariant 迁移。"""
    from app.viz.migrate_chart_types import migrate_chart_config

    return migrate_chart_config(coerce_chart_config_ids(data))


class ChartTimeRangeRef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    enabled: bool = False
    mode: Literal["relative", "absolute"] = "relative"
    field: str | None = Field(default=None, max_length=128)
    relative_preset: ChartTimeRangePreset | None = Field(default=None, alias="relativePreset")
    start: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    end: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")

    @model_validator(mode="after")
    def validate_time_range(self) -> ChartTimeRangeRef:
        if not self.enabled:
            return self
        if self.field is not None and not re.match(r"^[a-zA-Z_][\w]*$", self.field):
            raise ValueError("CHART_INVALID_TIME_FIELD:时间字段名须为合法标识符")
        if self.mode == "relative":
            if self.relative_preset is None:
                raise ValueError("CHART_MISSING_TIME_PRESET:相对时间范围需选择预设区间")
            return self
        if not self.start or not self.end:
            raise ValueError("CHART_MISSING_TIME_BOUNDS:绝对时间范围需填写起止日期")
        if self.start > self.end:
            raise ValueError("CHART_INVALID_TIME_BOUNDS:起始日期不能晚于结束日期")
        return self


class ChartViewConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    chart_type: str = Field(alias="chartType")
    style_variant: str = Field(default="default", alias="styleVariant")
    data_source_id: uuid.UUID | None = Field(default=None, alias="dataSourceId")
    binding_id: uuid.UUID | None = Field(default=None, alias="bindingId")
    chart_id: uuid.UUID | None = Field(default=None, alias="chartId")
    mode: Literal["sql", "table", "native", "dataset"] | None = None
    sql: str | None = None
    schema_name: str | None = Field(default=None, alias="schema")
    table_name: str | None = Field(default=None, alias="table")
    config_id: uuid.UUID | None = Field(default=None, alias="configId")
    dataset_id: str | None = Field(default=None, alias="datasetId", max_length=64)
    native_body: dict[str, Any] | None = Field(
        default=None,
        alias="nativeBody",
        description="扩展载荷：deStyle（标题/备注/图例等）、deDisplay（刷新/行数）、deTableStyle（明细表）",
    )
    index: str | None = None
    dimensions: list[ChartFieldRef] = Field(default_factory=list, max_length=8)
    metrics: list[ChartFieldRef] = Field(default_factory=list, max_length=8)
    axes: dict[str, list[ChartFieldRef]] | None = Field(default=None, description="DE 命名轴（可选）")
    filters: list[ChartFilterRef] = Field(default_factory=list, max_length=16)
    time_range: ChartTimeRangeRef | None = Field(default=None, alias="timeRange")

    @model_validator(mode="before")
    @classmethod
    def coerce_optional_ids(cls, data: Any) -> Any:
        return normalize_chart_config_input(data)

    @model_validator(mode="after")
    def validate_axes(self) -> ChartViewConfig:
        self.axes = _validate_axes_payload(self.axes)
        return self

    @model_validator(mode="after")
    def sync_axes_legacy_projection(self) -> ChartViewConfig:
        from app.viz.chart_axis_encoding import project_axes_to_legacy_fields

        projected = project_axes_to_legacy_fields(self.chart_type, self.axes)
        if projected is not None:
            self.dimensions, self.metrics = projected
        return self

    @model_validator(mode="after")
    def normalize_graph_style_variant(self) -> "ChartViewConfig":
        if self.chart_type == "graph" and self.style_variant in ("default", None, ""):
            return self.model_copy(update={"style_variant": "force"})
        return self

    @model_validator(mode="after")
    def validate_l1_rules(self) -> ChartViewConfig:
        from app.viz.registry import ChartTypeNotRegistered, get_spec

        try:
            spec = get_spec(self.chart_type)
        except ChartTypeNotRegistered as exc:
            raise ValueError("CHART_INVALID_TYPE:图表类型无效或未注册") from exc

        if self.style_variant not in spec.style_variants:
            raise ValueError(
                "CHART_INVALID_STYLE_VARIANT:"
                f"样式子类型「{self.style_variant}」对{_CHART_TYPE_ZH.get(self.chart_type, self.chart_type)}无效"
            )


        if is_manual_data_binding(self.native_body):
            return self
        if self.binding_id is not None:
            raise ValueError("CHART_DATASET_REQUIRED:图表出数须绑定 Dataset，不再支持 bindingId 直连")
        if self.sql or self.schema_name or self.table_name:
            raise ValueError("CHART_DATASET_REQUIRED:图表出数须绑定 Dataset，不再支持手写 SQL/表直连")
        if self.mode not in (None, "dataset"):
            raise ValueError("CHART_DATASET_REQUIRED:图表出数须使用 Dataset 模式")
        if self.data_source_id is None:
            raise ValueError("CHART_MISSING_DATASOURCE:请先选择数据源")
        if self.config_id is None:
            raise ValueError("CHART_MISSING_CONFIG_ID:Dataset 模式需选择已绑定查询配置的数据集")
        if self.chart_type in ("line", "bar"):
            if not self.dimensions or not self.metrics:
                raise ValueError(
                    "CHART_MISSING_SERIES:折线图/柱状图需至少配置 1 个维度与 1 个指标",
                )
            return self
        rule = spec.field_rule
        if self.chart_type == "gis-map":
            from app.viz.builtin._helpers import GIS_MAP_RULE

            rule = GIS_MAP_RULE
        dim_n = len(self.dimensions)
        met_n = len(self.metrics)
        if not (rule.min_dimensions <= dim_n <= rule.max_dimensions):
            raise ValueError(
                "CHART_FIELD_REQUIREMENT:"
                + _field_count_message(
                    self.chart_type,
                    "dimensions",
                    rule.min_dimensions,
                    rule.max_dimensions,
                    dim_n,
                    rule.note,
                )
            )
        if not (rule.min_metrics <= met_n <= rule.max_metrics):
            raise ValueError(
                "CHART_FIELD_REQUIREMENT:"
                + _field_count_message(
                    self.chart_type,
                    "metrics",
                    rule.min_metrics,
                    rule.max_metrics,
                    met_n,
                    rule.note,
                )
            )
        return self


class ChartViewConfigLayout(BaseModel):
    """看板 layout 持久化用：允许未绑定数据源的草稿 widget（对标 DE 草稿保存）。"""

    model_config = ConfigDict(populate_by_name=True)
    chart_type: str = Field(alias="chartType")
    style_variant: str = Field(default="default", alias="styleVariant")
    data_source_id: uuid.UUID | str | None = Field(default=None, alias="dataSourceId")
    binding_id: uuid.UUID | None = Field(default=None, alias="bindingId")
    chart_id: uuid.UUID | None = Field(default=None, alias="chartId")
    mode: Literal["sql", "table", "native", "dataset"] | None = None
    sql: str | None = None
    schema_name: str | None = Field(default=None, alias="schema")
    table_name: str | None = Field(default=None, alias="table")
    config_id: uuid.UUID | None = Field(default=None, alias="configId")
    dataset_id: str | None = Field(default=None, alias="datasetId", max_length=64)
    native_body: dict[str, Any] | None = Field(
        default=None,
        alias="nativeBody",
        description="扩展载荷：deStyle（标题/备注/图例等）、deDisplay（刷新/行数）、deTableStyle（明细表）",
    )
    index: str | None = None
    dimensions: list[ChartFieldRef] = Field(default_factory=list, max_length=8)
    metrics: list[ChartFieldRef] = Field(default_factory=list, max_length=8)
    axes: dict[str, list[ChartFieldRef]] | None = Field(default=None, description="DE 命名轴（可选）")
    filters: list[ChartFilterRef] = Field(default_factory=list, max_length=16)
    time_range: ChartTimeRangeRef | None = Field(default=None, alias="timeRange")

    @model_validator(mode="before")
    @classmethod
    def coerce_optional_ids(cls, data: Any) -> Any:
        return normalize_chart_config_input(data)

    @model_validator(mode="after")
    def validate_axes_layout(self) -> ChartViewConfigLayout:
        self.axes = _validate_axes_payload(self.axes)
        return self

    @model_validator(mode="after")
    def normalize_graph_style_variant(self) -> "ChartViewConfigLayout":
        if self.chart_type == "graph" and self.style_variant in ("default", None, ""):
            return self.model_copy(update={"style_variant": "force"})
        return self

    @model_validator(mode="after")
    def validate_layout_shell(self) -> ChartViewConfigLayout:
        from app.viz.registry import ChartTypeNotRegistered, get_spec

        try:
            spec = get_spec(self.chart_type)
        except ChartTypeNotRegistered as exc:
            raise ValueError("CHART_INVALID_TYPE:图表类型无效或未注册") from exc

        if self.style_variant not in spec.style_variants:
            raise ValueError(
                "CHART_INVALID_STYLE_VARIANT:"
                f"样式子类型「{self.style_variant}」对{_CHART_TYPE_ZH.get(self.chart_type, self.chart_type)}无效"
            )
        return self


def validate_chart_view_config_layout(data: dict[str, Any]) -> ChartViewConfigLayout:
    try:
        return ChartViewConfigLayout.model_validate(data)
    except ValidationError as exc:
        raise _map_validation_error(exc) from exc


def _loc_to_field(loc: tuple[object, ...]) -> str:
    parts: list[str] = []
    for item in loc:
        if item == "chart_type":
            parts.append("chartType")
        elif item == "data_source_id":
            parts.append("dataSourceId")
        elif isinstance(item, str):
            parts.append(item)
        elif isinstance(item, int):
            parts[-1] = f"{parts[-1]}[{item}]" if parts else str(item)
    if not parts:
        return "config"
    # Collapse indexed list paths (e.g. dimensions[0].field → dimensions)
    root = parts[0].split("[", 1)[0]
    return root


def _series_missing_fields(text: str) -> list[dict[str, str]]:
    return [
        {"field": "dimensions", "message": text},
        {"field": "metrics", "message": text},
    ]


_CODE_FIELD_HINTS: dict[str, list[str]] = {
    "CHART_MISSING_DATASOURCE": ["dataSourceId"],
    "CHART_MISSING_SQL": ["sql"],
    "CHART_MISSING_TABLE": ["schema", "table"],
    "CHART_MISSING_MODE": ["mode"],
    "CHART_MISSING_CONFIG_ID": ["configId"],
    "CHART_DATASET_REQUIRED": ["mode", "datasetId", "configId"],
    "CHART_MISSING_NATIVE_BODY": ["nativeBody"],
    "CHART_INVALID_STYLE_VARIANT": ["styleVariant"],
    "CHART_FIELD_REQUIREMENT": ["dimensions", "metrics"],
    "CHART_SQL_NOT_READONLY": ["sql"],
}


def _fields_for_code(code: str, text: str, loc: tuple[object, ...]) -> list[dict[str, str]]:
    if code == "CHART_MISSING_SERIES":
        return _series_missing_fields(text)
    if code == "CHART_FIELD_REQUIREMENT":
        if "维度" in text or "dimensions" in text:
            return [{"field": "dimensions", "message": text}]
        if "指标" in text or "度量" in text or "metrics" in text:
            return [{"field": "metrics", "message": text}]
        return [{"field": "dimensions", "message": text}]
    hints = _CODE_FIELD_HINTS.get(code)
    if hints:
        return [{"field": name, "message": text} for name in hints]
    field_name = _loc_to_field(loc)
    return [{"field": field_name, "message": text}]


def _map_validation_error(exc: ValidationError) -> ChartViewError:
    fields: list[dict[str, str]] = []
    code = "CHART_INVALID"
    message = "图表配置无效，请检查各字段"
    for err in exc.errors():
        msg = str(err.get("msg", "Invalid chart config"))
        if msg.startswith("Value error, "):
            msg = msg.removeprefix("Value error, ")
        loc = err.get("loc", ())
        if msg.startswith("CHART_") and ":" in msg:
            err_code, text = msg.split(":", 1)
            code = err_code
            message = text
            fields.extend(_fields_for_code(err_code, text, tuple(loc)))
            continue
        field_name = _loc_to_field(tuple(loc))
        fields.append({"field": field_name, "message": msg})
    if fields:
        return ChartViewError(code, message, 422, fields)
    return ChartViewError(code, message, 422, fields)


def validate_chart_view_config(data: dict[str, Any]) -> ChartViewConfig:
    try:
        return ChartViewConfig.model_validate(data)
    except ValidationError as exc:
        raise _map_validation_error(exc) from exc
